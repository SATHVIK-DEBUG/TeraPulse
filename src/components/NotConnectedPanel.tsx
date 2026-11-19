import { ArrowRight, Lock, Satellite } from 'lucide-react';
import React from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';

interface NotConnectedPanelProps {
  title: string;
  providerName: string;
  providerUrl: string;
  stageLabel: string;
  description: string;
  requiredEnvVars: string[];
  scientificSpecs: Array<{ label: string; value: string }>;
}

export function NotConnectedPanel({
  title,
  providerName,
  providerUrl,
  stageLabel,
  description,
  requiredEnvVars,
  scientificSpecs,
}: NotConnectedPanelProps) {
  const { setActiveSection } = useTerraPulse();

  return (
    <section className="bg-[#111916] border border-dashed border-[#2B3D35] rounded-lg p-5 lg:p-6">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-mono text-[#8FA39B]">
            <Satellite className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>{stageLabel}</span>
            <span aria-hidden="true">·</span>
            <span>Not Connected</span>
          </div>
          <h3 className="mt-2 text-lg font-semibold text-[#ECF3F0]">{title}</h3>
          <p className="mt-1.5 text-sm text-[#9BB0A8] leading-relaxed">{description}</p>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('sources')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#2B3D35] bg-[#16211C] hover:bg-[#1C2A24] text-xs font-medium text-[#ECF3F0] transition-colors whitespace-nowrap shrink-0 self-start"
        >
          <span>View Data Sources</span>
          <ArrowRight className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-5 border-t border-[#1E2B25]">
        {scientificSpecs.map((spec) => (
          <div key={spec.label}>
            <p className="text-[11px] font-mono text-[#6F857C]">{spec.label}</p>
            <p className="mt-1 text-xs font-mono text-[#DCE8E3]">{spec.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 pt-4 border-t border-[#1E2B25] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#7D948B]">
        <div className="flex items-center gap-2 flex-wrap">
          <Lock className="w-3.5 h-3.5 text-[#647A71] shrink-0" />
          <span>Provider:</span>
          <a
            href={providerUrl}
            target="_blank"
            rel="noreferrer"
            className="text-cyan-400 hover:underline"
          >
            {providerName}
          </a>
          {requiredEnvVars.length > 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span>Server env:</span>
              <span className="font-mono text-[#B7C9C2]">{requiredEnvVars.join(', ')}</span>
            </>
          )}
        </div>
        <span className="font-mono text-[11px] text-[#647A71]">
          Strict live mode — zero synthetic measurements displayed
        </span>
      </div>
    </section>
  );
}
