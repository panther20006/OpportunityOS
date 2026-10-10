import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Building,
  MapPin,
  ExternalLink,
  Bookmark,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Award,
  Layers,
  BookOpen,
  DollarSign,
  Calendar,
  Share2,
  Info,
  Check
} from 'lucide-react';
import { apiClient } from '../api/client';
import { OpportunityDetailResponse } from '../api/types';
import { MatchRing } from '../components/MatchRing';
import { useToast } from '../context/ToastContext';

export const OpportunityDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [data, setData] = useState<OpportunityDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSaved, setIsSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string>('none');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    if (!id) return;
    const fetchOpportunity = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<OpportunityDetailResponse>(`/opportunities/${id}`);
        setData(res.data);
        setIsSaved(res.data.saved);
        if (res.data.application?.status) {
          setApplicationStatus(res.data.application.status);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load opportunity details');
      } finally {
        setLoading(false);
      }
    };

    fetchOpportunity();
  }, [id]);

  const toggleSave = async () => {
    if (!id) return;
    setIsSaving(true);
    const targetState = !isSaved;
    setIsSaved(targetState); // Optimistic

    try {
      if (targetState) {
        await apiClient.post(`/opportunities/${id}/save`);
        showToast('Saved to bookmarks', 'success', 2000);
      } else {
        await apiClient.delete(`/opportunities/${id}/save`);
        showToast('Removed from bookmarks', 'info', 2000);
      }
    } catch (err: any) {
      setIsSaved(!targetState); // Rollback
      showToast(err.message || 'Error updating bookmark', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!id) return;

    if (newStatus === '__remove__') {
      const previousStatus = applicationStatus;
      setStatusUpdating(true);
      setApplicationStatus('none');
      try {
        await apiClient.delete(`/applications/opportunity/${id}`);
        showToast('Removed from application tracker', 'info', 2000);
      } catch (err: any) {
        setApplicationStatus(previousStatus);
        showToast(err.message || 'Failed to remove from tracker', 'error');
      } finally {
        setStatusUpdating(false);
      }
      return;
    }

    if (newStatus === 'none') {
      return;
    }

    const previousStatus = applicationStatus;
    setStatusUpdating(true);
    setApplicationStatus(newStatus); // Optimistic

    try {
      const res = await apiClient.post('/applications', {
        opportunity_id: id,
        status: newStatus,
      });
      const confirmedStatus = res.data?.status || newStatus;
      setApplicationStatus(confirmedStatus);
      showToast(`Status updated to "${confirmedStatus}"`, 'success', 2000);
    } catch (err: any) {
      setApplicationStatus(previousStatus); // Rollback
      showToast(err.message || 'Failed to update application tracker', 'error');
    } finally {
      setStatusUpdating(false);
    }
  };

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopiedLink(true);
    showToast('Link copied to clipboard', 'info', 1500);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const isValidSafeUrl = (url?: string | null): boolean => {
    if (!url) return false;
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'http:' || parsed.protocol === 'https:';
    } catch {
      return false;
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        <div className="h-6 w-32 skeleton" />
        <div className="h-48 skeleton rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="h-64 skeleton rounded-2xl" />
          <div className="h-64 skeleton rounded-2xl" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mx-auto text-rose-600 border border-rose-200">
          <AlertCircle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">Opportunity Not Found</h2>
        <p className="text-slate-500 text-xs sm:text-sm">
          {error || 'This listing may have expired or is not reachable.'}
        </p>
        <Link to="/opportunities" className="btn-primary">
          <ArrowLeft className="w-4 h-4" />
          <span>Back to catalog</span>
        </Link>
      </div>
    );
  }

  const { opportunity, match } = data;
  const isDemo = opportunity.is_demo;
  const hasValidUrl = isValidSafeUrl(opportunity.apply_url);
  const matchScore = match?.match_score;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6 pb-24 md:pb-8">
      {/* Top Breadcrumb & Share/Save toolbar */}
      <div className="flex items-center justify-between">
        <Link
          to="/opportunities"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-brand-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to catalog</span>
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShare}
            className="btn-secondary text-xs"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span>{copiedLink ? 'Copied!' : 'Share'}</span>
          </button>

          <button
            onClick={toggleSave}
            disabled={isSaving}
            className={`btn-secondary text-xs ${
              isSaved ? 'bg-amber-50 border-amber-300 text-amber-800' : ''
            }`}
          >
            <Bookmark className={`w-3.5 h-3.5 ${isSaved ? 'fill-amber-500 text-amber-500' : 'text-slate-400'}`} />
            <span>{isSaved ? 'Saved' : 'Save'}</span>
          </button>
        </div>
      </div>

      {/* Demo Mode Notice */}
      {isDemo && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-3 text-amber-900 text-xs">
          <Sparkles className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="font-bold">Demo sample listing</p>
            <p className="text-amber-800">
              This is a simulated opportunity fixture for platform evaluation. Direct external application is disabled on sample items.
            </p>
          </div>
        </div>
      )}

      {/* Role Summary & Primary Action Card */}
      <div className="bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-2xs space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2.5 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-700 font-semibold border border-brand-200 capitalize">
                {opportunity.opportunity_type?.replace(/_/g, ' ')}
              </span>
              {opportunity.is_remote && (
                <span className="px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-700 font-semibold border border-purple-200">
                  Remote eligible
                </span>
              )}
              {opportunity.source_via && (
                <span className="text-slate-400 font-medium">via {opportunity.source_via}</span>
              )}
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight leading-snug">
              {opportunity.title}
            </h1>

            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-600 font-medium">
              <div className="flex items-center gap-1.5">
                <Building className="w-4 h-4 text-slate-400" />
                <span>{opportunity.company_name || 'Company not specified'}</span>
              </div>
              {opportunity.location && (
                <div className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span>{opportunity.location}</span>
                </div>
              )}
              {opportunity.salary_text && (
                <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                  <DollarSign className="w-4 h-4 text-slate-400" />
                  <span>{opportunity.salary_text}</span>
                </div>
              )}
              {opportunity.posted_at_text && (
                <div className="flex items-center gap-1.5 text-slate-500">
                  <Calendar className="w-4 h-4 text-slate-400" />
                  <span>{opportunity.posted_at_text}</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Action & Alignment Score */}
          <div className="flex sm:flex-col items-center sm:items-end justify-between gap-4 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-100 shrink-0">
            <div className="flex items-center gap-3">
              <div className="text-right hidden sm:block">
                <div className="text-xs uppercase font-bold text-slate-600 tracking-wider">
                  Profile Alignment
                </div>
                <div className="text-[11px] text-slate-400">Deterministic Score</div>
              </div>
              <MatchRing score={matchScore} size="lg" lowConfidence={match?.low_confidence} />
            </div>

            {/* Quick Status Dropdown & Apply Action */}
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={applicationStatus}
                onChange={(e) => handleStatusChange(e.target.value)}
                disabled={statusUpdating}
                className="form-select text-xs font-semibold py-2 w-auto"
                title="Track application status"
              >
                {applicationStatus === 'none' ? (
                  <option value="none">Status: Not tracked</option>
                ) : null}
                <option value="planned">Status: Planned</option>
                <option value="applied">Status: Applied</option>
                <option value="interviewing">Status: Interviewing</option>
                <option value="offer">Status: Offer received</option>
                <option value="rejected">Status: Rejected</option>
                <option value="withdrawn">Status: Withdrawn</option>
                {applicationStatus !== 'none' && (
                  <option value="__remove__">✕ Remove from tracker</option>
                )}
              </select>

              {isDemo ? (
                <button
                  disabled
                  className="btn-primary opacity-60 cursor-not-allowed text-xs"
                  title="Direct external applying is disabled for demo sample listings"
                >
                  <span>Apply on source website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </button>
              ) : hasValidUrl ? (
                <a
                  href={opportunity.apply_url!}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn-primary text-xs"
                >
                  <span>Apply on source website</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <span className="text-xs text-slate-400 italic">No external link provided</span>
              )}
            </div>
          </div>
        </div>

        {/* Informative notice on match scoring */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-start gap-2 text-xs text-slate-600">
          <Info className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
          <span>
            <strong>Match score notice:</strong> Match scores describe profile alignment against extracted role requirements. They represent mathematical fit, not hiring probability. Opening the external apply link does not automatically mark this application as submitted.
          </span>
        </div>
      </div>

      {/* Two Column Grid: Breakdown (Left) & Description/Highlights (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Match Details & Skills (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Match Breakdown Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-brand-600" />
              <span>Score Breakdown</span>
            </h3>

            {match?.breakdown?.components ? (
              <div className="space-y-3">
                {match.breakdown.components.map((comp) => {
                  const titleMap: Record<string, string> = {
                    skills: 'Skills Match (50%)',
                    role: 'Role Alignment (15%)',
                    location: 'Location Match (15%)',
                    experience: 'Experience Level (10%)',
                    type: 'Opportunity Type (10%)',
                  };
                  return (
                    <div key={comp.key} className="space-y-1">
                      <div className="flex justify-between text-xs font-semibold">
                        <span className="text-slate-700 capitalize">{titleMap[comp.key] || comp.key}</span>
                        <span className="text-slate-900 font-bold">
                          {comp.points.toFixed(1)} / {(comp.weight * 100).toFixed(0)} pts
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-brand-600 rounded-full transition-all duration-500"
                          style={{ width: `${comp.score * 100}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                Match score has not been calculated for this opening yet.
              </p>
            )}
          </div>

          {/* Skill Compatibility Card */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
            <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
              <Award className="w-4 h-4 text-indigo-600" />
              <span>Skill Compatibility</span>
            </h3>

            {/* Matched Skills */}
            <div className="space-y-2">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider block">
                Matched Skills ({match?.matched_skills?.length || 0})
              </span>
              {match?.matched_skills && match.matched_skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {match.matched_skills.map((skill) => (
                    <span
                      key={skill.id || skill.name}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-semibold"
                    >
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>{skill.name}</span>
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-400 italic">No skills matched directly from profile</p>
              )}
            </div>

            {/* Skills to Develop */}
            <div className="space-y-2 pt-3 border-t border-slate-100">
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                Skills to Develop ({match?.missing_skills?.length || 0})
              </span>
              {match?.missing_skills && match.missing_skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {match.missing_skills.map((skill) => (
                    <span
                      key={skill.id || skill.name}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 text-slate-800 border border-slate-200 rounded-lg text-xs font-semibold"
                    >
                      <span>{skill.name}</span>
                      {skill.requirement && (
                        <span className="text-[10px] text-slate-500 bg-slate-200 px-1 rounded uppercase font-bold">
                          {skill.requirement}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-emerald-700 font-semibold">You possess all extracted skills for this posting!</p>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Highlights & Full Description (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Highlights */}
          {opportunity.highlights && opportunity.highlights.length > 0 && (
            <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-4">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <Layers className="w-4 h-4 text-brand-600" />
                <span>Key Role Highlights</span>
              </h3>

              <div className="space-y-3">
                {opportunity.highlights.map((hl, idx) => (
                  <div key={idx} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200 space-y-1.5">
                    <h4 className="text-xs font-bold uppercase text-slate-700">{hl.title}</h4>
                    <ul className="space-y-1 text-xs text-slate-600">
                      {hl.items.map((item, i) => (
                        <li key={i} className="flex items-start gap-1.5">
                          <span className="text-brand-600 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Description */}
          <div className="bg-white rounded-2xl p-5 sm:p-6 border border-slate-200/90 shadow-2xs space-y-3">
            <h3 className="font-bold text-slate-900 text-base">Full Description</h3>
            {opportunity.description ? (
              <div className="text-sm text-slate-700 leading-relaxed whitespace-pre-line font-normal">
                {opportunity.description}
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">No extended description provided by source.</p>
            )}
          </div>

          {/* Source Provenance */}
          <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 text-xs text-slate-500 space-y-2">
            <span className="font-bold text-slate-700 block">Verification & Source Details</span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <span className="text-slate-400 block">Engine:</span>
                <span className="font-semibold text-slate-800">{opportunity.source_engine}</span>
              </div>
              <div>
                <span className="text-slate-400 block">Source:</span>
                <span className="font-semibold text-slate-800">{opportunity.source_via || 'Direct'}</span>
              </div>
              <div>
                <span className="text-slate-400 block">First indexed:</span>
                <span className="font-semibold text-slate-800">
                  {opportunity.first_seen_at ? new Date(opportunity.first_seen_at).toLocaleDateString() : 'Recent'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
