import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from app.db import get_db
from app.models.user import User
from app.models.opportunity import Opportunity, OpportunityMatch, SavedOpportunity
from app.models.application import Application
from app.models.agent import AgentSession
from app.models.skill import Skill, OpportunitySkill
from app.schemas.opportunity import (
    OpportunityListResponse,
    OpportunityListItem,
    TopSkillItem,
    OpportunityDetailResponse,
    OpportunityDetailData,
    MatchDetail,
    MatchBreakdown,
    BreakdownComponent,
    SkillRequirementItem,
    SimpleApplicationDetail,
    SaveOpportunityRequest,
    SaveOpportunityResponse,
)
from app.api.deps import get_current_user
from app.core.errors import AppError

router = APIRouter(tags=["Opportunities"])


def extract_salary_from_raw(raw_data) -> Optional[str]:
    if not raw_data or not isinstance(raw_data, dict):
        return None
    detected = raw_data.get("detected_extensions")
    if isinstance(detected, dict) and detected.get("salary"):
        return str(detected["salary"])
    if raw_data.get("salary"):
        return str(raw_data["salary"])
    if raw_data.get("salary_text"):
        return str(raw_data["salary_text"])
    return None


@router.get("/opportunities", response_model=OpportunityListResponse)
def list_opportunities(
    q: Optional[str] = Query(None),
    session_id: Optional[str] = Query(None),
    saved: Optional[bool] = Query(None),
    saved_only: Optional[bool] = Query(None),
    type: Optional[str] = Query(None),
    remote: Optional[bool] = Query(None),
    min_score: Optional[int] = Query(None, ge=0, le=100),
    engine: Optional[str] = Query(None),
    sort: Optional[str] = Query(None),
    sort_by: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    is_saved = bool(saved or saved_only)
    target_session_id = None

    # Normalize sort parameter
    raw_sort = sort or sort_by or "score"
    if raw_sort in ("match_score", "score"):
        effective_sort = "score"
    elif raw_sort in ("posted_at", "recent"):
        effective_sort = "recent"
    elif raw_sort == "title":
        effective_sort = "title"
    else:
        effective_sort = "score"

    # Normalize opportunity type parameter (support 'job' alias for 'full_time')
    normalized_type = type
    if normalized_type == "job":
        normalized_type = "full_time"

    has_session = False
    if is_saved:
        saved_records = (
            db.query(SavedOpportunity)
            .filter(SavedOpportunity.user_id == current_user.id)
            .all()
        )
        saved_opp_ids = [s.opportunity_id for s in saved_records]
        if not saved_opp_ids:
            return OpportunityListResponse(items=[], page=page, page_size=page_size, total=0)

        query = db.query(Opportunity).filter(Opportunity.id.in_(saved_opp_ids))
    else:
        if session_id:
            try:
                target_session_id = uuid.UUID(session_id)
            except ValueError:
                raise AppError("NOT_FOUND", "Session not found", 404)
            # Verify session ownership
            sess = db.query(AgentSession).filter(AgentSession.id == target_session_id).first()
            if not sess:
                raise AppError("NOT_FOUND", "Session not found", 404)
            if sess.user_id != current_user.id:
                raise AppError("FORBIDDEN", "You do not have access to this session", 403)
            has_session = True
        else:
            # Find latest completed or partial session for current user
            latest_sess = (
                db.query(AgentSession)
                .filter(
                    AgentSession.user_id == current_user.id,
                    AgentSession.status.in_(["completed", "partial"]),
                )
                .order_by(AgentSession.created_at.desc())
                .first()
            )
            if latest_sess:
                target_session_id = latest_sess.id
                has_session = True

        if has_session:
            query = (
                db.query(Opportunity, OpportunityMatch)
                .join(OpportunityMatch, OpportunityMatch.opportunity_id == Opportunity.id)
                .filter(
                    OpportunityMatch.user_id == current_user.id,
                    OpportunityMatch.agent_session_id == target_session_id,
                )
            )
        else:
            query = db.query(Opportunity)

    # Server-side keyword search (title, company, location, description)
    if q and q.strip():
        search_pattern = f"%{q.strip()}%"
        query = query.filter(
            or_(
                Opportunity.title.ilike(search_pattern),
                Opportunity.company_name.ilike(search_pattern),
                Opportunity.location.ilike(search_pattern),
                Opportunity.description.ilike(search_pattern),
            )
        )

    # Apply filters
    if normalized_type and normalized_type != "all":
        query = query.filter(Opportunity.opportunity_type == normalized_type)

    if remote is not None:
        query = query.filter(Opportunity.is_remote == remote)

    if min_score is not None and has_session:
        query = query.filter(OpportunityMatch.match_score >= min_score)

    if engine:
        query = query.filter(Opportunity.source_engine == engine)

    total = query.count()

    # Sorting
    if has_session and not is_saved:
        if effective_sort == "recent":
            query = query.order_by(Opportunity.created_at.desc())
        elif effective_sort == "title":
            query = query.order_by(Opportunity.title.asc())
        else:
            query = query.order_by(OpportunityMatch.match_score.desc(), Opportunity.created_at.desc())
    else:
        if effective_sort == "title":
            query = query.order_by(Opportunity.title.asc())
        else:
            query = query.order_by(Opportunity.created_at.desc())

    # Pagination
    offset = (page - 1) * page_size
    results = query.offset(offset).limit(page_size).all()

    # Preload saved and application status for current user
    user_saved_ids = {
        s.opportunity_id
        for s in db.query(SavedOpportunity.opportunity_id)
        .filter(SavedOpportunity.user_id == current_user.id)
        .all()
    }
    user_app_rows = (
        db.query(Application.opportunity_id, Application.status, Application.id)
        .filter(Application.user_id == current_user.id)
        .all()
    )
    user_applications = {a[0]: a[1] for a in user_app_rows}
    user_app_ids = {a[0]: str(a[2]) for a in user_app_rows}

    # Canonical skill name map normalized to string keys
    all_skills = {str(s.id): s.name for s in db.query(Skill.id, Skill.name).all()}

    items: List[OpportunityListItem] = []

    for res in results:
        if has_session and not is_saved:
            opp, m = res
            score = m.match_score if m else None
            low_conf = m.low_confidence if m else False
            matched_ids = list(m.matched_skill_ids or []) if m else []
            missing_ids = list(m.missing_skill_ids or []) if m else []
        else:
            opp = res
            m = (
                db.query(OpportunityMatch)
                .filter(
                    OpportunityMatch.user_id == current_user.id,
                    OpportunityMatch.opportunity_id == opp.id,
                )
                .order_by(OpportunityMatch.created_at.desc())
                .first()
            )
            score = m.match_score if m else None
            low_conf = m.low_confidence if m else False
            matched_ids = list(m.matched_skill_ids or []) if m else []
            missing_ids = list(m.missing_skill_ids or []) if m else []

        # Top skills formatting with string-safe ID lookups
        top_skills = []
        for sid in matched_ids[:2]:
            sid_str = str(sid)
            if sid_str in all_skills:
                top_skills.append(TopSkillItem(name=all_skills[sid_str], has=True, requirement="required"))
        for sid in missing_ids[:2]:
            sid_str = str(sid)
            if sid_str in all_skills:
                top_skills.append(TopSkillItem(name=all_skills[sid_str], has=False, requirement="required"))

        # Fallback to direct OpportunitySkills if matching not available
        if not top_skills and opp.skills:
            for opp_sk in opp.skills[:3]:
                sk_name = all_skills.get(str(opp_sk.skill_id))
                if sk_name:
                    top_skills.append(TopSkillItem(name=sk_name, has=False, requirement=getattr(opp_sk, "requirement", "required") or "required"))

        salary_text = extract_salary_from_raw(opp.raw)

        items.append(
            OpportunityListItem(
                id=str(opp.id),
                title=opp.title,
                company_name=opp.company_name,
                location=opp.location,
                is_remote=opp.is_remote,
                opportunity_type=opp.opportunity_type,
                source_engine=opp.source_engine,
                source_via=opp.source_via,
                posted_at_text=opp.posted_at_text,
                salary_text=salary_text,
                match_score=score,
                low_confidence=low_conf,
                top_skills=top_skills[:3],
                saved=opp.id in user_saved_ids,
                application_status=user_applications.get(opp.id),
                application_id=user_app_ids.get(opp.id),
                is_demo=bool(opp.is_demo),
            )
        )

    return OpportunityListResponse(
        session_id=str(target_session_id) if target_session_id else None,
        items=items,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/opportunities/{opp_id}", response_model=OpportunityDetailResponse)
def get_opportunity_detail(
    opp_id: str,
    session_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        opp_uuid = uuid.UUID(opp_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    opp = db.get(Opportunity, opp_uuid)
    if not opp:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    # Match retrieval
    match_query = db.query(OpportunityMatch).filter(
        OpportunityMatch.user_id == current_user.id,
        OpportunityMatch.opportunity_id == opp_uuid,
    )
    if session_id:
        try:
            sess_uuid = uuid.UUID(session_id)
            sess = db.query(AgentSession).filter(AgentSession.id == sess_uuid).first()
            if not sess:
                raise AppError("NOT_FOUND", "Session not found", 404)
            if sess.user_id != current_user.id:
                raise AppError("FORBIDDEN", "You do not have access to this session", 403)
            match_query = match_query.filter(OpportunityMatch.agent_session_id == sess_uuid)
        except ValueError:
            raise AppError("NOT_FOUND", "Session not found", 404)

    match_record = match_query.order_by(OpportunityMatch.created_at.desc()).first()
    all_skills = {str(s.id): s.name for s in db.query(Skill.id, Skill.name).all()}

    if match_record:
        raw_components = match_record.breakdown.get("components", []) if match_record.breakdown else []
        components = [
            BreakdownComponent(
                key=c["key"],
                weight=c["weight"],
                score=c["score"],
                points=c["points"],
            )
            for c in raw_components
        ]
        breakdown = MatchBreakdown(
            weights_version=match_record.breakdown.get("weights_version", "v1") if match_record.breakdown else "v1",
            components=components,
        )

        matched_skills = [
            SkillRequirementItem(id=str(sid), name=all_skills.get(str(sid), "Skill"), requirement="required")
            for sid in match_record.matched_skill_ids or []
        ]
        missing_skills = [
            SkillRequirementItem(id=str(sid), name=all_skills.get(str(sid), "Skill"), requirement="required")
            for sid in match_record.missing_skill_ids or []
        ]

        match_detail = MatchDetail(
            match_score=match_record.match_score,
            low_confidence=match_record.low_confidence,
            breakdown=breakdown,
            matched_skills=matched_skills,
            missing_skills=missing_skills,
        )
    else:
        # Nullable match score when match has not been computed for this user/opportunity
        match_detail = MatchDetail(
            match_score=None,
            low_confidence=False,
            breakdown=None,
            matched_skills=[],
            missing_skills=[],
        )

    # Saved check
    saved_rec = db.query(SavedOpportunity).filter(
        SavedOpportunity.user_id == current_user.id,
        SavedOpportunity.opportunity_id == opp_uuid,
    ).first()

    # Application check
    app_rec = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.opportunity_id == opp_uuid,
    ).first()

    salary_text = extract_salary_from_raw(opp.raw)

    return OpportunityDetailResponse(
        opportunity=OpportunityDetailData(
            id=str(opp.id),
            title=opp.title,
            company_name=opp.company_name,
            location=opp.location,
            is_remote=opp.is_remote,
            opportunity_type=opp.opportunity_type,
            schedule_type=opp.schedule_type,
            source_engine=opp.source_engine,
            source_via=opp.source_via,
            apply_url=opp.apply_url,
            posted_at_text=opp.posted_at_text,
            salary_text=salary_text,
            description=opp.description,
            highlights=opp.highlights,
            first_seen_at=opp.first_seen_at,
            is_demo=bool(opp.is_demo),
        ),
        match=match_detail,
        saved=saved_rec is not None,
        application=SimpleApplicationDetail(id=str(app_rec.id), status=app_rec.status) if app_rec else None,
    )


@router.post("/opportunities/{opp_id}/save", response_model=SaveOpportunityResponse)
def save_opportunity(
    opp_id: str,
    req: Optional[SaveOpportunityRequest] = None,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        opp_uuid = uuid.UUID(opp_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    opp = db.get(Opportunity, opp_uuid)
    if not opp:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    existing = db.query(SavedOpportunity).filter(
        SavedOpportunity.user_id == current_user.id,
        SavedOpportunity.opportunity_id == opp_uuid,
    ).first()

    now = datetime.now(timezone.utc)
    if existing:
        if req and req.note is not None:
            existing.note = req.note
            db.commit()
        return SaveOpportunityResponse(saved=True, saved_at=existing.created_at, opportunity_id=str(opp.id))

    new_saved = SavedOpportunity(
        user_id=current_user.id,
        opportunity_id=opp_uuid,
        note=req.note if req else None,
        created_at=now,
    )
    db.add(new_saved)
    db.commit()
    return SaveOpportunityResponse(saved=True, saved_at=now, opportunity_id=str(opp.id))


@router.delete("/opportunities/{opp_id}/save", status_code=status.HTTP_204_NO_CONTENT)
def unsave_opportunity(
    opp_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        opp_uuid = uuid.UUID(opp_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    existing = db.query(SavedOpportunity).filter(
        SavedOpportunity.user_id == current_user.id,
        SavedOpportunity.opportunity_id == opp_uuid,
    ).first()

    if existing:
        db.delete(existing)
        db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)

