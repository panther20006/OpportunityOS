import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BookOpen,
  CheckCircle2,
  Circle,
  Clock,
  Sparkles,
  ExternalLink,
  Hammer,
  Send,
  AlertCircle,
  ArrowRight,
  RefreshCw,
  Undo2,
  Info,
  Check,
  History
} from 'lucide-react';
import { apiClient } from '../api/client';
import { RoadmapResponse, RoadmapStepItem, SearchHistoryResponse, SearchHistorySessionItem } from '../api/types';
import { useToast } from '../context/ToastContext';

export const RoadmapPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const currentSessionIdParam = searchParams.get('session_id') || '';

  const [roadmap, setRoadmap] = useState<RoadmapResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'learn' | 'build' | 'apply'>('all');
  const [updatingStepId, setUpdatingStepId] = useState<string | null>(null);
  const [historySessions, setHistorySessions] = useState<SearchHistorySessionItem[]>([]);

  // Fetch search history for session picker
  useEffect(() => {
    apiClient
      .get<SearchHistoryResponse>('/search/history')
      .then((res) => {
        setHistorySessions(res.data.items || []);
      })
      .catch(() => {});
  }, []);

  const fetchRoadmap = async (sessionId?: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = sessionId ? `/roadmap?session_id=${encodeURIComponent(sessionId)}` : '/roadmap';
      const res = await apiClient.get<RoadmapResponse>(url);
      setRoadmap(res.data);
    } catch (err: any) {
      setError(err.message || 'Failed to load career roadmap');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRoadmap(currentSessionIdParam || undefined);
  }, [currentSessionIdParam]);

  const toggleStepCompletion = async (step: RoadmapStepItem) => {
    if (!roadmap) return;
    setUpdatingStepId(step.id);
    const newStatus = !step.is_completed;

    try {
      await apiClient.patch(`/roadmap/steps/${step.id}`, {
        is_completed: newStatus,
      });

      const updatedSteps = roadmap.steps.map((s) =>
        s.id === step.id
          ? {
              ...s,
              is_completed: newStatus,
              completed_at: newStatus ? new Date().toISOString() : null,
            }
          : s
      );

      const completedCount = updatedSteps.filter((s) => s.is_completed).length;
      const newProgress = Math.round((completedCount / updatedSteps.length) * 100);

      setRoadmap({
        ...roadmap,
        progress_pct: newProgress,
        steps: updatedSteps,
      });

      showToast(
        newStatus
          ? `Milestone completed! Overall progress: ${newProgress}%`
          : 'Milestone reopened (Undo complete)',
        newStatus ? 'success' : 'info',
        2000
      );
    } catch (err: any) {
      showToast(err.message || 'Failed to update step progress', 'error');
    } finally {
      setUpdatingStepId(null);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-32 skeleton rounded-2xl" />
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 skeleton rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !roadmap || !roadmap.steps || roadmap.steps.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
          <BookOpen className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">No Roadmap Generated Yet</h2>
        <p className="text-slate-500 text-xs sm:text-sm max-w-md mx-auto">
          {error || 'Run an opportunity search to generate a personalized Learn → Build → Apply roadmap tailored to active skill requirements.'}
        </p>
        <Link to="/opportunities" className="btn-primary">
          Discover opportunities
        </Link>
      </div>
    );
  }

  const allSteps = roadmap.steps;
  const filteredSteps = allSteps.filter((s) => {
    if (filterType === 'all') return true;
    return s.step_type === filterType;
  });

  const totalSteps = allSteps.length;
  const completedSteps = allSteps.filter((s) => s.is_completed).length;
  const nextUnfinishedStep = allSteps.find((s) => !s.is_completed);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Session Selector Banner */}
      {historySessions.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 sm:px-5 rounded-2xl border border-slate-200/90 shadow-2xs">
          <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold">
            <History className="w-4 h-4 text-brand-600 shrink-0" />
            <span>Roadmap session:</span>
            {currentSessionIdParam ? (
              <span className="font-mono text-[11px] bg-brand-50 text-brand-700 px-2 py-0.5 rounded-md border border-brand-200 font-bold">
                Archived session #{currentSessionIdParam.substring(0, 8)}
              </span>
            ) : (
              <span className="text-[11px] bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200 font-bold">
                Active roadmap
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <select
              aria-label="Select roadmap discovery session"
              value={currentSessionIdParam}
              onChange={(e) => {
                const val = e.target.value;
                if (val) {
                  setSearchParams({ session_id: val });
                } else {
                  setSearchParams({});
                }
              }}
              className="form-select text-xs py-1.5 px-3 rounded-xl border-slate-200 font-medium bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <option value="">Latest active roadmap</option>
              {historySessions.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {s.target_role || 'General Tech'} ({new Date(s.created_at).toLocaleDateString()})
                </option>
              ))}
            </select>
            {currentSessionIdParam && (
              <button
                type="button"
                onClick={() => setSearchParams({})}
                className="text-xs text-brand-600 hover:text-brand-700 font-bold px-2 py-1 rounded hover:bg-brand-50 transition-colors"
              >
                Reset to latest
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-7 border border-slate-200/90 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full bg-brand-50 text-brand-700 text-xs font-bold border border-brand-200">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Learn → Build → Apply Sequence</span>
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {roadmap.title}
            </h1>
          </div>

          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
            {roadmap.total_weeks ? `Paced at ~${roadmap.total_weeks} weeks` : 'Self-Paced'}
          </div>
        </div>

        {roadmap.summary && (
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{roadmap.summary}</p>
        )}

        {/* Progress Bar */}
        <div className="space-y-2 pt-1">
          <div className="flex justify-between text-xs font-bold">
            <span className="text-slate-600">
              Progress: {completedSteps} of {totalSteps} milestones finished
            </span>
            <span className="text-brand-700">{roadmap.progress_pct}%</span>
          </div>
          <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-600 rounded-full transition-all duration-500"
              style={{ width: `${roadmap.progress_pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Next Unfinished Task Highlight */}
      {nextUnfinishedStep && (
        <div className="p-4 sm:p-5 bg-brand-50/70 border border-brand-200 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-brand-800 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-brand-600" />
              <span>Next up in your plan</span>
            </span>
            {nextUnfinishedStep.estimated_hours && (
              <span className="text-xs font-semibold text-brand-800">
                ~{nextUnfinishedStep.estimated_hours} hours estimated
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm sm:text-base">
            {nextUnfinishedStep.title}
          </h3>
          {nextUnfinishedStep.action && (
            <p className="text-xs text-slate-600">
              <strong>Completion criterion:</strong> {nextUnfinishedStep.action}
            </p>
          )}
        </div>
      )}

      {/* Phase Filter Tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              filterType === 'all'
                ? 'bg-white text-brand-600 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({totalSteps})
          </button>
          <button
            onClick={() => setFilterType('learn')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === 'learn'
                ? 'bg-white text-blue-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>1. Learn</span>
          </button>
          <button
            onClick={() => setFilterType('build')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === 'build'
                ? 'bg-white text-purple-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Hammer className="w-3.5 h-3.5" />
            <span>2. Build</span>
          </button>
          <button
            onClick={() => setFilterType('apply')}
            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              filterType === 'apply'
                ? 'bg-white text-emerald-700 shadow-2xs font-bold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Send className="w-3.5 h-3.5" />
            <span>3. Apply</span>
          </button>
        </div>

        <button
          onClick={() => fetchRoadmap(currentSessionIdParam || undefined)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-50 shadow-2xs transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      {/* Steps List */}
      <div className="space-y-4">
        {filteredSteps.map((step) => {
          const isDone = step.is_completed;
          const badgeClass =
            step.step_type === 'learn'
              ? 'bg-blue-50 text-blue-800 border-blue-200'
              : step.step_type === 'build'
              ? 'bg-purple-50 text-purple-800 border-purple-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200';

          return (
            <div
              key={step.id}
              className={`rounded-2xl p-5 border transition-colors flex items-start gap-4 ${
                isDone
                  ? 'bg-slate-50/70 border-slate-200 opacity-80'
                  : 'bg-white border-slate-200/90 shadow-2xs hover:border-slate-300'
              }`}
            >
              {/* Persistent, Reversible Checkbox (with 44px touch area) */}
              <button
                type="button"
                onClick={() => toggleStepCompletion(step)}
                disabled={updatingStepId === step.id}
                className="mt-0.5 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-xl hover:bg-slate-100 transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                title={isDone ? 'Mark milestone as incomplete (Undo)' : 'Mark milestone complete'}
                aria-label={isDone ? `Mark step ${step.step_order} incomplete` : `Mark step ${step.step_order} complete`}
              >
                {isDone ? (
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 fill-emerald-100" />
                ) : (
                  <Circle className="w-6 h-6 text-slate-300 hover:text-slate-500" />
                )}
              </button>

              {/* Main Step Content */}
              <div className="space-y-2.5 flex-1 min-w-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold text-slate-400">Step {step.step_order}</span>
                    <span className={`px-2.5 py-0.5 rounded-md font-semibold uppercase text-[11px] border ${badgeClass}`}>
                      {step.step_type}
                    </span>
                    {step.skill && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-semibold border border-slate-200">
                        {step.skill.name}
                      </span>
                    )}
                  </div>

                  {step.estimated_hours && (
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      ~{step.estimated_hours} hours
                    </span>
                  )}
                </div>

                <div className="flex items-start justify-between gap-3">
                  <h3
                    className={`text-base font-bold text-slate-900 leading-snug ${
                      isDone ? 'line-through text-slate-500' : ''
                    }`}
                  >
                    {step.title}
                  </h3>

                  {isDone && (
                    <button
                      type="button"
                      onClick={() => toggleStepCompletion(step)}
                      className="inline-flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded-lg transition-colors shrink-0"
                    >
                      <Undo2 className="w-3 h-3" />
                      <span>Reopen</span>
                    </button>
                  )}
                </div>

                {step.description && (
                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {step.description}
                  </p>
                )}

                {step.reason && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold">Why it matters: </span>
                    <span>{step.reason}</span>
                  </div>
                )}

                {step.action && (
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700">
                    <span className="font-bold">Concrete completion criterion: </span>
                    <span>{step.action}</span>
                  </div>
                )}

                {/* External Search Link explicitly labeled as a web search query */}
                {step.resource_query && (
                  <div className="pt-1">
                    <a
                      href={`https://www.google.com/search?q=${encodeURIComponent(step.resource_query)}`}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-800 underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      <span>Search web for learning resources (external query: "{step.resource_query}")</span>
                    </a>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
