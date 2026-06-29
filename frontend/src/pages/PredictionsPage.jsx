import React, { useState } from 'react';
import useMeshStore from '../store/meshStore';
import { Brain, AlertTriangle, ShieldCheck, Activity, TrendingUp, TrendingDown, Hourglass } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import { useTheme } from '../lib/ThemeContext';

export default function PredictionsPage() {
  const predictions = useMeshStore(state => state.predictions) || [];
  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const socket = getSocket();

  const handleProactiveReroute = (nodeId) => {
    socket.emit('simulation:fail-node', { nodeId, reason: 'AI Predictive Preemptive Isolation' });
  };

  const activePrediction = predictions.find(p => p.nodeId === selectedNodeId) || predictions[0];

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem',
      padding: '1.5rem',
      background: 'var(--bg-0)',
      minHeight: 'calc(100vh - 80px)',
      boxSizing: 'border-box',
      color: 'var(--text-primary)',
      fontFamily: "'Share Tech Mono', monospace"
    }}>
      {/* Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
        <Brain size={28} color="var(--accent)" />
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Predictive Anomaly Detection
        </h2>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 2fr',
        gap: '1.5rem',
      }}>
        {/* Left Side: Risk Ranking list */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          height: 'fit-content'
        }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: 0, borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.6rem' }}>
            NODE RISK ASSESSMENT
          </h3>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem' }}>
            {predictions.map(pred => {
              const isSelected = activePrediction?.nodeId === pred.nodeId;
              const isHigh = pred.riskScore > 50;
              const isCritical = pred.riskScore > 75;
              const color = isCritical ? (isDark ? '#ff073a' : '#e11d48') : isHigh ? (isDark ? '#ffaa00' : '#d97706') : (isDark ? '#39ff14' : '#059669');

              return (
                <div
                  key={pred.nodeId}
                  onClick={() => setSelectedNodeId(pred.nodeId)}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '0.8rem 1rem',
                    background: isSelected ? 'var(--bg-glass)' : 'var(--surface-sunken)',
                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-dim)'}`,
                    borderRadius: '3px',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  className="hover-card-glow"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                    {isHigh ? <AlertTriangle size={16} color={color} /> : <ShieldCheck size={16} color={color} />}
                    <span style={{ fontSize: '0.95rem', fontWeight: 'bold' }}>{pred.label || pred.nodeId}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
                    <span style={{
                      fontSize: '0.75rem',
                      color: pred.trendDirection === 'degrading' ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669'),
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.2rem',
                      fontWeight: 'bold'
                    }}>
                      {pred.trendDirection === 'degrading' ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {pred.trendDirection.toUpperCase()}
                    </span>

                    <span style={{ color, fontWeight: 'bold', fontSize: '1rem' }}>
                      {pred.riskScore}%
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Detailed analysis panel */}
        {activePrediction && (
          <div style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-bright)',
            borderRadius: '4px',
            padding: '1.5rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.2rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-dim)', paddingBottom: '1rem' }}>
              <div>
                <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.3rem', color: 'var(--accent)', margin: 0 }}>
                  {activePrediction.label || activePrediction.nodeId} DIAGNOSTIC REPORT
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  LAST SYNCED: {new Date(activePrediction.updatedAt).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </span>
              </div>

              {activePrediction.status !== 'failed' && activePrediction.riskScore > 50 && (
                <button
                  onClick={() => handleProactiveReroute(activePrediction.nodeId)}
                  style={{
                    padding: '0.5rem 1rem',
                    background: 'rgba(255, 7, 58, 0.08)',
                    border: '1px solid var(--accent-red)',
                    color: 'var(--accent-red)',
                    fontSize: '0.85rem',
                    textTransform: 'uppercase',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    letterSpacing: '1px',
                    boxShadow: isDark ? '0 0 10px rgba(255, 7, 58, 0.1)' : 'none',
                    transition: 'all 0.3s ease',
                  }}
                  onMouseEnter={e => e.target.style.background = 'rgba(255, 7, 58, 0.15)'}
                  onMouseLeave={e => e.target.style.background = 'rgba(255, 7, 58, 0.08)'}
                >
                  Isolate Node Preemptively
                </button>
              )}
            </div>

            {/* Quick Metrics */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '1rem' }}>
              <div style={{ background: 'var(--surface-sunken)', padding: '0.8rem', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <Activity size={14} />
                  COMPOSITE RISK INDEX
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: activePrediction.riskScore > 50 ? (isDark ? '#ffaa00' : '#d97706') : (isDark ? '#39ff14' : '#059669') }}>
                  {activePrediction.riskScore} / 100
                </div>
              </div>

              <div style={{ background: 'var(--surface-sunken)', padding: '0.8rem', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <TrendingUp size={14} />
                  HEALTH TRAJECTORY
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: activePrediction.trendDirection === 'degrading' ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669'), textTransform: 'uppercase', marginTop: '0.2rem' }}>
                  {activePrediction.trendDirection}
                </div>
              </div>

              <div style={{ background: 'var(--surface-sunken)', padding: '0.8rem', borderRadius: '3px', border: '1px solid var(--border-dim)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-muted)', fontSize: '0.75rem', marginBottom: '0.2rem' }}>
                  <Hourglass size={14} />
                  FAILURE TIMELINE (EST)
                </div>
                <div style={{ fontSize: '1.2rem', fontWeight: 'bold', color: activePrediction.predictedFailureTime ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669'), marginTop: '0.2rem' }}>
                  {activePrediction.predictedFailureTime 
                    ? `~ ${new Date(activePrediction.predictedFailureTime).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}`
                    : 'NOMINAL / STABLE'
                  }
                </div>
              </div>
            </div>

            {/* Metric Parameter Breakdown */}
            <div>
              <h4 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '0.9rem', color: 'var(--accent)', margin: '0 0 0.8rem 0' }}>
                AI ANOMALY SIGNALS AND RAW PROJECTIONS
              </h4>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
                {Object.entries(activePrediction.metrics).map(([name, m]) => {
                  const hasAnomaly = m.zScore > 2.0;
                  const isNearDanger = m.current / m.threshold > 0.85;
                  let color = isDark ? '#39ff14' : '#059669';
                  if (hasAnomaly) {
                    color = isDark ? '#ff073a' : '#e11d48';
                  } else if (isNearDanger) {
                    color = isDark ? '#ffaa00' : '#d97706';
                  }

                  return (
                    <div
                      key={name}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.6rem 0.8rem',
                        background: 'var(--surface-sunken)',
                        borderLeft: `3px solid ${color}`,
                        borderRadius: '0 3px 3px 0',
                        borderTop: '1px solid var(--border-dim)',
                        borderRight: '1px solid var(--border-dim)',
                        borderBottom: '1px solid var(--border-dim)'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', textTransform: 'capitalize', fontWeight: 'bold' }}>{name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          EWMA: {m.ewma} | Z-Score: {m.zScore.toFixed(2)} | Threshold: {m.threshold}
                        </span>
                      </div>

                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 'bold', color }}>
                          {m.current}
                        </div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                          {m.ttf !== null ? `TTF: ~ ${m.ttf}s` : 'TTF: N/A'}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
