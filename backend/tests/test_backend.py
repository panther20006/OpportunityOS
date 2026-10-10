import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.matching.scorer import score_opportunity

client = TestClient(app)


def test_health_check():
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["app"] == "OpportunityOS"


def test_auth_and_profile_flow():
    test_email = "test.riya@example.com"
    test_password = "SecurePassword123!"

    # 1. Register
    reg_resp = client.post(
        "/auth/register",
        json={
            "full_name": "Riya Shah",
            "email": test_email,
            "password": test_password,
        },
    )
    # Could be 201 or 409 if already run
    if reg_resp.status_code == 409:
        login_resp = client.post(
            "/auth/login",
            json={"email": test_email, "password": test_password},
        )
        assert login_resp.status_code == 200
        token = login_resp.json()["access_token"]
    else:
        assert reg_resp.status_code == 201
        token = reg_resp.json()["access_token"]

    assert token is not None
    headers = {"Authorization": f"Bearer {token}"}

    # 2. Check invalid password returns 401
    bad_login = client.post(
        "/auth/login",
        json={"email": test_email, "password": "WrongPassword999"},
    )
    assert bad_login.status_code == 401
    err = bad_login.json()["error"]
    assert err["code"] == "UNAUTHORIZED"

    # 3. GET Skills autocomplete
    skills_resp = client.get("/skills?q=React", headers=headers)
    assert skills_resp.status_code == 200
    skills_data = skills_resp.json()
    assert len(skills_data["items"]) > 0
    react_skill = next(s for s in skills_data["items"] if s["name"] == "React")
    assert react_skill is not None

    # 4. PUT /profile
    put_profile_resp = client.put(
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
                {"name": "CSS", "proficiency": 4},
                {"name": "JavaScript", "proficiency": 3},
            ],
            "career_goal": {
                "target_role": "Frontend Developer",
                "goal_statement": "Secure a frontend developer internship in Ahmedabad or remote",
                "timeline_months": 3,
                "opportunity_types": ["internship"],
            },
        },
    )
    assert put_profile_resp.status_code == 200
    p_data = put_profile_resp.json()
    assert p_data["profile_complete"] is True
    assert len(p_data["skills"]) == 3
    assert p_data["career_goal"]["target_role"] == "Frontend Developer"


def test_scorer_determinism():
    res = score_opportunity(
        opportunity_skills=[
            {"skill_id": "sid_html", "requirement": "required"},
            {"skill_id": "sid_css", "requirement": "required"},
            {"skill_id": "sid_js", "requirement": "required"},
            {"skill_id": "sid_react", "requirement": "required"},
        ],
        user_skill_ids={"sid_html", "sid_css", "sid_js"},
        target_role="Frontend Developer",
        opp_title="Frontend Developer Internship",
        opp_location="Ahmedabad, Gujarat",
        opp_is_remote=True,
        opp_type="internship",
        opp_description="Looking for an intern with knowledge of web development",
        user_city="Ahmedabad",
        user_state="Gujarat",
        user_open_to_remote=True,
        user_exp_level="student",
        user_pref_types=["internship"],
    )

    score = res["match_score"]
    assert 80 <= score <= 95
    breakdown = res["breakdown"]
    components = breakdown["components"]
    pts_sum = sum(c["points"] for c in components)
    # Breakdown points must sum to match_score within rounding tolerance (+-1)
    assert abs(round(pts_sum) - score) <= 1
