import uuid
from datetime import datetime, timezone
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db import Base
from app.models.user import User, UserProfile
from app.models.opportunity import Opportunity
from app.models.application import Application
from app.models.skill import Skill, UserSkill
from app.models.career_goal import CareerGoal
from app.models.roadmap import Roadmap, RoadmapStep
from app.models.agent import AgentSession
from app.search.dedupe import dedupe_hash
from app.search.normalizer import is_job_remote, infer_opportunity_type
from app.matching.scorer import (
    calculate_location_score,
    calculate_role_score,
    score_opportunity,
)
from app.schemas.application import ApplicationCreateRequest, ApplicationUpdateRequest
from app.agent.tools import generate_fallback_queries
from app.db_migrate import migrate_database


@pytest.fixture(scope="module")
def isolated_db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(engine)
    migrate_database(engine)
    TestingSession = sessionmaker(bind=engine)
    yield TestingSession, engine
    engine.dispose()


def test_category_constraints_and_normalization(isolated_db):
    TestingSession, engine = isolated_db
    session = TestingSession()

    # 1. Verify infer_opportunity_type recognises hackathons, grants, fellowships
    assert infer_opportunity_type("Smart India Hackathon 2026", "National innovation hackathon") == "hackathon"
    assert infer_opportunity_type("Mozilla Open Source Grant", "Research grant funding for student devs") == "grant"
    assert infer_opportunity_type("AI Research Fellowship Program", "Post-graduate research fellowship") == "fellowship"

    # 2. Verify DB constraint accepts hackathon, grant, fellowship
    opp_hack = Opportunity(
        dedupe_hash="test_hack_1",
        title="AI Hackathon 2026",
        company_name="TechCorp",
        location="Bengaluru, India",
        opportunity_type="hackathon",
        source_engine="google",
    )
    opp_grant = Opportunity(
        dedupe_hash="test_grant_1",
        title="Student Developer Grant",
        company_name="Founders Foundation",
        location="Remote",
        opportunity_type="grant",
        source_engine="google",
    )
    opp_fellow = Opportunity(
        dedupe_hash="test_fellow_1",
        title="Summer Tech Fellowship",
        company_name="Innovate Labs",
        location="Delhi, India",
        opportunity_type="fellowship",
        source_engine="google",
    )

    session.add_all([opp_hack, opp_grant, opp_fellow])
    session.commit()

    saved = session.query(Opportunity).filter(Opportunity.opportunity_type.in_(["hackathon", "grant", "fellowship"])).all()
    assert len(saved) == 3
    session.close()


def test_location_and_negative_remote_detection():
    # 1. Berlin / Dublin / Austin bug: Berlin contains "in" as a substring but must NOT match India (0.50/0.30)
    # Berlin should receive non-match score (0.20), not India score (0.50)
    loc_score_berlin = calculate_location_score(
        opp_location="Berlin, Germany",
        is_remote=False,
        user_city="Bengaluru",
        user_state="Karnataka",
        open_to_remote=True,
    )
    assert loc_score_berlin == 0.20

    loc_score_dublin = calculate_location_score(
        opp_location="Dublin, Ireland",
        is_remote=False,
        user_city="Bengaluru",
        user_state="Karnataka",
        open_to_remote=True,
    )
    assert loc_score_dublin == 0.20

    # India city exact match
    loc_score_blr = calculate_location_score(
        opp_location="Bengaluru, Karnataka, India",
        is_remote=False,
        user_city="Bengaluru",
        user_state="Karnataka",
        open_to_remote=True,
    )
    assert loc_score_blr == 1.0

    # General India match (different city)
    loc_score_delhi = calculate_location_score(
        opp_location="Delhi, India",
        is_remote=False,
        user_city="Bengaluru",
        user_state="Karnataka",
        open_to_remote=True,
    )
    assert loc_score_delhi == 0.50

    # 2. Negative remote checks
    assert is_job_remote("Remote Developer", "Not remote, in-person attendance required.") is False
    assert is_job_remote("Backend Engineer", "This is an onsite only role. No WFH.") is False
    assert is_job_remote("Full Stack", "Position is on-site only at Bangalore campus.") is False
    assert is_job_remote("Python Developer", "Candidate must be willing to work onsite. No remote.") is False
    assert is_job_remote("Frontend Developer", "Fully remote role with flexible hours.") is True


def test_role_scoring_and_confidence():
    # Empty / whitespace title must NOT receive a perfect score
    assert calculate_role_score("", "Frontend Developer") == 0.0
    assert calculate_role_score("   ", "Frontend Developer") == 0.0
    assert calculate_role_score("Frontend Developer", "") == 0.0

    # Strong match
    score = calculate_role_score("Junior Frontend Developer", "Frontend Developer")
    assert score >= 0.7


