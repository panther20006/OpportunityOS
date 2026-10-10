import React from 'react';
import { CheckCircle2, Loader2, AlertTriangle, Circle } from 'lucide-react';
import { StageDetail } from '../api/types';

interface StageTimelineProps {
  stages: StageDetail[];
}

export const StageTimeline: React.FC<StageTimelineProps> = ({ stages }) => {
  const stageLabels: Record<string, { title: string; desc: string }> = {
    plan_queries: {
      title: 'Preparing your search',
      desc: 'Formulating search strategies tailored to your target role and preferences',
    },
    search: {
      title: 'Finding opportunities',
      desc: 'Scanning active job boards and career announcements',
    },
    normalize_dedupe: {
      title: 'Organizing listings',
      desc: 'Standardizing formats and filtering duplicate postings',
    },
    extract_skills: {
      title: 'Extracting skill requirements',
      desc: 'Analyzing job descriptions and identifying key required technologies',
    },
    match: {
      title: 'Comparing your skills',
      desc: 'Calculating transparent profile alignment across skills, role, and location',
    },
    skill_gap: {
      title: 'Analyzing high-demand skills',
      desc: 'Identifying which skills appear most frequently across matched opportunities',
    },
    roadmap: {
      title: 'Preparing next steps',
      desc: 'Assembling a step-by-step Learn → Build → Apply plan for your target role',
    },
  };

  return (
    <div className="space-y-3">
      {stages.map((stage, idx) => {
        const info = stageLabels[stage.key] || { title: stage.key, desc: '' };
        const isDone = stage.status === 'done';
        const isRunning = stage.status === 'running';
        const isWarn = stage.status === 'warn';
        const isFailed = stage.status === 'failed';

        return (
          <div
            key={stage.key}
            className={`p-4 rounded-xl border transition-colors ${
              isRunning
                ? 'bg-brand-50/70 border-brand-300 shadow-2xs'
                : isDone
                ? 'bg-white border-slate-200'
                : 'bg-slate-50/60 border-slate-100 opacity-70'
            }`}
          >
            <div className="flex items-start gap-3">
              {/* Status Icon */}
              <div className="mt-0.5 shrink-0">
                {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-600" />}
                {isRunning && <Loader2 className="w-5 h-5 text-brand-600 animate-spin" />}
                {isWarn && <AlertTriangle className="w-5 h-5 text-amber-500" />}
                {isFailed && <AlertTriangle className="w-5 h-5 text-rose-500" />}
                {!isDone && !isRunning && !isWarn && !isFailed && (
                  <Circle className="w-5 h-5 text-slate-300" />
                )}
              </div>

              {/* Title & Description */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4
                    className={`font-semibold text-sm ${
                      isRunning ? 'text-brand-900 font-bold' : isDone ? 'text-slate-900' : 'text-slate-500'
                    }`}
                  >
                    {idx + 1}. {info.title}
                  </h4>
                  {stage.duration_ms && (
                    <span className="text-xs text-slate-400 font-mono shrink-0">
                      {stage.duration_ms}ms
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-0.5">{info.desc}</p>

                {/* Actual detail if present from backend */}
                {stage.detail && (
                  <div className="mt-2 text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-slate-700">
                    {stage.key === 'plan_queries' && stage.detail.queries && (
                      <div className="space-y-1">
                        <span className="font-semibold text-slate-800">Generated Search Queries:</span>
                        <ul className="space-y-0.5 text-xs text-slate-600">
                          {stage.detail.queries.map((q: any, qIdx: number) => (
                            <li key={qIdx} className="truncate">
                              • <span className="font-semibold text-brand-600">{q.engine}:</span> "{q.q}"
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {stage.key === 'search' && (
                      <p>
                        Executed {stage.detail.completed || 0} of {stage.detail.total || 0} planned queries
                      </p>
                    )}
                    {stage.key === 'normalize_dedupe' && stage.detail.unique_count !== undefined && (
                      <p>Found {stage.detail.unique_count} distinct opportunities</p>
                    )}
                    {stage.key === 'match' && stage.detail.best_score !== undefined && (
                      <p>Scored {stage.detail.matches_count} listings · Highest Match: {stage.detail.best_score}%</p>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
