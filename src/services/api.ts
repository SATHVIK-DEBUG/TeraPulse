import type {
  CellTelemetryResponse,
  DataSourceInfo,
  Region,
  RegionComparisonItem,
  RegionalTelemetryResponse,
  ThresholdConfig,
} from '../shared/types';

async function requestJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const body = await response.json();
      if (body?.error) {
        message = body.details ? `${body.error} (${body.details})` : body.error;
      }
    } catch {
      // Ignore non-JSON error body
    }
    throw new Error(message);
  }

  return (await response.json()) as T;
}

export const api = {
  getRegions: () => requestJson<{ regions: Region[] }>('/api/regions'),

  createRegion: (payload: {
    name: string;
    district: string;
    state: string;
    country: string;
    description: string;
    mode: 'bbox' | 'geojson';
    bbox?: { south: number; west: number; north: number; east: number };
    geojson?: unknown;
  }) =>
    requestJson<{ region: Region }>('/api/regions', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deleteRegion: (id: string) =>
    requestJson<{ deleted: boolean; id: string }>(`/api/regions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),

  getSummary: (regionId: string, days = 90, forceRefresh = false) =>
    requestJson<RegionalTelemetryResponse>(
      `/api/observations/summary?regionId=${encodeURIComponent(regionId)}&days=${days}&forceRefresh=${forceRefresh}`
    ),

  getHistorical: (params: {
    regionId: string;
    startDate: string;
    endDate: string;
    compareRegionId?: string;
  }) => {
    const qs = new URLSearchParams({
      regionId: params.regionId,
      startDate: params.startDate,
      endDate: params.endDate,
    });
    if (params.compareRegionId) qs.set('compareRegionId', params.compareRegionId);
    return requestJson<{
      primary: RegionalTelemetryResponse;
      comparison: RegionalTelemetryResponse | null;
    }>(`/api/observations/historical?${qs.toString()}`);
  },

  getComparison: (days = 90) =>
    requestJson<{ days: number; regions: RegionComparisonItem[] }>(
      `/api/observations/compare?days=${days}`
    ),

  getCellTelemetry: (regionId: string, cellId: string, days = 60) =>
    requestJson<CellTelemetryResponse>(
      `/api/map/cell?regionId=${encodeURIComponent(regionId)}&cellId=${encodeURIComponent(cellId)}&days=${days}`
    ),

  getSources: () =>
    requestJson<{
      sources: DataSourceInfo[];
      cache: { dailyEntries: number; climatologyEntries: number; totalEntries: number };
    }>('/api/sources'),

  probeNasaPower: () =>
    requestJson<{
      probe: {
        connected: boolean;
        latencyMs: number | null;
        checkedAt: string;
        serverUtcDate: string | null;
        error: string | null;
      };
      sources: DataSourceInfo[];
      cache: { dailyEntries: number; climatologyEntries: number; totalEntries: number };
    }>('/api/sources/nasa-power/probe', { method: 'POST' }),

  clearCache: () =>
    requestJson<{
      cleared: number;
      cache: { dailyEntries: number; climatologyEntries: number; totalEntries: number };
    }>('/api/cache/clear', { method: 'POST' }),

  getThresholds: () => requestJson<{ thresholds: ThresholdConfig }>('/api/settings/thresholds'),

  updateThresholds: (patch: Partial<ThresholdConfig>) =>
    requestJson<{ thresholds: ThresholdConfig }>('/api/settings/thresholds', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  geocode: (q: string) =>
    requestJson<{
      results: Array<{ displayName: string; lat: number; lng: number; type: string }>;
    }>(`/api/geocode?q=${encodeURIComponent(q)}`),

  getSupabaseSchema: async (): Promise<string> => {
    const res = await fetch('/api/schema/supabase');
    if (!res.ok) throw new Error('Unable to load schema SQL.');
    return res.text();
  },

  buildCsvExportUrl: (params: {
    regionId: string;
    startDate?: string;
    endDate?: string;
    days?: number;
  }) => {
    const qs = new URLSearchParams({ regionId: params.regionId });
    if (params.startDate && params.endDate) {
      qs.set('startDate', params.startDate);
      qs.set('endDate', params.endDate);
    } else if (params.days) {
      qs.set('days', String(params.days));
    }
    return `/api/export/csv?${qs.toString()}`;
  },
};
