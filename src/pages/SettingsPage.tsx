import { Check, RefreshCw, RotateCcw, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';
import { api } from '../services/api';
import { DEFAULT_THRESHOLDS } from '../shared/algorithms';
import type { MapBasemapId, ThresholdConfig } from '../shared/types';

export function SettingsPage() {
  const { thresholds, saveThresholds, refreshLiveTelemetry } = useTerraPulse();
  const [form, setForm] = useState<ThresholdConfig>(thresholds);
  const [saving, setSaving] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [cacheMessage, setCacheMessage] = useState<string | null>(null);

  useEffect(() => {
    setForm(thresholds);
  }, [thresholds]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await saveThresholds(form);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setForm(DEFAULT_THRESHOLDS);
    setSaving(true);
    try {
      await saveThresholds(DEFAULT_THRESHOLDS);
      setSavedToast(true);
      setTimeout(() => setSavedToast(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  const handleClearCache = async () => {
    const res = await api.clearCache();
    setCacheMessage(`Cleared ${res.cleared} cached observation bundle(s). Next request will query NASA POWER live.`);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="pb-5 border-b border-[#23322B]">
        <p className="text-xs font-mono text-[#7C938A]">Deterministic Scoring & Map Configuration</p>
        <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Settings</h1>
        <p className="mt-1 text-xs text-[#9BB0A8]">
          Calibrate deterministic anomaly thresholds used across Overview, Map, and Risk Detection.
          Changes persist in the local server repository and immediately recompute regional statuses.
        </p>
      </div>

      {/* Threshold Calibration Form */}
      <form
        onSubmit={handleSave}
        className="bg-[#141D19] border border-[#23322B] rounded-lg p-5 space-y-6"
      >
        <div>
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Thermal Anomaly Thresholds (Earth Skin Temp TS vs. 30-Year Baseline)
          </h2>
          <p className="text-xs text-[#8FA39B] mt-0.5">
            Positive deviation (°C) required to classify regional skin temperature into Watch,
            Elevated, or High risk.
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: 'tempAnomalyWatchC' as const, label: 'Watch Threshold (+°C)' },
              { key: 'tempAnomalyElevatedC' as const, label: 'Elevated Threshold (+°C)' },
              { key: 'tempAnomalyHighC' as const, label: 'High Threshold (+°C)' },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                  {field.label}
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={form[field.key]}
                  onChange={(e) => setForm({ ...form, [field.key]: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="pt-5 border-t border-[#1E2B25]">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Precipitation Anomaly & Dry-Spell Thresholds
          </h2>
          <p className="text-xs text-[#8FA39B] mt-0.5">
            Percentage deviation from 30-year monthly rainfall baseline and consecutive dry-day
            streaks (&lt; 1.0 mm/day).
          </p>
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Rainfall Deficit Watch (%)
              </label>
              <input
                type="number"
                step="1"
                max="0"
                value={form.rainfallDeficitWatchPct}
                onChange={(e) =>
                  setForm({ ...form, rainfallDeficitWatchPct: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Rainfall Deficit Elevated (%)
              </label>
              <input
                type="number"
                step="1"
                max="0"
                value={form.rainfallDeficitElevatedPct}
                onChange={(e) =>
                  setForm({ ...form, rainfallDeficitElevatedPct: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Rainfall Excess Watch (+%)
              </label>
              <input
                type="number"
                step="1"
                min="10"
                value={form.rainfallExcessWatchPct}
                onChange={(e) =>
                  setForm({ ...form, rainfallExcessWatchPct: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Consecutive Dry Days (Watch)
              </label>
              <input
                type="number"
                step="1"
                min="3"
                value={form.consecutiveDryDaysWatch}
                onChange={(e) =>
                  setForm({ ...form, consecutiveDryDaysWatch: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Consecutive Dry Days (Elevated)
              </label>
              <input
                type="number"
                step="1"
                min="5"
                value={form.consecutiveDryDaysElevated}
                onChange={(e) =>
                  setForm({ ...form, consecutiveDryDaysElevated: Number(e.target.value) })
                }
                className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              />
            </div>
            <div>
              <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                Default Map Basemap
              </label>
              <select
                value={form.defaultBasemap}
                onChange={(e) =>
                  setForm({ ...form, defaultBasemap: e.target.value as MapBasemapId })
                }
                className="w-full px-3 py-2 text-sm bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0]"
              >
                <option value="dark_carto">Dark Carto (Default)</option>
                <option value="osm_standard">OpenStreetMap Standard</option>
                <option value="topo">OpenTopoMap Relief</option>
              </select>
            </div>
          </div>
        </div>

        <div className="pt-4 border-t border-[#1E2B25] flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 text-xs text-[#8FA39B] hover:text-[#ECF3F0]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Scientific Defaults</span>
          </button>

          <div className="flex items-center gap-3">
            {savedToast && (
              <span className="inline-flex items-center gap-1 text-xs font-mono text-emerald-400">
                <Check className="w-3.5 h-3.5" />
                Saved & Recomputed
              </span>
            )}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[#05140E] font-medium text-xs transition-colors"
            >
              {saving ? 'Saving...' : 'Save Thresholds'}
            </button>
          </div>
        </div>
      </form>

      {/* Cache & Data Hygiene Controls */}
      <section className="bg-[#141D19] border border-[#23322B] rounded-lg p-5 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-[#ECF3F0]">Local Server Cache Management</h2>
          <p className="text-xs text-[#8FA39B] mt-0.5">
            NASA POWER daily bundles cache for 6 hours and 30-year climatology baselines cache for
            7 days to respect upstream rate limits.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => refreshLiveTelemetry(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-[#23322B] bg-[#101714] hover:bg-[#19241F] text-xs font-medium text-[#ECF3F0]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>Force Refresh Active Region</span>
          </button>

          <button
            type="button"
            onClick={handleClearCache}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md border border-rose-900/60 bg-rose-950/20 hover:bg-rose-950/35 text-xs font-medium text-rose-300"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Local Observation Cache</span>
          </button>
        </div>

        {cacheMessage && (
          <p className="text-xs font-mono text-cyan-300">{cacheMessage}</p>
        )}
      </section>
    </div>
  );
}
