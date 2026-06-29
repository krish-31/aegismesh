import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';

const GAUGES = [
  { key: 'temperature', label: 'TEMPERATURE', unit: '°C', max: 60, warn: 35, crit: 45, color: '#ff073a' },
  { key: 'humidity', label: 'HUMIDITY', unit: '%', max: 100, warn: 70, crit: 85, color: '#00f5ff' },
  { key: 'gasLevel', label: 'GAS / SMOKE', unit: ' ppm', max: 100, warn: 30, crit: 60, color: '#ffea00' },
  { key: 'networkLoad', label: 'NET LOAD', unit: '%', max: 100, warn: 60, crit: 80, color: '#bf5af2' },
];

function RadialGauge({ value, max, label, unit, color, warn, crit }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const pct = Math.min(1, (value || 0) / max);
  const R = 42;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - pct * 0.75); // 270 degree arc

  const resolvedColor = color === '#ff073a' ? (isDark ? '#ff073a' : '#e11d48')
                      : color === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                      : color === '#ffea00' ? (isDark ? '#ffea00' : '#d97706')
                      : color === '#bf5af2' ? (isDark ? '#bf5af2' : '#7c3aed')
                      : color;

  const gaugeColor = value >= crit ? (isDark ? '#ff073a' : '#e11d48') : value >= warn ? (isDark ? '#ffea00' : '#d97706') : resolvedColor;

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 100, height: 100, margin: '0 auto' }}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{ transform: 'rotate(135deg)' }}>
          {/* Track */}
          <circle cx="50" cy="50" r={R} fill="none" stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'} strokeWidth="8" strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" />
          {/* Fill */}
          <motion.circle
            cx="50" cy="50" r={R} fill="none"
            stroke={gaugeColor}
            strokeWidth="8"
            strokeDasharray={`${circ * 0.75} ${circ * 0.25}`}
            strokeDashoffset={offset}
            strokeLinecap="round"
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
            style={{ filter: isDark ? `drop-shadow(0 0 6px ${gaugeColor})` : 'none' }}
          />
        </svg>
        <div style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'Orbitron, monospace',
            fontSize: 16,
            fontWeight: 700,
            color: gaugeColor,
            lineHeight: 1,
          }}>
            {(value || 0).toFixed(0)}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>{unit}</span>
        </div>
      </div>
      <div style={{ fontSize: 9, color: 'var(--text-dim)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em', marginTop: 4 }}>{label}</div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="neon-tooltip">
      <div style={{ color: 'var(--text-heading)', marginBottom: 4, fontSize: 10 }}>{label}</div>
      {payload.map((p, i) => {
        const itemColor = p.color === '#ff073a' ? 'var(--accent-red)'
                        : p.color === '#ffea00' ? 'var(--yellow-dim)'
                        : p.color === '#bf5af2' ? 'var(--purple)'
                        : 'var(--accent)';
        return (
          <div key={i} style={{ color: itemColor, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
            {p.name}: {p.value?.toFixed?.(1) ?? p.value}
          </div>
        );
      })}
    </div>
  );
};

