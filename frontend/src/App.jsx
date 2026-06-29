import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import AppLayout from './components/layout/AppLayout';
import DashboardPage from './pages/DashboardPage';
import TopologyPage from './pages/TopologyPage';
import NodesPage from './pages/NodesPage';
import TelemetryPage from './pages/TelemetryPage';
import FailoverPage from './pages/FailoverPage';
import SecurityPage from './pages/SecurityPage';
import EventsPage from './pages/EventsPage';
import SettingsPage from './pages/SettingsPage';
import DeviceManagementPage from './pages/DeviceManagementPage';

// New Pages
import TerminalPage from './pages/TerminalPage';
import PredictionsPage from './pages/PredictionsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import FirmwarePage from './pages/FirmwarePage';
import PowerPage from './pages/PowerPage';
import PlaybooksPage from './pages/PlaybooksPage';
import ZoneMapPage from './pages/ZoneMapPage';
import ReplayPage from './pages/ReplayPage';
import EdgeComputingPage from './pages/EdgeComputingPage';
import LoginPage from './pages/LoginPage';

import { useSocket } from './hooks/useSocket';

// Eagerly initialize alert sounds so AudioContext unlock listeners
// are installed before any node events fire (login click unlocks audio)
import './lib/alertSounds';

function AppContent() {
  const [auth, setAuth] = useState(!!localStorage.getItem('aegismesh_auth'));

  // Initialize socket connection and store bindings
  useSocket();

  if (!auth) {
    return (
      <Routes>
        <Route path="/login" element={<LoginPage onLogin={() => setAuth(true)} />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/topology" element={<TopologyPage />} />
        <Route path="/nodes" element={<NodesPage />} />
        <Route path="/telemetry" element={<TelemetryPage />} />
        <Route path="/failover" element={<FailoverPage />} />
        <Route path="/security" element={<SecurityPage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/settings" element={<SettingsPage onLogout={() => setAuth(false)} />} />
        <Route path="/devices" element={<DeviceManagementPage />} />
        
        {/* New Feature Routes */}
        <Route path="/terminal" element={<TerminalPage />} />
        <Route path="/predictions" element={<PredictionsPage />} />
        <Route path="/analytics" element={<AnalyticsPage />} />
        <Route path="/firmware" element={<FirmwarePage />} />
        <Route path="/power" element={<PowerPage />} />
        <Route path="/playbooks" element={<PlaybooksPage />} />
        <Route path="/zones" element={<ZoneMapPage />} />
        <Route path="/replay" element={<ReplayPage />} />
        <Route path="/edge" element={<EdgeComputingPage />} />
        
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}
