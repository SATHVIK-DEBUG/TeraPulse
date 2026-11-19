import * as turf from '@turf/turf';
import { Router, type Request, type Response } from 'express';
import fs from 'fs';
import type { Feature, Polygon } from 'geojson';
import path from 'path';
import {
  computeRegionalStatistics,
  evaluateEnvironmentalRisk,
  generateObservationsCSV,
} from '../../shared/algorithms.ts';
import { buildRegionFromBBox, buildRegionFromPolygon } from '../../shared/regions.ts';
import type {
  CellTelemetryResponse,
  RegionComparisonItem,
  RegionalTelemetryResponse,
  ThresholdConfig,
} from '../../shared/types.ts';
import {
  fetchNasaPowerClimatology,
  fetchNasaPowerDaily,
  probeNasaPowerHealth,
} from '../connectors/nasaPowerConnector.ts';
import { getAllDataSourcesStatus } from '../connectors/unconfiguredConnectors.ts';
import { repository } from '../db/repository.ts';

export const apiRouter = Router();

apiRouter.get('/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    service: 'TerraPulse API',
    stage: 'Stages 1 & 2 (Live NASA POWER)',
    timestamp: new Date().toISOString(),
    cache: repository.getCacheStats(),
  });
});

// --- REGIONS ---
apiRouter.get('/regions', (_req: Request, res: Response) => {
  res.json({ regions: repository.getRegions() });
});

apiRouter.post('/regions', (req: Request, res: Response) => {
  try {
    const { name, district, state, country, description, mode, bbox, geojson } = req.body ?? {};
    const cleanName = typeof name === 'string' ? name.trim() : '';
    if (!cleanName || cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({ error: 'Region name must be between 2 and 80 characters.' });
    }

    const slug = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 32);
    const id = `custom-${slug}-${Date.now().toString(36).slice(-4)}`;

    const meta = {
      id,
      name: cleanName,
      district: typeof district === 'string' && district.trim() ? district.trim() : 'Custom Zone',
      state: typeof state === 'string' && state.trim() ? state.trim() : 'Andhra Pradesh',
      country: typeof country === 'string' && country.trim() ? country.trim() : 'India',
      description:
        typeof description === 'string' && description.trim()
          ? description.trim()
          : 'User-defined geographical monitoring boundary.',
      origin: 'custom' as const,
    };

    if (mode === 'bbox' && bbox) {
      const south = Number(bbox.south);
      const west = Number(bbox.west);
      const north = Number(bbox.north);
      const east = Number(bbox.east);
      if (
        ![south, west, north, east].every(Number.isFinite) ||
        south >= north ||
        west >= east ||
        south < -85 ||
        north > 85 ||
        west < -180 ||
        east > 180
      ) {
        return res.status(400).json({
          error: 'Invalid bounding box coordinates. Ensure South < North and West < East.',
        });
      }
      if (north - south > 5 || east - west > 5) {
        return res.status(400).json({
          error: 'Bounding box span must be 5° or smaller per axis for grid cell subdivision.',
        });
      }
      const region = buildRegionFromBBox({ ...meta, south, west, north, east });
      repository.addCustomRegion(region);
      return res.status(201).json({ region });
    }

    // GeoJSON Polygon or FeatureCollection extraction
    let polygonFeature: Feature<Polygon> | null = null;
    if (geojson) {
      if (geojson.type === 'Feature' && geojson.geometry?.type === 'Polygon') {
        polygonFeature = geojson as Feature<Polygon>;
      } else if (geojson.type === 'Polygon' && Array.isArray(geojson.coordinates)) {
        polygonFeature = turf.polygon(geojson.coordinates);
      } else if (
        geojson.type === 'FeatureCollection' &&
        Array.isArray(geojson.features)
      ) {
        const found = geojson.features.find(
          (f: any) => f?.type === 'Feature' && f?.geometry?.type === 'Polygon'
        );
        if (found) polygonFeature = found as Feature<Polygon>;
      }
    }

    if (!polygonFeature) {
      return res.status(400).json({
        error: 'Provide a valid GeoJSON Polygon, Feature<Polygon>, FeatureCollection, or bounding box.',
      });
    }

    const areaKm2 = turf.area(polygonFeature) / 1_000_000;
    if (!Number.isFinite(areaKm2) || areaKm2 < 1 || areaKm2 > 250_000) {
      return res.status(400).json({
        error: 'Polygon area must be between 1 km² and 250,000 km².',
      });
    }

    const region = buildRegionFromPolygon({ ...meta, polygon: polygonFeature });
    repository.addCustomRegion(region);
    return res.status(201).json({ region });
  } catch (err: any) {
    console.error('[TerraPulse API] Error creating custom region:', err);
    return res.status(400).json({ error: err?.message ?? 'Invalid region payload.' });
  }
});

