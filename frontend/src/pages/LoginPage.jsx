import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Shield, Lock, Mail, Server } from 'lucide-react';
import ParticleBackground from '../components/common/ParticleBackground';
import { useTheme } from '../lib/ThemeContext';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [focused, setFocused] = useState(null);
  const navigate = useNavigate();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setTimeout(() => {
      if (email === 'admin@aegismesh.com' && password === 'admin123') {
        localStorage.setItem('aegismesh_auth', 'true');
        if (onLogin) onLogin();
        navigate('/');
      } else {
        setError('CRITICAL: Access Denied. Invalid Authorization Credentials.');
        setLoading(false);
      }
    }, 1000);
  };

  const handleGuestAccess = () => {
    localStorage.setItem('aegismesh_auth', 'guest');
    if (onLogin) onLogin();
    navigate('/');
  };

  const inputStyle = (field) => ({
    width: '100%',
    background: isDark ? 'rgba(3, 6, 13, 0.8)' : 'rgba(248, 250, 252, 0.9)',
    border: `1px solid ${focused === field
      ? (isDark ? 'rgba(0,212,255,0.5)' : 'rgba(8,145,178,0.5)')
      : (isDark ? 'rgba(0,212,255,0.1)' : 'rgba(8,145,178,0.15)')
    }`,
    color: 'var(--text-primary)',
    padding: '12px 14px 12px 42px',
    fontSize: '14px',
    fontFamily: "'Share Tech Mono', monospace",
    borderRadius: 8,
    outline: 'none',
    transition: 'all 0.3s ease',
    boxShadow: focused === field
      ? (isDark
        ? '0 0 25px rgba(0,212,255,0.1), inset 0 0 20px rgba(0,212,255,0.02)'
        : '0 0 15px rgba(8,145,178,0.06)')
      : 'none',
  });

  const accentColor = isDark ? '#00d4ff' : '#0891b2';
  const accentDim = isDark ? 'rgba(0,212,255,0.25)' : 'rgba(8,145,178,0.25)';

  return (
    <div style={{
      display: 'flex', justifyContent: 'center', alignItems: 'center',
      minHeight: '100vh', background: 'var(--login-bg)', color: 'var(--text-primary)',
      fontFamily: "'Share Tech Mono', monospace",
      position: 'relative', padding: '1.5rem', boxSizing: 'border-box',
    }}>
      {/* Animated particle mesh */}
      <ParticleBackground style={{ zIndex: 0 }} />

      {/* Ambient glow */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none',
        background: isDark
          ? `radial-gradient(ellipse 50% 40% at 50% 45%, rgba(0,212,255,0.05) 0%, transparent 70%),
             radial-gradient(ellipse 30% 30% at 30% 60%, rgba(139,92,246,0.03) 0%, transparent 70%)`
          : `radial-gradient(ellipse 50% 40% at 50% 45%, rgba(8,145,178,0.04) 0%, transparent 70%),
             radial-gradient(ellipse 30% 30% at 30% 60%, rgba(124,58,237,0.02) 0%, transparent 70%)`,
      }} />

      {/* Login Card */}
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.7, ease: [0.4, 0, 0.2, 1] }}
        style={{
          width: '100%', maxWidth: 410,
          background: 'var(--login-card-bg)',
          backdropFilter: 'blur(32px) saturate(1.3)',
          WebkitBackdropFilter: 'blur(32px) saturate(1.3)',
          border: '1px solid var(--login-card-border)',
          borderRadius: 16, padding: '40px 30px',
          boxShadow: isDark
            ? '0 20px 70px rgba(0,0,0,0.6), 0 0 80px rgba(0,212,255,0.04)'
            : '0 16px 48px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.02)',
          zIndex: 5, position: 'relative', overflow: 'hidden',
        }}
      >
        {/* Top line highlight */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: isDark
            ? 'linear-gradient(90deg, transparent 5%, rgba(0,212,255,0.3) 50%, transparent 95%)'
            : 'linear-gradient(90deg, transparent 5%, rgba(8,145,178,0.2) 50%, transparent 95%)',
        }} />

        {/* Brand Header */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
          <motion.div
            animate={{
              boxShadow: isDark
                ? [
                    '0 0 20px rgba(0,212,255,0.12)',
                    '0 0 40px rgba(0,212,255,0.25), 0 0 60px rgba(139,92,246,0.1)',
                    '0 0 20px rgba(0,212,255,0.12)',
                  ]
                : [
                    '0 0 10px rgba(8,145,178,0.08)',
                    '0 0 20px rgba(8,145,178,0.12), 0 0 40px rgba(124,58,237,0.05)',
                    '0 0 10px rgba(8,145,178,0.08)',
                  ]
            }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            style={{
              width: 64, height: 64, borderRadius: '50%',
              border: `1.5px solid ${isDark ? 'rgba(0,212,255,0.3)' : 'rgba(8,145,178,0.25)'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: isDark ? 'rgba(0,212,255,0.05)' : 'rgba(8,145,178,0.04)',
            }}
          >
            <Shield size={30} color={accentColor} />
          </motion.div>

          <h2 style={{
            fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem',
            color: 'var(--text-heading)', margin: 0, letterSpacing: '3px',
            textShadow: isDark ? '0 0 20px rgba(0,212,255,0.4)' : 'none',
          }}>
            AEGIS<span style={{ color: 'var(--accent-secondary)' }}>MESH</span>
          </h2>
          <span style={{
            fontSize: 11, color: 'var(--text-muted)',
            fontFamily: 'Share Tech Mono, monospace', letterSpacing: '0.2em',
          }}>
            ENTERPRISE NOC PORTAL
          </span>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              style={{
                background: isDark ? 'rgba(244, 63, 94, 0.08)' : 'rgba(225, 29, 72, 0.06)',
                border: `1px solid ${isDark ? 'rgba(244,63,94,0.2)' : 'rgba(225,29,72,0.2)'}`,
                color: isDark ? '#fb7185' : '#e11d48', padding: '10px 14px', fontSize: 12,
                textAlign: 'center', borderRadius: 8,
              }}
            >
              {error}
            </motion.div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 500 }}>
              NOC SECURITY EMAIL
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Mail size={16} color={focused === 'email' ? accentColor : accentDim} style={{ position: 'absolute', left: 14, transition: 'color 0.3s' }} />
              <input
                type="email" required value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocused('email')}
                onBlur={() => setFocused(null)}
                placeholder="admin@aegismesh.com"
                style={inputStyle('email')}
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.08em', fontWeight: 500 }}>
              SECURITY PASSWORD
            </label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Lock size={16} color={focused === 'password' ? accentColor : accentDim} style={{ position: 'absolute', left: 14, transition: 'color 0.3s' }} />
              <input
                type="password" required value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={() => setFocused('password')}
                onBlur={() => setFocused(null)}
                placeholder="••••••••"
                style={inputStyle('password')}
              />
            </div>
          </div>

          <motion.button
            type="submit" disabled={loading}
            whileHover={{ scale: 1.01, y: -1 }}
            whileTap={{ scale: 0.98 }}
            style={{
              marginTop: 8, padding: '13px',
              background: loading
                ? (isDark ? 'rgba(0,212,255,0.04)' : 'rgba(8,145,178,0.04)')
                : (isDark
                  ? 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(139,92,246,0.08))'
                  : 'linear-gradient(135deg, rgba(8,145,178,0.1), rgba(124,58,237,0.06))'),
              border: `1px solid ${isDark ? 'rgba(0,212,255,0.3)' : 'rgba(8,145,178,0.3)'}`,
              color: 'var(--accent-text)', fontSize: 13, fontWeight: 600,
              fontFamily: "'Orbitron', monospace", textTransform: 'uppercase',
              letterSpacing: '0.1em', cursor: loading ? 'not-allowed' : 'pointer',
              boxShadow: isDark
                ? '0 4px 20px rgba(0,0,0,0.3), 0 0 25px rgba(0,212,255,0.06)'
                : '0 4px 16px rgba(0,0,0,0.06)',
              transition: 'all 0.3s ease',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              borderRadius: 10,
            }}
          >
            <Server size={16} />
            {loading ? 'AUTHENTICATING...' : 'INITIALIZE SYSTEM ACCESS'}
          </motion.button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
          <div style={{ flexGrow: 1, height: 1, background: 'var(--border-dim)' }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'Share Tech Mono, monospace' }}>OR</span>
          <div style={{ flexGrow: 1, height: 1, background: 'var(--border-dim)' }} />
        </div>

        <motion.button
          onClick={handleGuestAccess}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          style={{
            width: '100%', padding: '11px',
            background: 'transparent',
            border: '1px solid var(--border-dim)',
            color: 'var(--text-muted)', fontSize: 12,
            textTransform: 'uppercase', cursor: 'pointer',
            fontFamily: "'Share Tech Mono', monospace",
            borderRadius: 10, letterSpacing: '0.08em',
            transition: 'all 0.25s ease',
          }}
        >
          DEMO GUEST BYPASS
        </motion.button>

        <div style={{
          marginTop: 24, fontSize: 11,
          color: 'var(--text-muted)', textAlign: 'center',
          fontFamily: 'Share Tech Mono, monospace',
        }}>
          Authorized access only. Log: admin@aegismesh.com / admin123
        </div>
      </motion.div>
    </div>
  );
}
