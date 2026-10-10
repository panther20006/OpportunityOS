import uuid
import pytest
from datetime import timedelta
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from app.core.errors import AppError
from app.config import settings

client = TestClient(app)


def test_password_hashing_and_verification():
    raw_password = "SecurePassword123!"
    hashed = get_password_hash(raw_password)

    assert hashed != raw_password
    assert hashed.startswith("$2b$") or hashed.startswith("$2a$")
    assert verify_password(raw_password, hashed) is True
    assert verify_password("WrongPassword999!", hashed) is False
    assert verify_password("", hashed) is False


def test_jwt_token_creation_and_decoding():
    user_id = uuid.uuid4()
    email = "security_test@opportunityos.com"

    token = create_access_token(user_id, email)
    assert isinstance(token, str)

    payload = decode_access_token(token)
    assert payload["sub"] == str(user_id)
    assert payload["email"] == email.lower()
    assert payload["type"] == "access"
    assert "exp" in payload
    assert "iat" in payload


def test_jwt_invalid_or_expired_token():
    # Test invalid string
    with pytest.raises(AppError) as exc_info:
        decode_access_token("not.a.valid.jwt.token")
    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "UNAUTHORIZED"

    # Test expired token
    import jwt
    from datetime import datetime, timezone
    expired_payload = {
        "sub": str(uuid.uuid4()),
        "email": "expired@example.com",
        "type": "access",
        "exp": int((datetime.now(timezone.utc) - timedelta(hours=1)).timestamp()),
    }
    expired_token = jwt.encode(expired_payload, settings.JWT_SECRET, algorithm="HS256")
    with pytest.raises(AppError) as exc_info:
        decode_access_token(expired_token)
    assert exc_info.value.status_code == 401
    assert exc_info.value.code == "UNAUTHORIZED"


def test_auth_registration_validation_and_flow():
    unique_email = f"user_{uuid.uuid4().hex[:8]}@example.com"
    password = "ValidPassword123!"

    # 1. Invalid registration (password missing digit/letter or too short)
    weak_resp = client.post(
        "/auth/register",
        json={"full_name": "Test User", "email": unique_email, "password": "weak"},
    )
    assert weak_resp.status_code == 422
    err_body = weak_resp.json()["error"]
    assert err_body["code"] == "VALIDATION_ERROR"
    assert "X-Request-ID" in weak_resp.headers
    assert weak_resp.headers["X-Content-Type-Options"] == "nosniff"

    # 2. Successful registration
    reg_resp = client.post(
        "/auth/register",
        json={"full_name": "Test User", "email": unique_email, "password": password},
    )
    assert reg_resp.status_code == 201
    reg_data = reg_resp.json()
    assert "access_token" in reg_data
    assert reg_data["token_type"] == "bearer"
    assert reg_data["user"]["email"] == unique_email
    assert reg_data["profile_complete"] is False

    # 3. Duplicate registration -> 409 CONFLICT
    dup_resp = client.post(
        "/auth/register",
        json={"full_name": "Test User", "email": unique_email, "password": password},
    )
    assert dup_resp.status_code == 409
    dup_err = dup_resp.json()["error"]
    assert dup_err["code"] == "CONFLICT"


def test_auth_login_and_security():
    unique_email = f"login_{uuid.uuid4().hex[:8]}@example.com"
    password = "MyPassword2026!"

    # Register user first
    reg = client.post(
        "/auth/register",
        json={"full_name": "Login Tester", "email": unique_email, "password": password},
    )
    assert reg.status_code == 201

    # Login with correct credentials
    login_resp = client.post(
        "/auth/login",
        json={"email": unique_email, "password": password},
    )
    assert login_resp.status_code == 200
    login_data = login_resp.json()
    assert "access_token" in login_data
    assert login_data["user"]["email"] == unique_email

    # Login with wrong password -> 401 UNAUTHORIZED
    bad_login = client.post(
        "/auth/login",
        json={"email": unique_email, "password": "WrongPassword99!"},
    )
    assert bad_login.status_code == 401
    assert bad_login.json()["error"]["code"] == "UNAUTHORIZED"
    assert bad_login.json()["error"]["message"] == "Email or password is incorrect"

    # Login with non-existent email -> 401 UNAUTHORIZED (generic message)
    non_existent = client.post(
        "/auth/login",
        json={"email": "doesnotexist@example.com", "password": "Password123!"},
    )
    assert non_existent.status_code == 401
    assert non_existent.json()["error"]["code"] == "UNAUTHORIZED"
    assert non_existent.json()["error"]["message"] == "Email or password is incorrect"


def test_profile_endpoints_and_authentication():
    # 1. Unauthenticated request to /profile -> 401
    unauth = client.get("/profile")
    assert unauth.status_code == 401
    assert unauth.json()["error"]["code"] == "UNAUTHORIZED"

    # 2. Register user to get JWT
    email = f"profile_{uuid.uuid4().hex[:8]}@example.com"
    reg = client.post(
        "/auth/register",
        json={"full_name": "Profile Tester", "email": email, "password": "Password123!"},
    )
    token = reg.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # 3. Initial GET /profile
    get_resp = client.get("/profile", headers=headers)
    assert get_resp.status_code == 200
    data = get_resp.json()
    assert data["user"]["email"] == email
    assert data["profile"] is None
    assert data["skills"] == []
    assert data["career_goal"] is None
    assert data["profile_complete"] is False

    # 4. PUT /profile with valid data
    update_payload = {
        "profile": {
            "education_level": "bachelors",
            "degree": "B.S.",
            "field_of_study": "Information Technology",
            "graduation_year": 2026,
            "experience_level": "fresher",
            "location_city": "Mumbai",
            "location_state": "Maharashtra",
            "location_country": "IN",
            "open_to_remote": True,
            "weekly_learning_hours": 20,
        },
        "skills": [
            {"name": "Python", "proficiency": 4},
            {"name": "FastAPI", "proficiency": 4},
        ],
        "career_goal": {
            "target_role": "Backend Engineer",
            "goal_statement": "Secure a backend engineering role",
            "timeline_months": 6,
            "opportunity_types": ["full_time", "internship"],
        },
    }
    put_resp = client.put("/profile", headers=headers, json=update_payload)
    assert put_resp.status_code == 200
    updated = put_resp.json()
    assert updated["profile"]["location_city"] == "Mumbai"
    assert updated["career_goal"]["target_role"] == "Backend Engineer"
    assert len(updated["skills"]) == 2
    assert updated["profile_complete"] is True

    # 5. PUT /profile with empty skills -> 422 VALIDATION_ERROR
    invalid_skills_payload = dict(update_payload)
    invalid_skills_payload["skills"] = []
    bad_put = client.put("/profile", headers=headers, json=invalid_skills_payload)
    assert bad_put.status_code == 422
    assert bad_put.json()["error"]["code"] == "VALIDATION_ERROR"

    # 6. PUT /profile with invalid opportunity_type -> 422 VALIDATION_ERROR
    invalid_opp_payload = dict(update_payload)
    invalid_opp_payload["career_goal"] = {
        "target_role": "Backend Engineer",
        "opportunity_types": ["invalid_type_abc"],
    }
    bad_opp = client.put("/profile", headers=headers, json=invalid_opp_payload)
    assert bad_opp.status_code == 422
    assert bad_opp.json()["error"]["code"] == "VALIDATION_ERROR"
