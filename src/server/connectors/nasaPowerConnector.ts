import { sanitizeNasaPowerValue } from '../../shared/algorithms.ts';
import type {
  ClimatologyMonthlyBaseline,
  NasaIndicatorKey,
  NasaPowerDailyRecord,
  QualityFlag,
  SourceMetadata,
} from '../../shared/types.ts';
import { repository } from '../db/repository.ts';

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal';
const DAILY_PARAMETERS: NasaIndicatorKey[] = [
  'T2M',
  'T2M_MAX',
  'T2M_MIN',
  'TS',
  'PRECTOTCORR',
  'RH2M',
  'ALLSKY_SFC_SW_DWN',
  'WS2M',
];
const CLIMATOLOGY_PARAMETERS = ['T2M', 'TS', 'PRECTOTCORR', 'RH2M'];

const DAILY_CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 hours
const CLIMATOLOGY_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

const MONTH_KEY_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
  ANN: 'ANN',
};

let lastKnownNasaServerDateMs: number | null = null;
let lastProbeLatencyMs: number | null = null;
let lastProbeTimeIso: string | null = null;
let lastProbeError: string | null = null;

function formatCompactDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function parseCompactToIso(compact: string): string {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

function isoToCompact(iso: string): string {
  return iso.replace(/-/g, '');
}

/**
 * NASA POWER Agroclimatology (AG) MERRA-2/IMERG daily observations are resolved on a
 * ~0.5° x 0.625° grid; rounding coordinates to 3 decimals deduplicates near-identical requests.
 */
function coordKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`;
}

async function fetchJsonWithRetry(url: string, maxAttempts = 3): Promise<{ json: any; serverDateMs: number | null; latencyMs: number }> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 16000);
    const start = Date.now();

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          'User-Agent': 'TerraPulse-Environmental-Intelligence/1.0',
        },
        signal: controller.signal,
      });

      const latencyMs = Date.now() - start;
      const dateHeader = response.headers.get('date');
      const serverDateMs = dateHeader ? Date.parse(dateHeader) : null;
      if (serverDateMs && Number.isFinite(serverDateMs)) {
        lastKnownNasaServerDateMs = serverDateMs;
      }

      if (response.ok) {
        const json = await response.json();
        lastProbeLatencyMs = latencyMs;
        lastProbeTimeIso = new Date().toISOString();
        lastProbeError = null;
        return { json, serverDateMs, latencyMs };
      }

      // Retry only on transient rate-limit or upstream 5xx responses
      if ((response.status === 429 || response.status >= 500) && attempt < maxAttempts) {
        const delayMs = 600 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }

      const errText = await response.text().catch(() => '');
      const err = new Error(`NASA POWER HTTP ${response.status}: ${errText.slice(0, 200)}`);
      (err as any).statusCode = response.status;
      (err as any).serverDateMs = serverDateMs;
      throw err;
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts && (err?.name === 'AbortError' || !err?.statusCode)) {
        await new Promise((resolve) => setTimeout(resolve, 600 * attempt));
        continue;
      }
      lastProbeError = lastError.message;
      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error('NASA POWER request failed');
}

function parseDailyPayload(payload: any): NasaPowerDailyRecord[] {
  const paramMap = payload?.properties?.parameter ?? {};
  const t2mRaw = paramMap.T2M ?? {};
  const t2mMaxRaw = paramMap.T2M_MAX ?? {};
  const t2mMinRaw = paramMap.T2M_MIN ?? {};
  const tsRaw = paramMap.TS ?? {};
  const rainRaw = paramMap.PRECTOTCORR ?? {};
  const rhRaw = paramMap.RH2M ?? {};
  const solarRaw = paramMap.ALLSKY_SFC_SW_DWN ?? {};
  const wsRaw = paramMap.WS2M ?? {};

  const allDates = new Set<string>([
    ...Object.keys(t2mRaw),
    ...Object.keys(tsRaw),
    ...Object.keys(rainRaw),
  ]);

  const records: NasaPowerDailyRecord[] = [];
  for (const compactDate of Array.from(allDates).sort()) {
    if (!/^\d{8}$/.test(compactDate)) continue;

    const t2m = sanitizeNasaPowerValue(t2mRaw[compactDate], 'T2M');
    const t2mMax = sanitizeNasaPowerValue(t2mMaxRaw[compactDate], 'T2M_MAX');
    const t2mMin = sanitizeNasaPowerValue(t2mMinRaw[compactDate], 'T2M_MIN');
    const ts = sanitizeNasaPowerValue(tsRaw[compactDate], 'TS');
    const rain = sanitizeNasaPowerValue(rainRaw[compactDate], 'PRECTOTCORR');
    const rh = sanitizeNasaPowerValue(rhRaw[compactDate], 'RH2M');
    const solar = sanitizeNasaPowerValue(solarRaw[compactDate], 'ALLSKY_SFC_SW_DWN');
    const ws = sanitizeNasaPowerValue(wsRaw[compactDate], 'WS2M');

    const qualityFlags: Record<NasaIndicatorKey, QualityFlag> = {
      T2M: t2m.qualityFlag,
      T2M_MAX: t2mMax.qualityFlag,
      T2M_MIN: t2mMin.qualityFlag,
      TS: ts.qualityFlag,
      PRECTOTCORR: rain.qualityFlag,
      RH2M: rh.qualityFlag,
      ALLSKY_SFC_SW_DWN: solar.qualityFlag,
      WS2M: ws.qualityFlag,
    };

    const hasAnyValid =
      t2m.value !== null || ts.value !== null || rain.value !== null;

    records.push({
      date: parseCompactToIso(compactDate),
      t2m: t2m.value,
      t2mMax: t2mMax.value,
      t2mMin: t2mMin.value,
      ts: ts.value,
      prectotcorr: rain.value,
      rh2m: rh.value,
      solarRadiation: solar.value,
      ws2m: ws.value,
      qualityFlags,
      provenance: hasAnyValid ? 'real_observation' : 'missing_data',
    });
  }

  return records;
}

/**
 * Resolves a valid trailing observation window anchored to NASA POWER's true UTC clock
 * (with a 5-day processing lag buffer so daily MERRA-2/IMERG observations are populated).
 */
export function resolveDefaultDateWindow(days: number, anchorMs?: number | null): { startIso: string; endIso: string } {
  const safeDays = Math.max(7, Math.min(365, Math.round(days)));
  const referenceMs = anchorMs ?? lastKnownNasaServerDateMs ?? Date.now();
  // NASA POWER AG daily datasets typically lag real time by ~3-5 days
  const endDate = new Date(referenceMs - 5 * 24 * 60 * 60 * 1000);
  const startDate = new Date(endDate.getTime() - (safeDays - 1) * 24 * 60 * 60 * 1000);
  return {
    startIso: startDate.toISOString().slice(0, 10),
    endIso: endDate.toISOString().slice(0, 10),
  };
}

export async function fetchNasaPowerClimatology(
  lat: number,
  lng: number,
  forceRefresh = false
): Promise<ClimatologyMonthlyBaseline> {
  const key = `clim:${coordKey(lat, lng)}`;
  if (!forceRefresh) {
    const cached = repository.getCachedClimatology(key);
    if (cached) return cached.climatology;
  }

  const url = `${NASA_POWER_BASE}/climatology/point?parameters=${CLIMATOLOGY_PARAMETERS.join(',')}&community=AG&longitude=${lng.toFixed(4)}&latitude=${lat.toFixed(4)}&format=JSON`;
  const { json } = await fetchJsonWithRetry(url);
  const paramMap = json?.properties?.parameter ?? {};

  const mapMonthly = (rawObj: Record<string, number> | undefined, indicator: NasaIndicatorKey) => {
    const out: Record<string, number | null> = {};
    for (const [mName, mNum] of Object.entries(MONTH_KEY_MAP)) {
      const sanitized = sanitizeNasaPowerValue(rawObj?.[mName], indicator);
      out[mNum] = sanitized.value;
    }
    return out;
  };

  const climatology: ClimatologyMonthlyBaseline = {
    t2m: mapMonthly(paramMap.T2M, 'T2M'),
    ts: mapMonthly(paramMap.TS, 'TS'),
    prectotcorr: mapMonthly(paramMap.PRECTOTCORR, 'PRECTOTCORR'),
    rh2m: mapMonthly(paramMap.RH2M, 'RH2M'),
    source: 'NASA POWER 30-Year Monthly Climatology (AG)',
    fetchedAt: new Date().toISOString(),
  };

  repository.setCachedClimatology({
    key,
    fetchedAt: climatology.fetchedAt,
    expiresAt: Date.now() + CLIMATOLOGY_CACHE_TTL_MS,
    climatology,
  });

  return climatology;
}

export async function fetchNasaPowerDaily(params: {
  lat: number;
  lng: number;
  startIso?: string;
  endIso?: string;
  days?: number;
  forceRefresh?: boolean;
}): Promise<{ records: NasaPowerDailyRecord[]; source: SourceMetadata }> {
  const isTrailingWindow = !params.startIso || !params.endIso;
  const days = params.days ?? 90;

  let { startIso, endIso } = isTrailingWindow
    ? resolveDefaultDateWindow(days)
    : { startIso: params.startIso!, endIso: params.endIso! };

  const cacheKey = `daily:${coordKey(params.lat, params.lng)}:${startIso}:${endIso}`;
  if (!params.forceRefresh) {
    const cached = repository.getCachedDaily(cacheKey);
    if (cached) {
      return {
        records: cached.records,
        source: { ...cached.source, cacheStatus: 'hit' },
      };
    }
  }

  const executeFetch = async (sIso: string, eIso: string) => {
    const url =
      `${NASA_POWER_BASE}/daily/point` +
      `?parameters=${DAILY_PARAMETERS.join(',')}` +
      `&community=AG` +
      `&longitude=${params.lng.toFixed(4)}` +
      `&latitude=${params.lat.toFixed(4)}` +
      `&start=${isoToCompact(sIso)}` +
      `&end=${isoToCompact(eIso)}` +
      `&format=JSON`;
    return fetchJsonWithRetry(url);
  };

  let fetchedPayload: any;
  let records: NasaPowerDailyRecord[] = [];

  try {
    const res = await executeFetch(startIso, endIso);
    fetchedPayload = res.json;
    records = parseDailyPayload(fetchedPayload);

    // If trailing window yielded zero valid observations (e.g., container clock ahead of NASA UTC clock),
    // automatically re-anchor to NASA's authoritative HTTP Date header and retry once.
    const validCount = records.filter((r) => r.provenance === 'real_observation').length;
    if (isTrailingWindow && validCount === 0 && res.serverDateMs) {
      const aligned = resolveDefaultDateWindow(days, res.serverDateMs);
      startIso = aligned.startIso;
      endIso = aligned.endIso;
      const retryRes = await executeFetch(startIso, endIso);
      fetchedPayload = retryRes.json;
      records = parseDailyPayload(fetchedPayload);
    }
  } catch (err: any) {
    // If NASA returned 422 because requested trailing dates exceeded NASA's live archive date,
    // re-anchor using NASA's authoritative server Date header.
    if (isTrailingWindow && err?.statusCode === 422 && err?.serverDateMs) {
      const aligned = resolveDefaultDateWindow(days, err.serverDateMs);
      startIso = aligned.startIso;
      endIso = aligned.endIso;
      const retryRes = await executeFetch(startIso, endIso);
      fetchedPayload = retryRes.json;
      records = parseDailyPayload(fetchedPayload);
    } else {
      throw err;
    }
  }

  const fetchedAt = new Date().toISOString();
  const apiVersion = fetchedPayload?.header?.api?.version ?? 'v2';
  const source: SourceMetadata = {
    provider: 'NASA POWER',
    dataset: 'Agroclimatology Daily Point (MERRA-2 / IMERG)',
    community: 'AG',
    spatialResolution: '0.5° × 0.625° (~55 km grid)',
    apiVersion: String(apiVersion),
    fetchedAt,
    cacheStatus: 'miss',
    coordinatesQueried: [Number(params.lat.toFixed(4)), Number(params.lng.toFixed(4))],
    provenance: records.some((r) => r.provenance === 'real_observation')
      ? 'real_observation'
      : 'missing_data',
  };

  const finalCacheKey = `daily:${coordKey(params.lat, params.lng)}:${startIso}:${endIso}`;
  repository.setCachedDaily({
    key: finalCacheKey,
    fetchedAt,
    expiresAt: Date.now() + DAILY_CACHE_TTL_MS,
    source,
    records,
  });

  // Also cache under original trailing key if dates shifted, so immediate subsequent reads hit cache
  if (finalCacheKey !== cacheKey) {
    repository.setCachedDaily({
      key: cacheKey,
      fetchedAt,
      expiresAt: Date.now() + DAILY_CACHE_TTL_MS,
      source,
      records,
    });
  }

  return { records, source };
}

export async function probeNasaPowerHealth(): Promise<{
  connected: boolean;
  latencyMs: number | null;
  checkedAt: string;
  serverUtcDate: string | null;
  error: string | null;
}> {
  const checkedAt = new Date().toISOString();
  try {
    // Lightweight climatology probe at Puttur centroid
    const url = `${NASA_POWER_BASE}/climatology/point?parameters=T2M&community=AG&longitude=79.5531&latitude=13.4419&format=JSON`;
    const { latencyMs, serverDateMs } = await fetchJsonWithRetry(url, 2);
    return {
      connected: true,
      latencyMs,
      checkedAt,
      serverUtcDate: serverDateMs ? new Date(serverDateMs).toISOString().slice(0, 10) : null,
      error: null,
    };
  } catch (err: any) {
    return {
      connected: false,
      latencyMs: null,
      checkedAt,
      serverUtcDate: null,
      error: err?.message ?? 'Unable to reach NASA POWER API',
    };
  }
}

export function getNasaPowerTelemetryStatus() {
  return {
    lastProbeLatencyMs,
    lastProbeTimeIso,
    lastProbeError,
    cacheEntries: repository.getCacheStats().totalEntries,
  };
}
