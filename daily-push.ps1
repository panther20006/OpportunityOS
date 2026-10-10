<#
.SYNOPSIS
    OpportunityOS Daily Push Assistant for GitHub
.DESCRIPTION
    Divides the OpportunityOS project into 12 daily logical milestones.
    Helps stage exact files, create feature branches, commit using Conventional Commits,
    and guide daily pushes to build an active, impressive GitHub contribution graph.
.EXAMPLE
    .\daily-push.ps1 -Day 1
    .\daily-push.ps1 -Status
#>

[CmdletBinding()]
param (
    [Parameter(Mandatory = $false)]
    [ValidateRange(1, 12)]
    [int]$Day = 0,

    [Parameter(Mandatory = $false)]
    [switch]$Status,

    [Parameter(Mandatory = $false)]
    [switch]$DirectToMain
)

$ErrorActionPreference = "Continue"

$DaysMeta = @{
    1 = @{
        Title = "Monorepo Setup & System Architecture Specifications"
        Branch = "feat/day01-project-setup-specs"
        Commit = "docs(architecture): initialize monorepo structure with system PRD, TRD, and architecture blueprints"
        Files = @(".gitignore", "README.md", "planing/")
        Description = "Initializes repository with system specifications, database schemas, and architectural designs."
    }
    2 = @{
        Title = "Backend Configuration & SQLAlchemy 2.0 Schema Models"
        Branch = "feat/day02-backend-models-db"
        Commit = "feat(db): implement 16 SQLAlchemy 2.0 schema models and database engine configuration"
        Files = @("backend/requirements.txt", "backend/.env.example", "backend/app/__init__.py", "backend/app/config.py", "backend/app/db.py", "backend/app/models/")
        Description = "Sets up database connection pool, custom GUID/JSON types, and all 16 relational models."
    }
    3 = @{
        Title = "Core Security, Rate Limiter, Error Envelopes & Auth Routes"
        Branch = "feat/day03-auth-jwt-security"
        Commit = "feat(auth): add JWT bearer authentication, bcrypt password hashing, and user profile management"
        Files = @("backend/app/core/", "backend/app/schemas/auth.py", "backend/app/schemas/profile.py", "backend/app/api/deps.py", "backend/app/api/routes/auth.py", "backend/app/api/routes/profile.py", "backend/app/main.py")
        Description = "Implements token creation, password verification, profile endpoints, and standard error handling."
    }
    4 = @{
        Title = "Canonical Skills Catalog, Seeding & Deduplication Engine"
        Branch = "feat/day04-skills-catalog-dedupe"
        Commit = "feat(skills): add 250+ canonical skills catalog, CSV seed pipeline, and SHA-256 deduplication"
        Files = @("backend/seeds/skills.csv", "backend/seeds/load_skills.py", "backend/seeds/__init__.py", "backend/app/seeds/", "backend/app/schemas/skill.py", "backend/app/api/routes/skills.py", "backend/app/search/dedupe.py")
        Description = "Provides canonical 250+ skill aliases, dictionary matching seeds, and content hashing."
    }
    5 = @{
        Title = "Search Infrastructure & Resilient SerpApi Client"
        Branch = "feat/day05-search-serpapi-client"
        Commit = "feat(search): implement multi-engine SerpApi client with 24h caching and query normalization"
        Files = @("backend/app/search/__init__.py", "backend/app/search/serpapi_client.py", "backend/app/search/normalizer.py", "backend/app/schemas/history.py", "backend/app/api/routes/search_history.py")
        Description = "Integrates SerpApi with 24h sqlite/pg cache, query normalizer, and search history tracking."
    }
    6 = @{
        Title = "Deterministic Matching Engine & Skill Gap Analyzer"
        Branch = "feat/day06-matching-scorer-gap"
        Commit = "feat(matching): build 5-pillar explainable match scorer and skill gap uplift analyzer"
        Files = @("backend/app/matching/", "backend/app/schemas/skill_gap.py", "backend/app/schemas/roadmap.py", "backend/app/api/routes/skill_gap.py", "backend/app/api/routes/roadmap.py")
        Description = "Implements reproducible 5-pillar mathematical scoring and personalized learning roadmap generator."
    }
    7 = @{
        Title = "AI Career Agent Orchestration Pipeline"
        Branch = "feat/day07-agent-orchestrator"
        Commit = "feat(agent): implement 7-stage background career agent with real-time progress tracking"
        Files = @("backend/app/agent/", "backend/app/schemas/agent.py", "backend/app/schemas/opportunity.py", "backend/app/api/routes/agent.py", "backend/app/api/routes/opportunities.py")
        Description = "Builds background asynchronous orchestrator with stage timers, tool calling, and opportunity storage."
    }
    8 = @{
        Title = "Application Tracking Pipeline & Pytest Test Suite"
        Branch = "feat/day08-applications-tracker-tests"
        Commit = "feat(tracker): add Kanban job application tracking and end-to-end pytest test suite"
        Files = @("backend/app/schemas/application.py", "backend/app/api/routes/applications.py", "backend/app/api/routes/__init__.py", "backend/seeds/seed_demo.py", "backend/tests/")
        Description = "Adds application status workflows, demo seed user generator, and comprehensive automated test suite."
    }
    9 = @{
        Title = "Frontend Architecture, Tailwind Design Tokens & Core Components"
        Branch = "feat/day09-frontend-scaffold-components"
        Commit = "feat(frontend): scaffold React 18 TypeScript SPA with Tailwind design system and core widgets"
        Files = @("frontend/package.json", "frontend/package-lock.json", "frontend/tsconfig.json", "frontend/vite.config.ts", "frontend/tailwind.config.js", "frontend/postcss.config.js", "frontend/index.html", "frontend/.env.example", "frontend/src/index.css", "frontend/src/main.tsx", "frontend/src/vite-env.d.ts", "frontend/src/api/", "frontend/src/auth/", "frontend/src/context/", "frontend/src/components/Navbar.tsx", "frontend/src/components/MatchRing.tsx", "frontend/src/components/GapBar.tsx")
        Description = "Configures Vite React TypeScript SPA, custom Tailwind design tokens, and reusable visual components."
    }
    10 = @{
        Title = "Authentication Pages, Onboarding Wizard & Match Inspection UI"
        Branch = "feat/day10-frontend-auth-onboarding"
        Commit = "feat(frontend): build responsive landing, JWT auth flows, and 4-step interactive onboarding wizard"
        Files = @("frontend/src/components/MatchBreakdownModal.tsx", "frontend/src/components/OpportunityCard.tsx", "frontend/src/components/StageTimeline.tsx", "frontend/src/pages/LandingPage.tsx", "frontend/src/pages/LoginPage.tsx", "frontend/src/pages/SignupPage.tsx", "frontend/src/pages/OnboardingPage.tsx")
        Description = "Implements auth screens, animated landing page, multi-step profile builder, and match breakdown modal."
    }
    11 = @{
        Title = "Career Intelligence Views (Dashboard, Roadmap, Gap & Tracker)"
        Branch = "feat/day11-frontend-views-routing"
        Commit = "feat(frontend): complete full application views including dashboard, interactive roadmap, and Kanban tracker"
        Files = @("frontend/src/pages/DashboardPage.tsx", "frontend/src/pages/OpportunitiesPage.tsx", "frontend/src/pages/OpportunityDetailPage.tsx", "frontend/src/pages/SkillGapPage.tsx", "frontend/src/pages/RoadmapPage.tsx", "frontend/src/pages/ApplicationsPage.tsx", "frontend/src/pages/HistoryPage.tsx", "frontend/src/pages/SavedPage.tsx", "frontend/src/pages/SettingsPage.tsx", "frontend/src/pages/ProfilePage.tsx", "frontend/src/pages/AgentProcessingPage.tsx", "frontend/src/App.tsx")
        Description = "Assembles full dashboard, live agent execution visualizer, skill gap heatmaps, and routing."
    }
    12 = @{
        Title = "CI/CD GitHub Actions, Release v1.0.0 & Final Milestone"
        Branch = "chore/day12-ci-release"
        Commit = "chore(ci): configure GitHub Actions automated workflow and finalize v1.0.0 release milestone"
        Files = @(".github/workflows/ci.yml", ".gsd/", "daily-push.ps1")
        Description = "Adds GitHub Actions automated testing, release metadata, and tags the v1.0.0 milestone."
    }
}

