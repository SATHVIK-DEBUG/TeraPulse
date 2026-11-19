import { AlertTriangle, CheckCircle2, Info, ShieldAlert, Sliders } from 'lucide-react';
import React from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';
import type { RiskLevel } from '../shared/types';

function riskBadgeStyle(level: RiskLevel): string {
  switch (level) {
    case 'High':
      return 'text-rose-300 border-rose-500/40 bg-rose-950/30';
    case 'Elevated':
      return 'text-orange-300 border-orange-500/40 bg-orange-950/30';
    case 'Watch':
      return 'text-amber-300 border-amber-500/40 bg-amber-950/30';
    default:
      return 'text-emerald-300 border-emerald-500/35 bg-emerald-950/25';
  }
}

const MULTISOURCE_PATTERNS = [
  {
    code: 'Pattern A',
    title: 'Potential Vegetation Stress',
    criteria: 'Significant Sentinel-2 NDVI decline + unusually warm LST/TS + lower-than-normal rainfall.',
    stageStatus: 'Partial Screening Active (NASA POWER thermal & rainfall active; NDVI pending Stage 3)',
  },
  {
    code: 'Pattern B',
    title: 'Potential Surface Disruption / Excess Water',
    criteria: 'Unusually high cumulative rainfall + significant recent changes in optical/surface conditions.',
    stageStatus: 'Partial Screening Active (NASA POWER precipitation active; surface reflectance pending Stage 3)',
  },
  {
    code: 'Pattern C',
    title: 'Potential Long-Term Vegetation Degradation',
    criteria: 'Persistent NDVI decline across multiple consecutive seasons after seasonal baseline normalization.',
    stageStatus: 'Not Active (Requires multi-season Sentinel-2 archive in Stage 3–5)',
  },
];

