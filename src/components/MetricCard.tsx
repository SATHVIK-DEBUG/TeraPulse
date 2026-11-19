import React from 'react';

interface MetricCardProps {
  label: string;
  value: string;
  unit?: string;
  deltaText?: string;
  deltaTone?: 'neutral' | 'positive' | 'warning' | 'danger';
  observationDate: string;
  source: string;
  quality: string;
  loading?: boolean;
}

export function MetricCard({
  label,
  value,
  unit,
  deltaText,
  deltaTone = 'neutral',
  observationDate,
  source,
  quality,
  loading = false,
}: MetricCardProps) {
  const deltaColor =
    deltaTone === 'positive'
      ? 'text-emerald-400'
      : deltaTone === 'warning'
      ? 'text-amber-400'
      : deltaTone === 'danger'
      ? 'text-rose-400'
      : 'text-[#8FA39B]';

  return (
    <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4 flex flex-col justify-between min-h-[144px]">
      <div>
        <p className="text-xs font-medium text-[#8FA39B]">{label}</p>
        {loading ? (
          <div className="mt-3 h-8 w-28 rounded bg-[#1D2A24] animate-pulse" />
        ) : (
          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-2xl font-mono font-semibold tabular-nums text-[#ECF3F0]">
              {value}
            </span>
            {unit && (
              <span className="text-xs font-mono text-[#7C938A]">{unit}</span>
            )}
          </div>
        )}
        {!loading && deltaText && (
          <p className={`mt-1.5 text-xs font-mono tabular-nums ${deltaColor}`}>
            {deltaText}
          </p>
        )}
      </div>

      <div className="mt-4 pt-3 border-t border-[#1E2B25] text-[11px] text-[#788E85] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-mono tabular-nums">
        <span>{observationDate}</span>
        <span aria-hidden="true">·</span>
        <span>{source}</span>
        <span aria-hidden="true">·</span>
        <span>{quality}</span>
      </div>
    </div>
  );
}

interface NotConnectedMetricCardProps {
  label: string;
  provider: string;
  stage: string;
  reason: string;
  onAction?: () => void;
}

export function NotConnectedMetricCard({
  label,
  provider,
  stage,
  reason,
  onAction,
}: NotConnectedMetricCardProps) {
  return (
    <div className="bg-[#101714] border border-dashed border-[#2A3B33] rounded-lg p-4 flex flex-col justify-between min-h-[144px]">
      <div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-[#8FA39B]">{label}</p>
          <span className="text-[11px] font-mono text-[#7C938A]">{stage}</span>
        </div>
        <p className="mt-2.5 text-base font-medium text-[#9BB0A8]">Not Connected</p>
        <p className="mt-1 text-xs text-[#6F857C] leading-relaxed">{reason}</p>
      </div>

      <div className="mt-3 pt-3 border-t border-[#1D2923] flex items-center justify-between gap-2 text-[11px] font-mono text-[#6F857C]">
        <span className="truncate">{provider}</span>
        {onAction && (
          <button
            type="button"
            onClick={onAction}
            className="text-cyan-400 hover:text-cyan-300 transition-colors whitespace-nowrap shrink-0"
          >
            Setup Details
          </button>
        )}
      </div>
    </div>
  );
}
