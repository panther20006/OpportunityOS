import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bookmark,
  MapPin,
  Building,
  Calculator,
  ArrowRight,
  DollarSign,
  Calendar,
  Sparkles,
  Info,
  Check,
  Plus
} from 'lucide-react';
import { OpportunityListItem, MatchDetail } from '../api/types';
import { MatchRing } from './MatchRing';
import { MatchBreakdownModal } from './MatchBreakdownModal';
import { apiClient } from '../api/client';
import { useToast } from '../context/ToastContext';

interface OpportunityCardProps {
  opportunity: OpportunityListItem;
  onSavedChange?: (oppId: string, saved: boolean) => void;
  onApplicationStatusChange?: (oppId: string, newStatus: string) => void;
}

export const OpportunityCard: React.FC<OpportunityCardProps> = ({
  opportunity,
  onSavedChange,
  onApplicationStatusChange,
}) => {
  const { showToast } = useToast();
  const [isSaved, setIsSaved] = useState(opportunity.saved);
  const [isSaving, setIsSaving] = useState(false);
  const [breakdownModalOpen, setBreakdownModalOpen] = useState(false);
  const [matchDetail, setMatchDetail] = useState<MatchDetail | null>(null);
  const [appStatus, setAppStatus] = useState<string>(opportunity.application_status || 'none');
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const toggleSave = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsSaving(true);
    const targetState = !isSaved;

    // Optimistic update
    setIsSaved(targetState);

    try {
      if (targetState) {
        await apiClient.post(`/opportunities/${opportunity.id}/save`);
        showToast('Opportunity saved to bookmarks', 'success', 2000);
        onSavedChange?.(opportunity.id, true);
      } else {
        await apiClient.delete(`/opportunities/${opportunity.id}/save`);
        showToast('Removed from saved bookmarks', 'info', 2000);
        onSavedChange?.(opportunity.id, false);
      }
    } catch (err: any) {
      // Revert optimistic update
      setIsSaved(!targetState);
      showToast(err.message || 'Could not update bookmark', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleOpenBreakdown = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (opportunity.match_score === null || opportunity.match_score === undefined) {
      showToast('Match score has not been calculated yet. Run discovery to evaluate profile alignment.', 'info');
      return;
    }
    try {
      const res = await apiClient.get(`/opportunities/${opportunity.id}`);
      setMatchDetail(res.data.match);
      setBreakdownModalOpen(true);
    } catch (err) {
      showToast('Failed to load score breakdown', 'error');
    }
  };

  const handleQuickStatusChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value;
    if (newStatus === appStatus) return;

    if (newStatus === '__remove__') {
      const previousStatus = appStatus;
      setUpdatingStatus(true);
      setAppStatus('none');
      try {
        await apiClient.delete(`/applications/opportunity/${opportunity.id}`);
        showToast('Removed from application tracker', 'info', 2000);
        onApplicationStatusChange?.(opportunity.id, 'none');
      } catch (err: any) {
        setAppStatus(previousStatus);
        showToast(err.message || 'Failed to remove from tracker', 'error');
      } finally {
        setUpdatingStatus(false);
      }
      return;
    }

    if (newStatus === 'none') {
      // Do not silently convert an existing application into planned
      return;
    }

    const previousStatus = appStatus;
    setUpdatingStatus(true);
    setAppStatus(newStatus); // Optimistic

    try {
      // Send only changed status field, preserving notes and dates
      const res = await apiClient.post('/applications', {
        opportunity_id: opportunity.id,
        status: newStatus,
      });
      const confirmedStatus = res.data?.status || newStatus;
      setAppStatus(confirmedStatus);
      showToast(`Application status updated to "${confirmedStatus}"`, 'success', 2000);
      onApplicationStatusChange?.(opportunity.id, confirmedStatus);
    } catch (err: any) {
      // Revert optimistic update on failure
      setAppStatus(previousStatus);
      showToast(err.message || 'Failed to update application tracker', 'error');
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Matched skills and skills to develop from top_skills
  const matchedSkills = (opportunity.top_skills || []).filter((s) => s.has);
  const skillsToDevelop = (opportunity.top_skills || []).filter((s) => !s.has);

  const typeFormatted = opportunity.opportunity_type?.replace(/_/g, ' ') || 'Opportunity';

  return (
    <>
      <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors flex flex-col justify-between relative">
        <div className="space-y-3.5">
          {/* 1. Role title and company; allow titles to wrap to two lines */}
          <div>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                {opportunity.is_demo && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-bold bg-amber-50 text-amber-900 border border-amber-200 mb-1.5">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    <span>Demo sample</span>
                  </span>
                )}
                <Link to={`/opportunities/${opportunity.id}`} className="group block">
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 group-hover:text-brand-600 transition-colors line-clamp-2 leading-snug">
                    {opportunity.title}
                  </h3>
                </Link>
                <div className="flex items-center gap-1.5 text-sm font-semibold text-slate-700 mt-1">
                  <Building className="w-4 h-4 text-slate-400 shrink-0" />
                  <span>{opportunity.company_name || 'Company not specified'}</span>
                </div>
              </div>

              {/* Compact Match Ring in top right */}
              <div className="shrink-0 flex flex-col items-center">
                <MatchRing
                  score={opportunity.match_score}
                  size="md"
                  lowConfidence={opportunity.low_confidence}
                />
              </div>
            </div>
          </div>

          {/* 2. Location, work mode, and opportunity type when known */}
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-semibold capitalize border border-slate-200">
              {typeFormatted}
            </span>

            {opportunity.is_remote && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                Remote
              </span>
            )}

            {opportunity.location ? (
              <span className="inline-flex items-center gap-1 text-slate-600">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                <span>{opportunity.location}</span>
              </span>
            ) : null}

            {/* Salary only when explicitly supplied by source */}
            {opportunity.salary_text ? (
              <span className="inline-flex items-center gap-1 text-slate-700 font-semibold">
                <DollarSign className="w-3.5 h-3.5 text-slate-400" />
                <span>{opportunity.salary_text}</span>
              </span>
            ) : null}
          </div>

          {/* 3. Match score and a readable explanation */}
          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
            {opportunity.match_score !== null && opportunity.match_score !== undefined ? (
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-slate-700">
                  {opportunity.match_score >= 70 ? 'Strong profile fit' : 'Profile alignment'}
                </span>
                <span className="text-slate-400">•</span>
                <button
                  onClick={handleOpenBreakdown}
                  className="inline-flex items-center gap-1 text-brand-600 hover:text-brand-800 font-semibold"
                >
                  <Calculator className="w-3.5 h-3.5" />
                  <span>Why this score?</span>
                </button>
              </div>
            ) : (
              <span className="text-slate-400 text-xs">Match not calculated yet</span>
            )}
          </div>

          {/* 4. A few matched skills and skills to develop */}
          <div className="space-y-1.5 pt-1">
            {opportunity.top_skills && opportunity.top_skills.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {matchedSkills.slice(0, 3).map((s, idx) => (
                  <span
                    key={`matched-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200"
                    title="Skill you have"
                  >
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>{s.name}</span>
                  </span>
                ))}
                {skillsToDevelop.slice(0, 3).map((s, idx) => (
                  <span
                    key={`develop-${idx}`}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 border border-slate-200"
                    title="Skill to develop"
                  >
                    <span className="text-slate-400 text-[11px] font-bold">+</span>
                    <span>{s.name}</span>
                  </span>
                ))}
                {opportunity.top_skills.length > 6 && (
                  <span className="text-xs text-slate-400 font-medium self-center pl-1">
                    +{opportunity.top_skills.length - 6} more
                  </span>
                )}
              </div>
            ) : (
              <span className="text-xs text-slate-400 italic">Skills indexed during discovery</span>
            )}
          </div>
        </div>

        {/* 5. Posting/source information and View details / Save actions */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* Metadata source / date */}
          <div className="text-xs text-slate-400 font-medium">
            {opportunity.source_via ? (
              <span>via {opportunity.source_via}</span>
            ) : opportunity.posted_at_text ? (
              <span>{opportunity.posted_at_text}</span>
            ) : (
              <span>{opportunity.source_engine || 'Catalog'}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Quick-status dropdown (comfortable touch control, updates existing application) */}
            <select
              value={appStatus}
              onChange={handleQuickStatusChange}
              disabled={updatingStatus}
              className={`text-xs font-semibold px-2.5 py-2 min-h-[40px] rounded-xl border cursor-pointer focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors ${
                appStatus === 'none'
                  ? 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300'
                  : 'bg-brand-50 border-brand-200 text-brand-700 font-bold'
              }`}
              title="Track application status"
              aria-label="Application tracker status"
            >
              {appStatus === 'none' ? (
                <option value="none">+ Track</option>
              ) : null}
              <option value="planned">Planned</option>
              <option value="applied">Applied</option>
              <option value="interviewing">Interviewing</option>
              <option value="offer">Offer</option>
              <option value="rejected">Rejected</option>
              <option value="withdrawn">Withdrawn</option>
              {appStatus !== 'none' && (
                <option value="__remove__">✕ Remove from tracker</option>
              )}
            </select>

            {/* Bookmark button (44px min touch target) */}
            <button
              onClick={toggleSave}
              disabled={isSaving}
              className={`p-2.5 min-w-[40px] min-h-[40px] rounded-xl border flex items-center justify-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
                isSaved
                  ? 'bg-amber-50 border-amber-300 text-amber-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-50'
              }`}
              title={isSaved ? 'Saved to bookmarks' : 'Save to bookmarks'}
              aria-label={isSaved ? 'Saved' : 'Save bookmark'}
            >
              <Bookmark className={`w-4 h-4 ${isSaved ? 'fill-amber-500 text-amber-500' : ''}`} />
            </button>

            {/* View Details Link (44px min touch target) */}
            <Link
              to={`/opportunities/${opportunity.id}`}
              className="inline-flex items-center gap-1 px-3.5 py-2 min-h-[40px] bg-slate-900 hover:bg-brand-600 text-white rounded-xl text-xs font-semibold shadow-2xs transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
            >
              <span>View</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* Breakdown Modal */}
      {matchDetail && (
        <MatchBreakdownModal
          isOpen={breakdownModalOpen}
          onClose={() => setBreakdownModalOpen(false)}
          match={matchDetail}
          jobTitle={opportunity.title}
          companyName={opportunity.company_name}
        />
      )}
    </>
  );
};
