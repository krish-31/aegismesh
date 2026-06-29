/**
 * NodeDetailsPanel v3 — Professional slide-in panel with live updating metrics
 *
 * Enhancements:
 * - Animated signal bars with pulsing active indicators
 * - Mini latency sparkline chart
 * - Threat level gauge per node
 * - Live heartbeat timestamp with breathing dot
 * - Animated CPU/latency progress bars
 */

import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { X, Cpu, Wifi, Activity, Clock, Zap, Server, Hash, AlertTriangle, ArrowRight, Shield, TrendingUp } from 'lucide-react';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';

const getStatusColor = (isDark) => ({
  healthy:  isDark ? '#39ff14' : '#059669',
  unstable: isDark ? '#ffea00' : '#d97706',
  failed:   isDark ? '#ff073a' : '#e11d48',
  gateway:  isDark ? '#0080ff' : '#2563eb',
});

function AnimatedSignalBars({ signal }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const normalized  = Math.min(100, Math.max(0, ((signal + 90) / 60) * 100));
  const bars        = 5;
  const activeBars  = Math.round((normalized / 100) * bars);
  const color       = normalized > 60
    ? (isDark ? '#39ff14' : '#059669')
    : normalized > 30
    ? (isDark ? '#ffea00' : '#d97706')
    : (isDark ? '#ff073a' : '#e11d48');

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 18 }}>
      {Array.from({ length: bars }, (_, i) => (
        <motion.div
          key={i}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1, opacity: i < activeBars ? [0.6, 1, 0.6] : 0.15 }}
          transition={{
            scaleY: { delay: i * 0.08, duration: 0.3 },
            opacity: i < activeBars ? { repeat: Infinity, duration: 2, delay: i * 0.2 } : {},
          }}
          style={{
            width: 4,
            height: `${(i + 1) * 3 + 3}px`,
            borderRadius: 1,
            background: i < activeBars ? color : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'),
            boxShadow: (i < activeBars && isDark) ? `0 0 4px ${color}` : 'none',
            transformOrigin: 'bottom',
          }}
        />
      ))}
    </div>
  );
}