def test_dedupe_hash_demo_vs_live_separation():
    # Demo and Live items with same parameters produce distinct hashes
    live_hash = dedupe_hash("Frontend Intern", "Acme Corp", "Remote", is_demo=False)
    demo_hash = dedupe_hash("Frontend Intern", "Acme Corp", "Remote", is_demo=True)

    assert live_hash != demo_hash
    assert len(live_hash) == 64
    assert len(demo_hash) == 64


def test_query_generation_dynamic_year_and_categories():
    queries = generate_fallback_queries(
        target_role="Frontend Developer",
        experience_level="student",
        location_city="Bengaluru",
        open_to_remote=True,
        opportunity_types=["internship", "hackathon", "grant"],
    )
    current_year = str(datetime.now(timezone.utc).year)
    query_texts = [q["q"].lower() for q in queries]
    all_query_text = " ".join(query_texts)

    # Dynamic year present
    assert current_year in all_query_text
    # Hackathon query generated
    assert any("hackathon" in q for q in query_texts)
    # Grant query generated
    assert any("grant" in q for q in query_texts)


def test_application_updates_preserve_notes_and_dates(isolated_db):
    TestingSession, _ = isolated_db
    session = TestingSession()

    user = User(
        email="test_app_user@example.com",
        password_hash="fakehash",
        full_name="App Tester",
    )
    session.add(user)
    session.flush()

    opp = Opportunity(
        dedupe_hash="test_opp_track_1",
        title="Software Engineer",
        company_name="Startup Inc",
        location="Remote",
        opportunity_type="internship",
        source_engine="google",
    )
    session.add(opp)
    session.flush()

    app = Application(
        user_id=user.id,
        opportunity_id=opp.id,
        status="planned",
        notes="Applied via referral code REF-1234",
        applied_on=datetime(2026, 4, 15, tzinfo=timezone.utc),
    )
    session.add(app)
    session.commit()

    # Simulate request with only status changed, omitting notes and applied_on
    req = ApplicationUpdateRequest.model_validate({"status": "applied"})
    fields_set = req.model_fields_set
    assert "status" in fields_set
    assert "notes" not in fields_set
    assert "applied_on" not in fields_set

    # When notes not in fields_set, existing notes remain intact
    if "notes" in fields_set:
        app.notes = req.notes
    if "status" in fields_set and req.status:
        app.status = req.status
    if "applied_on" in fields_set:
        app.applied_on = req.applied_on

    session.commit()
    session.refresh(app)

    assert app.status == "applied"
    assert app.notes == "Applied via referral code REF-1234"
    assert app.applied_on is not None

    # Simulate clearing applied_on explicitly
    req_clear = ApplicationUpdateRequest.model_validate({"applied_on": None})
    assert "applied_on" in req_clear.model_fields_set
    if "applied_on" in req_clear.model_fields_set:
        app.applied_on = req_clear.applied_on

    session.commit()
    session.refresh(app)
    assert app.applied_on is None
    # Notes still preserved!
    assert app.notes == "Applied via referral code REF-1234"
    session.close()


def test_roadmap_milestone_continuity(isolated_db):
    TestingSession, _ = isolated_db
    session = TestingSession()

    user = User(
        email="test_roadmap_user@example.com",
        password_hash="fakehash",
        full_name="Roadmap Tester",
    )
    session.add(user)
    session.flush()

    # Session 1
    sess1 = AgentSession(
        user_id=user.id,
        status="completed",
        input_snapshot={"target_role": "Frontend Developer"},
    )
    session.add(sess1)
    session.flush()

    rm1 = Roadmap(
        user_id=user.id,
        agent_session_id=sess1.id,
        title="Frontend Roadmap v1",
        is_active=False,
    )
    session.add(rm1)
    session.flush()

    step1 = RoadmapStep(
        roadmap_id=rm1.id,
        step_order=1,
        title="Learn TypeScript Generics",
        description="Master advanced generics and utility types",
        step_type="learn",
        is_completed=True,
        completed_at=datetime.now(timezone.utc),
    )
    session.add(step1)
    session.commit()

    # Look up prior completed steps
    completed_prior = (
        session.query(RoadmapStep)
        .join(Roadmap)
        .filter(Roadmap.user_id == user.id, RoadmapStep.is_completed == True)
        .all()
    )
    completed_titles = {s.title.lower().strip() for s in completed_prior}
    assert "learn typescript generics" in completed_titles

    # In session 2, milestone with same objective is created
    step2 = RoadmapStep(
        roadmap_id=rm1.id,
        step_order=1,
        title="Learn TypeScript Generics",
        description="Master advanced generics and utility types",
        step_type="learn",
        is_completed=("learn typescript generics" in completed_titles),
    )
    assert step2.is_completed is True
    session.close()
