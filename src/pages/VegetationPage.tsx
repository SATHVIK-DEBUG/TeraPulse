import { Calculator, Info } from 'lucide-react';
import React, { useState } from 'react';
import { NotConnectedPanel } from '../components/NotConnectedPanel';
import { useTerraPulse } from '../context/TerraPulseContext';
import { calculateNDVI } from '../shared/algorithms';

const NDVI_LEGEND = [
  {
    range: 'Below 0.0',
    color: '#3B82F6',
    label: 'Water, clouds, or non-vegetated surfaces',
    note: 'Context-dependent; always inspect Sentinel-2 Scene Classification Layer (SCL) to rule out cloud cover.',
  },
  {
    range: '0.0 – 0.2',
    color: '#A16207',
    label: 'Little or no vegetation',
    note: 'Bare soil, rocky outcrops, built-up corridors, or dry-season fallow agricultural fields.',
  },
  {
    range: '0.2 – 0.4',
    color: '#CA8A04',
    label: 'Sparse vegetation',
    note: 'Dry scrubland, early crop emergence, or seasonal senescent grass cover.',
  },
  {
    range: '0.4 – 0.6',
    color: '#22C55E',
    label: 'Moderate vegetation',
    note: 'Active croplands, mango orchards, and mixed semi-deciduous shrub canopy.',
  },
  {
    range: 'Above 0.6',
    color: '#15803D',
    label: 'Dense vegetation',
    note: 'Dense woodland canopy (e.g., Nagari / Seshachalam hills) or peak-vigor irrigated crops.',
  },
];

export function VegetationPage() {
  const { activeRegion } = useTerraPulse();

  // Deterministic NDVI Algorithm Verification Calculator (clearly separated from live satellite imagery)
  const [nirInput, setNirInput] = useState('0.48');
  const [redInput, setRedInput] = useState('0.12');

  const calcResult = calculateNDVI(Number(nirInput), Number(redInput));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="pb-5 border-b border-[#23322B]">
        <p className="text-xs font-mono text-[#7C938A]">
          Optical Vegetation Analysis · {activeRegion?.name ?? 'Puttur Pilot Basin'} · Stage 3 Pending
        </p>
        <h1 className="mt-1 text-2xl font-semibold text-[#ECF3F0]">Vegetation Intelligence</h1>
        <p className="mt-1 text-xs text-[#9BB0A8] max-w-3xl">
          Sentinel-2 Level-2A multispectral NDVI monitoring is architected for Stage 3. Under strict
          scientific reliability rules, no synthetic or demo NDVI curves are displayed prior to live
          Copernicus Data Space connection.
        </p>
      </div>

      {/* Transparent Stage 3 Not Connected Panel */}
      <NotConnectedPanel
        title="Sentinel-2 Level-2A Vegetation Imagery (NDVI)"
        providerName="Copernicus Data Space Ecosystem"
        providerUrl="https://dataspace.copernicus.eu/"
        stageLabel="Stage 3 — Satellite Imagery Connector"
        description="Sentinel-2 optical ingestion computes surface reflectance NDVI = (Band 8 NIR − Band 4 RED) / (Band 8 NIR + Band 4 RED) after masking clouds and cloud shadows using the Level-2A Scene Classification Layer (SCL). Optional future integration — requires no credentials in Stages 1 & 2."
        requiredEnvVars={[]}
        scientificSpecs={[
          { label: 'Primary Formula', value: '(B08 − B04) / (B08 + B04)' },
          { label: 'NIR / RED Bands', value: 'Band 8 (842nm) / Band 4 (665nm)' },
          { label: 'Spatial Resolution', value: '10 m optical pixels' },
          { label: 'Cloud Safeguard', value: 'SCL cloud & shadow masking' },
        ]}
      />

      {/* Scientific Safeguards + Indicative Legend */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5">
        <div className="xl:col-span-7 bg-[#141D19] border border-[#23322B] rounded-lg p-5">
          <h2 className="text-sm font-semibold text-[#ECF3F0]">
            Indicative NDVI Interpretation Legend
          </h2>
          <p className="text-xs text-[#8FA39B] mt-1 mb-4">
            Ranges below are indicative reference intervals — not universal land-cover
            classifications. Seasonal crop harvesting in Andhra Pradesh causes temporary NDVI drops
            that must not be misclassified as permanent land degradation.
          </p>

          <div className="divide-y divide-[#1E2B25]">
            {NDVI_LEGEND.map((item) => (
              <div key={item.range} className="py-3 flex items-start gap-3">
                <span
                  className="w-3.5 h-3.5 rounded-xs mt-0.5 shrink-0 border border-white/15"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-mono font-semibold text-[#ECF3F0]">
                      {item.range}
                    </span>
                    <span className="text-xs font-medium text-[#CFE0D9]">{item.label}</span>
                  </div>
                  <p className="text-xs text-[#7F958C] mt-0.5 leading-relaxed">{item.note}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Deterministic NDVI Formula Verifier */}
        <div className="xl:col-span-5 bg-[#141D19] border border-[#23322B] rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-semibold text-[#ECF3F0]">
                Deterministic NDVI Formula Verifier
              </h2>
            </div>
            <p className="text-xs text-[#8FA39B] mt-1 leading-relaxed">
              Test TerraPulse’s verified Stage 3 algorithm directly using sample Sentinel-2 Level-2A
              surface reflectance values (0.0 to 1.0). This is a mathematical verification tool, not
              a live satellite observation.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ndvi-nir-input"
                  className="block text-[11px] font-mono text-[#7C938A] mb-1"
                >
                  Band 8 NIR (842 nm)
                </label>
                <input
                  id="ndvi-nir-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={nirInput}
                  onChange={(e) => setNirInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
                />
              </div>
              <div>
                <label
                  htmlFor="ndvi-red-input"
                  className="block text-[11px] font-mono text-[#7C938A] mb-1"
                >
                  Band 4 RED (665 nm)
                </label>
                <input
                  id="ndvi-red-input"
                  type="number"
                  step="0.01"
                  min="0"
                  max="1"
                  value={redInput}
                  onChange={(e) => setRedInput(e.target.value)}
                  className="w-full px-3 py-2 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
                />
              </div>
            </div>

            <div className="mt-4 p-4 rounded-md bg-[#0E1512] border border-[#23322B]">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-mono text-[#7C938A]">Computed NDVI</span>
                <span className="text-2xl font-mono font-semibold tabular-nums text-emerald-400">
                  {calcResult.ndvi !== null ? calcResult.ndvi.toFixed(4) : 'Invalid'}
                </span>
              </div>
              <p className="mt-2 text-xs font-medium text-[#ECF3F0]">{calcResult.bandLabel}</p>
              <p className="mt-1 text-xs text-[#8FA39B] leading-relaxed">
                {calcResult.interpretation}
              </p>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#1E2B25] flex items-start gap-2 text-[11px] text-[#7C938A]">
            <Info className="w-3.5 h-3.5 text-cyan-400 mt-0.5 shrink-0" />
            <span>{calcResult.caveat}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
