import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_THRESHOLDS,
  calculateNDVI,
  computeRegionalStatistics,
  evaluateEnvironmentalRisk,
  generateObservationsCSV,
  sanitizeNasaPowerValue,
} from '../src/shared/algorithms.ts';
import { createInitialPilotRegions } from '../src/shared/regions.ts';
import type {
  ClimatologyMonthlyBaseline,
  NasaPowerDailyRecord,
  SourceMetadata,
} from '../src/shared/types.ts';

test('NDVI calculation handles dense vegetation, bare soil, water, and 0/0 edge cases', () => {
  const dense = calculateNDVI(0.62, 0.08);
  assert.equal(dense.valid, true);
  assert.equal(dense.ndvi, 0.7714);
  assert.equal(dense.bandLabel, 'Dense Vegetation');

  const bare = calculateNDVI(0.22, 0.18);
  assert.equal(bare.valid, true);
  assert.equal(bare.ndvi, 0.1);
  assert.equal(bare.bandLabel, 'Little or No Vegetation');

  const water = calculateNDVI(0.05, 0.15);
  assert.equal(water.valid, true);
  assert.equal(water.ndvi, -0.5);
  assert.equal(water.bandLabel, 'Water, Clouds, or Non-Vegetated');

  const zeroDiv = calculateNDVI(0, 0);
  assert.equal(zeroDiv.valid, false);
  assert.equal(zeroDiv.ndvi, null);

  const negativeInput = calculateNDVI(-0.1, 0.2);
  assert.equal(negativeInput.valid, false);
  assert.equal(negativeInput.ndvi, null);
});

test('NASA POWER sanitizer distinguishes 0.0 mm zero rainfall from -999 missing data and physical outliers', () => {
  const zeroRain = sanitizeNasaPowerValue(0, 'PRECTOTCORR');
  assert.equal(zeroRain.value, 0);
  assert.equal(zeroRain.qualityFlag, 'valid');
  assert.equal(zeroRain.provenance, 'real_observation');

  const fillMissing = sanitizeNasaPowerValue(-999, 'PRECTOTCORR');
  assert.equal(fillMissing.value, null);
  assert.equal(fillMissing.qualityFlag, 'missing_fill_value');
  assert.equal(fillMissing.provenance, 'missing_data');

  const outlierTemp = sanitizeNasaPowerValue(120, 'T2M');
  assert.equal(outlierTemp.value, null);
  assert.equal(outlierTemp.qualityFlag, 'outlier_flagged');
  assert.equal(outlierTemp.provenance, 'missing_data');
});

