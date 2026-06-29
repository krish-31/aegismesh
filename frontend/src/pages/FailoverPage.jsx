/**
 * FailoverPage v2 — Visual failover analytics with route comparison diagrams
 *
 * Enhancements:
 * - Mini route visualization diagrams (old vs new path)
 * - Active rerouting animation
 * - Failover timeline with visual progression
 * - Dijkstra path table
 * - Route health indicators
 * - Network prediction widget
 */

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SimulationPanel from '../components/failover/SimulationPanel';
import EventConsole from '../components/events/EventConsole';
import useMeshStore from '../store/meshStore';
import { ArrowRight, AlertTriangle, CheckCircle, XCircle, TrendingUp, Activity, Zap, Shield } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function FailoverPage() {
  const { nodes, edges, stats, failoverActive } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [failoverHistory, setFailoverHistory] = useState([]);
  const [predictions, setPredictions] = useState([]);

  useEffect(() => {
    fetch('/api/failover-logs')
      .then(r => r.json())
      .then(d => setFailoverHistory(d.data || []))
      .catch(() => {});
  }, [failoverActive]);

  // Generate lightweight predictions from anomaly scores & latency
  useEffect(() => {
    const preds = nodes
      .filter(n => n.status !== 'gateway')
      .map(n => {
        const latencyRisk = Math.min(40, (n.latency || 0) / 5);
        const cpuRisk     = Math.min(30, (n.cpuUsage || 0) / 3);
        const anomalyRisk = Math.min(30, (n.anomalyScore || 0) / 3);
        const risk        = Math.min(100, latencyRisk + cpuRisk + anomalyRisk);
        return { nodeId: n.nodeId, label: n.label, risk, status: n.status, latency: n.latency, cpuUsage: n.cpuUsage };
      })
      .sort((a, b) => b.risk - a.risk);
    setPredictions(preds);
  }, [nodes]);

  // Dijkstra path table
  const pathTable = useMemo(() => {
    const gw = nodes.find(n => n.isGateway || n.status === 'gateway');
    if (!gw) return [];
    return nodes
      .filter(n => n.nodeId !== gw?.nodeId)
      .map(n => ({
        target:  n.nodeId,
        label:   n.label,
        route:   n.activeRoute || [],
        hops:    n.activeRoute ? n.activeRoute.length - 1 : 0,
        latency: n.latency,
        status:  n.status,
      }));
  }, [nodes]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em' }}>
        FAILOVER ANALYTICS & NETWORK INTELLIGENCE
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16 }}>
        {/* Left: Analytics */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Node health bars */}
          <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 16 }}>
              NODE HEALTH DISTRIBUTION
            </div>
            {nodes.map(node => {
              const pct   = node.status === 'healthy' || node.status === 'gateway' ? 100 : node.status === 'unstable' ? 50 : 0;
              const color = pct === 100 ? (isDark ? '#39ff14' : '#059669') : pct === 50 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#ff073a' : '#e11d48');
              return (
                <div key={node.nodeId} style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: color, boxShadow: isDark ? `0 0 4px ${color}` : 'none', animation: pct === 100 ? 'breathe 3s ease-in-out infinite' : pct === 50 ? 'yellow-flicker 1.5s ease-in-out infinite' : 'red-blink 0.8s ease-in-out infinite' }} />
                      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                        {node.label || node.nodeId}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 12 }}>
                      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>
                        {(node.latency || 0).toFixed(0)}ms
                      </span>
                      <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color, fontWeight: 'bold' }}>{pct}%</span>
                    </div>
                  </div>
                  <div style={{ height: 4, background: 'var(--surface-sunken)', borderRadius: 3, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                    <motion.div
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8 }}
                      style={{ height: '100%', background: `linear-gradient(90deg, ${color}, ${color}80)`, borderRadius: 3, boxShadow: isDark ? `0 0 6px ${color}` : 'none' }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Dijkstra Routing Table */}
          <div className="glass-card glass-card-purple" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--accent-secondary)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Activity size={11} color="var(--accent-secondary)" />
              DIJKSTRA ROUTING TABLE
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr 60px 70px', gap: '4px 12px', fontSize: 9, fontFamily: 'Share Tech Mono, monospace' }}>
              <span style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>TARGET</span>
              <span style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>ROUTE</span>
              <span style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>HOPS</span>
              <span style={{ color: 'var(--text-muted)', letterSpacing: '0.1em' }}>LATENCY</span>
              {pathTable.map(row => (
                <React.Fragment key={row.target}>
                  <span style={{ color: row.status === 'failed' ? (isDark ? '#ff073a' : '#e11d48') : 'var(--text-primary)', padding: '4px 0', fontWeight: 'bold' }}>
                    {row.label || row.target}
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 0', flexWrap: 'wrap' }}>
                    {row.route.length > 0 ? row.route.map((hop, j) => (
                      <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ color: hop === row.target ? 'var(--accent-secondary)' : 'var(--accent)', fontSize: 9, fontWeight: 'bold' }}>{hop}</span>
                        {j < row.route.length - 1 && <ArrowRight size={8} color="var(--text-muted)" />}
                      </span>
                    )) : (
                      <span style={{ color: isDark ? '#ff073a' : '#e11d48', fontSize: 9, fontWeight: 'bold' }}>NO PATH</span>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-secondary)', padding: '4px 0' }}>
                    {row.hops > 0 ? row.hops : '—'}
                  </span>
                  <span style={{ color: row.latency > 80 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669'), padding: '4px 0', fontWeight: 'bold' }}>
                    {row.latency ? `${row.latency.toFixed(0)}ms` : '—'}
                  </span>
                </React.Fragment>
              ))}
            </div>
          </div>

          {/* Failover History with route comparison */}
          <div className="glass-card glass-card-yellow" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: isDark ? '#ffea00' : '#d97706', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Zap size={11} color={isDark ? '#ffea00' : '#d97706'} />
              FAILOVER TIMELINE
            </div>
            {failoverHistory.length === 0 ? (
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: 20 }}>
                <Shield size={20} color={isDark ? 'rgba(57,255,20,0.3)' : 'rgba(5,150,105,0.4)'} style={{ margin: '0 auto 8px', display: 'block' }} />
                No failover events — all routes optimal
              </div>
            ) : (
              <AnimatePresence>
                {failoverHistory.map((log, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    style={{
                      padding: 14, marginBottom: 10, borderRadius: 8,
                      background: log.success ? (isDark ? 'rgba(57,255,20,0.04)' : 'rgba(5,150,105,0.04)') : 'rgba(255,7,58,0.06)',
                      border: `1px solid ${log.success ? (isDark ? 'rgba(57,255,20,0.15)' : 'rgba(5,150,105,0.25)') : 'rgba(255,7,58,0.2)'}`,
                    }}
                  >
                    {/* Header */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {log.success
                          ? <CheckCircle size={13} color={isDark ? '#39ff14' : '#059669'} />
                          : <XCircle size={13} color={isDark ? '#ff073a' : '#e11d48'} />
                        }
                        <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: log.success ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48'), fontWeight: 'bold' }}>
                          {log.failedNode} FAILOVER
                        </span>
                      </div>
                      <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>
                        {log.duration}ms | {new Date(log.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                      </span>
                    </div>

                    {/* Route comparison diagram */}
                    {log.oldRoute && log.newRoute && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 8 }}>
                        {/* Old route */}
                        <div style={{ padding: '8px 10px', borderRadius: 6, background: 'rgba(255,7,58,0.08)', border: '1px solid rgba(255,7,58,0.15)' }}>
                          <div style={{ fontSize: 7, color: isDark ? 'rgba(255,7,58,0.5)' : '#e11d48', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
                            OLD ROUTE ✗
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {log.oldRoute.map((hop, j) => {
                              const isFailed = hop === log.failedNode;
                              return (
                                <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                  <span style={{
                                    padding: '2px 6px', borderRadius: 4, fontSize: 9,
                                    fontFamily: 'Share Tech Mono, monospace',
                                    background: isFailed ? 'rgba(255,7,58,0.2)' : 'var(--bg-glass)',
                                    color: isFailed ? (isDark ? '#ff073a' : '#e11d48') : 'var(--accent)',
                                    border: `1px solid ${isFailed ? 'rgba(255,7,58,0.3)' : 'var(--border-dim)'}`,
                                    textDecoration: isFailed ? 'line-through' : 'none',
                                    fontWeight: 'bold'
                                  }}>
                                    {hop}
                                  </span>
                                  {j < log.oldRoute.length - 1 && <ArrowRight size={8} color="var(--text-muted)" />}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                        {/* New route */}
                        <div style={{ padding: '8px 10px', borderRadius: 6, background: isDark ? 'rgba(57,255,20,0.06)' : 'rgba(5,150,105,0.06)', border: `1px solid ${isDark ? 'rgba(57,255,20,0.15)' : 'rgba(5,150,105,0.25)'}` }}>
                          <div style={{ fontSize: 7, color: isDark ? 'rgba(57,255,20,0.5)' : '#059669', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 6 }}>
                            NEW ROUTE ✓
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                            {log.newRoute.map((hop, j) => (
                              <motion.span
                                key={j}
                                initial={{ opacity: 0, x: -5 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: j * 0.15 }}
                                style={{ display: 'flex', alignItems: 'center', gap: 3 }}
                              >
                                <span style={{
                                  padding: '2px 6px', borderRadius: 4, fontSize: 9,
                                  fontFamily: 'Share Tech Mono, monospace',
                                  background: isDark ? 'rgba(57,255,20,0.1)' : 'rgba(5,150,105,0.1)',
                                  color: isDark ? '#39ff14' : '#059669',
                                  border: `1px solid ${isDark ? 'rgba(57,255,20,0.2)' : 'rgba(5,150,105,0.3)'}`,
                                  fontWeight: 'bold'
                                }}>
                                  {hop}
                                </span>
                                {j < log.newRoute.length - 1 && (
                                  <motion.span
                                    animate={{ x: [0, 3, 0] }}
                                    transition={{ repeat: Infinity, duration: 1 }}
                                  >
                                    <ArrowRight size={8} color={isDark ? 'rgba(57,255,20,0.4)' : 'rgba(5,150,105,0.4)'} />
                                  </motion.span>
                                )}
                              </motion.span>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fallback text route display */}
                    {!log.oldRoute && log.newRoute && (
                      <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: isDark ? '#39ff14' : '#059669', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ color: 'var(--text-muted)' }}>New Route:</span>
                        {log.newRoute.map((hop, j) => (
                          <span key={j} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ color: isDark ? '#39ff14' : '#059669', fontWeight: 'bold' }}>{hop}</span>
                            {j < log.newRoute.length - 1 && <ArrowRight size={8} color="var(--text-muted)" />}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            )}
          </div>

          {/* Network Health Prediction */}
          <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
            <div style={{ fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
              <TrendingUp size={11} color="var(--text-heading)" />
              NETWORK HEALTH PREDICTION
            </div>
            {predictions.map(p => {
              const riskColor = p.risk > 60 ? (isDark ? '#ff073a' : '#e11d48') : p.risk > 30 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669');
              const riskLabel = p.risk > 60 ? 'HIGH RISK' : p.risk > 30 ? 'MODERATE' : 'STABLE';
              return (
                <div key={p.nodeId} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '8px 12px', marginBottom: 6, borderRadius: 6,
                  background: `${riskColor}08`,
                  border: `1px solid ${riskColor}20`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 7, height: 7, borderRadius: '50%',
                      background: riskColor, boxShadow: isDark ? `0 0 4px ${riskColor}` : 'none',
                    }} />
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--text-primary)', fontWeight: 'bold' }}>
                      {p.label}
                    </span>
                    <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>
                      CPU {(p.cpuUsage || 0).toFixed(0)}% | {(p.latency || 0).toFixed(0)}ms
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 50, height: 4, background: 'var(--surface-sunken)', borderRadius: 2, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                      <motion.div animate={{ width: `${p.risk}%` }} style={{ height: '100%', background: riskColor, borderRadius: 2 }} />
                    </div>
                    <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 9, color: riskColor, minWidth: 70, textAlign: 'right', fontWeight: 'bold' }}>
                      {riskLabel}
                    </span>
                  </div>
                </div>
              );
            })}
            {predictions.length > 0 && predictions[0].risk > 30 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  marginTop: 10, padding: '8px 12px', borderRadius: 6,
                  background: isDark ? 'rgba(255,234,0,0.06)' : 'rgba(217,119,6,0.08)',
                  border: `1px solid ${isDark ? 'rgba(255,234,0,0.15)' : 'rgba(217,119,6,0.25)'}`,
                  fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: isDark ? '#ffea00' : '#d97706',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                <AlertTriangle size={11} color={isDark ? '#ffea00' : '#d97706'} />
                {predictions[0].label} showing elevated risk indicators — monitor closely
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Simulation */}
        <div>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.12em', marginBottom: 10 }}>
            SIMULATION CONTROLS
          </div>
          <SimulationPanel />
        </div>
      </div>

      <EventConsole maxHeight={200} />
    </div>
  );
}
