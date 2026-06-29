import React, { useState } from 'react';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { Map, Server, HelpCircle, Thermometer, Droplets, Cpu } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function ZoneMapPage() {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const zones = useMeshStore(state => state.zones) || [];
  const nodes = useMeshStore(state => state.nodes) || [];
  const obstacles = useMeshStore(state => state.obstacles) || [];
  
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [activeDragNodeId, setActiveDragNodeId] = useState(null);

  const activeZone = zones.find(z => z.id === selectedZoneId);

  // SVG dimensions
  const mapWidth = 800;
  const mapHeight = 500;

  const handleDragStart = (e, nodeId) => {
    setActiveDragNodeId(nodeId);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!activeDragNodeId) return;

    // Get drop relative coordinates on SVG container
    const container = e.currentTarget.getBoundingClientRect();
    const x = Math.round(e.clientX - container.left);
    const y = Math.round(e.clientY - container.top);

    // Clamp values inside map
    const clampX = Math.max(20, Math.min(mapWidth - 20, x));
    const clampY = Math.max(20, Math.min(mapHeight - 20, y));

    // Send update to socket
    socket.emit('zone:move-node', {
      nodeId: activeDragNodeId,
      position: { x: clampX, y: clampY }
    });

    setActiveDragNodeId(null);
  };

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
        <Map size={28} color="var(--accent)" />
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Geofenced Zone Floor Plan
        </h2>
      </div>
 
      <div style={{ display: 'grid', gridTemplateColumns: '3fr 1.2fr', gap: '1.5rem' }}>
        {/* Floor Plan Canvas */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-heading)', opacity: 0.7 }}>
            DRAG AND DROP NODE MARKERS TO POSITION THEM WITHIN GEOFENCED ROOMS
          </div>
 
          <div
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            style={{
              position: 'relative',
              width: `${mapWidth}px`,
              height: `${mapHeight}px`,
              background: isDark ? '#02060e' : '#f8fafc',
              border: `1px solid ${isDark ? 'rgba(0, 245, 255, 0.25)' : 'var(--border-bright)'}`,
              borderRadius: '4px',
              overflow: 'hidden',
              boxShadow: isDark ? 'inset 0 0 30px rgba(0,0,0,0.8)' : 'none'
            }}
          >
            {/* SVG Background Grid lines and rooms */}
            <svg width={mapWidth} height={mapHeight} style={{ position: 'absolute', top: 0, left: 0, zIndex: 1 }}>
              {/* Grid lines */}
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke={isDark ? "rgba(0, 245, 255, 0.04)" : "rgba(8, 145, 178, 0.08)"} strokeWidth="1" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />

              {/* Obstacles Partition Lines */}
              {obstacles.map(obs => {
                const obsColor = obs.type === 'metal' ? (isDark ? '#ffa000' : '#b45309') : (isDark ? '#ff073a' : '#e11d48');
                return (
                  <g key={obs.id}>
                    <line
                      x1={obs.x1}
                      y1={obs.y1}
                      x2={obs.x2}
                      y2={obs.y2}
                      stroke={obsColor}
                      strokeWidth="4"
                      strokeDasharray="4 4"
                      opacity="0.65"
                    />
                    <text
                      x={(obs.x1 + obs.x2) / 2}
                      y={(obs.y1 + obs.y2) / 2 - 6}
                      fill={obsColor}
                      fontSize="8"
                      textAnchor="middle"
                      style={{ opacity: 0.9, letterSpacing: '0.5px', fontWeight: 'bold' }}
                    >
                      {obs.name.toUpperCase()} ({obs.attenuation} dB)
                    </text>
                  </g>
                );
              })}

              {/* Zone Geofenced Boundaries */}
              {zones.map(z => {
                const isSelected = selectedZoneId === z.id;
                const borderGlow = isSelected ? (isDark ? '#00f5ff' : '#0891b2') : (isDark ? 'rgba(0, 245, 255, 0.15)' : 'rgba(8, 145, 178, 0.25)');
                const borderStyle = isSelected ? '4,4' : 'none';
                const labelColor = isDark ? '#00f5ff' : '#0e7490';

                return (
                  <g
                    key={z.id}
                    onClick={() => setSelectedZoneId(isSelected ? null : z.id)}
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                  >
                    <rect
                      x={z.bounds.x}
                      y={z.bounds.y}
                      width={z.bounds.width}
                      height={z.bounds.height}
                      fill={z.color}
                      stroke={borderGlow}
                      strokeWidth={isSelected ? 2 : 1}
                      strokeDasharray={borderStyle}
                      style={{ transition: 'all 0.3s ease', pointerEvents: 'auto' }}
                    />
                    <text
                      x={z.bounds.x + 10}
                      y={z.bounds.y + 20}
                      fill={labelColor}
                      fontSize="10"
                      fontWeight="bold"
                      style={{ opacity: 0.9, letterSpacing: '0.5px', pointerEvents: 'none' }}
                    >
                      {z.name.toUpperCase()} ({z.metrics.healthScore}% HEALTH)
                    </text>
                  </g>
                );
              })}
            </svg>

            {/* Nodes Rendered over absolute coordinates */}
            <div style={{ position: 'absolute', inset: 0, zIndex: 10, pointerEvents: 'none' }}>
              {nodes.map(node => {
                const pos = node.position || { x: 300, y: 200 };
                const isFailed = node.status === 'failed';
                const isUnstable = node.status === 'unstable';
                const color = isFailed ? (isDark ? '#ff073a' : '#e11d48') : isUnstable ? (isDark ? '#ffaa00' : '#d97706') : (isDark ? '#39ff14' : '#059669');

                return (
                  <div
                    key={node.nodeId}
                    draggable
                    onDragStart={(e) => handleDragStart(e, node.nodeId)}
                    style={{
                      position: 'absolute',
                      left: `${pos.x - 18}px`,
                      top: `${pos.y - 18}px`,
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: isDark ? 'rgba(4, 13, 26, 0.9)' : '#ffffff',
                      border: `2px solid ${color}`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'grab',
                      pointerEvents: 'auto',
                      boxShadow: isDark ? `0 0 10px ${color}55` : '0 2px 6px rgba(0,0,0,0.1)',
                      transition: 'border-color 0.3s ease',
                    }}
                    title={`${node.label} (${node.nodeId})`}
                  >
                    <Server size={16} color={color} />
                    
                    {/* Node Mini Floating Label */}
                    <div style={{
                      position: 'absolute',
                      bottom: '-16px',
                      background: isDark ? 'rgba(2, 6, 14, 0.8)' : 'rgba(255, 255, 255, 0.95)',
                      padding: '0.1rem 0.3rem',
                      border: '1px solid var(--border-bright)',
                      borderRadius: '3px',
                      fontSize: '0.65rem',
                      whiteSpace: 'nowrap',
                      color: 'var(--text-primary)',
                      pointerEvents: 'none',
                      fontWeight: 'bold',
                      boxShadow: isDark ? 'none' : '0 1px 3px rgba(0,0,0,0.05)'
                    }}>
                      {node.nodeId}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right side details card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {activeZone ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-bright)',
              borderRadius: '4px',
              padding: '1.2rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.2rem',
              boxShadow: isDark ? '0 0 12px rgba(0, 245, 255, 0.15)' : 'var(--shadow-sm)'
            }}>
              <div>
                <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.1rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase' }}>
                  {activeZone.name}
                </h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '0.3rem 0 0 0' }}>
                  {activeZone.description}
                </p>
              </div>

              {/* Zone health percentage */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span>Zone Integrity Check</span>
                  <span style={{ color: activeZone.metrics.healthScore > 90 ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ffea00' : '#d97706'), fontWeight: 'bold' }}>
                    {activeZone.metrics.healthScore}%
                  </span>
                </div>
                <div style={{ background: isDark ? 'rgba(4,13,26,0.6)' : 'rgba(0,0,0,0.06)', height: '6px', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                  <div style={{
                    width: `${activeZone.metrics.healthScore}%`,
                    height: '100%',
                    background: activeZone.metrics.healthScore > 90 ? (isDark ? 'linear-gradient(90deg, #00f5ff, #39ff14)' : 'linear-gradient(90deg, #0891b2, #059669)') : (isDark ? 'linear-gradient(90deg, #ffaa00, #ff073a)' : 'linear-gradient(90deg, #d97706, #e11d48)'),
                  }} />
                </div>
              </div>

              {/* Metrics aggregation */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', borderTop: '1px solid var(--border-dim)', paddingTop: '0.8rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                    <Thermometer size={14} /> Avg Temperature
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{activeZone.metrics.avgTemperature}°C</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                    <Droplets size={14} /> Avg Humidity
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{activeZone.metrics.avgHumidity}%</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', color: 'var(--text-secondary)' }}>
                    <Cpu size={14} /> Avg CPU load
                  </span>
                  <span style={{ fontWeight: 'bold' }}>{activeZone.metrics.avgCpuUsage}%</span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Assigned Nodes</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent)' }}>{activeZone.nodes.join(', ') || 'None'}</span>
                </div>
              </div>
            </div>
          ) : (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px dashed var(--border-bright)',
              borderRadius: '4px',
              padding: '2rem 1.2rem',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.85rem',
            }}>
              <HelpCircle size={28} style={{ margin: '0 auto 0.6rem', opacity: 0.4 }} />
              SELECT A ROOM SECTOR ON MAP TO INSPECT ENVIRONMENTAL AGGREGATES
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
