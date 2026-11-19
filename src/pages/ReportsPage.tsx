import { Check, Copy, Download, FileText } from 'lucide-react';
import React, { useState } from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';
import { api } from '../services/api';

export function ReportsPage() {
  const { activeRegion, daysWindow, telemetry } = useTerraPulse();
  const [copied, setCopied] = useState(false);

  const stats = telemetry?.statistics;
  const risk = telemetry?.risk;
  const source = telemetry?.source;

  const csvUrl = activeRegion
    ? api.buildCsvExportUrl({ regionId: activeRegion.id, days: daysWindow })
    : '#';

  const buildPlainTextSummary = () => {
    if (!activeRegion || !stats || !risk || !source) return '';
    return [
      `TERRAPULSE ENVIRONMENTAL INTELLIGENCE REPORT`,
      `Region: ${activeRegion.name} (${activeRegion.district}, ${activeRegion.state}, ${activeRegion.country})`,
      `Coordinates: ${activeRegion.center[0].toFixed(4)}°N, ${activeRegion.center[1].toFixed(4)}°E | Area: ${activeRegion.areaKm2.toFixed(1)} km² | Cells: ${activeRegion.cells.length}`,
      `Observation Period: ${stats.observationStartDate} to ${stats.observationEndDate} (${stats.validObservationDays}/${stats.totalDaysRequested} valid days, ${stats.completenessPct}% completeness)`,
      `Environmental Status: ${risk.status} (Score ${risk.anomalyScore}/100, Confidence ${risk.confidenceScorePct}% — ${risk.confidenceLabel})`,
      ``,
      `LIVE NASA POWER INDICATORS:`,
      `- Mean Earth Skin Temp (TS): ${stats.avgTs ?? 'Missing'} °C (Anomaly: ${stats.tsAnomalyC ?? 'N/A'} °C vs 30-yr baseline)`,
      `- Mean 2m Air Temp (T2M): ${stats.avgT2m ?? 'Missing'} °C (Max ${stats.avgT2mMax ?? '—'} °C / Min ${stats.avgT2mMin ?? '—'} °C)`,
      `- Cumulative Precipitation: ${stats.totalRainfallMm ?? 'Missing'} mm (Anomaly: ${stats.rainfallAnomalyPct ?? 'N/A'}%, Dry Spell: ${stats.consecutiveDryDays} days)`,
      ``,
      `UNCONNECTED SATELLITE MODULES (NOT INCLUDED):`,
      `- Sentinel-2 NDVI Vegetation Analysis: Not Connected (Stage 3)`,
      `- Landsat 8/9 30m Thermal LST: Not Connected (Stage 4)`,
      `- CHIRPS 5.5km Gridded Rainfall: Not Connected (Stage 4)`,
      ``,
      `SOURCE REFERENCE: ${source.provider} (${source.dataset}, Community ${source.community}), fetched ${source.fetchedAt}.`,
    ].join('\n');
  };

  const handleCopySummary = async () => {
    const text = buildPlainTextSummary();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in sandbox
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Structured Evidence Report · {activeRegion?.name ?? 'Loading'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Environmental Reports</h1>
          <p className="mt-1 text-xs text-[#9BB0A8]">
            12-section structured dossier populated strictly from verified NASA POWER observations.
            Automated PDF compilation and Gemini narrative synthesis are scheduled for Stages 5–6.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            type="button"
            onClick={handleCopySummary}
            disabled={!telemetry}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#23322B] bg-[#141D19] hover:bg-[#1A2621] disabled:opacity-50 text-xs font-medium text-[#ECF3F0] transition-colors whitespace-nowrap"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[#8FA39B]" />
            )}
            <span>{copied ? 'Copied Text' : 'Copy Text Summary'}</span>
          </button>

          <a
            href={csvUrl}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[#05140E] font-medium text-xs transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download CSV Dataset</span>
          </a>

          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-dashed border-[#2B3D35] bg-[#101714] text-xs font-mono text-[#7C938A] whitespace-nowrap">
            <FileText className="w-3.5 h-3.5" />
            <span>PDF Export · Coming Soon (Stage 6)</span>
          </span>
        </div>
      </div>

      {/* 12-Section Structured Report Dossier */}
      <article className="bg-[#141D19] border border-[#23322B] rounded-lg divide-y divide-[#1E2B25]">
        {/* 1 & 2 & 3 */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5">
          <div>
            <p className="text-[11px] font-mono text-emerald-400">01. Report Overview</p>
            <p className="mt-1.5 text-sm font-semibold text-[#ECF3F0]">
              Stage 2 Regional Climate Assessment
            </p>
            <p className="mt-1 text-xs text-[#9BB0A8]">
              Deterministic summary based strictly on live NASA POWER Agroclimatology daily and
              climatology records.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">02. Selected Geographical Region</p>
            <p className="mt-1.5 text-sm font-semibold text-[#ECF3F0]">
              {activeRegion?.name ?? '—'}
            </p>
            <p className="mt-1 text-xs font-mono text-[#9BB0A8] tabular-nums">
              {activeRegion?.district}, {activeRegion?.state} ·{' '}
              {activeRegion?.center[0].toFixed(4)}°N, {activeRegion?.center[1].toFixed(4)}°E ·{' '}
              {activeRegion?.areaKm2.toFixed(1)} km² ({activeRegion?.cells.length} grid cells)
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">03. Observation Period</p>
            <p className="mt-1.5 text-sm font-mono font-semibold text-[#ECF3F0] tabular-nums">
              {stats?.observationStartDate ?? '—'} → {stats?.observationEndDate ?? '—'}
            </p>
            <p className="mt-1 text-xs font-mono text-[#9BB0A8] tabular-nums">
              {stats?.validObservationDays ?? 0} valid days · {stats?.missingObservationDays ?? 0}{' '}
              missing days filtered ({stats?.completenessPct ?? 0}% complete)
            </p>
          </div>
        </div>

        {/* 4. Environmental Indicators */}
        <div className="p-5">
          <p className="text-[11px] font-mono text-emerald-400">04. Environmental Indicators</p>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono tabular-nums">
            <div>
              <span className="text-[#7C938A] block">Earth Skin Temp (TS)</span>
              <span className="text-base text-[#ECF3F0] font-semibold">
                {stats?.avgTs !== null && stats?.avgTs !== undefined ? `${stats.avgTs.toFixed(1)} °C` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[#7C938A] block">2m Air Temp (T2M)</span>
              <span className="text-base text-[#ECF3F0] font-semibold">
                {stats?.avgT2m !== null && stats?.avgT2m !== undefined ? `${stats.avgT2m.toFixed(1)} °C` : '—'}
              </span>
            </div>
            <div>
              <span className="text-[#7C938A] block">Cumulative Rainfall</span>
              <span className="text-base text-cyan-300 font-semibold">
                {stats?.totalRainfallMm !== null && stats?.totalRainfallMm !== undefined
                  ? `${stats.totalRainfallMm.toFixed(1)} mm`
                  : '—'}
              </span>
            </div>
            <div>
              <span className="text-[#7C938A] block">Sentinel-2 NDVI</span>
              <span className="text-sm text-[#7C938A]">Not Connected (Stage 3)</span>
            </div>
          </div>
        </div>

        {/* 5, 6, 7 Domain Analyses */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <p className="text-[11px] font-mono text-emerald-400">05. Vegetation Analysis</p>
            <p className="mt-1.5 text-[#8FA39B] leading-relaxed">
              Not Connected in Stage 2. Copernicus Sentinel-2 Band 8/4 NDVI ingestion and seasonal
              phenology comparisons activate in Stage 3.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">06. Temperature Analysis</p>
            <p className="mt-1.5 text-[#B7C9C2] leading-relaxed">
              Observed NASA POWER mean Earth Skin Temperature is{' '}
              <span className="font-mono text-[#ECF3F0]">{stats?.avgTs?.toFixed(1) ?? '—'} °C</span>{' '}
              (deviation{' '}
              <span className="font-mono text-amber-300">
                {stats?.tsAnomalyC !== null && stats?.tsAnomalyC !== undefined
                  ? `${stats.tsAnomalyC >= 0 ? '+' : ''}${stats.tsAnomalyC.toFixed(2)} °C`
                  : 'unavailable'}
              </span>{' '}
              vs. 30-year climatology). High-resolution 30 m Landsat thermal LST is pending Stage 4.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">07. Rainfall Analysis</p>
            <p className="mt-1.5 text-[#B7C9C2] leading-relaxed">
              Cumulative NASA POWER precipitation totals{' '}
              <span className="font-mono text-cyan-300">
                {stats?.totalRainfallMm?.toFixed(1) ?? '—'} mm
              </span>{' '}
              across {stats?.wetDays ?? 0} wet days and {stats?.zeroRainDays ?? 0} confirmed zero-rain
              days (current dry spell: {stats?.consecutiveDryDays ?? 0} days). CHIRPS 5.5 km grids
              are pending Stage 4.
            </p>
          </div>
        </div>

        {/* 8 & 9 Anomalies + Evidence */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          <div>
            <p className="text-[11px] font-mono text-emerald-400">08. Detected Anomalies</p>
            <p className="mt-1.5 text-[#B7C9C2] leading-relaxed">
              Screened Status: <strong className="text-[#ECF3F0]">{risk?.status ?? '—'}</strong> ·{' '}
              {risk?.alerts.length ?? 0} active weather screening alert(s).{' '}
              {risk && risk.alerts.length > 0
                ? risk.alerts.map((a) => `${a.id} (${a.patternName})`).join('; ')
                : 'No threshold breaches recorded within the active observation window.'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">09. Evidence & Confidence</p>
            <p className="mt-1.5 text-[#B7C9C2] leading-relaxed">
              Confidence Rating:{' '}
              <span className="font-mono text-amber-300">
                {risk?.confidenceScorePct ?? 0}% ({risk?.confidenceLabel ?? 'Low'})
              </span>
              . Confidence is intentionally capped because Sentinel-2 NDVI (30% weight) and Landsat
              8/9 LST (20% weight) are not yet connected.
            </p>
          </div>
        </div>

        {/* 10, 11, 12 Limitations, Verification, Sources */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-3 gap-5 text-xs">
          <div>
            <p className="text-[11px] font-mono text-emerald-400">10. Limitations</p>
            <p className="mt-1.5 text-[#9BB0A8] leading-relaxed">
              NASA POWER Agroclimatology data has ~0.5°×0.625° (~55 km) spatial resolution and a
              3–5 day processing lag. Sub-field variability requires Stage 3–4 satellite imagery.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">
              11. Suggested Verification Steps
            </p>
            <p className="mt-1.5 text-[#9BB0A8] leading-relaxed">
              Cross-reference rainfall anomalies with district IMD gauges, inspect neighboring
              Tirupati/Chittoor baselines, and verify crop canopy conditions before taking field
              interventions.
            </p>
          </div>
          <div>
            <p className="text-[11px] font-mono text-emerald-400">12. Data Source References</p>
            <p className="mt-1.5 font-mono text-[#CFE0D9] leading-relaxed">
              {source?.provider ?? 'NASA POWER'} · {source?.dataset ?? 'AG Daily'} · API{' '}
              {source?.apiVersion ?? 'v2'} · Fetched{' '}
              {source?.fetchedAt ? new Date(source.fetchedAt).toISOString() : '—'}
            </p>
          </div>
        </div>
      </article>
    </div>
  );
}
