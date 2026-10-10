from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, ConfigDict, field_validator
from app.schemas.auth import UserResponse

VALID_OPPORTUNITY_TYPES = {
    "internship",
    "full_time",
    "part_time",
    "contract",
    "hackathon",
    "grant",
    "fellowship",
    "program",
    "open_source",
    "career_page",
}


class ProfileData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    education_level: Optional[str] = Field(None, pattern="^(high_school|diploma|bachelors|masters|phd|other)$")
    degree: Optional[str] = None
    field_of_study: Optional[str] = None
    graduation_year: Optional[int] = Field(None, ge=1990, le=2040)
    institution: Optional[str] = None
    experience_level: str = Field("student", pattern="^(student|fresher|0_1_years|1_2_years)$")
    location_city: Optional[str] = None
    location_state: Optional[str] = None
    location_country: str = "IN"
    open_to_remote: bool = True
    weekly_learning_hours: int = Field(10, ge=1, le=60)
    updated_at: Optional[datetime] = None


class SkillClaimItem(BaseModel):
    skill_id: Optional[str] = None
    name: Optional[str] = None
    proficiency: int = Field(2, ge=1, le=5)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            v = v.strip()
            return v if v else None
        return None


class SkillItemResponse(BaseModel):
    skill_id: str
    name: str
    proficiency: int


class CareerGoalData(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: Optional[str] = None
    target_role: str = Field(..., min_length=2, max_length=120)
    goal_statement: Optional[str] = Field(None, max_length=280)
    timeline_months: int = Field(3, ge=1, le=36)
    opportunity_types: List[str] = Field(default_factory=lambda: ["internship"])

    @field_validator("opportunity_types")
    @classmethod
    def validate_opportunity_types(cls, v: List[str]) -> List[str]:
        if not v:
            raise ValueError("Opportunity types cannot be empty")
        normalized = []
        for t in v:
            val = "full_time" if t == "job" else t
            if val not in VALID_OPPORTUNITY_TYPES:
                raise ValueError(
                    f"Invalid opportunity type '{t}'. Must be one of {sorted(VALID_OPPORTUNITY_TYPES)}"
                )
            if val not in normalized:
                normalized.append(val)
        return normalized


class ProfileResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    user: UserResponse
    profile: Optional[ProfileData] = None
    skills: List[SkillItemResponse] = Field(default_factory=list)
    career_goal: Optional[CareerGoalData] = None
    profile_complete: bool = False


class ProfileUpdateRequest(BaseModel):
    profile: ProfileData
    skills: List[SkillClaimItem] = Field(..., min_length=1, max_length=40)
    career_goal: CareerGoalData
