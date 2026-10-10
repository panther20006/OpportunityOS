import csv
import os
import uuid
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.db import SessionLocal
from app.models.skill import Skill
from app.seeds.load_skills import load_skills_from_csv, find_skills_csv
from app.search.dedupe import (
    dedupe_hash,
    normalize_text,
    content_hash,
    is_duplicate,
    deduplicate_records,
)

client = TestClient(app)


def test_skills_csv_catalog_size_and_integrity():
    """Verify that skills.csv has 250+ canonical skills with valid structure and no duplicates."""
    csv_path = find_skills_csv()
    assert os.path.exists(csv_path), f"skills.csv not found at {csv_path}"

    with open(csv_path, mode="r", encoding="utf-8") as f:
        reader = list(csv.DictReader(f))

    assert len(reader) >= 250, f"Expected 250+ canonical skills, got {len(reader)}"

    names = set()
    slugs = set()
    categories = set()

    for idx, row in enumerate(reader):
        name = row["name"].strip()
        slug = row["slug"].strip()
        cat = row.get("category", "").strip()
        aliases = row.get("aliases", "").strip()

        assert name, f"Row {idx} has empty name"
        assert slug, f"Row {idx} has empty slug"
        assert cat, f"Row {idx} ({name}) has empty category"
        assert aliases, f"Row {idx} ({name}) has empty aliases"

        name_lower = name.lower()
        slug_lower = slug.lower()

        assert name_lower not in names, f"Duplicate skill name: {name}"
        assert slug_lower not in slugs, f"Duplicate skill slug: {slug}"

        names.add(name_lower)
        slugs.add(slug_lower)
        categories.add(cat)

    assert len(categories) >= 8, f"Expected at least 8 distinct categories, got {len(categories)}"


def test_skills_database_seeding():
    """Verify database seeding pipeline loads 250+ canonical skills."""
    db = SessionLocal()
    try:
        loaded = load_skills_from_csv(db)
        total = db.query(Skill).count()
        assert total >= 250, f"Expected at least 250 skills in database, found {total}"
    finally:
        db.close()


def test_skills_autocomplete_and_filtering():
    """Test the /skills autocomplete endpoint with search query, category filter, and limit."""
    # 1. Search for React
    resp = client.get("/skills?q=React")
    assert resp.status_code == 200
    data = resp.json()
    assert "items" in data
    assert len(data["items"]) > 0
    react = next((s for s in data["items"] if s["name"] == "React"), None)
    assert react is not None
    assert react["category"] == "frontend"

    # 2. Filter by category
    db_resp = client.get("/skills?category=database&limit=15")
    assert db_resp.status_code == 200
    db_data = db_resp.json()
    assert len(db_data["items"]) > 0
    for s in db_data["items"]:
        assert s["category"] == "database"

    # 3. Limit constraint
    lim_resp = client.get("/skills?limit=5")
    assert lim_resp.status_code == 200
    assert len(lim_resp.json()["items"]) == 5


def test_skills_categories_aggregation():
    """Test GET /skills/categories aggregation endpoint."""
    resp = client.get("/skills/categories")
    assert resp.status_code == 200
    data = resp.json()
    assert "categories" in data
    assert "total_skills" in data
    assert data["total_skills"] >= 250

    cats = {c["category"]: c["count"] for c in data["categories"]}
    assert "frontend" in cats
    assert "backend" in cats
    assert "database" in cats
    assert "data_ai" in cats
    assert "devops_cloud" in cats
    assert all(cnt > 0 for cnt in cats.values())


def test_skills_term_lookup():
    """Test GET /skills/lookup by exact name, slug, and alias."""
    # Exact name lookup
    resp1 = client.get("/skills/lookup?term=Python")
    assert resp1.status_code == 200
    d1 = resp1.json()
    assert d1["found"] is True
    assert d1["skill"]["name"] == "Python"
    assert d1["matched_by"] == "exact_name"

    # Slug lookup
    resp2 = client.get("/skills/lookup?term=fastapi")
    assert resp2.status_code == 200
    d2 = resp2.json()
    assert d2["found"] is True
    assert d2["skill"]["name"] == "FastAPI"

    # Alias lookup (e.g. 'reactjs' -> React)
    resp3 = client.get("/skills/lookup?term=reactjs")
    assert resp3.status_code == 200
    d3 = resp3.json()
    assert d3["found"] is True
    assert d3["skill"]["name"] == "React"
    assert d3["matched_by"] == "alias"

    # Unknown term lookup
    resp4 = client.get("/skills/lookup?term=definitely_not_a_real_skill_xyz")
    assert resp4.status_code == 200
    d4 = resp4.json()
    assert d4["found"] is False
    assert d4["skill"] is None


def test_skills_by_slug_and_id():
    """Test GET /skills/slug/{slug} and GET /skills/{id} endpoints."""
    # Find React to get its ID
    db = SessionLocal()
    react = db.query(Skill).filter(Skill.slug == "react").first()
    assert react is not None
    react_id = str(react.id)
    db.close()

    # Lookup by slug
    slug_resp = client.get("/skills/slug/react")
    assert slug_resp.status_code == 200
    assert slug_resp.json()["name"] == "React"

    # Lookup by non-existent slug returns 404
    missing_slug = client.get("/skills/slug/nonexistent-slug-xyz")
    assert missing_slug.status_code == 404

    # Lookup by ID
    id_resp = client.get(f"/skills/{react_id}")
    assert id_resp.status_code == 200
    assert id_resp.json()["id"] == react_id
    assert id_resp.json()["name"] == "React"

    # Lookup by invalid UUID returns 400
    bad_uuid = client.get("/skills/not-a-valid-uuid")
    assert bad_uuid.status_code == 400


def test_sha256_deduplication_engine():
    """Test deterministic SHA-256 deduplication hashing with normalization and collision resistance."""
    # 1. Normalization determinism
    h1 = dedupe_hash("Senior Frontend Engineer", "Google Inc.", "Mountain View, CA")
    h2 = dedupe_hash("  senior frontend engineer! ", "google inc.", "mountain view ca ")
    assert h1 == h2
    assert len(h1) == 64  # Standard SHA-256 hex length
    assert all(c in "0123456789abcdef" for c in h1)

    # 2. Distinct inputs yield distinct hashes
    h3 = dedupe_hash("Backend Engineer", "Google Inc.", "Mountain View, CA")
    h4 = dedupe_hash("Senior Frontend Engineer", "Meta Platforms", "Mountain View, CA")
    assert h1 != h3
    assert h1 != h4

    # 3. None and empty handling
    h_empty = dedupe_hash(None, None, None)
    assert len(h_empty) == 64

    # 4. Content hash
    c1 = content_hash("OpportunityOS AI Job Search Platform")
    c2 = content_hash("opportunityos ai job search platform")
    assert c1 == c2

    # 5. List deduplication helper
    records = [
        {"title": "DevOps Engineer", "company": "AWS", "location": "Seattle"},
        {"title": "devops engineer", "company": "aws", "location": "seattle"},
        {"title": "Cloud Architect", "company": "AWS", "location": "Seattle"},
    ]
    unique, dupes = deduplicate_records(records)
    assert len(unique) == 2
    assert dupes == 1
    assert unique[0]["title"] == "DevOps Engineer"
    assert unique[1]["title"] == "Cloud Architect"
