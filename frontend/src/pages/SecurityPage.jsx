/**
 * SecurityPage v3 — Unified Threat Intelligence & Zero-Trust Cryptographic Admission Page
 */

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ThreatPanel from '../components/security/ThreatPanel';
import EventConsole from '../components/events/EventConsole';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { 
  AlertTriangle, Shield, Siren, Key, Lock, Unlock, ShieldAlert, ShieldCheck, Eye, RefreshCw, Skull
} from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function SecurityPage() {
  const socket = getSocket();
  const { 
    threatLevel, attackEvents, securityKeys, securityLogs, nodes 
  } = useMeshStore();
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  
  const [activeTab, setActiveTab] = useState('monitor'); // monitor | zero-trust
  const [attackTimer, setAttackTimer] = useState(0);
  const [quarantineReason, setQuarantineReason] = useState('');
  const [selectedNodeId, setSelectedNodeId] = useState('');

  const isUnderAttack = threatLevel > 60 || attackEvents.length > 0;

  // Request fresh security state on mount
  useEffect(() => {
    socket.emit('security:request-state');
  }, []);

  // Attack duration counter
  useEffect(() => {
    if (!isUnderAttack) { setAttackTimer(0); return; }
    const start = Date.now();
    const interval = setInterval(() => setAttackTimer(Math.floor((Date.now() - start) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [isUnderAttack]);

  const handleQuarantine = (nodeId) => {
    if (!nodeId) return;
    socket.emit('security:quarantine', { nodeId, reason: quarantineReason || 'Operator Isolation Command' });
    setQuarantineReason('');
  };

  const handleAdmit = (nodeId) => {
    if (!nodeId) return;
    socket.emit('security:admit', { nodeId });
  };

  const handleSimulateRogue = (nodeId) => {
    if (!nodeId) return;
    socket.emit('security:simulate-rogue', { nodeId });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, position: 'relative' }}>
      
      {/* Reactive background glow during attack */}
      <AnimatePresence>
        {isUnderAttack && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.15 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1 }}
            style={{
              position: 'fixed', inset: 0,
              background: 'radial-gradient(ellipse at 30% 20%, rgba(255,7,58,0.3) 0%, transparent 60%)',
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />
        )}
      </AnimatePresence>

      {/* Intrusion alert banner */}
      <AnimatePresence>
        {isUnderAttack && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            style={{
              padding: '10px 20px',
              background: 'rgba(255,7,58,0.1)',
              border: '1px solid rgba(255,7,58,0.4)',
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              animation: 'intrusion-banner 1.5s ease-in-out infinite',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <motion.div
                animate={{ rotate: [0, 10, -10, 0] }}
                transition={{ repeat: Infinity, duration: 0.5 }}
              >
                <AlertTriangle size={16} color="#ff073a" />
              </motion.div>
              <div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: '#ff073a', letterSpacing: '0.1em', fontWeight: 700 }}>
                  ⚠ INTRUSION DETECTED — ACTIVE THREAT
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: isDark ? 'rgba(255,7,58,0.6)' : '#e11d48', marginTop: 2 }}>
                  Zero-Trust Firewall Alert: Signatures or routing anomaly detected.
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 16, color: '#ff073a', fontWeight: 900 }}>
                  {attackEvents.length}
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: isDark ? 'rgba(255,7,58,0.5)' : '#be123c' }}>INTRUSIONS</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 16, color: isDark ? '#ffea00' : '#d97706', fontWeight: 900 }}>
                  {attackTimer}s
                </div>
                <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 8, color: isDark ? 'rgba(255,234,0,0.5)' : '#b45309' }}>DURATION</div>
              </div>
              <motion.div
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#ff073a',
                  boxShadow: isDark ? '0 0 12px #ff073a' : 'none',
                }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Header & Tab Controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: isUnderAttack ? '#ff073a' : 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.15em', transition: 'color 0.5s' }}>
          SECURITY & THREAT INTELLIGENCE
        </div>
        
        {/* Neon Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8, background: 'var(--surface-sunken)', padding: 4, borderRadius: 6, border: '1px solid var(--border-dim)' }}>
          <button
            onClick={() => setActiveTab('monitor')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: activeTab === 'monitor' ? 'var(--bg-glass)' : 'transparent',
              color: activeTab === 'monitor' ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'Orbitron, monospace',
              fontSize: 9,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              outline: 'none',
              transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
          >
            <Shield size={12} />
            THREAT RISK MONITOR
          </button>
          <button
            onClick={() => setActiveTab('zero-trust')}
            style={{
              padding: '6px 14px',
              borderRadius: 4,
              border: 'none',
              background: activeTab === 'zero-trust' ? 'var(--bg-glass)' : 'transparent',
              color: activeTab === 'zero-trust' ? 'var(--accent)' : 'var(--text-muted)',
              fontFamily: 'Orbitron, monospace',
              fontSize: 9,
              letterSpacing: '0.08em',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              outline: 'none',
              transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
          >
            <Key size={12} />
            ZERO-TRUST ADMISSION
          </button>
        </div>
      </div>

      {/* Tab Panels */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <AnimatePresence mode="wait">
          {activeTab === 'monitor' ? (
            <motion.div
              key="monitor"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 16 }}
            >
              <ThreatPanel />
              <div>
                <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.12em', marginBottom: 10 }}>
                  SECURITY EVENT STREAM
                </div>
                <EventConsole maxHeight={600} />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="zero-trust"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16 }}
            >
              
              {/* Left Column: Device Credentials / Key Store */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                
                {/* Cryptographic Key Catalog */}
                <div className="glass-card" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em' }}>
                      <Key size={14} color="var(--accent)" />
                      SECURE CREDENTIALS CATALOG
                    </div>
                    <button 
                      onClick={() => socket.emit('security:request-state')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', opacity: 0.7, outline: 'none' }}
                    >
                      <RefreshCw size={12} className="hover-spin" />
                    </button>
                  </div>
                  
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-dim)', color: 'var(--text-muted)', textAlign: 'left' }}>
                          <th style={{ padding: '8px 12px' }}>NODE ID</th>
                          <th style={{ padding: '8px 12px' }}>PUBLIC SECURITY KEY</th>
                          <th style={{ padding: '8px 12px' }}>ADMISSION</th>
                          <th style={{ padding: '8px 12px', textAlign: 'right' }}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {securityKeys.map((key) => {
                          const statusColors = {
                            admitted: isDark ? '#39ff14' : '#059669',
                            quarantined: isDark ? '#ff073a' : '#e11d48',
                            pending: isDark ? '#ffea00' : '#d97706'
                          };
                          const color = statusColors[key.status] || (isDark ? '#a855f7' : '#7c3aed');
                          
                          return (
                            <tr key={key.nodeId} style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                              <td style={{ padding: '10px 12px', fontWeight: 'bold' }}>{key.nodeId}</td>
                              <td style={{ padding: '10px 12px', color: 'var(--accent)', fontSize: 10, fontWeight: 'bold' }}>{key.publicKey}</td>
                              <td style={{ padding: '10px 12px' }}>
                                <span style={{ color, display: 'flex', alignItems: 'center', gap: 4, textTransform: 'uppercase', fontSize: 9, fontWeight: 'bold' }}>
                                  {key.status === 'admitted' ? <ShieldCheck size={10} /> : <ShieldAlert size={10} />}
                                  {key.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                {key.status === 'quarantined' ? (
                                  <button
                                    onClick={() => handleAdmit(key.nodeId)}
                                    style={{
                                      background: isDark ? 'rgba(57,255,20,0.1)' : 'rgba(5,150,105,0.08)',
                                      border: `1px solid ${isDark ? 'rgba(57,255,20,0.3)' : 'rgba(5,150,105,0.35)'}`,
                                      borderRadius: 4,
                                      color: isDark ? '#39ff14' : '#059669',
                                      fontSize: 8,
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontFamily: 'Orbitron, monospace',
                                      fontWeight: 'bold',
                                      letterSpacing: '0.05em'
                                    }}
                                  >
                                    RESTORE TRUST
                                  </button>
                                ) : key.role !== 'gateway' ? (
                                  <button
                                    onClick={() => handleQuarantine(key.nodeId)}
                                    style={{
                                      background: 'rgba(255,7,58,0.08)',
                                      border: `1px solid ${isDark ? 'rgba(255,7,58,0.3)' : 'rgba(255,7,58,0.45)'}`,
                                      borderRadius: 4,
                                      color: isDark ? '#ff073a' : '#e11d48',
                                      fontSize: 8,
                                      padding: '3px 8px',
                                      cursor: 'pointer',
                                      fontFamily: 'Orbitron, monospace',
                                      fontWeight: 'bold',
                                      letterSpacing: '0.05em'
                                    }}
                                  >
                                    ISOLATE
                                  </button>
                                ) : (
                                  <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>ROOT GW</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Threat Simulation Panel */}
                <div className="glass-card glass-card-red" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent-red)', letterSpacing: '0.08em', marginBottom: 12 }}>
                    <Skull size={14} color="var(--accent-red)" />
                    INTERACTIVE INTRUSION & MITM THREAT SIMULATOR
                  </div>
                  <p style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 10, color: 'var(--text-secondary)', marginBottom: 16 }}>
                    Inject a Man-in-the-Middle routing advertisement attack on a trusted node. The Gateway Zero-Trust monitor will run automated audits to verify signature headers and quarantine the compromised node.
                  </p>

                  <div style={{ display: 'flex', gap: 10 }}>
                    <select
                      value={selectedNodeId}
                      onChange={(e) => setSelectedNodeId(e.target.value)}
                      style={{
                        flex: 1,
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 6,
                        color: 'var(--accent-red)',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: 11,
                        padding: '6px 12px',
                        outline: 'none',
                        cursor: 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      <option value="" style={{ background: 'var(--select-option-bg)' }}>SELECT TARGET NODE TO INFECT...</option>
                      {nodes
                        .filter(n => !n.isGateway && n.status !== 'failed' && n.status !== 'quarantined')
                        .map(n => (
                          <option key={n.nodeId} value={n.nodeId} style={{ background: 'var(--select-option-bg)' }}>{n.label || n.nodeId} (Battery: {n.telemetry?.batteryLevel?.toFixed?.(0)}%)</option>
                        ))
                      }
                    </select>

                    <button
                      onClick={() => handleSimulateRogue(selectedNodeId)}
                      disabled={!selectedNodeId}
                      style={{
                        background: selectedNodeId ? 'rgba(255,7,58,0.15)' : 'rgba(255,255,255,0.02)',
                        border: selectedNodeId ? '1px solid var(--accent-red)' : '1px solid var(--border-dim)',
                        borderRadius: 6,
                        color: selectedNodeId ? 'var(--accent-red)' : 'var(--text-muted)',
                        fontFamily: 'Orbitron, monospace',
                        fontSize: 10,
                        fontWeight: 'bold',
                        padding: '6px 16px',
                        cursor: selectedNodeId ? 'pointer' : 'default',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        outline: 'none',
                        transition: 'all 0.2s'
                      }}
                    >
                      <Siren size={12} />
                      INJECT ROUTING ATTACK
                    </button>
                  </div>
                </div>

                {/* Manual Quarantine Controls */}
                <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent)', letterSpacing: '0.08em', marginBottom: 12 }}>
                    <Lock size={14} color="var(--accent)" />
                    MANUAL INTERVENTION FIREWALL
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    <input
                      type="text"
                      placeholder="QUARANTINE ISOLATION REASON (e.g., Physical tamper alert)..."
                      value={quarantineReason}
                      onChange={(e) => setQuarantineReason(e.target.value)}
                      style={{
                        background: 'var(--input-bg)',
                        border: '1px solid var(--border-bright)',
                        borderRadius: 6,
                        color: 'var(--accent)',
                        fontFamily: 'Share Tech Mono, monospace',
                        fontSize: 11,
                        padding: '8px 12px',
                        outline: 'none',
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                      {nodes
                        .filter(n => !n.isGateway && n.status !== 'failed' && n.status !== 'quarantined')
                        .map(n => (
                          <button
                            key={n.nodeId}
                            onClick={() => handleQuarantine(n.nodeId)}
                            style={{
                              background: 'var(--bg-glass)',
                              border: '1px solid var(--border-bright)',
                              borderRadius: 4,
                              color: 'var(--accent)',
                              fontFamily: 'Share Tech Mono, monospace',
                              fontSize: 10,
                              padding: '4px 10px',
                              cursor: 'pointer',
                              outline: 'none',
                              transition: 'all 0.2s',
                              fontWeight: 'bold'
                            }}
                          >
                            Quarantine {n.nodeId}
                          </button>
                        ))
                      }
                    </div>
                  </div>
                </div>

              </div>

              {/* Right Column: Zero-Trust Cryptographic Audit Logs */}
              <div className="glass-card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--text-heading)', opacity: 0.7, letterSpacing: '0.08em', marginBottom: 6 }}>
                  <ShieldCheck size={14} color={isDark ? '#39ff14' : '#059669'} />
                  CRYPTOGRAPHIC HANDSHAKE AUDIT STREAM
                </div>

                <div style={{ flex: 1, overflowY: 'auto', maxHeight: 580, display: 'flex', flexDirection: 'column', gap: 8, paddingRight: 4 }}>
                  {securityLogs.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace', fontSize: 11 }}>
                      Awaiting cryptographic exchanges...
                    </div>
                  ) : (
                    securityLogs.map((log) => {
                      const statusColor = {
                        SUCCESS: isDark ? '#39ff14' : '#059669',
                        FAILED: isDark ? '#ff073a' : '#e11d48',
                        WARNING: isDark ? '#ffea00' : '#d97706',
                        INFO: 'var(--accent)'
                      }[log.status] || 'var(--text-primary)';

                      return (
                        <div
                          key={log.id}
                          style={{
                            padding: 10,
                            borderRadius: 6,
                            background: 'var(--surface-sunken)',
                            borderLeft: `3px solid ${statusColor}`,
                            borderTop: '1px solid var(--border-dim)',
                            borderRight: '1px solid var(--border-dim)',
                            borderBottom: '1px solid var(--border-dim)',
                            fontFamily: 'Share Tech Mono, monospace',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 10 }}>
                            <span style={{ color: statusColor, fontWeight: 'bold' }}>
                              [{log.type}] {log.status}
                            </span>
                            <span style={{ color: 'var(--text-muted)' }}>
                              {new Date(log.timestamp).toLocaleString('en-US', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })}
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 2 }}>
                            {log.message}
                          </div>
                          <div style={{ fontSize: 9, color: 'var(--accent)', fontWeight: 'bold' }}>
                            Device ID: {log.nodeId}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
