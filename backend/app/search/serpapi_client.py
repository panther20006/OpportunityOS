import json
import time
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Dict, Any, Tuple, Optional
import httpx
from sqlalchemy.orm import Session
from app.config import settings
from app.models.agent import SerpCache, AgentSession
from app.core.errors import AppError
from app.core.logging import logger


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def compute_cache_key(engine: str, params: Dict[str, Any], is_demo: bool = False) -> str:
    """
    Computes a deterministic SHA-256 fingerprint for a search query.
    Normalizes keys by sorting, stripping whitespaces, and omitting sensitive api keys.
    Separates live and demo cache entries cleanly with a prefix namespace.
    """
    canonical: Dict[str, Any] = {}
    for k, v in sorted(params.items()):
        if k == "api_key":
            continue
        if isinstance(v, str):
            canonical[k] = v.strip().lower()
        else:
            canonical[k] = v
    serialized = json.dumps(canonical, sort_keys=True, separators=(",", ":"))
    namespace = "demo:" if is_demo else "live:"
    return sha256(f"{namespace}{engine.lower().strip()}:{serialized}".encode("utf-8")).hexdigest()


class SerpApiClient:
    """
    Production-grade async SerpApi client with:
    - Explicit separation between demo mode and live SerpApi mode
    - 24-hour persistent SQLite/PostgreSQL caching with upsert support
    - Quota protection & daily budget tracking
    - Resilient fallback to stale cache when quota or network degrades
    - Truthful failure reporting: never silently substitute fabricated listings on live failures
    """

    def __init__(self, api_key: Optional[str] = None, cache_ttl_hours: Optional[int] = None):
        self.api_key = api_key if api_key is not None else settings.SERPAPI_API_KEY
        self.base_url = "https://serpapi.com/search.json"
        self.timeout = float(getattr(settings, "SERPAPI_TIMEOUT_SECONDS", 20))
        # Default to 24h persistent caching as specified in the architecture
        self.cache_ttl_hours = cache_ttl_hours or getattr(settings, "SERP_CACHE_TTL_HOURS", 24)

    def is_demo_mode(self) -> bool:
        """Determines if the client runs in demo mode (explicit config or missing API key)."""
        return bool(getattr(settings, "DEMO_MODE", False) or not self.api_key)

    def check_daily_budget(self, db: Session) -> bool:
        """Verify that total live SerpApi calls today do not exceed the daily budget limit."""
        today_start = utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        daily_sessions = (
            db.query(AgentSession)
            .filter(AgentSession.created_at >= today_start)
            .all()
        )
        total_live = sum(s.serp_calls_live for s in daily_sessions)
        return total_live < settings.SERP_DAILY_BUDGET

    def _save_to_cache(
        self,
        db: Session,
        cache_key: str,
        engine: str,
        params: Dict[str, Any],
        raw_data: Dict[str, Any],
        result_count: int,
        now: datetime,
    ) -> SerpCache:
        """
        Upserts query result in the persistent cache table.
        Prevents SQLite/PostgreSQL unique constraint violations on re-queries.
        """
        clean_params = {k: v for k, v in params.items() if k != "api_key"}
        expires_at = now + timedelta(hours=self.cache_ttl_hours)

        cached = db.query(SerpCache).filter(SerpCache.cache_key == cache_key).first()
        if cached:
            cached.engine = engine
            cached.params = clean_params
            cached.raw_json = raw_data
            cached.result_count = result_count
            cached.fetched_at = now
            cached.expires_at = expires_at
        else:
            cached = SerpCache(
                cache_key=cache_key,
                engine=engine,
                params=clean_params,
                raw_json=raw_data,
                result_count=result_count,
                fetched_at=now,
                expires_at=expires_at,
            )
            db.add(cached)

        try:
            db.commit()
            db.refresh(cached)
        except Exception as e:
            db.rollback()
            logger.warning(f"Could not persist SerpCache entry {cache_key}: {e}")
        return cached

    async def search(
        self,
        db: Session,
        engine: str,
        params: Dict[str, Any],
    ) -> Tuple[Dict[str, Any], bool, int]:
        """
        Executes search via cache or live SerpApi.
        Returns:
            Tuple of (raw_json_dict, is_cached_bool, latency_ms_int)
        """
        start_time = time.time()
        is_demo = self.is_demo_mode()
        cache_key = compute_cache_key(engine, params, is_demo=is_demo)
        now = utcnow()

        # 1. Check Cache
        cached = (
            db.query(SerpCache)
            .filter(SerpCache.cache_key == cache_key)
            .first()
        )
        if cached:
            exp = cached.expires_at
            if exp.tzinfo is None:
                exp = exp.replace(tzinfo=timezone.utc)
            if exp > now:
                latency_ms = int((time.time() - start_time) * 1000)
                logger.info(f"SerpCache HIT for engine={engine}, query={params.get('q')}")
                return cached.raw_json, True, latency_ms

        # 2. Simulated / Demo Mode (if explicit DEMO_MODE or no API key)
        if is_demo:
            logger.info(f"Demo mode active; generating high-fidelity sample responses for engine={engine}")
            raw_data = self._generate_simulated_response(engine, params)
            result_count = self._count_results(engine, raw_data)

            self._save_to_cache(db, cache_key, engine, params, raw_data, result_count, now)
            latency_ms = int((time.time() - start_time) * 1000)
            return raw_data, False, latency_ms

        # 3. Check Daily Quota Budget for live searches
        if not self.check_daily_budget(db):
            logger.warning("SerpApi daily budget reached")
            if cached:
                logger.info(f"Serving stale SerpCache for query={params.get('q')} due to budget limit")
                latency_ms = int((time.time() - start_time) * 1000)
                return cached.raw_json, True, latency_ms
            raise AppError("SERPAPI_QUOTA", "Daily search quota reached", 503)

        # 4. Live SerpApi Call via httpx
        req_params = {
            "engine": engine,
            "api_key": self.api_key,
            "hl": params.get("hl", "en"),
            "gl": params.get("gl", "in"),
            **params,
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.base_url, params=req_params)

            latency_ms = int((time.time() - start_time) * 1000)

            if resp.status_code == 401:
                raise AppError("SERPAPI_AUTH", "Invalid SerpApi credentials", 502)
            elif resp.status_code == 429:
                if cached:
                    logger.warning("SerpApi rate limit hit (429); falling back to stale cache")
                    return cached.raw_json, True, latency_ms
                raise AppError("SERPAPI_QUOTA", "SerpApi rate limit or quota exceeded", 503)
            elif resp.status_code != 200:
                if cached:
                    logger.warning(f"SerpApi returned {resp.status_code}; falling back to stale cache")
                    return cached.raw_json, True, latency_ms
                raise AppError("SERPAPI_ERROR", f"SerpApi returned status {resp.status_code}", 502)

            data = resp.json()
            if "error" in data:
                err_msg = str(data["error"])
                if "run out of searches" in err_msg.lower():
                    if cached:
                        return cached.raw_json, True, latency_ms
                    raise AppError("SERPAPI_QUOTA", "SerpApi searches exhausted", 503)
                raise AppError("SERPAPI_ERROR", f"SerpApi error: {err_msg}", 502)

            result_count = self._count_results(engine, data)
            self._save_to_cache(db, cache_key, engine, params, data, result_count, now)

            return data, False, latency_ms

        except httpx.TimeoutException:
            if cached:
                logger.warning(f"SerpApi request timed out for {engine}; serving cached record")
                return cached.raw_json, True, int((time.time() - start_time) * 1000)
            raise AppError("SERPAPI_TIMEOUT", "SerpApi request timed out", 504)
        except httpx.RequestError as e:
            if cached:
                logger.warning(f"Network error contacting SerpApi ({e}); serving cached record")
                return cached.raw_json, True, int((time.time() - start_time) * 1000)
            raise AppError("SERPAPI_ERROR", f"Network error contacting SerpApi: {str(e)}", 502)

    def _count_results(self, engine: str, data: Dict[str, Any]) -> int:
        if engine == "google_jobs":
            return len(data.get("jobs_results", []))
        elif engine == "google":
            return len(data.get("organic_results", []))
        elif engine == "google_news":
            return len(data.get("news_results", []))
        elif engine == "youtube":
            return len(data.get("video_results", []))
        return 0

    def _generate_simulated_response(self, engine: str, params: Dict[str, Any]) -> Dict[str, Any]:
        """Provides realistic real-world job fixtures when running without an active API key."""
        q = params.get("q", "developer")
        loc = params.get("location", "Ahmedabad, India")

        if engine == "google_jobs":
            return {
                "jobs_results": [
                    {
                        "job_id": "job_001_fe_intern",
                        "title": "Frontend Developer Intern",
                        "company_name": "InfiniSys Tech Solutions",
                        "location": loc,
                        "via": "via LinkedIn",
                        "is_demo": True,
                        "description": (
                            "We are looking for a passionate Frontend Developer Intern to join our engineering team. "
                            "You will work closely with senior engineers to build responsive web applications. "
                            "Responsibilities: Develop web UI using HTML, CSS, JavaScript, and React. "
                            "Integrate REST APIs and collaborate using Git. "
                            "Requirements: Solid understanding of HTML, CSS, JavaScript, React basics, and responsive design. "
                            "Familiarity with Tailwind CSS and Git is a plus."
                        ),
                        "job_highlights": [
                            {"title": "Qualifications", "items": ["HTML", "CSS", "JavaScript", "React", "REST API"]},
                            {"title": "Responsibilities", "items": ["Build responsive UI", "Integrate backend APIs"]},
                            {"title": "Benefits", "items": ["Mentorship", "Flexible remote work", "Certificate of completion"]},
                        ],
                        "detected_extensions": {
                            "work_from_home": True,
                            "schedule_type": "Internship",
                            "posted_at": "2 days ago",
                            "salary": "₹15,000 - ₹25,000 a month",
                        },
                        "apply_options": [{"link": "https://linkedin.com/jobs/view/1001"}],
                    },
                    {
                        "job_id": "job_002_jr_react",
                        "title": "Junior React Developer",
                        "company_name": "Nova Cloud Labs",
                        "location": "Ahmedabad, Gujarat",
                        "via": "via Indeed",
                        "is_demo": True,
                        "description": (
                            "Nova Cloud Labs is hiring a Junior React Developer. "
                            "Freshers with strong portfolio projects are welcome to apply. "
                            "Key skills: JavaScript, TypeScript, React, Redux, HTML5, CSS3. "
                            "Understanding of REST APIs, Git, and automated testing with Jest is appreciated."
                        ),
                        "job_highlights": [
                            {"title": "Qualifications", "items": ["React", "JavaScript", "TypeScript", "HTML", "CSS", "Git"]},
                            {"title": "Nice to have", "items": ["Redux", "Jest", "Tailwind CSS"]},
                        ],
                        "detected_extensions": {
                            "work_from_home": False,
                            "schedule_type": "Full-time",
                            "posted_at": "1 day ago",
                            "salary": "₹3.5L - ₹5L a year",
                        },
                        "apply_options": [{"link": "https://indeed.com/viewjob?jk=1002"}],
                    },
                    {
                        "job_id": "job_003_web_dev_intern",
                        "title": "Web Development Intern",
                        "company_name": "Creative Pixel Studio",
                        "location": "Ahmedabad / Remote",
                        "via": "via Glassdoor",
                        "is_demo": True,
                        "description": (
                            "Exciting internship opportunity for engineering students. "
                            "Work on client websites and internal dashboard tools. "
                            "Required: HTML, CSS, JavaScript, Responsive Design. "
                            "Good to know: Figma, Bootstrap or Tailwind, Python / Node basics."
                        ),
                        "job_highlights": [
                            {"title": "Qualifications", "items": ["HTML", "CSS", "JavaScript", "Responsive Design"]},
                            {"title": "Preferred", "items": ["Figma", "Tailwind CSS", "Node.js"]},
                        ],
                        "detected_extensions": {
                            "work_from_home": True,
                            "schedule_type": "Internship",
                            "posted_at": "3 days ago",
                            "salary": "₹12,000 a month",
                        },
                        "apply_options": [{"link": "https://glassdoor.com/job/1003"}],
                    },
                    {
                        "job_id": "job_004_ui_engineer",
                        "title": "Associate UI Engineer",
                        "company_name": "Apex Global Software",
                        "location": "Remote, India",
                        "via": "via Naukri",
                        "is_demo": True,
                        "description": (
                            "Looking for fresh graduates with strong problem-solving skills and passion for frontend. "
                            "Skills: HTML, CSS, JavaScript, React, REST API, Git. "
                            "You will collaborate on building enterprise SaaS applications."
                        ),
                        "job_highlights": [
                            {"title": "Qualifications", "items": ["React", "JavaScript", "HTML", "CSS", "REST API", "Git"]},
                        ],
                        "detected_extensions": {
                            "work_from_home": True,
                            "schedule_type": "Full-time",
                            "posted_at": "Just posted",
                            "salary": "₹4L - ₹6L a year",
                        },
                        "apply_options": [{"link": "https://naukri.com/job-listings-1004"}],
                    },
                ]
            }
        elif engine == "google":
            return {
                "organic_results": [
                    {
                        "title": "Graduate Technology Fellowship 2027 | ThoughtWorks India",
                        "link": "https://thoughtworks.com/careers/graduate-program",
                        "snippet": "Join ThoughtWorks as an entry-level software engineer. Intensive learning in web development, modern JavaScript frameworks, and agile methodologies.",
                        "source": "thoughtworks.com",
                        "is_demo": True,
                    },
                    {
                        "title": "Early Career Software Engineering Internship Program | Zomato Careers",
                        "link": "https://zomato.com/careers/internships",
                        "snippet": "Summer & winter internship programs for undergraduates in computer science. Build real customer-facing features.",
                        "source": "zomato.com",
                        "is_demo": True,
                    },
                    {
                        "title": "Infosys InStep Global Internship Program",
                        "link": "https://infosys.com/instep",
                        "snippet": "World's top-ranked internship program for tech students. Work on cutting-edge AI, cloud, and full-stack projects.",
                        "source": "infosys.com",
                        "is_demo": True,
                    },
                ]
            }
        elif engine == "google_news":
            return {
                "news_results": [
                    {
                        "title": "Tech hiring in India: Demand for frontend and full-stack freshers rebounds in Q3",
                        "link": "https://economictimes.indiatimes.com/jobs/tech-hiring-trends",
                        "source": "The Economic Times",
                        "date": "Yesterday",
                    },
                    {
                        "title": "Indian tech firms expand internship programs to bridge campus skill gaps",
                        "link": "https://livemint.com/technology/internship-demand-surge",
                        "source": "Livemint",
                        "date": "2 days ago",
                    },
                ]
            }
        elif engine == "youtube":
            return {
                "video_results": [
                    {
                        "title": f"Complete {q} Roadmap & Tutorial 2026",
                        "link": "https://www.youtube.com/watch?v=mock_vid_1",
                        "channel": "freeCodeCamp.org",
                        "duration": "2:45:00",
                    }
                ]
            }
        return {}
