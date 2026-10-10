from typing import List, Optional, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class AgentSearchOverrides(BaseModel):
    location_city: Optional[str] = None
    open_to_remote: Optional[bool] = None
    opportunity_types: Optional[List[str]] = None


class AgentSearchRequest(BaseModel):
    overrides: Optional[AgentSearchOverrides] = None
    include_news: bool = True


class AgentSearchResponse(BaseModel):
    session_id: str
    status: str = "queued"
    poll_url: str
    poll_interval_ms: int = 1500


class StageItem(BaseModel):
    key: str
    status: str = "pending"  # pending, running, done, warn, failed
    started_at: Optional[str] = None
    duration_ms: Optional[int] = None
    detail: Optional[Dict[str, Any]] = None


class WarningItem(BaseModel):
    code: str
    message: str
    engine: Optional[str] = None


class AgentSessionResponse(BaseModel):
    id: str
    status: str
    created_at: datetime
    stages: List[Dict[str, Any]] = Field(default_factory=list)
    warnings: List[Dict[str, Any]] = Field(default_factory=list)
    result_summary: Optional[Dict[str, Any]] = None
