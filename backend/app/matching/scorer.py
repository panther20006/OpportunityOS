import re
from typing import Dict, Any, List, Set, Tuple, Optional
from app.config import settings


def token_similarity(str1: str, str2: str) -> float:
    """Computes Jaccard token overlap between two strings."""
    tokens1 = set(re.findall(r"[a-z0-9]+", (str1 or "").lower()))
    tokens2 = set(re.findall(r"[a-z0-9]+", (str2 or "").lower()))
    if not tokens1 or not tokens2:
        return 0.0
    intersection = tokens1.intersection(tokens2)
    union = tokens1.union(tokens2)
    return len(intersection) / len(union)


def calculate_role_score(target_role: str, title: str) -> float:
    """
    Calculates role match score between user's target role and opportunity title.
    Returns 0.0 for empty role titles (empty role title must never receive a perfect score).
    """
    target_clean = (target_role or "").strip().lower()
    title_clean = (title or "").strip().lower()

    if not target_clean or not title_clean:
        return 0.0

    if target_clean == title_clean:
        return 1.0

    sim = token_similarity(target_role, title)
    if target_clean in title_clean or title_clean in target_clean:
        return max(0.75, sim)

    # Check key role tokens (e.g. frontend, backend, full stack, python, react)
    key_terms = [
        "frontend", "backend", "full stack", "fullstack", "react",
        "python", "data", "mobile", "android", "devops", "cloud",
        "machine learning", "ai", "security", "qa", "software engineer"
    ]
    for kt in key_terms:
        if kt in target_clean and kt in title_clean:
            return max(0.85, sim)

    return min(1.0, sim * 1.5)


def calculate_location_score(
    opp_location: str,
    is_remote: bool,
    user_city: str,
    user_state: str,
    open_to_remote: bool,
) -> float:
    """
    Calculates location alignment score.
    Uses whole-token boundary matching for country codes and cities.
    'Berlin' or 'Dublin' must NEVER receive an India location score just because
    they contain 'in' as a substring.
    """
    if is_remote and open_to_remote:
        return 1.0

    loc_str = (opp_location or "").strip()
    loc_lower = loc_str.lower()
    city_lower = (user_city or "").strip().lower()
    state_lower = (user_state or "").strip().lower()

    if not loc_lower:
        return 0.40 if open_to_remote else 0.20

    # 1. Whole word city match
    if city_lower and re.search(r"\b" + re.escape(city_lower) + r"\b", loc_lower):
        return 1.0

    # 2. Whole word state match
    if state_lower and re.search(r"\b" + re.escape(state_lower) + r"\b", loc_lower):
        return 0.75

    # 3. Explicit non-India locations check (e.g. Berlin, Munich, London, Austin)
    non_india_indicators = [
        "germany", "deutschland", "berlin", "munich", "frankfurt", "hamburg",
        "united states", "usa", "us", "seattle", "austin", "new york", "san francisco",
        "united kingdom", "uk", "london", "dublin", "ireland", "canada", "toronto",
        "australia", "sydney", "singapore", "netherlands", "amsterdam", "france", "paris"
    ]
    if any(re.search(r"\b" + re.escape(term) + r"\b", loc_lower) for term in non_india_indicators):
        return 0.20

    # 4. India matching: match complete tokens only
    india_patterns = [
        r"\bindia\b",
        r"\bbharat\b",
        r"\bind\b",
        r"(?:^|[,\s])in(?:\s*,\s*india|\s*$|\s*\(india\))",
    ]
    is_india = any(re.search(p, loc_lower) for p in india_patterns)

    if is_india:
        return 0.50 if open_to_remote else 0.30

    return 0.20


def calculate_experience_score(user_level: str, title: str, description: str) -> float:
    text = f"{title or ''} {description or ''}".lower()
    fresher_indicators = [
        "intern",
        "internship",
        "trainee",
        "fresher",
        "junior",
        "entry",
        "associate",
        "0-1 year",
        "0-2 year",
        "campus",
        "college",
        "graduate",
    ]
    senior_indicators = ["senior", "lead", "principal", "architect", "5+ year", "4+ year", "staff"]

    has_fresher_signal = any(w in text for w in fresher_indicators)
    has_senior_signal = any(w in text for w in senior_indicators)

    if user_level in ["student", "fresher"]:
        if has_senior_signal:
            return 0.1
        if has_fresher_signal:
            return 1.0
        return 0.6
    else:  # 0_1_years, 1_2_years
        if has_senior_signal:
            return 0.2
        return 1.0 if has_fresher_signal else 0.8


