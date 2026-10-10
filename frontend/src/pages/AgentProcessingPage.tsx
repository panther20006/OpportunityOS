import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Sparkles, ArrowRight, AlertCircle, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react';
import { apiClient } from '../api/client';
import { AgentSessionResponse } from '../api/types';
import { StageTimeline } from '../components/StageTimeline';

export const AgentProcessingPage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [session, setSession] = useState<AgentSessionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const isTerminal = Boolean(
    session?.status === 'completed' || session?.status === 'partial' || session?.status === 'failed'
  );

  const activeSessionIdRef = useRef<string | undefined>(sessionId);
  activeSessionIdRef.current = sessionId;
  const isPollingRef = useRef<boolean>(false);

  // When sessionId changes: clear previous session, error, timer, and retry state
  useEffect(() => {
    setSession(null);
    setError(null);
    setElapsedSeconds(0);
    setRetrying(false);
  }, [sessionId]);

  // Timer for elapsed seconds - stops when session finishes or on session change
  useEffect(() => {
    if (isTerminal || !sessionId) return;

    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [sessionId, isTerminal]);

  // Polling every 1500ms - prevents overlapping requests, stops on terminal states, ignores old session responses
  useEffect(() => {
    if (!sessionId || isTerminal) return;

    let isMounted = true;
    const currentSessionId = sessionId;

    const fetchSession = async () => {
      // Prevent overlapping requests
      if (isPollingRef.current) return;
      isPollingRef.current = true;

      try {
        const res = await apiClient.get<AgentSessionResponse>(`/agent/sessions/${currentSessionId}`);
        // Ignore responses belonging to the previous session
        if (!isMounted || activeSessionIdRef.current !== currentSessionId) return;

        setSession(res.data);
        // Clear temporary errors after successful recovery
        if (res.data.status !== 'failed') {
          setError(null);
        } else {
          setError('Discovery search encountered an unexpected issue while querying providers.');
        }
      } catch (err: any) {
        if (!isMounted || activeSessionIdRef.current !== currentSessionId) return;
        setError(err.message || 'Error fetching search progress');
      } finally {
        isPollingRef.current = false;
      }
    };

    fetchSession();
    const interval = setInterval(fetchSession, 1500);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [sessionId, isTerminal]);

  const handleRetrySearch = async () => {
    setRetrying(true);
    setError(null);
    try {
      const res = await apiClient.post('/agent/search', {});
      navigate(`/agent/sessions/${res.data.session_id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to retry search');
      setRetrying(false);
    }
  };

  const isCompleted = session?.status === 'completed';
  const isPartial = session?.status === 'partial';
  const isFailed = session?.status === 'failed';
  const isRunning = !isTerminal;

  return (
    <div className="min-h-[85vh] bg-[#F8FAFC] py-8 sm:py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Status Card */}
        <div className="card-base rounded-2xl p-6 sm:p-7 border border-slate-200">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3.5 min-w-0">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isCompleted
                    ? 'bg-emerald-100 text-emerald-700'
                    : isPartial
                    ? 'bg-amber-100 text-amber-700'
                    : isFailed
                    ? 'bg-rose-100 text-rose-700'
                    : 'bg-brand-50 text-brand-600'
                }`}
              >
                {isCompleted && <CheckCircle2 className="w-6 h-6" />}
                {isPartial && <AlertTriangle className="w-6 h-6" />}
                {isFailed && <AlertCircle className="w-6 h-6" />}
                {isRunning && <Sparkles className="w-6 h-6 animate-spin" />}
              </div>
              <div className="min-w-0">
                <span className="text-xs font-semibold text-brand-700 block">
                  OpportunityOS Discovery
                </span>
                <h1 className="text-xl font-bold text-slate-900 truncate">
                  {isCompleted
                    ? 'Search Complete'
                    : isPartial
                    ? 'Search Completed with Partial Results'
                    : isFailed
                    ? 'Search Failed'
                    : 'Finding Opportunities...'}
                </h1>
              </div>
            </div>

            <div className="text-right font-mono text-xs text-slate-500 shrink-0">
              <div className="flex items-center space-x-1.5 justify-end">
                <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin text-brand-600' : 'text-slate-400'}`} />
                <span>{elapsedSeconds}s</span>
              </div>
              <span className="capitalize font-medium text-slate-700">{session?.status || 'Queued'}</span>
            </div>
          </div>

          {/* Completed banner */}
          {isCompleted && session?.result_summary && (
            <div className="mt-6 p-4 bg-emerald-50 border border-emerald-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-bold text-emerald-950">
                    Opportunities Discovered & Scored
                  </h3>
                  <p className="text-sm text-emerald-800 mt-0.5">
                    Found {session.result_summary.opportunity_count} opportunities aligned with your profile (top match: {session.result_summary.best_score}%).
                  </p>
                </div>
                <button
                  onClick={() => navigate('/dashboard')}
                  className="btn-primary min-h-[44px] shrink-0 text-xs px-4"
                >
                  <span>Explore Results</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* Partial search banner */}
          {isPartial && (
            <div className="mt-6 p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-amber-950 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Partial Results Available</span>
                  </h3>
                  <p className="text-sm text-amber-800">
                    Some sources were unavailable. You can still view the results we found.
                  </p>
                  {session?.result_summary && (
                    <p className="text-xs text-amber-700">
                      Discovered {session.result_summary.opportunity_count} opportunities.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate('/dashboard')}
                    className="btn-primary min-h-[44px] text-xs px-4"
                  >
                    <span>View Found Results</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleRetrySearch}
                    disabled={retrying}
                    className="btn-secondary min-h-[44px] text-xs px-3"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                    <span>Retry Search</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Failed state banner */}
          {isFailed && (
            <div className="mt-6 p-4 bg-rose-50 border border-rose-200 rounded-xl space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-rose-950 flex items-center gap-1.5">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>Search Could Not Complete</span>
                  </h3>
                  <p className="text-sm text-rose-800">
                    The opportunity search encountered an issue. Your existing profile and previous saved opportunities remain intact.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={handleRetrySearch}
                    disabled={retrying}
                    className="btn-primary min-h-[44px] text-xs px-4"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${retrying ? 'animate-spin' : ''}`} />
                    <span>{retrying ? 'Retrying...' : 'Retry Search'}</span>
                  </button>
                  <Link
                    to="/dashboard"
                    className="btn-secondary min-h-[44px] text-xs px-3"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            </div>
          )}

          {error && !isFailed && (
            <div className="mt-4 p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center space-x-2 text-rose-800 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Live Stage Timeline */}
        {session && session.stages && (
          <div className="card-base rounded-2xl p-6 border border-slate-200 space-y-4">
            <h3 className="text-sm font-bold text-slate-800">
              Search Stages
            </h3>
            <StageTimeline stages={session.stages} />
          </div>
        )}

        {/* Direct Action when complete */}
        {isCompleted && (
          <div className="flex justify-center pt-2">
            <Link
              to="/dashboard"
              className="btn-primary min-h-[44px] px-6 text-sm"
            >
              <span>Go to Your Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};