function Show-Status {
    Write-Host "`n=== OpportunityOS 12-Day GitHub Push Roadmap Status ===" -ForegroundColor Cyan
    $Log = @()
    $headCheck = cmd /c "git rev-parse --verify HEAD 2>nul"
    if ($LASTEXITCODE -eq 0) {
        $Log = cmd /c "git log --oneline 2>nul"
    }
    for ($i = 1; $i -le 12; $i++) {
        $meta = $DaysMeta[$i]
        $committed = $false
        if ($Log -and $Log.Count -gt 0) {
            $prefix = $meta.Commit.Substring(0, [Math]::Min(30, $meta.Commit.Length))
            foreach ($line in $Log) {
                if ($line -like "*$prefix*") {
                    $committed = $true
                    break
                }
            }
        }
        $mark = if ($committed) { "[COMPLETED]" } else { "[PENDING]" }
        $color = if ($committed) { "Green" } else { "Yellow" }
        Write-Host ("  Day {0,2}: {1,-12} {2}" -f $i, $mark, $meta.Title) -ForegroundColor $color
    }
    Write-Host "`nTo push a specific day, run: .\daily-push.ps1 -Day <1-12>`n" -ForegroundColor Gray
}

if ($Status) {
    Show-Status
    exit 0
}

if ($Day -eq 0) {
    Show-Status
    $inputDay = Read-Host "Which Day would you like to commit and push today? (1-12)"
    if ($inputDay -as [int] -and $inputDay -ge 1 -and $inputDay -le 12) {
        $Day = [int]$inputDay
    } else {
        Write-Host "Invalid day entered. Please choose a number between 1 and 12." -ForegroundColor Red
        exit 1
    }
}

