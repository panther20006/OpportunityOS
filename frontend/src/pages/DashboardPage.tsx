import React, { useEffect, useState, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Sparkles,
  TrendingUp,
  MapPin,
  CheckCircle2,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  Briefcase,
  Clock,
  Compass,
  BookOpen,
  Calendar,
  Layers
} from 'lucide-react';
import { apiClient } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import {
  OpportunityListItem,
  SkillGapItem,
  RoadmapResponse,
  ProfileResponse,
  ApplicationListResponse,
  AgentSessionResponse
} from '../api/types';
import { OpportunityCard } from '../components/OpportunityCard';
import { GapBar } from '../components/GapBar';
import { useToast } from '../context/ToastContext';

interface AppCounts {
  total: number;
  planned: number;
  applied: number;
  interviewing: number;
  offer: number;
}

export const DashboardPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { showToast } = useToast();

  // Section 1: Profile & Greeting
  const [profileData, setProfileData] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Section 2: Top Opportunities
  const [topOpportunities, setTopOpportunities] = useState<OpportunityListItem[]>([]);
  const [oppsLoading, setOppsLoading] = useState(true);
  const [oppsError, setOppsError] = useState<string | null>(null);
  const [lastSearchTime, setLastSearchTime] = useState<string | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  // Section 3: Authoritative Application Counts
  const [appCounts, setAppCounts] = useState<AppCounts>({
    total: 0,
    planned: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
  });
  const [countsLoading, setCountsLoading] = useState(true);
  const [countsError, setCountsError] = useState<string | null>(null);

  // Section 4: Roadmap & Next Task
  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [roadmapLoading, setRoadmapLoading] = useState(true);
  const [roadmapError, setRoadmapError] = useState<string | null>(null);

  // Section 5: Skill Gaps
  const [skillGaps, setSkillGaps] = useState<SkillGapItem[]>([]);
  const [gapsLoading, setGapsLoading] = useState(true);
  const [gapsError, setGapsError] = useState<string | null>(null);

  const [isSearching, setIsSearching] = useState(false);

  // Request versioning to ensure stale un-sessioned calls cannot overwrite sessioned calls
  const roadmapVersionRef = React.useRef(0);
  const gapsVersionRef = React.useRef(0);

  // 1. Fetch Profile
  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await apiClient.get<ProfileResponse>('/profile');
      setProfileData(res.data);
    } catch (err: any) {
      setProfileError(err.message || 'Failed to load profile');
    } finally {
      setProfileLoading(false);
    }
  }, []);

  // 4. Fetch Roadmap
  const fetchRoadmap = useCallback(async (sessionId?: string | null) => {
    const version = ++roadmapVersionRef.current;
    setRoadmapLoading(true);
    setRoadmapError(null);
    try {
      const url = sessionId ? `/roadmap?session_id=${encodeURIComponent(sessionId)}` : '/roadmap';
      const res = await apiClient.get<RoadmapResponse>(url);
      if (version === roadmapVersionRef.current) {
        setRoadmap(res.data);
      }
    } catch (err: any) {
      if (version === roadmapVersionRef.current) {
        setRoadmapError(err.message || 'No roadmap available');
      }
    } finally {
      if (version === roadmapVersionRef.current) {
        setRoadmapLoading(false);
      }
    }
  }, []);

  // 5. Fetch Skill Gaps
  const fetchSkillGaps = useCallback(async (sessionId?: string | null) => {
    const version = ++gapsVersionRef.current;
    setGapsLoading(true);
    setGapsError(null);
    try {
      const url = sessionId ? `/skill-gap?session_id=${encodeURIComponent(sessionId)}` : '/skill-gap';
      const res = await apiClient.get(url);
      if (version === gapsVersionRef.current) {
        setSkillGaps(res.data.items || []);
      }
    } catch (err: any) {
      if (version === gapsVersionRef.current) {
        setGapsError(err.message || 'No skill gaps identified');
      }
    } finally {
      if (version === gapsVersionRef.current) {
        setGapsLoading(false);
      }
    }
  }, []);

  // 2. Fetch Top Scored Opportunities and coordinate with session roadmap & gaps
  const fetchTopOpportunities = useCallback(async () => {
    setOppsLoading(true);
    setOppsError(null);
    try {
      const res = await apiClient.get('/opportunities?sort=score&page_size=3');
      const items = res.data.items || [];
      setTopOpportunities(items);
      const sessionId = res.data.session_id;
      if (sessionId) {
        setActiveSessionId(sessionId);
        try {
          const sessRes = await apiClient.get<AgentSessionResponse>(`/agent/sessions/${sessionId}`);
          if (sessRes.data.created_at) {
            setLastSearchTime(sessRes.data.created_at);
          }
        } catch {}
        fetchRoadmap(sessionId);
        fetchSkillGaps(sessionId);
      } else {
        fetchRoadmap();
        fetchSkillGaps();
      }
    } catch (err: any) {
      setOppsError(err.message || 'Failed to load top opportunities');
      fetchRoadmap();
      fetchSkillGaps();
    } finally {
      setOppsLoading(false);
    }
  }, [fetchRoadmap, fetchSkillGaps]);

  // 3. Fetch Authoritative Application Counts
  const fetchApplicationCounts = useCallback(async () => {
    setCountsLoading(true);
    setCountsError(null);
    try {
      // Check if authoritative counts endpoint is available
      try {
        const countsRes = await apiClient.get('/applications/counts');
        if (countsRes.data && typeof countsRes.data.total === 'number') {
          setAppCounts({
            total: countsRes.data.total,
            planned: countsRes.data.planned || 0,
            applied: countsRes.data.applied || 0,
            interviewing: countsRes.data.interviewing || 0,
            offer: countsRes.data.offer || 0,
          });
          setCountsLoading(false);
          return;
        }
      } catch {}

      // Fallback to /applications list response
      const listRes = await apiClient.get<ApplicationListResponse>('/applications?page_size=50');
      const apps = listRes.data.items || [];
      const totalAuthoritative = listRes.data.total !== undefined ? listRes.data.total : apps.length;

      setAppCounts({
        total: totalAuthoritative,
        planned: apps.filter((a) => a.status === 'planned').length,
        applied: apps.filter((a) => a.status === 'applied').length,
        interviewing: apps.filter((a) => a.status === 'interviewing').length,
        offer: apps.filter((a) => a.status === 'offer').length,
      });
    } catch (err: any) {
      setCountsError(err.message || 'Failed to load application counts');
    } finally {
      setCountsLoading(false);
    }
  }, []);

  // Coordinated independent loads on mount
  useEffect(() => {
    fetchProfile();
    fetchTopOpportunities();
    fetchApplicationCounts();
  }, [fetchProfile, fetchTopOpportunities, fetchApplicationCounts]);

  const handleRunSearch = async () => {
    setIsSearching(true);
    showToast('Starting fresh discovery scan...', 'info');
    try {
      const res = await apiClient.post('/agent/search', {});
      const sessionId = res.data.session_id;
      navigate(`/agent/sessions/${sessionId}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to start opportunity discovery', 'error');
      setIsSearching(false);
    }
  };

  const targetRole = profileData?.career_goal?.target_role || 'Software Explorer';
  const firstName = user?.full_name?.split(' ')[0] || 'Student';

  // Identify next unfinished task correctly
  const allTasks = roadmap?.steps || [];
  const nextRoadmapStep = allTasks.find((s) => !s.is_completed);
  const isRoadmapAllCompleted = allTasks.length > 0 && !nextRoadmapStep;

  // New user state
  const isNewUser =
    !oppsLoading &&
    topOpportunities.length === 0 &&
    !countsLoading &&
    appCounts.total === 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* 1. Header Banner & Target Role Greeting */}
      <div className="bg-white rounded-2xl p-5 sm:p-7 border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-200">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Target Role: {targetRole}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Hi, {firstName}! Here is your current career progress.
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Track your matches, applications needing attention, and next learning milestones.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
          {lastSearchTime && (
            <span className="text-xs text-slate-500 font-medium self-center sm:self-auto text-center">
              Last search: {new Date(lastSearchTime).toLocaleDateString()} at{' '}
              {new Date(lastSearchTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={handleRunSearch}
            disabled={isSearching}
            className="btn-primary"
          >
            <RefreshCw className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
            <span>{isSearching ? 'Searching...' : 'Find opportunities'}</span>
          </button>
        </div>
      </div>

      {/* Getting Started State for New Users */}
      {isNewUser ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-14 h-14 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto border border-brand-100">
            <Compass className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h2 className="text-lg font-bold text-slate-900">Let's find your first opportunities</h2>
            <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
              Your profile is set up for <strong>{targetRole}</strong>. Run your first discovery scan to uncover openings matched to your current skills.
            </p>
          </div>
          <div className="pt-2">
            <button
              onClick={handleRunSearch}
              className="btn-primary"
            >
              <Sparkles className="w-4 h-4" />
              <span>Find my opportunities</span>
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 2. Meaningful Authoritative Counts Row with Links */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* Total Applications */}
            <Link
              to="/applications"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Tracked Applications
              </div>
              <div className="text-2xl font-black text-slate-900 mt-1">
                {countsLoading ? <span className="skeleton inline-block w-8 h-7" /> : appCounts.total}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {countsError ? (
                  <span className="text-rose-500 font-medium">Partial data</span>
                ) : (
                  <span>
                    {appCounts.applied} submitted • {appCounts.interviewing} interviewing
                  </span>
                )}
              </div>
            </Link>

            {/* Planned */}
            <Link
              to="/applications?status=planned"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
                Planned to Apply
              </div>
              <div className="text-2xl font-black text-amber-700 mt-1">
                {countsLoading ? <span className="skeleton inline-block w-8 h-7" /> : appCounts.planned}
              </div>
              <div className="text-xs text-slate-400 mt-1">Ready for submission</div>
            </Link>

            {/* Roadmap Progress */}
            <Link
              to="/roadmap"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="text-xs font-semibold text-brand-700 uppercase tracking-wider">
                Roadmap Progress
              </div>
              <div className="text-2xl font-black text-brand-700 mt-1">
                {roadmapLoading ? (
                  <span className="skeleton inline-block w-12 h-7" />
                ) : (
                  `${roadmap?.progress_pct || 0}%`
                )}
              </div>
              <div className="text-xs text-slate-400 mt-1">
                {roadmap?.steps?.filter((s) => s.is_completed).length || 0} of {allTasks.length} tasks completed
              </div>
            </Link>

            {/* Skill Gaps */}
            <Link
              to="/skill-gap"
              className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors"
            >
              <div className="text-xs font-semibold text-rose-700 uppercase tracking-wider">
                Identified Skill Gaps
              </div>
              <div className="text-2xl font-black text-rose-700 mt-1">
                {gapsLoading ? <span className="skeleton inline-block w-8 h-7" /> : skillGaps.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Ranked by listing frequency</div>
            </Link>
          </div>

          {/* Section 3: Next Action & Learning Task (Prioritized high on mobile and desktop) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Main Column (Top 3 Opportunities - 7 cols) */}
            <div className="lg:col-span-7 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase className="w-5 h-5 text-brand-600" />
                    <span>Top Matched Opportunities</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Highest alignment openings calculated deterministically from your verified profile.
                  </p>
                </div>

                <Link
                  to="/opportunities"
                  className="text-xs font-bold text-brand-600 hover:text-brand-800 flex items-center gap-1"
                >
                  <span>View catalog</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {oppsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-32 skeleton rounded-2xl" />
                  ))}
                </div>
              ) : oppsError ? (
                <div className="p-5 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-2">
                  <p className="text-xs font-bold text-rose-800">Unable to load opportunities</p>
                  <p className="text-xs text-rose-600">{oppsError}</p>
                  <button
                    onClick={fetchTopOpportunities}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-semibold"
                  >
                    <RefreshCw className="w-3 h-3" />
                    <span>Retry opportunities</span>
                  </button>
                </div>
              ) : topOpportunities.length === 0 ? (
                <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-3 shadow-2xs">
                  <p className="text-xs text-slate-500">
                    No active opportunities stored yet. Click below to start discovery for {targetRole}.
                  </p>
                  <button onClick={handleRunSearch} className="btn-primary">
                    Find opportunities
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {topOpportunities.map((opp) => (
                    <OpportunityCard
                      key={opp.id}
                      opportunity={opp}
                      onApplicationStatusChange={() => fetchApplicationCounts()}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Secondary Column: Next Learning Milestone & Skill Gaps (5 cols) */}
            <div className="lg:col-span-5 space-y-6">
              {/* Next Learning Task Card */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <MapPin className="w-5 h-5 text-brand-600" />
                    <h3 className="font-bold text-slate-900 text-base">Next Learning Task</h3>
                  </div>
                  <Link to="/roadmap" className="text-xs font-bold text-brand-600 hover:text-brand-800">
                    Full Roadmap →
                  </Link>
                </div>

                {roadmapLoading ? (
                  <div className="h-32 skeleton rounded-xl" />
                ) : roadmapError ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-center space-y-2">
                    <p className="text-xs text-slate-500">Could not load next task.</p>
                    <button
                      onClick={() => fetchRoadmap(activeSessionId)}
                      className="text-xs font-bold text-brand-600"
                    >
                      Retry roadmap
                    </button>
                  </div>
                ) : isRoadmapAllCompleted ? (
                  /* When every task is complete, show congratulations and useful next step, not the first task again! */
                  <div className="p-5 bg-emerald-50 border border-emerald-200 rounded-xl text-center space-y-3">
                    <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-emerald-950">
                        All roadmap tasks completed!
                      </h4>
                      <p className="text-xs text-emerald-800 leading-relaxed">
                        Great job enhancing your skills. Keep discovering new opportunities or update your profile with new target milestones.
                      </p>
                    </div>
                    <div className="pt-1">
                      <Link
                        to="/opportunities"
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs"
                      >
                        <span>Discover more opportunities</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : nextRoadmapStep ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-brand-700 bg-brand-50 px-2.5 py-0.5 rounded-full border border-brand-200">
                        {nextRoadmapStep.step_type} phase
                      </span>
                      {nextRoadmapStep.estimated_hours && (
                        <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" />
                          ~{nextRoadmapStep.estimated_hours}h effort
                        </span>
                      )}
                    </div>

                    <h4 className="font-bold text-slate-900 text-sm">
                      {nextRoadmapStep.title}
                    </h4>

                    {nextRoadmapStep.reason && (
                      <p className="text-xs text-slate-600 leading-relaxed">
                        <strong>Why it matters:</strong> {nextRoadmapStep.reason}
                      </p>
                    )}

                    {nextRoadmapStep.action && (
                      <p className="text-xs text-slate-500">
                        <strong>Criterion:</strong> {nextRoadmapStep.action}
                      </p>
                    )}

                    <div className="pt-2">
                      <Link
                        to="/roadmap"
                        className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[40px] bg-slate-900 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold transition-colors"
                      >
                        <span>Continue learning</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="p-5 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-500">
                    No active tasks found. Start by running an opportunity search.
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
                  <span>Pacing: {profileData?.profile?.weekly_learning_hours || 10} hrs/week</span>
                  <span>{allTasks.length} Total Milestones</span>
                </div>
              </div>

              {/* Compact Skill Gap Summary */}
              <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-rose-600" />
                    <h3 className="font-bold text-slate-900 text-base">Key Skill Gaps</h3>
                  </div>
                  <Link to="/skill-gap" className="text-xs font-bold text-brand-600 hover:text-brand-800">
                    Full Analysis →
                  </Link>
                </div>

                <p className="text-xs text-slate-500">
                  Skills most frequently requested across your target role openings:
                </p>

                {gapsLoading ? (
                  <div className="space-y-2">
                    <div className="h-16 skeleton rounded-xl" />
                    <div className="h-16 skeleton rounded-xl" />
                  </div>
                ) : gapsError ? (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-500">
                    <p>{gapsError}</p>
                    <button
                      onClick={() => fetchSkillGaps(activeSessionId)}
                      className="text-brand-600 font-bold mt-1"
                    >
                      Retry gaps
                    </button>
                  </div>
                ) : skillGaps.length > 0 ? (
                  <div className="space-y-3">
                    {skillGaps.slice(0, 3).map((gap) => (
                      <GapBar key={gap.rank} item={gap} totalEvaluated={topOpportunities.length || 10} />
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-center text-xs text-slate-400 italic">
                    Run an opportunity search to identify top skill gaps for your role.
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
