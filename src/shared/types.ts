import type { Feature, Polygon } from 'geojson';

export type NavSection =
  | 'overview'
  | 'map'
  | 'vegetation'
  | 'temperature'
  | 'rainfall'
  | 'risk'
  | 'historical'
  | 'reports'
  | 'sources'
  | 'settings';

export type MapLayerId =
  | 'nasa_temp'
  | 'nasa_rainfall'
  | 'sentinel_ndvi'
  | 'landsat_lst'
  | 'composite_risk';

export type MapBasemapId = 'dark_carto' | 'osm_standard' | 'topo';

export type ObservationProvenance =
  | 'real_observation'
  | 'historical_baseline'
  | 'estimated_value'
  | 'missing_data';

export type QualityFlag =
  | 'valid'
  | 'missing_fill_value'
  | 'outlier_flagged';

export type RiskLevel = 'Normal' | 'Watch' | 'Elevated' | 'High';

export type NasaIndicatorKey =
  | 'T2M'
  | 'T2M_MAX'
  | 'T2M_MIN'
  | 'TS'
  | 'PRECTOTCORR'
  | 'RH2M'
  | 'ALLSKY_SFC_SW_DWN'
  | 'WS2M';

export interface IndicatorMetadata {
  key: NasaIndicatorKey;
  label: string;
  shortLabel: string;
  unit: string;
  description: string;
  minValid: number;
  maxValid: number;
}

export interface GeographicalCell {
  id: string;
  regionId: string;
  label: string;
  row: number;
  col: number;
  centroid: [number, number]; // [lat, lng]
  areaKm2: number;
  geometry: Feature<Polygon>;
}

export interface Region {
  id: string;
  name: string;
  district: string;
  state: string;
  country: string;
  description: string;
  origin: 'pilot' | 'comparison' | 'custom';
  center: [number, number]; // [lat, lng]
  bbox: [number, number, number, number]; // [west, south, east, north]
  areaKm2: number;
  boundary: Feature<Polygon>;
  cells: GeographicalCell[];
  createdAt: string;
}

export interface SanitizedMeasurement {
  value: number | null;
  qualityFlag: QualityFlag;
  provenance: ObservationProvenance;
}

export interface NasaPowerDailyRecord {
  date: string; // YYYY-MM-DD
  t2m: number | null;
  t2mMax: number | null;
  t2mMin: number | null;
  ts: number | null;
  prectotcorr: number | null;
  rh2m: number | null;
  solarRadiation: number | null;
  ws2m: number | null;
  qualityFlags: Record<NasaIndicatorKey, QualityFlag>;
  provenance: ObservationProvenance;
}

export interface ClimatologyMonthlyBaseline {
  // Month numbers "01".."12" and "ANN"
  t2m: Record<string, number | null>;
  ts: Record<string, number | null>;
  prectotcorr: Record<string, number | null>; // mm/day monthly climatology
  rh2m: Record<string, number | null>;
  source: string;
  fetchedAt: string;
}

export interface MonthlyAggregation {
  monthKey: string; // YYYY-MM
  monthLabel: string; // e.g., "Sep 2025"
  calendarMonth: string; // "01".."12"
  avgT2m: number | null;
  avgTs: number | null;
  totalRainfallMm: number | null;
  baselineAvgT2m: number | null;
  baselineAvgTs: number | null;
  baselineMonthlyRainMm: number | null;
  rainAnomalyPct: number | null;
  tempAnomalyC: number | null;
  validDays: number;
  missingDays: number;
  zeroRainDays: number;
}

export interface RegionalStatistics {
  observationStartDate: string | null;
  observationEndDate: string | null;
  latestValidDate: string | null;
  totalDaysRequested: number;
  validObservationDays: number;
  missingObservationDays: number;
  outlierFlaggedCount: number;
  completenessPct: number;
  // Trailing 30-day & period averages
  latestT2m: number | null;
  latestTs: number | null;
  latestRainMm: number | null;
  avgT2m: number | null;
  avgT2mMax: number | null;
  avgT2mMin: number | null;
  avgTs: number | null;
  avgRh2m: number | null;
  avgWs2m: number | null;
  avgSolarRadiation: number | null;
  totalRainfallMm: number | null;
  last30dAvgT2m: number | null;
  last30dAvgTs: number | null;
  last30dRainfallMm: number | null;
  // Baselines & Anomalies
  baselineT2m: number | null;
  baselineTs: number | null;
  baselineExpectedRainMm: number | null;
  t2mAnomalyC: number | null;
  tsAnomalyC: number | null;
  rainfallAnomalyPct: number | null;
  consecutiveDryDays: number;
  zeroRainDays: number;
  wetDays: number;
  monthlySeries: MonthlyAggregation[];
}

