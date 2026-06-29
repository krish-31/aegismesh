/**
 * AegisMesh Alert Sounds — Web Audio API synthesized alert tones.
 *
 * playNodeFailedSound()    → sharp descending alarm beep (critical)
 * playNodeRecoveredSound() → pleasant ascending chime    (recovery)
 *
 * All tones are generated programmatically — no external audio files required.
 *
 * Browser auto-play policy: An AudioContext can only produce sound after at
 * least ONE user gesture (click / keydown / touchstart).  We eagerly listen
 * for the first gesture and resume the context at that point, so by the time
 * a node-failure event arrives the context is already unlocked.
 */

let audioCtx = null;
let contextReady = false;

/**
 * Eagerly create the AudioContext and install one-time listeners that
 * resume it on the very first user interaction (click / key / touch).
 */
function ensureAudioContext() {
  if (audioCtx) return audioCtx;

  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    console.warn('[AegisMesh Sound] Web Audio API not available:', e);
    return null;
  }

  const unlock = () => {
    if (contextReady) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(() => {
        contextReady = true;
        console.log('[AegisMesh Sound] AudioContext unlocked ✓');
      });
    } else {
      contextReady = true;
    }
    // Remove listeners once unlocked — they are no longer needed
    document.removeEventListener('click', unlock, true);
    document.removeEventListener('keydown', unlock, true);
    document.removeEventListener('touchstart', unlock, true);
  };

  // Capture-phase so we catch the gesture before anything can stopPropagation
  document.addEventListener('click', unlock, true);
  document.addEventListener('keydown', unlock, true);
  document.addEventListener('touchstart', unlock, true);

  // If already running (e.g. user already interacted), mark ready immediately
  if (audioCtx.state === 'running') {
    contextReady = true;
  }

  return audioCtx;
}

// Kick off context creation as soon as this module loads
ensureAudioContext();

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Play a single tone with envelope shaping.
 */
function playTone(frequency, startTime, duration, type = 'sine', volume = 0.3, endFreq = null) {
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(frequency, startTime);

  if (endFreq !== null) {
    osc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }

  // Envelope: quick attack, sustain, smooth release
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.015);
  gain.gain.setValueAtTime(volume, startTime + duration * 0.65);
  gain.gain.linearRampToValueAtTime(0, startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(startTime);
  osc.stop(startTime + duration + 0.05);
}

// ── Public API ───────────────────────────────────────────────────────────────

function _scheduleFailedTones(ctx) {
  const now = ctx.currentTime;
  playTone(880, now, 0.18, 'square', 0.25, 440);
  playTone(660, now + 0.22, 0.18, 'square', 0.25, 330);
  playTone(440, now + 0.44, 0.25, 'square', 0.20, 220);
}

function _scheduleRecoveredTones(ctx) {
  const now = ctx.currentTime;
  playTone(523.25, now, 0.12, 'triangle', 0.25);
  playTone(659.25, now + 0.14, 0.12, 'triangle', 0.25);
  playTone(783.99, now + 0.28, 0.22, 'triangle', 0.25);
  playTone(1046.50, now + 0.44, 0.30, 'sine', 0.18);
}

/**
 * 🔴 Node FAILED — urgent descending alarm.
 */
export function playNodeFailedSound() {
  console.log('[AegisMesh Sound] 🔴 playNodeFailedSound() called');
  const ctx = ensureAudioContext();
  if (!ctx) { console.warn('[AegisMesh Sound] No AudioContext'); return; }

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[AegisMesh Sound] Context resumed → playing failure alarm');
        _scheduleFailedTones(ctx);
      }).catch(e => console.warn('[AegisMesh Sound] Resume failed:', e));
    } else {
      _scheduleFailedTones(ctx);
    }
  } catch (err) {
    console.warn('[AegisMesh Sound] Error in playNodeFailedSound:', err);
  }
}

/**
 * 🟢 Node RECOVERED — pleasant ascending chime.
 */
export function playNodeRecoveredSound() {
  console.log('[AegisMesh Sound] 🟢 playNodeRecoveredSound() called');
  const ctx = ensureAudioContext();
  if (!ctx) { console.warn('[AegisMesh Sound] No AudioContext'); return; }

  try {
    if (ctx.state === 'suspended') {
      ctx.resume().then(() => {
        console.log('[AegisMesh Sound] Context resumed → playing recovery chime');
        _scheduleRecoveredTones(ctx);
      }).catch(e => console.warn('[AegisMesh Sound] Resume failed:', e));
    } else {
      _scheduleRecoveredTones(ctx);
    }
  } catch (err) {
    console.warn('[AegisMesh Sound] Error in playNodeRecoveredSound:', err);
  }
}

