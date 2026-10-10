from typing import List, Optional
from pydantic import BaseModel


class SkillGapSkill(BaseModel):
    id: str
    name: str


class SkillGapItem(BaseModel):
    rank: int
    skill: SkillGapSkill
    priority: str  # high, medium, low
    demand_count: int
    demand_pct: float
    avg_uplift: float
    priority_score: float
    opportunity_ids: List[str]


class SkillGapResponse(BaseModel):
    session_id: str
    top_n: int = 15
    items: List[SkillGapItem]
