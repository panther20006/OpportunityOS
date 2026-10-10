import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.models.roadmap import Roadmap, RoadmapStep
from app.models.agent import AgentSession
from app.schemas.roadmap import (
    RoadmapResponse,
    RoadmapStepItem,
    RoadmapStepSkill,
    RoadmapStepOpportunity,
    RoadmapStepUpdate,
    RoadmapStepUpdateResponse,
)
from app.api.deps import get_current_user
from app.core.errors import AppError

router = APIRouter(tags=["Roadmap"])


@router.get("/roadmap", response_model=RoadmapResponse)
def get_roadmap(
    session_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Roadmap).filter(Roadmap.user_id == current_user.id)
    if session_id:
        try:
            sess_uuid = uuid.UUID(session_id)
            sess = db.query(AgentSession).filter(AgentSession.id == sess_uuid).first()
            if not sess:
                raise AppError("NOT_FOUND", "Session not found", 404)
            if sess.user_id != current_user.id:
                raise AppError("FORBIDDEN", "You do not have access to this session", 403)
            query = query.filter(Roadmap.agent_session_id == sess_uuid)
        except ValueError:
            raise AppError("NOT_FOUND", "Session not found", 404)
    else:
        query = query.filter(Roadmap.is_active == True)

    roadmap = query.order_by(Roadmap.created_at.desc()).first()
    if not roadmap:
        raise AppError("NO_SESSION", "No roadmap found. Run career search first.", 404)

    steps = (
        db.query(RoadmapStep)
        .filter(RoadmapStep.roadmap_id == roadmap.id)
        .order_by(RoadmapStep.step_order.asc())
        .all()
    )

    total_steps = len(steps)
    completed_steps = sum(1 for s in steps if s.is_completed)
    progress_pct = int((completed_steps / total_steps * 100)) if total_steps > 0 else 0

    step_items = [
        RoadmapStepItem(
            id=str(s.id),
            step_order=s.step_order,
            step_type=s.step_type,
            title=s.title,
            description=s.description,
            reason=s.reason,
            estimated_hours=s.estimated_hours,
            action=s.action,
            resource_query=s.resource_query,
            resources=s.resources or [],
            is_completed=s.is_completed,
            completed_at=s.completed_at,
            skill=RoadmapStepSkill(id=str(s.skill.id), name=s.skill.name) if s.skill else None,
            opportunity=RoadmapStepOpportunity(id=str(s.opportunity.id), title=s.opportunity.title) if s.opportunity else None,
        )
        for s in steps
    ]

    return RoadmapResponse(
        id=str(roadmap.id),
        session_id=str(roadmap.agent_session_id),
        title=roadmap.title,
        summary=roadmap.summary,
        total_weeks=roadmap.total_weeks,
        generation_method=roadmap.generation_method,
        progress_pct=progress_pct,
        steps=step_items,
    )


@router.patch("/roadmap/steps/{step_id}", response_model=RoadmapStepUpdateResponse)
def update_roadmap_step(
    step_id: str,
    req: RoadmapStepUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        step_uuid = uuid.UUID(step_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Roadmap step not found", 404)

    step = db.get(RoadmapStep, step_uuid)
    if not step:
        raise AppError("NOT_FOUND", "Roadmap step not found", 404)

    # Verify ownership through roadmap
    roadmap = db.get(Roadmap, step.roadmap_id)
    if not roadmap or roadmap.user_id != current_user.id:
        raise AppError("FORBIDDEN", "You do not own this roadmap step", 403)

    now = datetime.now(timezone.utc)
    step.is_completed = req.is_completed
    step.completed_at = now if req.is_completed else None
    db.commit()

    # Recalculate progress
    all_steps = db.query(RoadmapStep).filter(RoadmapStep.roadmap_id == roadmap.id).all()
    total = len(all_steps)
    done = sum(1 for s in all_steps if s.is_completed)
    progress_pct = int((done / total * 100)) if total > 0 else 0

    return RoadmapStepUpdateResponse(
        id=str(step.id),
        is_completed=step.is_completed,
        completed_at=step.completed_at,
        roadmap_progress_pct=progress_pct,
    )
