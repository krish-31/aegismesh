import { motion } from 'framer-motion';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import {
  Server, Wifi, WifiOff, Radio, Cpu, Activity, Clock, Shield, Zap, Router
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

function DeviceCard({ node }) {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const STATUS_COLORS = {
    healthy:  isDark ? '#39ff14' : '#059669',
    unstable: isDark ? '#ffea00' : '#d97706',
    failed:   isDark ? '#ff073a' : '#e11d48',
    gateway:  isDark ? '#0080ff' : '#0066cc',
  };

  const color = STATUS_COLORS[node.status] || (isDark ? '#39ff14' : '#059669');
  const isLive = node.isReal || node.mode === 'live';
  const modeColor = node.isGateway ? (isDark ? '#0080ff' : '#0066cc') : isLive ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#00f5ff' : '#0891b2');
  const modeLabel = node.isGateway ? '⬡ GATEWAY' : isLive ? '● LIVE' : '◌ SIMULATED';
  const mqttColor = node.mqttConnected ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48');

  const handleFail = () => socket.emit('simulation:fail-node', { nodeId: node.nodeId });
  const handleRecover = () => socket.emit('simulation:recover-node', { nodeId: node.nodeId });

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ scale: 1.01, y: -2 }}
      className="glass-card"
      style={{
        padding: '16px 18px',
        borderLeft: `3px solid ${color}`,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, fontWeight: 700, color, textShadow: isDark ? `0 0 8px ${color}60` : 'none' }}>
            {node.label || node.nodeId}
          </div>
          <div style={{ fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)', marginTop: 2 }}>
            {node.nodeId} • {node.ipAddress}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {/* Mode badge */}
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 8,
            fontFamily: 'Orbitron, monospace', fontWeight: 700,
            background: `${modeColor}12`, border: `1px solid ${modeColor}40`,
            color: modeColor, letterSpacing: '0.08em',
          }}>
            {modeLabel}
          </span>
          {/* Status badge */}
          <span style={{
            padding: '2px 8px', borderRadius: 4, fontSize: 8,
            fontFamily: 'Orbitron, monospace', fontWeight: 700,
            background: `${color}12`, border: `1px solid ${color}40`,
            color, textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>
            {node.status}
          </span>
        </div>
      </div>

      {/* Metrics grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
        {[
          { icon: Cpu, label: 'CPU', value: `${(node.cpuUsage || 0).toFixed(0)}%`, color: node.cpuUsage > 80 ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#00f5ff' : '#0891b2') },
          { icon: Activity, label: 'Latency', value: `${(node.latency || 0).toFixed(0)}ms`, color: node.latency > 50 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669') },
          { icon: Wifi, label: 'RSSI', value: `${(node.wifiSignal || -60).toFixed(0)}`, color: isDark ? '#00f5ff' : '#0891b2' },
          { icon: Clock, label: 'Uptime', value: node.uptime ? `${Math.floor(node.uptime / 60)}m` : '0m', color: isDark ? '#39ff14' : '#059669' },
          { icon: Zap, label: 'Packets', value: (node.packetCount || 0).toLocaleString(), color: isDark ? '#bf5af2' : '#7c3aed' },
          { icon: Shield, label: 'Anomaly', value: `${(node.anomalyScore || 0).toFixed(0)}`, color: node.anomalyScore > 30 ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669') },
        ].map(m => (
          <div key={m.label} style={{
            padding: '6px 8px', borderRadius: 6,
            background: 'var(--bg-glass)', border: '1px solid var(--border-dim)',
            textAlign: 'center',
          }}>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: m.color, fontWeight: 600 }}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Footer — MQTT + firmware + actions */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{
            fontSize: 9, fontFamily: 'Share Tech Mono, monospace',
            color: mqttColor, display: 'flex', alignItems: 'center', gap: 4,
          }}>
            <span style={{ width: 5, height: 5, borderRadius: '50%', background: mqttColor, display: 'block' }} />
            MQTT {node.mqttConnected ? 'ON' : 'OFF'}
          </span>
          <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: isDark ? 'rgba(191,90,242,0.6)' : '#7c3aed' }}>
            FW {node.firmwareVersion || 'N/A'}
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {node.status !== 'failed' ? (
            <button onClick={handleFail} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 9,
              fontFamily: 'Share Tech Mono, monospace', cursor: 'pointer',
              background: 'rgba(255,7,58,0.08)', border: `1px solid ${isDark ? 'rgba(255,7,58,0.25)' : 'rgba(255,7,58,0.45)'}`,
              color: isDark ? '#ff073a' : '#e11d48', transition: 'all 0.2s',
            }}>DISCONNECT</button>
          ) : (
            <button onClick={handleRecover} style={{
              padding: '3px 10px', borderRadius: 4, fontSize: 9,
              fontFamily: 'Share Tech Mono, monospace', cursor: 'pointer',
              background: 'rgba(57,255,20,0.08)', border: `1px solid ${isDark ? 'rgba(57,255,20,0.25)' : 'rgba(57,255,20,0.45)'}`,
              color: isDark ? '#39ff14' : '#059669', transition: 'all 0.2s',
            }}>RECOVER</button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function DeviceManagementPage() {
  const { nodes, liveCount, simCount, offlineCount, gatewayCount, mqttStatus } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const socket = getSocket();

  const handleRestartMQTT = () => socket.emit('mqtt:restart');

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'LIVE DEVICES', value: liveCount || 0, color: isDark ? '#39ff14' : '#059669', icon: Radio },
          { label: 'SIMULATED', value: simCount || 0, color: isDark ? '#00f5ff' : '#0891b2', icon: Server },
          { label: 'OFFLINE', value: offlineCount || 0, color: offlineCount > 0 ? (isDark ? '#ff073a' : '#e11d48') : 'var(--text-muted)', icon: WifiOff },
          { label: 'GATEWAYS', value: gatewayCount || 0, color: isDark ? '#0080ff' : '#0066cc', icon: Router },
        ].map(card => (
          <motion.div
            key={card.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card"
            style={{ padding: '14px 16px', textAlign: 'center' }}
          >
            <card.icon size={18} color={card.color} style={{ marginBottom: 6 }} />
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 22, fontWeight: 700, color: card.color, textShadow: isDark ? `0 0 15px ${card.color}40` : 'none' }}>
              {card.value}
            </div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, color: 'var(--text-muted)', letterSpacing: '0.12em', marginTop: 4 }}>
              {card.label}
            </div>
          </motion.div>
        ))}
      </div>

      {/* MQTT Monitor */}
      <div className="glass-card glass-card-green" style={{ padding: '14px 18px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <motion.div
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ repeat: Infinity, duration: mqttStatus.brokerOnline ? 2 : 0.5 }}
              style={{
                width: 8, height: 8, borderRadius: '50%',
                background: mqttStatus.brokerOnline ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48'),
                boxShadow: isDark ? `0 0 8px ${mqttStatus.brokerOnline ? '#39ff14' : '#ff073a'}` : 'none',
              }}
            />
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: mqttStatus.brokerOnline ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48'), letterSpacing: '0.1em' }}>
              MQTT BROKER {mqttStatus.brokerOnline ? 'ONLINE' : 'OFFLINE'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
            <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)' }}>
              Port: 1883
            </span>
            <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: isDark ? '#00f5ff' : '#0891b2' }}>
              Clients: {mqttStatus.connectedNodes || 0}
            </span>
            <span style={{ fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: isDark ? 'rgba(191,90,242,0.6)' : '#7c3aed' }}>
              Topics: aegismesh/nodes/#
            </span>
          </div>
        </div>
      </div>

      {/* Device grid */}
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em', marginBottom: 12 }}>
        ALL MESH DEVICES ({nodes.length})
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
        {/* Sort: gateway first, then live, then simulated, then failed */}
        {[...nodes]
          .sort((a, b) => {
            const rank = n => n.isGateway ? 0 : n.isReal ? 1 : n.status === 'failed' ? 3 : 2;
            return rank(a) - rank(b);
          })
          .map(node => (
            <DeviceCard key={node.nodeId} node={node} />
          ))
        }
      </div>
    </div>
  );
}
