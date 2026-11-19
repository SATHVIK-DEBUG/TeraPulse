import { Upload, X } from 'lucide-react';
import React, { useState } from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';

interface CustomRegionModalProps {
  open: boolean;
  onClose: () => void;
}

const QUICK_PRESETS = [
  {
    label: 'Nagari Hills Watershed',
    district: 'Chittoor / Tirupati Border',
    south: '13.28',
    west: '79.52',
    north: '13.42',
    east: '79.68',
  },
  {
    label: 'Srikalahasti Basin',
    district: 'Tirupati District',
    south: '13.68',
    west: '79.62',
    north: '13.84',
    east: '79.80',
  },
];

export function CustomRegionModal({ open, onClose }: CustomRegionModalProps) {
  const { registerCustomRegion } = useTerraPulse();
  const [mode, setMode] = useState<'bbox' | 'geojson'>('bbox');
  const [name, setName] = useState('');
  const [district, setDistrict] = useState('Tirupati District');
  const [stateName, setStateName] = useState('Andhra Pradesh');
  const [description, setDescription] = useState('');

  const [south, setSouth] = useState('13.28');
  const [west, setWest] = useState('79.52');
  const [north, setNorth] = useState('13.42');
  const [east, setEast] = useState('79.68');

  const [geoJsonText, setGeoJsonText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const content = await file.text();
      setGeoJsonText(content);
      setError(null);
    } catch {
      setError('Unable to read uploaded GeoJSON file.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (mode === 'bbox') {
        await registerCustomRegion({
          name: name.trim(),
          district: district.trim(),
          state: stateName.trim(),
          country: 'India',
          description: description.trim(),
          mode: 'bbox',
          bbox: {
            south: Number(south),
            west: Number(west),
            north: Number(north),
            east: Number(east),
          },
        });
      } else {
        let parsed: unknown;
        try {
          parsed = JSON.parse(geoJsonText);
        } catch {
          throw new Error('GeoJSON text is not valid JSON.');
        }
        await registerCustomRegion({
          name: name.trim(),
          district: district.trim(),
          state: stateName.trim(),
          country: 'India',
          description: description.trim(),
          mode: 'geojson',
          geojson: parsed,
        });
      }
      setName('');
      setDescription('');
      setGeoJsonText('');
      onClose();
    } catch (err: any) {
      setError(err?.message ?? 'Failed to register custom region.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="custom-region-title"
        className="w-full max-w-xl bg-[#111916] border border-[#23322B] rounded-lg overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[#23322B] flex items-center justify-between">
          <div>
            <h2 id="custom-region-title" className="text-base font-semibold text-[#ECF3F0]">
              Add Monitored Geographical Region
            </h2>
            <p className="text-xs text-[#8FA39B] mt-0.5">
              Define custom boundaries via coordinates or GeoJSON. Turf.js subdivides spatial grid cells automatically.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-1.5 rounded text-[#8FA39B] hover:text-[#ECF3F0] hover:bg-[#1A2621]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Mode Switcher */}
          <div className="inline-flex p-1 bg-[#0B100E] border border-[#23322B] rounded-md">
            <button
              type="button"
              onClick={() => setMode('bbox')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'bbox'
                  ? 'bg-[#192620] text-emerald-300'
                  : 'text-[#8FA39B] hover:text-[#ECF3F0]'
              }`}
            >
              Bounding Box
            </button>
            <button
              type="button"
              onClick={() => setMode('geojson')}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                mode === 'geojson'
                  ? 'bg-[#192620] text-emerald-300'
                  : 'text-[#8FA39B] hover:text-[#ECF3F0]'
              }`}
            >
              GeoJSON Polygon
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8FA39B] mb-1">Region Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Nagari Hills Watershed"
                className="w-full px-3 py-2 text-sm bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8FA39B] mb-1">District / Sub-region</label>
              <input
                type="text"
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-[#8FA39B] mb-1">State / Province</label>
              <input
                type="text"
                value={stateName}
                onChange={(e) => setStateName(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
            <div>
              <label className="block text-xs text-[#8FA39B] mb-1">Notes (Optional)</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Watershed or land-use focus"
                className="w-full px-3 py-2 text-sm bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          {mode === 'bbox' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-xs text-[#8FA39B]">Decimal Degrees (WGS84 / EPSG:4326)</span>
                <div className="flex items-center gap-2">
                  {QUICK_PRESETS.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => {
                        setName(p.label);
                        setDistrict(p.district);
                        setSouth(p.south);
                        setWest(p.west);
                        setNorth(p.north);
                        setEast(p.east);
                      }}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 transition-colors"
                    >
                      Use {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'South Lat', val: south, set: setSouth },
                  { label: 'North Lat', val: north, set: setNorth },
                  { label: 'West Lng', val: west, set: setWest },
                  { label: 'East Lng', val: east, set: setEast },
                ].map((f) => (
                  <div key={f.label}>
                    <label className="block text-[11px] font-mono text-[#7C938A] mb-1">
                      {f.label}
                    </label>
                    <input
                      type="number"
                      step="0.001"
                      required
                      value={f.val}
                      onChange={(e) => f.set(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-sm font-mono tabular-nums bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-[#8FA39B]">
                  GeoJSON Polygon / FeatureCollection
                </label>
                <label className="inline-flex items-center gap-1.5 text-xs text-emerald-400 hover:text-emerald-300 cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload .geojson</span>
                  <input
                    type="file"
                    accept=".json,.geojson,application/geo+json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
              </div>
              <textarea
                rows={5}
                required
                value={geoJsonText}
                onChange={(e) => setGeoJsonText(e.target.value)}
                placeholder='{"type":"Polygon","coordinates":[[[79.48,13.38],[79.62,13.38],[79.62,13.50],[79.48,13.50],[79.48,13.38]]]}'
                className="w-full px-3 py-2 text-xs font-mono bg-[#0B100E] border border-[#23322B] rounded-md text-[#ECF3F0] focus:outline-none focus:border-emerald-500"
              />
            </div>
          )}

          {error && (
            <p className="text-xs text-rose-400 bg-rose-950/30 border border-rose-900/60 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="pt-2 flex items-center justify-end gap-2.5 border-t border-[#1E2B25]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-[#9BB0A8] hover:text-[#ECF3F0] rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[#05140E] rounded-md transition-colors"
            >
              {submitting ? 'Creating Grid...' : 'Create Region'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
