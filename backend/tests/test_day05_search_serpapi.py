import pytest
import uuid
from datetime import datetime, timedelta, timezone
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models.agent import SerpCache, AgentSession, SearchHistory
from app.models.user import User
from app.search.serpapi_client import SerpApiClient, compute_cache_key
from app.search.normalizer import (
    normalize_google_job,
    normalize_google_organic,
    normalize_google_news,
    normalize_youtube,
    normalize_search_results,
    infer_opportunity_type,
    is_job_remote,
)

client = TestClient(app)


def test_compute_cache_key_determinism():
    """Verify that compute_cache_key is deterministic, handles key ordering, and ignores api_key."""
    params1 = {"q": "React Developer", "location": "Ahmedabad", "api_key": "secret123"}
    params2 = {"location": "ahmedabad", "q": "react developer", "api_key": "different_secret"}
    params3 = {"q": "Backend Developer", "location": "Ahmedabad"}

    key1 = compute_cache_key("google_jobs", params1)
    key2 = compute_cache_key("google_jobs", params2)
    key3 = compute_cache_key("google_jobs", params3)

    assert key1 == key2, "Cache key must be identical regardless of param order, casing, or api_key"
    assert key1 != key3, "Different queries must yield different cache keys"
    assert len(key1) == 64, "Key must be a valid 64-char SHA256 hex string"


@pytest.mark.anyio
async def test_serpapi_client_caching_and_upsert():
    """Verify SerpApiClient 24h caching, cache hit latency, and upsert handling without UNIQUE constraint error."""
    db = SessionLocal()
    try:
        serp = SerpApiClient(api_key=None, cache_ttl_hours=24)
        engine = "google_jobs"
        params = {"q": f"Test Frontend {uuid.uuid4().hex[:6]}", "location": "Ahmedabad"}
        cache_key = compute_cache_key(engine, params, is_demo=serp.is_demo_mode())

        # 1. First call -> Cache MISS (generates simulated response and caches)
        data1, is_cached1, latency1 = await serp.search(db, engine, params)
        assert is_cached1 is False
        assert "jobs_results" in data1
        assert len(data1["jobs_results"]) > 0

        # Verify record in DB
        record = db.query(SerpCache).filter(SerpCache.cache_key == cache_key).first()
        assert record is not None
        assert record.engine == engine
        assert record.result_count > 0
        exp = record.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        assert exp > datetime.now(timezone.utc)

        # 2. Second call -> Cache HIT
        data2, is_cached2, latency2 = await serp.search(db, engine, params)
        assert is_cached2 is True
        assert len(data2["jobs_results"]) == len(data1["jobs_results"])

        # 3. Simulate cache expiration and test upsert
        record.expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        db.commit()

        # Third call -> Expired cache must be refreshed via upsert WITHOUT throwing IntegrityError
        data3, is_cached3, latency3 = await serp.search(db, engine, params)
        assert is_cached3 is False
        db.refresh(record)
        exp_refreshed = record.expires_at
        if exp_refreshed.tzinfo is None:
            exp_refreshed = exp_refreshed.replace(tzinfo=timezone.utc)
        assert exp_refreshed > datetime.now(timezone.utc)

    finally:
        db.close()


def test_infer_opportunity_type():
    """Verify opportunity type classification rules."""
    assert infer_opportunity_type("Software Engineer Intern") == "internship"
    assert infer_opportunity_type("Frontend Trainee") == "internship"
    assert infer_opportunity_type("Apprentice Web Developer") == "internship"
    assert infer_opportunity_type("Part-time React Developer") == "part_time"
    assert infer_opportunity_type("Contract Cloud Architect") == "contract"
    assert infer_opportunity_type("Graduate Technology Fellowship") == "fellowship"
    assert infer_opportunity_type("Summer Immersion Program") == "program"
    assert infer_opportunity_type("Senior Full Stack Developer", "Full-time") == "full_time"


