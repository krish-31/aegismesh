import React, { useState, useEffect, useRef } from 'react';
import { getSocket } from '../lib/socket';
import { Terminal, Shield } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function TerminalPage() {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const [input, setInput] = useState('');
  const [output, setOutput] = useState([
    { text: '==================================================', type: 'info' },
    { text: '         AEGISMESH NOC SYSTEM COMMAND INTERFACE v3', type: 'info' },
    { text: '==================================================', type: 'info' },
    { text: 'Type "help" to list available diagnostic commands.', type: 'system' },
    { text: 'Ready for CLI prompt input...', type: 'system' },
    { text: '', type: 'info' }
  ]);
  const [history, setHistory] = useState([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState([]);
  
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  // Focus terminal input
  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [output]);

  // Socket command result listener
  useEffect(() => {
    const handleResult = (res) => {
      if (res.output === '__CLEAR__') {
        setOutput([]);
      } else {
        const lines = res.output.split('\n');
        const formatted = lines.map(l => ({ text: l, type: res.type }));
        setOutput(prev => [...prev, ...formatted]);
      }
    };

    socket.on('command:result', handleResult);
    return () => {
      socket.off('command:result', handleResult);
    };
  }, [socket]);

  // Tab suggestions mapping
  const commandList = [
    'help', 'clear', 'whoami', 'uptime', 'ping', 'traceroute', 
    'status', 'fail', 'heal', 'route', 'netstat', 'topology', 
    'predict', 'nodes', 'export', 'ota', 'power'
  ];

  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);

    const parts = val.trim().split(/\s+/);
    if (parts.length === 1 && val !== '') {
      const filtered = commandList.filter(c => c.startsWith(parts[0].toLowerCase()));
      setSuggestions(filtered);
    } else {
      setSuggestions([]);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      const cmd = input.trim();
      if (!cmd) return;

      // Add command to output
      setOutput(prev => [...prev, { text: `> ${cmd}`, type: 'prompt' }]);
      
      // Emit to backend
      socket.emit('command:execute', { command: cmd });
      
      // Save history
      setHistory(prev => [...prev, cmd]);
      setHistoryIndex(-1);
      setInput('');
      setSuggestions([]);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const idx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(idx);
      setInput(history[idx]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex === -1) return;
      if (historyIndex === history.length - 1) {
        setHistoryIndex(-1);
        setInput('');
      } else {
        const idx = historyIndex + 1;
        setHistoryIndex(idx);
        setInput(history[idx]);
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
      if (suggestions.length > 0) {
        setInput(suggestions[0] + ' ');
        setSuggestions([]);
      }
    }
  };

  const getLineColor = (type) => {
    switch (type) {
      case 'error': return '#ff073a';
      case 'warning': return '#ffaa00';
      case 'success': return '#39ff14';
      case 'system': return '#a855f7';
      case 'prompt': return '#ffffff';
      case 'info':
      default:
        return '#00f5ff';
    }
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'calc(100vh - 120px)',
      background: 'var(--bg-0)',
      padding: '1.5rem',
      boxSizing: 'border-box',
      transition: 'background 0.3s ease'
    }}>
      {/* Terminal Title Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.8rem 1.2rem',
        background: 'var(--header-bg)',
        border: '1px solid var(--border-bright)',
        borderBottom: 'none',
        borderRadius: '4px 4px 0 0',
        fontFamily: "'Orbitron', sans-serif",
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Terminal size={18} color="var(--accent)" />
          <span style={{ fontSize: '0.85rem', color: 'var(--text-heading)', letterSpacing: '1px', fontWeight: 'bold' }}>
            AEGISMESH NOC COMMAND INTERFACE
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: isDark ? '#39ff14' : '#059669', fontWeight: 'bold' }}>
          <Shield size={14} />
          SECURE OPERATING MODE
        </div>
      </div>

      {/* Terminal Output Area */}
      <div 
        onClick={() => inputRef.current && inputRef.current.focus()}
        style={{
          flexGrow: 1,
          background: '#02060e',
          border: '1px solid var(--border-bright)',
          padding: '1.5rem',
          overflowY: 'auto',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.9rem',
          lineHeight: '1.4',
          whiteSpace: 'pre-wrap',
          position: 'relative',
          cursor: 'text',
          boxShadow: 'inset 0 0 20px rgba(0,0,0,0.8)'
        }}
      >
        {/* CRT Scanline Effect Overlay */}
        <div style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          background: 'linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))',
          backgroundSize: '100% 4px, 6px 100%',
          pointerEvents: 'none',
          zIndex: 10
        }} />

        {output.map((line, i) => (
          <div 
            key={i} 
            style={{ 
              color: getLineColor(line.type),
              minHeight: '1.2rem',
              textShadow: line.type !== 'prompt' ? `0 0 4px ${getLineColor(line.type)}88` : 'none'
            }}
          >
            {line.text}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Suggestion Bar */}
      {suggestions.length > 0 && (
        <div style={{
          display: 'flex',
          gap: '1rem',
          padding: '0.4rem 1.2rem',
          background: 'var(--surface-sunken)',
          borderLeft: '1px solid var(--border-bright)',
          borderRight: '1px solid var(--border-bright)',
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '0.8rem',
          color: 'var(--text-muted)'
        }}>
          <span>TAB SUGGESTIONS:</span>
          {suggestions.map((s, idx) => (
            <span key={s} style={{ color: idx === 0 ? (isDark ? '#39ff14' : '#059669') : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold' }} onClick={() => {
              setInput(s + ' ');
              setSuggestions([]);
              inputRef.current.focus();
            }}>
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Terminal Input Box */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        padding: '0.8rem 1.2rem',
        background: 'var(--header-bg)',
        border: '1px solid var(--border-bright)',
        borderTop: 'none',
        borderRadius: '0 0 4px 4px',
      }}>
        <span style={{
          fontFamily: "'Share Tech Mono', monospace",
          fontSize: '1rem',
          color: 'var(--accent)',
          marginRight: '0.6rem',
          userSelect: 'none',
          fontWeight: 'bold'
        }}>
          NOC_SHELL &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          style={{
            flexGrow: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: "'Share Tech Mono', monospace",
            fontSize: '1rem',
            color: 'var(--text-primary)',
            caretColor: isDark ? '#39ff14' : '#059669',
            width: '100%'
          }}
        />
      </div>
    </div>
  );
}
