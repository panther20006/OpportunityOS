import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import {
  Briefcase,
  Building,
  Plus,
  Trash2,
  Edit3,
  Calendar,
  X,
  AlertCircle,
  Kanban,
  List,
  ArrowRight,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  AlertTriangle
} from 'lucide-react';
import { apiClient } from '../api/client';
import { ApplicationItem, ApplicationListResponse } from '../api/types';
import { useToast } from '../context/ToastContext';

type AppStatus = 'all' | 'planned' | 'applied' | 'interviewing' | 'offer' | 'rejected' | 'withdrawn';

const STATUS_COLUMNS = [
  { id: 'planned', label: 'Planned' },
  { id: 'applied', label: 'Applied' },
  { id: 'interviewing', label: 'Interviewing' },
  { id: 'offer', label: 'Offer Received' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'withdrawn', label: 'Withdrawn' },
] as const;

export const ApplicationsPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialStatus = (searchParams.get('status') as AppStatus) || 'all';
  const initialPage = Number(searchParams.get('page')) || 1;
  const [activeStatusFilter, setActiveStatusFilter] = useState<AppStatus>(initialStatus);
  const [currentPage, setCurrentPage] = useState<number>(initialPage);

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(20);
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({
    total: 0,
    planned: 0,
    applied: 0,
    interviewing: 0,
    offer: 0,
    rejected: 0,
    withdrawn: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'kanban' | 'list'>('kanban');

  // Edit record modal state
  const [editingApp, setEditingApp] = useState<ApplicationItem | null>(null);
  const [notesInput, setNotesInput] = useState('');
  const [appliedOnInput, setAppliedOnInput] = useState('');
  const [statusInput, setStatusInput] = useState<string>('applied');
  const [savingEdit, setSavingEdit] = useState(false);

  // Deletion confirmation modal
  const [deletingAppId, setDeletingAppId] = useState<string | null>(null);

  // Focus restoration refs
  const editTriggerRef = useRef<HTMLButtonElement | null>(null);
  const editModalRef = useRef<HTMLDivElement | null>(null);

  // Sync state to URL params
  const updateUrlParams = useCallback((status: AppStatus, page: number) => {
    const params = new URLSearchParams();
    if (status !== 'all') params.set('status', status);
    if (page > 1) params.set('page', page.toString());
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  // Fetch Authoritative Application Counts
  const fetchCounts = useCallback(async () => {
    try {
      const res = await apiClient.get('/applications/counts');
      if (res.data) {
        setStatusCounts(res.data);
      }
    } catch {}
  }, []);

  // Fetch paginated applications (filtered server-side)
  const fetchApplications = useCallback(async (status: AppStatus, page: number) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.append('page', page.toString());
      // In Kanban view, fetch up to 100 to populate columns; in List view, use pageSize
      params.append('page_size', viewMode === 'kanban' ? '100' : pageSize.toString());
      if (status !== 'all') {
        params.append('status', status);
      }

      const res = await apiClient.get<ApplicationListResponse>(`/applications?${params.toString()}`);
      setApplications(res.data.items || []);
      setTotalCount(res.data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load applications');
    } finally {
      setLoading(false);
    }
  }, [viewMode, pageSize]);

  // Load applications & counts
  useEffect(() => {
    fetchCounts();
    fetchApplications(activeStatusFilter, currentPage);
  }, [fetchCounts, fetchApplications, activeStatusFilter, currentPage]);

  // Sync filter and page from searchParams on back/forward
  useEffect(() => {
    const statusParam = (searchParams.get('status') as AppStatus) || 'all';
    const pageParam = Number(searchParams.get('page')) || 1;
    setActiveStatusFilter(statusParam);
    setCurrentPage(pageParam);
  }, [searchParams]);

  // Modal accessibility: background scroll lock and Escape key listener
  useEffect(() => {
    const isModalOpen = Boolean(editingApp || deletingAppId);
    if (isModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (editingApp) setEditingApp(null);
        if (deletingAppId) setDeletingAppId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [editingApp, deletingAppId]);

  const handleStatusFilterChange = (newStatus: AppStatus) => {
    setActiveStatusFilter(newStatus);
    setCurrentPage(1);
    updateUrlParams(newStatus, 1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateUrlParams(activeStatusFilter, newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleStatusChange = async (appId: string, newStatus: string) => {
    try {
      const res = await apiClient.put(`/applications/${appId}`, {
        status: newStatus,
      });

      setApplications((prev) =>
        prev.map((a) =>
          a.id === appId
            ? { ...a, status: res.data?.status || newStatus, updated_at: new Date().toISOString() }
            : a
        )
      );
      showToast(`Status updated to "${newStatus}"`, 'success', 2000);
      fetchCounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to update application status', 'error');
    }
  };

  const handleMoveStep = async (app: ApplicationItem, direction: 'next' | 'prev') => {
    const statuses: Array<ApplicationItem['status']> = ['planned', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'];
    const currentIndex = statuses.indexOf(app.status);
    if (currentIndex === -1) return;

    const nextIndex = direction === 'next' ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex >= 0 && nextIndex < statuses.length) {
      await handleStatusChange(app.id, statuses[nextIndex]);
    }
  };

  const handleOpenEdit = (app: ApplicationItem, e: React.MouseEvent<HTMLButtonElement>) => {
    editTriggerRef.current = e.currentTarget;
    setEditingApp(app);
    setNotesInput(app.notes || '');
    setAppliedOnInput(app.applied_on || '');
    setStatusInput(app.status);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingApp) return;

    setSavingEdit(true);
    try {
      // Send explicit null to clear date intentionally when input is empty
      const updatedDate = appliedOnInput.trim() ? appliedOnInput.trim() : null;
      const res = await apiClient.put(`/applications/${editingApp.id}`, {
        notes: notesInput,
        applied_on: updatedDate,
        status: statusInput,
      });

      const serverApp = res.data;
      setApplications((prev) =>
        prev.map((a) =>
          a.id === editingApp.id
            ? {
                ...a,
                notes: serverApp.notes ?? notesInput,
                applied_on: serverApp.applied_on ?? updatedDate,
                status: serverApp.status ?? (statusInput as any),
                updated_at: serverApp.updated_at || new Date().toISOString(),
              }
            : a
        )
      );
      setEditingApp(null);
      editTriggerRef.current?.focus();
      showToast('Application record updated successfully', 'success', 2000);
      fetchCounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to update application', 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingAppId) return;
    try {
      await apiClient.delete(`/applications/${deletingAppId}`);
      setApplications((prev) => prev.filter((a) => a.id !== deletingAppId));
      setDeletingAppId(null);
      showToast('Application removed from tracker', 'info', 2000);
      fetchCounts();
    } catch (err: any) {
      showToast(err.message || 'Failed to remove application', 'error');
    }
  };

  const countByStatus = (status: AppStatus) => {
    if (status === 'all') return statusCounts.total || 0;
    return statusCounts[status] || 0;
  };

  const statusBadgeMap: Record<string, string> = {
    planned: 'bg-slate-100 text-slate-700 border-slate-200',
    applied: 'bg-blue-50 text-blue-700 border-blue-200',
    interviewing: 'bg-purple-50 text-purple-700 border-purple-200',
    offer: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rejected: 'bg-rose-50 text-rose-700 border-rose-200',
    withdrawn: 'bg-slate-100 text-slate-500 border-slate-200',
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Applications</h1>
          <p className="text-sm text-slate-500">
            Track your application lifecycle, interview rounds, and notes across all stages.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* View Switcher */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'kanban'
                  ? 'bg-white text-brand-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Kanban className="w-3.5 h-3.5" />
              <span>Board</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                viewMode === 'list'
                  ? 'bg-white text-brand-600 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>

          <Link to="/opportunities" className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />
            <span>Find opportunities</span>
          </Link>
        </div>
      </div>

      {/* Status Filter Tabs (including Withdrawn) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {(['all', 'planned', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn'] as const).map(
          (statusKey) => (
            <button
              key={statusKey}
              onClick={() => handleStatusFilterChange(statusKey)}
              className={`px-3.5 py-2 min-h-[40px] rounded-xl text-xs font-semibold capitalize whitespace-nowrap transition-colors flex items-center gap-2 border ${
                activeStatusFilter === statusKey
                  ? 'bg-brand-50 border-brand-300 text-brand-700 font-bold shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              <span>{statusKey === 'all' ? 'All Applications' : statusKey}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                  activeStatusFilter === statusKey
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
              >
                {countByStatus(statusKey)}
              </span>
            </button>
          )
        )}
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 skeleton rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Failed to load applications</h2>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            onClick={() => fetchApplications(activeStatusFilter, currentPage)}
            className="btn-primary text-xs"
          >
            Try again
          </button>
        </div>
      ) : statusCounts.total === 0 ? (
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-4 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-lg font-bold text-slate-900">No applications tracked yet</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              When exploring opportunities, track roles you are preparing for or have applied to. Manage notes, interview stages, and status updates all in one place.
            </p>
          </div>
          <div className="pt-2">
            <Link to="/opportunities" className="btn-primary">
              <Sparkles className="w-4 h-4" />
              <span>Discover opportunities</span>
            </Link>
          </div>
        </div>
      ) : applications.length === 0 ? (
        <div className="bg-white rounded-2xl p-8 border border-slate-200 text-center space-y-2 shadow-2xs">
          <p className="text-sm font-semibold text-slate-700">
            No applications currently in the "{activeStatusFilter}" status.
          </p>
          <button
            onClick={() => handleStatusFilterChange('all')}
            className="text-xs font-bold text-brand-600 hover:text-brand-800"
          >
            Show all applications
          </button>
        </div>
      ) : viewMode === 'kanban' ? (
        /* Kanban View with Accurate Authoritative Header Counts */
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 overflow-x-auto pb-4">
          {STATUS_COLUMNS.map((col) => {
            const colApps = applications.filter((a) => a.status === col.id);
            const authoritativeCount = statusCounts[col.id] || 0;

            return (
              <div
                key={col.id}
                className="bg-slate-50 rounded-2xl p-3.5 border border-slate-200/90 flex flex-col min-h-[460px]"
              >
                <div className="flex items-center justify-between px-1 mb-3">
                  <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                    {col.label}
                  </span>
                  <span className="w-5 h-5 rounded-full bg-white text-slate-700 text-xs font-bold flex items-center justify-center border border-slate-200" title="Total in this status">
                    {authoritativeCount}
                  </span>
                </div>

                <div className="space-y-3 flex-1">
                  {colApps.map((app) => {
                    const opp = app.opportunity;

                    return (
                      <div
                        key={app.id}
                        className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs space-y-2.5"
                      >
                        <div>
                          <h3 className="text-xs font-bold text-slate-900 line-clamp-2 hover:text-brand-600 leading-snug">
                            {opp ? (
                              <Link to={`/opportunities/${opp.id}`}>{opp.title}</Link>
                            ) : (
                              'Opportunity'
                            )}
                          </h3>
                          <div className="text-xs text-slate-500 font-medium flex items-center gap-1 mt-1">
                            <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">{opp?.company_name || 'Organization'}</span>
                          </div>
                        </div>

                        {opp?.match_score != null && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-brand-50 text-brand-700 text-[11px] font-bold">
                            {opp.match_score}% match
                          </span>
                        )}

                        {app.applied_on && (
                          <div className="flex items-center gap-1 text-[11px] text-slate-500">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            <span>Applied: {app.applied_on}</span>
                          </div>
                        )}

                        {app.notes && (
                          <p className="text-xs text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 line-clamp-2">
                            {app.notes}
                          </p>
                        )}

                        {/* Card Controls */}
                        <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-slate-400">
                          <button
                            onClick={(e) => handleOpenEdit(app, e)}
                            className="p-1 hover:text-slate-800 rounded-md transition-colors"
                            title="Edit notes & date"
                            aria-label="Edit notes and date"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>

                          <div className="flex items-center gap-1">
                            {col.id !== 'planned' && (
                              <button
                                onClick={() => handleMoveStep(app, 'prev')}
                                className="p-1 hover:text-slate-800 rounded-md transition-colors"
                                title="Move to previous stage"
                                aria-label="Move to previous stage"
                              >
                                <ArrowLeft className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {col.id !== 'withdrawn' && (
                              <button
                                onClick={() => handleMoveStep(app, 'next')}
                                className="p-1 hover:text-slate-800 rounded-md transition-colors"
                                title="Advance stage"
                                aria-label="Advance stage"
                              >
                                <ArrowRight className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => setDeletingAppId(app.id)}
                              className="p-1 hover:text-rose-600 rounded-md transition-colors"
                              title="Remove application"
                              aria-label="Remove application"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {colApps.length === 0 && (
                    <div className="h-28 flex items-center justify-center border border-dashed border-slate-200 rounded-xl text-xs text-slate-400 font-medium">
                      No applications
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View with Full Pagination */
        <div className="space-y-4">
          <div className="space-y-3">
            {applications.map((app) => {
              const opp = app.opportunity;

              return (
                <div
                  key={app.id}
                  className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold capitalize border ${
                          statusBadgeMap[app.status] || 'bg-slate-100 text-slate-700'
                        }`}
                      >
                        {app.status}
                      </span>
                      {opp?.match_score != null && (
                        <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-brand-50 text-brand-700">
                          {opp.match_score}% match
                        </span>
                      )}
                      {app.applied_on && (
                        <span className="text-xs text-slate-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          <span>Applied {app.applied_on}</span>
                        </span>
                      )}
                    </div>

                    <h3 className="text-sm sm:text-base font-bold text-slate-900 truncate">
                      {opp ? (
                        <Link
                          to={`/opportunities/${opp.id}`}
                          className="hover:text-brand-600 transition-colors"
                        >
                          {opp.title}
                        </Link>
                      ) : (
                        'Opportunity'
                      )}
                    </h3>

                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{opp?.company_name || 'Company not specified'}</span>
                      {app.notes && (
                        <>
                          <span>•</span>
                          <span className="truncate italic text-slate-600 max-w-sm">
                            "{app.notes}"
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      onClick={(e) => handleOpenEdit(app, e)}
                      className="px-3 py-1.5 min-h-[40px] rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>

                    <button
                      onClick={() => setDeletingAppId(app.id)}
                      className="p-2 min-h-[40px] min-w-[40px] rounded-xl border border-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-400 transition-colors flex items-center justify-center"
                      title="Remove from tracker"
                      aria-label="Remove from tracker"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* List View Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-xs text-slate-500 font-medium">
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} applications
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Previous</span>
                </button>

                <span className="text-xs font-bold text-slate-700 px-2">
                  {currentPage} / {totalPages}
                </span>

                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 min-h-[38px] rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-slate-50 transition-colors flex items-center gap-1"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Edit Record Modal with Scroll Lock and Escape handling */}
      {editingApp && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-app-title"
        >
          <div
            ref={editModalRef}
            className="bg-white rounded-2xl p-6 sm:p-7 max-w-md w-full shadow-xl border border-slate-200 space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 id="edit-app-title" className="font-bold text-slate-900 text-base">Edit Application</h3>
              <button
                onClick={() => setEditingApp(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg"
                aria-label="Close edit modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={statusInput}
                  onChange={(e) => setStatusInput(e.target.value)}
                  className="form-select text-xs font-semibold"
                >
                  <option value="planned">Planned</option>
                  <option value="applied">Applied</option>
                  <option value="interviewing">Interviewing</option>
                  <option value="offer">Offer received</option>
                  <option value="rejected">Rejected</option>
                  <option value="withdrawn">Withdrawn</option>
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold uppercase text-slate-700">
                    Application date
                  </label>
                  {appliedOnInput && (
                    <button
                      type="button"
                      onClick={() => setAppliedOnInput('')}
                      className="text-xs text-rose-600 hover:text-rose-800 font-semibold"
                    >
                      Clear date
                    </button>
                  )}
                </div>
                <input
                  type="date"
                  value={appliedOnInput}
                  onChange={(e) => setAppliedOnInput(e.target.value)}
                  className="form-input text-xs"
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Leave blank or click "Clear date" to remove the tracked application date.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Notes & follow-ups
                </label>
                <textarea
                  rows={4}
                  value={notesInput}
                  onChange={(e) => setNotesInput(e.target.value)}
                  placeholder="Notes on recruiters, interview questions, or next follow-up dates..."
                  className="form-input text-xs"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingApp(null)}
                  className="btn-secondary text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="btn-primary text-xs"
                >
                  {savingEdit ? 'Saving...' : 'Save changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Permanent Removal */}
      {deletingAppId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
        >
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 id="confirm-delete-title" className="font-bold text-slate-900 text-base">Remove this application?</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                This will remove the application from your tracker. You can always re-track this role from the discovery catalog later.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingAppId(null)}
                className="flex-1 btn-secondary text-xs"
              >
                Keep
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex-1 px-4 py-2.5 min-h-[44px] bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
