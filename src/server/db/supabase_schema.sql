-- =============================================================================
-- TerraPulse Environmental Intelligence Platform
-- Supabase PostgreSQL + PostGIS Production Schema Blueprint (12 Core Tables)
-- =============================================================================
-- Stage 1 & 2 run on a modular server cache implementing EnvironmentalRepository.
-- Run this script in Supabase SQL Editor when migrating to persistent PostGIS.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 1. Users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  auth_uid TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'analyst' CHECK (role IN ('viewer', 'analyst', 'admin')),
  organization TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Data Sources Registry
CREATE TABLE IF NOT EXISTS public.data_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider_url TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('weather', 'optical_satellite', 'thermal_satellite', 'rainfall_gridded', 'geospatial_platform')),
  spatial_resolution TEXT NOT NULL,
  temporal_cadence TEXT NOT NULL,
  requires_auth BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'not_connected' CHECK (status IN ('connected', 'not_connected', 'degraded')),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Monitored Geographical Regions
CREATE TABLE IF NOT EXISTS public.regions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  district TEXT NOT NULL,
  state TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'India',
  description TEXT,
  origin TEXT NOT NULL DEFAULT 'custom' CHECK (origin IN ('pilot', 'comparison', 'custom')),
  boundary GEOMETRY(Polygon, 4326) NOT NULL,
  centroid GEOMETRY(Point, 4326) NOT NULL,
  area_km2 DOUBLE PRECISION NOT NULL CHECK (area_km2 > 0),
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_regions_boundary_gist ON public.regions USING GIST (boundary);

-- 4. Spatial Grid Cells
CREATE TABLE IF NOT EXISTS public.geographical_cells (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  grid_row INTEGER NOT NULL CHECK (grid_row > 0),
  grid_col INTEGER NOT NULL CHECK (grid_col > 0),
  geometry GEOMETRY(Polygon, 4326) NOT NULL,
  centroid GEOMETRY(Point, 4326) NOT NULL,
  area_km2 DOUBLE PRECISION NOT NULL CHECK (area_km2 > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, grid_row, grid_col)
);
CREATE INDEX IF NOT EXISTS idx_cells_region ON public.geographical_cells(region_id);
CREATE INDEX IF NOT EXISTS idx_cells_geom_gist ON public.geographical_cells USING GIST (geometry);

-- 5. Satellite Observations Metadata (Sentinel-2 / Landsat Scenes)
CREATE TABLE IF NOT EXISTS public.satellite_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES public.data_sources(id),
  scene_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  acquisition_time TIMESTAMPTZ NOT NULL,
  cloud_cover_pct DOUBLE PRECISION CHECK (cloud_cover_pct >= 0 AND cloud_cover_pct <= 100),
  processing_level TEXT NOT NULL,
  footprint GEOMETRY(Polygon, 4326),
  quality_flag TEXT NOT NULL DEFAULT 'valid',
  raw_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (source_id, scene_id)
);
CREATE INDEX IF NOT EXISTS idx_sat_obs_region_time ON public.satellite_observations(region_id, acquisition_time DESC);

-- 6. Vegetation Observations (Sentinel-2 NDVI — Stage 3)
CREATE TABLE IF NOT EXISTS public.vegetation_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  cell_id TEXT REFERENCES public.geographical_cells(id) ON DELETE CASCADE,
  satellite_observation_id UUID REFERENCES public.satellite_observations(id) ON DELETE SET NULL,
  source_id TEXT NOT NULL REFERENCES public.data_sources(id),
  observation_date DATE NOT NULL,
  ndvi_mean DOUBLE PRECISION CHECK (ndvi_mean >= -1.0 AND ndvi_mean <= 1.0),
  ndvi_std DOUBLE PRECISION,
  valid_pixel_pct DOUBLE PRECISION CHECK (valid_pixel_pct >= 0 AND valid_pixel_pct <= 100),
  provenance TEXT NOT NULL CHECK (provenance IN ('real_observation', 'historical_baseline', 'estimated_value', 'missing_data')),
  quality_flag TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, cell_id, source_id, observation_date)
);
CREATE INDEX IF NOT EXISTS idx_veg_obs_date ON public.vegetation_observations(region_id, observation_date DESC);

