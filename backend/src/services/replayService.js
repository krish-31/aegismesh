/**
 * ReplayService — Network Traffic DVR / Session Replay Engine
 *
 * Captures sequential system topology snapshots and allows users to
 * scrub, rewind, and play back historical states at custom speeds.
 */

const topology = require('./topologyService');
const firebaseService = require('./firebaseService');

class ReplayService {
  constructor() {
    this.io = null;
    this.history = []; // Array of { timestamp, snapshot, event }
    this.recording = true;
    this.maxBufferSize = 1800; // 1 hr at 2s intervals
    
    // Playback state
    this.playbackIndex = -1;
    this.playbackInterval = null;
    this.playbackSpeed = 1; // 1x, 2x, 5x, 10x
    this.isPlaying = false;
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  recordSnapshot(eventTrigger = null) {
    if (!this.recording) return;

    const snap = topology.getTopologySnapshot();
    const entry = {
      timestamp: new Date().toISOString(),
      snapshot: snap,
      eventTrigger: eventTrigger || 'PERIODIC_TICK'
    };

    this.history.push(entry);
    if (this.history.length > this.maxBufferSize) {
      this.history.shift();
    }

    this.emit('replay:recorded', { totalFrames: this.history.length });
  }

  getHistory() {
    return this.history.map((e, idx) => ({
      index: idx,
      timestamp: e.timestamp,
      eventTrigger: e.eventTrigger,
      health: e.snapshot.healthPercentage,
      nodesOnline: e.snapshot.nodes.filter(n => n.status !== 'failed').length
    }));
  }

  getFrame(index) {
    if (index >= 0 && index < this.history.length) {
      return this.history[index];
    }
    return null;
  }

  startPlayback(speed = 1) {
    if (this.history.length === 0) return false;
    this.stopPlayback(); // clear any previous timers
    
    this.isPlaying = true;
    this.playbackSpeed = speed;
    if (this.playbackIndex === -1 || this.playbackIndex >= this.history.length - 1) {
      this.playbackIndex = 0;
    }

    const baseDelay = 2000; // default tick rate is 2s
    const tickDelay = Math.max(200, baseDelay / speed);

    this.playbackInterval = setInterval(() => {
      this.playbackIndex++;
      if (this.playbackIndex >= this.history.length) {
        this.stopPlayback();
        this.emit('replay:finished', {});
        return;
      }

      const frame = this.history[this.playbackIndex];
      this.emit('replay:frame', {
        index: this.playbackIndex,
        total: this.history.length,
        frame
      });
    }, tickDelay);

    this.emit('replay:state', { isPlaying: true, speed, currentIndex: this.playbackIndex });
    return true;
  }

  pausePlayback() {
    if (this.playbackInterval) {
      clearInterval(this.playbackInterval);
      this.playbackInterval = null;
    }
    this.isPlaying = false;
    this.emit('replay:state', { isPlaying: false, speed: this.playbackSpeed, currentIndex: this.playbackIndex });
  }

  stopPlayback() {
    this.pausePlayback();
    this.playbackIndex = -1;
    this.emit('replay:state', { isPlaying: false, speed: this.playbackSpeed, currentIndex: -1 });
  }

  setPlaybackIndex(index) {
    if (index >= 0 && index < this.history.length) {
      this.playbackIndex = index;
      const frame = this.history[index];
      this.emit('replay:frame', {
        index: this.playbackIndex,
        total: this.history.length,
        frame
      });
      return true;
    }
    return false;
  }

  async saveSession(name) {
    const payload = {
      name,
      recordedAt: new Date().toISOString(),
      frameCount: this.history.length,
      history: this.history
    };

    if (firebaseService.isInitialized()) {
      try {
        await firebaseService.db.ref(`sessions/${name}`).set(payload);
        return { success: true, mode: 'cloud' };
      } catch (err) {
        console.error('[Replay] Error saving session to Firebase:', err.message);
      }
    }

    return { success: true, mode: 'local', msg: 'Saved locally in server memory buffer' };
  }
}

module.exports = new ReplayService();
