import { motion } from 'framer-motion';
import useMeshStore from '../store/meshStore';
import { Cpu, Wifi, Activity, Clock, Hash, Zap } from 'lucide-react';
import NodeDetailsPanel from '../components/nodes/NodeDetailsPanel';
import { useState } from 'react';
import { useTheme } from '../lib/ThemeContext';

const getStatusColor = (isDark) => ({
  healthy:  isDark ? '#39ff14' : '#059669',
  unstable: isDark ? '#ffea00' : '#d97706',
  failed:   isDark ? '#ff073a' : '#e11d48',
  gateway:  isDark ? '#0080ff' : '#2563eb',
});

function NodeCard({ node, onClick, isSelected }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const statusColor = getStatusColor(isDark);
  const color = statusColor[node.status] || (isDark ? '#39ff14' : '#059669');

  return (
    <motion.div
      whileHover={{ scale: 1.02 }}
      onClick={() => onClick(node)}
      className={`glass-card glass-card-${node.status === 'failed' ? 'red' : node.status === 'unstable' ? 'yellow' : 'cyan'}`}
      style={{ padding: 16, cursor: 'pointer', border: isSelected ? `2px solid ${color}` : undefined }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 13, fontWeight: 700, color }}>{node.label || node.nodeId}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', marginTop: 2 }}>{node.ipAddress}</div>
        </div>
        <div className={`status-badge badge-${node.status}`}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'block', animation: node.status !== 'failed' ? 'pulse-neon 2s infinite' : 'none', boxShadow: isDark ? `0 0 4px ${color}` : 'none' }} />
          {node.status}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { icon: Cpu, label: 'CPU', value: `${(node.cpuUsage || 0).toFixed(0)}%` },
          { icon: Activity, label: 'LATENCY', value: `${(node.latency || 0).toFixed(0)}ms` },
          { icon: Hash, label: 'PACKETS', value: (node.packetCount || 0).toLocaleString() },
          { icon: Wifi, label: 'SIGNAL', value: `${(node.wifiSignal || -60).toFixed(0)} dBm` },
        ].map(m => (
          <div key={m.label} style={{
            padding: '6px 10px',
            borderRadius: 6,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-dim)',
          }}>
            <div style={{ fontSize: 8, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 2 }}>{m.label}</div>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, color: 'var(--accent)' }}>{m.value}</div>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

export default function NodesPage() {
  const { nodes } = useMeshStore();
  const [selectedId, setSelectedId] = useState(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const handleNodeClick = (node) => {
    setSelectedId(node.nodeId);
    setPanelOpen(true);
  };

  return (
    <div style={{ display: 'flex', gap: 16 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em', marginBottom: 16 }}>
          NODE MONITORING — {nodes.length} DEVICES
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {nodes.map(node => (
            <NodeCard key={node.nodeId} node={node} onClick={handleNodeClick} isSelected={selectedId === node.nodeId} />
          ))}
        </div>
      </div>

      {panelOpen && selectedId && (
        <NodeDetailsPanel nodeId={selectedId} onClose={() => { setPanelOpen(false); setSelectedId(null); }} />
      )}
    </div>
  );
}