apiRouter.delete('/regions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const existing = repository.getRegionById(id);
  if (!existing) {
    return res.status(404).json({ error: 'Region not found.' });
  }
  if (existing.origin !== 'custom') {
    return res.status(400).json({ error: 'Pre-configured pilot/comparison regions cannot be deleted.' });
  }
  repository.deleteCustomRegion(id);
  return res.json({ deleted: true, id });
});

// --- LIVE OBSERVATIONS SUMMARY ---
apiRouter.get('/observations/summary', async (req: Request, res: Response) => {
  try {
    const regionId = String(req.query.regionId || 'puttur-ap');
    const days = Math.max(14, Math.min(365, Number(req.query.days) || 90));
    const forceRefresh = req.query.forceRefresh === 'true';

    const region = repository.getRegionById(regionId);
    if (!region) {
      return res.status(404).json({ error: `Unknown region: ${regionId}` });
    }

    const [dailyBundle, climatology] = await Promise.all([
      fetchNasaPowerDaily({
        lat: region.center[0],
        lng: region.center[1],
        days,
        forceRefresh,
      }),
      fetchNasaPowerClimatology(region.center[0], region.center[1], forceRefresh),
    ]);

    const statistics = computeRegionalStatistics(dailyBundle.records, climatology);
    const thresholds = repository.getThresholds();
    const risk = evaluateEnvironmentalRisk(region, statistics, thresholds);

    const payload: RegionalTelemetryResponse = {
      region,
      source: dailyBundle.source,
      statistics,
      climatology,
      dailyRecords: dailyBundle.records,
      risk,
    };

    return res.json(payload);
  } catch (err: any) {
    console.error('[TerraPulse API] /observations/summary failed:', err);
    return res.status(502).json({
      error: 'Unable to retrieve live observations from NASA POWER.',
      details: err?.message ?? 'Upstream request failed',
    });
  }
});

// --- HISTORICAL RANGE QUERY ---
apiRouter.get('/observations/historical', async (req: Request, res: Response) => {
  try {
    const regionId = String(req.query.regionId || 'puttur-ap');
    const startDate = String(req.query.startDate || '');
    const endDate = String(req.query.endDate || '');
    const compareRegionId = req.query.compareRegionId ? String(req.query.compareRegionId) : null;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return res.status(400).json({ error: 'startDate and endDate must be formatted as YYYY-MM-DD.' });
    }
    if (startDate > endDate) {
      return res.status(400).json({ error: 'startDate must be earlier than or equal to endDate.' });
    }
    const diffDays = (Date.parse(endDate) - Date.parse(startDate)) / (1000 * 60 * 60 * 24);
    if (diffDays > 731) {
      return res.status(400).json({ error: 'Maximum query span is 24 months (731 days) per request.' });
    }

    const region = repository.getRegionById(regionId);
    if (!region) {
      return res.status(404).json({ error: `Unknown region: ${regionId}` });
    }

    const [primaryDaily, primaryClim] = await Promise.all([
      fetchNasaPowerDaily({
        lat: region.center[0],
        lng: region.center[1],
        startIso: startDate,
        endIso: endDate,
      }),
      fetchNasaPowerClimatology(region.center[0], region.center[1]),
    ]);

    const primaryStats = computeRegionalStatistics(primaryDaily.records, primaryClim);
    const thresholds = repository.getThresholds();
    const primaryRisk = evaluateEnvironmentalRisk(region, primaryStats, thresholds);

    let comparison: RegionalTelemetryResponse | null = null;
    if (compareRegionId && compareRegionId !== regionId) {
      const compRegion = repository.getRegionById(compareRegionId);
      if (compRegion) {
        const [compDaily, compClim] = await Promise.all([
          fetchNasaPowerDaily({
            lat: compRegion.center[0],
            lng: compRegion.center[1],
            startIso: startDate,
            endIso: endDate,
          }),
          fetchNasaPowerClimatology(compRegion.center[0], compRegion.center[1]),
        ]);
        const compStats = computeRegionalStatistics(compDaily.records, compClim);
        const compRisk = evaluateEnvironmentalRisk(compRegion, compStats, thresholds);
        comparison = {
          region: compRegion,
          source: compDaily.source,
          statistics: compStats,
          climatology: compClim,
          dailyRecords: compDaily.records,
          risk: compRisk,
        };
      }
    }

    return res.json({
      primary: {
        region,
        source: primaryDaily.source,
        statistics: primaryStats,
        climatology: primaryClim,
        dailyRecords: primaryDaily.records,
        risk: primaryRisk,
      } satisfies RegionalTelemetryResponse,
      comparison,
    });
  } catch (err: any) {
    console.error('[TerraPulse API] /observations/historical failed:', err);
    return res.status(502).json({
      error: 'Historical NASA POWER query failed.',
      details: err?.message ?? 'Upstream error',
    });
  }
});

