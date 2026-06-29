import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Wifi, WifiOff, Activity, Clock, AlertTriangle, Radio, Zap, Sun, Moon } from 'lucide-react';
import useMeshStore from '../../store/meshStore';
import { getSocket } from '../../lib/socket';
import { useTheme } from '../../lib/ThemeContext';

const MODE_CONFIG = {
  SIMULATION: { color: '#00d4ff', label: 'SIMULATION', className: 'mode-badge-sim' },
  HYBRID:     { color: '#fbbf24', label: 'HYBRID',     className: 'mode-badge-hybrid' },
  LIVE:       { color: '#22d3ee', label: 'LIVE MODE',   className: 'mode-badge-live' },
};

function formatUptime(seconds) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function Header({ title }) {
  const { connected, alerts, stats, nodes, threatLevel, failoverActive, operatingMode, systemUptime, mqttStatus, demoActive, demoStep, activeMeshId } = useMeshStore();
  const { theme, toggleTheme } = useTheme();
  const [time, setTime] = useState(new Date());
  const [glitch, setGlitch] = useState(false);
  const [heartbeat, setHeartbeat] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    const g = setInterval(() => { setGlitch(true); setTimeout(() => setGlitch(false), 300); }, 10000);
    const h = setInterval(() => { setHeartbeat(true); setTimeout(() => setHeartbeat(false), 400); }, 3000);
    return () => { clearInterval(t); clearInterval(g); clearInterval(h); };
  }, []);

  const criticalAlerts = alerts.filter(a => !a.acknowledged && a.severity === 'CRITICAL').length;
  const failedNodes    = nodes.filter(n => n.status === 'failed').length;
  const modeConfig     = MODE_CONFIG[operatingMode] || MODE_CONFIG.SIMULATION;
  const isAlert = failoverActive || threatLevel > 70;
  const isDark = theme === 'dark';

  return (
    <header style={{
      height: 64,
      background: isAlert ? 'var(--header-bg-alert)' : 'var(--header-bg)',
      backdropFilter: 'blur(24px) saturate(1.2)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.2)',
      borderBottom: `1px solid ${isAlert ? 'rgba(244,63,94,0.12)' : 'var(--border-dim)'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 22px', position: 'relative', zIndex: 20, flexShrink: 0,
      transition: 'all 0.35s ease',
      boxShadow: isDark ? '0 4px 28px rgba(0,0,0,0.35)' : '0 2px 12px rgba(0,0,0,0.06)',
    }}>
      {/* Ambient glow strip */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 1,
        background: isAlert
          ? 'linear-gradient(90deg, transparent, rgba(244,63,94,0.25) 50%, transparent)'
          : isDark
            ? 'linear-gradient(90deg, transparent 5%, rgba(0,212,255,0.12) 25%, rgba(139,92,246,0.08) 75%, transparent 95%)'
            : 'linear-gradient(90deg, transparent 5%, rgba(8,145,178,0.12) 25%, rgba(124,58,237,0.08) 75%, transparent 95%)',
      }} />

      {/* Left: Page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          fontFamily: 'Orbitron, monospace', fontSize: 15, fontWeight: 700,
          color: 'var(--text-heading)',
          textShadow: glitch
            ? '2px 0 #f43f5e, -2px 0 #22d3ee'
            : isDark ? '0 0 12px rgba(0,212,255,0.4)' : 'none',
          letterSpacing: '0.06em', transition: 'text-shadow 0.1s',
        }}>
          {title || 'AEGISMESH NOC'}
        </div>
        <div style={{ width: 1, height: 22, background: 'var(--border-dim)' }} />

        <select
          value={activeMeshId || 'mesh-hq'}
          onChange={(e) => {
            const socket = getSocket();
            if (socket) socket.emit('mesh:switch', { meshId: e.target.value });
          }}
          style={{
            background: 'var(--select-bg)',
            color: 'var(--accent)', border: '1px solid var(--border-dim)',
            borderRadius: 6, padding: '3px 10px', fontSize: 11,
            fontFamily: 'Share Tech Mono, monospace', cursor: 'pointer',
            outline: 'none', textTransform: 'uppercase',
            boxShadow: isDark ? '0 0 8px rgba(0,212,255,0.08)' : '0 1px 4px rgba(0,0,0,0.04)',
            transition: 'all 0.2s',
          }}
          onFocus={(e) => { e.target.style.borderColor = 'var(--accent)'; }}
          onBlur={(e) => { e.target.style.borderColor = ''; }}
        >
          <option value="mesh-hq" style={{ background: 'var(--select-option-bg)' }}>Mesh HQ (Bldg A)</option>
          <option value="mesh-warehouse" style={{ background: 'var(--select-option-bg)' }}>Mesh Warehouse (Bldg B)</option>
        </select>

        <div style={{ width: 1, height: 22, background: 'var(--border-dim)' }} />
        <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)', letterSpacing: '0.1em' }}>
          SELF-HEALING IoT MESH v2.0
        </span>
      </div>

      {/* Center: System indicators */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <motion.div
          animate={{ scale: heartbeat ? [1, 1.3, 1] : 1, opacity: heartbeat ? [0.4, 1, 0.4] : 0.4 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', alignItems: 'center', gap: 5 }}
        >
          <Zap size={11} color="var(--text-muted)" />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>HB</span>
        </motion.div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Activity size={12} color="var(--text-muted)" />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--text-dim)' }}>
            {(stats.packetThroughput || 3200).toLocaleString()} pkt/s
          </span>
        </div>

        <span style={{
          fontFamily: 'Share Tech Mono, monospace', fontSize: 11,
          color: (stats.avgLatency || 12) > 100 ? 'var(--red)' : 'var(--text-dim)',
        }}>
          AVG {(stats.avgLatency || 12).toFixed(1)}ms
        </span>

        <AnimatePresence>
          {failedNodes > 0 && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: [1, 0.4, 1] }}
              exit={{ opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ display: 'flex', alignItems: 'center', gap: 5 }}
            >
              <AlertTriangle size={12} color="var(--red)" />
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--red)' }}>
                {failedNodes} NODE{failedNodes > 1 ? 'S' : ''} OFFLINE
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {demoActive && demoStep && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 12,
                background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)',
              }}
            >
              <motion.span
                animate={{ opacity: [1, 0.3, 1] }} transition={{ repeat: Infinity, duration: 1 }}
                style={{ width: 6, height: 6, borderRadius: '50%', background: '#a78bfa', display: 'block' }}
              />
              <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 8, color: '#a78bfa', letterSpacing: '0.08em' }}>
                DEMO {demoStep.step + 1}/{demoStep.totalSteps}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Status items */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {/* Theme Toggle */}
        <motion.button
          onClick={toggleTheme}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
          aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 10,
            background: isDark ? 'rgba(251,191,36,0.06)' : 'rgba(99,102,241,0.06)',
            border: `1px solid ${isDark ? 'rgba(251,191,36,0.2)' : 'rgba(99,102,241,0.2)'}`,
            cursor: 'pointer', padding: 0,
            transition: 'all 0.25s ease',
          }}
        >
          <motion.div
            key={theme}
            initial={{ rotate: -30, opacity: 0, scale: 0.5 }}
            animate={{ rotate: 0, opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          >
            {isDark
              ? <Sun size={16} color="#fbbf24" />
              : <Moon size={16} color="#6366f1" />
            }
          </motion.div>
        </motion.button>

        <motion.div
          key={operatingMode}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className={modeConfig.className}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 20,
            background: `${modeConfig.color}0C`,
            border: `1px solid ${modeConfig.color}30`,
          }}
        >
          <Radio size={10} color={modeConfig.color} />
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 8, color: modeConfig.color, letterSpacing: '0.1em', fontWeight: 600 }}>
            {modeConfig.label}
          </span>
        </motion.div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: mqttStatus.brokerOnline ? 'rgba(34,211,238,0.05)' : 'rgba(244,63,94,0.04)',
          border: `1px solid ${mqttStatus.brokerOnline ? 'rgba(34,211,238,0.15)' : 'rgba(244,63,94,0.15)'}`,
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: mqttStatus.brokerOnline ? '#22d3ee' : '#f43f5e',
            boxShadow: `0 0 8px ${mqttStatus.brokerOnline ? 'rgba(34,211,238,0.5)' : 'rgba(244,63,94,0.5)'}`,
            display: 'block',
            animation: mqttStatus.brokerOnline ? 'breathe 3s ease-in-out infinite' : 'none',
          }} />
          <span style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
            color: mqttStatus.brokerOnline ? '#22d3ee' : '#f43f5e', letterSpacing: '0.08em',
          }}>
            MQTT
          </span>
          {mqttStatus.connectedNodes > 0 && (
            <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: 'rgba(34,211,238,0.4)' }}>
              ({mqttStatus.connectedNodes})
            </span>
          )}
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '5px 12px', borderRadius: 20,
          background: connected ? 'rgba(0,212,255,0.05)' : 'rgba(244,63,94,0.04)',
          border: `1px solid ${connected ? 'rgba(0,212,255,0.15)' : 'rgba(244,63,94,0.15)'}`,
        }}>
          {connected ? <Wifi size={11} color="var(--accent)" /> : <WifiOff size={11} color="var(--red)" />}
          <span style={{
            fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
            color: connected ? 'var(--accent)' : 'var(--red)', letterSpacing: '0.08em',
          }}>
            {connected ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>

        <div style={{ position: 'relative' }}>
          <Bell size={16} color={criticalAlerts > 0 ? 'var(--red)' : 'var(--text-muted)'} />
          {criticalAlerts > 0 && (
            <motion.span
              animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1 }}
              style={{
                position: 'absolute', top: -5, right: -5, width: 15, height: 15, borderRadius: '50%',
                background: '#f43f5e', color: '#fff', fontSize: 8,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700,
                boxShadow: '0 0 10px rgba(244,63,94,0.4)',
              }}
            >
              {criticalAlerts}
            </motion.span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.05em' }}>UP</span>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-dim)' }}>
            {formatUptime(systemUptime)}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Clock size={11} color="var(--text-muted)" />
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: 'var(--text-dim)', letterSpacing: '0.05em' }}>
            {time.toLocaleTimeString('en-US', { hour12: false })}
          </span>
        </div>
      </div>
    </header>
  );
}