export interface ThresholdConfig {
  tempAnomalyWatchC: number;
  tempAnomalyElevatedC: number;
  tempAnomalyHighC: number;
  rainfallDeficitWatchPct: number;
  rainfallDeficitElevatedPct: number;
  rainfallExcessWatchPct: number;
  consecutiveDryDaysWatch: number;
  consecutiveDryDaysElevated: number;
  defaultBasemap: MapBasemapId;
}

export interface EnvironmentalAlert {
  id: string;
  regionId: string;
  regionName: string;
  coordinates: [number, number];
  detectionDate: string;
  riskLevel: RiskLevel;
  patternName: string;
  indicatorsInvolved: string[];
  observedValues: Record<string, string>;
  historicalBaseline: Record<string, string>;
  deviationFromBaseline: Record<string, string>;
  explanation: string;
  confidenceLabel: 'Low' | 'Moderate' | 'High';
  confidenceScorePct: number;
  missingIndicators: string[];
  recommendedVerificationSteps: string[];
  supportingSources: string[];
}

export interface RiskScoringComponent {
  indicator: string;
  status: 'evaluated' | 'missing_provider';
  observed: string;
  baseline: string;
  deviation: string;
  weightPct: number;
  normalizedScore: number | null; // 0-100
  note: string;
}

export interface RiskAssessment {
  status: RiskLevel;
  anomalyScore: number; // 0-100 deterministic weighted score over available indicators
  confidenceScorePct: number; // Penalized when satellite indicators (NDVI/Landsat LST) are missing
  confidenceLabel: 'Low' | 'Moderate' | 'High';
  evaluatedIndicatorsCount: number;
  totalPlannedIndicatorsCount: number;
  missingIndicators: string[];
  methodologyNote: string;
  scoringBreakdown: RiskScoringComponent[];
  alerts: EnvironmentalAlert[];
}

export interface SourceMetadata {
  provider: string;
  dataset: string;
  community: string;
  spatialResolution: string;
  apiVersion: string;
  fetchedAt: string;
  cacheStatus: 'hit' | 'miss';
  coordinatesQueried: [number, number];
  provenance: ObservationProvenance;
}

export interface RegionalTelemetryResponse {
  region: Region;
  source: SourceMetadata;
  statistics: RegionalStatistics;
  climatology: ClimatologyMonthlyBaseline;
  dailyRecords: NasaPowerDailyRecord[];
  risk: RiskAssessment;
}

export interface CellTelemetryResponse {
  cell: GeographicalCell;
  regionName: string;
  source: SourceMetadata;
  statistics: RegionalStatistics;
  recentRecords: NasaPowerDailyRecord[];
  risk: RiskAssessment;
}

export interface RegionComparisonItem {
  regionId: string;
  regionName: string;
  district: string;
  center: [number, number];
  areaKm2: number;
  cellCount: number;
  latestValidDate: string | null;
  avgT2m: number | null;
  avgTs: number | null;
  tsAnomalyC: number | null;
  totalRainfallMm: number | null;
  rainfallAnomalyPct: number | null;
  completenessPct: number;
  riskStatus: RiskLevel;
  confidenceScorePct: number;
  sourceProvider: string;
  error?: string;
}

export interface DataSourceInfo {
  id: string;
  name: string;
  providerUrl: string;
  stage: string;
  status: 'connected' | 'not_connected' | 'coming_soon';
  purpose: string;
  parameters: string[];
  spatialResolution: string;
  temporalCadence: string;
  authRequired: boolean;
  requiredEnvVars: string[];
  setupInstructions: string;
  lastCheckedAt: string | null;
  latencyMs: number | null;
  cacheEntries?: number;
  errorMessage?: string | null;
}

export interface NdviCalculationResult {
  ndvi: number | null;
  valid: boolean;
  bandLabel: string;
  interpretation: string;
  caveat: string;
}
