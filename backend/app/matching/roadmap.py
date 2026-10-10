from typing import List, Dict, Any, Optional
from app.models.skill import Skill
from app.models.opportunity import Opportunity


def build_template_roadmap(
    target_role: str,
    top_gaps: List[Dict[str, Any]],  # each has skill_id, priority, demand_count, skill_name
    skills_by_id: Dict[str, Skill],
    top_opportunities: List[Opportunity],
    weekly_hours: int = 10,
) -> Dict[str, Any]:
    """
    Constructs a structured, personalized Learn -> Build -> Apply roadmap
    grounded directly in the session's skill gaps and opportunities.
    """
    steps: List[Dict[str, Any]] = []
    order = 1
    total_hours = 0

    gap_skills = [
        skills_by_id[g["skill_id"]]
        for g in top_gaps
        if g.get("skill_id") in skills_by_id
    ]

    # 1. Learn steps for top 2-3 gaps
    for i, g in enumerate(top_gaps[:3]):
        sid = g.get("skill_id")
        skill = skills_by_id.get(sid)
        if not skill:
            continue

        skill_name = skill.name
        demand = g.get("demand_count", 1)
        est_hours = 16 if i == 0 else 12
        total_hours += est_hours

        steps.append({
            "step_order": order,
            "step_type": "learn",
            "title": f"Master {skill_name} Core Concepts",
            "description": f"Learn foundational and practical {skill_name} concepts required for modern {target_role} roles.",
            "reason": f"Required in {demand} of your top matching opportunities.",
            "estimated_hours": est_hours,
            "action": f"Complete targeted exercises and build small components demonstrating {skill_name} proficiency.",
            "resource_query": f"{skill_name.lower()} tutorial for beginners crash course",
            "skill_id": sid,
            "opportunity_id": None,
        })
        order += 1

    # 2. Build steps
    primary_skills = ", ".join(s.name for s in gap_skills[:2]) or target_role
    build_hours = 24
    total_hours += build_hours
    steps.append({
        "step_order": order,
        "step_type": "build",
        "title": f"Build a Portfolio Project with {primary_skills}",
        "description": f"Create an end-to-end, production-ready portfolio project featuring {primary_skills} to prove hands-on capability to recruiters.",
        "reason": f"Real project proof directly overcomes the qualification barrier for fresher {target_role} listings.",
        "estimated_hours": build_hours,
        "action": f"Develop, test, and deploy a responsive web app on Vercel/GitHub Pages with clean README and live demo link.",
        "resource_query": f"how to build portfolio project {target_role.lower()}",
        "skill_id": gap_skills[0].id if gap_skills else None,
        "opportunity_id": None,
    })
    order += 1

    # 3. Apply steps linked to real opportunities
    for opp in top_opportunities[:2]:
        steps.append({
            "step_order": order,
            "step_type": "apply",
            "title": f"Apply to {opp.title} at {opp.company_name or 'Hiring Company'}",
            "description": f"Submit your application highlighting your projects and {primary_skills} readiness.",
            "reason": f"High match opportunity ({opp.opportunity_type}) aligned with your {target_role} goal.",
            "estimated_hours": 2,
            "action": "Tailor resume highlights to match job description, apply via original portal, and track status.",
            "resource_query": None,
            "skill_id": None,
            "opportunity_id": str(opp.id),
        })
        total_hours += 2
        order += 1

    total_weeks = max(2, round(total_hours / max(1, weekly_hours)))

    return {
        "title": f"Actionable {target_role} Roadmap",
        "summary": f"Focus on mastering {primary_skills}, solidify with a portfolio project, and apply directly to your top matching openings.",
        "total_weeks": total_weeks,
        "generation_method": "template",
        "steps": steps,
    }
