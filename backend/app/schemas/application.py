from typing import List, Optional, Dict, Any
from datetime import date, datetime
from pydantic import BaseModel, Field


class ApplicationOpportunity(BaseModel):
    id: str
    title: str
    company_name: Optional[str] = None
    match_score: Optional[int] = None


class ApplicationItem(BaseModel):
    id: str
    status: str
    applied_on: Optional[date] = None
    notes: Optional[str] = None
    opportunity: Optional[ApplicationOpportunity] = None
    updated_at: datetime


class ApplicationListResponse(BaseModel):
    items: List[ApplicationItem]
    page: int = 1
    page_size: int = 20
    total: int = 0


class ApplicationCreateRequest(BaseModel):
    opportunity_id: str
    status: str = Field("planned", pattern="^(planned|applied|interviewing|offer|rejected|withdrawn)$")
    applied_on: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)


class ApplicationUpdateRequest(BaseModel):
    status: Optional[str] = Field(None, pattern="^(planned|applied|interviewing|offer|rejected|withdrawn)$")
    applied_on: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=2000)


class ApplicationResponse(BaseModel):
    id: str
    opportunity_id: str
    status: str
    applied_on: Optional[date] = None
    notes: Optional[str] = None
    status_history: List[Dict[str, Any]] = []
    created_at: datetime
    updated_at: Optional[datetime] = None
