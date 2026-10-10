import React from 'react';
import { SkillGapItem } from '../api/types';

interface GapBarProps {
  item: SkillGapItem;
  totalEvaluated?: number;
}

export const GapBar: React.FC<GapBarProps> = ({ item, totalEvaluated }) => {
  // Gracefully handle both 0.0-1.0 and 0-100 formats
  const percentage = Math.round(item.demand_pct > 1 ? item.demand_pct : item.demand_pct * 100);

  let badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  let barColor = 'bg-rose-500';
  if (item.priority === 'medium') {
    badgeColor = 'bg-amber-50 text-amber-800 border-amber-200';
    barColor = 'bg-amber-500';
  } else if (item.priority === 'low') {
    badgeColor = 'bg-slate-100 text-slate-700 border-slate-200';
    barColor = 'bg-slate-400';
  }

  const sampleText = totalEvaluated
    ? `In ${item.demand_count} of top ${totalEvaluated} matches`
    : `In ${item.demand_count} active matches`;

  return (
    <div className="bg-white rounded-xl p-3.5 sm:p-4 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <span className="flex items-center justify-center w-6 h-6 rounded-lg bg-slate-100 text-xs font-bold text-slate-700">
            #{item.rank}
          </span>
          <span className="font-bold text-slate-900 text-sm sm:text-base">{item.skill.name}</span>
          <span className={`text-[11px] font-semibold uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}>
            {item.priority}
          </span>
        </div>
        <div className="text-right">
          <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
            +{item.avg_uplift.toFixed(1)}% est. uplift
          </span>
        </div>
      </div>

      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>{sampleText}</span>
          <span className="font-semibold text-slate-700">{percentage}% of evaluated listings</span>
        </div>
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full ${barColor} rounded-full transition-all duration-500`}
            style={{ width: `${Math.max(6, Math.min(100, percentage))}%` }}
          />
        </div>
      </div>
    </div>
  );
};