$plan = $DaysMeta[$Day]

Write-Host "`n========================================================" -ForegroundColor Cyan
Write-Host "  Executing Day $Day : $($plan.Title)" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Description : $($plan.Description)"
Write-Host "Branch      : $($plan.Branch)"
Write-Host "Commit Msg  : $($plan.Commit)`n"

# Verify Git repo
if (-not (Test-Path ".git")) {
    Write-Host "Initializing Git repository on main branch..." -ForegroundColor Yellow
    cmd /c "git init -b main"
}

# Branching logic: Day 1 or DirectToMain commits to main
$null = cmd /c "git rev-parse --verify HEAD 2>nul"
$isFreshRepo = ($LASTEXITCODE -ne 0)

if ($isFreshRepo -or $DirectToMain -or $Day -eq 1) {
    Write-Host "Committing directly on 'main' branch (foundational milestone)..." -ForegroundColor Yellow
} else {
    Write-Host "Creating/switching to feature branch: $($plan.Branch)..." -ForegroundColor Yellow
    cmd /c "git checkout -B $($plan.Branch)"
}

# Stage files
Write-Host "Staging files for Day $Day..." -ForegroundColor Yellow
foreach ($file in $plan.Files) {
    if (Test-Path $file) {
        Write-Host "  + git add $file" -ForegroundColor Gray
        git add $file
    } else {
        Write-Host "  ! Skipping non-existent path: $file" -ForegroundColor DarkGray
    }
}

# Check if anything is staged
$staged = git diff --name-only --cached
if (-not $staged) {
    Write-Host "`n[NOTICE] No changes were staged. These files may have already been committed in a previous day." -ForegroundColor Yellow
    exit 0
}

Write-Host "`nCommitting changes..." -ForegroundColor Yellow
git commit -m $plan.Commit

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "  Day $Day successfully committed locally!" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

$targetBranch = if ($DirectToMain) { "main" } else { $plan.Branch }

Write-Host "`nTo push this to your GitHub repository today, run:" -ForegroundColor Cyan
Write-Host "  git push -u origin $targetBranch" -ForegroundColor White

if (-not $DirectToMain) {
    Write-Host "`n[PRO-TIP FOR RECRUITERS & GITHUB PROFILE]:" -ForegroundColor Magenta
    Write-Host "1. Go to your GitHub repo in browser and click 'Compare & pull request'."
    Write-Host "2. Merge the Pull Request into 'main'."
    Write-Host "3. In your local terminal, switch back to main: git checkout main && git pull origin main"
    Write-Host "This creates realistic Pull Requests and code review history on your profile!" -ForegroundColor Gray
}
Write-Host ""
