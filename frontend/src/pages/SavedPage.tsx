import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Bookmark, ArrowRight, AlertCircle, RefreshCw, Undo2, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { apiClient } from '../api/client';
import { OpportunityListItem, OpportunityListResponse } from '../api/types';
import { OpportunityCard } from '../components/OpportunityCard';
import { useToast } from '../context/ToastContext';

export const SavedPage: React.FC = () => {
  const { showToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialPage = Number(searchParams.get('page')) || 1;
  const [currentPage, setCurrentPage] = useState<number>(initialPage);
  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [pageSize] = useState<number>(12);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentlyRemoved, setRecentlyRemoved] = useState<OpportunityListItem | null>(null);

  // Sync state to URL searchParams
  const updateUrlParams = useCallback((page: number) => {
    const params = new URLSearchParams();
    if (page > 1) params.set('page', page.toString());
    setSearchParams(params, { replace: true });
  }, [setSearchParams]);

  const fetchSavedOpportunities = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.get<OpportunityListResponse>(
        `/opportunities?saved=true&page=${page}&page_size=${pageSize}`
      );
      setOpportunities(res.data.items || []);
      setTotalCount(res.data.total || 0);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved opportunities');
    } finally {
      setLoading(false);
    }
  }, [pageSize]);

  useEffect(() => {
    fetchSavedOpportunities(currentPage);
  }, [fetchSavedOpportunities, currentPage]);

  // Sync page from URL on back/forward navigation
  useEffect(() => {
    const pageParam = Number(searchParams.get('page')) || 1;
    setCurrentPage(pageParam);
  }, [searchParams]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    updateUrlParams(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSavedChange = (oppId: string, saved: boolean) => {
    if (!saved) {
      const item = opportunities.find((o) => o.id === oppId);
      if (item) {
        setRecentlyRemoved(item);
      }
      setOpportunities((prev) => prev.filter((o) => o.id !== oppId));
      setTotalCount((prev) => Math.max(0, prev - 1));
    }
  };

  const handleUndoRemove = async () => {
    if (!recentlyRemoved) return;
    try {
      await apiClient.post(`/opportunities/${recentlyRemoved.id}/save`);
      setOpportunities((prev) => [recentlyRemoved, ...prev]);
      setTotalCount((prev) => prev + 1);
      setRecentlyRemoved(null);
      showToast('Bookmark restored', 'success', 2000);
    } catch (err: any) {
      showToast(err.message || 'Could not restore bookmark', 'error');
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">Saved Opportunities</h1>
          </div>
          <p className="text-sm text-slate-500">
            Bookmarked listings and programs saved for comparison and application.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {recentlyRemoved && (
            <button
              onClick={handleUndoRemove}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl text-xs font-semibold hover:bg-amber-100 transition-colors shadow-2xs"
            >
              <Undo2 className="w-3.5 h-3.5 text-amber-700" />
              <span>Undo removal</span>
            </button>
          )}

          <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl">
            {totalCount} Saved {totalCount === 1 ? 'item' : 'items'}
          </div>
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 skeleton rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Failed to load saved items</h2>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            onClick={() => fetchSavedOpportunities(currentPage)}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      ) : totalCount === 0 ? (
        /* Empty Saved State: exact requested copy: "Save opportunities to compare them later", with a Discover link */
        <div className="bg-white rounded-2xl p-12 border border-slate-200 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
            <Bookmark className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-lg font-bold text-slate-900">
              Save opportunities to compare them later
            </h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              When browsing openings, bookmark any roles that catch your eye. They will appear here for easy comparison.
            </p>
          </div>
          <div className="pt-2">
            <Link to="/opportunities" className="btn-primary">
              <Sparkles className="w-4 h-4" />
              <span>Discover opportunities</span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {opportunities.map((opp) => (
              <OpportunityCard
                key={opp.id}
                opportunity={opp}
                onSavedChange={handleSavedChange}
              />
            ))}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 pt-5">
              <span className="text-xs text-slate-500 font-medium">
                Showing {((currentPage - 1) * pageSize) + 1}–{Math.min(currentPage * pageSize, totalCount)} of {totalCount} saved opportunities
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
    </div>
  );
};
