import React from 'react';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { Bot, Play, ToggleLeft, ToggleRight, Clock, AlertTriangle, ShieldCheck } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function PlaybooksPage() {
  const socket = getSocket();
  const playbooks = useMeshStore(state => state.playbooks) || [];
  const logs = useMeshStore(state => state.playbookLogs) || [];
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleToggle = (playbookId) => {
    socket.emit('playbook:toggle', { playbookId });
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
        <Bot size={28} color="var(--accent)" />
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Playbooks & Automation
        </h2>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '1.5rem' }}>
        {/* Left: Playbooks List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {playbooks.map(pb => (
            <div
              key={pb.id}
              style={{
                background: 'var(--bg-card)',
                border: `1px solid ${pb.enabled ? 'var(--accent)' : 'var(--border-dim)'}`,
                borderRadius: '4px',
                padding: '1.2rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: pb.enabled && isDark ? '0 0 10px rgba(0, 245, 255, 0.05)' : 'none',
              }}
            >
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
                <Bot size={28} color={pb.enabled ? 'var(--accent)' : 'var(--text-muted)'} style={{ marginTop: '0.2rem' }} />
                
                <div>
                  <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 'bold', color: pb.enabled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {pb.name}
                  </h4>
                  <p style={{ margin: '0.3rem 0', fontSize: '0.8rem', color: isDark ? '#ffaa00' : '#d97706' }}>
                    <strong>Trigger:</strong> {pb.trigger}
                  </p>
                  <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    <strong>Action:</strong> {pb.action}
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.6rem' }}>
                <span style={{
                  fontSize: '0.75rem',
                  padding: '0.1rem 0.4rem',
                  background: pb.severity === 'CRITICAL' ? 'rgba(255,7,58,0.1)' : 'rgba(255,170,0,0.1)',
                  color: pb.severity === 'CRITICAL' ? (isDark ? '#ff073a' : '#e11d48') : (isDark ? '#ffaa00' : '#d97706'),
                  border: `1px solid ${pb.severity === 'CRITICAL' ? 'rgba(255,7,58,0.2)' : 'rgba(255,170,0,0.2)'}`,
                  borderRadius: '2px',
                  fontWeight: 'bold'
                }}>
                  {pb.severity}
                </span>

                <button
                  onClick={() => handleToggle(pb.id)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: pb.enabled ? 'var(--accent)' : 'var(--text-muted)',
                    padding: 0
                  }}
                >
                  {pb.enabled ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Right: Execution Logs */}
        <div style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-bright)',
          borderRadius: '4px',
          padding: '1.2rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          height: 'fit-content'
        }}>
          <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: 0, borderBottom: '1px solid var(--border-dim)', paddingBottom: '0.6rem' }}>
            AUTOMATED MITIGATION LOGS
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', maxHeight: '400px', overflowY: 'auto' }}>
            {logs.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No playbooks have been triggered yet.</div>
            ) : (
              logs.map((log, idx) => (
                <div
                  key={log._id || idx}
                  style={{
                    padding: '0.6rem 0.8rem',
                    background: 'var(--surface-sunken)',
                    borderLeft: `3px solid ${isDark ? '#39ff14' : '#059669'}`,
                    borderTop: '1px solid var(--border-dim)',
                    borderRight: '1px solid var(--border-dim)',
                    borderBottom: '1px solid var(--border-dim)',
                    borderRadius: '0 3px 3px 0',
                    fontSize: '0.8rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.2rem'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-muted)' }}>
                    <span>{new Date(log.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}</span>
                    <span>Node: {log.nodeId}</span>
                  </div>
                  <div style={{ fontWeight: 'bold', color: 'var(--accent)' }}>
                    Triggered: {log.playbookName}
                  </div>
                  <div style={{ color: 'var(--text-secondary)' }}>
                    {log.details}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: isDark ? '#39ff14' : '#059669', borderTop: '1px dashed var(--border-dim)', paddingTop: '0.3rem', marginTop: '0.3rem', fontWeight: 'bold' }}>
                    Action taken: {log.action}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
