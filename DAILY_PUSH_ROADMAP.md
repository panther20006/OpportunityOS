# OpportunityOS — 12-Day GitHub Daily Push & Profile Optimization Roadmap

> **Goal:** Transform your GitHub profile into an active, highly efficient, and recruiter-attractive portfolio by pushing **OpportunityOS** across 12 structured, atomic milestones.

---

## 🌟 Why This Strategy Makes Your GitHub Profile Stand Out

1. **Consistent Contribution Streak (Green Squares):** 12 days of consecutive, purposeful activity rather than a single bulk code dump.
2. **Conventional Commits & Industry Git Discipline:** Every commit uses standardized prefixes (`feat:`, `chore:`, `docs:`, `test:`) and clear scopes (`feat(auth):`, `feat(agent):`, `feat(matching):`).
3. **Feature Branching & Pull Requests:** By pushing branches (`feat/day02-...`) and creating Pull Requests on GitHub, your profile shows authentic collaborative open-source workflows.
4. **Automated CI Badges:** Includes `.github/workflows/ci.yml` that runs automated tests and builds on every push, adding a verified green checkmark `✓` to your commits.
5. **Architectural Progression:** Shows clear engineering reasoning: Specifications → Database Schema → Security & Auth → Search & Data Pipelines → Matching Engine → Background Agent Orchestration → Test Suite → Frontend Architecture → Interactive Pages → Automated CI & Release.

---

## 🚀 Quick Start: How to Push Each Day

You have two easy ways to push each day:

### Option A: Using the Automated PowerShell Helper (Fastest & Safest)
In your terminal, simply run:
```powershell
# Check current roadmap status
.\daily-push.ps1 -Status

# Stage and commit Day 1 (or Day 2, Day 3, etc.)
.\daily-push.ps1 -Day 1

# Push the branch to your GitHub repository
git push -u origin feat/day01-project-setup-specs
```

### Option B: Manual Git Commands
Follow the copy-paste commands provided in the daily schedule below.

---

## 📅 The 12-Day Step-by-Step Schedule

### Day 1: Monorepo Setup, Architecture Blueprint & System Specifications
- **Objective:** Establish the foundation with complete product requirements, technical design, database schemas, and wireframe specifications.
- **Branch:** `main` (Foundational commit)
- **Files:** `.gitignore`, `README.md`, `planing/`
- **Manual Commands:**
  ```powershell
  git add .gitignore README.md planing/
  git commit -m "docs(architecture): initialize monorepo structure with system PRD, TRD, and architecture blueprints"
  git push -u origin main
  ```
- **Recruiter Impact:** Proves you design software thoughtfully with clear specifications before writing code.

---

### Day 2: Backend Configuration & SQLAlchemy 2.0 Schema Models
- **Objective:** Define database configuration, connection engine, custom GUID/JSON types, and all 16 relational models.
- **Branch:** `feat/day02-backend-models-db`
- **Files:** `backend/requirements.txt`, `backend/.env.example`, `backend/app/__init__.py`, `backend/app/config.py`, `backend/app/db.py`, `backend/app/models/`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day02-backend-models-db
  git add backend/requirements.txt backend/.env.example backend/app/__init__.py backend/app/config.py backend/app/db.py backend/app/models/
  git commit -m "feat(db): implement 16 SQLAlchemy 2.0 schema models and database engine configuration"
  git push -u origin feat/day02-backend-models-db
  ```
- **PR Step:** Open PR on GitHub -> Merge into `main` -> `git checkout main && git pull origin main`.

---

### Day 3: Core Security, Rate Limiter, Error Envelopes & Auth Routes
- **Objective:** Implement JWT authentication, bcrypt hashing, rate limiting with slowapi, custom error envelope, and profile endpoints.
- **Branch:** `feat/day03-auth-jwt-security`
- **Files:** `backend/app/core/`, `backend/app/schemas/auth.py`, `backend/app/schemas/profile.py`, `backend/app/api/deps.py`, `backend/app/api/routes/auth.py`, `backend/app/api/routes/profile.py`, `backend/app/main.py`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day03-auth-jwt-security
  git add backend/app/core/ backend/app/schemas/auth.py backend/app/schemas/profile.py backend/app/api/deps.py backend/app/api/routes/auth.py backend/app/api/routes/profile.py backend/app/main.py
  git commit -m "feat(auth): add JWT bearer authentication, bcrypt password hashing, and user profile management"
  git push -u origin feat/day03-auth-jwt-security
  ```

