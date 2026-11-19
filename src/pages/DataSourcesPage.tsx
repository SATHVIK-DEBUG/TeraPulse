import { Activity, Code2, Download, ExternalLink, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { DataSourceInfo } from '../shared/types';

export function DataSourcesPage() {
  const [sources, setSources] = useState<DataSourceInfo[]>([]);
  const [cacheStats, setCacheStats] = useState({
    dailyEntries: 0,
    climatologyEntries: 0,
    totalEntries: 0,
  });
  const [probing, setProbing] = useState(false);
  const [probeMessage, setProbeMessage] = useState<string | null>(null);
  const [schemaSql, setSchemaSql] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);

  const loadSources = async () => {
    try {
      const res = await api.getSources();
      setSources(res.sources);
      setCacheStats(res.cache);
    } catch (err) {
      console.error('Failed to load sources:', err);
    }
  };

  useEffect(() => {
    loadSources();
  }, []);

  const handleProbeNasa = async () => {
    setProbing(true);
    setProbeMessage(null);
    try {
      const res = await api.probeNasaPower();
      setSources(res.sources);
      setCacheStats(res.cache);
      if (res.probe.connected) {
        setProbeMessage(
          `NASA POWER live probe succeeded in ${res.probe.latencyMs} ms (NASA server UTC date: ${res.probe.serverUtcDate ?? 'verified'}).`
        );
      } else {
        setProbeMessage(`NASA POWER probe failed: ${res.probe.error}`);
      }
    } catch (err: any) {
      setProbeMessage(`Probe error: ${err?.message}`);
    } finally {
      setProbing(false);
    }
  };

  const handleToggleSchema = async () => {
    if (!showSchema && !schemaSql) {
      try {
        const sql = await api.getSupabaseSchema();
        setSchemaSql(sql);
      } catch {
        setSchemaSql('-- Unable to load SQL schema blueprint.');
      }
    }
    setShowSchema((v) => !v);
  };

  const handleDownloadSchema = async () => {
    const sql = schemaSql ?? (await api.getSupabaseSchema());
    const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'terrapulse_supabase_postgis_schema.sql';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pb-5 border-b border-[#23322B]">
        <div>
          <p className="text-xs font-mono text-[#7C938A]">
            Zero-Cost Architecture · Modular Connector Registry
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Data Sources</h1>
          <p className="mt-1 text-xs text-[#9BB0A8] max-w-2xl">
            Stage 1 & 2 run exclusively on the public, unauthenticated NASA POWER API and a modular
            local server cache (₹0 operational cost). Future satellite and PostGIS connectors remain
            optional and explicitly marked Not Connected.
          </p>
        </div>

        <button
          type="button"
          onClick={handleProbeNasa}
          disabled={probing}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[#05140E] font-medium text-xs transition-colors whitespace-nowrap self-start"
        >
          {probing ? (
            <Activity className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>Test NASA POWER Connection</span>
        </button>
      </div>

      {probeMessage && (
        <div className="p-3.5 rounded-lg border border-emerald-500/35 bg-emerald-950/20 text-xs font-mono text-emerald-300">
          {probeMessage}
        </div>
      )}

      {/* Local Server Cache Summary */}
      <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[#9BB0A8]">
          <span>
            Active Persistence: <strong className="text-[#ECF3F0]">Local Modular Cache</strong>
          </span>
          <span aria-hidden="true">·</span>
          <span>Daily Cache Keys: {cacheStats.dailyEntries}</span>
          <span aria-hidden="true">·</span>
          <span>Climatology Keys: {cacheStats.climatologyEntries}</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleToggleSchema}
            className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>{showSchema ? 'Hide PostGIS SQL Blueprint' : 'Inspect PostGIS SQL Blueprint'}</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadSchema}
            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download .sql</span>
          </button>
        </div>
      </div>

      {/* Expandable 12-table PostGIS SQL Viewer */}
      {showSchema && (
        <div className="bg-[#0E1512] border border-[#23322B] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[#23322B] flex items-center justify-between text-xs font-mono text-[#8FA39B]">
            <span>Supabase PostgreSQL + PostGIS 12-Table Migration Blueprint (Optional Future Migration)</span>
            <span>EPSG:4326 + GIST + RLS</span>
          </div>
          <pre className="p-4 text-[11px] font-mono text-[#B7C9C2] overflow-x-auto max-h-[360px] overflow-y-auto leading-relaxed">
            {schemaSql ?? 'Loading schema...'}
          </pre>
        </div>
      )}

      {/* Provider Cards Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {sources.map((src) => {
          const isConnected = src.status === 'connected';
          return (
            <div
              key={src.id}
              className={`rounded-lg p-5 border flex flex-col justify-between ${
                isConnected
                  ? 'bg-[#141D19] border-emerald-500/35'
                  : 'bg-[#111916] border-[#23322B]'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-mono text-[#7C938A]">{src.stage}</p>
                    <h2 className="text-base font-semibold text-[#ECF3F0] mt-0.5">{src.name}</h2>
                  </div>
                  <span
                    className={`text-[11px] font-mono px-2.5 py-0.5 rounded border whitespace-nowrap ${
                      isConnected
                        ? 'text-emerald-300 border-emerald-500/40 bg-emerald-950/30'
                        : src.status === 'coming_soon'
                        ? 'text-cyan-300 border-cyan-500/35 bg-cyan-950/20'
                        : 'text-[#8FA39B] border-[#2C3E36] bg-[#16201B]'
                    }`}
                  >
                    {isConnected
                      ? 'Connected · Live'
                      : src.status === 'coming_soon'
                      ? 'Coming Soon'
                      : 'Not Connected'}
                  </span>
                </div>

                <p className="mt-2.5 text-xs text-[#9BB0A8] leading-relaxed">{src.purpose}</p>

                <div className="mt-4 grid grid-cols-2 gap-3 text-[11px] font-mono">
                  <div>
                    <span className="text-[#6F857C] block">Spatial Resolution</span>
                    <span className="text-[#DCE8E3]">{src.spatialResolution}</span>
                  </div>
                  <div>
                    <span className="text-[#6F857C] block">Temporal Cadence</span>
                    <span className="text-[#DCE8E3]">{src.temporalCadence}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t border-[#1E2B25] text-xs text-[#8FA39B]">
                  <p className="leading-relaxed">{src.setupInstructions}</p>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-[#1E2B25] flex items-center justify-between gap-2 text-[11px] font-mono text-[#7C938A]">
                <a
                  href={src.providerUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-cyan-400 hover:underline truncate"
                >
                  <span>{src.providerUrl.replace(/^https?:\/\//, '')}</span>
                  <ExternalLink className="w-3 h-3 shrink-0" />
                </a>
                {isConnected && src.latencyMs !== null && (
                  <span className="text-emerald-400 whitespace-nowrap">
                    Last latency: {src.latencyMs} ms
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
