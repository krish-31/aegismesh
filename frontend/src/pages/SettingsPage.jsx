import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useMeshStore from '../store/meshStore';
import { Download, Radio, Wifi, Send, LogOut, Sun, Moon } from 'lucide-react';
import { getSocket } from '../lib/socket';
import { useTheme } from '../lib/ThemeContext';

function SettingRow({ label, value, description, valueColor }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '14px 0', borderBottom: '1px solid var(--border-dim)',
    }}>
      <div>
        <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: 'var(--text-secondary)' }}>{label}</div>
        {description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{description}</div>}
      </div>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 12, color: valueColor || 'var(--accent)' }}>{value}</div>
    </div>
  );
}

function ExportButton({ label, href, icon: Icon }) {
  return (
    <a href={href} download style={{ textDecoration: 'none' }}>
      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
        style={{
          padding: '10px 16px', borderRadius: 8, cursor: 'pointer',
          background: 'rgba(0,245,255,0.06)', border: '1px solid var(--border-bright)',
          display: 'flex', alignItems: 'center', gap: 8, width: '100%',
        }}>
        <Icon size={13} color="var(--accent)" />
        <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 11, color: 'var(--accent)' }}>{label}</span>
      </motion.button>
    </a>
  );
}

export default function SettingsPage({ onLogout }) {
  const { operatingMode, mqttStatus, systemUptime, notificationsSettings } = useMeshStore();
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';
  const backendUrl = import.meta.env.VITE_API_URL || `${window.location.protocol}//${window.location.hostname}:4000`;

  const [tgToken, setTgToken] = useState('');
  const [tgChatId, setTgChatId] = useState('');
  const [discUrl, setDiscUrl] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  // Sync settings inputs
  useEffect(() => {
    if (notificationsSettings) {
      setTgToken(notificationsSettings.telegramToken || '');
      setTgChatId(notificationsSettings.telegramChatId || '');
      setDiscUrl(notificationsSettings.discordWebhookUrl || '');
    }
  }, [notificationsSettings]);

  const handleSaveNotifications = (e) => {
    e.preventDefault();
    setSaveStatus('Saving gateway credentials...');
    const socket = getSocket();
    socket.emit('notifications:update', {
      telegramToken: tgToken,
      telegramChatId: tgChatId,
      discordWebhookUrl: discUrl
    });
    setTimeout(() => {
      setSaveStatus('Notifications config updated!');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  };

  const handleLogoutClick = () => {
    localStorage.removeItem('aegismesh_auth');
    if (onLogout) onLogout();
  };

  const MODE_COLORS = { SIMULATION: 'var(--accent)', HYBRID: 'var(--yellow)', LIVE: 'var(--accent-green)' };
  const modeColor = MODE_COLORS[operatingMode] || 'var(--accent)';

  const formatUptime = (s) => {
    const h = Math.floor(s / 3600); const m = Math.floor((s % 3600) / 60); const sec = s % 60;
    return `${h}h ${m}m ${sec}s`;
  };

  const sectionLabelStyle = {
    fontFamily: 'Orbitron, monospace', fontSize: 10,
    color: 'var(--text-muted)', letterSpacing: '0.1em', marginBottom: 12,
  };

  const inputStyle = {
    background: 'var(--input-bg)',
    border: '1px solid var(--input-border)',
    color: 'var(--input-text)',
    padding: '0.5rem',
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: '0.85rem',
    borderRadius: '3px',
  };

  return (
    <div style={{ maxWidth: 700, paddingBottom: '3rem' }}>
      <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.15em', marginBottom: 20 }}>
        SYSTEM CONFIGURATION
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Theme Toggle */}
        <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>APPEARANCE</div>
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '14px 0',
          }}>
            <div>
              <div style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 13, color: 'var(--text-secondary)' }}>
                Interface Theme
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                Toggle between dark command center and light operations mode
              </div>
            </div>
            <motion.button
              onClick={toggleTheme}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 18px', borderRadius: 10,
                background: isDark
                  ? 'linear-gradient(135deg, rgba(251,191,36,0.08), rgba(251,191,36,0.04))'
                  : 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(99,102,241,0.04))',
                border: `1px solid ${isDark ? 'rgba(251,191,36,0.25)' : 'rgba(99,102,241,0.25)'}`,
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              <motion.div
                key={theme}
                initial={{ rotate: -20, opacity: 0 }}
                animate={{ rotate: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                {isDark
                  ? <Sun size={16} color="#fbbf24" />
                  : <Moon size={16} color="#6366f1" />
                }
              </motion.div>
              <span style={{
                fontFamily: 'Orbitron, monospace', fontSize: 10,
                color: isDark ? '#fbbf24' : '#6366f1',
                letterSpacing: '0.08em', fontWeight: 600,
              }}>
                {isDark ? 'LIGHT MODE' : 'DARK MODE'}
              </span>
            </motion.button>
          </div>
        </div>

        {/* System Status */}
        <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>SYSTEM STATUS</div>
          <SettingRow label="Operating Mode" value={operatingMode} valueColor={modeColor} description="Auto-detected based on connected ESP32 devices" />
          <SettingRow label="System Uptime" value={formatUptime(systemUptime)} valueColor="var(--accent-green)" description="Time since backend started" />
          <SettingRow label="Backend URL" value={backendUrl} description="Express + Socket.IO server" />
          <SettingRow label="Socket.IO Transport" value="WebSocket" description="Realtime communication protocol" />
        </div>

        {/* External Notifications Integration */}
        <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>
            NOTIFICATIONS ALERTS GATEWAY
          </div>
          
          <form onSubmit={handleSaveNotifications} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telegram Bot Token</label>
              <input
                type="text"
                value={tgToken}
                onChange={(e) => setTgToken(e.target.value)}
                placeholder="123456789:ABCdefGhIJKlmNoPQRsTUVwxyZ"
                style={inputStyle}
              />
            </div>

             <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
               <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Telegram Chat ID(s) (comma-separated for multiple)</label>
               <input
                 type="text"
                 value={tgChatId}
                 onChange={(e) => setTgChatId(e.target.value)}
                 placeholder="-100123456789, 987654321"
                 style={inputStyle}
               />
             </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
              <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Discord Webhook URL</label>
              <input
                type="text"
                value={discUrl}
                onChange={(e) => setDiscUrl(e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
                style={inputStyle}
              />
            </div>

            <button
              type="submit"
              style={{
                alignSelf: 'flex-start',
                padding: '0.5rem 1rem',
                background: isDark ? 'rgba(0, 245, 255, 0.08)' : 'rgba(8, 145, 178, 0.08)',
                border: '1px solid var(--accent)',
                color: 'var(--accent)',
                cursor: 'pointer',
                fontFamily: "'Share Tech Mono', monospace",
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                textTransform: 'uppercase',
                fontSize: '0.8rem'
              }}
            >
              <Send size={12} /> Save Credentials
            </button>

            {saveStatus && (
              <span style={{ fontSize: '0.85rem', color: 'var(--accent-green)' }}>
                {saveStatus}
              </span>
            )}
          </form>
        </div>

        {/* Network config */}
        <div className="glass-card glass-card-cyan" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>NETWORK SETTINGS</div>
          <SettingRow label="Heartbeat Interval" value="5s" description="Node health check frequency" />
          <SettingRow label="Live Node Timeout" value="15s" description="Time before live ESP32 node marked failed" />
          <SettingRow label="Route Algorithm" value="Dijkstra" description="Shortest path calculation" />
          <SettingRow label="Telemetry Buffer" value="50 points" description="Rolling telemetry history per node" />
        </div>

        {/* MQTT config */}
        <div className="glass-card glass-card-green" style={{ padding: 20 }}>
          <div style={{ ...sectionLabelStyle, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Wifi size={11} color="var(--text-muted)" />
            MQTT CONFIGURATION
          </div>
          <SettingRow label="MQTT Broker" value={mqttStatus.brokerOnline ? 'ONLINE :1883' : 'OFFLINE'}
            valueColor={mqttStatus.brokerOnline ? 'var(--accent-green)' : 'var(--accent-red)'}
            description="Embedded Aedes MQTT broker" />
          <SettingRow label="Connected Hardware" value={`${mqttStatus.connectedNodes || 0} device(s)`}
            valueColor={mqttStatus.connectedNodes > 0 ? 'var(--accent-green)' : 'var(--text-muted)'}
            description="ESP32 nodes connected via MQTT" />
          <SettingRow label="MQTT Reconnects" value={mqttStatus.reconnects || 0} description="Total broker reconnection events" />
          <SettingRow label="Topic Prefix" value="aegismesh/nodes/#" description="Subscribed mesh topics" />
          <SettingRow label="QoS Level" value="QoS 1" description="At least once delivery" />
          <SettingRow label="Telemetry Interval" value="2s" description="Sensor data broadcast rate" />
        </div>

        {/* Simulation config */}
        <div className="glass-card glass-card-yellow" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>SIMULATION SETTINGS</div>
          <SettingRow label="Node Count" value="5 (1 Gateway + 4 ESP32)" description="Active mesh nodes" />
          <SettingRow label="Mock Data Engine" value="Active" valueColor="var(--accent-green)" description="Realistic telemetry generation (paused for live nodes)" />
          <SettingRow label="Demo Automation" value="8-step sequence" description="Automated evaluator-friendly demo" />
          <SettingRow label="Version" value="AegisMesh v3.0" description="Platform version" />
        </div>

        {/* Keyboard shortcuts */}
        <div className="glass-card glass-card-purple" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>KEYBOARD SHORTCUTS</div>
          {[
            { key: 'F', action: 'Fail selected node' },
            { key: 'R', action: 'Recover selected node' },
            { key: 'A', action: 'Simulate flood attack' },
            { key: 'O', action: 'Optimize routes (Dijkstra)' },
            { key: 'D', action: 'Toggle auto-demo' },
          ].map(({ key, action }) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 0', borderBottom: '1px solid var(--border-dim)' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: isDark ? 'rgba(191,90,242,0.1)' : 'rgba(124,58,237,0.08)',
                border: `1px solid ${isDark ? 'rgba(191,90,242,0.25)' : 'rgba(124,58,237,0.2)'}`,
                fontFamily: 'Orbitron, monospace', fontSize: 11, color: 'var(--purple)', fontWeight: 700,
              }}>{key}</div>
              <span style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: 'var(--text-muted)' }}>{action}</span>
            </div>
          ))}
        </div>

        {/* Export */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>DATA EXPORT</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <ExportButton label="Export Topology" href={`${backendUrl.replace(/\/$/, '')}/api/export/topology`} icon={Download} />
            <ExportButton label="Export Events" href={`${backendUrl.replace(/\/$/, '')}/api/export/events`} icon={Download} />
          </div>
        </div>

        {/* About */}
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={sectionLabelStyle}>ABOUT AEGISMESH</div>
          <p style={{ fontFamily: 'Share Tech Mono, monospace', fontSize: 12, color: 'var(--text-muted)', lineHeight: 1.7, margin: 0 }}>
            AegisMesh is a realtime cybersecurity-grade Network Operations Center dashboard for monitoring,
            visualizing, and managing a Self-Healing Distributed IoT Mesh Network. Built with React,
            Cytoscape.js, Socket.IO, Node.js, and MQTT. Implements Dijkstra shortest-path routing,
            automated failover, ESP32 hardware integration, and advanced threat detection.
          </p>
        </div>

        {/* Logout System Section */}
        <div className="glass-card" style={{ padding: 20, border: `1px solid ${isDark ? 'rgba(255,7,58,0.3)' : 'rgba(225,29,72,0.2)'}` }}>
          <div style={{ fontFamily: 'Orbitron, monospace', fontSize: 10, color: 'var(--accent-red)', letterSpacing: '0.1em', marginBottom: 12 }}>SYSTEM ACCESS TERMINATION</div>
          <button
            onClick={handleLogoutClick}
            style={{
              padding: '0.5rem 1.2rem',
              background: isDark ? 'rgba(255, 7, 58, 0.08)' : 'rgba(225, 29, 72, 0.06)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
              fontFamily: "'Share Tech Mono', monospace",
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              textTransform: 'uppercase',
              fontSize: '0.8rem'
            }}
          >
            <LogOut size={14} /> Log Out from NOC Panel
          </button>
        </div>
      </div>
    </div>
  );
}
