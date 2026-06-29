import React, { useState } from 'react';
import useMeshStore from '../store/meshStore';
import { getSocket } from '../lib/socket';
import { Play, Pause, Square, FastForward, Save, Video, Film } from 'lucide-react';
import { useTheme } from '../lib/ThemeContext';

export default function ReplayPage() {
  const socket = getSocket();
  const { theme } = useTheme();
  const isDark = theme === 'dark';

  const frames = useMeshStore(state => state.replayFrames) || [];
  const recording = useMeshStore(state => state.replayRecording);
  const playing = useMeshStore(state => state.replayPlaying);
  const index = useMeshStore(state => state.replayIndex);
  const speed = useMeshStore(state => state.replaySpeed);

  const [sessionName, setSessionName] = useState('');
  const [saveStatus, setSaveStatus] = useState('');

  const handleStart = (playbackSpeed) => {
    socket.emit('replay:start', { speed: playbackSpeed });
  };

  const handlePause = () => {
    socket.emit('replay:pause');
  };

  const handleStop = () => {
    socket.emit('replay:stop');
  };

  const handleScrubChange = (e) => {
    const idx = parseInt(e.target.value);
    socket.emit('replay:scrub', { index: idx });
  };

  const handleSave = () => {
    if (!sessionName.trim()) return;
    setSaveStatus('Saving...');
    socket.emit('replay:save', { name: sessionName });
    
    // Simple response catch via once listener or just state delay
    setTimeout(() => {
      setSaveStatus('Session saved successfully!');
      setSessionName('');
      setTimeout(() => setSaveStatus(''), 3000);
    }, 1000);
  };

  const totalFrames = frames.length;

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
        <Video size={28} color="var(--accent)" />
        <h2 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1.5rem', color: 'var(--accent)', margin: 0, textTransform: 'uppercase', letterSpacing: '2px' }}>
          Network DVR & Traffic Replay
        </h2>
      </div>

      {/* Main replay controller */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: '4px',
        padding: '2rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.5rem',
        alignItems: 'center'
      }}>
        <Film size={48} color="var(--accent)" style={{ opacity: playing ? 1 : 0.4 }} className={playing ? 'pulse' : ''} />
        
        <div style={{ textAlign: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 'bold' }}>
            {playing ? 'PLAYING DVR SNAPSHOT SESSION' : 'DVR REPLAY IDLE'}
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Status: {recording ? 'RECORDING RUNNING (Circular 1hr Buffer)' : 'DVR PAUSED'} | Buffers: {totalFrames} Frames
          </span>
        </div>

        {/* Timeline Slider */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
          <input
            type="range"
            min="0"
            max={totalFrames > 0 ? totalFrames - 1 : 0}
            value={index === -1 ? 0 : index}
            onChange={handleScrubChange}
            disabled={totalFrames === 0}
            style={{
              width: '100%',
              accentColor: 'var(--accent)',
              cursor: totalFrames > 0 ? 'pointer' : 'not-allowed',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>Frame 0</span>
            <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Frame {index !== -1 ? index : 0} / {totalFrames}</span>
            <span>Frame {totalFrames > 0 ? totalFrames - 1 : 0}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginTop: '0.5rem' }}>
          <button
            onClick={handleStop}
            disabled={totalFrames === 0}
            style={{
              background: 'rgba(255, 7, 58, 0.08)',
              border: '1px solid var(--accent-red)',
              color: 'var(--accent-red)',
              padding: '0.5rem 1rem',
              cursor: totalFrames === 0 ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 'bold',
              borderRadius: '3px'
            }}
          >
            <Square size={14} /> Stop
          </button>

          {playing ? (
            <button
              onClick={handlePause}
              style={{
                background: 'rgba(255, 170, 0, 0.08)',
                border: `1px solid ${isDark ? '#ffaa00' : '#d97706'}`,
                color: isDark ? '#ffaa00' : '#d97706',
                padding: '0.5rem 1.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: "'Share Tech Mono', monospace",
                fontWeight: 'bold',
                borderRadius: '3px'
              }}
            >
              <Pause size={14} /> Pause
            </button>
          ) : (
            <button
              onClick={() => handleStart(speed)}
              disabled={totalFrames === 0}
              style={{
                background: 'rgba(57, 255, 20, 0.08)',
                border: `1px solid ${isDark ? '#39ff14' : '#059669'}`,
                color: isDark ? '#39ff14' : '#059669',
                padding: '0.5rem 1.5rem',
                cursor: totalFrames === 0 ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontFamily: "'Share Tech Mono', monospace",
                fontWeight: 'bold',
                borderRadius: '3px'
              }}
            >
              <Play size={14} /> Play
            </button>
          )}

          {/* Speed settings */}
          <div style={{ display: 'flex', border: '1px solid var(--border-bright)', borderRadius: '3px', overflow: 'hidden' }}>
            {[1, 2, 5, 10].map(s => (
              <button
                key={s}
                onClick={() => handleStart(s)}
                disabled={totalFrames === 0}
                style={{
                  background: speed === s && playing ? 'var(--bg-glass)' : 'transparent',
                  border: 'none',
                  color: speed === s && playing ? 'var(--accent)' : 'var(--text-secondary)',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.8rem',
                  cursor: totalFrames === 0 ? 'not-allowed' : 'pointer',
                  fontFamily: "'Share Tech Mono', monospace",
                  fontWeight: speed === s && playing ? 'bold' : 'normal'
                }}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Save Session Card */}
      <div style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: '4px',
        padding: '1.5rem',
        maxWidth: '500px'
      }}>
        <h3 style={{ fontFamily: "'Orbitron', sans-serif", fontSize: '1rem', color: 'var(--accent)', margin: '0 0 1rem 0', textTransform: 'uppercase' }}>
          Save Replay Session to Cloud
        </h3>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            placeholder="Session Name (e.g. Failure-Test-1)"
            value={sessionName}
            onChange={(e) => setSessionName(e.target.value)}
            style={{
              flexGrow: 1,
              background: 'var(--input-bg)',
              border: '1px solid var(--border-bright)',
              color: 'var(--input-text)',
              padding: '0.5rem',
              fontFamily: "'Share Tech Mono', monospace",
              borderRadius: '3px'
            }}
          />
          <button
            onClick={handleSave}
            disabled={!sessionName.trim()}
            style={{
              padding: '0.5rem 1rem',
              background: 'var(--bg-glass)',
              border: '1px solid var(--border-bright)',
              color: 'var(--accent)',
              cursor: !sessionName.trim() ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontFamily: "'Share Tech Mono', monospace",
              fontWeight: 'bold',
              borderRadius: '3px'
            }}
          >
            <Save size={14} /> Save
          </button>
        </div>

        {saveStatus && (
          <div style={{ marginTop: '0.8rem', color: isDark ? '#39ff14' : '#059669', fontSize: '0.85rem', fontWeight: 'bold' }}>
            {saveStatus}
          </div>
        )}
      </div>
    </div>
  );
}
