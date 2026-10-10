import pytest
import asyncio
import uuid
from fastapi.testclient import TestClient
from app.main import app
from app.agent.orchestrator import run_agent

client = TestClient(app)


@pytest.mark.anyio
async def test_full_agent_and_endpoints_flow():
    email = f"riya.demo.{uuid.uuid4().hex[:6]}@example.com"
    password = "SuperPassword123!"

    # 1. Login/Register demo user
    reg = client.post(
        "/auth/register",
        json={"full_name": "Riya Shah", "email": email, "password": password},
    )
    if reg.status_code == 409:
        log = client.post("/auth/login", json={"email": email, "password": password})
        token = log.json()["access_token"]
        user_id = log.json()["user"]["id"]
    else:
        token = reg.json()["access_token"]
        user_id = reg.json()["user"]["id"]

    headers = {"Authorization": f"Bearer {token}"}

    # 2. Setup Profile with HTML, CSS, JavaScript, Ahmedabad, Frontend Developer
    client.put(
        "/profile",
        headers=headers,
        json={
            "profile": {
                "education_level": "bachelors",
                "degree": "B.Tech",
                "field_of_study": "Computer Science",
                "graduation_year": 2027,
                "experience_level": "student",
                "location_city": "Ahmedabad",
                "location_state": "Gujarat",
                "location_country": "IN",
                "open_to_remote": True,
                "weekly_learning_hours": 15,
            },
            "skills": [
                {"name": "HTML", "proficiency": 4},
                {"name": "CSS", "proficiency": 3},
                {"name": "JavaScript", "proficiency": 3},
            ],
            "career_goal": {
                "target_role": "Frontend Developer",
                "goal_statement": "Secure frontend internship before graduation",
                "timeline_months": 3,
                "opportunity_types": ["internship"],
            },
        },
    )

    # 3. Start Agent Search
    search_init = client.post(
        "/agent/search",
        headers=headers,
        json={"include_news": True},
    )
    assert search_init.status_code == 202
    session_id = search_init.json()["session_id"]

    # 4. Directly run agent in this test to completion
    await run_agent(session_id=session_id, user_id=user_id, include_news=True)

    # 5. Check session status
    sess_resp = client.get(f"/agent/sessions/{session_id}", headers=headers)
    assert sess_resp.status_code == 200
    s_data = sess_resp.json()
    assert s_data["status"] in ["completed", "partial"]
    assert len(s_data["stages"]) == 7
    assert s_data["result_summary"]["opportunity_count"] > 0

    # 6. GET /opportunities
    opps_resp = client.get(f"/opportunities?session_id={session_id}", headers=headers)
    assert opps_resp.status_code == 200
    opps_data = opps_resp.json()
    assert len(opps_data["items"]) > 0
    first_opp = opps_data["items"][0]
    opp_id = first_opp["id"]
    assert first_opp["match_score"] > 0

    # 7. GET /opportunities/{id}
    detail_resp = client.get(f"/opportunities/{opp_id}", headers=headers)
    assert detail_resp.status_code == 200
    det = detail_resp.json()
    assert det["opportunity"]["title"] is not None
    assert "breakdown" in det["match"]
    assert len(det["match"]["breakdown"]["components"]) == 5

    # 8. POST & DELETE /opportunities/{id}/save
    save_resp = client.post(f"/opportunities/{opp_id}/save", headers=headers, json={"note": "Priority 1"})
    assert save_resp.status_code in [200, 201]

    # Verify in saved list
    saved_list = client.get("/opportunities?saved=true", headers=headers)
    assert saved_list.status_code == 200
    assert any(o["id"] == opp_id for o in saved_list.json()["items"])

    unsave_resp = client.delete(f"/opportunities/{opp_id}/save", headers=headers)
    assert unsave_resp.status_code == 204

    # 9. GET /skill-gap
    gap_resp = client.get(f"/skill-gap?session_id={session_id}", headers=headers)
    assert gap_resp.status_code == 200
    gap_data = gap_resp.json()
    assert len(gap_data["items"]) > 0
    assert gap_data["items"][0]["priority"] in ["high", "medium", "low"]

    # 10. GET /roadmap & PATCH step
    roadmap_resp = client.get(f"/roadmap?session_id={session_id}", headers=headers)
    assert roadmap_resp.status_code == 200
    rm_data = roadmap_resp.json()
    assert len(rm_data["steps"]) >= 4
    step_id = rm_data["steps"][0]["id"]

    patch_step = client.patch(
        f"/roadmap/steps/{step_id}",
        headers=headers,
        json={"is_completed": True},
    )
    assert patch_step.status_code == 200
    assert patch_step.json()["is_completed"] is True
    assert patch_step.json()["roadmap_progress_pct"] > 0

    # 11. Applications tracker: POST, GET, PUT
    app_create = client.post(
        "/applications",
        headers=headers,
        json={"opportunity_id": opp_id, "status": "applied", "notes": "Submitted application"},
    )
    assert app_create.status_code == 201
    app_id = app_create.json()["id"]

    app_list = client.get("/applications", headers=headers)
    assert app_list.status_code == 200
    assert any(a["id"] == app_id for a in app_list.json()["items"])

    app_update = client.put(
        f"/applications/{app_id}",
        headers=headers,
        json={"status": "interviewing", "notes": "Interview scheduled"},
    )
    assert app_update.status_code == 200
    assert app_update.json()["status"] == "interviewing"

    # 12. Search History
    hist_resp = client.get("/search/history", headers=headers)
    assert hist_resp.status_code == 200
    assert len(hist_resp.json()["items"]) > 0
