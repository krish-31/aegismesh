import React from 'react';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Battery, Sun, Cpu, BatteryCharging, Zap, ShieldAlert, Timer } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function PowerPage() {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const powerGrid = useMeshStore(state => state.powerGrid) || {};
  const nodes = useMeshStore(state => state.nodes) || [];

  const handleSetMode = (nodeId, mode) => {
    socket.emit('power:set-mode', { nodeId, mode });
  };

  // Convert powerGrid Map to array for layout
  const powerNodes = Object.values(powerGrid);

  // Compute summary metrics
  const totalNodesCount = powerNodes.length;
  const avgBattery = totalNodesCount > 0 
    ? Math.round(powerNodes.reduce((sum, n) => sum + n.battery, 0) / totalNodesCount)
    : 100;
  const criticalNodes = powerNodes.filter(n => n.battery < 20).length;
  const solarActiveCount = powerNodes.filter(n => n.solarActive).length;

  // Render battery gauge color
  const getBatteryColor = (level) => {
    if (level < 20) return isDark ? '#ff073a' : '#e11d48'; // Red
    if (level < 50) return isDark ? '#ffaa00' : '#d97706'; // Orange
    return isDark ? '#39ff14' : '#059669'; // Green
  };

  // Build Recharts comparison dataset from the rolling battery history
  const chartData = [];
  if (totalNodesCount > 0) {
    const historyLen = powerNodes[0].history?.length || 0;
    for (let i = 0; i < historyLen; i++) {
      const dataPoint = { tick: i };
      powerNodes.forEach(n => {
        dataPoint[n.nodeId] = +(n.history?.[i] || 100).toFixed(1);
      });
      chartData.push(dataPoint);
    }
  }

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
        <Zap size={28} color="var(--accent)" />
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Energy & Power Management
        </h2>
      </div>

      {/* Summary Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1.5rem' }}>
        <div style={{ background: 'var(--bg-card)', padding: '1.2rem', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <Battery size={16} color="var(--accent)" />
            AVERAGE BATTERY RESERVE
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: getBatteryColor(avgBattery) }}>
            {avgBattery}% CAPACITY
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1.2rem', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <Sun size={16} color={isDark ? '#ffaa00' : '#d97706'} />
            SOLAR CHARGING SENSORS
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: solarActiveCount > 0 ? (isDark ? '#39ff14' : '#059669') : 'var(--text-secondary)' }}>
            {solarActiveCount} ACTIVE LINKS
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1.2rem', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <ShieldAlert size={16} color="var(--accent-red)" />
            CRITICAL BATTERY WARNS
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: criticalNodes > 0 ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669') }}>
            {criticalNodes} SECTORS
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', padding: '1.2rem', borderRadius: '4px', border: '1px solid var(--border-dim)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.4rem' }}>
            <Timer size={16} color="var(--accent)" />
            POWER SIMULATOR RATE
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--text-primary)' }}>
            2.0S / TICK
          </div>
        </div>
      </div>

      {/* Grid of Power Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {powerNodes.map(pNode => {
          const matchingNode = nodes.find(n => n.nodeId === pNode.nodeId);
          const color = getBatteryColor(pNode.battery);
          
          let modeColor = 'var(--text-primary)';
          if (pNode.mode === 'ECO') modeColor = isDark ? '#ffaa00' : '#d97706';
          if (pNode.mode === 'SLEEP') modeColor = isDark ? '#a855f7' : '#7c3aed';
          if (pNode.mode === 'CRITICAL' || pNode.mode === 'DEAD') modeColor = isDark ? '#ff073a' : '#e11d48';

          return (
            <div
              key={pNode.nodeId}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${pNode.battery < 20 ? 'var(--accent-red)' : 'var(--border-dim)'}`,
                borderRadius: '4px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                boxShadow: pNode.battery < 20 && isDark ? '0 0 12px rgba(255, 7, 58, 0.1)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>
                    {matchingNode?.label || pNode.nodeId}
                  </h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    TYPE: {matchingNode?.nodeType?.toUpperCase() || 'ESP32'}
                  </span>
                </div>

                <span style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.5rem',
                  background: 'var(--surface-sunken)',
                  color: modeColor,
                  border: `1px solid ${modeColor}44`,
                  fontWeight: 'bold',
                  borderRadius: '2px'
                }}>
                  {pNode.mode}
                </span>
              </div>

              {/* Battery gauge SVG display */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '0.5rem 0' }}>
                <div style={{ position: 'relative', width: '60px', height: '30px', border: '2px solid var(--border-bright)', borderRadius: '4px', padding: '2px', display: 'flex' }}>
                  <div style={{
                    width: `${pNode.battery}%`,
                    height: '100%',
                    background: color,
                    borderRadius: '2px',
                    boxShadow: isDark ? `0 0 8px ${color}` : 'none',
                    transition: 'all 0.5s ease'
                  }} />
                  {/* Battery tip */}
                  <div style={{ width: '4px', height: '10px', background: 'var(--border-bright)', position: 'absolute', right: '-6px', top: '8px', borderRadius: '0 2px 2px 0' }} />
                </div>

                <div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color }}>
                    {pNode.battery.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    {pNode.solarActive ? (
                      <span style={{ color: isDark ? '#39ff14' : '#059669', display: 'flex', alignItems: 'center', gap: '0.2rem', fontWeight: 'bold' }}>
                        <BatteryCharging size={12} /> Charging
                      </span>
                    ) : (
                      <span>Drain: {pNode.drainRate.toFixed(3)}%/min</span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>EST TIME REMAINING</span>
                <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{pNode.estimatedTimeRemaining}</span>
              </div>

              {/* Solar Active Indicator overlay */}
              {pNode.solarActive && (
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', background: isDark ? 'rgba(57, 255, 20, 0.08)' : 'rgba(5,150,105,0.06)', padding: '0.4rem', border: `1px solid ${isDark ? 'rgba(57, 255, 20, 0.2)' : 'rgba(5,150,105,0.25)'}`, fontSize: '0.75rem', color: isDark ? '#39ff14' : '#059669', fontWeight: 'bold' }}>
                  <Sun size={14} className="spin" />
                  Solar harvesting sensor is receiving recharge bursts
                </div>
              )}

              {/* Mode Toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.3rem', marginTop: '0.5rem' }}>
                {['NORMAL', 'ECO', 'SLEEP'].map(m => (
                  <button
                    key={m}
                    onClick={() => handleSetMode(pNode.nodeId, m)}
                    disabled={pNode.mode === 'DEAD' || matchingNode?.status === 'failed'}
                    style={{
                      padding: '0.3rem',
                      background: pNode.mode === m ? 'var(--bg-glass)' : 'var(--surface-sunken)',
                      border: `1px solid ${pNode.mode === m ? 'var(--accent)' : 'var(--border-dim)'}`,
                      color: pNode.mode === m ? 'var(--accent)' : 'var(--text-secondary)',
                      fontSize: '0.75rem',
                      cursor: (pNode.mode === 'DEAD' || matchingNode?.status === 'failed') ? 'not-allowed' : 'pointer',
                      fontFamily: "'Share Tech Mono', monospace",
                      fontWeight: pNode.mode === m ? 'bold' : 'normal'
                    }}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Battery depletion Recharts */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px',
          padding: '1.2rem',
        }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
            NODE BATTERY LEVELS HISTORY (ROLLING BUFFER)
          </h3>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(224,232,240,0.05)" : "rgba(0,0,0,0.05)"} />
                <XAxis dataKey="tick" stroke="var(--text-muted)" style={{ fontSize: '0.75rem' }} />
                <YAxis stroke="var(--text-muted)" style={{ fontSize: '0.75rem' }} />
                <Tooltip contentStyle={{ background: isDark ? '#07162c' : 'rgba(255, 255, 255, 0.95)', border: `1px solid ${isDark ? 'var(--accent)' : 'var(--border-bright)'}`, color: 'var(--text-primary)', fontFamily: "'Share Tech Mono', monospace" }} />
                <Legend />
                <Area type="monotone" dataKey="ESP32-A" stroke={isDark ? "#00f5ff" : "#0891b2"} fill={isDark ? "rgba(0, 245, 255, 0.05)" : "rgba(8, 145, 178, 0.05)"} strokeWidth={2} />
                <Area type="monotone" dataKey="ESP32-B" stroke={isDark ? "#39ff14" : "#059669"} fill={isDark ? "rgba(57, 255, 20, 0.05)" : "rgba(5, 150, 105, 0.05)"} strokeWidth={2} />
                <Area type="monotone" dataKey="ESP32-C" stroke={isDark ? "#ffaa00" : "#d97706"} fill={isDark ? "rgba(255, 170, 0, 0.05)" : "rgba(217, 119, 6, 0.05)"} strokeWidth={2} />
                <Area type="monotone" dataKey="ESP32-D" stroke={isDark ? "#a855f7" : "#7c3aed"} fill={isDark ? "rgba(168, 85, 247, 0.05)" : "rgba(124, 58, 237, 0.05)"} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Node Efficiency Rankings */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem'
        }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: 0, borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.6rem' }}>
            NODE ENERGY EFFICIENCY INDEX
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {powerNodes.map(pn => {
              const node = nodes.find(n => n.nodeId === pn.nodeId);
              // Calculate a simple score: packets routed per percent battery drained
              const drain = pn.drainRate || 0.02;
              const score = Math.round((node?.packetCount || 0) / (drain * 100 + 1));

              return (
                <div key={pn.nodeId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '0.9rem', fontWeight: 'bold' }}>{node?.label || pn.nodeId}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Total Packets: {node?.packetCount || 0}</span>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'var(--accent)' }}>
                      {score}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Efficiency Score</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
