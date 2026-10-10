import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  History,
  Search,
  Database,
  Calendar,
  Clock,
  Sparkles,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SearchHistoryResponse, SearchHistorySessionItem } from '../api/types';

export const HistoryPage: React.FC = () => {
  const [history, setHistory] = useState<SearchHistorySessionItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<SearchHistoryResponse>('/search/history');
        const items = res.data.items || [];
        setHistory(items);
        setTotalCount(res.data.total || items.length);
        if (items.length > 0) {
          setExpandedSessionId(items[0].session_id);
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load search history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  const toggleExpand = (sessionId: string) => {
    setExpandedSessionId((prev) => (prev === sessionId ? null : sessionId));
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">Search history</h1>
          </div>
          <p className="text-sm text-slate-500">
            Inspect previous discovery scans, executed queries, cache hits, and response times.
          </p>
        </div>

        <div className="text-xs font-semibold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl self-start sm:self-auto">
          {totalCount} Sessions Logged
        </div>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Failed to load search history</h2>
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      ) : history.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-3 shadow-2xs">
          <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center mx-auto text-slate-400">
            <History className="w-6 h-6" />
          </div>
          <div className="max-w-md mx-auto space-y-1">
            <h2 className="text-base font-bold text-slate-900">No discovery sessions yet</h2>
            <p className="text-xs text-slate-500">
              When you search for opportunities, the executed queries and results summary will appear here.
            </p>
          </div>
          <div className="pt-2">
            <Link to="/opportunities" className="btn-primary">
              Find opportunities
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((session) => {
            const isExpanded = expandedSessionId === session.session_id;

            return (
              <div
                key={session.session_id}
                className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden"
              >
                {/* Session Header Card */}
                <div
                  onClick={() => toggleExpand(session.session_id)}
                  className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/70 transition-colors"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2 py-0.5 rounded-md border border-brand-200">
                        Session #{session.session_id.substring(0, 8)}
                      </span>
                      <span
                        className={`text-[11px] font-bold uppercase px-2 py-0.5 rounded-md ${
                          session.status === 'completed'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-amber-50 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {session.status}
                      </span>
                    </div>

                    <h3 className="text-base font-bold text-slate-900">
                      Target role: {session.target_role || 'General Tech'}
                    </h3>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        <span>{new Date(session.created_at).toLocaleString()}</span>
                      </div>
                      <div>
                        Found: <strong className="text-slate-800">{session.opportunity_count}</strong> roles
                      </div>
                      <div>
                        Top Match: <strong className="text-emerald-700">{session.best_score}%</strong>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-end md:self-auto">
                    <Link
                      to={`/roadmap?session_id=${session.session_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="btn-secondary text-xs inline-flex items-center gap-1.5"
                    >
                      <Sparkles className="w-3.5 h-3.5 text-brand-600" />
                      <span>Roadmap</span>
                    </Link>

                    <Link
                      to={`/agent/sessions/${session.session_id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="btn-secondary text-xs"
                    >
                      <span>Pipeline view</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>

                    <button
                      className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
                      aria-label={isExpanded ? 'Collapse session details' : 'Expand session details'}
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Expanded Query Logs Table */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-5 space-y-3">
                    <div className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Executed queries ({session.queries?.length || 0})
                    </div>

                    {session.queries && session.queries.length > 0 ? (
                      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-slate-600 border-b border-slate-200 font-semibold uppercase text-[11px]">
                            <tr>
                              <th className="py-2.5 px-4">Engine</th>
                              <th className="py-2.5 px-4">Query</th>
                              <th className="py-2.5 px-4">Location</th>
                              <th className="py-2.5 px-4">Results</th>
                              <th className="py-2.5 px-4">Status</th>
                              <th className="py-2.5 px-4">Latency</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 font-medium">
                            {session.queries.map((q, qIdx) => (
                              <tr key={qIdx} className="hover:bg-slate-50">
                                <td className="py-2.5 px-4 font-mono font-bold text-slate-700">
                                  {q.engine}
                                </td>
                                <td className="py-2.5 px-4 text-slate-900 font-semibold">
                                  "{q.query}"
                                </td>
                                <td className="py-2.5 px-4 text-slate-600">
                                  {q.location || 'Any'}
                                </td>
                                <td className="py-2.5 px-4 font-bold text-slate-800">
                                  {q.result_count} items
                                </td>
                                <td className="py-2.5 px-4">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                                      q.cached
                                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                        : 'bg-blue-50 text-blue-800 border border-blue-200'
                                    }`}
                                  >
                                    {q.cached ? 'Cached' : 'Live'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-4 text-slate-500 font-mono">
                                  {q.latency_ms ? `${q.latency_ms} ms` : '—'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 italic">No query logs recorded for this session.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