def test_is_job_remote_detection():
    """Verify remote role detection across extensions and text patterns."""
    assert is_job_remote("Frontend Dev", "Ahmedabad", {"work_from_home": True}) is True
    assert is_job_remote("Remote React Developer", "India", {}) is True
    assert is_job_remote("Junior Python Developer", "Anywhere", {}) is True
    assert is_job_remote("Full Stack Engineer (WFH)", "Bangalore", {}) is True
    assert is_job_remote("Office Administrator", "Ahmedabad", {}) is False


def test_normalize_google_job():
    """Verify Google Jobs normalizer parses highlights, apply URL, and dedupe hash."""
    raw_job = {
        "job_id": "job_xyz_999",
        "title": "React Frontend Developer Intern",
        "company_name": "InfiniSys Tech Solutions",
        "location": "Ahmedabad, India",
        "via": "via LinkedIn",
        "description": "Develop high quality React web applications.",
        "job_highlights": [{"title": "Qualifications", "items": ["React", "TypeScript"]}],
        "detected_extensions": {
            "work_from_home": True,
            "schedule_type": "Internship",
            "posted_at": "3 days ago",
            "salary": "₹20,000 / month",
        },
        "apply_options": [{"link": "https://linkedin.com/jobs/view/999"}],
    }

    norm = normalize_google_job(raw_job)
    assert norm is not None
    assert norm["title"] == "React Frontend Developer Intern"
    assert norm["company_name"] == "InfiniSys Tech Solutions"
    assert norm["is_remote"] is True
    assert norm["opportunity_type"] == "internship"
    assert norm["apply_url"] == "https://linkedin.com/jobs/view/999"
    assert norm["salary_text"] == "₹20,000 / month"
    assert len(norm["dedupe_hash"]) == 64


def test_normalize_google_organic():
    """Verify Google organic search results extraction and company parsing."""
    raw_organic = {
        "title": "Early Career Software Engineering Fellowship | ThoughtWorks India",
        "link": "https://thoughtworks.com/careers/fellowship",
        "snippet": "Join our remote fellowship program for junior developers.",
        "source": "thoughtworks.com",
    }
    norm = normalize_google_organic(raw_organic)
    assert norm is not None
    assert norm["company_name"] == "ThoughtWorks India"
    assert norm["opportunity_type"] == "fellowship"
    assert norm["is_remote"] is True
    assert norm["apply_url"] == "https://thoughtworks.com/careers/fellowship"


def test_normalize_google_news():
    """Verify Google News article normalization."""
    raw_news = {
        "title": "Tech hiring expands in India for 2026 freshers",
        "link": "https://economictimes.indiatimes.com/hiring-trend",
        "source": {"name": "Economic Times"},
        "date": "1 day ago",
        "thumbnail": "https://example.com/thumb.jpg",
    }
    norm = normalize_google_news(raw_news)
    assert norm["title"] == raw_news["title"]
    assert norm["source"] == "Economic Times"
    assert norm["link"] == raw_news["link"]


def test_search_history_and_cache_routes():
    """Verify GET /search/history, /search/cache/stats, and DELETE /search/cache/expired."""
    email = f"search_tester_{uuid.uuid4().hex[:6]}@example.com"
    reg = client.post(
        "/auth/register",
        json={"full_name": "Search Tester", "email": email, "password": "Password123!"},
    )
    if reg.status_code == 409:
        log = client.post("/auth/login", json={"email": email, "password": "Password123!"})
        token = log.json()["access_token"]
    else:
        token = reg.json()["access_token"]

    headers = {"Authorization": f"Bearer {token}"}

    # 1. GET /search/history (authenticated)
    hist_resp = client.get("/search/history", headers=headers)
    assert hist_resp.status_code == 200
    hist_data = hist_resp.json()
    assert "items" in hist_data
    assert "total" in hist_data

    # 2. GET /search/cache/stats
    stats_resp = client.get("/search/cache/stats", headers=headers)
    assert stats_resp.status_code == 200
    stats_data = stats_resp.json()
    assert "total_entries" in stats_data
    assert "daily_budget" in stats_data
    assert stats_data["daily_budget"] >= 1

    # 3. DELETE /search/cache/expired
    purge_resp = client.delete("/search/cache/expired", headers=headers)
    assert purge_resp.status_code == 200
    assert "purged_count" in purge_resp.json()
