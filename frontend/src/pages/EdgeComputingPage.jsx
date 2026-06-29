/**
 * EdgeComputingPage — Distributed Edge Computing Dashboard
 */

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { 
  Cpu, Zap, Play, CheckCircle, ArrowRight, Server, Shield, Activity, RefreshCw
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function EdgeComputingPage() {
  const socket = getSocket();
  const { nodes, edgeTasks } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [selectedNode, setSelectedNode] = useState('');
  const [selectedType, setSelectedType] = useState('ML Inference');
  const [capacity, setCapacity] = useState(6);
  const [solvedResult, setSolvedResult] = useState(null);

  const handleSolve = () => {
    fetch('/api/scheduling/solve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: [
          { id: 't1', name: 'ML Inference', weight: 3, value: 30 },
          { id: 't2', name: 'Sensor Crypto', weight: 2, value: 20 },
          { id: 't3', name: 'Video Compress', weight: 4, value: 40 },
          { id: 't4', name: 'Thermal Check', weight: 1, value: 15 }
        ],
        capacity
      })
    })
    .then(res => res.json())
    .then(res => {
      if (res.success) {
        setSolvedResult(res.data);
      }
    })
    .catch(err => console.error("Error solving DP", err));
  };

  useEffect(() => {
    socket.emit('edge:request-state');
  }, []);

  useEffect(() => {
    const healthy = nodes.filter(n => !n.isGateway && n.status === 'healthy');
    if (healthy.length > 0 && (!selectedNode || !healthy.some(n => n.nodeId === selectedNode))) {
      setSelectedNode(healthy[0].nodeId);
    }
  }, [nodes, selectedNode]);

  const handleCreateTask = () => {
    if (!selectedNode) return;
    socket.emit('edge:task:create', { nodeId: selectedNode, type: selectedType });
  };

  // Helper to color tasks based on status
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return isDark ? '#39ff14' : '#059669';
      case 'executing': return isDark ? '#00f5ff' : '#0891b2';
      case 'offloaded': return isDark ? '#ffea00' : '#d97706';
      default: return 'var(--text-muted)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      
      {/* Page Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em', marginBottom: 4 }}>
            DISTRIBUTED EDGE COMPUTING
          </div>
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 14, color: 'var(--text-secondary)' }}>
            Dynamic Task Scheduling & Neighbor Offload Engine
          </div>
        </div>
        <button 
          onClick={() => socket.emit('edge:request-state')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: 0.7, outline: 'none' }}
        >
          <RefreshCw size={14} className="hover-spin" />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 16 }}>
        
        {/* Left Column: Task Queue & Visual Paths */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Active Edge Jobs Queue */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={14} color="var(--accent)" />
              ACTIVE MESH JOB QUEUE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {edgeTasks.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
                  No active edge computing tasks in queue.
                </div>
              ) : (
                edgeTasks.map((task) => (
                  <div 
                    key={task.id} 
                    style={{ 
                      padding: 14, 
                      borderRadius: 8, 
                      background: 'var(--bg-glass)',
                      border: '1px solid var(--border-dim)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                          {task.name}
                        </span>
                        <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, background: 'var(--cyan-pale)', padding: '2px 6px', borderRadius: 4, color: 'var(--cyan)', fontWeight: 'bold' }}>
                          {task.id}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: getStatusColor(task.status), textTransform: 'uppercase', fontWeight: 'bold' }}>
                        {task.status}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)' }}>
                        <span>Progress</span>
                        <span>{task.progress}%</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                        <motion.div 
                          animate={{ width: `${task.progress}%` }}
                          transition={{ duration: 0.5 }}
                          style={{ height: '100%', background: getStatusColor(task.status), boxShadow: isDark ? `0 0 8px ${getStatusColor(task.status)}` : 'none' }}
                        />
                      </div>
                    </div>

                    {/* Hops/Path */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 10, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-secondary)' }}>
                      <div>
                        Origin: <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>{task.origin}</span>
                      </div>
                      {task.status === 'offloaded' && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <span>Path:</span>
                          {task.path.map((nodeId, idx) => (
                            <span key={idx} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                              <span style={{ color: nodeId === task.executor ? (isDark ? '#39ff14' : '#059669') : 'var(--text-primary)', fontWeight: nodeId === task.executor ? 'bold' : 'normal' }}>{nodeId}</span>
                              {idx < task.path.length - 1 && <ArrowRight size={8} />}
                            </span>
                          ))}
                        </div>
                      )}
                      <div>
                        Executor: <span style={{ color: task.executor === task.origin ? 'var(--accent)' : (isDark ? '#39ff14' : '#059669'), fontWeight: 'bold' }}>{task.executor}</span>
                      </div>
                    </div>
                    
                    {task.message && (
                      <div style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: isDark ? '#ffea00' : '#d97706', borderTop: '1px solid var(--border-dim)', paddingTop: 6 }}>
                        💡 {task.message}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* DAA Knapsack DP Scheduler Card */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: isDark ? '#39ff14' : '#059669', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={14} color={isDark ? '#39ff14' : '#059669'} />
              DAA DYNAMIC PROGRAMMING SCHEDULER (0/1 KNAPSACK)
            </div>

            <div style={{ fontSize: 11, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-secondary)', marginBottom: 16 }}>
              Optimizes job combinations within a node's limited CPU capacity (Knapsack) to maximize priority execution value.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
              {/* Task configuration */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 10, fontFamily: 'Orbitron, monospace', color: 'var(--text-muted)' }}>TASK POOL</span>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: 'Share Tech Mono, monospace' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-dim)', textAlign: 'left', color: 'var(--text-muted)' }}>
                      <th style={{ paddingBottom: 6 }}>Job Name</th>
                      <th style={{ paddingBottom: 6 }}>CPU % (Wt)</th>
                      <th style={{ paddingBottom: 6 }}>Priority (Val)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { name: 'ML Inference', weight: 3, value: 30 },
                      { name: 'Sensor Crypto', weight: 2, value: 20 },
                      { name: 'Video Compress', weight: 4, value: 40 },
                      { name: 'Thermal Check', weight: 1, value: 15 }
                    ].map((t, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        <td style={{ padding: '6px 0', color: 'var(--text-primary)' }}>{t.name}</td>
                        <td style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{t.weight}0%</td>
                        <td style={{ color: isDark ? '#ffea00' : '#d97706', fontWeight: 'bold' }}>{t.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Capacity Slider & Run */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, justifyContent: 'center' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, fontFamily: 'Orbitron, monospace', color: 'var(--text-muted)' }}>
                    <span>NODE CPU LIMIT (CAPACITY)</span>
                    <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{capacity}0%</span>
                  </div>
                  <input 
                    type="range" 
                    min="2" 
                    max="8" 
                    value={capacity} 
                    onChange={(e) => {
                      setCapacity(parseInt(e.target.value));
                      setSolvedResult(null);
                    }}
                    style={{ width: '100%', accentColor: 'var(--cyan)', cursor: 'pointer' }}
                  />
                </div>

                <button
                  onClick={handleSolve}
                  style={{
                    background: isDark ? 'rgba(57,255,20,0.1)' : 'rgba(5,150,105,0.08)',
                    border: `1px solid ${isDark ? '#39ff14' : '#059669'}`,
                    borderRadius: 6,
                    color: isDark ? '#39ff14' : '#059669',
                    fontFamily: 'Orbitron, monospace',
                    fontSize: 10,
                    fontWeight: 'bold',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    outline: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    transition: 'all 0.2s',
                    boxShadow: isDark ? '0 0 10px rgba(57,255,20,0.05)' : 'none'
                  }}
                >
                  <Zap size={12} />
                  SOLVE DYNAMIC PROGRAMMING
                </button>
              </div>
            </div>

            {solvedResult && (
              <div style={{ marginTop: 16, borderTop: '1px solid var(--border-dim)', paddingTop: 16 }}>
                {/* DP Solver Stats */}
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'Share Tech Mono, monospace', fontSize: 11, marginBottom: 12 }}>
                  <div>
                    OPTIMAL TOTAL PRIORITY VALUE: <span style={{ color: isDark ? '#39ff14' : '#059669', fontWeight: 'bold' }}>{solvedResult.optimalValue}</span>
                  </div>
                  <div>
                    SELECTED JOBS: <span style={{ color: 'var(--cyan)', fontWeight: 'bold' }}>{solvedResult.selectedTasks.map(t => t.name).join(', ')}</span>
                  </div>
                </div>

                {/* Live DP Table Grid */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={{ fontSize: 9, fontFamily: 'Orbitron, monospace', color: 'var(--text-muted)' }}>DYNAMIC PROGRAMMING STATE MATRIX</span>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', margin: '0 auto' }}>
                      <thead>
                        <tr>
                          <th style={{ padding: 4, fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-muted)', border: '1px solid var(--border-dim)' }}>Item \ W</th>
                          {Array.from({ length: capacity + 1 }).map((_, w) => (
                            <th key={w} style={{ width: 28, padding: 4, fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-primary)', border: '1px solid var(--border-dim)', textAlign: 'center' }}>
                              {w}0%
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {solvedResult.dpTable.map((row, i) => {
                          const itemLabel = i === 0 ? 'Base (0)' : solvedResult.tasks[i - 1].name.split(' ')[0];
                          return (
                            <tr key={i}>
                              <td style={{ padding: '4px 8px', fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: 'var(--text-secondary)', border: '1px solid var(--border-dim)', whiteSpace: 'nowrap' }}>
                                {itemLabel}
                              </td>
                              {row.map((val, w) => {
                                // Determine backtrack highlighting
                                let isSelected = false;
                                let remainingW = capacity;
                                for (let itemIdx = solvedResult.tasks.length; itemIdx > 0; itemIdx--) {
                                  if (solvedResult.dpTable[itemIdx][remainingW] !== solvedResult.dpTable[itemIdx - 1][remainingW]) {
                                    if (i === itemIdx && w === remainingW) {
                                      isSelected = true;
                                    }
                                    remainingW -= solvedResult.tasks[itemIdx - 1].weight;
                                  }
                                }

                                return (
                                  <td 
                                    key={w} 
                                    style={{ 
                                      padding: '4px 0', 
                                      fontSize: 10, 
                                      fontFamily: 'Share Tech Mono, monospace', 
                                      border: '1px solid var(--border-dim)',
                                      textAlign: 'center',
                                      background: isSelected ? (isDark ? 'rgba(57,255,20,0.15)' : 'rgba(5,150,105,0.12)') : 'none',
                                      color: isSelected ? (isDark ? '#39ff14' : '#059669') : 'var(--text-secondary)',
                                      fontWeight: isSelected ? 'bold' : 'normal'
                                    }}
                                  >
                                    {val}
                                  </td>
                                );
                              })}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: isDark ? '#39ff14' : '#059669', textAlign: 'center', marginTop: 4 }}>
                    🟢 Highlighted cells represent the optimal Knapsack backtracking path
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Node CPU Loads & Manual Dispatcher */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          
          {/* Dispatcher */}
          <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={14} color="var(--accent)" />
              JOB INJECTION CONSOLE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>TARGET INJECTION NODE:</label>
                <select
                  value={selectedNode}
                  onChange={(e) => setSelectedNode(e.target.value)}
                  disabled={nodes.filter(n => !n.isGateway && n.status === 'healthy').length === 0}
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: 11,
                    padding: '8px 12px',
                    outline: 'none',
                    cursor: nodes.filter(n => !n.isGateway && n.status === 'healthy').length > 0 ? 'pointer' : 'not-allowed'
                  }}
                >
                  {nodes.filter(n => !n.isGateway && n.status === 'healthy').length === 0 ? (
                    <option value="">NO ONLINE MESH NODES</option>
                  ) : (
                    nodes
                      .filter(n => !n.isGateway && n.status === 'healthy')
                      .map(n => (
                        <option key={n.nodeId} value={n.nodeId} style={{ background: 'var(--select-option-bg)' }}>
                          {n.label || n.nodeId} (CPU: {n.cpuUsage?.toFixed(0)}%)
                        </option>
                      ))
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>JOB COMPUTATION TYPE:</label>
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  style={{
                    background: 'var(--input-bg)',
                    border: '1px solid var(--border-bright)',
                    borderRadius: 6,
                    color: 'var(--text-primary)',
                    fontFamily: 'Share Tech Mono, monospace',
                    fontSize: 11,
                    padding: '8px 12px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="ML Inference" style={{ background: 'var(--select-option-bg)' }}>ML INFERENCE ENGINE</option>
                  <option value="Sensor Cryptography" style={{ background: 'var(--select-option-bg)' }}>CRYPTOGRAPHIC ENCRYPTION</option>
                  <option value="Anomaly Scanning" style={{ background: 'var(--select-option-bg)' }}>ANOMALY SCANNING ALGORITHM</option>
                  <option value="Climate Data Compression" style={{ background: 'var(--select-option-bg)' }}>CLIMATE DATA COMPRESSION</option>
                </select>
              </div>

              <button
                onClick={handleCreateTask}
                disabled={!selectedNode}
                style={{
                  background: selectedNode ? 'var(--bg-glass)' : 'rgba(255,255,255,0.02)',
                  border: selectedNode ? '1px solid var(--border-bright)' : '1px solid var(--border-dim)',
                  borderRadius: 6,
                  color: selectedNode ? 'var(--accent)' : 'var(--text-muted)',
                  fontFamily: 'Orbitron, monospace',
                  fontSize: 10,
                  fontWeight: 'bold',
                  padding: '10px 16px',
                  cursor: selectedNode ? 'pointer' : 'default',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  outline: 'none',
                  transition: 'all 0.2s',
                  marginTop: 10
                }}
              >
                <Play size={12} />
                INJECT COMPUTE JOB
              </button>
            </div>
          </div>

          {/* Node CPU Loads list */}
          <div className="glass-card" style={{ padding: 20 }}>
            <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.08em', marginBottom: 16 }}>
              NODE RESOURCE LOADS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {nodes
                .filter(n => !n.isGateway)
                .map(n => {
                  const cpu = n.cpuUsage || 0;
                  const color = cpu > 80 ? (isDark ? '#ff073a' : '#e11d48') : cpu > 50 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669');
                  return (
                    <div key={n.nodeId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                        <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{n.label || n.nodeId}</span>
                        <span style={{ color }}>{cpu.toFixed(0)}% CPU</span>
                      </div>
                      <div style={{ height: 6, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                        <div style={{ width: `${cpu}%`, height: '100%', background: color, boxShadow: isDark ? `0 0 6px ${color}` : 'none' }} />
                      </div>
                    </div>
                  );
                })
              }
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