test('Regional statistics & risk engine compute accurate anomalies and penalize confidence for unconnected satellites', () => {
  const [puttur] = createInitialPilotRegions();
  const climatology: ClimatologyMonthlyBaseline = {
    t2m: { '05': 32.0, ANN: 28.0 },
    ts: { '05': 34.0, ANN: 29.5 },
    prectotcorr: { '05': 2.0, ANN: 2.5 },
    rh2m: { '05': 55.0, ANN: 65.0 },
    source: 'Test Climatology',
    fetchedAt: '2026-01-01T00:00:00.000Z',
  };

  // 20 days of May: 19 valid warm dry days (TS = 37.5°C -> +3.5°C anomaly, 0mm rain) + 1 missing day
  const records: NasaPowerDailyRecord[] = Array.from({ length: 20 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    const isMissing = i === 10;
    return {
      date: `2025-05-${day}`,
      t2m: isMissing ? null : 35.0,
      t2mMax: isMissing ? null : 41.0,
      t2mMin: isMissing ? null : 28.5,
      ts: isMissing ? null : 37.5,
      prectotcorr: isMissing ? null : 0,
      rh2m: isMissing ? null : 42.0,
      solarRadiation: isMissing ? null : 22.5,
      ws2m: isMissing ? null : 2.1,
      qualityFlags: {
        T2M: isMissing ? 'missing_fill_value' : 'valid',
        T2M_MAX: isMissing ? 'missing_fill_value' : 'valid',
        T2M_MIN: isMissing ? 'missing_fill_value' : 'valid',
        TS: isMissing ? 'missing_fill_value' : 'valid',
        PRECTOTCORR: isMissing ? 'missing_fill_value' : 'valid',
        RH2M: isMissing ? 'missing_fill_value' : 'valid',
        ALLSKY_SFC_SW_DWN: isMissing ? 'missing_fill_value' : 'valid',
        WS2M: isMissing ? 'missing_fill_value' : 'valid',
      },
      provenance: isMissing ? 'missing_data' : 'real_observation',
    };
  });

  const stats = computeRegionalStatistics(records, climatology);
  assert.equal(stats.validObservationDays, 19);
  assert.equal(stats.missingObservationDays, 1);
  assert.equal(stats.zeroRainDays, 19);
  assert.equal(stats.tsAnomalyC, 3.5);
  assert.equal(stats.rainfallAnomalyPct, -100);
  assert.equal(stats.completenessPct, 95);

  const risk = evaluateEnvironmentalRisk(puttur, stats, DEFAULT_THRESHOLDS);
  assert.equal(risk.status, 'High');
  // Confidence must be capped <= 50% because Sentinel-2 (30%) and Landsat (20%) are not connected
  assert.ok(risk.confidenceScorePct <= 50, `Expected confidence <= 50, got ${risk.confidenceScorePct}`);
  assert.ok(risk.alerts.length >= 1, 'Expected concurrent thermal + dry alert');
  assert.match(risk.alerts[0].patternName, /Partial Pattern A/);
});

test('CSV export includes provenance headers and renders missing values cleanly distinct from zero', () => {
  const [puttur] = createInitialPilotRegions();
  const source: SourceMetadata = {
    provider: 'NASA POWER',
    dataset: 'Agroclimatology Daily Point',
    community: 'AG',
    spatialResolution: '0.5° × 0.625°',
    apiVersion: 'v2',
    fetchedAt: '2026-01-02T00:00:00.000Z',
    cacheStatus: 'miss',
    coordinatesQueried: puttur.center,
    provenance: 'real_observation',
  };

  const sampleRecords: NasaPowerDailyRecord[] = [
    {
      date: '2025-05-01',
      t2m: 31.2,
      t2mMax: 37.8,
      t2mMin: 25.1,
      ts: 33.4,
      prectotcorr: 0,
      rh2m: 58,
      solarRadiation: 21.4,
      ws2m: 2.3,
      qualityFlags: {
        T2M: 'valid',
        T2M_MAX: 'valid',
        T2M_MIN: 'valid',
        TS: 'valid',
        PRECTOTCORR: 'valid',
        RH2M: 'valid',
        ALLSKY_SFC_SW_DWN: 'valid',
        WS2M: 'valid',
      },
      provenance: 'real_observation',
    },
    {
      date: '2025-05-02',
      t2m: null,
      t2mMax: null,
      t2mMin: null,
      ts: null,
      prectotcorr: null,
      rh2m: null,
      solarRadiation: null,
      ws2m: null,
      qualityFlags: {
        T2M: 'missing_fill_value',
        T2M_MAX: 'missing_fill_value',
        T2M_MIN: 'missing_fill_value',
        TS: 'missing_fill_value',
        PRECTOTCORR: 'missing_fill_value',
        RH2M: 'missing_fill_value',
        ALLSKY_SFC_SW_DWN: 'missing_fill_value',
        WS2M: 'missing_fill_value',
      },
      provenance: 'missing_data',
    },
  ];

  const csv = generateObservationsCSV(puttur, sampleRecords, source);
  assert.match(csv, /TerraPulse Environmental Intelligence Platform/);
  assert.match(csv, /Puttur Pilot Basin/);
  assert.match(csv, /2025-05-01,puttur-ap,Puttur Pilot Basin,.*,0,/);
  assert.match(csv, /2025-05-02,puttur-ap,Puttur Pilot Basin,.*,,missing_fill_value,missing_fill_value,missing_fill_value,missing_data/);
});
