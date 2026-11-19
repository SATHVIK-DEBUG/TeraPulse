import { Info } from 'lucide-react';
import React from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { MetricCard, NotConnectedMetricCard } from '../components/MetricCard';
import { NotConnectedPanel } from '../components/NotConnectedPanel';
import { useTerraPulse } from '../context/TerraPulseContext';

export function TemperaturePage() {
  const { activeRegion, daysWindow, setDaysWindow, telemetry, telemetryLoading, comparison } =
    useTerraPulse();

  const stats = telemetry?.statistics;
  const dailyData = (telemetry?.dailyRecords ?? [])
    .filter((r) => r.provenance === 'real_observation')
    .map((r) => ({
      date: r.date.slice(5),
      fullDate: r.date,
      ts: r.ts,
      t2m: r.t2m,
      t2mMax: r.t2mMax,
      t2mMin: r.t2mMin,
    }));

  const monthlyData = stats?.monthlySeries ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Thermal Analytics · {activeRegion?.name ?? 'Loading'}
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Temperature Intelligence</h1>
          <p className="mt-1 text-xs text-[#9BB0A8] max-w-2xl">
            Monitors live NASA POWER Earth Skin Temperature (TS) and 2m atmospheric air temperatures
            against 30-year monthly climatology baselines.
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

      {/* Scientific Physical Distinction Notice */}
      <div className="bg-[#111916] border border-[#23322B] rounded-lg p-4 flex items-start gap-3">
        <Info className="w-4 h-4 text-cyan-400 mt-0.5 shrink-0" />
        <p className="text-xs text-[#9BB0A8] leading-relaxed">
          <strong className="text-[#ECF3F0] font-medium">
            Scientific Distinction — Surface Temperature vs. Atmospheric Air Temperature:
          </strong>{' '}
          NASA POWER <span className="font-mono text-[#DCE8E3]">TS</span> represents coarse-grid
          (~55 km) modeled Earth skin temperature, whereas{' '}
          <span className="font-mono text-[#DCE8E3]">T2M</span> measures air temperature 2 meters
          above ground. High-resolution 30 m spatial heat-island mapping requires calibrated Landsat
          8 & 9 Collection 2 Level-2 thermal products (<span className="font-mono">ST_B10</span>),
          scheduled for Stage 4.
        </p>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <MetricCard
          label="Mean Earth Skin Temp (TS)"
          value={stats?.avgTs !== null && stats?.avgTs !== undefined ? stats.avgTs.toFixed(1) : '—'}
          unit="°C"
          deltaText={
            stats?.tsAnomalyC !== null && stats?.tsAnomalyC !== undefined
              ? `${stats.tsAnomalyC >= 0 ? '+' : ''}${stats.tsAnomalyC.toFixed(2)} °C vs climatology`
              : 'Baseline pending'
          }
          deltaTone={
            (stats?.tsAnomalyC ?? 0) >= 2.5
              ? 'danger'
              : (stats?.tsAnomalyC ?? 0) >= 1.5
              ? 'warning'
              : 'positive'
          }
          observationDate={stats?.latestValidDate ?? '—'}
          source="NASA POWER TS"
          quality={`${stats?.completenessPct ?? 0}% valid`}
          loading={telemetryLoading}
        />

        <MetricCard
          label="Mean 2m Air Temperature"
          value={stats?.avgT2m !== null && stats?.avgT2m !== undefined ? stats.avgT2m.toFixed(1) : '—'}
          unit="°C"
          deltaText={
            stats?.t2mAnomalyC !== null && stats?.t2mAnomalyC !== undefined
              ? `${stats.t2mAnomalyC >= 0 ? '+' : ''}${stats.t2mAnomalyC.toFixed(2)} °C vs climatology`
              : 'Baseline pending'
          }
          deltaTone="neutral"
          observationDate={stats?.latestValidDate ?? '—'}
          source="NASA POWER T2M"
          quality="2m atmospheric"
          loading={telemetryLoading}
        />

        <MetricCard
          label="Mean Daily Maximum / Minimum"
          value={
            stats?.avgT2mMax !== null &&
            stats?.avgT2mMin !== null &&
            stats?.avgT2mMax !== undefined &&
            stats?.avgT2mMin !== undefined
              ? `${stats.avgT2mMax.toFixed(1)} / ${stats.avgT2mMin.toFixed(1)}`
              : '—'
          }
          unit="°C"
          deltaText={
            stats?.avgSolarRadiation !== null && stats?.avgSolarRadiation !== undefined
              ? `Mean solar irradiance ${stats.avgSolarRadiation.toFixed(1)} MJ/m²/d`
              : undefined
          }
          observationDate={stats?.latestValidDate ?? '—'}
          source="NASA POWER AG"
          quality="Diurnal spread"
          loading={telemetryLoading}
        />

        <NotConnectedMetricCard
          label="Landsat 8/9 30m Thermal LST"
          provider="USGS Collection 2 L2 (ST_B10)"
          stage="Stage 4"
          reason="Validated 30 m thermal bands not yet connected. No uncalibrated estimates shown."
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Daily Diurnal Envelope & Earth Skin Temperature (°C)
          </h2>
          <p className="text-xs text-[#8FA39B] mt-0.5 mb-4">
            Daily T2M Max, T2M Min, and Earth Skin Temperature (TS) from NASA POWER
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
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
                <Area
                  type="monotone"
                  dataKey="t2mMax"
                  name="Max 2m Air (°C)"
                  stroke="#FB923C"
                  fill="#FB923C"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                />
                <Area
                  type="monotone"
                  dataKey="t2mMin"
                  name="Min 2m Air (°C)"
                  stroke="#06B6D4"
                  fill="#06B6D4"
                  fillOpacity={0.08}
                  strokeWidth={1.5}
                />
                <Line
                  type="monotone"
                  dataKey="ts"
                  name="Earth Skin Temp TS (°C)"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Monthly Skin Temperature vs. 30-Year Baseline (°C)
          </h2>
          <p className="text-xs text-[#8FA39B] mt-0.5 mb-4">
            Observed monthly TS mean compared with historical NASA POWER climatology
          </p>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyData} margin={{ top: 8, right: 10, left: -14, bottom: 0 }}>
                <CartesianGrid stroke="#1E2C26" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="monthLabel"
                  stroke="#647A71"
                  tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                />
                <YAxis
                  stroke="#647A71"
                  tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
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
                <ReferenceLine y={35} stroke="#EF4444" strokeDasharray="3 3" strokeOpacity={0.5} />
                <Line
                  type="monotone"
                  dataKey="avgTs"
                  name="Observed TS (°C)"
                  stroke="#F59E0B"
                  strokeWidth={2.2}
                  dot={{ r: 3.5, fill: '#F59E0B' }}
                />
                <Line
                  type="monotone"
                  dataKey="baselineAvgTs"
                  name="30-yr TS Baseline (°C)"
                  stroke="#94A3B8"
                  strokeWidth={1.8}
                  strokeDasharray="4 4"
                  dot={{ r: 3, fill: '#94A3B8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Regional Thermal Comparison */}
      <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
        <h2 className="text-sm font-semibold text-[#ECF3F0] mb-3">
          Cross-Region Thermal Comparison ({daysWindow}-Day Mean)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {comparison.map((c) => (
            <div key={c.regionId} className="p-3.5 rounded-md bg-[#101714] border border-[#1E2B25]">
              <p className="text-xs font-medium text-[#ECF3F0]">{c.regionName}</p>
              <p className="text-[11px] font-mono text-[#6F857C] mt-0.5">{c.district}</p>
              <div className="mt-3 flex items-baseline justify-between font-mono tabular-nums">
                <div>
                  <span className="text-lg font-semibold text-amber-300">
                    {c.avgTs !== null ? `${c.avgTs.toFixed(1)}°C` : '—'}
                  </span>
                  <span className="text-[11px] text-[#7C938A] ml-1.5">TS</span>
                </div>
                <span className="text-xs text-[#9BB0A8]">
                  2m Air: {c.avgT2m !== null ? `${c.avgT2m.toFixed(1)}°C` : '—'}
                </span>
              </div>
              <p className="mt-2 text-[11px] font-mono text-[#7C938A]">
                Anomaly:{' '}
                {c.tsAnomalyC !== null
                  ? `${c.tsAnomalyC >= 0 ? '+' : ''}${c.tsAnomalyC.toFixed(2)} °C`
                  : 'Unavailable'}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Stage 4 Landsat Not Connected Panel */}
      <NotConnectedPanel
        title="Landsat 8 & 9 Collection 2 Level-2 Thermal LST"
        providerName="USGS EarthExplorer / Landsat Archive"
        providerUrl="https://earthexplorer.usgs.gov/"
        stageLabel="Stage 4 — Thermal Satellite Expansion"
        description="High-resolution 30 m Land Surface Temperature uses calibrated ST_B10 surface temperature products with documented scaling (0.00341802 × DN + 149.0 K) and QA_PIXEL cloud filtering. Never approximated from uncalibrated bands or coarse weather grids."
        requiredEnvVars={[]}
        scientificSpecs={[
          { label: 'Thermal Product', value: 'Collection 2 Level-2 ST_B10' },
          { label: 'Spatial Resolution', value: '30 m (from 100 m TIRS)' },
          { label: 'Combined Revisit', value: '8 days (Landsat 8 + 9)' },
          { label: 'Quality Masking', value: 'QA_PIXEL + ST_QA flags' },
        ]}
      />
    </div>
  );
}
