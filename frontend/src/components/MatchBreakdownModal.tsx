import React, { useEffect, useRef } from 'react';
import { X, CheckCircle2, XCircle, Info, Calculator, Sparkles } from 'lucide-react';
import { MatchDetail } from '../api/types';
import { MatchRing } from './MatchRing';

interface MatchBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: MatchDetail;
  jobTitle: string;
  companyName?: string | null;
}

export const MatchBreakdownModal: React.FC<MatchBreakdownModalProps> = ({
  isOpen,
  onClose,
  match,
  jobTitle,
  companyName,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const triggerElementRef = useRef<HTMLElement | null>(null);

  // Focus trap, background scroll locking, focus restoration & Escape dismissal
  useEffect(() => {
    if (!isOpen) return;

    triggerElementRef.current = document.activeElement as HTMLElement | null;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus close button initially
    const timer = setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;
        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = originalOverflow;
      triggerElementRef.current?.focus?.();
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pillarDescriptions: Record<string, string> = {
    skills: 'Coverage of required skills (1.0x) and preferred skills (0.5x) extracted from the posting.',
    role: 'Keyword and semantic alignment between your target role and the posting title.',
    location: 'Proximity to your preferred city/state or remote compatibility.',
    experience: 'Student, fresher, or entry-level suitability versus your profile.',
    type: 'Alignment with your preferred opportunity types (internship, full-time, etc.).',
  };

  const components = match.breakdown?.components || [];
  const totalPoints = components.reduce((sum, c) => sum + (c.points || 0), 0);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="breakdown-modal-title"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        ref={modalRef}
        className="relative w-full max-w-2xl bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col z-10"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-slate-200 flex items-start justify-between bg-slate-50">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-brand-600 text-xs font-bold uppercase tracking-wider">
              <Calculator className="w-4 h-4" />
              <span>How your match score works</span>
            </div>
            <h2 id="breakdown-modal-title" className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {jobTitle}
            </h2>
            {companyName && <p className="text-xs sm:text-sm text-slate-500 font-medium">{companyName}</p>}
          </div>
          <button
            ref={closeButtonRef}
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl hover:bg-slate-200/60 transition-colors"
            aria-label="Close match breakdown"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-6">
          {/* Top Score Banner */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-4">
              <MatchRing score={match.match_score} size="lg" lowConfidence={match.low_confidence} />
              <div className="space-y-1">
                <h3 className="font-bold text-slate-900 text-base">Profile Alignment Score</h3>
                <p className="text-xs text-slate-600 leading-relaxed max-w-sm">
                  Deterministic mathematical score based on your profile. Scores describe alignment with role requirements, not hiring probability.
                </p>
                {match.low_confidence && (
                  <p className="text-xs text-amber-800 bg-amber-50 px-2.5 py-0.5 rounded-lg border border-amber-200 inline-block font-medium">
                    Skills not explicitly specified in listing — score is estimated.
                  </p>
                )}
              </div>
            </div>
            {components.length > 0 && (
              <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-200">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Weighted Total</span>
                <p className="text-xl font-black text-slate-900">{totalPoints.toFixed(1)} pts</p>
              </div>
            )}
          </div>

          {/* 5 Pillars Table */}
          {components.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <span>5-Pillar Score Components</span>
                <Info className="w-3.5 h-3.5 text-slate-400" />
              </h4>
              <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden bg-white">
                {components.map((comp) => (
                  <div key={comp.key} className="p-3.5 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-4">
                    <div className="space-y-0.5 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900 capitalize">
                          {comp.key === 'role' ? 'Target Role' : comp.key}
                        </span>
                        <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-lg font-mono">
                          {(comp.weight * 100).toFixed(0)}% weight
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        {pillarDescriptions[comp.key] || 'Pillar alignment calculation'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-sm font-bold text-slate-900">{comp.points.toFixed(1)} pts</span>
                      <p className="text-xs text-slate-400 font-mono">
                        {(comp.score * 100).toFixed(0)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-500">
              Detailed pillar breakdown components are being indexed for this opening.
            </div>
          )}

          {/* Skills Breakdown */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Matched Skills */}
            <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-emerald-900 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Matched Skills ({match.matched_skills?.length || 0})</span>
              </div>
              {match.matched_skills && match.matched_skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {match.matched_skills.map((s) => (
                    <span
                      key={s.id || s.name}
                      className="px-2.5 py-1 bg-white text-emerald-800 text-xs font-semibold rounded-lg border border-emerald-200 shadow-2xs flex items-center gap-1"
                    >
                      <span className="font-bold">✓</span>
                      <span>{s.name}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No listed skills matched directly from your current profile.</p>
              )}
            </div>

            {/* Skills to Develop (Encouraging wording, distinguish required vs preferred) */}
            <div className="p-4 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-2.5">
              <div className="flex items-center gap-1.5 text-amber-900 font-bold text-xs uppercase tracking-wider">
                <Sparkles className="w-4 h-4 text-amber-600" />
                <span>Skills to develop ({match.missing_skills?.length || 0})</span>
              </div>
              {match.missing_skills && match.missing_skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {match.missing_skills.map((s) => (
                    <span
                      key={s.id || s.name}
                      className="px-2.5 py-1 bg-white text-amber-900 text-xs font-semibold rounded-lg border border-amber-200 shadow-2xs flex items-center gap-1.5"
                    >
                      <span>{s.name}</span>
                      {s.requirement && (
                        <span className="text-[10px] text-amber-700 bg-amber-100 px-1 rounded uppercase font-bold">
                          {s.requirement}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 font-semibold">You meet 100% of the extracted skills for this posting!</p>
              )}
              <p className="text-[11px] text-amber-800 leading-tight">
                Missing preferred skills do not mean you should postpone applying. Job listings reflect ideal wishlists.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2.5 min-h-[44px] bg-slate-900 text-white rounded-xl text-xs sm:text-sm font-semibold hover:bg-slate-800 transition-colors"
          >
            Close Breakdown
          </button>
        </div>
      </div>
    </div>
  );
};
