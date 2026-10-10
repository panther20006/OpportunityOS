import React from 'react';

interface MatchRingProps {
  score?: number | null;
  size?: 'sm' | 'md' | 'lg';
  lowConfidence?: boolean;
}

export const MatchRing: React.FC<MatchRingProps> = ({ score, size = 'md', lowConfidence = false }) => {
  const radius = size === 'sm' ? 16 : size === 'lg' ? 36 : 24;
  const strokeWidth = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;
  const circumference = 2 * Math.PI * radius;
  const dimension = (radius + strokeWidth) * 2;

  if (score === null || score === undefined) {
    return (
      <div
        className="relative inline-flex items-center justify-center shrink-0"
        title="Match not calculated. Scores describe profile alignment, not hiring probability."
        aria-label="Match not calculated"
      >
        <svg width={dimension} height={dimension} className="transform -rotate-90">
          <circle
            cx={dimension / 2}
            cy={dimension / 2}
            r={radius}
            className="stroke-slate-200"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center px-1">
          <span
            className={`font-bold text-slate-400 ${
              size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-xs font-semibold' : 'text-xs'
            }`}
          >
            {size === 'lg' ? 'Not scored' : '—'}
          </span>
        </div>
      </div>
    );
  }

  const strokeDashoffset = circumference - (score / 100) * circumference;

  let colorClass = 'text-rose-600';
  let bgStroke = 'stroke-rose-100';
  if (score >= 75) {
    colorClass = 'text-emerald-600';
    bgStroke = 'stroke-emerald-100';
  } else if (score >= 50) {
    colorClass = 'text-amber-600';
    bgStroke = 'stroke-amber-100';
  }

  return (
    <div
      className="relative inline-flex items-center justify-center shrink-0"
      title={`Profile alignment: ${score}%. Measures profile alignment, not hiring probability.`}
      aria-label={`Match score: ${score} percent`}
    >
      <svg width={dimension} height={dimension} className="transform -rotate-90">
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          className={bgStroke}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <circle
          cx={dimension / 2}
          cy={dimension / 2}
          r={radius}
          className={`${colorClass} transition-all duration-500 ease-out`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          fill="transparent"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className={`font-black ${
            size === 'sm' ? 'text-xs' : size === 'lg' ? 'text-xl' : 'text-sm'
          } ${score >= 75 ? 'text-emerald-700' : score >= 50 ? 'text-amber-700' : 'text-rose-700'}`}
        >
          {score}%
        </span>
      </div>
      {lowConfidence && size !== 'sm' && (
        <span
          title="Skills not listed in original posting — score is estimated"
          className="absolute -bottom-1 text-[10px] bg-amber-100 text-amber-900 px-1 py-0.2 rounded font-semibold border border-amber-300"
        >
          est
        </span>
      )}
    </div>
  );
};