// --- REGIONAL COMPARISON ---
apiRouter.get('/observations/compare', async (req: Request, res: Response) => {
  try {
    const days = Math.max(14, Math.min(365, Number(req.query.days) || 90));
    const regions = repository.getRegions();
    const thresholds = repository.getThresholds();

    const results: RegionComparisonItem[] = await Promise.all(
      regions.map(async (region) => {
        try {
          const [dailyBundle, climatology] = await Promise.all([
            fetchNasaPowerDaily({ lat: region.center[0], lng: region.center[1], days }),
            fetchNasaPowerClimatology(region.center[0], region.center[1]),
          ]);
          const stats = computeRegionalStatistics(dailyBundle.records, climatology);
          const risk = evaluateEnvironmentalRisk(region, stats, thresholds);

          return {
            regionId: region.id,
            regionName: region.name,
            district: region.district,
            center: region.center,
            areaKm2: region.areaKm2,
            cellCount: region.cells.length,
            latestValidDate: stats.latestValidDate,
            avgT2m: stats.avgT2m,
            avgTs: stats.avgTs,
            tsAnomalyC: stats.tsAnomalyC,
            totalRainfallMm: stats.totalRainfallMm,
            rainfallAnomalyPct: stats.rainfallAnomalyPct,
            completenessPct: stats.completenessPct,
            riskStatus: risk.status,
            confidenceScorePct: risk.confidenceScorePct,
            sourceProvider: dailyBundle.source.provider,
          };
        } catch (err: any) {
          return {
            regionId: region.id,
            regionName: region.name,
            district: region.district,
            center: region.center,
            areaKm2: region.areaKm2,
            cellCount: region.cells.length,
            latestValidDate: null,
            avgT2m: null,
            avgTs: null,
            tsAnomalyC: null,
            totalRainfallMm: null,
            rainfallAnomalyPct: null,
            completenessPct: 0,
            riskStatus: 'Normal' as const,
            confidenceScorePct: 0,
            sourceProvider: 'NASA POWER',
            error: err?.message ?? 'Fetch failed',
          };
        }
      })
    );

    return res.json({ days, regions: results });
  } catch (err: any) {
    return res.status(500).json({ error: err?.message ?? 'Comparison failed' });
  }
});

// --- MAP GRID CELL INSPECTION ---
apiRouter.get('/map/cell', async (req: Request, res: Response) => {
  try {
    const regionId = String(req.query.regionId || 'puttur-ap');
    const cellId = String(req.query.cellId || '');
    const days = Math.max(14, Math.min(180, Number(req.query.days) || 60));

    const region = repository.getRegionById(regionId);
    if (!region) {
      return res.status(404).json({ error: `Unknown region: ${regionId}` });
    }
    const cell = region.cells.find((c) => c.id === cellId);
    if (!cell) {
      return res.status(404).json({ error: `Cell ${cellId} not found in region ${regionId}` });
    }

    const [dailyBundle, climatology] = await Promise.all([
      fetchNasaPowerDaily({
        lat: cell.centroid[0],
        lng: cell.centroid[1],
        days,
      }),
      fetchNasaPowerClimatology(cell.centroid[0], cell.centroid[1]),
    ]);

    const statistics = computeRegionalStatistics(dailyBundle.records, climatology);
    const thresholds = repository.getThresholds();
    const risk = evaluateEnvironmentalRisk(region, statistics, thresholds);

    const payload: CellTelemetryResponse = {
      cell,
      regionName: region.name,
      source: dailyBundle.source,
      statistics,
      recentRecords: dailyBundle.records.slice(-14),
      risk,
    };

    return res.json(payload);
  } catch (err: any) {
    console.error('[TerraPulse API] /map/cell failed:', err);
    return res.status(502).json({
      error: 'Unable to fetch live NASA POWER telemetry for this geographical cell.',
      details: err?.message ?? 'Upstream error',
    });
  }
});

