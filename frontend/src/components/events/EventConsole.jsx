import { motion, AnimatePresence } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import useMeshStore from '../../store/meshStore';
import { useTheme } from '../../lib/ThemeContext';

const SEVERITY_CONFIG = {
  INFO:     { color: '#0080ff', bg: 'rgba(0,128,255,0.08)',  prefix: '●' },
  WARNING:  { color: '#ffea00', bg: 'rgba(255,234,0,0.06)',  prefix: '▲' },
  CRITICAL: { color: '#ff073a', bg: 'rgba(255,7,58,0.08)',   prefix: '✦' },
};

// Map event types to categories for filtering
const CATEGORY_MAP = {
  HEARTBEAT:             'MQTT',
  NODE_FAILED:           'SYSTEM',
  NODE_RECOVERED:        'SYSTEM',
  ROUTE_RECALCULATED:    'SYSTEM',
  ROUTE_OPTIMIZATION:    'SYSTEM',
  TOPOLOGY_RESTORED:     'SYSTEM',
  MESH_SYNC:             'SYSTEM',
  PACKET_LOSS:           'WARNING',
  PACKET_LOSS_INJECTION: 'WARNING',
  PACKET_LOSS_CLEARED:   'INFO',
  HIGH_LATENCY:          'WARNING',
  HIGH_LATENCY_INJECTION:'WARNING',
  LATENCY_NORMALIZED:    'INFO',
  PACKET_RECEIVED:       'INFO',
  ROUTE_CHECK:           'INFO',
  SENSOR_READING:        'INFO',
  SENSOR_ALERT:          'WARNING',
  INTRUSION_DETECTED:    'SECURITY',
  FLOOD_ATTACK:          'SECURITY',
  ATTACK_MITIGATED:      'SECURITY',
  FAILOVER_INITIATED:    'ERROR',
  ROUTE_LOST:            'ERROR',
  SIM_ERROR:             'ERROR',
};

const FILTER_TABS = [
  { key: 'ALL',      label: 'ALL',      color: '#00f5ff' },
  { key: 'SYSTEM',   label: 'SYSTEM',   color: '#0080ff' },
  { key: 'SECURITY', label: 'SECURITY', color: '#ff073a' },
  { key: 'MQTT',     label: 'MQTT',     color: '#39ff14' },
  { key: 'WARNING',  label: 'WARN',     color: '#ffea00' },
  { key: 'ERROR',    label: 'ERROR',    color: '#ff073a' },
];

const TYPE_ICONS = {
  NODE_FAILED:           '⬡',
  NODE_RECOVERED:        '⬢',
  ROUTE_RECALCULATED:    '◈',
  ROUTE_OPTIMIZATION:    '◈',
  TOPOLOGY_RESTORED:     '◈',
  PACKET_LOSS:           '◌',
  PACKET_LOSS_INJECTION: '◌',
  PACKET_LOSS_CLEARED:   '◌',
  HIGH_LATENCY:          '↑',
  HIGH_LATENCY_INJECTION:'↑',
  LATENCY_NORMALIZED:    '↓',
  HEARTBEAT:             '♡',
  PACKET_RECEIVED:       '▸',
  ROUTE_CHECK:           '◇',
  SENSOR_READING:        '◉',
  SENSOR_ALERT:          '◉',
  MESH_SYNC:             '⊕',
  INTRUSION_DETECTED:    '⚠',
  FLOOD_ATTACK:          '⚡',
  ATTACK_MITIGATED:      '✓',
  FAILOVER_INITIATED:    '↻',
  ROUTE_LOST:            '✗',
  SIM_ERROR:             '✗',
  DEFAULT:               '▸',
};

const getThemeColor = (color, isDark) => {
  if (isDark) return color;
  const mapping = {
    '#39ff14': '#166534', // dark green
    '#ffea00': '#b45309', // dark amber
    '#f59e0b': '#c2410c', // dark orange
    '#00f5ff': '#0369a1', // dark sky-blue
    '#bf5af2': '#6b21a8', // dark purple
    '#ff073a': '#9f1239', // dark rose
    '#0080ff': '#0f52ba', // blue
  };
  return mapping[color] || color;
};

