import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import ParticleBackground from '../common/ParticleBackground';

const pageTitles = {
  '/': 'DASHBOARD OVERVIEW',
  '/topology': 'NETWORK TOPOLOGY',
  '/devices': 'DEVICE MANAGEMENT',
  '/nodes': 'NODE MONITORING',
  '/telemetry': 'TELEMETRY',
  '/failover': 'FAILOVER ANALYTICS',
  '/security': 'SECURITY EVENTS',
  '/events': 'EVENT LOGS',
  '/settings': 'SETTINGS',
};

export default function AppLayout() {
  const location = useLocation();
  const title = pageTitles[location.pathname] || 'AEGISMESH NOC';

  return (
    <div className="app-layout" style={{ background: 'var(--bg-0)', position: 'relative' }}>
      {/* Living ambient background */}
      <div className="ambient-bg" />
      <ParticleBackground />

      {/* App shell */}
      <Sidebar />
      <div className="main-content" style={{ position: 'relative', zIndex: 1 }}>
        <Header title={title} />
        <main className="page-content" style={{ position: 'relative', zIndex: 1 }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
