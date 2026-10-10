import uuid
from datetime import datetime, timezone
from typing import Optional, List
from fastapi import APIRouter, Depends, Query, status, Response
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User
from app.models.application import Application
from app.models.opportunity import Opportunity, OpportunityMatch
from app.schemas.application import (
    ApplicationListResponse,
    ApplicationItem,
    ApplicationOpportunity,
    ApplicationCreateRequest,
    ApplicationUpdateRequest,
    ApplicationResponse,
)
from app.api.deps import get_current_user
from app.core.errors import AppError

router = APIRouter(prefix="/applications", tags=["Application Tracker"])


@router.get("", response_model=ApplicationListResponse)
def list_applications(
    status_filter: Optional[str] = Query(None, alias="status"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(Application).filter(Application.user_id == current_user.id)
    if status_filter:
        query = query.filter(Application.status == status_filter)

    total = query.count()
    offset = (page - 1) * page_size
    records = query.order_by(Application.updated_at.desc()).offset(offset).limit(page_size).all()

    items: List[ApplicationItem] = []
    for app in records:
        opp = app.opportunity
        match_score = None
        if opp:
            m = (
                db.query(OpportunityMatch)
                .filter(
                    OpportunityMatch.user_id == current_user.id,
                    OpportunityMatch.opportunity_id == opp.id,
                )
                .order_by(OpportunityMatch.created_at.desc())
                .first()
            )
            match_score = m.match_score if m else None

        items.append(
            ApplicationItem(
                id=str(app.id),
                status=app.status,
                applied_on=app.applied_on,
                notes=app.notes,
                opportunity=ApplicationOpportunity(
                    id=str(opp.id),
                    title=opp.title,
                    company_name=opp.company_name,
                    match_score=match_score,
                ) if opp else None,
                updated_at=app.updated_at,
            )
        )

    return ApplicationListResponse(
        items=items,
        page=page,
        page_size=page_size,
        total=total,
    )


@router.get("/counts")
def get_application_counts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from sqlalchemy import func
    records = (
        db.query(Application.status, func.count(Application.id))
        .filter(Application.user_id == current_user.id)
        .group_by(Application.status)
        .all()
    )
    counts = {
        "total": 0,
        "planned": 0,
        "applied": 0,
        "interviewing": 0,
        "offer": 0,
        "rejected": 0,
        "withdrawn": 0,
    }
    for st, count in records:
        counts[st] = count
        counts["total"] += count
    return counts


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(
    req: ApplicationCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        opp_uuid = uuid.UUID(req.opportunity_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    opp = db.get(Opportunity, opp_uuid)
    if not opp:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    existing = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.opportunity_id == opp_uuid,
    ).first()
    if existing:
        now = datetime.now(timezone.utc)
        if req.status and req.status != existing.status:
            history = list(existing.status_history or [])
            history.append({"status": req.status, "at": now.isoformat()})
            existing.status_history = history
            existing.status = req.status
        if "notes" in req.model_fields_set:
            existing.notes = req.notes
        if "applied_on" in req.model_fields_set:
            existing.applied_on = req.applied_on
        existing.updated_at = now
        db.commit()
        db.refresh(existing)
        return ApplicationResponse(
            id=str(existing.id),
            opportunity_id=str(existing.opportunity_id),
            status=existing.status,
            applied_on=existing.applied_on,
            notes=existing.notes,
            status_history=existing.status_history or [],
            created_at=existing.created_at,
            updated_at=existing.updated_at,
        )

    now = datetime.now(timezone.utc)
    new_app = Application(
        user_id=current_user.id,
        opportunity_id=opp_uuid,
        status=req.status,
        applied_on=req.applied_on,
        notes=req.notes,
        status_history=[{"status": req.status, "at": now.isoformat()}],
        created_at=now,
        updated_at=now,
    )
    db.add(new_app)
    db.commit()
    db.refresh(new_app)

    return ApplicationResponse(
        id=str(new_app.id),
        opportunity_id=str(new_app.opportunity_id),
        status=new_app.status,
        applied_on=new_app.applied_on,
        notes=new_app.notes,
        status_history=new_app.status_history or [],
        created_at=new_app.created_at,
        updated_at=new_app.updated_at,
    )


@router.put("/{app_id}", response_model=ApplicationResponse)
def update_application(
    app_id: str,
    req: ApplicationUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        app_uuid = uuid.UUID(app_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Application not found", 404)

    app = db.get(Application, app_uuid)
    if not app:
        raise AppError("NOT_FOUND", "Application not found", 404)

    if app.user_id != current_user.id:
        raise AppError("FORBIDDEN", "You do not have access to this application", 403)

    now = datetime.now(timezone.utc)
    if "status" in req.model_fields_set and req.status:
        if req.status != app.status:
            history = list(app.status_history or [])
            history.append({"status": req.status, "at": now.isoformat()})
            app.status_history = history
            app.status = req.status

    if "applied_on" in req.model_fields_set:
        app.applied_on = req.applied_on

    if "notes" in req.model_fields_set:
        app.notes = req.notes

    app.updated_at = now
    db.commit()
    db.refresh(app)

    return ApplicationResponse(
        id=str(app.id),
        opportunity_id=str(app.opportunity_id),
        status=app.status,
        applied_on=app.applied_on,
        notes=app.notes,
        status_history=app.status_history or [],
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


@router.delete("/opportunity/{opp_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application_by_opportunity(
    opp_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        opp_uuid = uuid.UUID(opp_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Opportunity not found", 404)

    app = db.query(Application).filter(
        Application.user_id == current_user.id,
        Application.opportunity_id == opp_uuid,
    ).first()
    if not app:
        raise AppError("NOT_FOUND", "Application not found", 404)

    db.delete(app)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/{app_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_application(
    app_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        app_uuid = uuid.UUID(app_id)
    except ValueError:
        raise AppError("NOT_FOUND", "Application not found", 404)

    app = db.get(Application, app_uuid)
    if not app:
        raise AppError("NOT_FOUND", "Application not found", 404)

    if app.user_id != current_user.id:
        raise AppError("FORBIDDEN", "You do not have access to this application", 403)

    db.delete(app)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)

