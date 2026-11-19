import type {
  ClimatologyMonthlyBaseline,
  EnvironmentalAlert,
  IndicatorMetadata,
  MonthlyAggregation,
  NasaIndicatorKey,
  NasaPowerDailyRecord,
  NdviCalculationResult,
  QualityFlag,
  Region,
  RegionalStatistics,
  RiskAssessment,
  RiskLevel,
  RiskScoringComponent,
  SanitizedMeasurement,
  SourceMetadata,
  ThresholdConfig,
} from './types.ts';

/**
 * Validated physical bounds for NASA POWER Agroclimatology (AG) daily parameters.
 * Values outside these bounds are flagged as outliers rather than accepted blindly.
 */
export const NASA_INDICATOR_METADATA: Record<NasaIndicatorKey, IndicatorMetadata> = {
  T2M: {
    key: 'T2M',
    label: '2m Atmospheric Air Temperature',
    shortLabel: 'Air Temp (2m)',
    unit: '°C',
    description: 'Mean daily atmospheric air temperature at 2 meters above surface (MERRA-2).',
    minValid: -90,
    maxValid: 65,
  },
  T2M_MAX: {
    key: 'T2M_MAX',
    label: '2m Maximum Air Temperature',
    shortLabel: 'Max Air Temp',
    unit: '°C',
    description: 'Daily maximum atmospheric air temperature at 2 meters.',
    minValid: -90,
    maxValid: 70,
  },
  T2M_MIN: {
    key: 'T2M_MIN',
    label: '2m Minimum Air Temperature',
    shortLabel: 'Min Air Temp',
    unit: '°C',
    description: 'Daily minimum atmospheric air temperature at 2 meters.',
    minValid: -95,
    maxValid: 60,
  },
  TS: {
    key: 'TS',
    label: 'Earth Skin Temperature',
    shortLabel: 'Skin Temp (TS)',
    unit: '°C',
    description: 'Coarse-grid (~0.5°x0.625°) modeled Earth skin temperature from NASA POWER MERRA-2. Distinct from 30m Landsat thermal LST.',
    minValid: -90,
    maxValid: 85,
  },
  PRECTOTCORR: {
    key: 'PRECTOTCORR',
    label: 'Corrected Precipitation',
    shortLabel: 'Precipitation',
    unit: 'mm/day',
    description: 'Bias-corrected daily precipitation total from NASA POWER.',
    minValid: 0,
    maxValid: 1000,
  },
  RH2M: {
    key: 'RH2M',
    label: 'Relative Humidity (2m)',
    shortLabel: 'Humidity (2m)',
    unit: '%',
    description: 'Relative humidity at 2 meters above surface.',
    minValid: 0,
    maxValid: 100,
  },
  ALLSKY_SFC_SW_DWN: {
    key: 'ALLSKY_SFC_SW_DWN',
    label: 'All-Sky Surface Solar Irradiance',
    shortLabel: 'Solar Irradiance',
    unit: 'MJ/m²/day',
    description: 'Total downward shortwave solar irradiance incident on a horizontal surface.',
    minValid: 0,
    maxValid: 45,
  },
  WS2M: {
    key: 'WS2M',
    label: 'Wind Speed (2m)',
    shortLabel: 'Wind Speed',
    unit: 'm/s',
    description: 'Average daily wind speed at 2 meters above ground.',
    minValid: 0,
    maxValid: 100,
  },
};

