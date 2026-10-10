import re
from typing import List, Dict, Any, Tuple
from app.models.skill import Skill


def normalize_term(term: str) -> str:
    return re.sub(r"[^a-z0-9+#]+", " ", term.lower()).strip()


def extract_skills_from_text(
    description: str,
    highlights: List[Dict[str, Any]],
    all_skills: List[Skill],
) -> List[Tuple[Skill, str]]:
    """
    Extracts skills from description and job highlights.
    Returns list of (Skill, requirement) where requirement is 'required' or 'preferred'.
    """
    desc_norm = f" {normalize_term(description or '')} "
    
    # Process highlights
    qual_text = ""
    pref_text = ""
    for hl in highlights or []:
        title = (hl.get("title") or "").lower()
        items = hl.get("items") or []
        combined_items = " ".join(items)
        if any(w in title for w in ["qualification", "requirement", "must", "essential", "key skill"]):
            qual_text += " " + combined_items
        elif any(w in title for w in ["nice to have", "preferred", "bonus", "benefit", "good to have"]):
            pref_text += " " + combined_items
        else:
            qual_text += " " + combined_items

    qual_norm = f" {normalize_term(qual_text)} "
    pref_norm = f" {normalize_term(pref_text)} "

    extracted: Dict[str, Tuple[Skill, str]] = {}

    for skill in all_skills:
        # Check canonical name
        skill_name_norm = normalize_term(skill.name)
        terms_to_check = [skill_name_norm]
        for alias in skill.aliases or []:
            norm_alias = normalize_term(alias)
            if norm_alias and norm_alias not in terms_to_check:
                terms_to_check.append(norm_alias)

        matched = False
        is_pref = False

        for term in terms_to_check:
            # Word boundary matching
            pattern = r"(?<![a-z0-9])" + re.escape(term) + r"(?![a-z0-9])"
            if re.search(pattern, qual_norm):
                matched = True
                is_pref = False
                break
            elif re.search(pattern, pref_norm):
                matched = True
                is_pref = True
                break
            elif re.search(pattern, desc_norm):
                matched = True
                is_pref = False
                break

        if matched:
            req_type = "preferred" if is_pref else "required"
            extracted[str(skill.id)] = (skill, req_type)

    return list(extracted.values())
