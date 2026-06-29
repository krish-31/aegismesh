/**
 * NetworkGraph v3 — Cinematic live topology with packet animation
 *
 * Enhancements:
 * - PacketCanvas overlay for moving particles along edges
 * - Node breathing glow animations (CSS-driven)
 * - Edge width/brightness scales with throughput
 * - Enhanced hover tooltip (latency + packet rate)
 * - Failover phase banners: INITIATED → RECALCULATING → SELF-HEALING COMPLETE
 * - Selected node rotating outer ring
 * - Route tracing on node hover
 * - Network sync pulse every 10s
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useMeshStore from '../../store/meshStore';
import { getSocket } from '../../lib/socket';
import NodeDetailsPanel from '../nodes/NodeDetailsPanel';
import PacketCanvas from './PacketCanvas';
import { useTheme } from '../../lib/ThemeContext';

const getStatusColors = (isDark) => ({
  healthy:     isDark ? '#39ff14' : '#059669',
  unstable:    isDark ? '#ffea00' : '#d97706',
  failed:      isDark ? '#ff073a' : '#e11d48',
  quarantined: isDark ? '#ff073a' : '#e11d48',
  gateway:     isDark ? '#0080ff' : '#2563eb',
});

export default function NetworkGraph() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const statusColors = getStatusColors(isDark);

  const cyRef          = useRef(null);
  const containerRef   = useRef(null);
  const pendingUpdate  = useRef(null);
  const cyReady        = useRef(false);
  const syncPulseRef   = useRef(null);

  const [selectedNode, setSelectedNode] = useState(null);
  const [panelOpen,    setPanelOpen]    = useState(false);
  const [hoveredEdge,  setHoveredEdge]  = useState(null);
  const [hoveredNode,  setHoveredNode]  = useState(null);
  const [syncPulse,    setSyncPulse]    = useState(false);

  const { nodes, edges, obstacles, highlightedPath, routeHighlight, failoverActive, failoverNodeId } = useMeshStore();
  const socket = getSocket();

  // ── Periodic sync pulse ────────────────────────────────────────────────────
  useEffect(() => {
    syncPulseRef.current = setInterval(() => {
      setSyncPulse(true);
      setTimeout(() => setSyncPulse(false), 1200);
    }, 10000);
    return () => clearInterval(syncPulseRef.current);
  }, []);

  // ── Initialize Cytoscape once ─────────────────────────────────────────────
  useEffect(() => {
    let cy;
    let destroyed = false;
    let handleResizeFn;

    import('cytoscape').then(mod => {
      if (destroyed) return;
      const cytoscape = mod.default;

      cy = cytoscape({
        container:       containerRef.current,
        style:           getCytoscapeStyle(isDark, statusColors),
        layout:          { name: 'preset' },
        wheelSensitivity: 0.3,
        minZoom: 0.25,
        maxZoom: 4,
        userZoomingEnabled: true,
        userPanningEnabled: true,
      });

      handleResizeFn = () => {
        if (cy) {
          cy.resize();
          cy.fit(cy.elements().not(':hidden'), 70);
        }
      };
      window.addEventListener('resize', handleResizeFn);

      // ── Node tap ───────────────────────────────────────────────────────
      cy.on('tap', 'node', (e) => {
        const nd = e.target.data();
        setSelectedNode(nd);
        setPanelOpen(true);
        socket.emit('node:details', { nodeId: nd.id });

        cy.elements().removeClass('highlighted faded selected-node');
        e.target.addClass('selected-node');
        e.target.connectedEdges().addClass('highlighted');
        e.target.neighborhood().nodes().addClass('highlighted');
        cy.elements()
          .not(e.target.neighborhood())
          .not(e.target)
          .addClass('faded');
        e.target.removeClass('faded').addClass('highlighted');
      });

      cy.on('tap', (e) => {
        if (e.target === cy) {
          cy.elements().removeClass('highlighted faded path-highlighted failover-highlight selected-node');
          setPanelOpen(false);
          setSelectedNode(null);
        }
      });

      // ── Edge hover ─────────────────────────────────────────────────────
      cy.on('mouseover', 'edge', (e) => {
        const d = e.target.data();
        e.target.addClass('edge-hovered');
        setHoveredEdge({
          from: d.source, to: d.target,
          weight: d.weight,
          throughput: d.throughput || Math.floor(Math.random() * 800 + 200),
          active: e.target.style('line-style') !== 'dashed',
        });
      });
      cy.on('mouseout', 'edge', (e) => {
        e.target.removeClass('edge-hovered');
        setHoveredEdge(null);
      });

      // ── Node hover → highlight neighbors ───────────────────────────────
      cy.on('mouseover', 'node', (e) => {
        const nd = e.target.data();
        setHoveredNode(nd);
        if (!panelOpen) {
          e.target.connectedEdges().addClass('edge-hovered');
        }
      });
      cy.on('mouseout', 'node', (e) => {
        setHoveredNode(null);
        if (!panelOpen) {
          e.target.connectedEdges().removeClass('edge-hovered');
        }
      });

      cyRef.current = cy;
      cyReady.current = true;

      if (pendingUpdate.current) {
        applyTopologyToCy(cy, pendingUpdate.current.nodes, pendingUpdate.current.edges);
        pendingUpdate.current = null;
      }
    });

    return () => {
      destroyed = true;
      cyReady.current = false;
      if (handleResizeFn) {
        window.removeEventListener('resize', handleResizeFn);
      }
      if (cyRef.current) {
        cyRef.current.destroy();
        cyRef.current = null;
      }
    };
  }, []);

  // ── Apply theme updates to Cytoscape dynamically ───────────────────────────────
  useEffect(() => {
    if (cyRef.current && cyReady.current) {
      cyRef.current.style(getCytoscapeStyle(isDark, statusColors));
    }
  }, [isDark, statusColors]);

  // ── Apply topology ─────────────────────────────────────────────────────────
  const applyTopologyToCy = useCallback((cy, nodes, edges, obstacles = []) => {
    if (!cy || !nodes.length) return;

    cy.batch(() => {
      nodes.forEach(node => {
        let color = statusColors[node.status] || statusColors.healthy;
        
        // Color nodes dynamically by LEACH cluster if healthy
        if (node.status === 'healthy' || node.status === 'unstable') {
          if (node.clusterId === 'cluster-1') color = isDark ? '#00f5ff' : '#0891b2';
          else if (node.clusterId === 'cluster-2') color = isDark ? '#a855f7' : '#7c3aed';
        }

        const existing = cy.getElementById(node.nodeId);
        const isGW     = node.isGateway || node.status === 'gateway';
        const size     = isGW ? 64 : 50;

        let nodeLabel = node.label || node.nodeId;
        if (node.isClusterHead) nodeLabel = `👑 ${nodeLabel} [CH]`;
        if (node.isReal || node.mode === 'live') nodeLabel = `🟢 ${nodeLabel} [HW]`;

        const data = {
          status:   node.status,
          label:    nodeLabel,
          latency:  node.latency,
          cpuUsage: node.cpuUsage,
        };

        const shape = node.isClusterHead ? 'diamond' : (isGW ? 'hexagon' : 'ellipse');

        const style = {
          'background-color': color,
          'border-color':     node.isClusterHead ? (isDark ? '#ffea00' : '#d97706') : color,
          'border-width':     node.isClusterHead ? 5 : 3,
          'shape':            shape,
          'opacity':          (node.status === 'failed' || node.status === 'quarantined') ? 0.4 : 1,
          'width':            size,
          'height':           size,
        };

        if (existing.length) {
          existing.data(data);
          existing.style(style);
          // Add status class for CSS-driven animations
          existing.removeClass('node-healthy node-unstable node-failed node-gateway node-simulated node-live');
          existing.addClass(`node-${node.status}`);
          if (node.isReal) existing.addClass('node-live');
          else if (!node.isGateway) existing.addClass('node-simulated');
        } else {
          const el = cy.add({
            group: 'nodes',
            data:  { id: node.nodeId, ...data },
            position: node.position || { x: 350 + Math.random() * 100, y: 280 + Math.random() * 100 },
            style,
          });
          el.addClass(`node-${node.status}`);
          if (node.isReal) el.addClass('node-live');
          else if (!node.isGateway) el.addClass('node-simulated');
        }
      });

      edges.forEach(edge => {
        const edgeId   = edge.id || `${edge.from}-${edge.to}`;
        const existing = cy.getElementById(edgeId);
        const isActive = edge.active !== false;

        // Edge width scales with throughput (simulated from weight)
        const traffic   = isActive ? Math.max(1.5, 4 - (edge.weight || 10) / 15) : 1;

        const style = {
          'line-style':         isActive ? 'solid' : 'dashed',
          'line-dash-pattern':  isActive ? undefined : [6, 4],
          'opacity':            isActive ? 0.6 : 0.15,
          'line-color':         isActive ? (isDark ? `rgba(0,245,255,${0.2 + traffic * 0.08})` : `rgba(8,145,178,${0.55 + traffic * 0.08})`) : (isDark ? 'rgba(255,7,58,0.3)' : 'rgba(225,29,72,0.55)'),
          'target-arrow-color': isActive ? (isDark ? `rgba(0,245,255,${0.2 + traffic * 0.08})` : `rgba(8,145,178,${0.55 + traffic * 0.08})`) : (isDark ? 'rgba(255,7,58,0.3)' : 'rgba(225,29,72,0.55)'),
          'width':              traffic,
        };

        if (existing.length) {
          existing.data('weight', edge.weight);
          existing.data('latencyLabel', `${edge.weight}ms`);
          existing.data('throughput', Math.floor(Math.random() * 800 + 200));
          existing.style(style);
          existing.removeClass('edge-active edge-inactive');
          existing.addClass(isActive ? 'edge-active' : 'edge-inactive');
        } else {
          const el = cy.add({
            group: 'edges',
            data: { id: edgeId, source: edge.from, target: edge.to, weight: edge.weight, latencyLabel: `${edge.weight}ms`, throughput: Math.floor(Math.random() * 800 + 200) },
            style,
          });
          el.addClass(isActive ? 'edge-active' : 'edge-inactive');
        }
      });

      // Render Obstacles as nodes in Cytoscape
      (obstacles || []).forEach(obs => {
        const existing = cy.getElementById(obs.id);
        const width = Math.max(12, Math.abs(obs.x1 - obs.x2));
        const height = Math.max(12, Math.abs(obs.y1 - obs.y2));
        const cx = (obs.x1 + obs.x2) / 2;
        const cyPos = (obs.y1 + obs.y2) / 2;

        const data = {
          label: `${obs.name} (${obs.attenuation} dB)`,
        };

        const style = {
          'shape':            'rectangle',
          'background-color': obs.type === 'metal' ? (isDark ? 'rgba(255, 170, 0, 0.25)' : 'rgba(217, 119, 6, 0.25)') : (isDark ? 'rgba(255, 7, 58, 0.25)' : 'rgba(225, 29, 72, 0.25)'),
          'border-color':     obs.type === 'metal' ? (isDark ? '#ffa000' : '#d97706') : (isDark ? '#ff073a' : '#be123c'),
          'border-width':     2,
          'border-style':     'dashed',
          'width':            width,
          'height':           height,
          'text-valign':      'center',
          'text-halign':      'center',
          'color':            isDark ? '#e0e8f0' : '#0f172a',
          'font-size':        '9px',
          'font-family':      'Share Tech Mono, monospace',
          'overlay-opacity':  0,
          'events':           'no'
        };

        if (existing.length) {
          existing.data(data);
          existing.style(style);
          existing.position({ x: cx, y: cyPos });
        } else {
          cy.add({
            group: 'nodes',
            data: { id: obs.id, ...data },
            position: { x: cx, y: cyPos },
            style
          });
        }
      });
    });

    nodes.forEach(node => {
      const el = cy.getElementById(node.nodeId);
      if (el.length && node.position) el.position(node.position);
    });

    cy.fit(cy.elements().not(':hidden'), 70);
  }, [isDark, statusColors]);

  // ── React to topology changes ──────────────────────────────────────────────
  useEffect(() => {
    if (!nodes.length) return;
    if (cyReady.current && cyRef.current) {
      applyTopologyToCy(cyRef.current, nodes, edges, obstacles);
    } else {
      pendingUpdate.current = { nodes, edges, obstacles };
    }
  }, [nodes, edges, obstacles, applyTopologyToCy]);

  // ── Highlight active path ──────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.elements().removeClass('path-highlighted failover-highlight');

    const path = highlightedPath;
    if (!path || path.length < 2) return;

    const isFailover = routeHighlight?.type === 'failover';
    const cls        = isFailover ? 'failover-highlight' : 'path-highlighted';

    for (let i = 0; i < path.length - 1; i++) {
      const edge = cy.edges(
        `[source="${path[i]}"][target="${path[i+1]}"], [source="${path[i+1]}"][target="${path[i]}"]`
      );
      edge.addClass(cls);
    }
    path.forEach(nId => cy.getElementById(nId).addClass(cls));
  }, [highlightedPath, routeHighlight]);

  // ── Failover pulse ─────────────────────────────────────────────────────────
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !failoverNodeId) return;

    const el = cy.getElementById(failoverNodeId);
    if (!el.length) return;

    let pulsing = true;
    let bright  = true;
    const pulse = setInterval(() => {
      if (!pulsing || !cyRef.current) return;
      el.style('border-width', bright ? 10 : 3);
      el.style('opacity', bright ? 0.9 : 0.3);
      bright = !bright;
    }, 250);

    return () => {
      pulsing = false;
      clearInterval(pulse);
      if (cyRef.current && el.length) {
        el.style('border-width', 3);
        el.style('opacity', failoverActive ? 0.4 : 1);
      }
    };
  }, [failoverActive, failoverNodeId]);

  // ── Failover phase text ────────────────────────────────────────────────────
  const getFailoverPhase = () => {
    if (failoverActive) return 'FAILOVER INITIATED — RECALCULATING ROUTES';
    if (routeHighlight?.type === 'failover' && routeHighlight.path.length > 0)
      return `✓ SELF-HEALING COMPLETE — ${routeHighlight.path.join(' → ')}`;
    return null;
  };
  const failoverPhase = getFailoverPhase();
  const failoverColor = failoverActive ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#39ff14' : '#059669');

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
      {/* Cytoscape canvas */}
      <div
        ref={containerRef}
        id="cytoscape-container"
        style={{
          width:        '100%',
          height:       '100%',
          borderRadius: 12,
          background:   isDark ? 'radial-gradient(ellipse at 30% 30%, rgba(0,40,70,0.5) 0%, #020408 70%)' : 'radial-gradient(ellipse at 30% 30%, #f8fafc 0%, #dde5ed 70%)',
        }}
      />

      {/* Packet animation overlay */}
      <PacketCanvas cyRef={cyRef} />

      {/* Sync pulse ring */}
      <AnimatePresence>
        {syncPulse && (
          <motion.div
            initial={{ scale: 0.5, opacity: 0.6 }}
            animate={{ scale: 3, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: '50%', left: '50%',
              width: 80, height: 80,
              marginTop: -40, marginLeft: -40,
              borderRadius: '50%',
              border: `1px solid ${isDark ? 'rgba(0,245,255,0.3)' : 'rgba(8,145,178,0.3)'}`,
              pointerEvents: 'none',
              zIndex: 2,
            }}
          />
        )}
      </AnimatePresence>

      {/* Failover banner (consolidated) */}
      <AnimatePresence>
        {failoverPhase && (
          <motion.div
            key={failoverActive ? 'active' : 'complete'}
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              position:     'absolute',
              top:          12,
              left:         '50%',
              transform:    'translateX(-50%)',
              background:   `${failoverColor}18`,
              border:       `1px solid ${failoverColor}80`,
              borderRadius: 8,
              padding:      '6px 20px',
              display:      'flex',
              alignItems:   'center',
              gap:          10,
              backdropFilter: 'blur(12px)',
              zIndex: 10,
            }}
          >
            {failoverActive && (
              <motion.div
                animate={{ opacity: [1, 0, 1] }}
                transition={{ repeat: Infinity, duration: 0.6 }}
                style={{ width: 8, height: 8, borderRadius: '50%', background: failoverColor, boxShadow: `0 0 8px ${failoverColor}` }}
              />
            )}
            <span style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: failoverColor, letterSpacing: '0.1em' }}>
              {failoverPhase}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Enhanced edge tooltip */}
      <AnimatePresence>
        {hoveredEdge && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position:     'absolute',
              bottom:       70,
              left:         '50%',
              transform:    'translateX(-50%)',
              background:   isDark ? 'rgba(0,10,20,0.95)' : 'rgba(255,255,255,0.95)',
              border:       isDark ? '1px solid rgba(0,245,255,0.25)' : '1px solid rgba(8,145,178,0.3)',
              borderRadius: 8,
              padding:      '8px 16px',
              fontFamily:   'Share Tech Mono, monospace',
              fontSize:     10,
              color:        isDark ? '#00f5ff' : '#0e7490',
              pointerEvents: 'none',
              backdropFilter: 'blur(10px)',
              boxShadow:    isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
              whiteSpace: 'nowrap',
              zIndex: 5,
              display: 'flex',
              gap: 16,
            }}
          >
            <span>{hoveredEdge.from} ↔ {hoveredEdge.to}</span>
            <span style={{ color: hoveredEdge.weight > 50 ? (isDark ? '#ffea00' : '#d97706') : (isDark ? '#39ff14' : '#059669') }}>
              {hoveredEdge.weight}ms
            </span>
            <span style={{ color: isDark ? 'rgba(191,90,242,0.8)' : '#7c3aed' }}>
              {hoveredEdge.throughput} pkt/s
            </span>
            <span style={{ color: hoveredEdge.active ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48'), fontSize: 9 }}>
              {hoveredEdge.active ? '● ACTIVE' : '○ DOWN'}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Node hover tooltip */}
      <AnimatePresence>
        {hoveredNode && !panelOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'absolute', top: 12, left: 12,
              background: isDark ? 'rgba(0,10,20,0.9)' : 'rgba(255,255,255,0.95)',
              border: isDark ? '1px solid rgba(0,245,255,0.2)' : '1px solid rgba(8,145,178,0.25)',
              borderRadius: 8,
              padding: '6px 14px',
              fontFamily: 'Share Tech Mono, monospace',
              fontSize: 10,
              color: isDark ? '#00f5ff' : '#0e7490',
              pointerEvents: 'none',
              backdropFilter: 'blur(10px)',
              boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.08)',
              zIndex: 5,
            }}
          >
            <span style={{ fontFamily: 'Orbitron, monospace', color: statusColors[hoveredNode.status] || (isDark ? '#00f5ff' : '#0e7490') }}>
              {hoveredNode.label}
            </span>
            <span style={{ color: isDark ? 'rgba(224,232,240,0.4)' : '#64748b', marginLeft: 8 }}>
              {hoveredNode.latency ? `${hoveredNode.latency.toFixed(0)}ms` : ''} | CPU {hoveredNode.cpuUsage ? `${hoveredNode.cpuUsage.toFixed(0)}%` : ''}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Legend */}
      <div style={{
        position: 'absolute', bottom: 14, left: 14,
        background: isDark ? 'rgba(2,4,8,0.9)' : 'rgba(255,255,255,0.95)',
        border: isDark ? '1px solid rgba(0,245,255,0.12)' : '1px solid rgba(0,0,0,0.08)',
        borderRadius: 8,
        padding: '10px 14px',
        backdropFilter: 'blur(12px)',
        boxShadow: isDark ? 'none' : '0 4px 12px rgba(0,0,0,0.06)',
        zIndex: 3,
      }}>
        <div style={{ fontSize: 8, color: isDark ? 'rgba(0,245,255,0.4)' : '#0e7490', fontFamily: 'Orbitron, monospace', letterSpacing: '0.12em', marginBottom: 7 }}>
          NODE STATUS
        </div>
        {Object.entries(statusColors).map(([status, color]) => (
          <div key={status} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 4 }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%', background: color,
              boxShadow: isDark ? `0 0 5px ${color}` : 'none',
              animation: status === 'healthy' ? 'breathe 3s ease-in-out infinite' : status === 'gateway' ? 'breathe-blue 2s ease-in-out infinite' : undefined,
            }} />
            <span style={{ fontSize: 9, fontFamily: 'Share Tech Mono, monospace', color: isDark ? 'rgba(224,232,240,0.65)' : '#475569', textTransform: 'uppercase' }}>
              {status}
            </span>
          </div>
        ))}
        <div style={{ marginTop: 7, paddingTop: 7, borderTop: isDark ? '1px solid rgba(0,245,255,0.08)' : '1px solid rgba(0,0,0,0.06)' }}>
          <div style={{ fontSize: 7, color: isDark ? 'rgba(0,245,255,0.3)' : '#64748b', fontFamily: 'Share Tech Mono, monospace', display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
            <motion.div
              animate={{ x: [0, 8, 0] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              style={{ width: 4, height: 4, borderRadius: '50%', background: isDark ? '#00f5ff' : '#0891b2' }}
            />
            Packet flow active
          </div>
          <div style={{ fontSize: 7, color: isDark ? 'rgba(0,245,255,0.25)' : '#94a3b8', fontFamily: 'Share Tech Mono, monospace' }}>
            Click node for details
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 3 }}>
        {[
          { label: '+', action: () => cyRef.current?.zoom({ level: (cyRef.current.zoom() * 1.25), renderedPosition: { x: 200, y: 200 } }) },
          { label: '−', action: () => cyRef.current?.zoom({ level: (cyRef.current.zoom() * 0.8),  renderedPosition: { x: 200, y: 200 } }) },
          { label: '⊡', action: () => cyRef.current?.fit(undefined, 60) },
        ].map(btn => (
          <button
            key={btn.label}
            onClick={btn.action}
            style={{
              width: 30, height: 30, borderRadius: 6,
              border: isDark ? '1px solid rgba(0,245,255,0.2)' : '1px solid rgba(0,0,0,0.08)',
              background: isDark ? 'rgba(0,10,20,0.85)' : 'rgba(255, 255, 255, 0.95)',
              color: isDark ? '#00f5ff' : '#0e7490', cursor: 'pointer', fontSize: 15,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              backdropFilter: 'blur(10px)',
              boxShadow: isDark ? 'none' : '0 2px 8px rgba(0,0,0,0.05)',
              transition: 'all 0.2s',
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>

      {/* Node detail panel */}
      <AnimatePresence>
        {panelOpen && selectedNode && (
          <NodeDetailsPanel
            nodeId={selectedNode?.id}
            onClose={() => {
              setPanelOpen(false);
              setSelectedNode(null);
              cyRef.current?.elements().removeClass('highlighted faded selected-node');
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Cytoscape Style ────────────────────────────────────────────────────────────
function getCytoscapeStyle(isDark, statusColors) {
  return [
    {
      selector: 'node',
      style: {
        'width':                50,
        'height':               50,
        'background-color':     statusColors.healthy,
        'border-width':         3,
        'border-color':         statusColors.healthy,
        'border-opacity':       0.9,
        'label':                'data(label)',
        'color':                isDark ? '#e0e8f0' : '#1e293b',
        'font-size':            '10px',
        'font-family':          'Orbitron, monospace',
        'text-valign':          'bottom',
        'text-halign':          'center',
        'text-margin-y':        7,
        'text-outline-width':   2,
        'text-outline-color':   isDark ? '#020408' : '#ffffff',
        'transition-property':  'background-color border-color opacity width height border-width',
        'transition-duration':  '0.5s',
        'overlay-opacity':      0,
      }
    },
    // ── Node status classes ─────────────────────────────────────────────────
    {
      selector: 'node.node-healthy',
      style: {
        'background-color': statusColors.healthy,
        'border-color':     statusColors.healthy,
        'opacity': 1,
      }
    },
    {
      selector: 'node.node-unstable',
      style: {
        'background-color': statusColors.unstable,
        'border-color':     statusColors.unstable,
        'opacity': 0.85,
      }
    },
    {
      selector: 'node.node-failed',
      style: {
        'background-color': statusColors.failed,
        'border-color':     statusColors.failed,
        'opacity': 0.35,
      }
    },
    {
      selector: 'node.node-gateway',
      style: {
        'background-color': statusColors.gateway,
        'border-color':     statusColors.gateway,
        'shape':  'hexagon',
        'width':  68,
        'height': 68,
        'opacity': 1,
      }
    },
    // ── Hardware mode classes ─────────────────────────────────────────────
    {
      selector: 'node.node-simulated',
      style: {
        'border-style':    'dashed',
        'border-width':    2,
        'border-color':    isDark ? '#00f5ff' : '#0e7490',
        'background-color': isDark ? 'rgba(0,245,255,0.15)' : 'rgba(8,145,178,0.12)',
      }
    },
    {
      selector: 'node.node-live',
      style: {
        'border-style':    'solid',
        'border-width':    4,
        'border-color':    statusColors.healthy,
        'background-color': isDark ? 'rgba(57,255,20,0.2)' : 'rgba(5,150,105,0.15)',
      }
    },
    // ── Selected node ring ─────────────────────────────────────────────────
    {
      selector: 'node.selected-node',
      style: {
        'border-width':  6,
        'border-color':  isDark ? '#00f5ff' : '#0891b2',
        'border-opacity': 1,
      }
    },
    // ── Edges ─────────────────────────────────────────────────────────────
    {
      selector: 'edge',
      style: {
        'width':               2,
        'line-color':          isDark ? 'rgba(0,245,255,0.3)' : 'rgba(8,145,178,0.65)',
        'target-arrow-color':  isDark ? 'rgba(0,245,255,0.3)' : 'rgba(8,145,178,0.65)',
        'target-arrow-shape':  'triangle',
        'arrow-scale':         0.7,
        'curve-style':         'bezier',
        'opacity':             0.6,
        'label':               'data(latencyLabel)',
        'font-size':           '8px',
        'font-family':         'Share Tech Mono, monospace',
        'color':               isDark ? 'rgba(0,245,255,0.75)' : '#0f172a',
        'text-rotation':       'autorotate',
        'text-margin-y':       -8,
        'text-outline-width':  1.5,
        'text-outline-color':  isDark ? '#020408' : '#ffffff',
        'transition-property': 'line-color opacity width line-style',
        'transition-duration': '0.5s',
        'overlay-opacity':     0,
      }
    },
    {
      selector: 'edge.edge-hovered',
      style: {
        'line-color':         isDark ? '#00f5ff' : '#0891b2',
        'target-arrow-color': isDark ? '#00f5ff' : '#0891b2',
        'width': 3.5,
        'opacity': 1,
      }
    },
    {
      selector: 'edge.highlighted',
      style: {
        'line-color':         isDark ? '#00f5ff' : '#0891b2',
        'target-arrow-color': isDark ? '#00f5ff' : '#0891b2',
        'width': 3,
        'opacity': 1,
      }
    },
    {
      selector: 'edge.path-highlighted',
      style: {
        'line-color':          statusColors.healthy,
        'target-arrow-color':  statusColors.healthy,
        'width':               4.5,
        'opacity':             1,
        'line-style':          'dashed',
        'line-dash-pattern':   [10, 4],
      }
    },
    {
      selector: 'edge.failover-highlight',
      style: {
        'line-color':          isDark ? '#bf5af2' : '#7c3aed',
        'target-arrow-color':  isDark ? '#bf5af2' : '#7c3aed',
        'width':               5,
        'opacity':             1,
        'line-style':          'dashed',
        'line-dash-pattern':   [12, 5],
      }
    },
    {
      selector: 'edge.edge-inactive',
      style: {
        'line-color':          isDark ? 'rgba(255,7,58,0.25)' : 'rgba(225,29,72,0.25)',
        'target-arrow-color':  isDark ? 'rgba(255,7,58,0.25)' : 'rgba(225,29,72,0.25)',
        'line-style':          'dashed',
        'line-dash-pattern':   [6, 4],
        'opacity':             0.15,
        'width':               1,
      }
    },
    {
      selector: 'node.path-highlighted',
      style: { 'border-width': 6, 'border-color': statusColors.healthy }
    },
    {
      selector: 'node.failover-highlight',
      style: { 'border-width': 7, 'border-color': isDark ? '#bf5af2' : '#7c3aed' }
    },
    {
      selector: '.faded',
      style: { 'opacity': 0.12 }
    },
    {
      selector: '.highlighted',
      style: { 'opacity': 1 }
    },
  ];
}