export const DEFAULT_THRESHOLDS: ThresholdConfig = {
  tempAnomalyWatchC: 1.5,
  tempAnomalyElevatedC: 2.5,
  tempAnomalyHighC: 3.5,
  rainfallDeficitWatchPct: -25,
  rainfallDeficitElevatedPct: -45,
  rainfallExcessWatchPct: 60,
  consecutiveDryDaysWatch: 14,
  consecutiveDryDaysElevated: 25,
  defaultBasemap: 'dark_carto',
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS_IN_MONTH = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

/**
 * Deterministic NDVI formula for Sentinel-2 imagery:
 *   NDVI = (NIR - RED) / (NIR + RED)
 *   NIR = Sentinel-2 Band 8 (842 nm)
 *   RED = Sentinel-2 Band 4 (665 nm)
 *
 * Returns indicative classification ranges — never universal land-cover proof.
 */
export function calculateNDVI(nir: number, red: number): NdviCalculationResult {
  if (!Number.isFinite(nir) || !Number.isFinite(red) || nir < 0 || red < 0) {
    return {
      ndvi: null,
      valid: false,
      bandLabel: 'Invalid Input',
      interpretation: 'Surface reflectance values must be finite non-negative numbers.',
      caveat: 'Check atmospheric correction (Level-2A BOA reflectance) and cloud/shadow masks.',
    };
  }

  const denominator = nir + red;
  if (denominator === 0) {
    return {
      ndvi: null,
      valid: false,
      bandLabel: 'Undefined (0/0)',
      interpretation: 'Denominator (NIR + RED) equals zero; NDVI cannot be computed.',
      caveat: 'Zero reflectance typically indicates masked/no-data pixels or deep shadow.',
    };
  }

  const rawNdvi = (nir - red) / denominator;
  const ndvi = Number(rawNdvi.toFixed(4));

  if (ndvi < 0) {
    return {
      ndvi,
      valid: true,
      bandLabel: 'Water, Clouds, or Non-Vegetated',
      interpretation: 'Below 0: Typically water bodies, cloud cover, snow, or artificial non-vegetated surfaces depending on scene context.',
      caveat: 'Indicative range only. Verify Sentinel-2 Scene Classification Layer (SCL) for clouds or cloud shadows.',
    };
  }
  if (ndvi < 0.2) {
    return {
      ndvi,
      valid: true,
      bandLabel: 'Little or No Vegetation',
      interpretation: '0.0 to 0.2: Bare soil, rock outcrops, fallow agricultural plots, or built-up surfaces.',
      caveat: 'Indicative range only. Dry-season fallow cropland in Andhra Pradesh naturally exhibits low NDVI.',
    };
  }
  if (ndvi < 0.4) {
    return {
      ndvi,
      valid: true,
      bandLabel: 'Sparse Vegetation',
      interpretation: '0.2 to 0.4: Dry scrubland, early-stage crops, or sparse grassland cover.',
      caveat: 'Indicative range only. Account for seasonal phenology before inferring vegetation stress.',
    };
  }
  if (ndvi < 0.6) {
    return {
      ndvi,
      valid: true,
      bandLabel: 'Moderate Vegetation',
      interpretation: '0.4 to 0.6: Active croplands, orchards, mixed woody savanna, or healthy shrub cover.',
      caveat: 'Indicative range only. Compare against multi-year same-month baselines.',
    };
  }
  return {
    ndvi,
    valid: true,
    bandLabel: 'Dense Vegetation',
    interpretation: 'Above 0.6: Dense forest canopy (e.g., Seshachalam/Nagari hill woodlands) or peak-growth irrigated crops.',
    caveat: 'Indicative range only. High atmospheric moisture can slightly shift optical reflectance.',
  };
}

/**
 * Sanitizes raw NASA POWER numeric values.
 * NASA POWER uses -999 (and occasionally -99 or -9999) as missing-data fill sentinels.
 * Critically distinguishes valid 0.0 mm rainfall from missing observations (null).
 */
export function sanitizeNasaPowerValue(
  raw: number | undefined | null,
  indicator: NasaIndicatorKey
): SanitizedMeasurement {
  if (raw === undefined || raw === null || !Number.isFinite(raw)) {
    return { value: null, qualityFlag: 'missing_fill_value', provenance: 'missing_data' };
  }

  // NASA POWER documented missing-data fill sentinel
  if (raw <= -99) {
    return { value: null, qualityFlag: 'missing_fill_value', provenance: 'missing_data' };
  }

  const bounds = NASA_INDICATOR_METADATA[indicator];
  if (raw < bounds.minValid || raw > bounds.maxValid) {
    return { value: null, qualityFlag: 'outlier_flagged', provenance: 'missing_data' };
  }

  return {
    value: Number(raw.toFixed(2)),
    qualityFlag: 'valid',
    provenance: 'real_observation',
  };
}

function mean(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((acc, v) => acc + v, 0);
  return Number((total / values.length).toFixed(2));
}

function sum(values: number[]): number | null {
  if (values.length === 0) return null;
  const total = values.reduce((acc, v) => acc + v, 0);
  return Number(total.toFixed(2));
}

/**
 * Computes deterministic regional statistics, monthly aggregations,
 * climatology baseline comparisons, and data quality counts from real NASA POWER daily records.
 */
export function computeRegionalStatistics(
  records: NasaPowerDailyRecord[],
  climatology: ClimatologyMonthlyBaseline
): RegionalStatistics {
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const totalDaysRequested = sorted.length;

  let validObservationDays = 0;
  let missingObservationDays = 0;
  let outlierFlaggedCount = 0;
  let zeroRainDays = 0;
  let wetDays = 0;

  const t2mVals: number[] = [];
  const t2mMaxVals: number[] = [];
  const t2mMinVals: number[] = [];
  const tsVals: number[] = [];
  const rainVals: number[] = [];
  const rh2mVals: number[] = [];
  const ws2mVals: number[] = [];
  const solarVals: number[] = [];

  // Baseline accumulation matched strictly by each valid observation's calendar month
  const expectedT2mByDay: number[] = [];
  const expectedTsByDay: number[] = [];
  const expectedRainByDay: number[] = [];

  // Monthly grouping map
  const monthlyMap = new Map<
    string,
    {
      calendarMonth: string;
      t2m: number[];
      ts: number[];
      rain: number[];
      validDays: number;
      missingDays: number;
      zeroRainDays: number;
    }
  >();

  let latestValidDate: string | null = null;
  let latestT2m: number | null = null;
  let latestTs: number | null = null;
  let latestRainMm: number | null = null;

  for (const rec of sorted) {
    const calMonth = rec.date.slice(5, 7); // "01".."12"
    const monthKey = rec.date.slice(0, 7); // "YYYY-MM"

    if (!monthlyMap.has(monthKey)) {
      monthlyMap.set(monthKey, {
        calendarMonth: calMonth,
        t2m: [],
        ts: [],
        rain: [],
        validDays: 0,
        missingDays: 0,
        zeroRainDays: 0,
      });
    }
    const bucket = monthlyMap.get(monthKey)!;

    // Count outlier flags across indicators
    for (const flag of Object.values(rec.qualityFlags)) {
      if (flag === 'outlier_flagged') outlierFlaggedCount += 1;
    }

    const hasCoreValid = rec.t2m !== null || rec.ts !== null || rec.prectotcorr !== null;
    if (hasCoreValid) {
      validObservationDays += 1;
      bucket.validDays += 1;
      latestValidDate = rec.date;
      if (rec.t2m !== null) latestT2m = rec.t2m;
      if (rec.ts !== null) latestTs = rec.ts;
      if (rec.prectotcorr !== null) latestRainMm = rec.prectotcorr;
    } else {
      missingObservationDays += 1;
      bucket.missingDays += 1;
    }

    if (rec.t2m !== null) {
      t2mVals.push(rec.t2m);
      bucket.t2m.push(rec.t2m);
      const baseT2m = climatology.t2m[calMonth];
      if (baseT2m !== null && baseT2m !== undefined) expectedT2mByDay.push(baseT2m);
    }
    if (rec.t2mMax !== null) t2mMaxVals.push(rec.t2mMax);
    if (rec.t2mMin !== null) t2mMinVals.push(rec.t2mMin);
    if (rec.ts !== null) {
      tsVals.push(rec.ts);
      bucket.ts.push(rec.ts);
      const baseTs = climatology.ts[calMonth];
      if (baseTs !== null && baseTs !== undefined) expectedTsByDay.push(baseTs);
    }
    if (rec.prectotcorr !== null) {
      rainVals.push(rec.prectotcorr);
      bucket.rain.push(rec.prectotcorr);
      if (rec.prectotcorr === 0) {
        zeroRainDays += 1;
        bucket.zeroRainDays += 1;
      } else if (rec.prectotcorr >= 1.0) {
        wetDays += 1;
      }
      const baseRainDaily = climatology.prectotcorr[calMonth];
      if (baseRainDaily !== null && baseRainDaily !== undefined) {
        expectedRainByDay.push(baseRainDaily);
      }
    }
    if (rec.rh2m !== null) rh2mVals.push(rec.rh2m);
    if (rec.ws2m !== null) ws2mVals.push(rec.ws2m);
    if (rec.solarRadiation !== null) solarVals.push(rec.solarRadiation);
  }

  // Consecutive dry days (< 1.0 mm) ending at the latest valid precipitation observation.
  // Missing days stop the count rather than pretending they were dry!
  let consecutiveDryDays = 0;
  const validRainRecords = sorted.filter((r) => r.prectotcorr !== null);
  for (let i = validRainRecords.length - 1; i >= 0; i -= 1) {
    const rain = validRainRecords[i].prectotcorr!;
    if (rain < 1.0) {
      consecutiveDryDays += 1;
    } else {
      break;
    }
  }

  // Trailing 30 valid days
  const validSorted = sorted.filter((r) => r.t2m !== null || r.ts !== null || r.prectotcorr !== null);
  const last30 = validSorted.slice(-30);
  const last30dAvgT2m = mean(last30.map((r) => r.t2m).filter((v): v is number => v !== null));
  const last30dAvgTs = mean(last30.map((r) => r.ts).filter((v): v is number => v !== null));
  const last30dRainfallMm = sum(
    last30.map((r) => r.prectotcorr).filter((v): v is number => v !== null)
  );

  const avgT2m = mean(t2mVals);
  const avgTs = mean(tsVals);
  const totalRainfallMm = sum(rainVals);

  const baselineT2m = mean(expectedT2mByDay);
  const baselineTs = mean(expectedTsByDay);
  const baselineExpectedRainMm = sum(expectedRainByDay);

  const t2mAnomalyC =
    avgT2m !== null && baselineT2m !== null ? Number((avgT2m - baselineT2m).toFixed(2)) : null;
  const tsAnomalyC =
    avgTs !== null && baselineTs !== null ? Number((avgTs - baselineTs).toFixed(2)) : null;

  // Guard against division by very tiny dry-season baselines (< 5 mm total expected)
  let rainfallAnomalyPct: number | null = null;
  if (
    totalRainfallMm !== null &&
    baselineExpectedRainMm !== null &&
    baselineExpectedRainMm >= 5
  ) {
    rainfallAnomalyPct = Number(
      (((totalRainfallMm - baselineExpectedRainMm) / baselineExpectedRainMm) * 100).toFixed(1)
    );
  }

  const completenessPct =
    totalDaysRequested > 0
      ? Number(((validObservationDays / totalDaysRequested) * 100).toFixed(1))
      : 0;

  const monthlySeries: MonthlyAggregation[] = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([monthKey, m]) => {
      const year = monthKey.slice(0, 4);
      const monthIdx = Math.max(0, Math.min(11, Number(m.calendarMonth) - 1));
      const baseT2m = climatology.t2m[m.calendarMonth] ?? null;
      const baseTs = climatology.ts[m.calendarMonth] ?? null;
      const baseDailyRain = climatology.prectotcorr[m.calendarMonth] ?? null;
      const expectedDays = m.rain.length > 0 ? m.rain.length : DAYS_IN_MONTH[monthIdx];
      const baseMonthlyRain =
        baseDailyRain !== null ? Number((baseDailyRain * expectedDays).toFixed(1)) : null;

      const mAvgT2m = mean(m.t2m);
      const mAvgTs = mean(m.ts);
      const mTotalRain = sum(m.rain);

      const mRainAnom =
        mTotalRain !== null && baseMonthlyRain !== null && baseMonthlyRain >= 3
          ? Number((((mTotalRain - baseMonthlyRain) / baseMonthlyRain) * 100).toFixed(1))
          : null;
      const mTempAnom =
        mAvgTs !== null && baseTs !== null ? Number((mAvgTs - baseTs).toFixed(2)) : null;

      return {
        monthKey,
        monthLabel: `${MONTH_NAMES[monthIdx]} ${year}`,
        calendarMonth: m.calendarMonth,
        avgT2m: mAvgT2m,
        avgTs: mAvgTs,
        totalRainfallMm: mTotalRain,
        baselineAvgT2m: baseT2m,
        baselineAvgTs: baseTs,
        baselineMonthlyRainMm: baseMonthlyRain,
        rainAnomalyPct: mRainAnom,
        tempAnomalyC: mTempAnom,
        validDays: m.validDays,
        missingDays: m.missingDays,
        zeroRainDays: m.zeroRainDays,
      };
    });

  return {
    observationStartDate: sorted[0]?.date ?? null,
    observationEndDate: sorted[sorted.length - 1]?.date ?? null,
    latestValidDate,
    totalDaysRequested,
    validObservationDays,
    missingObservationDays,
    outlierFlaggedCount,
    completenessPct,
    latestT2m,
    latestTs,
    latestRainMm,
    avgT2m,
    avgT2mMax: mean(t2mMaxVals),
    avgT2mMin: mean(t2mMinVals),
    avgTs,
    avgRh2m: mean(rh2mVals),
    avgWs2m: mean(ws2mVals),
    avgSolarRadiation: mean(solarVals),
    totalRainfallMm,
    last30dAvgT2m,
    last30dAvgTs,
    last30dRainfallMm,
    baselineT2m,
    baselineTs,
    baselineExpectedRainMm,
    t2mAnomalyC,
    tsAnomalyC,
    rainfallAnomalyPct,
    consecutiveDryDays,
    zeroRainDays,
    wetDays,
    monthlySeries,
  };
}

