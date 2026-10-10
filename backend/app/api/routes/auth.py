from datetime import datetime, timezone
from fastapi import APIRouter, Depends, Request, status
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User, UserProfile
from app.models.skill import UserSkill
from app.models.career_goal import CareerGoal
from app.schemas.auth import UserRegisterRequest, UserLoginRequest, AuthResponse, UserResponse
from app.core.security import get_password_hash, verify_password, create_access_token
from app.core.errors import AppError
from app.core.ratelimit import limiter
from app.config import settings

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
@limiter.limit("5/minute")
def register(request: Request, req: UserRegisterRequest, db: Session = Depends(get_db)):
    email_clean = req.email.lower().strip()
    existing = db.query(User).filter(User.email == email_clean).first()
    if existing:
        raise AppError("CONFLICT", "An account with this email already exists", 409)

    hashed_pw = get_password_hash(req.password)
    new_user = User(
        email=email_clean,
        full_name=req.full_name.strip(),
        password_hash=hashed_pw,
        is_active=True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    token = create_access_token(new_user.id, new_user.email)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=str(new_user.id),
            full_name=new_user.full_name,
            email=new_user.email,
        ),
        profile_complete=False,
    )


@router.post("/login", response_model=AuthResponse)
@limiter.limit("10/minute")
def login(request: Request, req: UserLoginRequest, db: Session = Depends(get_db)):
    email_clean = req.email.lower().strip()
    user = db.query(User).filter(User.email == email_clean).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise AppError("UNAUTHORIZED", "Email or password is incorrect", 401)

    if not user.is_active:
        raise AppError("UNAUTHORIZED", "Email or password is incorrect", 401)

    user.last_login_at = datetime.now(timezone.utc)
    db.commit()

    # Determine if profile is complete (profile + at least 1 skill + active goal)
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    skills_count = db.query(UserSkill).filter(UserSkill.user_id == user.id).count()
    active_goal = (
        db.query(CareerGoal)
        .filter(CareerGoal.user_id == user.id, CareerGoal.is_active == True)
        .first()
    )
    profile_complete = bool(
        profile
        and (profile.location_city or profile.open_to_remote)
        and skills_count > 0
        and active_goal
        and active_goal.target_role
    )

    token = create_access_token(user.id, user.email)
    return AuthResponse(
        access_token=token,
        token_type="bearer",
        expires_in=settings.JWT_EXPIRE_MINUTES * 60,
        user=UserResponse(
            id=str(user.id),
            full_name=user.full_name,
            email=user.email,
        ),
        profile_complete=profile_complete,
    )
