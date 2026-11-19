import React from 'react';
import { Layout } from './components/Layout';
import { TerraPulseProvider, useTerraPulse } from './context/TerraPulseContext';
import { DataSourcesPage } from './pages/DataSourcesPage';
import { HistoricalAnalysisPage } from './pages/HistoricalAnalysisPage';
import { LiveMapPage } from './pages/LiveMapPage';
import { OverviewPage } from './pages/OverviewPage';
import { RainfallPage } from './pages/RainfallPage';
import { ReportsPage } from './pages/ReportsPage';
import { RiskDetectionPage } from './pages/RiskDetectionPage';
import { SettingsPage } from './pages/SettingsPage';
import { TemperaturePage } from './pages/TemperaturePage';
import { VegetationPage } from './pages/VegetationPage';

function TerraPulseWorkspace() {
  const { activeSection } = useTerraPulse();

  return (
    <Layout>
      {activeSection === 'overview' && <OverviewPage />}
      {activeSection === 'map' && <LiveMapPage />}
      {activeSection === 'vegetation' && <VegetationPage />}
      {activeSection === 'temperature' && <TemperaturePage />}
      {activeSection === 'rainfall' && <RainfallPage />}
      {activeSection === 'risk' && <RiskDetectionPage />}
      {activeSection === 'historical' && <HistoricalAnalysisPage />}
      {activeSection === 'reports' && <ReportsPage />}
      {activeSection === 'sources' && <DataSourcesPage />}
      {activeSection === 'settings' && <SettingsPage />}
    </Layout>
  );
}

export default function App() {
  return (
    <TerraPulseProvider>
      <TerraPulseWorkspace />
    </TerraPulseProvider>
  );
}
