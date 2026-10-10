import uuid
from fastapi import APIRouter, Depends, BackgroundTasks, Request, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User, UserProfile
from app.models.skill import UserSkill
from app.models.career_goal import CareerGoal
from app.models.agent import AgentSession
from app.schemas.agent import (
    AgentSearchRequest,
    AgentSearchResponse,
    AgentSessionResponse,
)
from app.api.deps import get_current_user
from app.core.errors import AppError
from app.core.ratelimit import limiter
from app.agent.orchestrator import run_agent

router = APIRouter(prefix="/agent", tags=["AI Career Agent"])


@router.post("/search", response_model=AgentSearchResponse, status_code=status.HTTP_202_ACCEPTED)
@limiter.limit("10/minute")
def start_agent_search(
    request: Request,
    req: AgentSearchRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Check for active concurrent search for this user to avoid redundant runs,
    # recovering abandoned or timed-out sessions automatically
    active_session = (
        db.query(AgentSession)
        .filter(
            AgentSession.user_id == current_user.id,
            AgentSession.status.in_(["queued", "running"]),
        )
        .order_by(AgentSession.created_at.desc())
        .first()
    )
    if active_session:
        timeout_threshold = getattr(settings, "AGENT_TIMEOUT_SECONDS", 60) + 10
        sess_created = active_session.created_at
        if sess_created.tzinfo is None:
            sess_created = sess_created.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - sess_created).total_seconds()
        if elapsed > timeout_threshold:
            active_session.status = "failed"
            active_session.error_code = "SESSION_TIMEOUT"
            active_session.completed_at = datetime.now(timezone.utc)
            db.commit()
        else:
            return AgentSearchResponse(
                session_id=str(active_session.id),
                status=active_session.status,
                poll_url=f"/agent/sessions/{active_session.id}",
                poll_interval_ms=1500,
            )

    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    goal = db.query(CareerGoal).filter(CareerGoal.user_id == current_user.id, CareerGoal.is_active == True).first()
    skills_count = db.query(UserSkill).filter(UserSkill.user_id == current_user.id).count()

    if not goal or not goal.target_role or skills_count == 0:
        raise AppError(
            "PROFILE_INCOMPLETE",
            "Please complete your profile, target role, and skills before running the career agent.",
            400,
        )

    # Determine remote preference from override or profile
    remote_pref = True
    if req.overrides and req.overrides.open_to_remote is not None:
        remote_pref = bool(req.overrides.open_to_remote)
    elif profile and profile.open_to_remote is not None:
        remote_pref = bool(profile.open_to_remote)

    # Prepare input snapshot
    snapshot = {
        "target_role": goal.target_role,
        "experience_level": profile.experience_level if profile else "student",
        "location_city": profile.location_city if profile else None,
        "location_state": profile.location_state if profile else None,
        "open_to_remote": remote_pref,
        "opportunity_types": goal.opportunity_types,
    }
    if req.overrides:
        if req.overrides.location_city:
            snapshot["location_city"] = req.overrides.location_city
        if req.overrides.opportunity_types:
            snapshot["opportunity_types"] = req.overrides.opportunity_types

    initial_stages = [
        {"key": "plan_queries", "status": "pending"},
        {"key": "search", "status": "pending"},
        {"key": "normalize_dedupe", "status": "pending"},
        {"key": "extract_skills", "status": "pending"},
        {"key": "match", "status": "pending"},
        {"key": "skill_gap", "status": "pending"},
        {"key": "roadmap", "status": "pending"},
    ]

    new_session = AgentSession(
        user_id=current_user.id,
        career_goal_id=goal.id if goal else None,
        status="queued",
        input_snapshot=snapshot,
        stages=initial_stages,
        warnings=[],
    )
    db.add(new_session)
    db.commit()
    db.refresh(new_session)

    overrides_dict = req.overrides.model_dump() if req.overrides else None
    background_tasks.add_task(
        run_agent,
        session_id=str(new_session.id),
        user_id=str(current_user.id),
        overrides=overrides_dict,
        include_news=req.include_news,
    )

    return AgentSearchResponse(
        session_id=str(new_session.id),
        status="queued",
        poll_url=f"/agent/sessions/{new_session.id}",
        poll_interval_ms=1500,
    )


@router.get("/sessions/{session_id}", response_model=AgentSessionResponse)
def get_agent_session(
    session_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        session_uuid = uuid.UUID(session_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Agent session not found", 404)

    session = db.get(AgentSession, session_uuid)
    if not session:
        raise AppError("NOT_FOUND", "Agent session not found", 404)

    if session.user_id != current_user.id:
        raise AppError("FORBIDDEN", "You do not have access to this session", 403)

    # Recover abandoned / timed-out session during polling
    if session.status in ["queued", "running"]:
        timeout_threshold = getattr(settings, "AGENT_TIMEOUT_SECONDS", 60) + 10
        sess_created = session.created_at
        if sess_created.tzinfo is None:
            sess_created = sess_created.replace(tzinfo=timezone.utc)
        elapsed = (datetime.now(timezone.utc) - sess_created).total_seconds()
        if elapsed > timeout_threshold:
            session.status = "failed"
            session.error_code = "SESSION_TIMEOUT"
            session.completed_at = datetime.now(timezone.utc)
            db.commit()

    return AgentSessionResponse(
        id=str(session.id),
        status=session.status,
        created_at=session.created_at,
        stages=session.stages or [],
        warnings=session.warnings or [],
        result_summary=session.result_summary,
    )