export default function TelemetryDashboard({ nodeId = 'ESP32-A' }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { telemetry, telemetryHistory } = useMeshStore();
  const [selectedNode, setSelectedNode] = useState(nodeId);
  const nodes = ['GW-001', 'ESP32-A', 'ESP32-B', 'ESP32-C', 'ESP32-D'];

  const telem = telemetry[selectedNode] || {};
  const history = (telemetryHistory[selectedNode] || []).map((d, i) => ({
    time: `${i}`,
    temperature: d.temperature,
    humidity: d.humidity,
    gasLevel: d.gasLevel,
    networkLoad: d.networkLoad,
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Node selector */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {nodes.map(id => (
          <button
            key={id}
            onClick={() => setSelectedNode(id)}
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              border: `1px solid ${selectedNode === id ? 'var(--cyan)' : 'var(--border-bright)'}`,
              background: selectedNode === id ? 'var(--bg-glass)' : 'transparent',
              color: selectedNode === id ? 'var(--accent)' : 'var(--text-muted)',
              cursor: 'pointer',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 11,
              transition: 'all 0.2s',
            }}
          >
            {id}
          </button>
        ))}
      </div>

      {/* Gauges row */}
      <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--text-heading)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 16 }}>
          SENSOR READINGS — {selectedNode}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 20 }}>
          {GAUGES.map(g => (
            <RadialGauge
              key={g.key}
              value={telem[g.key]}
              max={g.max}
              label={g.label}
              unit={g.unit}
              color={g.color}
              warn={g.warn}
              crit={g.crit}
            />
          ))}
        </div>

        {/* Motion & Power */}
        <div style={{ display: 'flex', gap: 16, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--border-dim)' }}>
          <div style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            background: telem.motionDetected ? (isDark ? 'rgba(255,7,58,0.1)' : 'rgba(225,29,72,0.1)') : (isDark ? 'rgba(57,255,20,0.08)' : 'rgba(5,150,105,0.08)'),
            border: `1px solid ${telem.motionDetected ? 'var(--accent-red)' : 'var(--accent-green)'}`,
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>MOTION</div>
            <div style={{
              fontFamily: 'Orbitron, monospace',
              fontSize: 13,
              color: telem.motionDetected ? 'var(--accent-red)' : 'var(--accent-green)',
              fontWeight: 700,
            }}>
              {telem.motionDetected ? '⚠ DETECTED' : '✓ CLEAR'}
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-dim)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>POWER</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent-green)', fontWeight: 700 }}>
              {(telem.powerStatus || 'NORMAL').toUpperCase()}
            </div>
          </div>
          <div style={{
            flex: 1,
            padding: '10px 14px',
            borderRadius: 8,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-dim)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>BATTERY</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: 'var(--accent)', fontWeight: 700 }}>
              {telem.batteryLevel?.toFixed(0) || 98}%
            </div>
          </div>
        </div>
      </div>

      {/* Temperature history chart */}
      <div className="glass-card glass-card-red" style={{ padding: 20 }}>
        <div style={{ fontSize: 10, color: 'var(--accent-red)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 16 }}>
          TEMPERATURE HISTORY (°C)
        </div>
        <ResponsiveContainer width="100%" height={150}>
          <AreaChart data={history}>
            <defs>
              <linearGradient id="tempGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? '#ff073a' : '#e11d48'} stopOpacity={0.3} />
                <stop offset="95%" stopColor={isDark ? '#ff073a' : '#e11d48'} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,7,58,0.08)" : "rgba(225,29,72,0.15)"} />
            <XAxis dataKey="time" hide />
            <YAxis domain={[15, 55]} width={30} />
            <Tooltip content={<CustomTooltip />} />
            <Area type="monotone" dataKey="temperature" name="Temp" stroke={isDark ? "#ff073a" : "#e11d48"} fill="url(#tempGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Gas & Network load */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card glass-card-yellow" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, color: 'var(--yellow-dim)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 12 }}>GAS LEVEL (ppm)</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="gasGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isDark ? '#ffea00' : '#d97706'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isDark ? '#ffea00' : '#d97706'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="gasLevel" name="Gas" stroke={isDark ? "#ffea00" : "#d97706"} fill="url(#gasGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div className="glass-card glass-card-purple" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, color: 'var(--purple)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 12 }}>NETWORK LOAD (%)</div>
          <ResponsiveContainer width="100%" height={100}>
            <AreaChart data={history}>
              <defs>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={isDark ? '#bf5af2' : '#7c3aed'} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={isDark ? '#bf5af2' : '#7c3aed'} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="networkLoad" name="Load" stroke={isDark ? "#bf5af2" : "#7c3aed"} fill="url(#netGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