---

### Day 4: Canonical Skills Catalog, Seeding & Deduplication Engine
- **Objective:** Seed 250+ canonical skills with aliases and categories, implement skill lookup routes, and SHA-256 deduplication hashing.
- **Branch:** `feat/day04-skills-catalog-dedupe`
- **Files:** `backend/seeds/skills.csv`, `backend/seeds/load_skills.py`, `backend/seeds/__init__.py`, `backend/app/seeds/`, `backend/app/schemas/skill.py`, `backend/app/api/routes/skills.py`, `backend/app/search/dedupe.py`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day04-skills-catalog-dedupe
  git add backend/seeds/skills.csv backend/seeds/load_skills.py backend/seeds/__init__.py backend/app/seeds/ backend/app/schemas/skill.py backend/app/api/routes/skills.py backend/app/search/dedupe.py
  git commit -m "feat(skills): add 250+ canonical skills catalog, CSV seed pipeline, and SHA-256 deduplication"
  git push -u origin feat/day04-skills-catalog-dedupe
  ```

---

### Day 5: Search Infrastructure & Resilient SerpApi Client
- **Objective:** Build async SerpApi client with 24h SQLite/PostgreSQL caching, multi-engine normalizer (Google Jobs, Search, News), and search history tracking.
- **Branch:** `feat/day05-search-serpapi-client`
- **Files:** `backend/app/search/__init__.py`, `backend/app/search/serpapi_client.py`, `backend/app/search/normalizer.py`, `backend/app/schemas/history.py`, `backend/app/api/routes/search_history.py`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day05-search-serpapi-client
  git add backend/app/search/__init__.py backend/app/search/serpapi_client.py backend/app/search/normalizer.py backend/app/schemas/history.py backend/app/api/routes/search_history.py
  git commit -m "feat(search): implement multi-engine SerpApi client with 24h caching and query normalization"
  git push -u origin feat/day05-search-serpapi-client
  ```

---

### Day 6: Deterministic Matching Engine & Skill Gap Analyzer
- **Objective:** Introduce the 5-pillar mathematical match scoring algorithm (50% skills, 15% role, 15% location, 10% exp, 10% type) and learning roadmap builder.
- **Branch:** `feat/day06-matching-scorer-gap`
- **Files:** `backend/app/matching/`, `backend/app/schemas/skill_gap.py`, `backend/app/schemas/roadmap.py`, `backend/app/api/routes/skill_gap.py`, `backend/app/api/routes/roadmap.py`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day06-matching-scorer-gap
  git add backend/app/matching/ backend/app/schemas/skill_gap.py backend/app/schemas/roadmap.py backend/app/api/routes/skill_gap.py backend/app/api/routes/roadmap.py
  git commit -m "feat(matching): build 5-pillar explainable match scorer and skill gap uplift analyzer"
  git push -u origin feat/day06-matching-scorer-gap
  ```

---

### Day 7: AI Career Agent Orchestration Pipeline
- **Objective:** Implement 7-stage background agent pipeline (`plan_queries`, `search`, `normalize_dedupe`, `extract_skills`, `match`, `skill_gap`, `roadmap`) with stage logging.
- **Branch:** `feat/day07-agent-orchestrator`
- **Files:** `backend/app/agent/`, `backend/app/schemas/agent.py`, `backend/app/schemas/opportunity.py`, `backend/app/api/routes/agent.py`, `backend/app/api/routes/opportunities.py`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day07-agent-orchestrator
  git add backend/app/agent/ backend/app/schemas/agent.py backend/app/schemas/opportunity.py backend/app/api/routes/agent.py backend/app/api/routes/opportunities.py
  git commit -m "feat(agent): implement 7-stage background career agent with real-time SSE/polling progress"
  git push -u origin feat/day07-agent-orchestrator
  ```

