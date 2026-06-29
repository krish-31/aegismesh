import React, { useState } from 'react';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { Cpu, RefreshCw, AlertTriangle, CheckCircle, Clock, Ban } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function FirmwarePage() {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const nodes = useMeshStore(state => state.nodes) || [];
  const registry = useMeshStore(state => state.firmwareRegistry) || [];
  const batch = useMeshStore(state => state.firmwareBatchStatus) || {};
  const history = useMeshStore(state => state.firmwareHistory) || [];

  const handleUpdate = (nodeId, version) => {
    socket.emit('ota:start', { nodeId, version });
  };

  const handleCancel = (nodeId) => {
    socket.emit('ota:cancel', { nodeId });
  };

  const handleRollback = (nodeId) => {
    socket.emit('ota:rollback', { nodeId });
  };

  const handleUpdateAll = () => {
    // Staggered update all non-gateway nodes to latest v2.1
    const latestVersion = 'v2.1';
    const targetNodes = nodes.filter(n => !n.isGateway && n.status !== 'failed');
    targetNodes.forEach((n, idx) => {
      setTimeout(() => {
        handleUpdate(n.nodeId, latestVersion);
      }, idx * 3000); // 3-second staggered delay
    });
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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem' }}>
          <Cpu size={28} color="var(--accent)" />
          <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
            OTA Firmware Management
          </h2>
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button
            onClick={() => socket.emit('ota:start-mst', { version: 'v2.1' })}
            style={{
              padding: '0.5rem 1.2rem',
              background: isDark ? 'rgba(57, 255, 20, 0.08)' : 'rgba(5, 150, 105, 0.08)',
              border: `1px solid ${isDark ? '#39ff14' : '#059669'}`,
              color: isDark ? '#39ff14' : '#059669',
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: isDark ? '0 0 10px rgba(57, 255, 20, 0.15)' : 'none',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => e.target.style.background = isDark ? 'rgba(57, 255, 20, 0.15)' : 'rgba(5, 150, 105, 0.15)'}
            onMouseLeave={e => e.target.style.background = isDark ? 'rgba(57, 255, 20, 0.08)' : 'rgba(5, 150, 105, 0.08)'}
          >
            MST MULTICAST UPDATE (PRIM'S)
          </button>

          <button
            onClick={handleUpdateAll}
            style={{
              padding: '0.5rem 1.2rem',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-bright)',
              color: 'var(--accent)',
              fontSize: '0.85rem',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              cursor: 'pointer',
              fontWeight: 'bold',
              boxShadow: isDark ? '0 0 10px rgba(0, 245, 255, 0.15)' : 'none',
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={e => e.target.style.background = 'rgba(0, 245, 255, 0.12)'}
            onMouseLeave={e => e.target.style.background = 'var(--bg-glass)'}
          >
            STAGGERED UPDATE ALL
          </button>
        </div>
      </div>

      {/* Grid containing nodes */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1.5rem' }}>
        {nodes.map(node => {
          const otaState = batch[node.nodeId];
          const isUpdating = otaState && otaState.progress < 100;
          const currentVersion = node.firmwareVersion || 'v1.0';
          const isLatest = currentVersion === 'v2.1' || (node.isGateway && currentVersion === 'v2.0');

          return (
            <div
              key={node.nodeId}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isUpdating ? 'var(--accent)' : 'var(--border-dim)'}`,
                borderRadius: '4px',
                padding: '1.2rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
                position: 'relative',
                boxShadow: isUpdating && isDark ? '0 0 15px rgba(0, 245, 255, 0.1)' : 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold' }}>{node.label || node.nodeId}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>ID: {node.nodeId}</span>
                </div>

                <div style={{
                  fontSize: '0.8rem',
                  padding: '0.2rem 0.6rem',
                  borderRadius: '2px',
                  background: isLatest ? (isDark ? 'rgba(57, 255, 20, 0.1)' : 'rgba(5, 150, 105, 0.1)') : (isDark ? 'rgba(255, 170, 0, 0.1)' : 'rgba(217, 119, 6, 0.1)'),
                  color: isLatest ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ffaa00' : '#d97706'),
                  border: `1px solid ${isLatest ? (isDark ? 'rgba(57, 255, 20, 0.2)' : 'rgba(5, 150, 105, 0.2)') : (isDark ? 'rgba(255, 170, 0, 0.2)' : 'rgba(217, 119, 6, 0.2)')}`,
                  fontWeight: 'bold'
                }}>
                  {currentVersion} {isLatest ? '(LATEST)' : '(UPDATE AVAIL)'}
                </div>
              </div>

              {/* Progress simulation state bar */}
              {isUpdating ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.5rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--accent)', fontWeight: 'bold' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <RefreshCw size={12} className="spin" />
                      {otaState.stage} ({otaState.progress}%)
                    </span>
                    <span>To: {otaState.version}</span>
                  </div>

                  <div style={{ height: '6px', background: 'var(--surface-sunken)', borderRadius: '3px', overflow: 'hidden', border: '1px solid var(--border-dim)' }}>
                    <div style={{ width: `${otaState.progress}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.2rem' }}>
                    <button
                      onClick={() => handleCancel(node.nodeId)}
                      style={{
                        padding: '0.2rem 0.6rem',
                        background: 'rgba(255,7,58,0.08)',
                        border: '1px solid var(--accent-red)',
                        color: 'var(--accent-red)',
                        fontSize: '0.75rem',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      ABORT
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  {!isLatest ? (
                    <button
                      onClick={() => handleUpdate(node.nodeId, 'v2.1')}
                      disabled={node.status === 'failed'}
                      style={{
                        flexGrow: 1,
                        padding: '0.4rem',
                        background: 'var(--bg-glass)',
                        border: '1px solid var(--border-bright)',
                        color: 'var(--accent)',
                        fontSize: '0.8rem',
                        cursor: node.status === 'failed' ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <RefreshCw size={12} /> FLASH LATEST (v2.1)
                    </button>
                  ) : (
                    <button
                      onClick={() => handleRollback(node.nodeId)}
                      disabled={node.status === 'failed' || currentVersion === 'v1.0'}
                      style={{
                        flexGrow: 1,
                        padding: '0.4rem',
                        background: 'rgba(255,170,0,0.06)',
                        border: `1px solid ${isDark ? 'rgba(255,170,0,0.2)' : 'rgba(217,119,6,0.3)'}`,
                        color: isDark ? '#ffaa00' : '#d97706',
                        fontSize: '0.8rem',
                        cursor: (node.status === 'failed' || currentVersion === 'v1.0') ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '0.3rem'
                      }}
                    >
                      <Ban size={12} /> ROLLBACK TO v1.0
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Firmware logs */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: '4px',
        padding: '1.5rem',
        marginTop: '1rem',
      }}>
        <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
          OTA OPERATION AND UPDATE LOGS
        </h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '250px', overflowY: 'auto' }}>
          {history.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No firmware update attempts recorded.</div>
          ) : (
            history.map((h, idx) => (
              <div
                key={h._id || idx}
                style={{
                  padding: '0.6rem 0.8rem',
                  background: 'var(--surface-sunken)',
                  borderLeft: `3px solid ${h.status === 'success' ? (isDark ? '#39ff14' : '#059669') : (isDark ? '#ff073a' : '#e11d48')}`,
                  borderTop: '1px solid var(--border-dim)',
                  borderRight: '1px solid var(--border-dim)',
                  borderBottom: '1px solid var(--border-dim)',
                  borderRadius: '0 3px 3px 0',
                  fontSize: '0.8rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}
              >
                <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
                  {h.status === 'success' ? (
                    <CheckCircle size={14} color={isDark ? '#39ff14' : '#059669'} />
                  ) : (
                    <AlertTriangle size={14} color={isDark ? '#ff073a' : '#e11d48'} />
                  )}
                  <div>
                    <div style={{ fontWeight: 'bold' }}>
                      Node {h.nodeId}: firmware updated to {h.version}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Method: {h.method?.toUpperCase()} | Status: {h.status?.toUpperCase()}
                    </span>
                  </div>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <Clock size={12} />
                  {new Date(h.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
