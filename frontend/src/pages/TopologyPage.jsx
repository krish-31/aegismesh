import { useEffect } from 'react';
import NetworkGraph from '../components/topology/NetworkGraph';
import { getSocket } from '../lib/socket';

export default function TopologyPage() {
  const socket = getSocket();

  useEffect(() => {
    socket.emit('topology:request');
  }, []);

  return (
    <div style={{ height: 'calc(100vh - 100px)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em' }}>
        LIVE MESH TOPOLOGY — CYTOSCAPE VISUALIZATION
      </div>
      <div className="glass-card glass-card-cyan" style={{ flex: 1, padding: 12 }}>
        <NetworkGraph />
      </div>
    </div>
  );
}
