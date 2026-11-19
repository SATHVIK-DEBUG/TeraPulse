import fs from 'fs';
import path from 'path';
import { DEFAULT_THRESHOLDS } from '../../shared/algorithms.ts';
import { createInitialPilotRegions } from '../../shared/regions.ts';
import type {
  ClimatologyMonthlyBaseline,
  NasaPowerDailyRecord,
  Region,
  SourceMetadata,
  ThresholdConfig,
} from '../../shared/types.ts';

export interface CachedDailyBundle {
  key: string;
  fetchedAt: string;
  expiresAt: number;
  source: SourceMetadata;
  records: NasaPowerDailyRecord[];
}

export interface CachedClimatologyBundle {
  key: string;
  fetchedAt: string;
  expiresAt: number;
  climatology: ClimatologyMonthlyBaseline;
}

/**
 * Modular repository contract designed so the active FileBackedCacheRepository
 * can be swapped for a Supabase PostgreSQL/PostGIS implementation without
 * modifying routes, connectors, or frontend code.
 */
export interface EnvironmentalRepository {
  getRegions(): Region[];
  getRegionById(id: string): Region | undefined;
  addCustomRegion(region: Region): Region;
  deleteCustomRegion(id: string): boolean;

  getThresholds(): ThresholdConfig;
  updateThresholds(next: Partial<ThresholdConfig>): ThresholdConfig;

  getCachedDaily(key: string): CachedDailyBundle | null;
  setCachedDaily(bundle: CachedDailyBundle): void;

  getCachedClimatology(key: string): CachedClimatologyBundle | null;
  setCachedClimatology(bundle: CachedClimatologyBundle): void;

  clearObservationCache(): number;
  getCacheStats(): { dailyEntries: number; climatologyEntries: number; totalEntries: number };
}

interface PersistedStoreShape {
  customRegions: Region[];
  thresholds: ThresholdConfig;
  dailyCache: Record<string, CachedDailyBundle>;
  climatologyCache: Record<string, CachedClimatologyBundle>;
}

const CACHE_DIR = path.resolve(process.cwd(), '.terrapulse-cache');
const STORE_FILE = path.join(CACHE_DIR, 'store.json');

export class FileBackedCacheRepository implements EnvironmentalRepository {
  private pilotRegions: Region[];
  private customRegions: Region[] = [];
  private thresholds: ThresholdConfig = { ...DEFAULT_THRESHOLDS };
  private dailyCache = new Map<string, CachedDailyBundle>();
  private climatologyCache = new Map<string, CachedClimatologyBundle>();

  constructor() {
    this.pilotRegions = createInitialPilotRegions();
    this.loadFromDisk();
  }

  private loadFromDisk(): void {
    try {
      if (!fs.existsSync(STORE_FILE)) return;
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedStoreShape>;
      if (Array.isArray(parsed.customRegions)) {
        this.customRegions = parsed.customRegions;
      }
      if (parsed.thresholds) {
        this.thresholds = { ...DEFAULT_THRESHOLDS, ...parsed.thresholds };
      }
      const now = Date.now();
      if (parsed.dailyCache) {
        for (const [k, v] of Object.entries(parsed.dailyCache)) {
          if (v && v.expiresAt > now) {
            this.dailyCache.set(k, v);
          }
        }
      }
      if (parsed.climatologyCache) {
        for (const [k, v] of Object.entries(parsed.climatologyCache)) {
          if (v && v.expiresAt > now) {
            this.climatologyCache.set(k, v);
          }
        }
      }
    } catch (err) {
      console.warn('[TerraPulse Repository] Could not load cache store, starting fresh:', err);
    }
  }

  private persistToDisk(): void {
    try {
      if (!fs.existsSync(CACHE_DIR)) {
        fs.mkdirSync(CACHE_DIR, { recursive: true });
      }
      const payload: PersistedStoreShape = {
        customRegions: this.customRegions,
        thresholds: this.thresholds,
        dailyCache: Object.fromEntries(this.dailyCache.entries()),
        climatologyCache: Object.fromEntries(this.climatologyCache.entries()),
      };
      fs.writeFileSync(STORE_FILE, JSON.stringify(payload, null, 2), 'utf-8');
    } catch (err) {
      console.warn('[TerraPulse Repository] Failed to persist cache store:', err);
    }
  }

  getRegions(): Region[] {
    return [...this.pilotRegions, ...this.customRegions];
  }

  getRegionById(id: string): Region | undefined {
    return this.getRegions().find((r) => r.id === id);
  }

  addCustomRegion(region: Region): Region {
    this.customRegions = [
      ...this.customRegions.filter((r) => r.id !== region.id),
      region,
    ];
    this.persistToDisk();
    return region;
  }

  deleteCustomRegion(id: string): boolean {
    const before = this.customRegions.length;
    this.customRegions = this.customRegions.filter((r) => r.id !== id);
    if (this.customRegions.length !== before) {
      this.persistToDisk();
      return true;
    }
    return false;
  }

  getThresholds(): ThresholdConfig {
    return { ...this.thresholds };
  }

  updateThresholds(next: Partial<ThresholdConfig>): ThresholdConfig {
    this.thresholds = {
      ...this.thresholds,
      ...next,
    };
    this.persistToDisk();
    return { ...this.thresholds };
  }

  getCachedDaily(key: string): CachedDailyBundle | null {
    const entry = this.dailyCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.dailyCache.delete(key);
      return null;
    }
    return entry;
  }

  setCachedDaily(bundle: CachedDailyBundle): void {
    // Cap cache size to 120 entries to prevent unbounded growth
    if (this.dailyCache.size >= 120) {
      const oldestKey = this.dailyCache.keys().next().value;
      if (oldestKey) this.dailyCache.delete(oldestKey);
    }
    this.dailyCache.set(bundle.key, bundle);
    this.persistToDisk();
  }

  getCachedClimatology(key: string): CachedClimatologyBundle | null {
    const entry = this.climatologyCache.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      this.climatologyCache.delete(key);
      return null;
    }
    return entry;
  }

  setCachedClimatology(bundle: CachedClimatologyBundle): void {
    if (this.climatologyCache.size >= 80) {
      const oldestKey = this.climatologyCache.keys().next().value;
      if (oldestKey) this.climatologyCache.delete(oldestKey);
    }
    this.climatologyCache.set(bundle.key, bundle);
    this.persistToDisk();
  }

  clearObservationCache(): number {
    const count = this.dailyCache.size + this.climatologyCache.size;
    this.dailyCache.clear();
    this.climatologyCache.clear();
    this.persistToDisk();
    return count;
  }

  getCacheStats() {
    return {
      dailyEntries: this.dailyCache.size,
      climatologyEntries: this.climatologyCache.size,
      totalEntries: this.dailyCache.size + this.climatologyCache.size,
    };
  }
}

export const repository: EnvironmentalRepository = new FileBackedCacheRepository();