export function RiskDetectionPage() {
  const { activeRegion, telemetry, telemetryLoading, setActiveSection } = useTerraPulse();
  const risk = telemetry?.risk;
  const stats = telemetry?.statistics;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Explainable Deterministic Engine · {activeRegion?.name ?? 'Loading'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Risk Detection</h1>
          <p className="mt-1 text-xs text-[#9BB0A8] max-w-2xl">
            Deterministic weather-anomaly screening powered by live NASA POWER observations against
            configured thresholds. Missing satellite indicators proportionally reduce confidence
            rather than defaulting to Normal.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setActiveSection('settings')}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md border border-[#23322B] bg-[#141D19] hover:bg-[#1A2621] text-xs font-medium text-[#ECF3F0] transition-colors whitespace-nowrap self-start"
        >
          <Sliders className="w-3.5 h-3.5 text-emerald-400" />
          <span>Configure Thresholds</span>
        </button>
      </div>

      {/* Risk Summary Band */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
          <p className="text-xs text-[#8FA39B]">Current Screened Category</p>
          <div className="mt-2.5">
            {risk && !telemetryLoading ? (
              <span
                className={`inline-block text-sm font-mono font-semibold px-3 py-1 rounded border ${riskBadgeStyle(
                  risk.status
                )}`}
              >
                {risk.status}
              </span>
            ) : (
              <div className="h-7 w-24 rounded bg-[#1E2A25] animate-pulse" />
            )}
          </div>
          <p className="mt-3 text-[11px] font-mono text-[#7C938A]">
            Deterministic threshold classification
          </p>
        </div>

        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
          <p className="text-xs text-[#8FA39B]">Normalized Anomaly Score</p>
          <p className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[#ECF3F0]">
            {risk ? `${risk.anomalyScore}` : '—'}
            <span className="text-xs text-[#7C938A] ml-1">/ 100</span>
          </p>
          <p className="mt-2.5 text-[11px] font-mono text-[#7C938A]">
            Weighted over active indicators only
          </p>
        </div>

        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
          <p className="text-xs text-[#8FA39B]">Evidence Confidence</p>
          <p className="mt-2 text-2xl font-mono font-semibold tabular-nums text-amber-300">
            {risk ? `${risk.confidenceScorePct}%` : '—'}
            <span className="text-xs text-[#7C938A] ml-1.5">{risk?.confidenceLabel ?? ''}</span>
          </p>
          <p className="mt-2.5 text-[11px] font-mono text-[#7C938A]">
            Capped ≤50% until Stage 3–4 satellites connect
          </p>
        </div>

        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
          <p className="text-xs text-[#8FA39B]">Active Indicators Evaluated</p>
          <p className="mt-2 text-2xl font-mono font-semibold tabular-nums text-[#ECF3F0]">
            {risk ? `${risk.evaluatedIndicatorsCount} / ${risk.totalPlannedIndicatorsCount}` : '—'}
          </p>
          <p className="mt-2.5 text-[11px] font-mono text-[#7C938A]">
            Latest observation {stats?.latestValidDate ?? '—'}
          </p>
        </div>
      </section>

      {/* Transparent Scoring Matrix */}
      <section className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Documented Indicator Scoring Breakdown
          </h2>
          <p className="text-xs text-[#8FA39B] mt-0.5">
            Every indicator’s weight, baseline, observed value, and contribution to the anomaly score.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-[#23322B] font-mono text-[11px] text-[#7C938A]">
                <th className="py-2.5 pr-3 font-medium">Indicator</th>
                <th className="py-2.5 px-3 font-medium">Observed</th>
                <th className="py-2.5 px-3 font-medium">Baseline</th>
                <th className="py-2.5 px-3 font-medium">Deviation</th>
                <th className="py-2.5 px-3 font-medium text-right">Weight</th>
                <th className="py-2.5 px-3 font-medium text-right">Score</th>
                <th className="py-2.5 pl-3 font-medium">Methodology Note</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1D2A24]">
              {(risk?.scoringBreakdown ?? []).map((row) => (
                <tr key={row.indicator} className="hover:bg-[#18231E]">
                  <td className="py-3 pr-3 font-medium text-[#ECF3F0] whitespace-nowrap">
                    {row.indicator}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-[#DCE8E3] whitespace-nowrap">
                    {row.observed}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-[#9BB0A8] whitespace-nowrap">
                    {row.baseline}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-[#DCE8E3] whitespace-nowrap">
                    {row.deviation}
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-right text-[#8FA39B]">
                    {row.weightPct}%
                  </td>
                  <td className="py-3 px-3 font-mono tabular-nums text-right">
                    {row.normalizedScore !== null ? (
                      <span className="text-[#ECF3F0]">{row.normalizedScore}/100</span>
                    ) : (
                      <span className="text-[#6F857C]">Excluded</span>
                    )}
                  </td>
                  <td className="py-3 pl-3 text-[#8FA39B] max-w-xs">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Evidence-Backed Alerts List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Generated Evidence-Backed Alerts ({risk?.alerts.length ?? 0})
          </h2>
          <span className="text-xs font-mono text-[#7C938A]">
            Anomalies indicate screening signals — never confirmed environmental disasters
          </span>
        </div>

        {!risk || risk.alerts.length === 0 ? (
          <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-6 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-[#ECF3F0]">
                No Weather Threshold Breaches Detected for {activeRegion?.name}
              </p>
              <p className="text-xs text-[#8FA39B] mt-1 leading-relaxed max-w-2xl">
                Current NASA POWER thermal and precipitation indicators fall within your configured
                Normal range. Note that optical vegetation stress (Sentinel-2 NDVI) and 30 m thermal
                anomalies (Landsat 8/9) are not yet evaluated in Stage 2.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {risk.alerts.map((alert) => (
              <article
                key={alert.id}
                className="bg-[#141D19] border border-[#2A3B33] rounded-lg p-5 space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-[#8FA39B]">
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span className="text-[#ECF3F0]">{alert.id}</span>
                      <span aria-hidden="true">·</span>
                      <span>{alert.regionName}</span>
                      <span aria-hidden="true">·</span>
                      <span>
                        {alert.coordinates[0].toFixed(4)}°N, {alert.coordinates[1].toFixed(4)}°E
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>Detected {alert.detectionDate}</span>
                    </div>
                    <h3 className="mt-1.5 text-base font-semibold text-[#ECF3F0]">
                      {alert.patternName}
                    </h3>
                  </div>

                  <span
                    className={`text-xs font-mono font-semibold px-2.5 py-1 rounded border self-start ${riskBadgeStyle(
                      alert.riskLevel
                    )}`}
                  >
                    {alert.riskLevel} · {alert.confidenceScorePct}% Conf.
                  </span>
                </div>

                <p className="text-xs text-[#B7C9C2] leading-relaxed">{alert.explanation}</p>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-3 border-t border-[#1E2B25] text-xs">
                  <div>
                    <p className="font-mono text-[11px] text-[#7C938A] mb-1.5">Observed Values</p>
                    {Object.entries(alert.observedValues).map(([k, v]) => (
                      <p key={k} className="font-mono tabular-nums text-[#ECF3F0]">
                        {k}: <span className="text-emerald-300">{v}</span>
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-[#7C938A] mb-1.5">
                      Historical Baseline
                    </p>
                    {Object.entries(alert.historicalBaseline).map(([k, v]) => (
                      <p key={k} className="font-mono tabular-nums text-[#B7C9C2]">
                        {k}: {v}
                      </p>
                    ))}
                  </div>
                  <div>
                    <p className="font-mono text-[11px] text-[#7C938A] mb-1.5">
                      Deviation from Baseline
                    </p>
                    {Object.entries(alert.deviationFromBaseline).map(([k, v]) => (
                      <p key={k} className="font-mono tabular-nums text-amber-300">
                        {k}: {v}
                      </p>
                    ))}
                  </div>
                </div>

                <div className="pt-3 border-t border-[#1E2B25] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  <div>
                    <p className="font-mono text-[11px] text-[#7C938A] mb-1.5">
                      Recommended Verification Steps
                    </p>
                    <ul className="space-y-1 text-[#9BB0A8] list-disc pl-4">
                      {alert.recommendedVerificationSteps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="font-mono text-[11px] text-[#7C938A]">Supporting Sources</p>
                      <p className="font-mono text-[#CFE0D9] mt-0.5">
                        {alert.supportingSources.join(' · ')}
                      </p>
                    </div>
                    <div>
                      <p className="font-mono text-[11px] text-[#7C938A]">
                        Missing Indicators Limiting Confidence
                      </p>
                      <p className="text-[#8FA39B] mt-0.5">{alert.missingIndicators.join('; ')}</p>
                    </div>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Multi-Indicator Rule Architecture & Stage 5 AI Analyst Roadmap */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-8 bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0] mb-3">
            Multi-Indicator Environmental Pattern Ruleset
          </h2>
          <div className="divide-y divide-[#1E2B25]">
            {MULTISOURCE_PATTERNS.map((pat) => (
              <div key={pat.code} className="py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-mono font-semibold text-emerald-400">
                    {pat.code}
                  </span>
                  <span className="text-xs font-semibold text-[#ECF3F0]">{pat.title}</span>
                </div>
                <p className="text-xs text-[#9BB0A8] mt-1">{pat.criteria}</p>
                <p className="text-[11px] font-mono text-[#6F857C] mt-1">{pat.stageStatus}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-4 bg-[#111916] border border-dashed border-[#2A3B33] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-mono text-cyan-400">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Stage 5 · Coming Soon</span>
            </div>
            <h3 className="mt-2 text-base font-semibold text-[#ECF3F0]">
              Gemini Environmental Analyst
            </h3>
            <p className="mt-1.5 text-xs text-[#9BB0A8] leading-relaxed">
              Natural-language explanation assistant strictly grounded in TerraPulse deterministic
              observations and retrieved baselines. Never invents satellite values or replaces
              deterministic calculations.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-[#1E2B25] flex items-start gap-2 text-[11px] text-[#7C938A]">
            <Info className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
            <span>Reserved for Stage 5 once multi-indicator satellite datasets are connected.</span>
          </div>
        </div>
      </section>
    </div>
  );
}
