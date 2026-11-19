import L from 'leaflet';
import {
  Crosshair,
  Layers,
  MapPin,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { CustomRegionModal } from '../components/CustomRegionModal';
import { useTerraPulse } from '../context/TerraPulseContext';
import { api } from '../services/api';
import type {
  CellTelemetryResponse,
  GeographicalCell,
  MapBasemapId,
  MapLayerId,
} from '../shared/types';

const BASEMAPS: Record<
  MapBasemapId,
  { label: string; url: string; attribution: string }
> = {
  dark_carto: {
    label: 'Dark Carto',
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
  },
  osm_standard: {
    label: 'OpenStreetMap',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors',
  },
  topo: {
    label: 'OpenTopoMap',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap contributors, SRTM | OpenTopoMap',
  },
};

interface LayerMeta {
  id: MapLayerId;
  label: string;
  provider: string;
  connected: boolean;
  stage: string;
  legend: Array<{ color: string; label: string }>;
}

const MAP_LAYERS: LayerMeta[] = [
  {
    id: 'nasa_temp',
    label: 'Earth Skin Temperature (TS)',
    provider: 'NASA POWER Live (0.5° grid)',
    connected: true,
    stage: 'Live',
    legend: [
      { color: '#0EA5E9', label: '< 24 °C' },
      { color: '#10B981', label: '24 – 30 °C' },
      { color: '#F59E0B', label: '30 – 35 °C' },
      { color: '#EF4444', label: '> 35 °C' },
      { color: '#475569', label: 'Missing Data' },
    ],
  },
  {
    id: 'nasa_rainfall',
    label: 'Rainfall Anomaly',
    provider: 'NASA POWER Live (PRECTOTCORR)',
    connected: true,
    stage: 'Live',
    legend: [
      { color: '#EF4444', label: '< -30% Deficit' },
      { color: '#F59E0B', label: '-30% to -10%' },
      { color: '#10B981', label: '-10% to +25% Normal' },
      { color: '#06B6D4', label: '> +25% Wet' },
      { color: '#475569', label: 'Missing / Low Base' },
    ],
  },
  {
    id: 'sentinel_ndvi',
    label: 'Vegetation Health (NDVI)',
    provider: 'Sentinel-2 L2A',
    connected: false,
    stage: 'Stage 3 · Not Connected',
    legend: [
      { color: '#3B82F6', label: '< 0 Water / Cloud' },
      { color: '#A16207', label: '0.0 – 0.2 Bare' },
      { color: '#CA8A04', label: '0.2 – 0.4 Sparse' },
      { color: '#22C55E', label: '0.4 – 0.6 Moderate' },
      { color: '#15803D', label: '> 0.6 Dense' },
    ],
  },
  {
    id: 'landsat_lst',
    label: '30m Thermal LST',
    provider: 'Landsat 8 & 9',
    connected: false,
    stage: 'Stage 4 · Not Connected',
    legend: [
      { color: '#475569', label: 'Awaiting USGS Thermal L2' },
    ],
  },
  {
    id: 'composite_risk',
    label: 'Multi-Source Risk Overlay',
    provider: 'Stage 5 Satellite Fusion',
    connected: false,
    stage: 'Stage 5 · Partial (Weather Only)',
    legend: [
      { color: '#10B981', label: 'Normal' },
      { color: '#F59E0B', label: 'Watch' },
      { color: '#F97316', label: 'Elevated' },
      { color: '#EF4444', label: 'High' },
    ],
  },
];

function getTempColor(ts: number | null | undefined): string {
  if (ts === null || ts === undefined) return '#475569';
  if (ts < 24) return '#0EA5E9';
  if (ts < 30) return '#10B981';
  if (ts < 35) return '#F59E0B';
  return '#EF4444';
}

function getRainAnomalyColor(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '#475569';
  if (pct < -30) return '#EF4444';
  if (pct < -10) return '#F59E0B';
  if (pct <= 25) return '#10B981';
  return '#06B6D4';
}

export function LiveMapPage() {
  const {
    regions,
    activeRegion,
    activeRegionId,
    setActiveRegionId,
    telemetry,
    thresholds,
    removeCustomRegion,
  } = useTerraPulse();

  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const boundaryLayerRef = useRef<L.GeoJSON | null>(null);
  const cellsLayerRef = useRef<L.LayerGroup | null>(null);
  const searchMarkerRef = useRef<L.CircleMarker | null>(null);

  const [activeLayer, setActiveLayer] = useState<MapLayerId>('nasa_temp');
  const [basemap, setBasemap] = useState<MapBasemapId>(thresholds.defaultBasemap || 'dark_carto');
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);

  // Selected Cell Telemetry Inspector
  const [selectedCell, setSelectedCell] = useState<GeographicalCell | null>(null);
  const [cellTelemetry, setCellTelemetry] = useState<CellTelemetryResponse | null>(null);
  const [cellLoading, setCellLoading] = useState<boolean>(false);
  const [cellError, setCellError] = useState<string | null>(null);

  // Location Search (Nominatim proxy)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{ displayName: string; lat: number; lng: number; type: string }>
  >([]);
  const [searching, setSearching] = useState(false);

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [13.4419, 79.5531], // Puttur, Andhra Pradesh
      zoom: 11,
      zoomControl: true,
    });

    mapRef.current = map;
    cellsLayerRef.current = L.layerGroup().addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
      boundaryLayerRef.current = null;
      cellsLayerRef.current = null;
    };
  }, []);

  // Update Basemap Tile Layer
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }
    const cfg = BASEMAPS[basemap];
    tileLayerRef.current = L.tileLayer(cfg.url, {
      attribution: cfg.attribution,
      maxZoom: 18,
    }).addTo(map);
  }, [basemap]);

  // Render Region Boundary + Interactive Spatial Grid Cells
  useEffect(() => {
    const map = mapRef.current;
    const cellsGroup = cellsLayerRef.current;
    if (!map || !cellsGroup || !activeRegion) return;

    if (boundaryLayerRef.current) {
      map.removeLayer(boundaryLayerRef.current);
      boundaryLayerRef.current = null;
    }
    cellsGroup.clearLayers();

    // Draw Region Outer Boundary
    const boundaryLayer = L.geoJSON(activeRegion.boundary, {
      style: {
        color: '#10B981',
        weight: 2,
        opacity: 0.9,
        fillColor: '#10B981',
        fillOpacity: 0.05,
        dashArray: '5 4',
      },
    }).addTo(map);
    boundaryLayerRef.current = boundaryLayer;

    // Fit viewport smoothly to region bounds
    const bounds = boundaryLayer.getBounds();
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [36, 36], maxZoom: 12 });
    }

    if (!showGrid) return;

    const currentLayerMeta = MAP_LAYERS.find((l) => l.id === activeLayer)!;
    const regionalTs = telemetry?.statistics.avgTs;
    const regionalRainAnom = telemetry?.statistics.rainfallAnomalyPct;

    for (const cell of activeRegion.cells) {
      const isSelected = selectedCell?.id === cell.id;

      let fillColor = '#334155';
      let fillOpacity = 0.14;
      let strokeColor = '#475569';

      if (activeLayer === 'nasa_temp') {
        fillColor = getTempColor(regionalTs);
        fillOpacity = regionalTs !== null && regionalTs !== undefined ? 0.24 : 0.12;
        strokeColor = isSelected ? '#ECF3F0' : fillColor;
      } else if (activeLayer === 'nasa_rainfall') {
        fillColor = getRainAnomalyColor(regionalRainAnom);
        fillOpacity = regionalRainAnom !== null && regionalRainAnom !== undefined ? 0.24 : 0.12;
        strokeColor = isSelected ? '#ECF3F0' : fillColor;
      } else {
        // Unconnected satellite layers render neutral dashed grid cells — NEVER fake NDVI/LST colors!
        fillColor = '#1E293B';
        fillOpacity = 0.08;
        strokeColor = isSelected ? '#06B6D4' : '#475569';
      }

      const cellPolygon = L.geoJSON(cell.geometry, {
        style: {
          color: strokeColor,
          weight: isSelected ? 2.5 : 1,
          opacity: isSelected ? 1 : 0.65,
          fillColor,
          fillOpacity: isSelected ? Math.min(0.45, fillOpacity + 0.18) : fillOpacity,
          dashArray: currentLayerMeta.connected ? undefined : '3 3',
        },
      });

      cellPolygon.bindTooltip(
        `<div style="font-family: 'JetBrains Mono', monospace; font-size: 11px;">
          <strong>${cell.label}</strong><br/>
          ${cell.centroid[0].toFixed(4)}°N, ${cell.centroid[1].toFixed(4)}°E · ${cell.areaKm2} km²<br/>
          <span style="color:#8FA39B;">Click to inspect live telemetry</span>
        </div>`,
        { sticky: true }
      );

      cellPolygon.on('click', () => {
        handleSelectCell(cell);
      });

      cellPolygon.addTo(cellsGroup);
    }
  }, [activeRegion, activeLayer, showGrid, selectedCell?.id, telemetry?.statistics.avgTs, telemetry?.statistics.rainfallAnomalyPct]);

  // Clear selected cell when switching region
  useEffect(() => {
    setSelectedCell(null);
    setCellTelemetry(null);
    setCellError(null);
  }, [activeRegionId]);

  const handleSelectCell = async (cell: GeographicalCell) => {
    setSelectedCell(cell);
    setCellLoading(true);
    setCellError(null);
    try {
      const data = await api.getCellTelemetry(cell.regionId, cell.id, 60);
      setCellTelemetry(data);
    } catch (err: any) {
      setCellError(err?.message ?? 'Unable to load cell telemetry.');
    } finally {
      setCellLoading(false);
    }
  };

  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const { results } = await api.geocode(searchQuery.trim());
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const focusCoordinate = (lat: number, lng: number, label: string) => {
    const map = mapRef.current;
    if (!map) return;
    map.flyTo([lat, lng], 12, { duration: 0.7 });
    if (searchMarkerRef.current) {
      map.removeLayer(searchMarkerRef.current);
    }
    searchMarkerRef.current = L.circleMarker([lat, lng], {
      radius: 7,
      color: '#06B6D4',
      fillColor: '#06B6D4',
      fillOpacity: 0.4,
      weight: 2,
    })
      .bindPopup(`<div style="font-size:12px;"><strong>${label}</strong><br/>${lat.toFixed(4)}°N, ${lng.toFixed(4)}°E</div>`)
      .addTo(map)
      .openPopup();
    setSearchResults([]);
  };

  const activeLayerMeta = MAP_LAYERS.find((l) => l.id === activeLayer)!;

  return (
    <div className="space-y-4">
      {/* Header Toolbar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-4 border-b border-[#23322B]">
        <div>
          <h1 className="text-xl font-semibold text-[#ECF3F0]">Live Environmental Map</h1>
          <p className="text-xs text-[#8FA39B] mt-0.5">
            OpenStreetMap + Leaflet geospatial grid · Click any spatial cell to query live NASA POWER observations
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Location Search */}
          <form onSubmit={handleLocationSearch} className="relative">
            <div className="flex items-center bg-[#141D19] border border-[#23322B] rounded-md overflow-hidden">
              <Search className="w-3.5 h-3.5 text-[#7C938A] ml-2.5 shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search location (e.g., Puttur, Nagari)..."
                className="bg-transparent px-2.5 py-1.5 text-xs text-[#ECF3F0] placeholder:text-[#647A71] w-52 sm:w-60 focus:outline-none"
              />
              <button
                type="submit"
                disabled={searching}
                className="px-2.5 py-1.5 text-[11px] font-mono text-emerald-400 hover:bg-[#1B2822] border-l border-[#23322B]"
              >
                {searching ? '...' : 'Go'}
              </button>
            </div>
            {searchResults.length > 0 && (
              <div className="absolute right-0 mt-1 w-80 max-w-[90vw] bg-[#111916] border border-[#23322B] rounded-md shadow-xl z-[1000] divide-y divide-[#1D2A24]">
                {searchResults.map((res, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => focusCoordinate(res.lat, res.lng, res.displayName)}
                    className="w-full text-left px-3 py-2 hover:bg-[#19241F] transition-colors"
                  >
                    <p className="text-xs text-[#ECF3F0] truncate">{res.displayName}</p>
                    <p className="text-[11px] font-mono text-[#7C938A]">
                      {res.lat.toFixed(4)}°N, {res.lng.toFixed(4)}°E
                    </p>
                  </button>
                ))}
              </div>
            )}
          </form>

          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-[#16241E] hover:bg-[#1E3129] border border-emerald-500/40 text-xs font-medium text-emerald-300 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Custom Boundary / GeoJSON</span>
          </button>
        </div>
      </div>

      {/* Main Split Workspace: Left Layer Controls | Center Map | Right Cell Inspector */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-stretch">
        {/* Left Controls Column */}
        <aside className="xl:col-span-3 space-y-4">
          {/* Regions Panel */}
          <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[#ECF3F0] flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                Monitored Regions
              </h2>
              <span className="text-[11px] font-mono text-[#7C938A]">{regions.length} total</span>
            </div>
            <div className="space-y-1.5">
              {regions.map((reg) => {
                const active = reg.id === activeRegionId;
                return (
                  <div
                    key={reg.id}
                    className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border transition-colors ${
                      active
                        ? 'bg-[#182721] border-emerald-500/40 text-[#ECF3F0]'
                        : 'bg-[#101714] border-[#1E2B25] text-[#9BB0A8] hover:border-[#2C3E36]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setActiveRegionId(reg.id)}
                      className="text-left flex-1 min-w-0"
                    >
                      <p className="text-xs font-medium truncate">{reg.name}</p>
                      <p className="text-[11px] font-mono text-[#6F857C] truncate">
                        {reg.cells.length} cells · {reg.areaKm2.toFixed(0)} km²
                      </p>
                    </button>
                    {reg.origin === 'custom' && (
                      <button
                        type="button"
                        onClick={() => removeCustomRegion(reg.id)}
                        aria-label={`Delete ${reg.name}`}
                        className="p-1 text-[#7C938A] hover:text-rose-400"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Layer Controls */}
          <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-xs font-semibold text-[#ECF3F0] flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                Environmental Layers
              </h2>
              <label className="inline-flex items-center gap-1.5 text-[11px] text-[#8FA39B] cursor-pointer">
                <input
                  type="checkbox"
                  checked={showGrid}
                  onChange={(e) => setShowGrid(e.target.checked)}
                  className="accent-emerald-500"
                />
                <span>Grid</span>
              </label>
            </div>

            <div className="space-y-1.5">
              {MAP_LAYERS.map((layer) => {
                const isSelected = activeLayer === layer.id;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    onClick={() => setActiveLayer(layer.id)}
                    className={`w-full text-left px-3 py-2 rounded-md border transition-colors ${
                      isSelected
                        ? 'bg-[#182721] border-emerald-500/40'
                        : 'bg-[#101714] border-[#1E2B25] hover:border-[#2C3E36]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-[#ECF3F0]">{layer.label}</span>
                      <span
                        className={`text-[10px] font-mono ${
                          layer.connected ? 'text-emerald-400' : 'text-[#7C938A]'
                        }`}
                      >
                        {layer.connected ? 'LIVE' : 'OFFLINE'}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-[#6F857C] mt-0.5">
                      {layer.provider} · {layer.stage}
                    </p>
                  </button>
                );
              })}
            </div>

            {/* Basemap Selector */}
            <div className="mt-4 pt-3 border-t border-[#1E2B25]">
              <p className="text-[11px] font-mono text-[#7C938A] mb-2">Basemap Tiles</p>
              <div className="grid grid-cols-3 gap-1.5">
                {(Object.keys(BASEMAPS) as MapBasemapId[]).map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setBasemap(key)}
                    className={`px-2 py-1.5 rounded text-[11px] font-mono border transition-colors ${
                      basemap === key
                        ? 'bg-[#192822] border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0F1613] border-[#23322B] text-[#8FA39B] hover:text-[#ECF3F0]'
                    }`}
                  >
                    {BASEMAPS[key].label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Active Layer Legend */}
          <div className="bg-[#141D19] border border-[#23322B] rounded-lg p-4">
            <p className="text-xs font-semibold text-[#ECF3F0]">{activeLayerMeta.label} Legend</p>
            <p className="text-[11px] font-mono text-[#7C938A] mt-0.5">{activeLayerMeta.provider}</p>
            <div className="mt-3 space-y-1.5">
              {activeLayerMeta.legend.map((item) => (
                <div key={item.label} className="flex items-center gap-2 text-xs text-[#B7C9C2]">
                  <span
                    className="w-3 h-3 rounded-xs shrink-0 border border-white/15"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="font-mono text-[11px]">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* Interactive Leaflet Map Canvas */}
        <div
          className={`${
            selectedCell ? 'xl:col-span-6' : 'xl:col-span-9'
          } relative bg-[#0F1613] border border-[#23322B] rounded-lg overflow-hidden min-h-[540px] lg:min-h-[640px]`}
        >
          <div ref={mapContainerRef} className="w-full h-full min-h-[540px] lg:min-h-[640px]" />

          {/* Honest Overlay Banner When Selecting an Unconfigured Satellite Layer */}
          {!activeLayerMeta.connected && (
            <div className="absolute top-3 left-14 right-3 z-[500] max-w-md bg-[#0F1613]/95 border border-[#2D4037] rounded-md px-3.5 py-2.5 backdrop-blur-sm">
              <p className="text-xs font-medium text-[#ECF3F0]">
                {activeLayerMeta.label} — Not Connected
              </p>
              <p className="text-[11px] text-[#8FA39B] mt-0.5 leading-relaxed">
                {activeLayerMeta.stage}. Cells display spatial boundaries only (no fabricated
                satellite values). Click any cell to inspect live NASA POWER observations.
              </p>
            </div>
          )}

          {/* Resolution Notice for Live NASA POWER Layers */}
          {activeLayerMeta.connected && (
            <div className="absolute bottom-3 left-3 z-[500] bg-[#0F1613]/90 border border-[#23322B] rounded-md px-3 py-1.5 text-[11px] font-mono text-[#9BB0A8]">
              NASA POWER 0.5°×0.625° grid · Click any spatial cell for point telemetry
            </div>
          )}
        </div>

        {/* Right Slide-in Cell Telemetry Inspector */}
        {selectedCell && (
          <aside className="xl:col-span-3 bg-[#141D19] border border-[#23322B] rounded-lg p-4 flex flex-col justify-between max-h-[640px] overflow-y-auto">
            <div>
              <div className="flex items-start justify-between gap-2 pb-3 border-b border-[#23322B]">
                <div>
                  <p className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <Crosshair className="w-3 h-3" />
                    Selected Spatial Cell
                  </p>
                  <h3 className="text-base font-semibold text-[#ECF3F0] mt-0.5">
                    {selectedCell.label}
                  </h3>
                  <p className="text-[11px] font-mono text-[#8FA39B] tabular-nums">
                    {selectedCell.centroid[0].toFixed(4)}°N, {selectedCell.centroid[1].toFixed(4)}°E ·{' '}
                    {selectedCell.areaKm2} km²
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedCell(null)}
                  aria-label="Close cell inspector"
                  className="p-1 text-[#8FA39B] hover:text-[#ECF3F0]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {cellLoading ? (
                <div className="py-8 space-y-3">
                  <div className="h-12 bg-[#1A2621] rounded animate-pulse" />
                  <div className="h-12 bg-[#1A2621] rounded animate-pulse" />
                  <div className="h-12 bg-[#1A2621] rounded animate-pulse" />
                  <p className="text-xs font-mono text-[#7C938A] text-center">
                    Querying live NASA POWER point telemetry...
                  </p>
                </div>
              ) : cellError ? (
                <p className="mt-4 text-xs text-rose-400">{cellError}</p>
              ) : cellTelemetry ? (
                <div className="mt-4 space-y-4">
                  {/* Live Telemetry Rows */}
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">Latest Observation</span>
                      <span className="font-mono tabular-nums text-[#ECF3F0]">
                        {cellTelemetry.statistics.latestValidDate ?? 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">Sentinel-2 NDVI</span>
                      <span className="font-mono text-[#7C938A]">Not Connected (Stage 3)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">Landsat 30m LST</span>
                      <span className="font-mono text-[#7C938A]">Not Connected (Stage 4)</span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">60d Mean Skin Temp (TS)</span>
                      <span className="font-mono tabular-nums text-amber-300">
                        {cellTelemetry.statistics.avgTs !== null
                          ? `${cellTelemetry.statistics.avgTs.toFixed(1)} °C`
                          : 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">TS vs. 30-yr Baseline</span>
                      <span className="font-mono tabular-nums text-[#ECF3F0]">
                        {cellTelemetry.statistics.tsAnomalyC !== null
                          ? `${cellTelemetry.statistics.tsAnomalyC >= 0 ? '+' : ''}${cellTelemetry.statistics.tsAnomalyC.toFixed(2)} °C`
                          : 'Unavailable'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">60d Mean 2m Air Temp</span>
                      <span className="font-mono tabular-nums text-emerald-300">
                        {cellTelemetry.statistics.avgT2m !== null
                          ? `${cellTelemetry.statistics.avgT2m.toFixed(1)} °C`
                          : 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">60d Cumulative Rain</span>
                      <span className="font-mono tabular-nums text-cyan-300">
                        {cellTelemetry.statistics.totalRainfallMm !== null
                          ? `${cellTelemetry.statistics.totalRainfallMm.toFixed(1)} mm`
                          : 'Missing'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">Consecutive Dry Days</span>
                      <span className="font-mono tabular-nums text-[#ECF3F0]">
                        {cellTelemetry.statistics.consecutiveDryDays} days
                      </span>
                    </div>
                    <div className="flex justify-between py-1.5 border-b border-[#1D2A24]">
                      <span className="text-[#8FA39B]">Weather Screening</span>
                      <span className="font-mono text-[#ECF3F0]">
                        {cellTelemetry.risk.status} ({cellTelemetry.risk.confidenceScorePct}% conf.)
                      </span>
                    </div>
                  </div>

                  {/* Quality & Provenance */}
                  <div className="p-3 rounded-md bg-[#0F1613] border border-[#23322B] space-y-1 text-[11px] font-mono text-[#8FA39B]">
                    <p className="text-[#DCE8E3]">Data Provenance & Quality</p>
                    <p>Source: {cellTelemetry.source.provider} ({cellTelemetry.source.community})</p>
                    <p>Resolution: {cellTelemetry.source.spatialResolution}</p>
                    <p>
                      Completeness: {cellTelemetry.statistics.completenessPct}% (
                      {cellTelemetry.statistics.missingObservationDays} missing days filtered)
                    </p>
                    <p>Cache: {cellTelemetry.source.cacheStatus.toUpperCase()}</p>
                  </div>
                </div>
              ) : null}
            </div>
          </aside>
        )}
      </div>

      <CustomRegionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
