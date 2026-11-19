import { Info } from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard, NotConnectedMetricCard } from '../components/MetricCard';
import { NotConnectedPanel } from '../components/NotConnectedPanel';
import { useTerraPulse } from '../context/TerraPulseContext';

export function RainfallPage() {
  const { activeRegion, daysWindow, setDaysWindow, telemetry, telemetryLoading } = useTerraPulse();
  const stats = telemetry?.statistics;

  // Build cumulative rainfall curve while keeping missing dates visibly null
  let runningSum = 0;
  const dailyData = (telemetry?.dailyRecords ?? []).map((r) => {
    if (r.prectotcorr !== null) {
      runningSum = Number((runningSum + r.prectotcorr).toFixed(2));
    }
    return {
      date: r.date.slice(5),
      fullDate: r.date,
      rain: r.prectotcorr,
      cumulative: r.prectotcorr !== null ? runningSum : null,
      isMissing: r.prectotcorr === null,
    };
  });

  const monthlyData = stats?.monthlySeries ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Hydrological Analytics · {activeRegion?.name ?? 'Loading'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Rainfall Intelligence</h1>
          <p className="mt-1 text-xs text-[#9BB0A8] max-w-2xl">
            Live NASA POWER bias-corrected precipitation (PRECTOTCORR) with cumulative tracking,
            30-year climatology anomalies, and strict separation of zero-rainfall days from missing
            observations.
          </p>
        </div>

        <div className="inline-flex items-center p-1 bg-[#111916] border border-[#23322B] rounded-md self-start">
          {[30, 90, 180, 365].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDaysWindow(d)}
              className={`px-2.5 py-1 text-xs font-mono rounded transition-colors ${
                daysWindow === d
                  ? 'bg-[#1D2D26] text-emerald-300 font-medium'
                  : 'text-[#8FA39B] hover:text-[#ECF3F0]'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Zero-Rainfall vs Missing-Data Audit Banner */}
      <div className="bg-[#111916] border border-[#23322B] rounded-lg p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <div className="text-xs text-[#9BB0A8] leading-relaxed">
          <strong className="text-[#ECF3F0] font-medium">
            Data Integrity Audit (Zero Rainfall ≠ Missing Data):
          </strong>{' '}
          Across the {stats?.totalDaysRequested ?? daysWindow}-day window, TerraPulse verified{' '}
          <span className="font-mono text-[#ECF3F0]">{stats?.zeroRainDays ?? 0}</span> confirmed
          zero-rainfall days (<span className="font-mono">0.0 mm</span>),{' '}
          <span className="font-mono text-cyan-300">{stats?.wetDays ?? 0}</span> wet days (
          <span className="font-mono">≥ 1.0 mm</span>), and{' '}
          <span className="font-mono text-amber-300">{stats?.missingObservationDays ?? 0}</span>{' '}
          missing-data days filtered from NASA POWER <span className="font-mono">-999</span> fill
          sentinels.
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label={`Cumulative Rainfall (${daysWindow}d)`}
          value={
            stats?.totalRainfallMm !== null && stats?.totalRainfallMm !== undefined
              ? stats.totalRainfallMm.toFixed(1)
              : '—'
          }
          unit="mm"
          deltaText={
            stats?.baselineExpectedRainMm !== null && stats?.baselineExpectedRainMm !== undefined
              ? `Expected baseline: ${stats.baselineExpectedRainMm.toFixed(1)} mm`
              : 'Baseline pending'
          }
          observationDate={stats?.latestValidDate ?? '—'}
          source="NASA POWER PRECTOTCORR"
          quality={`${stats?.completenessPct ?? 0}% valid`}
          loading={telemetryLoading}
        />

        <MetricCard
          label="Rainfall Baseline Anomaly"
          value={
            stats?.rainfallAnomalyPct !== null && stats?.rainfallAnomalyPct !== undefined
              ? `${stats.rainfallAnomalyPct >= 0 ? '+' : ''}${stats.rainfallAnomalyPct.toFixed(1)}`
              : 'N/A'
          }
          unit={stats?.rainfallAnomalyPct !== null ? '%' : undefined}
          deltaText={
            stats?.rainfallAnomalyPct !== null && stats?.rainfallAnomalyPct !== undefined
              ? stats.rainfallAnomalyPct <= -25
                ? 'Drier than historical baseline'
                : stats.rainfallAnomalyPct >= 60
                ? 'Wetter than historical baseline'
                : 'Within normal historical range'
              : 'Low dry-season baseline (< 5 mm)'
          }
          deltaTone={
            stats?.rainfallAnomalyPct !== null && stats?.rainfallAnomalyPct !== undefined
              ? stats.rainfallAnomalyPct <= -25 || stats.rainfallAnomalyPct >= 60
                ? 'warning'
                : 'positive'
              : 'neutral'
          }
          observationDate={stats?.latestValidDate ?? '—'}
          source="30-yr Climatology"
          quality="Deterministic"
          loading={telemetryLoading}
        />

        <MetricCard
          label="Consecutive Dry Spell"
          value={stats ? String(stats.consecutiveDryDays) : '—'}
          unit="days"
          deltaText={`Trailing < 1.0 mm streak · 30d rain ${stats?.last30dRainfallMm?.toFixed(1) ?? '—'} mm`}
          deltaTone={
            (stats?.consecutiveDryDays ?? 0) >= 25
              ? 'danger'
              : (stats?.consecutiveDryDays ?? 0) >= 14
              ? 'warning'
              : 'neutral'
          }
          observationDate={stats?.latestValidDate ?? '—'}
          source="NASA POWER AG"
          quality="Halts on missing"
          loading={telemetryLoading}
        />

        <NotConnectedMetricCard
          label="CHIRPS 5.5 km Gridded Rain"
          provider="UCSB Climate Hazards Center"
          stage="Stage 4"
          reason="Sub-district 0.05° rainfall anomaly grids scheduled for Stage 4 ingestion."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">Daily Precipitation Events (mm/day)</h2>
          <p className="text-xs text-[#8FA39B] mt-0.5 mb-4">
            Daily bias-corrected precipitation from NASA POWER · Gaps denote filtered missing days
          </p>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
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
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                />
                <Bar dataKey="rain" name="Daily Rainfall (mm)" fill="#06B6D4" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">Cumulative Rainfall Progression (mm)</h2>
          <p className="text-xs text-[#8FA39B] mt-0.5 mb-4">
            Running total of confirmed precipitation across the {daysWindow}-day observation window
          </p>
          <div className="h-[270px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 8, right: 10, left: -10, bottom: 0 }}>
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
                  labelFormatter={(_, payload) => payload?.[0]?.payload?.fullDate ?? ''}
                />
                <Area
                  type="monotone"
                  dataKey="cumulative"
                  name="Cumulative Rainfall (mm)"
                  stroke="#10B981"
                  fill="#10B981"
                  fillOpacity={0.14}
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Monthly Anomaly Comparison */}
      <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#ECF3F0]">
          Monthly Observed Precipitation vs. Historical Climatology
        </h2>
        <p className="text-xs text-[#8FA39B] mt-0.5 mb-4">
          Tracks seasonal monsoon onset and dry-period deviations across calendar months
        </p>
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthlyData} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
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
                name="Observed Monthly Rain (mm)"
                fill="#06B6D4"
                radius={[3, 3, 0, 0]}
                maxBarSize={44}
              />
              <Line
                type="monotone"
                dataKey="baselineMonthlyRainMm"
                name="30-yr Monthly Climatology (mm)"
                stroke="#E2E8F0"
                strokeWidth={2}
                strokeDasharray="4 4"
                dot={{ r: 3, fill: '#E2E8F0' }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <NotConnectedPanel
        title="CHIRPS High-Resolution Historical Rainfall"
        providerName="UCSB Climate Hazards Center (CHIRPS v2.0)"
        providerUrl="https://www.chc.ucsb.edu/data/chirps"
        stageLabel="Stage 4 — Gridded Rainfall Expansion"
        description="CHIRPS provides 0.05° (~5.5 km) daily and pentadal precipitation records back to 1981, enabling sub-watershed rainfall anomaly mapping across Puttur and neighboring taluks once raster clipping is activated in Stage 4."
        requiredEnvVars={[]}
        scientificSpecs={[
          { label: 'Spatial Resolution', value: '0.05° (~5.5 km grid)' },
          { label: 'Archive Span', value: '1981 – Present (40+ years)' },
          { label: 'Data Access', value: 'Public (No API key)' },
          { label: 'Current Fallback', value: 'NASA POWER PRECTOTCORR (Active)' },
        ]}
      />
    </div>
  );
}
