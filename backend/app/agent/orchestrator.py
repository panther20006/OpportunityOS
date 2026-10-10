import time
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from sqlalchemy.orm import Session
from app.config import settings
from app.db import SessionLocal
from app.models.user import User, UserProfile
from app.models.skill import Skill, UserSkill, OpportunitySkill
from app.models.career_goal import CareerGoal
from app.models.opportunity import Opportunity, OpportunityMatch
from app.models.agent import AgentSession, SearchHistory
from app.models.roadmap import SkillGap, Roadmap, RoadmapStep
from app.search.serpapi_client import SerpApiClient
from app.search.normalizer import (
    normalize_google_job,
    normalize_google_organic,
    normalize_google_news,
)
from app.matching.skills import extract_skills_from_text
from app.matching.scorer import score_opportunity
from app.matching.gap import analyze_skill_gaps
from app.matching.roadmap import build_template_roadmap
from app.agent.tools import generate_fallback_queries
from app.core.logging import logger


def utcnow():
    return datetime.now(timezone.utc)


def update_stage(
    stages: List[Dict[str, Any]],
    key: str,
    status: str,
    detail: Optional[Dict[str, Any]] = None,
    duration_ms: Optional[int] = None,
):
    for st in stages:
        if st["key"] == key:
            st["status"] = status
            if detail is not None:
                st["detail"] = detail
            if duration_ms is not None:
                st["duration_ms"] = duration_ms
            return
    # If not found, append
    item = {"key": key, "status": status}
    if detail is not None:
        item["detail"] = detail
    if duration_ms is not None:
        item["duration_ms"] = duration_ms
    stages.append(item)


