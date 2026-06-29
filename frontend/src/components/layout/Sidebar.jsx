import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard, Network, Monitor, Activity, GitBranch,
  Shield, FileText, Settings, ChevronLeft, ChevronRight, Wifi, Radio, Router,
  Brain, Terminal, Cpu, BarChart3, Map, Zap, Bot, Video, Server
} from 'lucide-react';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';

const navSections = [
  {
    label: 'CORE',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', exact: true },
      { to: '/topology', icon: Network, label: 'Network Topology' },
      { to: '/devices', icon: Router, label: 'Device Management' },
      { to: '/nodes', icon: Monitor, label: 'Node Monitoring' },
      { to: '/telemetry', icon: Activity, label: 'Telemetry' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { to: '/failover', icon: GitBranch, label: 'Failover Analytics' },
      { to: '/security', icon: Shield, label: 'Security Events' },
      { to: '/events', icon: FileText, label: 'Event Logs' },
      { to: '/predictions', icon: Brain, label: 'Predictive AI' },
      { to: '/terminal', icon: Terminal, label: 'Mesh Shell CLI' },
    ],
  },
  {
    label: 'ADVANCED',
    items: [
      { to: '/firmware', icon: Cpu, label: 'Firmware OTA' },
      { to: '/edge', icon: Server, label: 'Edge Computing' },
      { to: '/analytics', icon: BarChart3, label: 'Historical Reports' },
      { to: '/zones', icon: Map, label: 'Zone Floor Map' },
      { to: '/power', icon: Zap, label: 'Energy Monitors' },
      { to: '/playbooks', icon: Bot, label: 'Incident Playbooks' },
      { to: '/replay', icon: Video, label: 'Network DVR Replay' },
    ],
  },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { connected, stats, nodes } = useMeshStore();
  const { theme } = useTheme();
  const location = useLocation();
  const isDark = theme === 'dark';

  const failedCount = nodes.filter(n => n.status === 'failed').length;
  const healthPercent = stats.networkHealth || 100;

  return (
    <motion.aside
      animate={{ width: collapsed ? 70 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      style={{
        background: 'var(--sidebar-bg)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRight: '1px solid var(--border-dim)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        zIndex: 30,
        flexShrink: 0,
        overflow: 'hidden',
        boxShadow: 'var(--sidebar-shadow)',
        transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
      }}
    >
      {/* Logo Area */}
      <div style={{
        padding: '18px 14px',
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        minHeight: 64,
      }}>
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <div style={{
            width: 38,
            height: 38,
            borderRadius: 10,
            background: isDark
              ? 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(139,92,246,0.08))'
              : 'linear-gradient(135deg, rgba(8,145,178,0.1), rgba(124,58,237,0.06))',
            border: `1px solid ${isDark ? 'rgba(0,212,255,0.25)' : 'rgba(8,145,178,0.2)'}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: isDark
              ? '0 0 20px rgba(0,212,255,0.12), inset 0 0 12px rgba(0,212,255,0.04)'
              : '0 2px 8px rgba(0,0,0,0.06)',
          }}>
            <Radio size={18} color="var(--accent)" />
          </div>
          <span style={{
            position: 'absolute', top: -2, right: -2,
            width: 9, height: 9, borderRadius: '50%',
            background: connected ? '#22d3ee' : '#f43f5e',
            boxShadow: connected ? '0 0 10px #22d3ee, 0 0 4px #22d3ee' : '0 0 10px #f43f5e',
            border: `2px solid ${isDark ? 'rgba(7, 14, 30, 0.9)' : 'rgba(255, 255, 255, 0.9)'}`,
          }} />
        </div>

        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div style={{
                fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700,
                color: 'var(--text-heading)',
                textShadow: isDark ? '0 0 15px rgba(0,212,255,0.4)' : 'none',
                letterSpacing: '0.06em',
              }}>AEGIS<span style={{ color: 'var(--accent-secondary)' }}>MESH</span></div>
              <div style={{
                fontSize: 9, color: 'var(--text-muted)',
                fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.15em',
              }}>
                NOC PLATFORM v2.0
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Network Health Mini */}
      {!collapsed && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{
            margin: '12px 12px 4px', padding: '12px 14px',
            borderRadius: 10,
            background: isDark ? 'rgba(0,212,255,0.03)' : 'rgba(8,145,178,0.04)',
            border: '1px solid var(--border-dim)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.1em' }}>MESH HEALTH</span>
            <span style={{
              fontSize: 11, fontFamily: 'Orbitron, monospace', fontWeight: 600,
              color: healthPercent > 60 ? 'var(--cyan-bright)' : 'var(--red)',
            }}>
              {healthPercent}%
            </span>
          </div>
          <div style={{ height: 3, background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.05)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${healthPercent}%`,
              background: healthPercent > 60
                ? 'linear-gradient(90deg, #0891b2, #00d4ff, #67e8f9)'
                : 'linear-gradient(90deg, #e11d48, #f43f5e)',
              borderRadius: 3,
              transition: 'width 1s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isDark
                ? `0 0 8px ${healthPercent > 60 ? 'rgba(0,212,255,0.4)' : 'rgba(244,63,94,0.4)'}`
                : 'none',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <Wifi size={10} color="var(--cyan-bright)" />
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontFamily: 'Share Tech Mono, monospace' }}>
                {(stats.activeNodes || 5) - failedCount} ONLINE
              </span>
            </div>
            {failedCount > 0 && (
              <span style={{ fontSize: 10, color: 'var(--red)', fontFamily: 'Share Tech Mono, monospace' }}>
                {failedCount} FAILED
              </span>
            )}
          </div>
        </motion.div>
      )}

      {/* Nav Sections */}
      <nav style={{ flex: 1, padding: '8px 0', overflowY: 'auto', overflowX: 'hidden' }}>
        {navSections.map((section, sIdx) => (
          <div key={section.label}>
            {!collapsed && (
              <div style={{
                padding: '12px 20px 6px', fontSize: 9,
                fontFamily: 'Orbitron, monospace', fontWeight: 600,
                color: 'var(--text-muted)', letterSpacing: '0.15em',
              }}>
                {section.label}
              </div>
            )}
            {sIdx > 0 && collapsed && (
              <div style={{ margin: '8px 16px', height: 1, background: 'var(--border-dim)' }} />
            )}

            {section.items.map(({ to, icon: Icon, label }) => {
              const isActive = to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);
              return (
                <NavLink
                  key={to}
                  to={to}
                  className="sidebar-item"
                  style={() => ({
                    background: isActive
                      ? (isDark ? 'rgba(0,212,255,0.07)' : 'rgba(8,145,178,0.07)')
                      : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-dim)',
                    borderColor: isActive
                      ? (isDark ? 'rgba(0,212,255,0.15)' : 'rgba(8,145,178,0.15)')
                      : 'transparent',
                  })}
                >
                  <Icon size={18} style={{
                    flexShrink: 0,
                    filter: isActive && isDark ? 'drop-shadow(0 0 6px rgba(0,212,255,0.5))' : 'none',
                  }} />
                  <AnimatePresence>
                    {!collapsed && (
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        style={{ fontSize: 13, fontWeight: 500 }}
                      >
                        {label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              );
            })}
          </div>
        ))}

        {/* Settings */}
        <div style={{ margin: '4px 0' }}>
          {!collapsed && (
            <div style={{ margin: '4px 16px', height: 1, background: 'var(--border-dim)' }} />
          )}
          <NavLink
            to="/settings"
            className="sidebar-item"
            style={() => ({
              background: location.pathname === '/settings'
                ? (isDark ? 'rgba(0,212,255,0.07)' : 'rgba(8,145,178,0.07)')
                : 'transparent',
              color: location.pathname === '/settings' ? 'var(--accent)' : 'var(--text-dim)',
              borderColor: location.pathname === '/settings'
                ? (isDark ? 'rgba(0,212,255,0.15)' : 'rgba(8,145,178,0.15)')
                : 'transparent',
            })}
          >
            <Settings size={18} style={{ flexShrink: 0 }} />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ fontSize: 13, fontWeight: 500 }}
                >
                  Settings
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        </div>
      </nav>

      {/* Collapse Toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          margin: '8px 12px 14px', padding: '9px', borderRadius: 8,
          border: '1px solid var(--border-dim)',
          background: isDark ? 'rgba(0,212,255,0.03)' : 'rgba(8,145,178,0.04)',
          cursor: 'pointer', color: 'var(--text-muted)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.25s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = isDark ? 'rgba(0,212,255,0.08)' : 'rgba(8,145,178,0.1)';
          e.currentTarget.style.color = 'var(--accent)';
          e.currentTarget.style.borderColor = isDark ? 'rgba(0,212,255,0.2)' : 'rgba(8,145,178,0.2)';
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isDark ? 'rgba(0,212,255,0.03)' : 'rgba(8,145,178,0.04)';
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.borderColor = '';
        }}
      >
        {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
      </button>
    </motion.aside>
  );
}
