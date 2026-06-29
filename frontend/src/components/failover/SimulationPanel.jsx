import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { getSocket } from '../../lib/socket';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';
import {
  WifiOff, Wifi, AlertTriangle, Clock, Zap, Shield, RotateCcw, GitBranch,
  Play, Square, SkipForward, Users, RefreshCw, Scissors
} from 'lucide-react';

const SIMULATIONS = [
  { id: 'fail-node',     label: 'Disconnect Node',   description: 'Take a mesh node offline and trigger failover', icon: WifiOff, color: '#ff073a', nodeRequired: true, event: 'simulation:fail-node' },
  { id: 'recover-node',  label: 'Recover Node',      description: 'Restore a failed node to the mesh', icon: Wifi, color: '#39ff14', nodeRequired: true, event: 'simulation:recover-node' },
  { id: 'packet-loss',   label: 'Simulate Packet Loss', description: 'Inject 15-35% packet loss for 10s', icon: AlertTriangle, color: '#ffea00', nodeRequired: true, event: 'simulation:packet-loss' },
  { id: 'high-latency',  label: 'Simulate High Latency', description: 'Spike latency to 200-500ms for 8s', icon: Clock, color: '#f59e0b', nodeRequired: true, event: 'simulation:high-latency' },
  { id: 'route-optimize', label: 'Route Optimization', description: 'Run Dijkstra shortest-path recalculation', icon: GitBranch, color: '#00f5ff', nodeRequired: false, event: 'simulation:route-optimize' },
  { id: 'flood-attack',  label: 'Flood Attack',       description: 'DDoS/flood detection for 12s', icon: Shield, color: '#bf5af2', nodeRequired: true, event: 'simulation:flood-attack' },
  { id: 'node-spoof',    label: 'Node Spoofing',      description: 'Rogue node impersonation attack', icon: Users, color: '#ff6b6b', nodeRequired: true, event: 'simulation:node-spoof' },
  { id: 'packet-replay', label: 'Packet Replay',      description: 'Duplicate packet injection attack', icon: RefreshCw, color: '#ffa726', nodeRequired: true, event: 'simulation:packet-replay' },
  { id: 'net-partition',  label: 'Network Partition', description: 'Split mesh into isolated segments', icon: Scissors, color: '#e040fb', nodeRequired: false, event: 'simulation:network-partition' },
];

const getStatusColor = (status, isDark) => {
  const darkColors = { healthy: '#39ff14', unstable: '#ffea00', failed: '#ff073a', gateway: '#0080ff' };
  const lightColors = { healthy: '#059669', unstable: '#d97706', failed: '#e11d48', gateway: '#0066cc' };
  return isDark ? darkColors[status] : lightColors[status];
};

const getThemeColor = (color, isDark) => {
  if (isDark) return color;
  const mapping = {
    '#39ff14': '#166534', // dark green
    '#ffea00': '#b45309', // dark amber
    '#f59e0b': '#c2410c', // dark orange
    '#00f5ff': '#0369a1', // dark sky-blue
    '#bf5af2': '#6b21a8', // dark purple
    '#ff6b6b': '#991b1b', // dark red
    '#ffa726': '#c2410c', // dark orange
    '#e040fb': '#86198f', // dark fuchsia
    '#ff073a': '#9f1239', // dark rose
  };
  return mapping[color] || color;
};

