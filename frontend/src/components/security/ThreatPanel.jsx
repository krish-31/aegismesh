import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useState } from 'react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid
} from 'recharts';
import useMeshStore from '../../store/meshStore';
import { Shield, AlertTriangle, Zap, Eye, Activity } from 'lucide-react';
import { useTheme } from '../../lib/ThemeContext';

const getThemeColor = (color, isDark) => {
  if (isDark) return color;
  const mapping = {
    '#39ff14': '#059669', // dark green
    '#ffea00': '#d97706', // dark amber
    '#f59e0b': '#c2410c', // dark orange
    '#00f5ff': '#0369a1', // dark sky-blue
    '#bf5af2': '#7e22ce', // dark purple
    '#ff073a': '#be123c', // dark rose
  };
  return mapping[color] || color;
};

function ThreatMeter({ value }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const baseColor = value > 70 ? '#ff073a' : value > 40 ? '#ffea00' : '#39ff14';
  const color = getThemeColor(baseColor, isDark);
  const label = value > 70 ? 'CRITICAL' : value > 40 ? 'ELEVATED' : 'LOW';

  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ position: 'relative', width: 140, height: 140, margin: '0 auto' }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          {/* Outer ring */}
          <circle cx="70" cy="70" r="62" fill="none" stroke="var(--border-dim)" strokeWidth="2" />
          {/* Danger zone arcs */}
          <circle cx="70" cy="70" r="54" fill="none" stroke={isDark ? "rgba(255,7,58,0.1)" : "rgba(225,29,72,0.1)"} strokeWidth="10" strokeDasharray="170 170" strokeDashoffset="0" strokeLinecap="round" style={{ transform: 'rotate(135deg)', transformOrigin: '70px 70px' }} />
          {/* Track */}
          <circle cx="70" cy="70" r="54" fill="none" stroke="var(--surface-sunken)" strokeWidth="10" strokeDasharray={`${2 * Math.PI * 54 * 0.75} ${2 * Math.PI * 54 * 0.25}`} strokeLinecap="round" style={{ transform: 'rotate(135deg)', transformOrigin: '70px 70px' }} />
          {/* Fill */}
          <motion.circle
            cx="70" cy="70" r="54"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeDasharray={`${2 * Math.PI * 54 * 0.75} ${2 * Math.PI * 54 * 0.25}`}
            strokeDashoffset={2 * Math.PI * 54 * 0.75 * (1 - value / 100)}
            strokeLinecap="round"
            style={{ transform: 'rotate(135deg)', transformOrigin: '70px 70px', filter: isDark ? `drop-shadow(0 0 8px ${color})` : 'none' }}
            animate={{ strokeDashoffset: 2 * Math.PI * 54 * 0.75 * (1 - value / 100) }}
            transition={{ duration: 1.5, ease: 'easeOut' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <motion.span
            animate={{ color }}
            style={{ fontFamily: 'Orbitron, monospace', fontSize: 28, fontWeight: 900, lineHeight: 1 }}
          >
            {value.toFixed(0)}
          </motion.span>
          <span style={{ fontSize: 9, color: 'var(--text-muted)', fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em' }}>/100</span>
          <motion.span
            animate={{ color }}
            style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, fontWeight: 700, marginTop: 4, letterSpacing: '0.1em' }}
          >
            {label}
          </motion.span>
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="neon-tooltip">
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
          {p.name}: {p.value?.toFixed?.(1) ?? p.value}
        </div>
      ))}
    </div>
  );
};

