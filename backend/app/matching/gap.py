from typing import List, Dict, Any, Set
from collections import defaultdict


def analyze_skill_gaps(
    top_matches: List[Dict[str, Any]],  # each has opp_id, match_score, opp_skills, missing_skill_ids
    user_skill_ids: Set[str],
    top_n: int = 15,
) -> List[Dict[str, Any]]:
    """
    Aggregates missing skills across top matches to calculate demand, uplift, and priority.
    """
    total_evaluated = min(len(top_matches), top_n)
    if total_evaluated == 0:
        return []

    eval_matches = top_matches[:total_evaluated]

    skill_demand: Dict[str, int] = defaultdict(int)
    skill_opps: Dict[str, List[str]] = defaultdict(list)
    skill_uplifts: Dict[str, List[float]] = defaultdict(list)

    for match in eval_matches:
        opp_id = str(match["opportunity_id"])
        opp_skills = match.get("opportunity_skills", [])  # list of {"skill_id": str, "requirement": str}
        missing_ids = set(match.get("missing_skill_ids", []))

        # Calculate current total opp weight
        total_w = sum(1.0 if s.get("requirement") == "required" else 0.5 for s in opp_skills)
        if total_w == 0:
            continue

        for s in opp_skills:
            sid = str(s.get("skill_id"))
            if sid in missing_ids:
                req = s.get("requirement", "required")
                w = 1.0 if req == "required" else 0.5
                # Potential points gained: 0.50 * (w / total_w) * 100
                potential_points = 50.0 * (w / total_w)
                skill_demand[sid] += 1
                skill_opps[sid].append(opp_id)
                skill_uplifts[sid].append(potential_points)

    aggregated: List[Dict[str, Any]] = []

    for sid, count in skill_demand.items():
        demand_pct = count / total_evaluated
        uplifts = skill_uplifts[sid]
        avg_uplift = round(sum(uplifts) / len(uplifts), 2) if uplifts else 0.0

        # priority_score = 0.6 * demand_pct + 0.4 * min(1.0, avg_uplift / 25.0)
        norm_uplift = min(1.0, avg_uplift / 25.0)
        priority_score = round(0.6 * demand_pct + 0.4 * norm_uplift, 4)

        if priority_score >= 0.50:
            priority = "high"
        elif priority_score >= 0.25:
            priority = "medium"
        else:
            priority = "low"

        aggregated.append({
            "skill_id": sid,
            "demand_count": count,
            "demand_pct": round(demand_pct, 4),
            "avg_uplift": avg_uplift,
            "priority_score": priority_score,
            "priority": priority,
            "opportunity_ids": skill_opps[sid],
        })

    # Sort descending by priority_score, then demand_count
    aggregated.sort(key=lambda x: (x["priority_score"], x["demand_count"]), reverse=True)

    # Assign rank 1..N and ensure top items have high priority if available
    for i, item in enumerate(aggregated):
        item["rank"] = i + 1
        if i < 2 and item["priority"] == "medium":
            item["priority"] = "high"

    return aggregated[:10]
