import asyncio
from datetime import datetime, timezone
from app.db import SessionLocal, Base, engine
from app.models.user import User, UserProfile
from app.models.skill import Skill, UserSkill
from app.models.career_goal import CareerGoal
from app.models.agent import AgentSession
from app.core.security import get_password_hash
from app.seeds.load_skills import load_skills_from_csv
from app.agent.orchestrator import run_agent
from app.core.logging import logger


async def seed_demo_data():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        # 1. Load canonical skills if needed
        load_skills_from_csv(db)

        # 2. Demo User: Mitva Satani
        email = "mitva@example.com"
        demo_user = db.query(User).filter((User.email == email) | (User.email == "riya@example.com")).first()
        if not demo_user:
            demo_user = User(
                email=email,
                full_name="Mitva Satani",
                password_hash=get_password_hash("DemoPass123!"),
                is_active=True,
            )
            db.add(demo_user)
            db.commit()
            db.refresh(demo_user)
            logger.info("Created demo user: mitva@example.com")
        else:
            demo_user.email = email
            demo_user.full_name = "Mitva Satani"
            demo_user.password_hash = get_password_hash("DemoPass123!")
            db.commit()

        # 3. User Profile
        profile = db.query(UserProfile).filter(UserProfile.user_id == demo_user.id).first()
        if not profile:
            profile = UserProfile(
                user_id=demo_user.id,
                education_level="bachelors",
                degree="B.Tech",
                field_of_study="Computer Science",
                graduation_year=2027,
                institution="Gujarat Technological University",
                experience_level="student",
                location_city="Ahmedabad",
                location_state="Gujarat",
                location_country="IN",
                open_to_remote=True,
                weekly_learning_hours=15,
            )
            db.add(profile)
        else:
            profile.location_city = "Ahmedabad"
            profile.location_state = "Gujarat"
            profile.open_to_remote = True

        # 4. Career Goal
        goal = (
            db.query(CareerGoal)
            .filter(CareerGoal.user_id == demo_user.id, CareerGoal.is_active == True)
            .first()
        )
        if not goal:
            goal = CareerGoal(
                user_id=demo_user.id,
                target_role="Frontend Developer",
                goal_statement="Secure a high-impact frontend developer internship before graduation",
                timeline_months=3,
                opportunity_types=["internship"],
                is_active=True,
            )
            db.add(goal)

        # 5. Claim skills: HTML, CSS, JavaScript
        db.query(UserSkill).filter(UserSkill.user_id == demo_user.id).delete()
        claimed = [("HTML", 4), ("CSS", 3), ("JavaScript", 3)]
        for skill_name, prof in claimed:
            skill = db.query(Skill).filter(Skill.name == skill_name).first()
            if skill:
                us = UserSkill(user_id=demo_user.id, skill_id=skill.id, proficiency=prof)
                db.add(us)

        db.commit()

        # 6. Run an Agent Session for the demo user
        session = AgentSession(
            user_id=demo_user.id,
            career_goal_id=goal.id,
            status="queued",
            input_snapshot={
                "target_role": goal.target_role,
                "experience_level": profile.experience_level,
                "location_city": profile.location_city,
                "open_to_remote": profile.open_to_remote,
                "opportunity_types": goal.opportunity_types,
            },
            stages=[],
            warnings=[],
        )
        db.add(session)
        db.commit()
        db.refresh(session)

        logger.info(f"Running agent for demo user session {session.id}...")
        await run_agent(
            session_id=str(session.id),
            user_id=str(demo_user.id),
            include_news=True,
        )

        logger.info("Demo user setup complete! Login with: mitva@example.com / DemoPass123!")

    finally:
        db.close()


def main():
    asyncio.run(seed_demo_data())


if __name__ == "__main__":
    main()
