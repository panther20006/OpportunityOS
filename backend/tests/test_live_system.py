import pytest
from fastapi.testclient import TestClient
from app.main import app

def test_live_system():
    client = TestClient(app)

    # 1. Health check
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"

    # 2. Register / Login as Demo User
    email = "riya@example.com"
    password = "DemoPass123!"
    reg = client.post("/auth/register", json={"full_name": "Riya Shah", "email": email, "password": password})
    if reg.status_code == 409:
        login_res = client.post("/auth/login", json={"email": email, "password": password})
        assert login_res.status_code == 200, f"Login failed: {login_res.text}"
        token = login_res.json()["access_token"]
    else:
        assert reg.status_code == 201
        token = reg.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 3. Get Profile
    prof_res = client.get("/profile", headers=headers)
    assert prof_res.status_code == 200
    prof = prof_res.json()
    assert prof["profile"]["experience_level"] in ["student", "fresher", "entry_level"]

    # 4. Get Opportunities Catalog
    opps_res = client.get("/opportunities?page=1&page_size=10", headers=headers)
    assert opps_res.status_code == 200
    opps_data = opps_res.json()
    items = opps_data["items"]
    assert len(items) > 0, "No opportunities found"
    best_item = items[0]
    session_id = opps_data.get("session_id")

    # 5. Get Opportunity Detail & 5-Pillar Breakdown
    opp_id = best_item["id"]
    det_res = client.get(f"/opportunities/{opp_id}", headers=headers)
    assert det_res.status_code == 200
    det = det_res.json()
    assert "opportunity" in det

    # 6. Save Opportunity
    save_res = client.post(f"/opportunities/{opp_id}/save", headers=headers)
    assert save_res.status_code in (200, 201)
    saved_list = client.get("/opportunities?saved_only=true", headers=headers).json()
    assert any(o["id"] == opp_id for o in saved_list["items"])

    # 7. Get Skill Gaps if session exists
    if session_id:
        gap_res = client.get(f"/skill-gap?session_id={session_id}", headers=headers)
        assert gap_res.status_code == 200
        gaps = gap_res.json()["items"]

        # 8. Get Roadmap
        rm_res = client.get(f"/roadmap?session_id={session_id}", headers=headers)
        assert rm_res.status_code == 200
        rm = rm_res.json()
        if len(rm.get("steps", [])) > 0:
            step = rm["steps"][0]
            step_id = step["id"]
            patch_res = client.patch(f"/roadmap/steps/{step_id}", json={"is_completed": True}, headers=headers)
            assert patch_res.status_code == 200

    # 9. Application Tracker Create & Update
    app_res = client.post("/applications", json={"opportunity_id": opp_id, "status": "applied", "notes": "E2E Test Note"}, headers=headers)
    assert app_res.status_code in (201, 409)
    apps_list = client.get("/applications", headers=headers).json()
    assert len(apps_list["items"]) > 0
    app_record = apps_list["items"][0]
    update_res = client.put(f"/applications/{app_record['id']}", json={"status": "interviewing"}, headers=headers)
    assert update_res.status_code == 200

    # 10. Search History
    hist_res = client.get("/search/history", headers=headers)
    assert hist_res.status_code == 200