export default function ThreatPanel() {
  const { threatLevel, attackEvents, nodes, alerts } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [anomalyHistory, setAnomalyHistory] = useState(() =>
    Array.from({ length: 20 }, (_, i) => ({ t: i, score: Math.random() * 20 + 5 }))
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setAnomalyHistory(prev => {
        const next = [...prev, { t: prev.length, score: threatLevel + (Math.random() - 0.5) * 10 }];
        return next.slice(-20);
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [threatLevel]);

  const activeAlertCount = alerts.filter(a => !a.acknowledged).length;
  const riskScore = Math.min(100, threatLevel + activeAlertCount * 5);
  const criticalNodes = nodes.filter(n => n.anomalyScore > 60);

  const resolvedThreatColor = getThemeColor('#ff073a', isDark);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Top row: threat meter + risk score */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Threat meter */}
        <div className="glass-card glass-card-red" style={{ padding: 20, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <div style={{ fontSize: 10, color: resolvedThreatColor, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            NETWORK THREAT LEVEL
          </div>
          <ThreatMeter value={threatLevel} />
        </div>

        {/* Attack events */}
        <div className="glass-card glass-card-red" style={{ padding: 20 }}>
          <div style={{ fontSize: 10, color: resolvedThreatColor, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 12, fontWeight: 'bold' }}>
            ATTACK TIMELINE
          </div>
          {attackEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 24 }}>
              <Shield size={24} color={isDark ? 'rgba(57,255,20,0.3)' : 'rgba(5,150,105,0.4)'} style={{ margin: '0 auto 8px' }} />
              <div style={{ fontSize: 12, color: isDark ? 'rgba(57,255,20,0.5)' : '#059669', fontFamily: 'Share Tech Mono, monospace', fontWeight: 'bold' }}>
                NO ACTIVE THREATS
              </div>
            </div>
          ) : (
            attackEvents.slice(0, 5).map((event, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                style={{
                  padding: '8px 10px',
                  marginBottom: 6,
                  borderRadius: 6,
                  background: 'rgba(255,7,58,0.1)',
                  border: '1px solid rgba(255,7,58,0.25)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                  <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: resolvedThreatColor, fontWeight: 'bold' }}>
                    ⚡ {event.type || 'FLOOD ATTACK'}
                  </span>
                  <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: 'var(--text-muted)' }}>
                    {event.timestamp ? new Date(event.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }) : ''}
                  </span>
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-secondary)' }}>
                  Target: {event.nodeId} | Intensity: {event.intensity || 85}/100
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Anomaly score chart */}
      <div className="glass-card glass-card-purple" style={{ padding: 20 }}>
        <div style={{ fontSize: 10, color: getThemeColor('#bf5af2', isDark), fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 16, fontWeight: 'bold' }}>
          ANOMALY SCORE HISTORY
        </div>
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={anomalyHistory}>
            <defs>
              <linearGradient id="anomalyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={isDark ? '#bf5af2' : '#7e22ce'} stopOpacity={0.4} />
                <stop offset="95%" stopColor={isDark ? '#bf5af2' : '#7e22ce'} stopOpacity={0} />
              </linearGradient>
            </defs>
            {/* Danger threshold line */}
            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(191,90,242,0.08)" : "rgba(124,58,237,0.15)"} />
            <Tooltip content={<CustomTooltip />} />
            <YAxis stroke="var(--text-muted)" style={{ fontSize: 10 }} domain={[0, 100]} width={30} />
            <Area type="monotone" dataKey="score" name="Anomaly" stroke={isDark ? "#bf5af2" : "#7e22ce"} fill="url(#anomalyGrad)" strokeWidth={2} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Suspicious nodes */}
      <div className="glass-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 10, color: getThemeColor('#ffea00', isDark), fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, fontWeight: 'bold' }}>
          <Eye size={12} color={getThemeColor('#ffea00', isDark)} />
          SUSPICIOUS NODE DETECTION
        </div>
        {criticalNodes.length === 0 ? (
          <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: isDark ? 'rgba(57,255,20,0.5)' : '#059669', textAlign: 'center', padding: 12, fontWeight: 'bold' }}>
            ✓ All nodes operating within normal parameters
          </div>
        ) : (
          criticalNodes.map(node => (
            <div key={node.nodeId} style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '8px 12px',
              marginBottom: 6,
              borderRadius: 6,
              background: 'rgba(255,234,0,0.06)',
              border: '1px solid rgba(255,234,0,0.2)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={12} color={getThemeColor('#ffea00', isDark)} />
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: getThemeColor('#ffea00', isDark), fontWeight: 'bold' }}>{node.nodeId}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: getThemeColor('#ff073a', isDark), fontWeight: 'bold' }}>
                  ANOMALY: {(node.anomalyScore || 0).toFixed(0)}/100
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Network risk score */}
      <div className="glass-card glass-card-red" style={{ padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: resolvedThreatColor, fontFamily: 'Orbitron, monospace', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            NETWORK RISK SCORE
          </div>
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 20, fontWeight: 900, color: riskScore > 60 ? getThemeColor('#ff073a', isDark) : riskScore > 30 ? getThemeColor('#ffea00', isDark) : getThemeColor('#39ff14', isDark) }}>
            {riskScore.toFixed(0)}<span style={{ fontSize: 11 }}>/100</span>
          </span>
        </div>
        <div style={{ height: 8, background: 'var(--surface-sunken)', borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
          <motion.div
            animate={{ width: `${riskScore}%` }}
            transition={{ duration: 1 }}
            style={{
              height: '100%',
              background: riskScore > 60
                ? `linear-gradient(90deg, ${getThemeColor('#ff073a', isDark)}, ${getThemeColor('#ff6b6b', isDark)})`
                : riskScore > 30
                ? `linear-gradient(90deg, ${getThemeColor('#ffea00', isDark)}, ${getThemeColor('#f59e0b', isDark)})`
                : `linear-gradient(90deg, ${getThemeColor('#39ff14', isDark)}, #22c55e)`,
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    </div>
  );
}
