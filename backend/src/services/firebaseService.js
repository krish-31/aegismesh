/**
 * FirebaseService — Handles cloud synchronization of telemetry, events, and failovers
 * dynamically falling back to a mock local database if Firebase config is missing.
 */

let admin = null;
try {
  admin = require('firebase-admin');
} catch (e) {
  console.warn('[Firebase] Warning: firebase-admin package is missing.');
}

class FirebaseService {
  constructor() {
    this.db = null;
    this.initialized = false;
    this.localBuffer = {
      telemetry: {},
      events: [],
      failovers: [],
      snapshots: []
    };

    this.initialize();
  }

  initialize() {
    // Check if configuration files or credentials exist in environment variables
    const hasEnvConfig = process.env.FIREBASE_CREDENTIALS || 
                         (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY);
    
    if (!admin) {
      console.log('[Firebase] Cloud sync disabled: firebase-admin package not available.');
      return;
    }

    if (!hasEnvConfig) {
      console.log('[Firebase] Cloud sync operating in LOCAL MOCK mode (No FIREBASE_CREDENTIALS found).');
      return;
    }

    try {
      let credentials;
      if (process.env.FIREBASE_CREDENTIALS) {
        credentials = admin.credential.cert(JSON.parse(process.env.FIREBASE_CREDENTIALS));
      } else {
        credentials = admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        });
      }

      const dbUrl = process.env.FIREBASE_DATABASE_URL || `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`;

      admin.initializeApp({
        credential: credentials,
        databaseURL: dbUrl
      });

      this.db = admin.database();
      this.initialized = true;
      console.log('[Firebase] ✓ Successfully initialized Cloud connection and synced with RTDB');
    } catch (error) {
      console.error('[Firebase] Failed to initialize real Firebase SDK:', error.message);
      console.log('[Firebase] Falling back to LOCAL MOCK mode.');
    }
  }

  isInitialized() {
    return this.initialized;
  }

  async saveTelemetry(nodeId, data) {
    const timestamp = data.timestamp || new Date().toISOString();
    const payload = { ...data, timestamp };

    // 1. Save locally
    if (!this.localBuffer.telemetry[nodeId]) {
      this.localBuffer.telemetry[nodeId] = [];
    }
    this.localBuffer.telemetry[nodeId].push(payload);
    if (this.localBuffer.telemetry[nodeId].length > 100) {
      this.localBuffer.telemetry[nodeId].shift();
    }

    // 2. Sync to cloud if initialized
    if (this.initialized && this.db) {
      try {
        // Update current state
        await this.db.ref(`live/nodes/${nodeId}/telemetry`).set(payload);
        // Append to history
        await this.db.ref(`history/telemetry/${nodeId}`).push(payload);
      } catch (err) {
        console.error(`[Firebase] Error saving telemetry for ${nodeId}:`, err.message);
      }
    }
  }

  async saveEvent(event) {
    const payload = { 
      ...event, 
      _id: event._id || Date.now() + Math.random(),
      timestamp: event.timestamp || new Date().toISOString() 
    };

    // 1. Save locally
    this.localBuffer.events.unshift(payload);
    if (this.localBuffer.events.length > 200) {
      this.localBuffer.events.pop();
    }

    // 2. Sync to cloud
    if (this.initialized && this.db) {
      try {
        await this.db.ref('live/events').push(payload);
      } catch (err) {
        console.error('[Firebase] Error saving event:', err.message);
      }
    }
  }

  async saveFailoverLog(log) {
    const payload = { 
      ...log, 
      timestamp: log.timestamp || new Date().toISOString() 
    };

    // 1. Save locally
    this.localBuffer.failovers.unshift(payload);
    if (this.localBuffer.failovers.length > 50) {
      this.localBuffer.failovers.pop();
    }

    // 2. Sync to cloud
    if (this.initialized && this.db) {
      try {
        await this.db.ref('live/failovers').push(payload);
      } catch (err) {
        console.error('[Firebase] Error saving failover log:', err.message);
      }
    }
  }

  async saveSnapshot(snapshot) {
    const payload = {
      ...snapshot,
      timestamp: new Date().toISOString()
    };

    // 1. Save locally
    this.localBuffer.snapshots.push(payload);
    if (this.localBuffer.snapshots.length > 20) {
      this.localBuffer.snapshots.shift();
    }

    // 2. Sync to cloud
    if (this.initialized && this.db) {
      try {
        await this.db.ref('live/topology').set(payload);
      } catch (err) {
        console.error('[Firebase] Error saving snapshot:', err.message);
      }
    }
  }
}

module.exports = new FirebaseService();
