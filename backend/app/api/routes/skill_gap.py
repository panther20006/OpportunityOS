import uuid
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.models.roadmap import SkillGap
from app.models.agent import AgentSession
from app.schemas.skill_gap import SkillGapResponse, SkillGapItem, SkillGapSkill
from app.api.deps import get_current_user
from app.core.errors import AppError

router = APIRouter(tags=["Skill Gap"])


@router.get("/skill-gap", response_model=SkillGapResponse)
def get_skill_gaps(
    session_id: Optional[str] = Query(None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if session_id:
        try:
            target_uuid = uuid.UUID(session_id)
        except ValueError:
            raise AppError("NOT_FOUND", "Session not found", 404)

        # Enforce session ownership
        session = db.query(AgentSession).filter(AgentSession.id == target_uuid).first()
        if not session:
            raise AppError("NOT_FOUND", "Session not found", 404)
        if session.user_id != current_user.id:
            raise AppError("FORBIDDEN", "You do not have access to this session", 403)
    else:
        latest_sess = (
            db.query(AgentSession)
            .filter(
                AgentSession.user_id == current_user.id,
                AgentSession.status.in_(["completed", "partial"]),
            )
            .order_by(AgentSession.created_at.desc())
            .first()
        )
        if not latest_sess:
            raise AppError("NO_SESSION", "No completed agent session found. Run search first.", 404)
        target_uuid = latest_sess.id

    gaps = (
        db.query(SkillGap)
        .filter(
            SkillGap.agent_session_id == target_uuid,
            SkillGap.user_id == current_user.id,
        )
        .order_by(SkillGap.rank.asc())
        .all()
    )

    items = [
        SkillGapItem(
            rank=g.rank,
            skill=SkillGapSkill(
                id=str(g.skill.id) if g.skill else str(g.skill_id),
                name=g.skill.name if g.skill else "Skill",
            ),
            priority=g.priority,
            demand_count=g.demand_count,
            demand_pct=round(g.demand_pct, 4),
            avg_uplift=round(g.avg_uplift, 2),
            priority_score=round(g.priority_score, 4),
            opportunity_ids=[str(oid) for oid in g.opportunity_ids or []],
        )
        for g in gaps
    ]

    return SkillGapResponse(
        session_id=str(target_uuid),
        top_n=15,
        items=items,
    )

