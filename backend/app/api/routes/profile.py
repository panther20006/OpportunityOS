import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db import get_db
from app.models.user import User, UserProfile
from app.models.skill import Skill, UserSkill
from app.models.career_goal import CareerGoal
from app.schemas.profile import (
    ProfileResponse,
    ProfileUpdateRequest,
    ProfileData,
    SkillItemResponse,
    CareerGoalData,
)
from app.schemas.auth import UserResponse
from app.api.deps import get_current_user

router = APIRouter(tags=["Profile"])


def get_profile_response(user: User, db: Session) -> ProfileResponse:
    profile = db.query(UserProfile).filter(UserProfile.user_id == user.id).first()
    user_skills = db.query(UserSkill).filter(UserSkill.user_id == user.id).all()
    active_goal = (
        db.query(CareerGoal)
        .filter(CareerGoal.user_id == user.id, CareerGoal.is_active == True)
        .first()
    )

    skill_items = []
    for us in user_skills:
        skill_items.append(
            SkillItemResponse(
                skill_id=str(us.skill_id),
                name=us.skill.name if us.skill else "Unknown",
                proficiency=us.proficiency,
            )
        )

    profile_complete = (
        profile is not None
        and (bool(profile.location_city) or profile.open_to_remote)
        and len(skill_items) > 0
        and active_goal is not None
        and bool(active_goal.target_role)
    )

    return ProfileResponse(
        user=UserResponse(id=str(user.id), full_name=user.full_name, email=user.email),
        profile=ProfileData.model_validate(profile) if profile else None,
        skills=skill_items,
        career_goal=CareerGoalData.model_validate(active_goal) if active_goal else None,
        profile_complete=profile_complete,
    )


@router.get("/profile", response_model=ProfileResponse)
def get_profile(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Retrieve the current user's profile, skills, and active career goal."""
    return get_profile_response(current_user, db)


@router.put("/profile", response_model=ProfileResponse)
def update_profile(
    req: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create or replace profile, skills, and active career goal in one transaction (idempotent)."""
    now = datetime.now(timezone.utc)

    # 1. Update or create UserProfile
    profile = db.query(UserProfile).filter(UserProfile.user_id == current_user.id).first()
    if not profile:
        profile = UserProfile(user_id=current_user.id)
        db.add(profile)

    profile.education_level = req.profile.education_level
    profile.degree = req.profile.degree
    profile.field_of_study = req.profile.field_of_study
    profile.graduation_year = req.profile.graduation_year
    profile.institution = req.profile.institution
    profile.experience_level = req.profile.experience_level
    profile.location_city = req.profile.location_city
    profile.location_state = req.profile.location_state
    profile.location_country = req.profile.location_country
    profile.open_to_remote = req.profile.open_to_remote
    profile.weekly_learning_hours = req.profile.weekly_learning_hours
    profile.updated_at = now

    # 2. Update Career Goal
    current_goal = (
        db.query(CareerGoal)
        .filter(CareerGoal.user_id == current_user.id, CareerGoal.is_active == True)
        .first()
    )
    req_types = [t for t in req.career_goal.opportunity_types if t] or ["internship"]

    if not current_goal:
        new_goal = CareerGoal(
            user_id=current_user.id,
            target_role=req.career_goal.target_role,
            goal_statement=req.career_goal.goal_statement,
            timeline_months=req.career_goal.timeline_months,
            opportunity_types=req_types,
            is_active=True,
        )
        db.add(new_goal)
    else:
        if current_goal.target_role != req.career_goal.target_role:
            current_goal.is_active = False
            new_goal = CareerGoal(
                user_id=current_user.id,
                target_role=req.career_goal.target_role,
                goal_statement=req.career_goal.goal_statement,
                timeline_months=req.career_goal.timeline_months,
                opportunity_types=req_types,
                is_active=True,
            )
            db.add(new_goal)
        else:
            current_goal.goal_statement = req.career_goal.goal_statement
            current_goal.timeline_months = req.career_goal.timeline_months
            current_goal.opportunity_types = req_types
            current_goal.updated_at = now

    # 3. Update User Skills (Clear existing and replace)
    db.query(UserSkill).filter(UserSkill.user_id == current_user.id).delete()

    seen_skill_ids = set()
    for item in req.skills:
        skill_obj = None
        if item.skill_id:
            try:
                sid = uuid.UUID(item.skill_id)
                skill_obj = db.get(Skill, sid)
            except ValueError:
                pass

        if not skill_obj and item.name:
            clean_name = item.name.strip()
            # Lookup canonical skill by name
            skill_obj = db.query(Skill).filter(Skill.name.ilike(clean_name)).first()
            if not skill_obj:
                # Create unverified custom skill
                slug = clean_name.lower().replace(" ", "-")
                skill_obj = Skill(
                    name=clean_name,
                    slug=slug,
                    category="custom",
                    aliases=[],
                    is_verified=False,
                )
                db.add(skill_obj)
                db.flush()

        if skill_obj and skill_obj.id not in seen_skill_ids:
            seen_skill_ids.add(skill_obj.id)
            user_skill = UserSkill(
                user_id=current_user.id,
                skill_id=skill_obj.id,
                proficiency=item.proficiency,
            )
            db.add(user_skill)

    db.commit()
    return get_profile_response(current_user, db)