---

### Day 8: Application Tracking Pipeline & Pytest Test Suite
- **Objective:** Add status tracking workflow (Saved, Applied, Interviewing, Offered), demo account generator (Mitva Satani), and automated backend unit/integration tests.
- **Branch:** `feat/day08-applications-tracker-tests`
- **Files:** `backend/app/schemas/application.py`, `backend/app/api/routes/applications.py`, `backend/app/api/routes/__init__.py`, `backend/seeds/seed_demo.py`, `backend/tests/`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day08-applications-tracker-tests
  git add backend/app/schemas/application.py backend/app/api/routes/applications.py backend/app/api/routes/__init__.py backend/seeds/seed_demo.py backend/tests/
  git commit -m "feat(tracker): add Kanban job application tracking and end-to-end pytest test suite"
  git push -u origin feat/day08-applications-tracker-tests
  ```

---

### Day 9: Frontend Architecture, Tailwind Design Tokens & Core Components
- **Objective:** Set up Vite + React 18 + TypeScript SPA, custom Tailwind tokens, Axios interceptors, AuthContext, ToastContext, and UI widgets (`MatchRing`, `GapBar`).
- **Branch:** `feat/day09-frontend-scaffold-components`
- **Files:** `frontend/package.json`, `frontend/package-lock.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/tailwind.config.js`, `frontend/postcss.config.js`, `frontend/index.html`, `frontend/.env.example`, `frontend/src/index.css`, `frontend/src/main.tsx`, `frontend/src/vite-env.d.ts`, `frontend/src/api/`, `frontend/src/auth/`, `frontend/src/context/`, `frontend/src/components/Navbar.tsx`, `frontend/src/components/MatchRing.tsx`, `frontend/src/components/GapBar.tsx`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day09-frontend-scaffold-components
  git add frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/vite.config.ts frontend/tailwind.config.js frontend/postcss.config.js frontend/index.html frontend/.env.example frontend/src/index.css frontend/src/main.tsx frontend/src/vite-env.d.ts frontend/src/api/ frontend/src/auth/ frontend/src/context/ frontend/src/components/Navbar.tsx frontend/src/components/MatchRing.tsx frontend/src/components/GapBar.tsx
  git commit -m "feat(frontend): scaffold React 18 TypeScript SPA with Tailwind design system and core widgets"
  git push -u origin feat/day09-frontend-scaffold-components
  ```

---

