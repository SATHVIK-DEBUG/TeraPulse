import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { DEFAULT_THRESHOLDS } from '../shared/algorithms';
import type {
  NavSection,
  Region,
  RegionComparisonItem,
  RegionalTelemetryResponse,
  ThresholdConfig,
} from '../shared/types';
import { api } from '../services/api';

interface TerraPulseContextValue {
  activeSection: NavSection;
  setActiveSection: (section: NavSection) => void;

  regions: Region[];
  activeRegionId: string;
  activeRegion: Region | undefined;
  setActiveRegionId: (id: string) => void;

  daysWindow: number;
  setDaysWindow: (days: number) => void;

  telemetry: RegionalTelemetryResponse | null;
  telemetryLoading: boolean;
  telemetryError: string | null;

  comparison: RegionComparisonItem[];
  comparisonLoading: boolean;

  thresholds: ThresholdConfig;
  saveThresholds: (patch: Partial<ThresholdConfig>) => Promise<void>;

  refreshLiveTelemetry: (force?: boolean) => Promise<void>;
  registerCustomRegion: (payload: Parameters<typeof api.createRegion>[0]) => Promise<Region>;
  removeCustomRegion: (id: string) => Promise<void>;
}

const TerraPulseContext = createContext<TerraPulseContextValue | null>(null);

export function TerraPulseProvider({ children }: { children: React.ReactNode }) {
  const [activeSection, setActiveSection] = useState<NavSection>('overview');
  const [regions, setRegions] = useState<Region[]>([]);
  const [activeRegionId, setActiveRegionId] = useState<string>('puttur-ap');
  const [daysWindow, setDaysWindow] = useState<number>(90);

  const [telemetry, setTelemetry] = useState<RegionalTelemetryResponse | null>(null);
  const [telemetryLoading, setTelemetryLoading] = useState<boolean>(true);
  const [telemetryError, setTelemetryError] = useState<string | null>(null);

  const [comparison, setComparison] = useState<RegionComparisonItem[]>([]);
  const [comparisonLoading, setComparisonLoading] = useState<boolean>(false);

  const [thresholds, setThresholds] = useState<ThresholdConfig>(DEFAULT_THRESHOLDS);

  // Initial bootstrap: load regions & configured thresholds
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [regRes, thrRes] = await Promise.all([api.getRegions(), api.getThresholds()]);
        if (!active) return;
        setRegions(regRes.regions);
        setThresholds(thrRes.thresholds);
      } catch (err) {
        console.error('[TerraPulse] Initial metadata load failed:', err);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const loadTelemetry = useCallback(
    async (regionId: string, days: number, forceRefresh = false) => {
      setTelemetryLoading(true);
      setTelemetryError(null);
      try {
        const data = await api.getSummary(regionId, days, forceRefresh);
        setTelemetry(data);
      } catch (err: any) {
        setTelemetryError(err?.message ?? 'Failed to fetch live NASA POWER telemetry.');
      } finally {
        setTelemetryLoading(false);
      }
    },
    []
  );

  const loadComparison = useCallback(async (days: number) => {
    setComparisonLoading(true);
    try {
      const data = await api.getComparison(days);
      setComparison(data.regions);
    } catch (err) {
      console.error('[TerraPulse] Regional comparison failed:', err);
    } finally {
      setComparisonLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTelemetry(activeRegionId, daysWindow, false);
  }, [activeRegionId, daysWindow, loadTelemetry]);

  useEffect(() => {
    loadComparison(daysWindow);
  }, [daysWindow, regions.length, loadComparison]);

  const refreshLiveTelemetry = useCallback(
    async (force = true) => {
      await Promise.all([
        loadTelemetry(activeRegionId, daysWindow, force),
        loadComparison(daysWindow),
      ]);
    },
    [activeRegionId, daysWindow, loadTelemetry, loadComparison]
  );

  const saveThresholds = useCallback(
    async (patch: Partial<ThresholdConfig>) => {
      const { thresholds: updated } = await api.updateThresholds(patch);
      setThresholds(updated);
      // Re-evaluate risk immediately with updated thresholds
      await loadTelemetry(activeRegionId, daysWindow, false);
      await loadComparison(daysWindow);
    },
    [activeRegionId, daysWindow, loadTelemetry, loadComparison]
  );

  const registerCustomRegion = useCallback(
    async (payload: Parameters<typeof api.createRegion>[0]) => {
      const { region } = await api.createRegion(payload);
      setRegions((prev) => [...prev, region]);
      setActiveRegionId(region.id);
      return region;
    },
    []
  );

  const removeCustomRegion = useCallback(
    async (id: string) => {
      await api.deleteRegion(id);
      setRegions((prev) => prev.filter((r) => r.id !== id));
      if (activeRegionId === id) {
        setActiveRegionId('puttur-ap');
      }
    },
    [activeRegionId]
  );

  const activeRegion = regions.find((r) => r.id === activeRegionId) ?? telemetry?.region;

  return (
    <TerraPulseContext.Provider
      value={{
        activeSection,
        setActiveSection,
        regions,
        activeRegionId,
        activeRegion,
        setActiveRegionId,
        daysWindow,
        setDaysWindow,
        telemetry,
        telemetryLoading,
        telemetryError,
        comparison,
        comparisonLoading,
        thresholds,
        saveThresholds,
        refreshLiveTelemetry,
        registerCustomRegion,
        removeCustomRegion,
      }}
    >
      {children}
    </TerraPulseContext.Provider>
  );
}

export function useTerraPulse(): TerraPulseContextValue {
  const ctx = useContext(TerraPulseContext);
  if (!ctx) {
    throw new Error('useTerraPulse must be used within TerraPulseProvider');
  }
  return ctx;
}