-- 7. Temperature Observations (NASA POWER T2M/TS & Landsat 8/9 LST)
CREATE TABLE IF NOT EXISTS public.temperature_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  cell_id TEXT REFERENCES public.geographical_cells(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES public.data_sources(id),
  observation_date DATE NOT NULL,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('T2M', 'T2M_MAX', 'T2M_MIN', 'TS', 'LANDSAT_LST')),
  temperature_c DOUBLE PRECISION CHECK (temperature_c >= -95 AND temperature_c <= 85),
  baseline_c DOUBLE PRECISION,
  anomaly_c DOUBLE PRECISION,
  provenance TEXT NOT NULL CHECK (provenance IN ('real_observation', 'historical_baseline', 'estimated_value', 'missing_data')),
  quality_flag TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, cell_id, source_id, metric_type, observation_date)
);
CREATE INDEX IF NOT EXISTS idx_temp_obs_date ON public.temperature_observations(region_id, observation_date DESC);

-- 8. Rainfall Observations (NASA POWER PRECTOTCORR & CHIRPS)
CREATE TABLE IF NOT EXISTS public.rainfall_observations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  cell_id TEXT REFERENCES public.geographical_cells(id) ON DELETE CASCADE,
  source_id TEXT NOT NULL REFERENCES public.data_sources(id),
  observation_date DATE NOT NULL,
  rainfall_mm DOUBLE PRECISION CHECK (rainfall_mm >= 0 AND rainfall_mm <= 1000),
  baseline_mm DOUBLE PRECISION,
  anomaly_pct DOUBLE PRECISION,
  provenance TEXT NOT NULL CHECK (provenance IN ('real_observation', 'historical_baseline', 'estimated_value', 'missing_data')),
  quality_flag TEXT NOT NULL DEFAULT 'valid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (region_id, cell_id, source_id, observation_date)
);
CREATE INDEX IF NOT EXISTS idx_rain_obs_date ON public.rainfall_observations(region_id, observation_date DESC);

-- 9. Analysis Runs (Audit Trail for Deterministic Scoring)
CREATE TABLE IF NOT EXISTS public.analysis_runs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'failed')),
  window_start DATE NOT NULL,
  window_end DATE NOT NULL,
  threshold_snapshot JSONB NOT NULL,
  summary_metrics JSONB,
  error_message TEXT
);

-- 10. Environmental Anomalies
CREATE TABLE IF NOT EXISTS public.environmental_anomalies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE CASCADE,
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  cell_id TEXT REFERENCES public.geographical_cells(id) ON DELETE SET NULL,
  detection_date DATE NOT NULL,
  indicator TEXT NOT NULL,
  observed_value DOUBLE PRECISION,
  baseline_value DOUBLE PRECISION,
  deviation_value DOUBLE PRECISION,
  normalized_score DOUBLE PRECISION CHECK (normalized_score >= 0 AND normalized_score <= 100),
  confidence_pct DOUBLE PRECISION CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  supporting_sources TEXT[] NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. Environmental Alerts
CREATE TABLE IF NOT EXISTS public.environmental_alerts (
  id TEXT PRIMARY KEY,
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  analysis_run_id UUID REFERENCES public.analysis_runs(id) ON DELETE SET NULL,
  detection_date DATE NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('Normal', 'Watch', 'Elevated', 'High')),
  pattern_name TEXT NOT NULL,
  explanation TEXT NOT NULL,
  confidence_pct DOUBLE PRECISION NOT NULL CHECK (confidence_pct >= 0 AND confidence_pct <= 100),
  missing_indicators TEXT[] NOT NULL DEFAULT '{}',
  verification_steps TEXT[] NOT NULL DEFAULT '{}',
  supporting_sources TEXT[] NOT NULL DEFAULT '{}',
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_alerts_region_date ON public.environmental_alerts(region_id, detection_date DESC);

-- 12. Generated Reports
CREATE TABLE IF NOT EXISTS public.generated_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  region_id TEXT NOT NULL REFERENCES public.regions(id) ON DELETE CASCADE,
  generated_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  format TEXT NOT NULL CHECK (format IN ('csv', 'pdf', 'json')),
  included_sources TEXT[] NOT NULL,
  ai_narrative_included BOOLEAN NOT NULL DEFAULT FALSE,
  report_payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- Row Level Security (RLS) Baseline Templates for Supabase
-- =============================================================================
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.environmental_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_reports ENABLE ROW LEVEL SECURITY;

-- Example Policy: Authenticated users can read regions; only creators/admins mutate custom regions
CREATE POLICY "regions_read_all" ON public.regions
  FOR SELECT USING (true);

CREATE POLICY "regions_insert_authenticated" ON public.regions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