export default function SimulationPanel() {
  const [activeNodeId, setActiveNodeId] = useState('ESP32-A');
  const [runningId,    setRunningId]    = useState(null);
  const [recentRuns,   setRecentRuns]   = useState([]);

  const socket = getSocket();
  const { nodes, simulating, demoActive, demoStep } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const key = e.key.toUpperCase();
      if (key === 'F') socket.emit('simulation:fail-node', { nodeId: activeNodeId });
      if (key === 'R') socket.emit('simulation:recover-node', { nodeId: activeNodeId });
      if (key === 'A') socket.emit('simulation:flood-attack', { nodeId: activeNodeId });
      if (key === 'O') socket.emit('simulation:route-optimize', {});
      if (key === 'D') socket.emit(demoActive ? 'demo:stop' : 'demo:start');
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeNodeId, demoActive]);
  
  // Auto-select active target node based on available nodes
  useEffect(() => {
    if (nodes && nodes.length > 0) {
      const exists = nodes.some(n => n.nodeId === activeNodeId);
      if (!exists) {
        const nonGateway = nodes.find(n => !n.isGateway && n.nodeId !== 'GW-001');
        setActiveNodeId(nonGateway ? nonGateway.nodeId : nodes[0].nodeId);
      }
    }
  }, [nodes, activeNodeId]);

  const runSimulation = (sim) => {
    if (runningId) return;
    setRunningId(sim.id);
    const payload = sim.nodeRequired ? { nodeId: activeNodeId } : {};
    socket.emit(sim.event, payload);
    setRecentRuns(prev => [{ sim: sim.label, nodeId: activeNodeId, timestamp: new Date().toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }), color: sim.color }, ...prev].slice(0, 10));
    const timeout = sim.id === 'fail-node' ? 2500 : 1500;
    setTimeout(() => setRunningId(null), timeout);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* AUTO DEMO button */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => socket.emit(demoActive ? 'demo:stop' : 'demo:start')}
        style={{
          width: '100%', padding: '12px 16px', borderRadius: 10, cursor: 'pointer',
          background: demoActive ? 'rgba(191,90,242,0.2)' : 'linear-gradient(135deg, rgba(191,90,242,0.15) 0%, rgba(0,245,255,0.1) 100%)',
          border: `1px solid ${demoActive ? 'rgba(191,90,242,0.5)' : 'rgba(191,90,242,0.3)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          boxShadow: demoActive && isDark ? '0 0 25px rgba(191,90,242,0.3)' : 'none',
          transition: 'all 0.3s',
        }}
      >
        {demoActive ? (
          <>
            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}>
              <RotateCcw size={14} color="#bf5af2" />
            </motion.div>
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: '#bf5af2', letterSpacing: '0.1em', fontWeight: 700 }}>
              STOP DEMO
            </span>
          </>
        ) : (
          <>
            <Play size={14} color="#bf5af2" />
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: '#bf5af2', letterSpacing: '0.1em', fontWeight: 700 }}>
              AUTO DEMO
            </span>
          </>
        )}
      </motion.button>

      {/* Demo progress bar */}
      <AnimatePresence>
        {demoActive && demoStep && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            style={{ padding: '10px 14px', borderRadius: 8, background: 'rgba(191,90,242,0.08)', border: '1px solid rgba(191,90,242,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, color: '#bf5af2', letterSpacing: '0.08em' }}>
                {demoStep.label}
              </span>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'rgba(191,90,242,0.5)' }}>
                {demoStep.step + 1}/{demoStep.totalSteps}
              </span>
            </div>
            <div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
              <motion.div
                animate={{ width: `${demoStep.progress}%` }}
                style={{ height: '100%', background: 'linear-gradient(90deg, #bf5af2, #00f5ff)', borderRadius: 2 }}
              />
            </div>
            <div style={{ marginTop: 4, fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>
              {demoStep.description}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button onClick={() => socket.emit('demo:skip')} style={{ background: 'none', border: '1px solid rgba(191,90,242,0.2)', borderRadius: 4, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4 }}>
                <SkipForward size={9} color="rgba(191,90,242,0.6)" />
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: 'rgba(191,90,242,0.6)' }}>SKIP</span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node selector with LIVE status */}
      <div className="glass-card glass-card-cyan" style={{ padding: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 10 }}>
          TARGET NODE
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {nodes && nodes.length > 0 ? (
            nodes.map(node => {
              const id = node.nodeId;
              const status = node?.status || 'healthy';
              const color  = getStatusColor(status, isDark);
              const isLive = node?.mode === 'live';
              const isActive = activeNodeId === id;
              return (
                <button key={id} onClick={() => setActiveNodeId(id)}
                  style={{
                    padding: '5px 10px', borderRadius: 20,
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-dim)'}`,
                    background: isActive ? 'var(--bg-glass)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 5,
                    fontWeight: isActive ? 'bold' : 'normal'
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {id}
                  {isLive && <span style={{ fontSize: 7, color: isDark ? '#39ff14' : '#059669', fontWeight: 700 }}>HW</span>}
                </button>
              );
            })
          ) : (
            ['GW-001', 'ESP32-A', 'ESP32-B', 'ESP32-C', 'ESP32-D'].map(id => {
              const status = 'healthy';
              const color  = getStatusColor(status, isDark);
              const isActive = activeNodeId === id;
              return (
                <button key={id} onClick={() => setActiveNodeId(id)}
                  style={{
                    padding: '5px 10px', borderRadius: 20,
                    border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border-dim)'}`,
                    background: isActive ? 'var(--bg-glass)' : 'transparent',
                    color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    cursor: 'pointer', fontFamily: 'Share Tech Mono, monospace', fontSize: 10,
                    transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 5,
                    fontWeight: isActive ? 'bold' : 'normal'
                  }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block' }} />
                  {id}
                </button>
              );
            })
          )}
        </div>
        {(() => {
          const selNode = nodes.find(n => n.nodeId === activeNodeId);
          if (!selNode) return null;
          const color = getStatusColor(selNode.status, isDark);
          return (
            <div style={{
              marginTop: 8, padding: '4px 8px', borderRadius: 4,
              background: `${color}12`, border: `1px solid ${color}30`,
              fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color,
              fontWeight: 'bold'
            }}>
              Status: {selNode.status.toUpperCase()} | Latency: {(selNode.latency || 0).toFixed(0)}ms | CPU: {(selNode.cpuUsage || 0).toFixed(0)}%
              {selNode.mode === 'live' && ' | MODE: LIVE'}
            </div>
          );
        })()}
      </div>

      {/* Keyboard shortcuts hint */}
      <div style={{ padding: '6px 10px', borderRadius: 6, background: 'var(--surface-sunken)', border: '1px solid var(--border-dim)' }}>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: 'var(--text-muted)', display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <span><b style={{ color: 'var(--accent)' }}>F</b> Fail</span>
          <span><b style={{ color: 'var(--accent)' }}>R</b> Recover</span>
          <span><b style={{ color: 'var(--accent)' }}>A</b> Attack</span>
          <span><b style={{ color: 'var(--accent)' }}>O</b> Optimize</span>
          <span><b style={{ color: 'var(--accent)' }}>D</b> Demo</span>
        </div>
      </div>

      {/* Simulation buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {SIMULATIONS.map(sim => {
          const Icon      = sim.icon;
          const isRunning = runningId === sim.id;
          const displayColor = getThemeColor(sim.color, isDark);

          return (
            <motion.button key={sim.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => runSimulation(sim)} disabled={!!runningId}
              style={{
                padding: '12px 14px', borderRadius: 10,
                border: `1px solid ${isRunning ? displayColor : `${displayColor}${isDark ? '40' : '65'}`}`,
                background: isRunning ? `${displayColor}20` : `${displayColor}08`,
                cursor: runningId ? 'not-allowed' : 'pointer', textAlign: 'left',
                transition: 'all 0.2s', opacity: runningId && !isRunning ? 0.5 : 1,
                boxShadow: isRunning && isDark ? `0 0 20px ${displayColor}50` : 'none',
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                {isRunning ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: 'linear' }}>
                    <RotateCcw size={13} color={displayColor} />
                  </motion.div>
                ) : (
                  <Icon size={13} color={displayColor} />
                )}
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, fontWeight: 700, color: displayColor, letterSpacing: '0.04em' }}>
                  {sim.label}
                </span>
              </div>
              <p style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'Share Tech Mono, monospace', lineHeight: 1.4, margin: 0 }}>
                {sim.description}
              </p>
              {sim.nodeRequired && (
                <div style={{ marginTop: 5, fontSize: 8, color: displayColor, fontFamily: 'Share Tech Mono, monospace', fontWeight: 'bold' }}>
                  → {activeNodeId}
                </div>
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Recent runs */}
      <AnimatePresence>
        {recentRuns.length > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            className="glass-card" style={{ padding: 14 }}>
            <div style={{ fontSize: 9, color: 'var(--text-heading)', opacity: 0.7, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 8 }}>
              SIMULATION HISTORY
            </div>
            {recentRuns.map((run, i) => {
              const runColor = getThemeColor(run.color, isDark);
              return (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid var(--border-subtle)', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: runColor, display: 'block' }} />
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-primary)' }}>{run.sim}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--accent)', fontWeight: 'bold' }}>{run.nodeId}</span>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>{run.timestamp}</span>
                  </div>
                </div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
