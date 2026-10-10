import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    SmallInteger,
    Text,
    JSON,
    ForeignKey,
    UniqueConstraint,
    CheckConstraint,
)
from sqlalchemy.orm import relationship
from app.db import Base, GUID, JSONList


def utcnow():
    return datetime.now(timezone.utc)


class Opportunity(Base):
    __tablename__ = "opportunities"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    dedupe_hash = Column(String(64), unique=True, nullable=False, index=True)
    source_engine = Column(String(20), nullable=False)
    external_id = Column(Text, nullable=True)
    title = Column(String(300), nullable=False, index=True)
    company_name = Column(String(200), nullable=True, index=True)
    location = Column(String(200), nullable=True)
    is_remote = Column(Boolean, default=False, nullable=False, index=True)
    opportunity_type = Column(String(20), default="unknown", nullable=False, index=True)
    schedule_type = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    highlights = Column(JSON, nullable=True)
    source_via = Column(String(200), nullable=True)
    apply_url = Column(Text, nullable=True)
    posted_at_text = Column(String(50), nullable=True)
    first_seen_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    last_seen_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)
    raw = Column(JSON, nullable=True)
    is_demo = Column(Boolean, default=False, nullable=False, index=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    skills = relationship("OpportunitySkill", back_populates="opportunity", cascade="all, delete-orphan")
    matches = relationship("OpportunityMatch", back_populates="opportunity", cascade="all, delete-orphan")
    saved_by = relationship("SavedOpportunity", back_populates="opportunity", cascade="all, delete-orphan")
    applications = relationship("Application", back_populates="opportunity", cascade="all, delete-orphan")
    roadmap_steps = relationship("RoadmapStep", back_populates="opportunity")

    __table_args__ = (
        CheckConstraint("source_engine IN ('google_jobs','google')", name="chk_opp_source_engine"),
        CheckConstraint(
            "opportunity_type IN ('internship','full_time','part_time','contract','career_page','program','hackathon','grant','fellowship','unknown')",
            name="chk_opp_opportunity_type",
        ),
    )


class OpportunityMatch(Base):
    __tablename__ = "opportunity_matches"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(GUID, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    agent_session_id = Column(GUID, ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    match_score = Column(SmallInteger, nullable=False, index=True)
    breakdown = Column(JSON, nullable=False)
    matched_skill_ids = Column(JSONList, default=list, nullable=False)
    missing_skill_ids = Column(JSONList, default=list, nullable=False)
    low_confidence = Column(Boolean, default=False, nullable=False)
    rank = Column(SmallInteger, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="matches")
    opportunity = relationship("Opportunity", back_populates="matches")
    agent_session = relationship("AgentSession", back_populates="matches")

    __table_args__ = (
        UniqueConstraint("agent_session_id", "opportunity_id", name="uq_session_opportunity_match"),
        CheckConstraint("match_score BETWEEN 0 AND 100", name="chk_match_score"),
    )


class SavedOpportunity(Base):
    __tablename__ = "saved_opportunities"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    user_id = Column(GUID, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    opportunity_id = Column(GUID, ForeignKey("opportunities.id", ondelete="CASCADE"), nullable=False, index=True)
    note = Column(String(500), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utcnow, nullable=False)

    user = relationship("User", back_populates="saved_opportunities")
    opportunity = relationship("Opportunity", back_populates="saved_by")

    __table_args__ = (
        UniqueConstraint("user_id", "opportunity_id", name="uq_saved_opportunity_user"),
    )
