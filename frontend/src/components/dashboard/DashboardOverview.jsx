import { motion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import useMeshStore from '../../store/meshStore';
import { getSocket } from '../../lib/socket';
import { useTheme } from '../../lib/ThemeContext';
import {
  Server, WifiOff, Activity, GitBranch, Radio, Zap, Clock, AlertTriangle, Shield
} from 'lucide-react';

function useAnimatedNumber(target, duration = 800) {
  const [current, setCurrent] = useState(0);
  const animRef = useRef(null);

  useEffect(() => {
    const start = current;
    const diff = target - start;
    const startTime = performance.now();

    const animate = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCurrent(Math.round(start + diff * eased));
      if (progress < 1) animRef.current = requestAnimationFrame(animate);
    };

    animRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animRef.current);
  }, [target]);

  return current;
}

const resolveColor = (color, isDark) => {
  if (isDark) return color;
  const mapping = {
    '#22d3ee': '#0e7490', // cyan
    '#00d4ff': '#0891b2', // cyan-dim
    '#67e8f9': '#0e7490',
    '#06b6d4': '#0891b2',
    '#fbbf24': '#b45309', // amber/yellow
    '#f59e0b': '#c2410c', // orange/amber
    '#ffea00': '#b45309',
    '#f43f5e': '#be123c', // red/rose
    '#ef4444': '#9f1239', // red
    '#8b5cf6': '#6d28d9', // purple
    '#a78bfa': '#5b21b6', // purple-bright
    'rgba(148,163,184,0.4)': '#64748b',
  };
  return mapping[color] || color;
};

function StatCard({ title, value, unit, icon: Icon, color, colorEnd, variant, subtitle, pulse, delay = 0, action }) {
  const animatedValue = useAnimatedNumber(typeof value === 'number' ? value : 0);
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const isAlert = pulse;
  
  const resolvedColor = resolveColor(color, isDark);
  const resolvedColorEnd = resolveColor(colorEnd || color, isDark);

  return (
    <motion.div
      initial={{ opacity: 0, y: 28, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ duration: 0.4, delay, ease: [0.4, 0, 0.2, 1] }}
      className={`glass-card ${isAlert ? 'card-alert' : ''}`}
      style={{
        padding: '20px 22px',
        cursor: 'default',
        borderColor: `${resolvedColor}18`,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Accent top line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${resolvedColor}00, ${resolvedColor}60, ${resolvedColorEnd}60, ${resolvedColorEnd}00)`,
      }} />

      {/* Subtle background gradient glow */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 100, height: 100,
        borderRadius: '50%',
        background: `radial-gradient(circle, ${resolvedColor}08 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14, position: 'relative', zIndex: 1 }}>
        {/* Icon with glowing ring */}
        <div style={{ position: 'relative' }}>
          {/* Outer glow ring */}
          <div style={{
            position: 'absolute', inset: -4,
            borderRadius: 14,
            background: `${resolvedColor}08`,
            border: `1px solid ${resolvedColor}12`,
            animation: isAlert ? 'none' : undefined,
          }} />
          <div style={{
            width: 42,
            height: 42,
            borderRadius: 12,
            background: `linear-gradient(135deg, ${resolvedColor}15, ${resolvedColor}08)`,
            border: `1px solid ${resolvedColor}25`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: `0 0 20px ${resolvedColor}15, inset 0 0 15px ${resolvedColor}05`,
            position: 'relative',
            zIndex: 1,
          }}>
            <Icon size={20} color={resolvedColor} style={{ filter: isDark ? `drop-shadow(0 0 4px ${resolvedColor}80)` : 'none' }} />
          </div>
        </div>

        {action ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              action();
            }}
            style={{
              padding: '4px 8px',
              background: 'rgba(244,63,94,0.08)',
              border: `1px solid ${resolvedColor}40`,
              borderRadius: 6,
              color: resolvedColor,
              fontSize: 8,
              fontFamily: 'Orbitron, monospace',
              fontWeight: 600,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              zIndex: 10,
              pointerEvents: 'auto',
              boxShadow: `0 0 10px ${resolvedColor}15`,
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.target.style.background = `${resolvedColor}20`;
              e.target.style.borderColor = resolvedColor;
              e.target.style.boxShadow = `0 0 15px ${resolvedColor}35`;
            }}
            onMouseLeave={(e) => {
              e.target.style.background = 'rgba(244,63,94,0.08)';
              e.target.style.borderColor = `${resolvedColor}40`;
              e.target.style.boxShadow = `0 0 10px ${resolvedColor}15`;
            }}
          >
            ACK ALL
          </button>
        ) : isAlert ? (
          <motion.div
            animate={{ opacity: [1, 0.2, 1], scale: [1, 1.2, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{
              width: 10, height: 10, borderRadius: '50%',
              background: resolvedColor,
              boxShadow: `0 0 12px ${resolvedColor}`,
            }}
          />
        ) : null}
      </div>

      {/* Value with gradient text */}
      <div style={{ position: 'relative', zIndex: 1, marginBottom: 6 }}>
        <div style={{
          fontFamily: 'Orbitron, monospace',
          fontSize: 30,
          fontWeight: 700,
          lineHeight: 1,
          backgroundImage: `linear-gradient(135deg, ${resolvedColor}, ${resolvedColorEnd})`,
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: isDark ? `drop-shadow(0 0 12px ${resolvedColor}40)` : 'none',
        }}>
          {typeof value === 'number' ? animatedValue.toLocaleString() : value}
          {unit && <span style={{
            fontSize: 13,
            fontWeight: 600,
            marginLeft: 4,
            opacity: 0.7,
          }}>{unit}</span>}
        </div>
      </div>

      {/* Title */}
      <div style={{
        fontSize: 10,
        color: isDark ? 'rgba(148,163,184,0.55)' : 'var(--text-secondary)',
        fontFamily: 'Orbitron, monospace',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        marginBottom: subtitle ? 4 : 0,
      }}>
        {title}
      </div>

      {/* Subtitle */}
      {subtitle && (
        <div style={{
          fontSize: 10,
          color: isDark ? 'rgba(148,163,184,0.3)' : 'var(--text-muted)',
          fontFamily: 'Share Tech Mono, monospace',
        }}>
          {subtitle}
        </div>
      )}
    </motion.div>
  );
}

