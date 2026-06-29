import React from 'react';
import { motion } from 'framer-motion';
import useMeshStore from '../../store/meshStore';
import { Brain, AlertTriangle, ShieldCheck } from 'lucide-react';
import { getSocket } from '../../lib/socket';
import { useTheme } from '../../lib/ThemeContext';

export default function PredictionCard() {
  const predictions = useMeshStore(state => state.predictions) || [];
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const highestRiskNode = predictions.length > 0
    ? [...predictions].sort((a, b) => b.riskScore - a.riskScore)[0]
    : null;

  const triggerProactiveReroute = (nodeId) => {
    const socket = getSocket();
    socket.emit('simulation:fail-node', { nodeId, reason: 'AI Proactive Preemptive Isolation' });
  };

  if (!highestRiskNode) {
    return (
      <div className="glass-card" style={{
        padding: '1.5rem',
        textAlign: 'center',
        borderColor: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(8,145,178,0.1)',
      }}>
        <Brain size={24} style={{ margin: '0 auto 0.5rem', opacity: 0.4, color: 'var(--accent)' }} />
        <div style={{ color: 'var(--text-muted)', fontFamily: "'Share Tech Mono', monospace", fontSize: 12 }}>
          Predictive AI Model Syncing...
        </div>
      </div>
    );
  }

  const isHighRisk = highestRiskNode.riskScore > 50;
  const isCritical = highestRiskNode.riskScore > 75;

  let riskColor = isDark ? '#22d3ee' : '#0ea5e9';
  if (isCritical) riskColor = isDark ? '#f43f5e' : '#be123c';
  else if (isHighRisk) riskColor = isDark ? '#fbbf24' : '#d97706';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card"
      style={{
        padding: '18px',
        position: 'relative',
        overflow: 'hidden',
        borderColor: isHighRisk ? `${riskColor}25` : 'rgba(0,212,255,0.1)',
        boxShadow: isHighRisk && isDark ? `0 0 30px ${riskColor}10` : undefined,
      }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${riskColor}50, transparent)`,
      }} />

      {/* Pulse overlay for critical */}
      {isCritical && (
        <motion.div
          animate={{ opacity: [0, 0.03, 0] }}
          transition={{ repeat: Infinity, duration: 2 }}
          style={{
            position: 'absolute', inset: 0,
            background: riskColor, borderRadius: 'inherit',
            pointerEvents: 'none',
          }}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--bg-glass)',
            border: '1px solid var(--border-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Brain size={16} color="var(--accent)" />
          </div>
          <span style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: 11,
            color: 'var(--text-heading)', letterSpacing: '1px',
            textShadow: isDark ? '0 0 8px rgba(0,212,255,0.3)' : 'none',
            fontWeight: 'bold'
          }}>
            PREDICTIVE RISK
          </span>
        </div>
        <div style={{
          background: `${riskColor}12`,
          color: riskColor,
          padding: '4px 10px',
          borderRadius: 6,
          fontSize: 11,
          fontFamily: "'Orbitron', monospace",
          fontWeight: 700,
          border: `1px solid ${riskColor}30`,
        }}>
          {highestRiskNode.riskScore}% RISK
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
        {isHighRisk ? (
          <AlertTriangle size={34} color={riskColor} style={{ marginTop: 2, flexShrink: 0 }} />
        ) : (
          <ShieldCheck size={34} color={riskColor} style={{ marginTop: 2, flexShrink: 0 }} />
        )}

        <div style={{ flexGrow: 1, fontFamily: "'Share Tech Mono', monospace" }}>
          <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--text-primary)', fontWeight: 'bold' }}>
            {highestRiskNode.label || highestRiskNode.nodeId}
          </h4>
          <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Status: <span style={{ color: highestRiskNode.status === 'failed' ? (isDark ? '#f43f5e' : '#be123c') : (isDark ? '#22d3ee' : '#0ea5e9'), fontWeight: 'bold' }}>
              {highestRiskNode.status.toUpperCase()}
            </span>
          </p>
          <p style={{ margin: '4px 0', fontSize: 12, color: 'var(--text-secondary)' }}>
            Trend: <span style={{
              color: highestRiskNode.trendDirection === 'degrading' ? (isDark ? '#f43f5e' : '#be123c') : (isDark ? '#22d3ee' : '#0ea5e9'),
              fontWeight: 'bold',
            }}>
              {highestRiskNode.trendDirection.toUpperCase()}
            </span>
          </p>

          {highestRiskNode.predictedFailureTime ? (
            <div style={{ marginTop: 10, borderTop: '1px solid var(--border-dim)', paddingTop: 10 }}>
              <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em' }}>
                EST. TIME TO FAILURE
              </span>
              <div style={{
                fontSize: '1.1rem', fontWeight: 'bold', marginTop: 2,
                color: riskColor
              }}>
                ~ {new Date(highestRiskNode.predictedFailureTime).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
              </div>

              {highestRiskNode.status !== 'failed' && highestRiskNode.riskScore > 60 && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => triggerProactiveReroute(highestRiskNode.nodeId)}
                  style={{
                    marginTop: 10, width: '100%', padding: '8px',
                    background: isDark ? 'rgba(244, 63, 94, 0.06)' : 'rgba(190, 18, 60, 0.05)',
                    border: `1px solid ${isDark ? 'rgba(244,63,94,0.25)' : 'rgba(190,18,60,0.3)'}`,
                    color: isDark ? '#fb7185' : '#be123c', fontSize: 10,
                    textTransform: 'uppercase', cursor: 'pointer',
                    letterSpacing: '0.08em', fontFamily: 'Orbitron, monospace',
                    fontWeight: 'bold', borderRadius: 8,
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => e.target.style.background = isDark ? 'rgba(244, 63, 94, 0.12)' : 'rgba(190, 18, 60, 0.12)'}
                  onMouseLeave={e => e.target.style.background = isDark ? 'rgba(244, 63, 94, 0.06)' : 'rgba(190, 18, 60, 0.05)'}
                >
                  Proactive Isolation
                </motion.button>
              )}
            </div>
          ) : (
            <p style={{ margin: '10px 0 0', fontSize: 12, color: isDark ? '#22d3ee' : '#059669', fontWeight: 'bold' }}>
              ✓ All Node Telemetry Within Safe Range
            </p>
          )}
        </div>
      </div>
    </motion.div>
  );
}