def calculate_type_score(opp_type: str, preferred_types: List[str]) -> float:
    if not preferred_types:
        return 0.8
    if opp_type in preferred_types:
        return 1.0
    if opp_type in ["career_page", "program"] and "internship" in preferred_types:
        return 0.85
    return 0.40


def score_opportunity(
    opportunity_skills: List[Dict[str, Any]],  # list of dicts: {"skill_id": str, "requirement": "required"|"preferred"}
    user_skill_ids: Set[str],
    target_role: str,
    opp_title: str,
    opp_location: str,
    opp_is_remote: bool,
    opp_type: str,
    opp_description: str,
    user_city: str,
    user_state: str,
    user_open_to_remote: bool,
    user_exp_level: str,
    user_pref_types: List[str],
) -> Dict[str, Any]:
    """
    Computes deterministic match score and breakdown components.
    Scores represent transparent profile alignment, not hiring probability.
    """
    weights = settings.MATCH_WEIGHTS
    matched_ids: List[str] = []
    missing_ids: List[str] = []
    confidence_warnings: List[str] = []
    low_confidence = False

    # 1. Skill Score
    if not opportunity_skills:
        skill_score = 0.50
        low_confidence = True
        confidence_warnings.append("No explicit skills extracted from posting")
    else:
        total_weight = 0.0
        matched_weight = 0.0
        for os in opportunity_skills:
            sid = str(os.get("skill_id"))
            req = os.get("requirement", "required")
            w = 1.0 if req == "required" else 0.5
            total_weight += w
            if sid in user_skill_ids:
                matched_weight += w
                matched_ids.append(sid)
            else:
                missing_ids.append(sid)

        skill_score = (matched_weight / total_weight) if total_weight > 0 else 0.50

    # 2. Role Score
    if not (opp_title or "").strip():
        low_confidence = True
        confidence_warnings.append("Role title is missing or unspecified")
    role_score = calculate_role_score(target_role, opp_title)

    # 3. Location Score
    if not (opp_location or "").strip() and not opp_is_remote:
        low_confidence = True
        confidence_warnings.append("Location details are unspecified")
    location_score = calculate_location_score(
        opp_location, opp_is_remote, user_city, user_state, user_open_to_remote
    )

    # 4. Experience Score
    if not (opp_description or "").strip():
        low_confidence = True
        confidence_warnings.append("Detailed job description is missing")
    experience_score = calculate_experience_score(user_exp_level, opp_title, opp_description)

    # 5. Type Score
    type_score = calculate_type_score(opp_type, user_pref_types)

    # Weighted sum
    w_skills = weights["skills"]
    w_role = weights["role"]
    w_loc = weights["location"]
    w_exp = weights["experience"]
    w_type = weights["type"]

    pts_skills = round(w_skills * skill_score * 100, 1)
    pts_role = round(w_role * role_score * 100, 1)
    pts_loc = round(w_loc * location_score * 100, 1)
    pts_exp = round(w_exp * experience_score * 100, 1)
    pts_type = round(w_type * type_score * 100, 1)

    raw_sum = pts_skills + pts_role + pts_loc + pts_exp + pts_type
    match_score = max(0, min(100, round(raw_sum)))

    breakdown = {
        "weights_version": "v1",
        "explanation": "Score reflects profile alignment, not hiring probability.",
        "confidence_warnings": confidence_warnings,
        "components": [
            {"key": "skills", "weight": w_skills, "score": round(skill_score, 2), "points": pts_skills},
            {"key": "role", "weight": w_role, "score": round(role_score, 2), "points": pts_role},
            {"key": "location", "weight": w_loc, "score": round(location_score, 2), "points": pts_loc},
            {"key": "experience", "weight": w_exp, "score": round(experience_score, 2), "points": pts_exp},
            {"key": "type", "weight": w_type, "score": round(type_score, 2), "points": pts_type},
        ],
    }

    return {
        "match_score": match_score,
        "low_confidence": low_confidence,
        "breakdown": breakdown,
        "matched_skill_ids": matched_ids,
        "missing_skill_ids": missing_ids,
    }
