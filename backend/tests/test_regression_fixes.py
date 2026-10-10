import pytest
import uuid
from datetime import datetime, timezone, timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.agent.orchestrator import run_agent
from app.agent.tools import generate_fallback_queries
from app.search.serpapi_client import SerpApiClient, compute_cache_key
from app.db import SessionLocal
from app.models.user import User, UserProfile
from app.models.career_goal import CareerGoal
from app.models.opportunity import Opportunity, OpportunityMatch, SavedOpportunity
from app.models.agent import AgentSession, SerpCache
from app.models.skill import Skill, OpportunitySkill

client = TestClient(app)


def create_authenticated_user(email: str, name: str = "Test User"):
    password = "TestPassword123!"
    reg = client.post(
        "/auth/register",
        json={"full_name": name, "email": email, "password": password},
    )
    if reg.status_code == 409:
        log = client.post("/auth/login", json={"email": email, "password": password})
        token = log.json()["access_token"]
        user_id = log.json()["user"]["id"]
    else:
        token = reg.json()["access_token"]
        user_id = reg.json()["user"]["id"]
    return user_id, {"Authorization": f"Bearer {token}"}


@pytest.mark.anyio
async def test_cross_user_skill_gap_and_roadmap_denied():
    # User A creates a profile and runs search
    user_a_id, headers_a = create_authenticated_user(f"usera_{uuid.uuid4().hex[:6]}@example.com", "User A")
    user_b_id, headers_b = create_authenticated_user(f"userb_{uuid.uuid4().hex[:6]}@example.com", "User B")

    # Setup profile for User A
    client.put(
        "/profile",
        headers=headers_a,
        json={
            "profile": {
                "education_level": "bachelors",
                "experience_level": "student",
                "location_city": "Mumbai",
                "location_state": "Maharashtra",
                "location_country": "IN",
                "open_to_remote": True,
                "weekly_learning_hours": 10,
            },
            "skills": [{"name": "Python", "proficiency": 3}],
            "career_goal": {
                "target_role": "Backend Developer",
                "timeline_months": 3,
                "opportunity_types": ["internship"],
            },
        },
    )

    # Start session for User A
    search_init = client.post("/agent/search", headers=headers_a, json={})
    assert search_init.status_code == 202
    session_id_a = search_init.json()["session_id"]
    await run_agent(session_id=session_id_a, user_id=user_a_id)

    # User A can access skill gap
    resp_a = client.get(f"/skill-gap?session_id={session_id_a}", headers=headers_a)
    assert resp_a.status_code == 200

    # User B MUST BE DENIED access to User A's session skill gap (403 Forbidden)
    resp_b_gap = client.get(f"/skill-gap?session_id={session_id_a}", headers=headers_b)
    assert resp_b_gap.status_code == 403

    # User B MUST BE DENIED access to User A's roadmap session (403 Forbidden)
    resp_b_rm = client.get(f"/roadmap?session_id={session_id_a}", headers=headers_b)
    assert resp_b_rm.status_code == 403


def test_saved_results_excluding_unsaved():
    user_id, headers = create_authenticated_user(f"saved_{uuid.uuid4().hex[:6]}@example.com", "Saved Tester")

    db = SessionLocal()
    try:
        user_uuid = uuid.UUID(user_id)
        # Create 2 opportunities: one saved, one unsaved
        opp1 = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Saved Dev Role {uuid.uuid4().hex[:4]}",
            company_name="Alpha Corp",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        opp2 = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Unsaved Dev Role {uuid.uuid4().hex[:4]}",
            company_name="Beta Corp",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        db.add_all([opp1, opp2])
        db.commit()

        # Save only opp1 for this user
        save_entry = SavedOpportunity(
            user_id=user_uuid,
            opportunity_id=opp1.id,
            note="Interested",
        )
        db.add(save_entry)
        db.commit()

        opp1_str = str(opp1.id)
        opp2_str = str(opp2.id)

        # Query with saved=true
        resp = client.get("/opportunities?saved=true", headers=headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        item_ids = [item["id"] for item in items]
        assert opp1_str in item_ids
        assert opp2_str not in item_ids

        # Query with saved_only=true (backward compatibility check)
        resp_alt = client.get("/opportunities?saved_only=true", headers=headers)
        assert resp_alt.status_code == 200
        items_alt = resp_alt.json()["items"]
        item_ids_alt = [item["id"] for item in items_alt]
        assert opp1_str in item_ids_alt
        assert opp2_str not in item_ids_alt
    finally:
        db.close()


def test_sorting_and_type_filters():
    user_id, headers = create_authenticated_user(f"sortfilter_{uuid.uuid4().hex[:6]}@example.com", "Filter Tester")
    db = SessionLocal()
    try:
        opp_ft = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Full Time Position {uuid.uuid4().hex[:4]}",
            company_name="Corp A",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        opp_intern = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Internship Position {uuid.uuid4().hex[:4]}",
            company_name="Corp B",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="internship",
        )
        db.add_all([opp_ft, opp_intern])
        db.commit()

        # Test type=full_time
        resp_ft = client.get("/opportunities?type=full_time", headers=headers)
        assert resp_ft.status_code == 200
        for item in resp_ft.json()["items"]:
            assert item["opportunity_type"] in ["full_time", "job"]

        # Test type=job maps correctly to full_time
        resp_job = client.get("/opportunities?type=job", headers=headers)
        assert resp_job.status_code == 200
        for item in resp_job.json()["items"]:
            assert item["opportunity_type"] in ["full_time", "job"]

        # Test sorting with sort=recent and sort=title
        resp_sort = client.get("/opportunities?sort=title", headers=headers)
        assert resp_sort.status_code == 200
    finally:
        db.close()