// Section heading with gradient line
function SectionHeading({ children }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
      <div style={{
        fontFamily: 'Orbitron, monospace',
        fontSize: 10,
        color: isDark ? 'rgba(0,212,255,0.35)' : '#0e7490',
        letterSpacing: '0.15em',
        whiteSpace: 'nowrap',
      }}>
        {children}
      </div>
      <div style={{
        flex: 1,
        height: 1,
        background: isDark
          ? 'linear-gradient(90deg, rgba(0,212,255,0.15), rgba(139,92,246,0.08), transparent)'
          : 'linear-gradient(90deg, rgba(8,145,178,0.2), rgba(124,58,237,0.1), transparent)',
        borderRadius: 1,
      }} />
    </div>
  );
}

export default function DashboardOverview() {
  const { stats, nodes, alerts, events, liveCount, simCount, offlineCount, gatewayCount } = useMeshStore();

  const failedNodes = nodes.filter(n => n.status === 'failed').length;
  const activeAlerts = alerts.filter(a => !a.acknowledged).length;
  const lastFailover = stats.lastFailover
    ? new Date(stats.lastFailover).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : 'None';

  const cards = [
    {
      title: 'Active Nodes',
      value: (stats.totalNodes || 5) - failedNodes,
      unit: `/ ${stats.totalNodes || 5}`,
      icon: Server,
      color: '#22d3ee',
      colorEnd: '#00d4ff',
      subtitle: 'Nodes online in mesh',
    },
    {
      title: 'Failed Nodes',
      value: failedNodes,
      icon: WifiOff,
      color: failedNodes > 0 ? '#f43f5e' : '#22d3ee',
      colorEnd: failedNodes > 0 ? '#ef4444' : '#00d4ff',
      subtitle: failedNodes > 0 ? '⚠ Failover active' : 'All nodes healthy',
      pulse: failedNodes > 0,
    },
    {
      title: 'Network Health',
      value: stats.networkHealth ?? 100,
      unit: '%',
      icon: Activity,
      color: (stats.networkHealth ?? 100) > 70 ? '#00d4ff' : '#f43f5e',
      colorEnd: (stats.networkHealth ?? 100) > 70 ? '#67e8f9' : '#ef4444',
      subtitle: 'Mesh integrity score',
    },
    {
      title: 'Active Routes',
      value: stats.activeRoutes ?? 8,
      icon: GitBranch,
      color: '#8b5cf6',
      colorEnd: '#a78bfa',
      subtitle: 'Dijkstra-optimized paths',
    },
    {
      title: 'Live Hardware',
      value: liveCount || 0,
      icon: Radio,
      color: liveCount > 0 ? '#22d3ee' : 'rgba(148,163,184,0.4)',
      colorEnd: liveCount > 0 ? '#00d4ff' : 'rgba(148,163,184,0.4)',
      subtitle: liveCount > 0 ? `${liveCount} ESP32 via MQTT` : 'No hardware connected',
    },
    {
      title: 'Packet Throughput',
      value: stats.packetThroughput ?? 3200,
      unit: 'pkt/s',
      icon: Zap,
      color: '#fbbf24',
      colorEnd: '#f59e0b',
      subtitle: 'Mesh aggregate traffic',
    },
    {
      title: 'Avg Latency',
      value: stats.avgLatency ?? 12,
      unit: 'ms',
      icon: Clock,
      color: '#06b6d4',
      colorEnd: '#22d3ee',
      subtitle: 'End-to-end mesh RTT',
    },
    {
      title: 'Last Failover',
      value: lastFailover,
      icon: GitBranch,
      color: '#f59e0b',
      colorEnd: '#fbbf24',
      subtitle: 'Route recalculation',
    },
    {
      title: 'Threat Alerts',
      value: activeAlerts,
      icon: Shield,
      color: activeAlerts > 0 ? '#f43f5e' : '#22d3ee',
      colorEnd: activeAlerts > 0 ? '#ef4444' : '#00d4ff',
      subtitle: activeAlerts > 0 ? 'Active security alerts' : 'No threats detected',
      pulse: activeAlerts > 0,
      action: activeAlerts > 0 ? () => {
        const socket = getSocket();
        if (socket) socket.emit('alerts:clear');
      } : null,
    },
  ];

  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 14,
        marginBottom: 20,
      }}>
        {cards.map((card, i) => (
          <StatCard key={card.title} {...card} delay={i * 0.04} />
        ))}
      </div>
    </div>
  );
}

export { SectionHeading };
