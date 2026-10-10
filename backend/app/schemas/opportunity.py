from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TopSkillItem(BaseModel):
    name: str
    has: bool
    requirement: str = "required"


class OpportunityListItem(BaseModel):
    id: str
    title: str
    company_name: Optional[str] = None
    location: Optional[str] = None
    is_remote: bool = False
    opportunity_type: str = "unknown"
    source_engine: str
    source_via: Optional[str] = None
    posted_at_text: Optional[str] = None
    salary_text: Optional[str] = None
    match_score: Optional[int] = None
    low_confidence: bool = False
    top_skills: List[TopSkillItem] = Field(default_factory=list)
    saved: bool = False
    application_status: Optional[str] = None
    application_id: Optional[str] = None
    is_demo: bool = False


class OpportunityListResponse(BaseModel):
    session_id: Optional[str] = None
    items: List[OpportunityListItem]
    page: int = 1
    page_size: int = 20
    total: int = 0


class BreakdownComponent(BaseModel):
    key: str
    weight: float
    score: float
    points: float


class MatchBreakdown(BaseModel):
    weights_version: str = "v1"
    components: List[BreakdownComponent]


class SkillRequirementItem(BaseModel):
    id: str
    name: str
    requirement: str = "required"


class MatchDetail(BaseModel):
    match_score: Optional[int] = None
    low_confidence: bool = False
    breakdown: Optional[MatchBreakdown] = None
    matched_skills: List[SkillRequirementItem] = Field(default_factory=list)
    missing_skills: List[SkillRequirementItem] = Field(default_factory=list)


class OpportunityDetailData(BaseModel):
    id: str
    title: str
    company_name: Optional[str] = None
    location: Optional[str] = None
    is_remote: bool = False
    opportunity_type: str
    schedule_type: Optional[str] = None
    source_engine: str
    source_via: Optional[str] = None
    apply_url: Optional[str] = None
    posted_at_text: Optional[str] = None
    salary_text: Optional[str] = None
    description: Optional[str] = None
    highlights: Optional[Any] = None
    first_seen_at: Optional[datetime] = None
    is_demo: bool = False


class SimpleApplicationDetail(BaseModel):
    id: str
    status: str


class OpportunityDetailResponse(BaseModel):
    opportunity: OpportunityDetailData
    match: Optional[MatchDetail] = None
    saved: bool = False
    application: Optional[SimpleApplicationDetail] = None


class SaveOpportunityRequest(BaseModel):
    note: Optional[str] = Field(None, max_length=500)


class SaveOpportunityResponse(BaseModel):
    saved: bool = True
    saved_at: datetime
    opportunity_id: str