function MiniSparkline({ data, color = '#00f5ff', height = 30 }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  if (!data || data.length < 2) return null;
  const max = Math.max(...data) || 1;
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 120;
  const h = height;
  const points = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / range) * (h - 4)}`).join(' ');

  const resolvedColor = color === '#ff073a' ? (isDark ? '#ff073a' : '#e11d48')
                      : color === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                      : color === '#39ff14' ? (isDark ? '#39ff14' : '#059669')
                      : color === '#ffea00' ? (isDark ? '#ffea00' : '#d97706')
                      : color === '#bf5af2' ? (isDark ? '#bf5af2' : '#7c3aed')
                      : color;

  return (
    <svg width={w} height={h} style={{ overflow: 'visible' }}>
      <polyline
        points={points}
        fill="none"
        stroke={resolvedColor}
        strokeWidth="1.5"
        strokeLinejoin="round"
        style={isDark ? { filter: `drop-shadow(0 0 3px ${resolvedColor})` } : {}}
      />
      {/* Last point dot */}
      {data.length > 0 && (() => {
        const lastX = w;
        const lastY = h - ((data[data.length - 1] - min) / range) * (h - 4);
        return <circle cx={lastX} cy={lastY} r={2.5} fill={resolvedColor} style={isDark ? { filter: `drop-shadow(0 0 4px ${resolvedColor})` } : {}} />;
      })()}
    </svg>
  );
}

function MetricRow({ icon: Icon, label, value, unit, color = '#00f5ff', sparkData }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const resolvedColor = color === '#ff073a' ? (isDark ? '#ff073a' : '#e11d48')
                      : color === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                      : color === '#39ff14' ? (isDark ? '#39ff14' : '#059669')
                      : color === '#ffea00' ? (isDark ? '#ffea00' : '#d97706')
                      : color === '#bf5af2' ? (isDark ? '#bf5af2' : '#7c3aed')
                      : color;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '8px 0', borderBottom: isDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon size={13} color={isDark ? "rgba(0,245,255,0.5)" : "#0e7490"} />
        <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {sparkData && <MiniSparkline data={sparkData} color={resolvedColor} height={20} />}
        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, fontWeight: 600, color: resolvedColor }}>
          {value}
          {unit && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 3 }}>{unit}</span>}
        </span>
      </div>
    </div>
  );
}

export default function NodeDetailsPanel({ nodeId, onClose }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const { nodes, selectedNode, nodeRoutes, telemetry } = useMeshStore();
  const node  = selectedNode || nodes.find(n => n.nodeId === nodeId);
  const telem = telemetry[nodeId] || node?.telemetry || {};

  // Accumulate latency history for sparkline
  const [latencyHistory, setLatencyHistory] = useState([]);
  const [cpuHistory, setCpuHistory]         = useState([]);

  useEffect(() => {
    if (!node) return;
    setLatencyHistory(prev => [...prev.slice(-15), node.latency || 0]);
    setCpuHistory(prev => [...prev.slice(-15), node.cpuUsage || 0]);
  }, [node?.latency, node?.cpuUsage]);

  if (!node) return null;

  const statusColors = getStatusColor(isDark);
  const statusColor = statusColors[node.status] || (isDark ? '#00f5ff' : '#0e7490');
  const uptime = node.uptime
    ? `${Math.floor(node.uptime / 3600)}h ${Math.floor((node.uptime % 3600) / 60)}m`
    : 'N/A';

  const anomalyColor = (node.anomalyScore || 0) > 60 ? (isDark ? '#ff073a' : '#e11d48') : (node.anomalyScore || 0) > 30 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669');

  return (
    <motion.div
      initial={{ x: 360, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 360, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="node-panel"
      style={{ backdropFilter: 'blur(20px)' }}
    >
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: isDark ? '1px solid rgba(0,245,255,0.1)' : '1px solid rgba(0,0,0,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: `linear-gradient(135deg, ${statusColor}14 0%, transparent 100%)`,
      }}>
        <div>
          <div style={{
            fontFamily: 'Orbitron, monospace', fontSize: 14, fontWeight: 700,
            color: statusColor, textShadow: isDark ? `0 0 10px ${statusColor}80` : 'none',
          }}>
            {node.label || node.nodeId}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>
            {node.ipAddress || 'No IP'}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {/* Mode badge */}
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 9,
              fontFamily: 'Orbitron, monospace', fontWeight: 700, letterSpacing: '0.08em',
              background: node.isGateway ? (isDark ? 'rgba(0,128,255,0.15)' : 'rgba(37,99,235,0.08)') : node.isReal ? (isDark ? 'rgba(57,255,20,0.12)' : 'rgba(5,150,105,0.08)') : (isDark ? 'rgba(0,245,255,0.1)' : 'rgba(8,145,178,0.08)'),
              border: `1px solid ${node.isGateway ? (isDark ? 'rgba(0,128,255,0.4)' : 'rgba(37,99,235,0.25)') : node.isReal ? (isDark ? 'rgba(57,255,20,0.35)' : 'rgba(5,150,105,0.25)') : (isDark ? 'rgba(0,245,255,0.25)' : 'rgba(8,145,178,0.25)')}`,
              color: node.isGateway ? (isDark ? '#0080ff' : '#2563eb') : node.isReal ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#00f5ff' : '#0e7490'),
            }}>
              {node.isGateway ? '⬡ GATEWAY' : node.isReal ? '● LIVE' : '◌ SIMULATED'}
            </span>
            {/* MQTT badge */}
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 9,
              fontFamily: 'Share Tech Mono, monospace',
              background: node.mqttConnected ? (isDark ? 'rgba(57,255,20,0.1)' : 'rgba(5,150,105,0.08)') : (isDark ? 'rgba(255,7,58,0.08)' : 'rgba(225,29,72,0.06)'),
              border: `1px solid ${node.mqttConnected ? (isDark ? 'rgba(57,255,20,0.25)' : 'rgba(5,150,105,0.25)') : (isDark ? 'rgba(255,7,58,0.2)' : 'rgba(225,29,72,0.2)')}`,
              color: node.mqttConnected ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48'),
            }}>
              {node.mqttConnected ? 'MQTT ●' : 'MQTT ○'}
            </span>
            {/* Firmware */}
            <span style={{
              padding: '2px 8px', borderRadius: 4, fontSize: 9,
              fontFamily: 'Share Tech Mono, monospace',
              background: isDark ? 'rgba(191,90,242,0.08)' : 'rgba(124,58,237,0.06)',
              border: `1px solid ${isDark ? 'rgba(191,90,242,0.2)' : 'rgba(124,58,237,0.2)'}`,
              color: isDark ? 'rgba(191,90,242,0.7)' : '#7c3aed',
            }}>
              FW {node.firmwareVersion || 'N/A'}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className={`status-badge badge-${node.status}`} style={{ textTransform: 'uppercase' }}>
            <motion.span
              animate={node.status === 'healthy' || node.status === 'gateway'
                ? { opacity: [0.5, 1, 0.5] }
                : node.status === 'failed'
                ? { opacity: [1, 0.2, 1] }
                : { opacity: [1, 0.4, 1] }
              }
              transition={{ repeat: Infinity, duration: node.status === 'failed' ? 0.6 : 3 }}
              style={{
                width: 6, height: 6, borderRadius: '50%', background: statusColor,
                boxShadow: `0 0 6px ${statusColor}`, display: 'block',
              }}
            />
            {node.status}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(224,232,240,0.4)' }}>
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>

        {/* Active route */}
        {node.activeRoute && node.activeRoute.length > 1 && (
          <div style={{
            marginBottom: 16, padding: '10px 12px', borderRadius: 8,
            background: isDark ? 'rgba(57,255,20,0.06)' : 'rgba(5,150,105,0.08)',
            border: `1px solid ${isDark ? 'rgba(57,255,20,0.2)' : 'rgba(5,150,105,0.2)'}`,
          }}>
            <div style={{ fontSize: 9, color: isDark ? '#39ff14' : '#059669', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
              ACTIVE DIJKSTRA ROUTE
            </div>
            <div style={{
              fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: isDark ? '#39ff14' : '#059669',
              display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
            }}>
              {node.activeRoute.map((hop, i) => (
                <motion.span
                  key={hop}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 4 }}
                >
                  <span style={{ color: hop === node.nodeId ? (isDark ? '#00f5ff' : '#0891b2') : (isDark ? '#39ff14' : '#059669') }}>{hop}</span>
                  {i < node.activeRoute.length - 1 && (
                    <motion.span animate={{ x: [0, 3, 0] }} transition={{ repeat: Infinity, duration: 1.2 }}>
                      <ArrowRight size={10} color={isDark ? "rgba(57,255,20,0.4)" : "rgba(5,150,105,0.5)"} />
                    </motion.span>
                  )}
                </motion.span>
              ))}
            </div>
          </div>
        )}

        {/* Threat Level mini-gauge */}
        <div style={{
          marginBottom: 16, padding: '10px 12px', borderRadius: 8,
          background: `${anomalyColor}08`, border: `1px solid ${anomalyColor}20`,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={12} color={anomalyColor} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>ANOMALY SCORE</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 50, height: 4, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
              <motion.div animate={{ width: `${node.anomalyScore || 0}%` }} style={{ height: '100%', background: anomalyColor, borderRadius: 2 }} />
            </div>
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, color: anomalyColor, fontWeight: 700 }}>
              {(node.anomalyScore || 0).toFixed(0)}
            </span>
          </div>
        </div>

        {/* CPU Usage */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Cpu size={12} color={isDark ? "rgba(0,245,255,0.6)" : "#0e7490"} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>CPU USAGE</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <MiniSparkline data={cpuHistory} color={node.cpuUsage > 80 ? '#ff073a' : '#00f5ff'} height={16} />
              <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 14, color: node.cpuUsage > 80 ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#00f5ff' : '#0e7490') }}>
                {(node.cpuUsage || 0).toFixed(1)}%
              </span>
            </div>
          </div>
          <div style={{ height: 6, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <motion.div
              animate={{ width: `${Math.min(100, node.cpuUsage || 0)}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{
                height: '100%',
                background: node.cpuUsage > 80
                  ? `linear-gradient(90deg, ${isDark ? '#ff073a' : '#e11d48'}, ${isDark ? '#ff4d6a' : '#fb7185'})`
                  : node.cpuUsage > 60
                  ? `linear-gradient(90deg, ${isDark ? '#ffea00' : '#d97706'}, ${isDark ? '#f59e0b' : '#b45309'})`
                  : `linear-gradient(90deg, ${isDark ? '#00f5ff' : '#0891b2'}, ${isDark ? '#0080ff' : '#2563eb'})`,
                borderRadius: 3,
                boxShadow: isDark ? `0 0 8px ${node.cpuUsage > 80 ? '#ff073a' : '#00f5ff'}` : 'none',
              }}
            />
          </div>
        </div>

        {/* WiFi Signal */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <Wifi size={12} color={isDark ? "rgba(0,245,255,0.6)" : "#0e7490"} />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>SIGNAL STRENGTH</span>
            </div>
            <AnimatedSignalBars signal={node.wifiSignal || -60} />
          </div>
          <span style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)' }}>
            {(node.wifiSignal || -60).toFixed(0)} dBm
          </span>
        </div>

        {/* Core metrics with sparklines */}
        <div style={{ marginBottom: 20 }}>
          <MetricRow icon={Activity} label="Latency" value={(node.latency || 0).toFixed(1)} unit="ms"
            color={node.latency > 100 ? '#ff073a' : node.latency > 50 ? '#ffea00' : '#39ff14'}
            sparkData={latencyHistory}
          />
          <MetricRow icon={AlertTriangle} label="Packet Loss" value={`${(node.packetLoss || 0).toFixed(1)}%`}
            color={node.packetLoss > 10 ? '#ff073a' : node.packetLoss > 3 ? '#ffea00' : '#39ff14'} />
          <MetricRow icon={Hash} label="Packet Count" value={(node.packetCount || 0).toLocaleString()} color="#00f5ff" />
          <MetricRow icon={Zap} label="Uptime" value={uptime} color="#39ff14" />
          <MetricRow icon={Clock} label="Last Heartbeat"
            value={node.lastHeartbeat ? new Date(node.lastHeartbeat).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : 'N/A'} color="#bf5af2" />
          <MetricRow icon={Server} label="Node ID" value={node.nodeId} color="var(--text-secondary)" />
        </div>

        {/* Sensor telemetry */}
        {Object.keys(telem).length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-heading)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
              SENSOR DATA
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { label: 'TEMP', value: `${(telem.temperature || 0).toFixed(1)}°C`, color: telem.temperature > 40 ? '#ff073a' : '#ffea00' },
                { label: 'HUMIDITY', value: `${(telem.humidity || 0).toFixed(0)}%`, color: '#00f5ff' },
                { label: 'GAS', value: `${(telem.gasLevel || 0).toFixed(0)} ppm`, color: telem.gasLevel > 50 ? '#ff073a' : '#39ff14' },
                { label: 'MOTION', value: telem.motionDetected ? 'DETECTED' : 'CLEAR', color: telem.motionDetected ? '#ff073a' : '#39ff14' },
              ].map(item => {
                const resolvedItemColor = item.color === '#00f5ff' ? (isDark ? '#00f5ff' : '#0891b2')
                                        : item.color === '#ffea00' ? (isDark ? '#ffea00' : '#d97706')
                                        : item.color === '#ff073a' ? (isDark ? '#ff073a' : '#e11d48')
                                        : (isDark ? '#39ff14' : '#059669');
                return (
                  <motion.div
                    key={item.label}
                    whileHover={{ scale: 1.02 }}
                    style={{
                      padding: '10px', background: 'var(--bg-glass)',
                      border: '1px solid var(--border-dim)', borderRadius: 8, textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 4 }}>
                      {item.label}
                    </div>
                    <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, color: resolvedItemColor, fontWeight: 700 }}>
                      {item.value}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}

        {/* Connected Neighbors */}
        {node.neighbors && node.neighbors.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-heading)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
              CONNECTED NEIGHBORS ({node.neighbors.length})
            </div>
            {node.neighbors.map((nId, i) => {
              const neighborNode = nodes.find(n => n.nodeId === nId);
              const nColor = neighborNode ? (statusColors[neighborNode.status] || (isDark ? '#39ff14' : '#059669')) : (isDark ? '#39ff14' : '#059669');
              return (
                <motion.div
                  key={nId}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 0', borderBottom: isDark ? '1px solid rgba(255,255,255,0.03)' : '1px solid rgba(0,0,0,0.03)',
                  }}
                >
                  <motion.span
                    animate={{ opacity: neighborNode?.status === 'failed' ? [1, 0.2, 1] : [0.5, 1, 0.5] }}
                    transition={{ repeat: Infinity, duration: neighborNode?.status === 'failed' ? 0.6 : 3 }}
                    style={{ width: 8, height: 8, borderRadius: '50%', background: nColor, boxShadow: isDark ? `0 0 4px ${nColor}` : 'none', display: 'block' }}
                  />
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: 'var(--text-secondary)', flex: 1 }}>{nId}</span>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: nColor, textTransform: 'uppercase' }}>
                    {neighborNode?.status || '?'}
                  </span>
                </motion.div>
              );
            })}
          </div>
        )}

        {/* Routing Table */}
        {nodeRoutes && nodeRoutes.length > 0 && (
          <div>
            <div style={{ fontSize: 10, color: 'var(--text-heading)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
              ROUTING TABLE (DIJKSTRA)
            </div>
            {nodeRoutes.map(route => (
              <div key={route.to} style={{
                padding: '8px 10px', marginBottom: 6,
                background: route.path.length > 0 ? (isDark ? 'rgba(0,245,255,0.03)' : 'rgba(8,145,178,0.03)') : (isDark ? 'rgba(255,7,58,0.05)' : 'rgba(225,29,72,0.04)'),
                border: `1px solid ${route.path.length > 0 ? 'var(--border-dim)' : (isDark ? 'rgba(255,7,58,0.15)' : 'rgba(225,29,72,0.15)')}`,
                borderRadius: 6,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>→ {route.to}</span>
                  <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: route.distance ? 'var(--text-muted)' : 'var(--accent-red)' }}>
                    {route.distance ? `${route.distance.toFixed(0)} ms` : 'NO PATH'}
                  </span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
                  {route.path?.length > 0 ? route.path.join(' → ') : 'Unreachable'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}