// --- DATA SOURCES & DIAGNOSTICS ---
apiRouter.get('/sources', (_req: Request, res: Response) => {
  res.json({
    sources: getAllDataSourcesStatus(),
    cache: repository.getCacheStats(),
  });
});

apiRouter.post('/sources/nasa-power/probe', async (_req: Request, res: Response) => {
  const probe = await probeNasaPowerHealth();
  res.json({
    probe,
    sources: getAllDataSourcesStatus(),
    cache: repository.getCacheStats(),
  });
});

apiRouter.post('/cache/clear', (_req: Request, res: Response) => {
  const cleared = repository.clearObservationCache();
  res.json({ cleared, cache: repository.getCacheStats() });
});

// --- SETTINGS / THRESHOLDS ---
apiRouter.get('/settings/thresholds', (_req: Request, res: Response) => {
  res.json({ thresholds: repository.getThresholds() });
});

apiRouter.put('/settings/thresholds', (req: Request, res: Response) => {
  try {
    const body = req.body ?? {};
    const patch: Partial<ThresholdConfig> = {};

    const numFields: (keyof ThresholdConfig)[] = [
      'tempAnomalyWatchC',
      'tempAnomalyElevatedC',
      'tempAnomalyHighC',
      'rainfallDeficitWatchPct',
      'rainfallDeficitElevatedPct',
      'rainfallExcessWatchPct',
      'consecutiveDryDaysWatch',
      'consecutiveDryDaysElevated',
    ];

    for (const key of numFields) {
      if (body[key] !== undefined) {
        const val = Number(body[key]);
        if (!Number.isFinite(val)) {
          return res.status(400).json({ error: `Invalid numeric value for ${key}` });
        }
        (patch as any)[key] = val;
      }
    }

    if (
      body.defaultBasemap === 'dark_carto' ||
      body.defaultBasemap === 'osm_standard' ||
      body.defaultBasemap === 'topo'
    ) {
      patch.defaultBasemap = body.defaultBasemap;
    }

    const updated = repository.updateThresholds(patch);
    return res.json({ thresholds: updated });
  } catch (err: any) {
    return res.status(400).json({ error: err?.message ?? 'Invalid thresholds payload.' });
  }
});

// --- GEOCODING PROXY (OpenStreetMap Nominatim) ---
apiRouter.get('/geocode', async (req: Request, res: Response) => {
  const q = String(req.query.q || '').trim();
  if (q.length < 2) {
    return res.json({ results: [] });
  }
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q)}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(url, {
      headers: {
        'User-Agent': 'TerraPulse-Environmental-Intelligence/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      return res.status(502).json({ error: `Geocoder returned HTTP ${resp.status}`, results: [] });
    }
    const raw = (await resp.json()) as any[];
    const results = raw.map((item) => ({
      displayName: item.display_name,
      lat: Number(item.lat),
      lng: Number(item.lon),
      type: item.type,
    }));
    return res.json({ results });
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'Location search unavailable', results: [] });
  }
});

// --- CSV EXPORT ---
apiRouter.get('/export/csv', async (req: Request, res: Response) => {
  try {
    const regionId = String(req.query.regionId || 'puttur-ap');
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const days = Math.max(14, Math.min(365, Number(req.query.days) || 90));

    const region = repository.getRegionById(regionId);
    if (!region) {
      return res.status(404).json({ error: `Unknown region: ${regionId}` });
    }

    const dailyBundle = await fetchNasaPowerDaily({
      lat: region.center[0],
      lng: region.center[1],
      startIso: startDate,
      endIso: endDate,
      days,
    });

    const csv = generateObservationsCSV(region, dailyBundle.records, dailyBundle.source);
    const filename = `terrapulse-${region.id}-${dailyBundle.records[0]?.date ?? 'data'}-to-${dailyBundle.records[dailyBundle.records.length - 1]?.date ?? 'latest'}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(csv);
  } catch (err: any) {
    return res.status(502).json({ error: err?.message ?? 'CSV export failed' });
  }
});

// --- SUPABASE POSTGIS SCHEMA BLUEPRINT ---
apiRouter.get('/schema/supabase', (_req: Request, res: Response) => {
  try {
    const schemaPath = path.resolve(process.cwd(), 'src/server/db/supabase_schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf-8');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.send(sql);
  } catch (err: any) {
    return res.status(500).json({ error: 'Unable to read Supabase schema blueprint.' });
  }
});
