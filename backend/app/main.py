import uuid
from datetime import datetime, timezone
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.config import settings
from app.db import Base, engine, SessionLocal
import app.models  # Ensure all 16 SQLAlchemy models are registered
from app.models.skill import Skill
try:
    from app.seeds.load_skills import load_skills_from_csv
except ImportError:
    try:
        from seeds.load_skills import load_skills_from_csv
    except ImportError:
        def load_skills_from_csv(db):
            pass

from app.core.ratelimit import limiter
from app.core.errors import (
    AppError,
    app_error_handler,
    validation_error_handler,
    rate_limit_exceeded_handler,
    http_exception_handler,
    generic_exception_handler,
)
from app.core.logging import logger

# Import API routes
from app.api.routes import (
    auth,
    profile,
    skills,
    agent,
    opportunities,
    skill_gap,
    roadmap,
    applications,
    search_history,
)

from app.db_migrate import migrate_database


def init_db():
    Base.metadata.create_all(bind=engine)
    try:
        migrate_database(engine)
    except Exception as e:
        logger.warning(f"Database migration note: {e}")

    db = SessionLocal()
    try:
        skills_count = db.query(Skill).count()
        if skills_count == 0:
            logger.info("Skills table empty; loading canonical seeds...")
            load_skills_from_csv(db)
        else:
            logger.info(f"Database already contains {skills_count} skills.")
    except Exception as e:
        logger.error(f"Error checking/seeding skills: {e}")
    finally:
        db.close()


init_db()


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    logger.info("Shutting down OpportunityOS backend...")


def create_app() -> FastAPI:
    app = FastAPI(
        title="OpportunityOS API",
        description="AI-powered career opportunity platform for students and freshers.",
        version="1.0.0",
        lifespan=lifespan,
    )

    # Attach slowapi state
    app.state.limiter = limiter
    app.add_middleware(SlowAPIMiddleware)

    # Middleware: Request ID and Security Headers
    @app.middleware("http")
    async def add_security_and_request_headers(request: Request, call_next):
        req_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        request.state.request_id = req_id
        response = await call_next(request)
        response.headers["X-Request-ID"] = req_id
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "no-referrer"
        return response

    # CORS
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["X-Request-ID", "Retry-After"],
    )

    # Exception Handlers (Standard Error Envelopes)
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_error_handler)
    app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)

    # Root & Health Check
    @app.get("/", tags=["Health"])
    def root():
        return {
            "name": "OpportunityOS API",
            "status": "online",
            "environment": settings.APP_ENV,
            "docs": "/docs",
            "health": "/health",
        }

    @app.get("/health", tags=["Health"])
    def health():
        return {
            "status": "ok",
            "app": "OpportunityOS",
            "environment": settings.APP_ENV,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    # Register Routers
    prefix = settings.API_PREFIX or ""
    app.include_router(auth.router, prefix=prefix)
    app.include_router(profile.router, prefix=prefix)
    app.include_router(skills.router, prefix=prefix)
    app.include_router(agent.router, prefix=prefix)
    app.include_router(opportunities.router, prefix=prefix)
    app.include_router(skill_gap.router, prefix=prefix)
    app.include_router(roadmap.router, prefix=prefix)
    app.include_router(applications.router, prefix=prefix)
    app.include_router(search_history.router, prefix=prefix)

    return app


app = create_app()