### Day 10: Authentication Pages, Onboarding Wizard & Match Inspection UI
- **Objective:** Implement responsive Landing page, Login/Signup forms, 4-step interactive Onboarding Wizard, and Match Breakdown Modal.
- **Branch:** `feat/day10-frontend-auth-onboarding`
- **Files:** `frontend/src/components/MatchBreakdownModal.tsx`, `frontend/src/components/OpportunityCard.tsx`, `frontend/src/components/StageTimeline.tsx`, `frontend/src/pages/LandingPage.tsx`, `frontend/src/pages/LoginPage.tsx`, `frontend/src/pages/SignupPage.tsx`, `frontend/src/pages/OnboardingPage.tsx`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day10-frontend-auth-onboarding
  git add frontend/src/components/MatchBreakdownModal.tsx frontend/src/components/OpportunityCard.tsx frontend/src/components/StageTimeline.tsx frontend/src/pages/LandingPage.tsx frontend/src/pages/LoginPage.tsx frontend/src/pages/SignupPage.tsx frontend/src/pages/OnboardingPage.tsx
  git commit -m "feat(frontend): build responsive landing, JWT auth flows, and 4-step interactive onboarding wizard"
  git push -u origin feat/day10-frontend-auth-onboarding
  ```

---

### Day 11: Career Intelligence Views (Dashboard, Roadmap, Gap & Tracker)
- **Objective:** Connect full interactive pages: Dashboard, Opportunity Detail, Skill Gap analysis, Roadmap checklist, Kanban Tracker, and Live Agent Visualizer.
- **Branch:** `feat/day11-frontend-views-routing`
- **Files:** `frontend/src/pages/DashboardPage.tsx`, `frontend/src/pages/OpportunitiesPage.tsx`, `frontend/src/pages/OpportunityDetailPage.tsx`, `frontend/src/pages/SkillGapPage.tsx`, `frontend/src/pages/RoadmapPage.tsx`, `frontend/src/pages/ApplicationsPage.tsx`, `frontend/src/pages/HistoryPage.tsx`, `frontend/src/pages/SavedPage.tsx`, `frontend/src/pages/SettingsPage.tsx`, `frontend/src/pages/ProfilePage.tsx`, `frontend/src/pages/AgentProcessingPage.tsx`, `frontend/src/App.tsx`
- **Manual Commands:**
  ```powershell
  git checkout -b feat/day11-frontend-views-routing
  git add frontend/src/pages/DashboardPage.tsx frontend/src/pages/OpportunitiesPage.tsx frontend/src/pages/OpportunityDetailPage.tsx frontend/src/pages/SkillGapPage.tsx frontend/src/pages/RoadmapPage.tsx frontend/src/pages/ApplicationsPage.tsx frontend/src/pages/HistoryPage.tsx frontend/src/pages/SavedPage.tsx frontend/src/pages/SettingsPage.tsx frontend/src/pages/ProfilePage.tsx frontend/src/pages/AgentProcessingPage.tsx frontend/src/App.tsx
  git commit -m "feat(frontend): complete full application views including dashboard, interactive roadmap, and Kanban tracker"
  git push -u origin feat/day11-frontend-views-routing
  ```

---

### Day 12: CI/CD GitHub Actions, Release v1.0.0 & Final Milestone
- **Objective:** Configure GitHub Actions automated workflow for continuous integration, commit roadmap tracking artifacts, and tag production release `v1.0.0`.
- **Branch:** `chore/day12-ci-release`
- **Files:** `.github/workflows/ci.yml`, `.gsd/`, `daily-push.ps1`, `DAILY_PUSH_ROADMAP.md`
- **Manual Commands:**
  ```powershell
  git checkout -b chore/day12-ci-release
  git add .github/workflows/ci.yml .gsd/ daily-push.ps1 DAILY_PUSH_ROADMAP.md
  git commit -m "chore(ci): configure GitHub Actions automated workflow and finalize v1.0.0 release milestone"
  git push -u origin chore/day12-ci-release
  ```
- **Tag the Release:**
  ```powershell
  git checkout main
  git merge chore/day12-ci-release
  git tag -a v1.0.0 -m "OpportunityOS v1.0.0 — Production Hackathon Release"
  git push origin v1.0.0
  ```

---

## 💡 Top 5 Tips to Maximize Your GitHub Profile Impact

1. **Pin OpportunityOS to Your Profile:**
   - On your GitHub profile, click **"Customize your pins"** and pin this repository.
2. **Add Topic Tags on GitHub:**
   - Under repository **About (⚙️)**, add topics: `fastapi`, `react`, `typescript`, `python`, `career-agent`, `ai-agent`, `serpapi`, `tailwindcss`, `sqlite`, `postgresql`.
3. **Use Pull Requests:**
   - Even when working solo, creating and merging PRs (`feat/day02-...` into `main`) demonstrates you understand real-world engineering teamwork and PR workflows.
4. **Create a GitHub Release:**
   - On Day 12, go to **Releases -> Draft a new release**, pick tag `v1.0.0`, click **Generate release notes**, and publish.
5. **Showcase Live Demo Credentials in README:**
   - The README already highlights the pre-seeded demo account (`mitva@example.com` / `DemoPass123!`), making it effortless for interviewers to test immediately!
