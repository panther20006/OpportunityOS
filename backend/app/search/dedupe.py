import re
from hashlib import sha256
from typing import Any, Callable, Dict, List, Optional, Set, Tuple


def normalize_text(text: Optional[str]) -> str:
    """Normalize text by converting to lowercase, replacing non-alphanumeric

    characters with spaces, and stripping leading/trailing whitespace.
    """
    if not text:
        return ""
    return re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def dedupe_hash(
    title: Optional[str],
    company: Optional[str],
    location: Optional[str] = "",
    is_demo: bool = False,
    external_id: Optional[str] = None,
) -> str:
    """Generate deterministic SHA-256 deduplication hash based on normalized title, company, and location.
    Demo and live opportunities are separated cleanly via mode prefix to prevent collisions.
    Formula: sha256(f"{'demo:' if is_demo else ''}{norm(title)}|{norm(company)}|{norm(location)}")
    Returns a 64-character lowercase hex digest string.
    """
    t_norm = normalize_text(title)
    c_norm = normalize_text(company)
    l_norm = normalize_text(location)
    mode_prefix = "demo:" if is_demo else ""
    key = f"{mode_prefix}{t_norm}|{c_norm}|{l_norm}"
    return sha256(key.encode("utf-8")).hexdigest()


def content_hash(text: Optional[str]) -> str:
    """Generate deterministic SHA-256 hash for arbitrary text content (e.g. job description)."""
    norm = normalize_text(text)
    return sha256(norm.encode("utf-8")).hexdigest()


def is_duplicate(candidate_hash: str, seen_hashes: Set[str]) -> bool:
    """Check if candidate hash has already been seen in a set of known hashes."""
    return candidate_hash in seen_hashes


def deduplicate_records(
    records: List[Dict[str, Any]],
    key_func: Optional[Callable[[Dict[str, Any]], str]] = None,
) -> Tuple[List[Dict[str, Any]], int]:
    """Deduplicate a list of opportunity dictionaries preserving initial order.

    Returns (unique_records, duplicate_count).
    """
    seen: Set[str] = set()
    unique: List[Dict[str, Any]] = []
    duplicate_count = 0

    for item in records:
        if key_func:
            h = key_func(item)
        else:
            h = item.get("dedupe_hash") or dedupe_hash(
                item.get("title", ""),
                item.get("company", ""),
                item.get("location", ""),
            )

        if h in seen:
            duplicate_count += 1
            continue

        seen.add(h)
        unique.append(item)

    return unique, duplicate_count
