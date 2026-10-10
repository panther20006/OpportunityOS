from typing import List, Optional, Any, Dict
from datetime import datetime
from pydantic import BaseModel


class RoadmapStepSkill(BaseModel):
    id: str
    name: str


class RoadmapStepOpportunity(BaseModel):
    id: str
    title: str


class RoadmapStepItem(BaseModel):
    id: str
    step_order: int
    step_type: str  # learn, build, apply
    title: str
    description: Optional[str] = None
    reason: Optional[str] = None
    estimated_hours: Optional[int] = None
    action: Optional[str] = None
    resource_query: Optional[str] = None
    resources: List[Dict[str, Any]] = []
    is_completed: bool = False
    completed_at: Optional[datetime] = None
    skill: Optional[RoadmapStepSkill] = None
    opportunity: Optional[RoadmapStepOpportunity] = None


class RoadmapResponse(BaseModel):
    id: str
    session_id: str
    title: str
    summary: Optional[str] = None
    total_weeks: Optional[int] = None
    generation_method: str = "llm"
    progress_pct: int = 0
    steps: List[RoadmapStepItem] = []


class RoadmapStepUpdate(BaseModel):
    is_completed: bool


class RoadmapStepUpdateResponse(BaseModel):
    id: str
    is_completed: bool
    completed_at: Optional[datetime] = None
    roadmap_progress_pct: int