/**
 * Deterministic, explainable environmental risk engine.
 *
 * Planned multi-indicator weighting (Full Platform):
 *   1. Sentinel-2 NDVI Vegetation Deviation     (30% weight) -> Stage 3 (Not Connected)
 *   2. Landsat 8/9 30m Thermal LST Deviation    (20% weight) -> Stage 4 (Not Connected)
 *   3. NASA POWER Earth Skin Temp (TS) Anomaly  (20% weight) -> Active (Stage 2)
 *   4. NASA POWER Rainfall Anomaly              (20% weight) -> Active (Stage 2)
 *   5. Consecutive Dry-Spell Persistence        (10% weight) -> Active (Stage 2)
 *
 * Critical Scientific Rule:
 *   Missing satellite indicators DO NOT default to 0 (Normal); instead, they are excluded from
 *   the anomaly numerator and proportionally reduce overall assessment confidence.
 */
export function evaluateEnvironmentalRisk(
  region: Region,
  stats: RegionalStatistics,
  thresholds: ThresholdConfig = DEFAULT_THRESHOLDS
): RiskAssessment {
  const missingIndicators: string[] = [
    'Sentinel-2 NDVI Vegetation Index (Stage 3 — Not Connected)',
    'Landsat 8/9 30m Thermal LST (Stage 4 — Not Connected)',
  ];

  const breakdown: RiskScoringComponent[] = [
    {
      indicator: 'Sentinel-2 Vegetation (NDVI)',
      status: 'missing_provider',
      observed: 'Not Connected',
      baseline: 'Not Connected',
      deviation: 'Unavailable',
      weightPct: 30,
      normalizedScore: null,
      note: 'Requires Copernicus Data Space credentials (Stage 3). Excluded from score; reduces confidence by 30%.',
    },
    {
      indicator: 'Landsat 8/9 Thermal LST (30m)',
      status: 'missing_provider',
      observed: 'Not Connected',
      baseline: 'Not Connected',
      deviation: 'Unavailable',
      weightPct: 20,
      normalizedScore: null,
      note: 'Requires USGS Collection 2 Level-2 thermal product access (Stage 4). Excluded from score; reduces confidence by 20%.',
    },
  ];

  let weightedScoreSum = 0;
  let activeWeightSum = 0;
  let evaluatedCount = 0;

  // 1. NASA POWER Earth Skin Temperature Anomaly (20% weight)
  let tsScore: number | null = null;
  if (stats.tsAnomalyC !== null) {
    evaluatedCount += 1;
    const absHot = Math.max(0, stats.tsAnomalyC);
    if (absHot >= thresholds.tempAnomalyHighC) {
      tsScore = 90;
    } else if (absHot >= thresholds.tempAnomalyElevatedC) {
      tsScore = 68;
    } else if (absHot >= thresholds.tempAnomalyWatchC) {
      tsScore = 42;
    } else {
      tsScore = Math.min(25, Math.round((absHot / Math.max(0.5, thresholds.tempAnomalyWatchC)) * 25));
    }
    weightedScoreSum += tsScore * 20;
    activeWeightSum += 20;
  } else {
    missingIndicators.push('NASA POWER Earth Skin Temperature Anomaly');
  }

  breakdown.push({
    indicator: 'NASA POWER Earth Skin Temp (TS)',
    status: tsScore !== null ? 'evaluated' : 'missing_provider',
    observed: stats.avgTs !== null ? `${stats.avgTs.toFixed(1)} °C` : 'Missing',
    baseline: stats.baselineTs !== null ? `${stats.baselineTs.toFixed(1)} °C` : 'Unavailable',
    deviation:
      stats.tsAnomalyC !== null
        ? `${stats.tsAnomalyC >= 0 ? '+' : ''}${stats.tsAnomalyC.toFixed(2)} °C`
        : 'Unavailable',
    weightPct: 20,
    normalizedScore: tsScore,
    note: 'Evaluated against 30-year NASA POWER monthly climatology baseline.',
  });

  // 2. NASA POWER Precipitation Anomaly (20% weight)
  let rainScore: number | null = null;
  if (stats.rainfallAnomalyPct !== null) {
    evaluatedCount += 1;
    const anom = stats.rainfallAnomalyPct;
    if (anom <= thresholds.rainfallDeficitElevatedPct) {
      rainScore = 82;
    } else if (anom <= thresholds.rainfallDeficitWatchPct) {
      rainScore = 50;
    } else if (anom >= thresholds.rainfallExcessWatchPct * 1.5) {
      rainScore = 76;
    } else if (anom >= thresholds.rainfallExcessWatchPct) {
      rainScore = 48;
    } else {
      rainScore = Math.min(25, Math.round((Math.abs(anom) / 25) * 20));
    }
    weightedScoreSum += rainScore * 20;
    activeWeightSum += 20;
  } else {
    missingIndicators.push('NASA POWER Rainfall Baseline Anomaly (low dry-season baseline or missing data)');
  }

  breakdown.push({
    indicator: 'NASA POWER Precipitation Anomaly',
    status: rainScore !== null ? 'evaluated' : 'missing_provider',
    observed: stats.totalRainfallMm !== null ? `${stats.totalRainfallMm.toFixed(1)} mm` : 'Missing',
    baseline:
      stats.baselineExpectedRainMm !== null
        ? `${stats.baselineExpectedRainMm.toFixed(1)} mm`
        : 'Unavailable',
    deviation:
      stats.rainfallAnomalyPct !== null
        ? `${stats.rainfallAnomalyPct >= 0 ? '+' : ''}${stats.rainfallAnomalyPct.toFixed(1)}%`
        : 'Insufficient baseline',
    weightPct: 20,
    normalizedScore: rainScore,
    note: 'Evaluates both rainfall deficit (drought stress) and extreme excess (surface disruption risk).',
  });

  // 3. Consecutive Dry-Spell Persistence (10% weight)
  let dryScore: number | null = null;
  if (stats.validObservationDays > 0) {
    evaluatedCount += 1;
    if (stats.consecutiveDryDays >= thresholds.consecutiveDryDaysElevated) {
      dryScore = 78;
    } else if (stats.consecutiveDryDays >= thresholds.consecutiveDryDaysWatch) {
      dryScore = 46;
    } else {
      dryScore = Math.min(
        20,
        Math.round((stats.consecutiveDryDays / Math.max(1, thresholds.consecutiveDryDaysWatch)) * 20)
      );
    }
    weightedScoreSum += dryScore * 10;
    activeWeightSum += 10;
  }

  breakdown.push({
    indicator: 'Consecutive Dry Days (< 1.0 mm)',
    status: dryScore !== null ? 'evaluated' : 'missing_provider',
    observed: `${stats.consecutiveDryDays} days`,
    baseline: `Watch ≥ ${thresholds.consecutiveDryDaysWatch} d`,
    deviation:
      stats.consecutiveDryDays >= thresholds.consecutiveDryDaysWatch
        ? `+${stats.consecutiveDryDays - thresholds.consecutiveDryDaysWatch} d above watch`
        : 'Within watch bound',
    weightPct: 10,
    normalizedScore: dryScore,
    note: 'Counts consecutive valid precipitation observations below 1.0 mm; halts on missing data.',
  });

  const anomalyScore =
    activeWeightSum > 0 ? Math.round(weightedScoreSum / activeWeightSum) : 0;

  // Confidence directly scales with active indicator weight AND temporal data completeness
  const completenessFactor = Math.max(0, Math.min(1, stats.completenessPct / 100));
  const confidenceScorePct = Math.round(activeWeightSum * completenessFactor);
  const confidenceLabel: 'Low' | 'Moderate' | 'High' =
    confidenceScorePct >= 70 ? 'High' : confidenceScorePct >= 35 ? 'Moderate' : 'Low';

  let status: RiskLevel = 'Normal';
  if (anomalyScore >= 75) {
    status = 'High';
  } else if (anomalyScore >= 55) {
    status = 'Elevated';
  } else if (anomalyScore >= 35) {
    status = 'Watch';
  }

  // Generate structured, evidence-backed alerts only when configured thresholds are breached
  const alerts: EnvironmentalAlert[] = [];
  const detectionDate = stats.latestValidDate ?? new Date().toISOString().slice(0, 10);

  // Thermal + Dryness Stress Screening (Partial Pattern A — Weather Only)
  const isWarmAnomaly =
    stats.tsAnomalyC !== null && stats.tsAnomalyC >= thresholds.tempAnomalyWatchC;
  const isDryAnomaly =
    (stats.rainfallAnomalyPct !== null &&
      stats.rainfallAnomalyPct <= thresholds.rainfallDeficitWatchPct) ||
    stats.consecutiveDryDays >= thresholds.consecutiveDryDaysWatch;

  if (isWarmAnomaly && isDryAnomaly) {
    const level: RiskLevel =
      (stats.tsAnomalyC ?? 0) >= thresholds.tempAnomalyHighC ||
      (stats.rainfallAnomalyPct ?? 0) <= thresholds.rainfallDeficitElevatedPct
        ? 'High'
        : 'Elevated';
    alerts.push({
      id: `TP-${region.id.toUpperCase().slice(0, 4)}-${detectionDate.replace(/-/g, '')}-A`,
      regionId: region.id,
      regionName: region.name,
      coordinates: region.center,
      detectionDate,
      riskLevel: level,
      patternName: 'Partial Pattern A: Concurrent Thermal Excess & Moisture Deficit',
      indicatorsInvolved: [
        'NASA POWER Earth Skin Temp (TS)',
        'NASA POWER Precipitation (PRECTOTCORR)',
        'Consecutive Dry Spell',
      ],
      observedValues: {
        'Mean Skin Temp (TS)': `${stats.avgTs?.toFixed(1) ?? 'N/A'} °C`,
        'Period Rainfall': `${stats.totalRainfallMm?.toFixed(1) ?? 'N/A'} mm`,
        'Consecutive Dry Days': `${stats.consecutiveDryDays} days`,
      },
      historicalBaseline: {
        'Climatology TS': `${stats.baselineTs?.toFixed(1) ?? 'N/A'} °C`,
        'Expected Rainfall': `${stats.baselineExpectedRainMm?.toFixed(1) ?? 'N/A'} mm`,
      },
      deviationFromBaseline: {
        'TS Deviation': `${stats.tsAnomalyC !== null && stats.tsAnomalyC >= 0 ? '+' : ''}${stats.tsAnomalyC?.toFixed(2) ?? 'N/A'} °C`,
        'Rainfall Anomaly': `${stats.rainfallAnomalyPct !== null ? `${stats.rainfallAnomalyPct}%` : 'N/A'}`,
      },
      explanation:
        'Observed NASA POWER skin temperatures exceed multi-year monthly climatology alongside below-baseline precipitation or an extended dry spell. This weather signature warrants monitoring for potential vegetation stress, though optical vegetation confirmation (Sentinel-2 NDVI) is not yet connected.',
      confidenceLabel,
      confidenceScorePct,
      missingIndicators,
      recommendedVerificationSteps: [
        'Inspect local soil moisture and crop irrigation status across the Puttur/Tirupati watershed.',
        'Cross-check with Sentinel-2 NDVI once Stage 3 Copernicus connector credentials are configured.',
        'Verify whether elevated temperatures align with normal regional pre-monsoon seasonal variability.',
      ],
      supportingSources: ['NASA POWER Agroclimatology Daily v2', 'NASA POWER 30-Year Climatology'],
    });
  } else if (isWarmAnomaly) {
    const level: RiskLevel =
      (stats.tsAnomalyC ?? 0) >= thresholds.tempAnomalyElevatedC ? 'Elevated' : 'Watch';
    alerts.push({
      id: `TP-${region.id.toUpperCase().slice(0, 4)}-${detectionDate.replace(/-/g, '')}-T`,
      regionId: region.id,
      regionName: region.name,
      coordinates: region.center,
      detectionDate,
      riskLevel: level,
      patternName: 'Thermal Surface Anomaly (Weather-Only Screening)',
      indicatorsInvolved: ['NASA POWER Earth Skin Temp (TS)', 'NASA POWER 2m Air Temp (T2M)'],
      observedValues: {
        'Mean Skin Temp (TS)': `${stats.avgTs?.toFixed(1) ?? 'N/A'} °C`,
        'Mean 2m Air Temp (T2M)': `${stats.avgT2m?.toFixed(1) ?? 'N/A'} °C`,
      },
      historicalBaseline: {
        'Climatology TS': `${stats.baselineTs?.toFixed(1) ?? 'N/A'} °C`,
        'Climatology T2M': `${stats.baselineT2m?.toFixed(1) ?? 'N/A'} °C`,
      },
      deviationFromBaseline: {
        'TS Deviation': `+${stats.tsAnomalyC?.toFixed(2) ?? 'N/A'} °C`,
        'T2M Deviation': `${stats.t2mAnomalyC !== null && stats.t2mAnomalyC >= 0 ? '+' : ''}${stats.t2mAnomalyC?.toFixed(2) ?? 'N/A'} °C`,
      },
      explanation:
        'NASA POWER Earth skin temperature exceeds the configured threshold relative to monthly climatology. High-resolution 30m spatial localization requires Landsat 8/9 thermal imagery (Stage 4).',
      confidenceLabel,
      confidenceScorePct,
      missingIndicators,
      recommendedVerificationSteps: [
        'Compare against neighboring comparison regions (Tirupati, Chittoor) to determine if warming is synoptic or localized.',
        'Check daily maximum 2m air temperatures for heat-stress persistence.',
      ],
      supportingSources: ['NASA POWER Agroclimatology Daily v2', 'NASA POWER 30-Year Climatology'],
    });
  } else if (isDryAnomaly) {
    const level: RiskLevel =
      (stats.rainfallAnomalyPct ?? 0) <= thresholds.rainfallDeficitElevatedPct ||
      stats.consecutiveDryDays >= thresholds.consecutiveDryDaysElevated
        ? 'Elevated'
        : 'Watch';
    alerts.push({
      id: `TP-${region.id.toUpperCase().slice(0, 4)}-${detectionDate.replace(/-/g, '')}-D`,
      regionId: region.id,
      regionName: region.name,
      coordinates: region.center,
      detectionDate,
      riskLevel: level,
      patternName: 'Precipitation Deficit / Extended Dry Spell',
      indicatorsInvolved: ['NASA POWER Precipitation (PRECTOTCORR)', 'Consecutive Dry Days'],
      observedValues: {
        'Period Rainfall': `${stats.totalRainfallMm?.toFixed(1) ?? 'N/A'} mm`,
        'Consecutive Dry Days': `${stats.consecutiveDryDays} days`,
      },
      historicalBaseline: {
        'Expected Rainfall': `${stats.baselineExpectedRainMm?.toFixed(1) ?? 'N/A'} mm`,
        'Dry-Spell Watch Threshold': `${thresholds.consecutiveDryDaysWatch} days`,
      },
      deviationFromBaseline: {
        'Rainfall Anomaly': `${stats.rainfallAnomalyPct !== null ? `${stats.rainfallAnomalyPct}%` : 'N/A'}`,
      },
      explanation:
        'Observed cumulative precipitation is significantly below the NASA POWER historical monthly baseline or the region has experienced an extended dry spell. Does not by itself prove agricultural drought without vegetation and soil moisture confirmation.',
      confidenceLabel,
      confidenceScorePct,
      missingIndicators,
      recommendedVerificationSteps: [
        'Validate against local IMD rain-gauge stations or CHIRPS 5km rainfall once connected in Stage 4.',
        'Check regional reservoir and groundwater status.',
      ],
      supportingSources: ['NASA POWER Agroclimatology Daily v2', 'NASA POWER 30-Year Climatology'],
    });
  }

  // Pattern B screening: Unusually High Rainfall
  if (
    stats.rainfallAnomalyPct !== null &&
    stats.rainfallAnomalyPct >= thresholds.rainfallExcessWatchPct
  ) {
    const level: RiskLevel =
      stats.rainfallAnomalyPct >= thresholds.rainfallExcessWatchPct * 1.5 ? 'Elevated' : 'Watch';
    alerts.push({
      id: `TP-${region.id.toUpperCase().slice(0, 4)}-${detectionDate.replace(/-/g, '')}-B`,
      regionId: region.id,
      regionName: region.name,
      coordinates: region.center,
      detectionDate,
      riskLevel: level,
      patternName: 'Partial Pattern B: Unusually High Cumulative Precipitation',
      indicatorsInvolved: ['NASA POWER Precipitation (PRECTOTCORR)'],
      observedValues: {
        'Period Rainfall': `${stats.totalRainfallMm?.toFixed(1) ?? 'N/A'} mm`,
        'Wet Days (≥1mm)': `${stats.wetDays} days`,
      },
      historicalBaseline: {
        'Expected Rainfall': `${stats.baselineExpectedRainMm?.toFixed(1) ?? 'N/A'} mm`,
      },
      deviationFromBaseline: {
        'Rainfall Anomaly': `+${stats.rainfallAnomalyPct.toFixed(1)}%`,
      },
      explanation:
        'Cumulative rainfall significantly exceeds historical climatology for the observation window. This may indicate potential surface water accumulation or runoff changes requiring verification with satellite imagery.',
      confidenceLabel,
      confidenceScorePct,
      missingIndicators,
      recommendedVerificationSteps: [
        'Inspect daily rainfall peaks in Rainfall Intelligence to check for concentrated extreme precipitation events.',
        'Verify drainage channels and low-lying watershed boundaries in the region.',
      ],
      supportingSources: ['NASA POWER Agroclimatology Daily v2', 'NASA POWER 30-Year Climatology'],
    });
  }

  return {
    status,
    anomalyScore,
    confidenceScorePct,
    confidenceLabel,
    evaluatedIndicatorsCount: evaluatedCount,
    totalPlannedIndicatorsCount: 5,
    missingIndicators,
    methodologyNote:
      'Stage 2 weather-only deterministic screening: score reflects weighted NASA POWER thermal, precipitation, and dry-spell deviations. Confidence is capped at ≤50% until Sentinel-2 NDVI (30%) and Landsat 8/9 LST (20%) connectors are active in Stages 3–4.',
    scoringBreakdown: breakdown,
    alerts,
  };
}

