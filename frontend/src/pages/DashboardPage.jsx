import { useEffect } from 'react';
import { motion } from 'framer-motion';
import DashboardOverview, { SectionHeading } from '../components/dashboard/DashboardOverview';
import EventConsole from '../components/events/EventConsole';
import NetworkGraph from '../components/topology/NetworkGraph';
import SimulationPanel from '../components/failover/SimulationPanel';
import PredictionCard from '../components/dashboard/PredictionCard';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { useTheme } from '../lib/ThemeContext';

const cardVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: (i) => ({
    opacity: 1, y: 0, scale: 1,
    transition: {
      delay: i * 0.08,
      duration: 0.5,
      ease: [0.4, 0, 0.2, 1],
    },
  }),
};

export default function DashboardPage() {
  const socket = getSocket();
  const routingPolicy = useMeshStore(state => state.routingPolicy);
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  useEffect(() => {
    socket.emit('topology:request');
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative', zIndex: 1 }}>
      {/* Section title */}
      <motion.div custom={0} initial="hidden" animate="visible" variants={cardVariants}>
        <SectionHeading>SYSTEM OVERVIEW</SectionHeading>
        <DashboardOverview />
      </motion.div>

      {/* Two column layout: topology + controls */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 16, minHeight: 480 }}>
        {/* Network topology */}
        <motion.div
          custom={1} initial="hidden" animate="visible" variants={cardVariants}
          className="glass-card glass-card-cyan card-3d-hover"
          style={{ padding: 14, position: 'relative', display: 'flex', flexDirection: 'column' }}
        >
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            marginBottom: 10, padding: '0 4px',
          }}>
            <div style={{
              fontFamily: 'Orbitron, monospace', fontSize: 10,
              color: isDark ? 'rgba(0,212,255,0.45)' : '#0e7490', letterSpacing: '0.12em',
            }}>
              LIVE NETWORK TOPOLOGY
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 9, color: isDark ? 'rgba(0,212,255,0.35)' : '#64748b' }}>QOS POLICY:</span>
              <select
                value={routingPolicy}
                onChange={(e) => socket.emit('routing:policy-set', { policy: e.target.value })}
                style={{
                  background: isDark ? 'rgba(3,6,13,0.9)' : 'var(--select-bg)',
                  border: `1px solid ${isDark ? 'rgba(0,212,255,0.15)' : 'rgba(8,145,178,0.2)'}`,
                  borderRadius: 6, color: isDark ? '#00d4ff' : '#0e7490',
                  fontFamily: 'Share Tech Mono, monospace',
                  fontSize: 9, padding: '3px 8px',
                  outline: 'none', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(0,212,255,0.4)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(0,212,255,0.15)'; }}
              >
                <option value="latency">LATENCY (DEFAULT)</option>
                <option value="energy">ENERGY SAVER</option>
                <option value="reliability">RELIABILITY</option>
                <option value="hybrid">HYBRID</option>
              </select>
            </div>
          </div>
          <div style={{ flex: 1, minHeight: 420 }}>
            <NetworkGraph />
          </div>
        </motion.div>

        {/* Simulation controls */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, overflowY: 'auto' }}>
          <motion.div custom={2} initial="hidden" animate="visible" variants={cardVariants}>
            <SectionHeading>PREDICTIVE AI MONITOR</SectionHeading>
            <PredictionCard />
          </motion.div>

          <motion.div custom={3} initial="hidden" animate="visible" variants={cardVariants}>
            <SectionHeading>SIMULATION CONTROLS</SectionHeading>
            <SimulationPanel />
          </motion.div>
        </div>
      </div>

      {/* Event console */}
      <motion.div custom={4} initial="hidden" animate="visible" variants={cardVariants}>
        <SectionHeading>REALTIME EVENT STREAM</SectionHeading>
        <EventConsole maxHeight={220} />
      </motion.div>
    </div>
  );
}
