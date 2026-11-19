import { Download, Search } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTerraPulse } from '../context/TerraPulseContext';
import { api } from '../services/api';
import { NASA_INDICATOR_METADATA } from '../shared/algorithms';
import type { NasaIndicatorKey, RegionalTelemetryResponse } from '../shared/types';

const SELECTABLE_INDICATORS: NasaIndicatorKey[] = [
  'TS',
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'PRECTOTCORR',
  'RH2M',
  'ALLSKY_SFC_SW_DWN',
  'WS2M',
];

function getRecordIndicatorValue(
  rec: RegionalTelemetryResponse['dailyRecords'][number],
  key: NasaIndicatorKey
): number | null {
  switch (key) {
    case 'T2M':
      return rec.t2m;
    case 'T2M_MAX':
      return rec.t2mMax;
    case 'T2M_MIN':
      return rec.t2mMin;
    case 'TS':
      return rec.ts;
    case 'PRECTOTCORR':
      return rec.prectotcorr;
    case 'RH2M':
      return rec.rh2m;
    case 'ALLSKY_SFC_SW_DWN':
      return rec.solarRadiation;
    case 'WS2M':
      return rec.ws2m;
  }
}

export function HistoricalAnalysisPage() {
  const { regions, activeRegionId, telemetry } = useTerraPulse();

  const [regionId, setRegionId] = useState<string>(activeRegionId);
  const [compareRegionId, setCompareRegionId] = useState<string>('tirupati-ap');
  const [indicator, setIndicator] = useState<NasaIndicatorKey>('TS');

  // Anchor default date pickers to the latest verified live window from NASA POWER
  const [startDate, setStartDate] = useState<string>(
    telemetry?.statistics.observationStartDate ?? '2025-01-01'
  );
  const [endDate, setEndDate] = useState<string>(
    telemetry?.statistics.observationEndDate ?? '2025-03-31'
  );

  const [primaryData, setPrimaryData] = useState<RegionalTelemetryResponse | null>(telemetry);
  const [comparisonData, setComparisonData] = useState<RegionalTelemetryResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Table search & quality filter
  const [tableSearch, setTableSearch] = useState('');
  const [qualityFilter, setQualityFilter] = useState<'all' | 'valid' | 'missing'>('all');

  useEffect(() => {
    setRegionId(activeRegionId);
    if (compareRegionId === activeRegionId) {
      const other = regions.find((r) => r.id !== activeRegionId);
      setCompareRegionId(other?.id ?? '');
    }
  }, [activeRegionId, regions]);

  useEffect(() => {
    if (telemetry?.statistics.observationStartDate && telemetry?.statistics.observationEndDate) {
      setStartDate(telemetry.statistics.observationStartDate);
      setEndDate(telemetry.statistics.observationEndDate);
      setPrimaryData(telemetry);
    }
  }, [telemetry?.region.id, telemetry?.statistics.observationEndDate]);

  const runHistoricalQuery = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await api.getHistorical({
        regionId,
        startDate,
        endDate,
        compareRegionId: compareRegionId || undefined,
      });
      setPrimaryData(res.primary);
      setComparisonData(res.comparison);
    } catch (err: any) {
      setError(err?.message ?? 'Historical query failed.');
    } finally {
      setLoading(false);
    }
  };

  const indicatorMeta = NASA_INDICATOR_METADATA[indicator];

  const chartSeries = useMemo(() => {
    const primaryRecords = primaryData?.dailyRecords ?? [];
    const compMap = new Map(
      (comparisonData?.dailyRecords ?? []).map((r) => [r.date, getRecordIndicatorValue(r, indicator)])
    );

    return primaryRecords.map((r) => ({
      date: r.date.slice(5),
      fullDate: r.date,
      primary: getRecordIndicatorValue(r, indicator),
      comparison: compMap.get(r.date) ?? null,
    }));
  }, [primaryData, comparisonData, indicator]);

  const baselineLineValue = useMemo(() => {
    if (!primaryData) return null;
    if (indicator === 'TS') return primaryData.statistics.baselineTs;
    if (indicator === 'T2M') return primaryData.statistics.baselineT2m;
    return null;
  }, [primaryData, indicator]);

  const filteredTableRows = useMemo(() => {
    const rows = [...(primaryData?.dailyRecords ?? [])].reverse();
    return rows.filter((r) => {
      if (tableSearch && !r.date.includes(tableSearch.trim())) return false;
      const flag = r.qualityFlags[indicator];
      if (qualityFilter === 'valid' && flag !== 'valid') return false;
      if (qualityFilter === 'missing' && flag === 'valid') return false;
      return true;
    });
  }, [primaryData, indicator, tableSearch, qualityFilter]);

  const csvHref = api.buildCsvExportUrl({ regionId, startDate, endDate });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Multi-Date Time Series · Live NASA POWER Archive
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Historical Analysis</h1>
          <p className="mt-1 text-xs text-[#9BB0A8]">
            Query custom date spans, overlay comparison regions, audit observation quality flags,
            and download verifiable CSV datasets.
          </p>
        </div>

        <a
          href={csvHref}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 text-[#05140E] font-medium text-xs transition-colors whitespace-nowrap self-start"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Download CSV Report</span>
        </a>
      </div>

      {/* Query Control Form */}
      <form
        onSubmit={runHistoricalQuery}
        className="bg-[#141D19] border border-[#23322B] rounded-lg p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
      >
        <div>
          <label className="block text-[11px] font-mono text-[#7C938A] mb-1">Primary Region</label>
          <select
            value={regionId}
            onChange={(e) => setRegionId(e.target.value)}
            className="w-full px-2.5 py-2 text-xs bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
          >
            {regions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#7C938A] mb-1">Compare With</label>
          <select
            value={compareRegionId}
            onChange={(e) => setCompareRegionId(e.target.value)}
            className="w-full px-2.5 py-2 text-xs bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
          >
            <option value="">None</option>
            {regions
              .filter((r) => r.id !== regionId)
              .map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#7C938A] mb-1">Indicator</label>
          <select
            value={indicator}
            onChange={(e) => setIndicator(e.target.value as NasaIndicatorKey)}
            className="w-full px-2.5 py-2 text-xs bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
          >
            {SELECTABLE_INDICATORS.map((k) => (
              <option key={k} value={k}>
                {NASA_INDICATOR_METADATA[k].shortLabel} ({NASA_INDICATOR_METADATA[k].unit})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#7C938A] mb-1">Start Date</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            required
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
          />
        </div>

        <div>
          <label className="block text-[11px] font-mono text-[#7C938A] mb-1">End Date</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            required
            className="w-full px-2.5 py-1.5 text-xs font-mono bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 rounded-md bg-[#1B2B24] hover:bg-[#23382E] border border-emerald-500/40 text-emerald-300 text-xs font-medium transition-colors whitespace-nowrap"
        >
          {loading ? 'Querying NASA...' : 'Run Historical Query'}
        </button>
      </form>

      {error && (
        <div className="p-3.5 rounded-lg border border-rose-900/70 bg-rose-950/25 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* Time-Series Chart */}
      <section className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#ECF3F0]">
              {indicatorMeta.label} ({indicatorMeta.unit})
            </h2>
            <p className="text-xs text-[#8FA39B] mt-0.5">{indicatorMeta.description}</p>
          </div>
          {primaryData && (
            <div className="text-[11px] font-mono text-[#7C938A] tabular-nums">
              Source: {primaryData.source.provider} · {primaryData.statistics.validObservationDays}/
              {primaryData.statistics.totalDaysRequested} valid days
            </div>
          )}
        </div>

        <div className="h-[300px] w-full">
          {loading ? (
            <div className="h-full rounded bg-[#101714] animate-pulse" />
          ) : chartSeries.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-[#7C938A]">
              Run a query to load historical NASA POWER observations.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartSeries} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid stroke="#1E2C26" strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="#647A71"
                  tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  minTickGap={26}
                />
                <YAxis
                  stroke="#647A71"
                  tick={{ fill: '#7C938A', fontSize: 11, fontFamily: 'JetBrains Mono' }}
                  domain={['auto', 'auto']}
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
                {baselineLineValue !== null && (
                  <ReferenceLine
                    y={baselineLineValue}
                    stroke="#94A3B8"
                    strokeDasharray="4 4"
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="primary"
                  name={`${primaryData?.region.name ?? 'Primary'} (${indicatorMeta.unit})`}
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={false}
                  connectNulls={false}
                />
                {comparisonData && (
                  <Line
                    type="monotone"
                    dataKey="comparison"
                    name={`${comparisonData.region.name} (${indicatorMeta.unit})`}
                    stroke="#06B6D4"
                    strokeWidth={1.75}
                    dot={false}
                    connectNulls={false}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Auditable Raw Observations Table */}
      <section className="bg-[#141D19] border border-[#23322B] rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-sm font-semibold text-[#ECF3F0]">
              Daily Observation Audit Log ({filteredTableRows.length} rows)
            </h2>
            <p className="text-xs text-[#8FA39B] mt-0.5">
              Every observation carries explicit quality flags and provenance. Missing values are
              never substituted.
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#0B100E] border border-[#23322B] rounded-md px-2.5 py-1">
              <Search className="w-3.5 h-3.5 text-[#7C938A] mr-2" />
              <input
                type="text"
                value={tableSearch}
                onChange={(e) => setTableSearch(e.target.value)}
                placeholder="Filter date (YYYY-MM)..."
                className="bg-transparent text-xs font-mono text-[#ECF3F0] placeholder:text-[#647A71] w-36 focus:outline-none"
              />
            </div>

            <div className="inline-flex p-0.5 bg-[#0B100E] border border-[#23322B] rounded-md text-[11px] font-mono">
              {(['all', 'valid', 'missing'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setQualityFilter(f)}
                  className={`px-2.5 py-1 rounded capitalize transition-colors ${
                    qualityFilter === f
                      ? 'bg-[#1B2B24] text-emerald-300'
                      : 'text-[#8FA39B] hover:text-[#ECF3F0]'
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
          <table className="w-full text-left border-collapse text-xs font-mono tabular-nums">
            <thead className="sticky top-0 bg-[#141D19] z-10">
              <tr className="border-b border-[#23322B] text-[11px] text-[#7C938A]">
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 px-3 font-medium text-right">Skin TS (°C)</th>
                <th className="py-2 px-3 font-medium text-right">2m Air (°C)</th>
                <th className="py-2 px-3 font-medium text-right">Rain (mm)</th>
                <th className="py-2 px-3 font-medium text-right">Humidity (%)</th>
                <th className="py-2 px-3 font-medium text-right">Solar (MJ/m²)</th>
                <th className="py-2 pl-3 font-medium">Quality ({indicator})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1C2822]">
              {filteredTableRows.slice(0, 120).map((row) => {
                const flag = row.qualityFlags[indicator];
                return (
                  <tr key={row.date} className="hover:bg-[#19241F]">
                    <td className="py-2 pr-3 text-[#ECF3F0]">{row.date}</td>
                    <td className="py-2 px-3 text-right text-amber-300">
                      {row.ts !== null ? row.ts.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-300">
                      {row.t2m !== null ? row.t2m.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-cyan-300">
                      {row.prectotcorr !== null ? row.prectotcorr.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-[#B7C9C2]">
                      {row.rh2m !== null ? row.rh2m.toFixed(0) : '—'}
                    </td>
                    <td className="py-2 px-3 text-right text-[#B7C9C2]">
                      {row.solarRadiation !== null ? row.solarRadiation.toFixed(1) : '—'}
                    </td>
                    <td className="py-2 pl-3">
                      <span
                        className={
                          flag === 'valid'
                            ? 'text-emerald-400'
                            : flag === 'outlier_flagged'
                            ? 'text-rose-400'
                            : 'text-[#7C938A]'
                        }
                      >
                        {flag}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