function EventRow({ event }) {
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const cfg = SEVERITY_CONFIG[event.severity] || SEVERITY_CONFIG.INFO;
  const resolvedColor = getThemeColor(cfg.color, isDark);
  const resolvedBg = isDark ? cfg.bg : (cfg.color === '#ff073a' ? 'rgba(225,29,72,0.04)' : cfg.color === '#ffea00' ? 'rgba(217,119,6,0.04)' : 'rgba(37,99,235,0.04)');
  
  const icon = TYPE_ICONS[event.type] || TYPE_ICONS.DEFAULT;
  const ts   = event.timestamp
    ? new Date(event.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
    : '';

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.2 }}
      className={`event-row event-${event.severity}`}
      style={{ background: resolvedBg }}
    >
      <span style={{ color: resolvedColor, fontSize: 14, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      <span style={{ color: isDark ? 'rgba(0,245,255,0.35)' : '#64748b', minWidth: 70, flexShrink: 0, fontSize: 11 }}>{ts}</span>
      <span style={{
        flex: 1,
        color: event.severity === 'CRITICAL'
          ? (isDark ? '#ffb3b3' : '#be123c')
          : event.severity === 'WARNING'
          ? (isDark ? '#fff5b3' : '#92400e')
          : (isDark ? 'rgba(224,232,240,0.75)' : '#334155'),
        fontWeight: event.severity !== 'INFO' ? 'bold' : 'normal'
      }}>
        {event.message}
      </span>
      {event.nodeId && (
        <span style={{
          color: resolvedColor,
          fontSize: 10,
          fontFamily: 'Orbitron, monospace',
          flexShrink: 0,
          letterSpacing: '0.05em',
          fontWeight: 'bold'
        }}>
          [{event.nodeId}]
        </span>
      )}
    </motion.div>
  );
}

export default function EventConsole({ maxHeight = 400 }) {
  const { events } = useMeshStore();
  const scrollRef  = useRef(null);
  const [activeFilter, setActiveFilter] = useState('ALL');
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  // Auto-scroll to top on new event (newest events are at index 0)
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [events.length]);

  const filteredEvents = activeFilter === 'ALL'
    ? events
    : events.filter(e => {
        const cat = CATEGORY_MAP[e.type] || 'INFO';
        if (activeFilter === 'WARNING') return e.severity === 'WARNING' || cat === 'WARNING';
        if (activeFilter === 'ERROR')   return e.severity === 'CRITICAL' || cat === 'ERROR';
        return cat === activeFilter;
      });

  const counts = {
    INFO:     events.filter(e => e.severity === 'INFO').length,
    WARNING:  events.filter(e => e.severity === 'WARNING').length,
    CRITICAL: events.filter(e => e.severity === 'CRITICAL').length,
  };

  return (
    <div className="glass-card glass-card-cyan" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 16px',
        borderBottom: '1px solid var(--border-dim)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.div
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ repeat: Infinity, duration: 1 }}
            style={{ width: 6, height: 6, borderRadius: '50%', background: isDark ? '#39ff14' : '#059669', boxShadow: isDark ? '0 0 6px #39ff14' : 'none' }}
          />
          <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: isDark ? '#00f5ff' : '#0e7490', letterSpacing: '0.1em', fontWeight: 'bold' }}>
            SYSTEM EVENT CONSOLE
          </span>
          <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-muted)' }}>
            ({filteredEvents.length})
          </span>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          {Object.entries(counts).map(([sev, count]) => {
            const displayColor = getThemeColor(SEVERITY_CONFIG[sev].color, isDark);
            return (
              <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: displayColor,
                  display: 'block',
                }} />
                <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: displayColor, fontWeight: 'bold' }}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Filter tabs */}
      <div style={{
        padding: '6px 16px',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex', gap: 4, overflowX: 'auto',
      }}>
        {FILTER_TABS.map(tab => {
          const tabColor = getThemeColor(tab.color, isDark);
          return (
            <button
              key={tab.key}
              onClick={() => setActiveFilter(tab.key)}
              style={{
                padding: '3px 10px', borderRadius: 4, fontSize: 9,
                fontFamily: 'Orbitron, monospace', letterSpacing: '0.08em',
                cursor: 'pointer', transition: 'all 0.2s',
                background: activeFilter === tab.key ? `${tabColor}18` : 'transparent',
                border: `1px solid ${activeFilter === tab.key ? `${tabColor}50` : 'var(--border-dim)'}`,
                color: activeFilter === tab.key ? tabColor : 'var(--text-muted)',
                fontWeight: 'bold'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Log area — newest at top */}
      <div
        ref={scrollRef}
        className="event-log-container"
        style={{ maxHeight, overflowY: 'auto' }}
      >
        {filteredEvents.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 12 }}>
            — NO {activeFilter} EVENTS —
          </div>
        ) : (
          filteredEvents.map((event, i) => (
            <EventRow key={event._id || `${event.timestamp}-${i}`} event={event} />
          ))
        )}
      </div>
    </div>
  );
}