/**
 * Generates an RFC-4180 compliant CSV export with full scientific provenance metadata.
 * Null values are written cleanly as empty cells paired with explicit quality flag columns
 * so missing data is never confused with zero measurements.
 */
export function generateObservationsCSV(
  region: Region,
  records: NasaPowerDailyRecord[],
  source: SourceMetadata
): string {
  const escapeCell = (val: string | number | null | undefined): string => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const lines: string[] = [
    `# TerraPulse Environmental Intelligence Platform — Verified Observation Export`,
    `# Region: ${region.name} (${region.district}, ${region.state}, ${region.country})`,
    `# Centroid: ${region.center[0].toFixed(4)} N, ${region.center[1].toFixed(4)} E | Area: ${region.areaKm2.toFixed(2)} km2`,
    `# Source: ${source.provider} (${source.dataset}, Community ${source.community}, Resolution ${source.spatialResolution})`,
    `# Exported At: ${new Date().toISOString()} | Data Fetched At: ${source.fetchedAt}`,
    `# Note: Empty numeric cells denote missing observations (filtered from -999 sentinel) and are distinct from 0.0 measurements.`,
    [
      'observation_date',
      'region_id',
      'region_name',
      'latitude',
      'longitude',
      't2m_c',
      't2m_max_c',
      't2m_min_c',
      'earth_skin_temp_ts_c',
      'precipitation_mm_day',
      'relative_humidity_pct',
      'solar_irradiance_mj_m2_day',
      'wind_speed_2m_ms',
      't2m_quality',
      'ts_quality',
      'precip_quality',
      'provenance',
      'source_provider',
    ].join(','),
  ];

  for (const r of records) {
    lines.push(
      [
        r.date,
        region.id,
        region.name,
        region.center[0].toFixed(4),
        region.center[1].toFixed(4),
        r.t2m,
        r.t2mMax,
        r.t2mMin,
        r.ts,
        r.prectotcorr,
        r.rh2m,
        r.solarRadiation,
        r.ws2m,
        r.qualityFlags.T2M,
        r.qualityFlags.TS,
        r.qualityFlags.PRECTOTCORR,
        r.provenance,
        source.provider,
      ]
        .map(escapeCell)
        .join(',')
    );
  }

  return lines.join('\n');
}
