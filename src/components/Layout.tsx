import {
  Activity,
  AlertTriangle,
  CloudRain,
  Database,
  FileText,
  Globe2,
  History,
  LayoutDashboard,
  Leaf,
  Map as MapIcon,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  Settings,
  Thermometer,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import { useTerraPulse } from '../context/TerraPulseContext';
import type { NavSection } from '../shared/types';

interface NavItem {
  id: NavSection;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  stageTag?: string;
}

const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'map', label: 'Live Environmental Map', icon: MapIcon },
  { id: 'vegetation', label: 'Vegetation Intelligence', icon: Leaf, stageTag: 'Stage 3' },
  { id: 'temperature', label: 'Temperature Intelligence', icon: Thermometer },
  { id: 'rainfall', label: 'Rainfall Intelligence', icon: CloudRain },
  { id: 'risk', label: 'Risk Detection', icon: AlertTriangle },
  { id: 'historical', label: 'Historical Analysis', icon: History },
  { id: 'reports', label: 'Environmental Reports', icon: FileText },
  { id: 'sources', label: 'Data Sources', icon: Database },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const {
    activeSection,
    setActiveSection,
    regions,
    activeRegionId,
    setActiveRegionId,
    telemetryLoading,
    refreshLiveTelemetry,
  } = useTerraPulse();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const currentNav = NAV_ITEMS.find((n) => n.id === activeSection) ?? NAV_ITEMS[0];

  const handleSelectNav = (id: NavSection) => {
    setActiveSection(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-[#0B100E] text-[#ECF3F0] flex">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:flex flex-col shrink-0 bg-[#0F1613] border-r border-[#23322B] transition-all duration-200 ${
          collapsed ? 'w-[68px]' : 'w-[256px]'
        }`}
      >
        <div className="h-14 px-4 flex items-center justify-between border-b border-[#23322B]">
          {!collapsed && (
            <button
              type="button"
              onClick={() => handleSelectNav('overview')}
              className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500 rounded"
            >
              <Globe2 className="w-5 h-5 text-emerald-400 shrink-0" />
              <span className="font-semibold tracking-tight text-[#ECF3F0] text-[15px] whitespace-nowrap">
                TerraPulse
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={`p-1.5 rounded-md text-[#8FA39B] hover:text-[#ECF3F0] hover:bg-[#19241F] transition-colors ${
              collapsed ? 'mx-auto' : ''
            }`}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
          </button>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto" aria-label="Primary Navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeSection === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectNav(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 px-2.5 py-2 rounded-md text-[13.5px] transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-[#172620] text-emerald-300 font-medium'
                    : 'text-[#9BB0A8] hover:text-[#ECF3F0] hover:bg-[#141D19]'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    isActive ? 'text-emerald-400' : 'text-[#6D837A]'
                  }`}
                />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!collapsed && item.stageTag && (
                  <span className="text-[11px] font-mono text-[#647A71] shrink-0">
                    {item.stageTag}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {!collapsed && (
          <div className="px-4 py-3.5 border-t border-[#23322B]">
            <p className="text-[11.5px] text-[#8FA39B] leading-relaxed">
              Understand Earth. Detect Change. Act Early.
            </p>
            <p className="mt-1 text-[11px] font-mono text-[#647A71]">
              NASA POWER Live · Strict Provenance
            </p>
          </div>
        )}
      </aside>

      {/* Mobile Navigation Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative w-72 max-w-[82vw] bg-[#0F1613] border-r border-[#23322B] flex flex-col h-full z-10">
            <div className="h-14 px-4 flex items-center justify-between border-b border-[#23322B]">
              <div className="flex items-center gap-2.5">
                <Globe2 className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold tracking-tight text-[#ECF3F0]">TerraPulse</span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="p-2 text-[#8FA39B] hover:text-[#ECF3F0]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 py-3 px-3 space-y-1 overflow-y-auto">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeSection === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectNav(item.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${
                      isActive
                        ? 'bg-[#172620] text-emerald-300 font-medium'
                        : 'text-[#9BB0A8] hover:text-[#ECF3F0] hover:bg-[#141D19]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-emerald-400' : 'text-[#6D837A]'}`} />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </aside>
        </div>
      )}

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Clean 3-Zone Top Bar */}
        <header className="h-14 sticky top-0 z-30 bg-[#0B100E]/95 backdrop-blur-sm border-b border-[#23322B] px-4 lg:px-6 flex items-center justify-between gap-4">
          {/* Zone 1: Mobile Menu + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
              className="lg:hidden p-2 -ml-2 text-[#8FA39B] hover:text-[#ECF3F0]"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-[#647A71] whitespace-nowrap">TerraPulse</span>
              <span className="hidden sm:inline text-[#384C43]" aria-hidden="true">/</span>
              <span className="font-medium text-[#ECF3F0] truncate">{currentNav.label}</span>
            </div>
          </div>

          {/* Zone 2: Active Geographical Region Selector */}
          <div className="flex items-center gap-2 min-w-0">
            <label htmlFor="global-region-select" className="sr-only">
              Select monitored region
            </label>
            <select
              id="global-region-select"
              value={activeRegionId}
              onChange={(e) => setActiveRegionId(e.target.value)}
              className="bg-[#141D19] border border-[#23322B] text-[#ECF3F0] text-xs sm:text-[13px] rounded-md px-3 py-1.5 max-w-[200px] sm:max-w-[260px] truncate focus:outline-none focus:border-emerald-500/70 transition-colors"
            >
              {regions.map((region) => (
                <option key={region.id} value={region.id} className="bg-[#141D19] text-[#ECF3F0]">
                  {region.name} ({region.district})
                </option>
              ))}
            </select>
          </div>

          {/* Zone 3: Single Primary Action */}
          <div className="flex items-center shrink-0">
            <button
              type="button"
              onClick={() => refreshLiveTelemetry(true)}
              disabled={telemetryLoading}
              className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-[#05140E] font-medium text-xs sm:text-[13px] transition-colors whitespace-nowrap shrink-0"
            >
              {telemetryLoading ? (
                <Activity className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Sync Live Data</span>
              <span className="sm:hidden">Sync</span>
            </button>
          </div>
        </header>

        {/* Main Content Viewport */}
        <main className="flex-1 px-4 py-5 lg:px-6 lg:py-6 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
