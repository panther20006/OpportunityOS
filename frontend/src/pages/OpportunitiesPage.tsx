import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Filter,
  Sparkles,
  SlidersHorizontal,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Briefcase,
  AlertCircle,
  X,
  MapPin,
  Sliders,
  Check
} from 'lucide-react';
import { apiClient } from '../api/client';
import { OpportunityListItem, OpportunityListResponse } from '../api/types';
import { OpportunityCard } from '../components/OpportunityCard';
import { useToast } from '../context/ToastContext';

export const OpportunitiesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { showToast } = useToast();

  // Read initial filter values from URL search params
  const initialQ = searchParams.get('q') || '';
  const initialType = searchParams.get('type') || 'all';
  const initialRemote = searchParams.get('remote') === 'true';
  const initialMinScore = Number(searchParams.get('min_score')) || 0;
  const initialSort = searchParams.get('sort') || 'score';
  const initialPage = Number(searchParams.get('page')) || 1;

  const [searchTerm, setSearchTerm] = useState(initialQ);
  const [debouncedQ, setDebouncedQ] = useState(initialQ);
  const [typeFilter, setTypeFilter] = useState(initialType);
  const [remoteOnly, setRemoteOnly] = useState(initialRemote);
  const [minScore, setMinScore] = useState<number>(initialMinScore);
  const [sort, setSort] = useState(initialSort);
  const [currentPage, setCurrentPage] = useState(initialPage);

  const [mobileFilterDrawerOpen, setMobileFilterDrawerOpen] = useState(false);

  const [opportunities, setOpportunities] = useState<OpportunityListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [pageSize] = useState(12);
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state FROM searchParams when user navigates Back/Forward in browser
  useEffect(() => {
    const qParam = searchParams.get('q') || '';
    const typeParam = searchParams.get('type') || 'all';
    const remoteParam = searchParams.get('remote') === 'true';
    const minScoreParam = Number(searchParams.get('min_score')) || 0;
    const sortParam = searchParams.get('sort') || 'score';
    const pageParam = Number(searchParams.get('page')) || 1;

    setSearchTerm(qParam);
    setDebouncedQ(qParam);
    setTypeFilter(typeParam);
    setRemoteOnly(remoteParam);
    setMinScore(minScoreParam);
    setSort(sortParam);
    setCurrentPage(pageParam);
  }, [searchParams]);

  // Debounce search input (400ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      const trimmed = searchTerm.trim();
      if (trimmed !== debouncedQ) {
        setDebouncedQ(trimmed);
        setCurrentPage(1);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm, debouncedQ]);

  // Push state to URL params when filters change
  const updateUrlParams = useCallback(
    (newQ: string, newType: string, newRemote: boolean, newMinScore: number, newSort: string, newPage: number) => {
      const params = new URLSearchParams();
      if (newQ) params.set('q', newQ);
      if (newType && newType !== 'all') params.set('type', newType);
      if (newRemote) params.set('remote', 'true');
      if (newMinScore > 0) params.set('min_score', newMinScore.toString());
      if (newSort && newSort !== 'score') params.set('sort', newSort);
      if (newPage > 1) params.set('page', newPage.toString());

      setSearchParams(params, { replace: true });
    },
    [setSearchParams]
  );

  // Sync state to URL
  useEffect(() => {
    updateUrlParams(debouncedQ, typeFilter, remoteOnly, minScore, sort, currentPage);
  }, [debouncedQ, typeFilter, remoteOnly, minScore, sort, currentPage, updateUrlParams]);

  // Request race condition prevention
  const latestRequestId = useRef(0);

  const fetchOpportunities = useCallback(async () => {
    const requestId = ++latestRequestId.current;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.append('page', currentPage.toString());
      params.append('page_size', pageSize.toString());

      if (debouncedQ) params.append('q', debouncedQ);
      if (typeFilter && typeFilter !== 'all') params.append('type', typeFilter);
      if (remoteOnly) params.append('remote', 'true');
      if (minScore > 0) params.append('min_score', minScore.toString());
      if (sort) params.append('sort', sort);

      const res = await apiClient.get<OpportunityListResponse>(`/opportunities?${params.toString()}`);

      // Only update if this response corresponds to the newest request
      if (requestId === latestRequestId.current) {
        setOpportunities(res.data.items || []);
        setTotalCount(res.data.total || 0);
      }
    } catch (err: any) {
      if (requestId === latestRequestId.current) {
        setError(err.message || 'Failed to load opportunities');
      }
    } finally {
      if (requestId === latestRequestId.current) {
        setLoading(false);
      }
    }
  }, [currentPage, pageSize, debouncedQ, typeFilter, remoteOnly, minScore, sort]);

  useEffect(() => {
    fetchOpportunities();
  }, [fetchOpportunities]);

  const handleRunAgentSearch = async () => {
    setIsSearching(true);
    showToast('Starting fresh discovery scan...', 'info');
    try {
      const res = await apiClient.post('/agent/search', {});
      const sessionId = res.data.session_id;
      showToast('Discovery agent initiated!', 'success');
      navigate(`/agent/sessions/${sessionId}`);
    } catch (err: any) {
      showToast(err.message || 'Failed to start opportunity discovery', 'error');
      setIsSearching(false);
    }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const handleSavedChange = (oppId: string, saved: boolean) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, saved } : o))
    );
  };

  const handleApplicationStatusChange = (oppId: string, status: string) => {
    setOpportunities((prev) =>
      prev.map((o) => (o.id === oppId ? { ...o, application_status: status } : o))
    );
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setDebouncedQ('');
    setTypeFilter('all');
    setRemoteOnly(false);
    setMinScore(0);
    setSort('score');
    setCurrentPage(1);
    showToast('All filters cleared', 'info', 1500);
  };

  const typeOptions = [
    { id: 'all', label: 'All types' },
    { id: 'full_time', label: 'Full-time' },
    { id: 'internship', label: 'Internships' },
    { id: 'hackathon', label: 'Hackathons' },
    { id: 'grant', label: 'Grants' },
    { id: 'fellowship', label: 'Fellowships' },
  ];

  const hasDemoItems = opportunities.some((o) => o.is_demo);
  const hasActiveFilters =
    typeFilter !== 'all' || remoteOnly || minScore > 0 || debouncedQ || sort !== 'score';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Demo sample notice if present */}
      {hasDemoItems && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between gap-3 text-amber-900 text-xs">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              <strong>Sample listings:</strong> Some results below are simulated sample items for demonstration. External application is disabled on demo items.
            </span>
          </div>
        </div>
      )}

      {/* Header Bar with Single Dominant Discovery Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold text-slate-900">Discover Opportunities</h1>
          <p className="text-sm text-slate-500">
            Openings scored transparently against your profile. Scores reflect profile alignment, not hiring probability.
          </p>
        </div>

        {/* Single dominant discovery button */}
        <button
          onClick={handleRunAgentSearch}
          disabled={isSearching}
          className="btn-primary self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isSearching ? 'animate-spin' : ''}`} />
          <span>{isSearching ? 'Searching...' : 'Find opportunities'}</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-2xs space-y-4">
        {/* Search input + Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          {/* Labeled search field */}
          <div className="relative flex-1">
            <label htmlFor="opportunity-search" className="sr-only">
              Search by title, company, or skills
            </label>
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="opportunity-search"
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by title, company, or skills..."
              className="form-input pl-10 pr-9"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                aria-label="Clear search text"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Desktop Filters */}
          <div className="hidden sm:flex items-center gap-2.5">
            {/* Type Filter */}
            <div className="w-36">
              <label htmlFor="filter-type" className="sr-only">
                Filter by opportunity type
              </label>
              <select
                id="filter-type"
                value={typeFilter}
                onChange={(e) => {
                  setTypeFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-select text-xs font-semibold"
              >
                {typeOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Min Score Filter */}
            <div className="w-36">
              <label htmlFor="filter-min-score" className="sr-only">
                Filter by minimum match score
              </label>
              <select
                id="filter-min-score"
                value={minScore}
                onChange={(e) => {
                  setMinScore(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="form-select text-xs font-semibold"
              >
                <option value={0}>Any match score</option>
                <option value={50}>Match ≥ 50%</option>
                <option value={70}>Match ≥ 70%</option>
                <option value={80}>Match ≥ 80%</option>
              </select>
            </div>

            {/* Sort Control */}
            <div className="w-36">
              <label htmlFor="filter-sort" className="sr-only">
                Sort opportunities
              </label>
              <select
                id="filter-sort"
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value);
                  setCurrentPage(1);
                }}
                className="form-select text-xs font-semibold"
              >
                <option value="score">Highest match</option>
                <option value="recent">Newest first</option>
                <option value="title">Role title</option>
              </select>
            </div>

            {/* Remote Only Toggle */}
            <label className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-xl border border-slate-200 bg-white hover:bg-slate-50 cursor-pointer text-xs font-semibold text-slate-700 select-none">
              <input
                type="checkbox"
                checked={remoteOnly}
                onChange={(e) => {
                  setRemoteOnly(e.target.checked);
                  setCurrentPage(1);
                }}
                className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
              />
              <span>Remote only</span>
            </label>
          </div>

          {/* Mobile Filter Drawer Button */}
          <button
            type="button"
            onClick={() => setMobileFilterDrawerOpen(true)}
            className="sm:hidden btn-secondary"
          >
            <Sliders className="w-4 h-4" />
            <span>Filters {hasActiveFilters && '•'}</span>
          </button>
        </div>

        {/* Active Filters Pill Bar & Results Count */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-800">
              {loading ? 'Updating results...' : `${totalCount} opportunities`}
            </span>

            {debouncedQ && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-semibold">
                "{debouncedQ}"
                <button
                  onClick={() => setSearchTerm('')}
                  className="hover:text-rose-600"
                  aria-label="Remove keyword filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {typeFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-semibold capitalize">
                {typeFilter.replace('_', ' ')}
                <button
                  onClick={() => {
                    setTypeFilter('all');
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-600"
                  aria-label="Remove type filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {minScore > 0 && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-brand-50 text-brand-800 border border-brand-200 font-semibold">
                Score ≥ {minScore}%
                <button
                  onClick={() => {
                    setMinScore(0);
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-600"
                  aria-label="Remove minimum score filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}

            {remoteOnly && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-purple-50 text-purple-800 border border-purple-200 font-semibold">
                Remote only
                <button
                  onClick={() => {
                    setRemoteOnly(false);
                    setCurrentPage(1);
                  }}
                  className="hover:text-rose-600"
                  aria-label="Remove remote only filter"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs font-semibold text-brand-600 hover:text-brand-800 underline transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Main Grid Content */}
      {loading ? (
        /* Layout-matching skeleton loaders */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200 shadow-2xs space-y-4">
              <div className="space-y-2">
                <div className="h-4 w-3/4 skeleton" />
                <div className="h-3 w-1/2 skeleton" />
              </div>
              <div className="h-6 w-1/3 skeleton" />
              <div className="h-10 skeleton" />
              <div className="h-4 w-1/4 skeleton pt-2" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Failed to load opportunities</h2>
          <p className="text-xs text-rose-700">{error}</p>
          <button
            onClick={fetchOpportunities}
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Try again</span>
          </button>
        </div>
      ) : opportunities.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
            <Briefcase className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-bold text-slate-900">No matching opportunities found</h2>
            <p className="text-xs text-slate-500 leading-relaxed">
              {hasActiveFilters
                ? 'No opportunities match your current search filters. Try clearing some filters or broadening your terms.'
                : 'No opportunities are currently indexed. Click below to run a fresh discovery scan.'}
            </p>
          </div>
          <div className="pt-2 flex justify-center gap-3">
            {hasActiveFilters && (
              <button
                onClick={clearAllFilters}
                className="btn-secondary"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {opportunities.map((opp) => (
            <OpportunityCard
              key={opp.id}
              opportunity={opp}
              onSavedChange={handleSavedChange}
              onApplicationStatusChange={handleApplicationStatusChange}
            />
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 pt-5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
            disabled={currentPage === 1}
            className="btn-secondary"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .slice(Math.max(0, currentPage - 3), currentPage + 2)
              .map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 rounded-xl text-xs font-bold transition-colors ${
                    currentPage === page
                      ? 'bg-brand-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-slate-100 border border-slate-200'
                  }`}
                >
                  {page}
                </button>
              ))}
          </div>

          <button
            onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="btn-secondary"
          >
            <span>Next</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Secondary Filters Drawer on Phones */}
      {mobileFilterDrawerOpen && (
        <div className="fixed inset-0 z-50 flex sm:hidden" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileFilterDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto w-80 max-w-[85vw] bg-white h-full shadow-2xl p-5 flex flex-col justify-between z-10">
            <div className="space-y-5 overflow-y-auto">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-900">Filter Opportunities</h3>
                <button
                  onClick={() => setMobileFilterDrawerOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg"
                  aria-label="Close filters"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Opportunity Type */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Opportunity Type
                </label>
                <select
                  value={typeFilter}
                  onChange={(e) => {
                    setTypeFilter(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select text-xs font-semibold"
                >
                  {typeOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Match Score */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Minimum Match Score
                </label>
                <select
                  value={minScore}
                  onChange={(e) => {
                    setMinScore(Number(e.target.value));
                    setCurrentPage(1);
                  }}
                  className="form-select text-xs font-semibold"
                >
                  <option value={0}>Any match score</option>
                  <option value={50}>Match ≥ 50%</option>
                  <option value={70}>Match ≥ 70%</option>
                  <option value={80}>Match ≥ 80%</option>
                </select>
              </div>

              {/* Sort Order */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  Sort Order
                </label>
                <select
                  value={sort}
                  onChange={(e) => {
                    setSort(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="form-select text-xs font-semibold"
                >
                  <option value="score">Highest match</option>
                  <option value="recent">Newest first</option>
                  <option value="title">Role title</option>
                </select>
              </div>

              {/* Remote Toggle */}
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 bg-slate-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={remoteOnly}
                  onChange={(e) => {
                    setRemoteOnly(e.target.checked);
                    setCurrentPage(1);
                  }}
                  className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 border-slate-300"
                />
                <span className="text-xs font-semibold text-slate-800">Remote eligible only</span>
              </label>
            </div>

            <div className="pt-4 border-t border-slate-100 flex gap-2">
              <button
                type="button"
                onClick={clearAllFilters}
                className="flex-1 btn-secondary text-xs"
              >
                Clear all
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterDrawerOpen(false)}
                className="flex-1 btn-primary text-xs"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
