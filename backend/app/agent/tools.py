from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
from app.config import settings


def generate_fallback_queries(
    target_role: str,
    experience_level: str,
    location_city: Optional[str],
    open_to_remote: bool,
    opportunity_types: Optional[List[str]] = None,
    include_news: bool = True,
) -> List[Dict[str, Any]]:
    """
    Generates intelligent deterministic search queries aligned with target role,
    experience level, and selected opportunity categories (hackathons, grants, internships, etc.).
    Avoids hardcoded years by dynamically deriving dates from the current date.
    """
    current_year = datetime.now(timezone.utc).year
    loc = f"{location_city}, India" if location_city else "India"

    # Experience level phrasing
    if experience_level == "student":
        level_term = "internship"
        qualifier = "student intern"
    elif experience_level == "fresher":
        level_term = "fresher entry level"
        qualifier = "graduate trainee"
    else:  # 0_1_years, 1_2_years
        level_term = "junior entry level"
        qualifier = "junior associate"

    types = [t.lower() for t in (opportunity_types or ["internship"])]
    queries: List[Dict[str, Any]] = []

    # 1. Primary job or internship query
    if "internship" in types or ("full_time" not in types and "hackathon" not in types and "grant" not in types):
        queries.append({
            "engine": "google_jobs",
            "q": f"{target_role} {level_term}",
            "location": loc,
            "purpose": "jobs",
        })
    elif "full_time" in types:
        queries.append({
            "engine": "google_jobs",
            "q": f"junior {target_role}",
            "location": loc,
            "purpose": "jobs",
        })

    # 2. Hackathons query if selected
    if "hackathon" in types:
        queries.append({
            "engine": "google",
            "q": f"{target_role} hackathon {current_year} India registration student",
            "location": None,
            "purpose": "hackathons",
        })

    # 3. Grants / Fellowships queries if selected
    if "grant" in types:
        queries.append({
            "engine": "google",
            "q": f"{target_role} developer grants funding scholarship {current_year}",
            "location": None,
            "purpose": "grants",
        })
    if "fellowship" in types:
        queries.append({
            "engine": "google",
            "q": f"{target_role} technology fellowship {current_year} India",
            "location": None,
            "purpose": "fellowships",
        })

    # 4. Remote query if open to remote
    if open_to_remote and len(queries) < settings.AGENT_MAX_QUERIES - 1:
        queries.append({
            "engine": "google_jobs",
            "q": f"{target_role} remote India {qualifier}",
            "location": None,
            "purpose": "jobs",
        })

    # 5. Program / Organic career program query
    if ("program" in types or "internship" in types) and len(queries) < settings.AGENT_MAX_QUERIES - 1:
        queries.append({
            "engine": "google",
            "q": f"{target_role} early career hiring program {current_year} India",
            "location": None,
            "purpose": "programs",
        })

    # 6. Industry news / Market signal query
    if include_news and len(queries) < settings.AGENT_MAX_QUERIES:
        queries.append({
            "engine": "google_news",
            "q": f"{target_role} tech hiring trends India",
            "location": None,
            "purpose": "market_signal",
        })

    # Ensure at least 2 queries exist
    if len(queries) < 2:
        queries.append({
            "engine": "google_jobs",
            "q": f"junior {target_role}",
            "location": loc,
            "purpose": "jobs",
        })

    return queries[:settings.AGENT_MAX_QUERIES]