async def run_agent(
    session_id: str,
    user_id: str,
    overrides: Optional[Dict[str, Any]] = None,
    include_news: bool = True,
):
    """
    Background worker that executes the 7-stage AI Career Agent pipeline.
    """
    db: Session = SessionLocal()
    session_uuid = uuid.UUID(session_id)
    user_uuid = uuid.UUID(user_id)

    agent_session = db.get(AgentSession, session_uuid)
    if not agent_session:
        logger.error(f"Agent session {session_id} not found")
        db.close()
        return

    start_timestamp = time.time()
    agent_session.status = "running"
    agent_session.started_at = utcnow()

    # Initial stages timeline
    stages = [
        {"key": "plan_queries", "status": "running"},
        {"key": "search", "status": "pending"},
        {"key": "normalize_dedupe", "status": "pending"},
        {"key": "extract_skills", "status": "pending"},
        {"key": "match", "status": "pending"},
        {"key": "skill_gap", "status": "pending"},
        {"key": "roadmap", "status": "pending"},
    ]
    agent_session.stages = stages
    db.commit()

    try:
        user = db.get(User, user_uuid)
        profile = db.query(UserProfile).filter(UserProfile.user_id == user_uuid).first()
        career_goal = (
            db.query(CareerGoal)
            .filter(CareerGoal.user_id == user_uuid, CareerGoal.is_active == True)
            .first()
        )
        user_skills = db.query(UserSkill).filter(UserSkill.user_id == user_uuid).all()
        user_skill_ids = {str(us.skill_id) for us in user_skills}

        # Handle overrides
        target_role = career_goal.target_role if career_goal else "Software Engineer"
        location_city = (
            (overrides.get("location_city") if overrides else None)
            or (profile.location_city if profile else "Ahmedabad")
        )
        location_state = profile.location_state if profile else "Gujarat"
        if overrides and "open_to_remote" in overrides and overrides["open_to_remote"] is not None:
            open_to_remote = bool(overrides["open_to_remote"])
        elif profile and profile.open_to_remote is not None:
            open_to_remote = bool(profile.open_to_remote)
        else:
            open_to_remote = True
        exp_level = profile.experience_level if profile else "student"
        pref_types = (
            (overrides.get("opportunity_types") if overrides else None)
            or (career_goal.opportunity_types if career_goal else ["internship"])
        )

        # -------------------------------------------------------------
        # STAGE 1: plan_queries
        # -------------------------------------------------------------
        t0 = time.time()
        planned_queries = generate_fallback_queries(
            target_role=target_role,
            experience_level=exp_level,
            location_city=location_city,
            open_to_remote=open_to_remote,
            opportunity_types=pref_types,
            include_news=include_news,
        )
        dur1 = int((time.time() - t0) * 1000)
        update_stage(stages, "plan_queries", "done", {"queries": planned_queries}, dur1)
        update_stage(stages, "search", "running", {"completed": 0, "total": len(planned_queries), "results": 0})
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 2: search
        # -------------------------------------------------------------
        t0 = time.time()
        serp_client = SerpApiClient()
        collected_results = []
        news_items = []
        live_calls = 0
        cached_calls = 0

        for i, q_item in enumerate(planned_queries):
            engine = q_item["engine"]
            q = q_item["q"]
            loc = q_item.get("location")
            purpose = q_item["purpose"]

            search_params = {"q": q}
            if loc and engine == "google_jobs":
                search_params["location"] = loc

            try:
                raw_json, is_cached, latency = await serp_client.search(db, engine, search_params)
                if is_cached:
                    cached_calls += 1
                else:
                    live_calls += 1

                # Atomically record quota usage so concurrent operations protect daily budget
                agent_session.serp_calls_live = live_calls
                agent_session.serp_calls_cached = cached_calls

                res_count = len(
                    raw_json.get("jobs_results", [])
                    or raw_json.get("organic_results", [])
                    or raw_json.get("news_results", [])
                )

                # Record search history
                sh = SearchHistory(
                    user_id=user_uuid,
                    agent_session_id=session_uuid,
                    engine=engine,
                    query=q,
                    location=loc,
                    purpose=purpose,
                    result_count=res_count,
                    cached=is_cached,
                    latency_ms=latency,
                )
                db.add(sh)

                if engine == "google_jobs":
                    for j in raw_json.get("jobs_results", []):
                        collected_results.append(("google_jobs", j))
                elif engine == "google":
                    for o in raw_json.get("organic_results", []):
                        collected_results.append(("google", o))
                elif engine == "google_news":
                    for n in raw_json.get("news_results", []):
                        news_items.append(normalize_google_news(n))

            except Exception as e:
                logger.error(f"Search query error on {engine}: {e}")
                warnings_list = list(agent_session.warnings or [])
                warnings_list.append({"code": "SEARCH_WARNING", "message": str(e), "engine": engine})
                agent_session.warnings = warnings_list

            update_stage(stages, "search", "running", {
                "completed": i + 1,
                "total": len(planned_queries),
                "results": len(collected_results),
            })
            agent_session.stages = list(stages)
            db.commit()

        dur2 = int((time.time() - t0) * 1000)
        agent_session.serp_calls_live = live_calls
        agent_session.serp_calls_cached = cached_calls
        update_stage(stages, "search", "done", {"total_collected": len(collected_results)}, dur2)
        update_stage(stages, "normalize_dedupe", "running")
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 3: normalize_dedupe
        # -------------------------------------------------------------
        t0 = time.time()
        persisted_opportunities: List[Opportunity] = []
        seen_hashes = set()
        seen_opp_ids = set()

        for source_type, raw_item in collected_results:
            norm_dict = None
            if source_type == "google_jobs":
                norm_dict = normalize_google_job(raw_item)
            elif source_type == "google":
                norm_dict = normalize_google_organic(raw_item)

            if not norm_dict:
                continue

            h = norm_dict["dedupe_hash"]
            if h in seen_hashes:
                continue
            seen_hashes.add(h)

            existing_opp = db.query(Opportunity).filter(Opportunity.dedupe_hash == h).first()
            if existing_opp:
                existing_opp.last_seen_at = utcnow()
                # Refresh listing details with reliable newer information
                if norm_dict.get("description") and len(norm_dict["description"]) >= len(existing_opp.description or ""):
                    existing_opp.description = norm_dict["description"]
                if norm_dict.get("apply_url"):
                    existing_opp.apply_url = norm_dict["apply_url"]
                if norm_dict.get("posted_at_text"):
                    existing_opp.posted_at_text = norm_dict["posted_at_text"]
                if norm_dict.get("highlights"):
                    existing_opp.highlights = norm_dict["highlights"]
                if norm_dict.get("external_id") and not existing_opp.external_id:
                    existing_opp.external_id = norm_dict["external_id"]
                if norm_dict.get("source_via") and not existing_opp.source_via:
                    existing_opp.source_via = norm_dict["source_via"]
                if norm_dict.get("raw"):
                    existing_opp.raw = norm_dict["raw"]

                if existing_opp.id not in seen_opp_ids:
                    seen_opp_ids.add(existing_opp.id)
                    persisted_opportunities.append(existing_opp)
            else:
                new_opp = Opportunity(
                    dedupe_hash=norm_dict["dedupe_hash"],
                    source_engine=norm_dict["source_engine"],
                    external_id=norm_dict["external_id"],
                    title=norm_dict["title"],
                    company_name=norm_dict["company_name"],
                    location=norm_dict["location"],
                    is_remote=norm_dict["is_remote"],
                    opportunity_type=norm_dict["opportunity_type"],
                    schedule_type=norm_dict["schedule_type"],
                    description=norm_dict["description"],
                    highlights=norm_dict["highlights"],
                    source_via=norm_dict["source_via"],
                    apply_url=norm_dict["apply_url"],
                    posted_at_text=norm_dict["posted_at_text"],
                    raw=norm_dict["raw"],
                    is_demo=norm_dict.get("is_demo", False),
                )
                db.add(new_opp)
                db.flush()
                seen_opp_ids.add(new_opp.id)
                persisted_opportunities.append(new_opp)

        dur3 = int((time.time() - t0) * 1000)
        update_stage(stages, "normalize_dedupe", "done", {"unique_count": len(persisted_opportunities)}, dur3)
        update_stage(stages, "extract_skills", "running")
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 4: extract_skills
        # -------------------------------------------------------------
        t0 = time.time()
        all_canonical_skills = db.query(Skill).all()
        skills_by_id = {str(s.id): s for s in all_canonical_skills}
        total_extracted = 0

        opp_skill_map: Dict[str, List[Dict[str, Any]]] = {}

        for opp in persisted_opportunities:
            extracted_pairs = extract_skills_from_text(
                opp.description or "",
                opp.highlights or [],
                all_canonical_skills,
            )
            opp_skill_map[str(opp.id)] = []

            for skill_obj, req_type in extracted_pairs:
                opp_skill_map[str(opp.id)].append({
                    "skill_id": str(skill_obj.id),
                    "skill_name": skill_obj.name,
                    "requirement": req_type,
                })

                # Check if OpportunitySkill already recorded
                existing_os = (
                    db.query(OpportunitySkill)
                    .filter(
                        OpportunitySkill.opportunity_id == opp.id,
                        OpportunitySkill.skill_id == skill_obj.id,
                    )
                    .first()
                )
                if not existing_os:
                    new_os = OpportunitySkill(
                        opportunity_id=opp.id,
                        skill_id=skill_obj.id,
                        requirement=req_type,
                        extraction_method="dictionary",
                    )
                    db.add(new_os)
                    total_extracted += 1

        dur4 = int((time.time() - t0) * 1000)
        update_stage(stages, "extract_skills", "done", {"extracted_total": total_extracted}, dur4)
        update_stage(stages, "match", "running")
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 5: match
        # -------------------------------------------------------------
        t0 = time.time()
        scored_matches = []
        best_score = 0

        # Clean existing matches for idempotency
        db.query(OpportunityMatch).filter(OpportunityMatch.agent_session_id == session_uuid).delete()
        db.flush()

        for opp in persisted_opportunities:
            opp_skills = opp_skill_map.get(str(opp.id), [])
            score_res = score_opportunity(
                opportunity_skills=opp_skills,
                user_skill_ids=user_skill_ids,
                target_role=target_role,
                opp_title=opp.title,
                opp_location=opp.location or "",
                opp_is_remote=opp.is_remote,
                opp_type=opp.opportunity_type,
                opp_description=opp.description or "",
                user_city=location_city or "",
                user_state=location_state or "",
                user_open_to_remote=open_to_remote,
                user_exp_level=exp_level,
                user_pref_types=pref_types,
            )

            score_val = score_res["match_score"]
            if score_val > best_score:
                best_score = score_val

            match_obj = OpportunityMatch(
                user_id=user_uuid,
                opportunity_id=opp.id,
                agent_session_id=session_uuid,
                match_score=score_val,
                breakdown=score_res["breakdown"],
                matched_skill_ids=score_res["matched_skill_ids"],
                missing_skill_ids=score_res["missing_skill_ids"],
                low_confidence=score_res["low_confidence"],
            )
            db.add(match_obj)
            scored_matches.append({
                "opportunity_id": str(opp.id),
                "match_score": score_val,
                "opportunity_skills": opp_skills,
                "missing_skill_ids": score_res["missing_skill_ids"],
                "opp_obj": opp,
            })

        # Sort matches by score desc
        scored_matches.sort(key=lambda x: x["match_score"], reverse=True)
        dur5 = int((time.time() - t0) * 1000)
        update_stage(stages, "match", "done", {"matches_count": len(scored_matches), "best_score": best_score}, dur5)
        update_stage(stages, "skill_gap", "running")
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 6: skill_gap
        # -------------------------------------------------------------
        t0 = time.time()
        gaps = analyze_skill_gaps(
            top_matches=scored_matches,
            user_skill_ids=user_skill_ids,
            top_n=settings.GAP_TOP_N,
        )

        db.query(SkillGap).filter(SkillGap.agent_session_id == session_uuid).delete()
        db.flush()

        for gap in gaps:
            gap_obj = SkillGap(
                user_id=user_uuid,
                agent_session_id=session_uuid,
                skill_id=uuid.UUID(gap["skill_id"]),
                demand_count=gap["demand_count"],
                demand_pct=gap["demand_pct"],
                avg_uplift=gap["avg_uplift"],
                priority_score=gap["priority_score"],
                priority=gap["priority"],
                rank=gap["rank"],
                opportunity_ids=gap["opportunity_ids"],
            )
            db.add(gap_obj)

        dur6 = int((time.time() - t0) * 1000)
        update_stage(stages, "skill_gap", "done", {"gaps_count": len(gaps)}, dur6)
        update_stage(stages, "roadmap", "running")
        agent_session.stages = list(stages)
        db.commit()

        # -------------------------------------------------------------
        # STAGE 7: roadmap
        # -------------------------------------------------------------
        t0 = time.time()
        top_opps = [m["opp_obj"] for m in scored_matches[:3]]

        # Collect completed milestones from previous roadmaps to maintain progress continuity
        completed_prior_steps = (
            db.query(RoadmapStep)
            .join(Roadmap, RoadmapStep.roadmap_id == Roadmap.id)
            .filter(Roadmap.user_id == user_uuid, RoadmapStep.is_completed == True)
            .all()
        )

        # Deactivate previous active roadmaps & clear any prior for this session
        db.query(Roadmap).filter(Roadmap.agent_session_id == session_uuid).delete()
        db.query(Roadmap).filter(Roadmap.user_id == user_uuid, Roadmap.is_active == True).update(
            {"is_active": False}
        )
        db.flush()

        roadmap_data = build_template_roadmap(
            target_role=target_role,
            top_gaps=gaps,
            skills_by_id=skills_by_id,
            top_opportunities=top_opps,
            weekly_hours=profile.weekly_learning_hours if profile else 10,
        )

        new_roadmap = Roadmap(
            user_id=user_uuid,
            agent_session_id=session_uuid,
            title=roadmap_data["title"],
            summary=roadmap_data["summary"],
            total_weeks=roadmap_data["total_weeks"],
            generation_method=roadmap_data["generation_method"],
            is_active=True,
        )
        db.add(new_roadmap)
        db.flush()

        for step in roadmap_data["steps"]:
            step_skill_uuid = uuid.UUID(step["skill_id"]) if step.get("skill_id") else None

            # Carry completion forward only when new milestone represents the same learning objective
            prior_completion = None
            for prev in completed_prior_steps:
                if step_skill_uuid and prev.skill_id == step_skill_uuid and prev.step_type == step["step_type"]:
                    prior_completion = prev
                    break
                elif prev.title.strip().lower() == step["title"].strip().lower() and prev.step_type == step["step_type"]:
                    prior_completion = prev
                    break

            is_step_completed = prior_completion is not None
            step_completed_at = prior_completion.completed_at if prior_completion else None

            step_obj = RoadmapStep(
                roadmap_id=new_roadmap.id,
                skill_id=step_skill_uuid,
                opportunity_id=uuid.UUID(step["opportunity_id"]) if step.get("opportunity_id") else None,
                step_order=step["step_order"],
                step_type=step["step_type"],
                title=step["title"],
                description=step.get("description"),
                reason=step.get("reason"),
                estimated_hours=step.get("estimated_hours"),
                action=step.get("action"),
                resource_query=step.get("resource_query"),
                resources=[],
                is_completed=is_step_completed,
                completed_at=step_completed_at,
            )
            db.add(step_obj)

        dur7 = int((time.time() - t0) * 1000)
        update_stage(stages, "roadmap", "done", {"steps_count": len(roadmap_data["steps"])}, dur7)

        # -------------------------------------------------------------
        # Finalize Session
        # -------------------------------------------------------------
        total_duration = int((time.time() - start_timestamp) * 1000)
        agent_session.status = "partial" if agent_session.warnings else "completed"
        agent_session.completed_at = utcnow()
        agent_session.duration_ms = total_duration
        agent_session.result_summary = {
            "opportunity_count": len(scored_matches),
            "best_score": best_score,
            "news": news_items[:5],
        }
        agent_session.stages = list(stages)
        db.commit()
        logger.info(f"Agent session {session_id} finished with status={agent_session.status} in {total_duration}ms")

    except Exception as e:
        logger.exception(f"Fatal error in agent run: {e}")
        db.rollback()
        agent_session.status = "failed"
        agent_session.error_code = "AGENT_PIPELINE_ERROR"
        agent_session.completed_at = utcnow()
        db.commit()
    finally:
        db.close()
