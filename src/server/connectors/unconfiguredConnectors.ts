import type { DataSourceInfo } from '../../shared/types.ts';
import { getNasaPowerTelemetryStatus } from './nasaPowerConnector.ts';

/**
 * Modular provider registry reporting truthful, real-time integration status.
 * Stage 1 & 2 require ZERO external credentials — only the public NASA POWER API is active.
 * Future satellite and database connectors remain optional and clearly marked "Not Connected".
 */
export function getAllDataSourcesStatus(): DataSourceInfo[] {
  const nasaMeta = getNasaPowerTelemetryStatus();

  return [
    {
      id: 'nasa-power',
      name: 'NASA POWER (Agroclimatology)',
      providerUrl: 'https://power.larc.nasa.gov/',
      stage: 'Stage 2 — Active',
      status: nasaMeta.lastProbeError ? 'not_connected' : 'connected',
      purpose:
        'Public, unauthenticated daily & 30-year climatology observations: 2m air temperature (T2M), Earth skin temperature (TS), corrected precipitation (PRECTOTCORR), relative humidity (RH2M), solar irradiance, and wind speed.',
      parameters: [
        'T2M',
        'T2M_MAX',
        'T2M_MIN',
        'TS',
        'PRECTOTCORR',
        'RH2M',
        'ALLSKY_SFC_SW_DWN',
        'WS2M',
      ],
      spatialResolution: '0.5° × 0.625° (~55 km grid)',
      temporalCadence: 'Daily (~3–5 day processing lag) & 30-year monthly climatology',
      authRequired: false,
      requiredEnvVars: [],
      setupInstructions:
        'Public API — zero credentials or billing required. Connected via server-side proxy with deduplicated local cache and -999 fill-value sanitization.',
      lastCheckedAt: nasaMeta.lastProbeTimeIso,
      latencyMs: nasaMeta.lastProbeLatencyMs,
      cacheEntries: nasaMeta.cacheEntries,
      errorMessage: nasaMeta.lastProbeError,
    },
    {
      id: 'copernicus-sentinel2',
      name: 'Copernicus Data Space (Sentinel-2 L2A)',
      providerUrl: 'https://dataspace.copernicus.eu/',
      stage: 'Stage 3 — Optional Future Stage',
      status: 'not_connected',
      purpose:
        'High-resolution multispectral optical imagery (Band 8 NIR, Band 4 RED, Scene Classification Layer) for deterministic NDVI vegetation health and cloud-masked change detection.',
      parameters: ['B04 (Red 665nm)', 'B08 (NIR 842nm)', 'SCL (Cloud/Shadow Mask)', 'NDVI'],
      spatialResolution: '10 m optical resolution',
      temporalCadence: '5-day revisit cycle (Sentinel-2A / 2B)',
      authRequired: true,
      requiredEnvVars: [],
      setupInstructions:
        'Optional future integration (Stage 3). Not required for Stages 1 & 2. When ready to activate, connect a free-tier Copernicus Data Space OAuth client in the server connector module.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
    {
      id: 'landsat-thermal',
      name: 'USGS Landsat 8 & 9 Collection 2 Level-2',
      providerUrl: 'https://earthexplorer.usgs.gov/',
      stage: 'Stage 4 — Optional Future Stage',
      status: 'not_connected',
      purpose:
        'Validated 30 m Land Surface Temperature (ST_B10) thermal products with documented scaling (0.00341802 × DN + 149.0 K) and QA_PIXEL cloud/water masking.',
      parameters: ['ST_B10 (Surface Temp)', 'ST_QA (Temp Uncertainty)', 'QA_PIXEL'],
      spatialResolution: '30 m (resampled from 100 m TIRS)',
      temporalCadence: '8-day combined revisit (Landsat 8 + 9)',
      authRequired: true,
      requiredEnvVars: [],
      setupInstructions:
        'Optional future integration (Stage 4). Not required for Stages 1 & 2. Architecture preserves the connector boundary for free USGS EarthExplorer M2M access.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
    {
      id: 'chirps-rainfall',
      name: 'CHIRPS Rainfall Archive (UCSB CHC)',
      providerUrl: 'https://www.chc.ucsb.edu/data/chirps',
      stage: 'Stage 4 — Optional Future Stage',
      status: 'not_connected',
      purpose:
        'Public 0.05° (~5.5 km) quasi-global historical rainfall dataset (1981–present) blending satellite infrared imagery with rain gauge stations.',
      parameters: ['Daily Precipitation (mm)', 'Pentadal Precipitation', '1981–2020 Baseline'],
      spatialResolution: '0.05° (~5.5 km grid)',
      temporalCadence: 'Daily & Pentadal (5-day)',
      authRequired: false,
      requiredEnvVars: [],
      setupInstructions:
        'Optional future integration (Stage 4). Public UCSB Climate Hazards Center archive; requires raster window clipping pipeline in Stage 4.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
    {
      id: 'google-earth-engine',
      name: 'Google Earth Engine',
      providerUrl: 'https://earthengine.google.com/',
      stage: 'Stage 3–4 — Optional Future Stage',
      status: 'not_connected',
      purpose:
        'Server-side geospatial raster aggregation for historical Sentinel-2 NDVI, Landsat LST, and CHIRPS zonal statistics across user-defined boundaries.',
      parameters: ['COPERNICUS/S2_SR_HARMONIZED', 'LANDSAT/LC08/C02/T1_L2', 'UCSB-CHG/CHIRPS/DAILY'],
      spatialResolution: '10 m – 5.5 km (dataset dependent)',
      temporalCadence: 'Multi-decade historical archive',
      authRequired: true,
      requiredEnvVars: [],
      setupInstructions:
        'Optional future integration (Stage 3–4). Not required for Stages 1 & 2. Activate only after confirming non-commercial/eligible Earth Engine access.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
    {
      id: 'gemini-analyst',
      name: 'Gemini Environmental Analyst',
      providerUrl: 'https://ai.google.dev/',
      stage: 'Stage 5 — Coming Soon',
      status: 'coming_soon',
      purpose:
        'Natural-language anomaly explanation and report synthesis strictly grounded in deterministic TerraPulse observations — never used as a numerical source of truth.',
      parameters: ['Grounded Anomaly Summaries', 'Regional Comparisons', 'Verification Guidance'],
      spatialResolution: 'Region & Cell Observation Context',
      temporalCadence: 'On-demand analysis',
      authRequired: false,
      requiredEnvVars: [],
      setupInstructions:
        'Reserved for Stage 5 once multi-indicator satellite observations are connected. Runs strictly server-side.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
    {
      id: 'supabase-postgis',
      name: 'Modular Persistence (Local Cache → Supabase PostGIS)',
      providerUrl: 'https://supabase.com/',
      stage: 'Optional Database Migration',
      status: 'not_connected',
      purpose:
        'Stages 1 & 2 operate fully on TerraPulse’s zero-cost local file-backed repository cache. A 12-table PostgreSQL + PostGIS schema blueprint is included for seamless Supabase migration later.',
      parameters: ['12-Table SQL DDL', 'PostGIS GIST Indexes', 'Row Level Security'],
      spatialResolution: 'EPSG:4326 Vector Geometries',
      temporalCadence: 'Persistent local cache active now',
      authRequired: false,
      requiredEnvVars: [],
      setupInstructions:
        'Zero external database or credentials required right now. Swap FileBackedCacheRepository for a PostgreSQL adapter whenever you decide to deploy Supabase free tier.',
      lastCheckedAt: null,
      latencyMs: null,
      errorMessage: null,
    },
  ];
}