def test_server_side_keyword_search_across_all_pages():
    user_id, headers = create_authenticated_user(f"searchkw_{uuid.uuid4().hex[:6]}@example.com", "Keyword Tester")
    db = SessionLocal()
    try:
        unique_kw = f"SpecialKW_{uuid.uuid4().hex[:6]}"
        opp_match = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Engineer with {unique_kw}",
            company_name="Tech Corp",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
            description=f"Requires {unique_kw}",
        )
        db.add(opp_match)
        db.commit()

        # Search for unique keyword
        resp = client.get(f"/opportunities?q={unique_kw}&page_size=10", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] >= 1
        assert any(unique_kw in item["title"] for item in data["items"])
    finally:
        db.close()


def test_skill_labels_and_matching_skills_appear():
    user_id, headers = create_authenticated_user(f"skillslabel_{uuid.uuid4().hex[:6]}@example.com", "Skill Label Tester")
    db = SessionLocal()
    try:
        # Create a skill
        skill_name = f"Skill_{uuid.uuid4().hex[:6]}"
        skill = Skill(
            id=uuid.uuid4(),
            name=skill_name,
            slug=skill_name.lower(),
            category="tech",
            is_verified=True,
        )
        db.add(skill)
        db.commit()

        # Create opportunity linked with skill
        opp = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Skill Linked Role {uuid.uuid4().hex[:4]}",
            company_name="SkillTech",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="internship",
        )
        db.add(opp)
        db.commit()

        opp_skill = OpportunitySkill(
            opportunity_id=opp.id,
            skill_id=skill.id,
            requirement="required",
        )
        db.add(opp_skill)
        db.commit()

        # Query opportunity list
        resp = client.get(f"/opportunities?q={opp.title}", headers=headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        opp_id_str = str(opp.id)
        target = next((it for it in items if it["id"] == opp_id_str), None)
        assert target is not None
        assert len(target["top_skills"]) > 0
        assert target["top_skills"][0]["name"] == skill_name
    finally:
        db.close()


def test_explicit_false_remote_override_preserved():
    # Test query generation when open_to_remote is explicitly False vs True
    q_remote_false = generate_fallback_queries(
        target_role="Fullstack Developer",
        experience_level="student",
        location_city="Pune",
        open_to_remote=False,
    )
    # When open_to_remote is False, no remote query should be added
    assert not any("remote" in q["q"].lower() for q in q_remote_false)

    q_remote_true = generate_fallback_queries(
        target_role="Fullstack Developer",
        experience_level="student",
        location_city="Pune",
        open_to_remote=True,
    )
    # When open_to_remote is True, a remote query is included
    assert any("remote" in q["q"].lower() for q in q_remote_true)


def test_unmatched_opportunities_have_nullable_score():
    user_id, headers = create_authenticated_user(f"unmatched_{uuid.uuid4().hex[:6]}@example.com", "Unmatched Tester")
    db = SessionLocal()
    try:
        opp = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Unmatched Role {uuid.uuid4().hex[:4]}",
            company_name="Raw Company",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        db.add(opp)
        db.commit()

        opp_id_str = str(opp.id)
        # Fetch without running matching session
        resp = client.get(f"/opportunities?q={opp.title}", headers=headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        target = next((it for it in items if it["id"] == opp_id_str), None)
        assert target is not None
        # Unmatched must be null, not 75% or 80% placeholder
        assert target["match_score"] is None
    finally:
        db.close()


def test_demo_results_distinguishable_from_live():
    # Cache keys are namespace separated
    demo_key = compute_cache_key("google", {"q": "python"}, is_demo=True)
    live_key = compute_cache_key("google", {"q": "python"}, is_demo=False)
    assert demo_key != live_key


def test_expired_cache_refresh_upsert():
    db = SessionLocal()
    try:
        cache_key = f"demo_upsert_{uuid.uuid4().hex[:16]}"
        old_cache = SerpCache(
            cache_key=cache_key,
            engine="google",
            params={"q": "old"},
            raw_json={"results": []},
            expires_at=datetime.now(timezone.utc) - timedelta(hours=1),
        )
        db.add(old_cache)
        db.commit()

        # Upsert with SerpApiClient helper
        client_instance = SerpApiClient(api_key=None)
        new_data = {"results": [{"title": "Fresh Job"}]}
        client_instance._save_to_cache(
            db=db,
            cache_key=cache_key,
            engine="google",
            params={"q": "fresh"},
            raw_data=new_data,
            result_count=1,
            now=datetime.now(timezone.utc),
        )

        # Retrieve updated row
        updated = db.query(SerpCache).filter(SerpCache.cache_key == cache_key).first()
        assert updated is not None
        assert updated.raw_json == new_data
        # Ensure expires_at is updated into the future
        exp = updated.expires_at
        if exp.tzinfo is not None:
            exp = exp.astimezone(timezone.utc).replace(tzinfo=None)
        now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
        assert exp > now_naive
    finally:
        db.close()


def test_application_deletion():
    user_id, headers = create_authenticated_user(f"appdel_{uuid.uuid4().hex[:6]}@example.com", "App Del Tester")
    db = SessionLocal()
    try:
        opp = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title=f"Application Opp {uuid.uuid4().hex[:4]}",
            company_name="App Corp",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        db.add(opp)
        db.commit()

        # Create application
        create_resp = client.post(
            "/applications",
            headers=headers,
            json={"opportunity_id": str(opp.id), "status": "applied", "notes": "Applied today"},
        )
        assert create_resp.status_code == 201
        app_id = create_resp.json()["id"]

        # Verify application in list
        get_resp = client.get("/applications", headers=headers)
        assert get_resp.status_code == 200
        assert any(a["id"] == app_id for a in get_resp.json()["items"])

        # Delete application
        del_resp = client.delete(f"/applications/{app_id}", headers=headers)
        assert del_resp.status_code == 204

        # Verify no longer in list
        get_resp_after = client.get("/applications", headers=headers)
        assert get_resp_after.status_code == 200
        assert not any(a["id"] == app_id for a in get_resp_after.json()["items"])
    finally:
        db.close()


def test_authoritative_application_counts():
    user_id, headers = create_authenticated_user(f"counts_{uuid.uuid4().hex[:6]}@example.com", "Counts Tester")
    db = SessionLocal()
    try:
        # Check initial zero counts
        resp0 = client.get("/applications/counts", headers=headers)
        assert resp0.status_code == 200
        assert resp0.json()["total"] == 0

        # Create two opportunities
        opp1 = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title="Count Opp 1",
            company_name="Corp A",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        opp2 = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title="Count Opp 2",
            company_name="Corp B",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        db.add_all([opp1, opp2])
        db.commit()

        client.post("/applications", headers=headers, json={"opportunity_id": str(opp1.id), "status": "applied"})
        client.post("/applications", headers=headers, json={"opportunity_id": str(opp2.id), "status": "interviewing"})

        resp = client.get("/applications/counts", headers=headers)
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert data["applied"] == 1
        assert data["interviewing"] == 1
        assert data["planned"] == 0
    finally:
        db.close()


def test_create_application_duplicate_updates_gracefully():
    user_id, headers = create_authenticated_user(f"dupapp_{uuid.uuid4().hex[:6]}@example.com", "Dup Tester")
    db = SessionLocal()
    try:
        opp = Opportunity(
            id=uuid.uuid4(),
            dedupe_hash=uuid.uuid4().hex,
            title="Dup Tracking Opp",
            company_name="Dup Corp",
            source_engine="google_jobs",
            is_demo=True,
            opportunity_type="full_time",
        )
        db.add(opp)
        db.commit()

        # Initial track as planned
        resp1 = client.post("/applications", headers=headers, json={"opportunity_id": str(opp.id), "status": "planned"})
        assert resp1.status_code == 201
        app_id = resp1.json()["id"]

        # Track again with new status 'applied' (must update rather than 409 error)
        resp2 = client.post("/applications", headers=headers, json={"opportunity_id": str(opp.id), "status": "applied"})
        assert resp2.status_code in (200, 201)
        assert resp2.json()["id"] == app_id
        assert resp2.json()["status"] == "applied"
    finally:
        db.close()

