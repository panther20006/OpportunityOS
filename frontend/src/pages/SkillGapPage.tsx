import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  TrendingUp,
  AlertCircle,
  ArrowRight,
  Sparkles,
  BookOpen,
  CheckCircle2,
  Filter,
  Info
} from 'lucide-react';
import { apiClient } from '../api/client';
import { SkillGapItem, SkillGapResponse } from '../api/types';
import { useToast } from '../context/ToastContext';

export const SkillGapPage: React.FC = () => {
  const { showToast } = useToast();
  const [gaps, setGaps] = useState<SkillGapItem[]>([]);
  const [sampleTotal, setSampleTotal] = useState<number>(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    const fetchSkillGaps = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiClient.get<SkillGapResponse>('/skill-gap');
        const items = res.data.items || [];
        setGaps(items);
        if (res.data.top_n) {
          setSampleTotal(res.data.top_n);
        } else if (items.length > 0 && items[0].opportunity_ids) {
          setSampleTotal(Math.max(...items.map((i) => i.opportunity_ids?.length || 0), 10));
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load skill gap analysis');
      } finally {
        setLoading(false);
      }
    };

    fetchSkillGaps();
  }, []);

  const filteredGaps = gaps.filter((g) => {
    if (priorityFilter === 'all') return true;
    return g.priority === priorityFilter;
  });

  const highPriorityCount = gaps.filter((g) => g.priority === 'high').length;
  const maxUplift = gaps.length > 0 ? Math.max(...gaps.map((g) => g.avg_uplift)) : 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-600" />
            <h1 className="text-2xl font-bold text-slate-900">Skill Gaps & Demand</h1>
          </div>
          <p className="text-sm text-slate-500">
            Identify which missing skills appear most frequently across your role's active openings.
          </p>
        </div>

        <Link to="/roadmap" className="btn-primary text-xs self-start sm:self-auto">
          <BookOpen className="w-3.5 h-3.5" />
          <span>View learning roadmap</span>
        </Link>
      </div>

      {/* Practical Advice Alert for Students & Freshers */}
      <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex items-start gap-3 text-xs text-slate-700">
        <Info className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-slate-900">Practical guidance for student applicants:</p>
          <p className="text-slate-600 leading-relaxed">
            You do <strong>not</strong> need to meet 100% of listed skills to apply. Job listings often reflect an employer's ideal wishlist. Meeting 60–70% of core requirements makes you competitive for entry-level roles and internships.
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-xs font-semibold uppercase text-slate-500 tracking-wider">
            Identified Gaps
          </span>
          <div className="text-2xl font-black text-slate-900">{gaps.length} Skills</div>
          <p className="text-xs text-slate-400">Extracted from active catalog results</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-xs font-semibold uppercase text-rose-700 tracking-wider">
            High Priority Gaps
          </span>
          <div className="text-2xl font-black text-rose-700">{highPriorityCount} Skills</div>
          <p className="text-xs text-slate-400">Appear across multiple top openings</p>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-1">
          <span className="text-xs font-semibold uppercase text-emerald-700 tracking-wider">
            Max Potential Uplift
          </span>
          <div className="text-2xl font-black text-emerald-700">+{maxUplift.toFixed(1)}%</div>
          <p className="text-xs text-slate-400">Estimated profile alignment boost</p>
        </div>
      </div>

      {/* Priority Filter Bar */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-3">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
          <Filter className="w-4 h-4 text-slate-400" />
          <span>Priority level:</span>
        </div>

        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(['all', 'high', 'medium', 'low'] as const).map((pri) => (
            <button
              key={pri}
              onClick={() => setPriorityFilter(pri)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                priorityFilter === pri
                  ? 'bg-white text-slate-900 shadow-2xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {pri}
            </button>
          ))}
        </div>
      </div>

      {/* Gaps List */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 skeleton rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center space-y-3">
          <AlertCircle className="w-7 h-7 text-rose-600 mx-auto" />
          <h2 className="text-base font-bold text-rose-900">Failed to load skill gaps</h2>
          <p className="text-xs text-rose-700">{error}</p>
        </div>
      ) : filteredGaps.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 border border-slate-200 text-center space-y-2 shadow-2xs">
          <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
          <h2 className="text-base font-bold text-slate-900">No skill gaps in this category</h2>
          <p className="text-xs text-slate-500">
            Your profile satisfies the extracted requirements in this priority bucket.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredGaps.map((item) => {
            const percentage = Math.round(
              item.demand_pct > 1 ? item.demand_pct : item.demand_pct * 100
            );

            return (
              <div
                key={item.skill.id || item.skill.name}
                className="bg-white rounded-2xl p-5 border border-slate-200/90 shadow-2xs space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="w-7 h-7 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center">
                      #{item.rank}
                    </span>
                    <h3 className="text-base font-bold text-slate-900">{item.skill.name}</h3>

                    <span
                      className={`px-2.5 py-0.5 rounded-lg text-xs font-semibold capitalize border ${
                        item.priority === 'high'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : item.priority === 'medium'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : 'bg-slate-100 text-slate-700 border-slate-200'
                      }`}
                    >
                      {item.priority} priority
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs">
                    <div>
                      <span className="text-slate-400">Est. Uplift:</span>{' '}
                      <span className="font-bold text-emerald-700">+{item.avg_uplift.toFixed(1)}%</span>
                    </div>
                    <Link
                      to="/roadmap"
                      className="inline-flex items-center gap-1 font-semibold text-brand-600 hover:text-brand-800"
                    >
                      <span>Plan in roadmap</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Demand Sample Statement */}
                <div className="text-xs text-slate-600">
                  {item.demand_count > 0 ? (
                    <span>
                      Appears in <strong>{item.demand_count}</strong> active matching openings (requested in {percentage}% of evaluated listings).
                    </span>
                  ) : (
                    <span>Evaluated from target role frequency analysis.</span>
                  )}
                </div>

                {/* Demand Bar */}
                <div className="space-y-1">
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        item.priority === 'high'
                          ? 'bg-rose-500'
                          : item.priority === 'medium'
                          ? 'bg-amber-500'
                          : 'bg-brand-500'
                      }`}
                      style={{ width: `${Math.max(6, Math.min(100, percentage))}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>Low demand</span>
                    <span>High demand</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
