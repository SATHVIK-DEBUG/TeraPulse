import { ArrowRight, Download, MapPin } from 'lucide-react';
import React from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard, NotConnectedMetricCard } from '../components/MetricCard';
import { useTerraPulse } from '../context/TerraPulseContext';
import { api } from '../services/api';
import type { RiskLevel } from '../shared/types';

function riskToneClasses(level: RiskLevel): string {
  switch (level) {
    case 'High':
      return 'text-rose-400 border-rose-500/40 bg-rose-950/25';
    case 'Elevated':
      return 'text-orange-400 border-orange-500/40 bg-orange-950/25';
    case 'Watch':
      return 'text-amber-400 border-amber-500/40 bg-amber-950/25';
    default:
      return 'text-emerald-400 border-emerald-500/35 bg-emerald-950/20';
  }
}

export function OverviewPage() {
  const {
    activeRegion,
    daysWindow,
    setDaysWindow,
    telemetry,
    telemetryLoading,
    telemetryError,
    comparison,
    comparisonLoading,
    setActiveSection,
    refreshLiveTelemetry,
  } = useTerraPulse();

  const stats = telemetry?.statistics;
  const risk = telemetry?.risk;
  const source = telemetry?.source;

  const dailyChartData = (telemetry?.dailyRecords ?? [])
    .filter((r) => r.provenance === 'real_observation')
    .map((r) => ({
      date: r.date.slice(5), // MM-DD
      fullDate: r.date,
      ts: r.ts,
      t2m: r.t2m,
      rain: r.prectotcorr,
    }));

  const monthlyChartData = stats?.monthlySeries ?? [];

  const csvUrl = activeRegion
    ? api.buildCsvExportUrl({ regionId: activeRegion.id, days: daysWindow })
    : '#';

  return (
    <div className="space-y-6">
      {/* Page Header + Geographic Band */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Environmental Overview · Stages 1 & 2 Live Telemetry
          </p>
          <h1 className="mt-1 text-2xl sm:text-[28px] font-semibold tracking-tight text-[#ECF3F0]">
            {activeRegion?.name ?? 'Loading Region...'}
          </h1>
          {activeRegion && (
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs font-mono text-[#8FA39B] tabular-nums">
              <span className="inline-flex items-center gap-1 text-[#B7C9C2]">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                {activeRegion.district}, {activeRegion.state}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Center {activeRegion.center[0].toFixed(4)}°N, {activeRegion.center[1].toFixed(4)}°E
              </span>
              <span aria-hidden="true">·</span>
              <span>Area {activeRegion.areaKm2.toFixed(1)} km²</span>
              <span aria-hidden="true">·</span>
              <span>{activeRegion.cells.length} monitored cells</span>
              <span aria-hidden="true">·</span>
              <span>
                Bounds [{activeRegion.bbox[1].toFixed(2)}°–{activeRegion.bbox[3].toFixed(2)}°N,{' '}
                {activeRegion.bbox[0].toFixed(2)}°–{activeRegion.bbox[2].toFixed(2)}°E]
              </span>
            </div>
          )}
        </div>

        {/* Time Window Segmented Control & Quick CSV */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex items-center p-1 bg-[#111916] border border-[#23322B] rounded-md">
            {[30, 90, 180, 365].map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDaysWindow(d)}
                className={`px-2.5 py-1 text-xs font-mono rounded transition-colors whitespace-nowrap ${
                  daysWindow === d
                    ? 'bg-[#1D2D26] text-emerald-300 font-medium'
                    : 'text-[#8FA39B] hover:text-[#ECF3F0]'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>

          <a
            href={csvUrl}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-[#23322B] bg-[#141D19] hover:bg-[#1A2621] text-xs font-medium text-[#DCE8E3] transition-colors whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export CSV</span>
          </a>
        </div>
      </div>

      {/* Upstream Error State */}
      {telemetryError && (
        <div className="p-4 rounded-lg border border-rose-900/70 bg-rose-950/25 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-rose-300">Live NASA POWER Request Failed</p>
            <p className="text-xs text-rose-200/80 mt-0.5">{telemetryError}</p>
          </div>
          <button
            type="button"
            onClick={() => refreshLiveTelemetry(true)}
            className="px-3.5 py-1.5 text-xs font-medium bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 rounded-md whitespace-nowrap self-start sm:self-auto"
          >
            Retry Connection
          </button>
        </div>
      )}

      {/* Deterministic Environmental Status Strip */}
      <section className="bg-[#141D19] border border-[#23322B] rounded-lg p-4 lg:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs font-mono text-[#8FA39B]">Regional Environmental Status</span>
            {risk && !telemetryLoading ? (
              <span
                className={`text-xs font-mono font-semibold px-2.5 py-0.5 rounded border ${riskToneClasses(
                  risk.status
                )}`}
              >
                {risk.status}
              </span>
            ) : (
              <span className="h-5 w-16 rounded bg-[#1D2A24] animate-pulse inline-block" />
            )}
            {risk && (
              <span className="text-xs font-mono text-[#8FA39B] tabular-nums">
                Weather Anomaly Score {risk.anomalyScore}/100 · Confidence {risk.confidenceScorePct}% ({risk.confidenceLabel})
              </span>
            )}
          </div>
          <p className="text-xs text-[#9BB0A8] max-w-3xl leading-relaxed">
            {risk?.methodologyNote ??
              'Computing deterministic status from live NASA POWER temperature, rainfall, and dry-spell deviations.'}
          </p>
        </div>

        <div className="flex flex-col sm:items-end gap-1 text-xs font-mono text-[#7C938A] tabular-nums shrink-0">
          <span>
            Last Sync: {source?.fetchedAt ? new Date(source.fetchedAt).toLocaleString() : '—'}
          </span>
          <span>
            Latest Observation: {stats?.latestValidDate ?? '—'} · Completeness{' '}
            {stats ? `${stats.completenessPct}%` : '—'} ({stats?.validObservationDays ?? 0}/
            {stats?.totalDaysRequested ?? 0} days)
          </span>
        </div>
      </section>

      {/* Primary Environmental Indicators Grid */}
      <section aria-label="Key Environmental Indicators">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <NotConnectedMetricCard
            label="Average Vegetation (NDVI)"
            provider="Copernicus Sentinel-2 L2A"
            stage="Stage 3"
            reason="Optical Band 8/4 imagery not connected. Zero synthetic NDVI displayed."
            onAction={() => setActiveSection('vegetation')}
          />

          <MetricCard
            label="Earth Skin Temperature (TS)"
            value={stats?.avgTs !== null && stats?.avgTs !== undefined ? stats.avgTs.toFixed(1) : '—'}
            unit="°C"
            deltaText={
              stats?.tsAnomalyC !== null && stats?.tsAnomalyC !== undefined
                ? `${stats.tsAnomalyC >= 0 ? '+' : ''}${stats.tsAnomalyC.toFixed(2)} °C vs 30-yr baseline`
                : 'Baseline comparison pending'
            }
            deltaTone={
              stats?.tsAnomalyC !== null && stats?.tsAnomalyC !== undefined
                ? stats.tsAnomalyC >= 2.5
                  ? 'danger'
                  : stats.tsAnomalyC >= 1.5
                  ? 'warning'
                  : 'positive'
                : 'neutral'
            }
            observationDate={stats?.latestValidDate ?? 'Pending'}
            source="NASA POWER AG"
            quality={stats ? `${stats.completenessPct}% valid` : 'Loading'}
            loading={telemetryLoading}
          />

          <MetricCard
            label="2m Atmospheric Air Temp"
            value={stats?.avgT2m !== null && stats?.avgT2m !== undefined ? stats.avgT2m.toFixed(1) : '—'}
            unit="°C"
            deltaText={
              stats?.avgT2mMin !== null &&
              stats?.avgT2mMax !== null &&
              stats?.avgT2mMin !== undefined &&
              stats?.avgT2mMax !== undefined
                ? `Range ${stats.avgT2mMin.toFixed(1)}° – ${stats.avgT2mMax.toFixed(1)}°C`
                : 'Diurnal range loading'
            }
            deltaTone="neutral"
            observationDate={stats?.latestValidDate ?? 'Pending'}
            source="NASA POWER AG"
            quality={stats ? `${stats.missingObservationDays} missing` : 'Loading'}
            loading={telemetryLoading}
          />

          <MetricCard
            label={`Cumulative Rainfall (${daysWindow}d)`}
            value={
              stats?.totalRainfallMm !== null && stats?.totalRainfallMm !== undefined
                ? stats.totalRainfallMm.toFixed(1)
                : '—'
            }
            unit="mm"
            deltaText={
              stats?.rainfallAnomalyPct !== null && stats?.rainfallAnomalyPct !== undefined
                ? `${stats.rainfallAnomalyPct >= 0 ? '+' : ''}${stats.rainfallAnomalyPct.toFixed(1)}% vs baseline (${stats.zeroRainDays} dry days)`
                : `${stats?.zeroRainDays ?? 0} zero-rain days · ${stats?.wetDays ?? 0} wet days`
            }
            deltaTone={
              stats?.rainfallAnomalyPct !== null && stats?.rainfallAnomalyPct !== undefined
                ? stats.rainfallAnomalyPct <= -25
                  ? 'warning'
                  : stats.rainfallAnomalyPct >= 60
                  ? 'warning'
                  : 'positive'
                : 'neutral'
            }
            observationDate={stats?.latestValidDate ?? 'Pending'}
            source="NASA POWER AG"
            quality="0mm ≠ missing"
            loading={telemetryLoading}
          />

          <MetricCard
            label="Screened Weather Anomalies"
            value={risk ? String(risk.alerts.length) : '—'}
            unit={risk?.alerts.length === 1 ? 'alert' : 'alerts'}
            deltaText={
              risk
                ? `${risk.evaluatedIndicatorsCount}/${risk.totalPlannedIndicatorsCount} indicators active`
                : 'Evaluating rules'
            }
            deltaTone={risk && risk.alerts.length > 0 ? 'warning' : 'positive'}
            observationDate={stats?.latestValidDate ?? 'Pending'}
            source="Deterministic Engine"
            quality={risk ? `${risk.confidenceScorePct}% conf.` : 'Loading'}
            loading={telemetryLoading}
          />
        </div>
      </section>

      {/* Primary Charts Grid: Temperature Trend + Rainfall Trend */}
      <section className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Temperature Trend Chart */}
        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#ECF3F0]">
                Earth Skin Temperature (TS) vs. 2m Air Temperature
              </h2>
              <p className="text-xs text-[#8FA39B] mt-0.5">
                Daily NASA POWER observations (°C) · Dashed reference shows 30-year TS baseline
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('temperature')}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Inspect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[260px] w-full">
            {telemetryLoading ? (
              <div className="h-full w-full rounded bg-[#101714] animate-pulse" />
            ) : dailyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#7C938A]">
                No valid daily temperature observations returned for this window.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#1E2C26" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#647A71"
                    tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    minTickGap={24}
                  />
                  <YAxis
                    stroke="#647A71"
                    tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    domain={['auto', 'auto']}
                    unit="°"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F1613',
                      borderColor: '#23322B',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                    }}
                    labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                  />
                  {stats?.baselineTs !== null && stats?.baselineTs !== undefined && (
                    <ReferenceLine
                      y={stats.baselineTs}
                      stroke="#647A71"
                      strokeDasharray="4 4"
                    />
                  )}
                  <Line
                    type="monotone"
                    dataKey="ts"
                    name="Earth Skin Temp (TS °C)"
                    stroke="#F59E0B"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="t2m"
                    name="2m Air Temp (T2M °C)"
                    stroke="#10B981"
                    strokeWidth={1.75}
                    dot={false}
                    connectNulls={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Rainfall Trend vs Baseline Chart */}
        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#ECF3F0]">
                Monthly Precipitation vs. 30-Year Climatology Baseline
              </h2>
              <p className="text-xs text-[#8FA39B] mt-0.5">
                Observed NASA POWER PRECTOTCORR totals (mm) compared against expected monthly rainfall
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('rainfall')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Inspect</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="h-[260px] w-full">
            {telemetryLoading ? (
              <div className="h-full w-full rounded bg-[#101714] animate-pulse" />
            ) : monthlyChartData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-xs text-[#7C938A]">
                No valid monthly precipitation totals available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={monthlyChartData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                  <CartesianGrid stroke="#1E2C26" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="monthLabel"
                    stroke="#647A71"
                    tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  />
                  <YAxis
                    stroke="#647A71"
                    tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                    unit="mm"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0F1613',
                      borderColor: '#23322B',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono',
                    }}
                  />
                  <Bar
                    dataKey="totalRainfallMm"
                    name="Observed Rainfall (mm)"
                    fill="#06B6D4"
                    radius={[3, 3, 0, 0]}
                    maxBarSize={40}
                  />
                  <Line
                    type="monotone"
                    dataKey="baselineMonthlyRainMm"
                    name="30-yr Baseline (mm)"
                    stroke="#94A3B8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 3, fill: '#94A3B8' }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </section>

      {/* Secondary Row: Regional Comparison + NDVI & Anomaly Transparency */}
      <section className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        {/* Regional Comparison Table & Chart */}
        <div className="xl:col-span-7 bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
            <div>
              <h2 className="text-sm font-semibold text-[#ECF3F0]">
                Regional Environmental Comparison ({daysWindow}-Day Window)
              </h2>
              <p className="text-xs text-[#8FA39B] mt-0.5">
                Live NASA POWER comparison across Puttur, Tirupati, Chittoor, and custom boundaries
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('map')}
              className="text-xs font-mono text-emerald-400 hover:text-emerald-300 inline-flex items-center gap-1 whitespace-nowrap"
            >
              <span>Open Live Map</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#23322B] text-[11px] font-mono text-[#7C938A]">
                  <th className="py-2.5 pr-3 font-medium">Region</th>
                  <th className="py-2.5 px-3 font-medium text-right">Skin Temp (TS)</th>
                  <th className="py-2.5 px-3 font-medium text-right">TS Anomaly</th>
                  <th className="py-2.5 px-3 font-medium text-right">Rainfall</th>
                  <th className="py-2.5 px-3 font-medium text-right">Valid Data</th>
                  <th className="py-2.5 pl-3 font-medium text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#1C2822] text-xs">
                {comparisonLoading && comparison.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-[#7C938A] font-mono">
                      Loading live comparison across Andhra Pradesh regions...
                    </td>
                  </tr>
                ) : (
                  comparison.map((item) => (
                    <tr
                      key={item.regionId}
                      className={`hover:bg-[#19241F] transition-colors ${
                        item.regionId === activeRegion?.id ? 'bg-[#17241E]' : ''
                      }`}
                    >
                      <td className="py-3 pr-3">
                        <p className="font-medium text-[#ECF3F0]">{item.regionName}</p>
                        <p className="text-[11px] font-mono text-[#6F857C]">
                          {item.district} · {item.cellCount} cells
                        </p>
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#DCE8E3]">
                        {item.avgTs !== null ? `${item.avgTs.toFixed(1)} °C` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#DCE8E3]">
                        {item.tsAnomalyC !== null
                          ? `${item.tsAnomalyC >= 0 ? '+' : ''}${item.tsAnomalyC.toFixed(2)} °C`
                          : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-cyan-300">
                        {item.totalRainfallMm !== null ? `${item.totalRainfallMm.toFixed(1)} mm` : '—'}
                      </td>
                      <td className="py-3 px-3 text-right font-mono tabular-nums text-[#8FA39B]">
                        {item.completenessPct.toFixed(0)}%
                      </td>
                      <td className="py-3 pl-3 text-right font-mono">
                        <span
                          className={`inline-block text-[11px] px-2 py-0.5 rounded border ${riskToneClasses(
                            item.riskStatus
                          )}`}
                        >
                          {item.riskStatus}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Monthly Anomaly History Chart + Sentinel-2 NDVI Slot */}
        <div className="xl:col-span-5 flex flex-col gap-5">
          <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5 flex-1">
            <h2 className="text-sm font-semibold text-[#ECF3F0]">
              Monthly Thermal Anomaly History (TS vs. Baseline)
            </h2>
            <p className="text-xs text-[#8FA39B] mt-0.5 mb-3">
              Deviation (°C) from NASA POWER 30-year monthly climatology
            </p>
            <div className="h-[170px] w-full">
              {monthlyChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyChartData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke="#1E2C26" strokeDasharray="3 3" vertical={false} />
                    <XAxis
                      dataKey="monthLabel"
                      stroke="#647A71"
                      tick={{ fill: '#7C938A', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                    />
                    <YAxis
                      stroke="#647A71"
                      tick={{ fill: '#7C938A', fontSize: 10, fontFamily: 'JetBrains Mono' }}
                      unit="°"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#0F1613',
                        borderColor: '#23322B',
                        borderRadius: '6px',
                        fontSize: '12px',
                        fontFamily: 'JetBrains Mono',
                      }}
                    />
                    <ReferenceLine y={0} stroke="#384C43" />
                    <Bar
                      dataKey="tempAnomalyC"
                      name="TS Anomaly (°C)"
                      fill="#10B981"
                      radius={[3, 3, 0, 0]}
                      maxBarSize={32}
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-[#7C938A]">
                  Awaiting monthly observations...
                </div>
              )}
            </div>
          </div>

          <div className="bg-[#111916] border border-dashed border-[#2A3B33] rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-mono text-[#7C938A]">Stage 3 · Sentinel-2 NDVI Trend</p>
              <p className="mt-1 text-xs text-[#9BB0A8]">
                Optical vegetation time-series activates once Copernicus Data Space is connected.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActiveSection('vegetation')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 whitespace-nowrap shrink-0"
            >
              NDVI Formula
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
