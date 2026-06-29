/**
 * SecurityHandshakeService — Zero-Trust Cryptographic Admission Controls
 * Handles challenge/response node authentication, key rotation, and threat quarantine.
 */

const topology = require('./topologyService');
const mockData = require('./mockDataService');
const notificationService = require('./notificationService');

class SecurityHandshakeService {
  constructor() {
    this.io = null;
    this.keys = {
      'GW-001':  { publicKey: 'aegis-pub-gw-001-9988ff',  status: 'admitted', admitted: true,  role: 'gateway' },
      'ESP32-A': { publicKey: 'aegis-pub-esp-32a-1122aa', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-B': { publicKey: 'aegis-pub-esp-32b-3344bb', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-C': { publicKey: 'aegis-pub-esp-32c-5566cc', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-D': { publicKey: 'aegis-pub-esp-32d-7788dd', status: 'admitted', admitted: true,  role: 'node' },
      'GW-002':  { publicKey: 'aegis-pub-gw-002-9988ff',  status: 'admitted', admitted: true,  role: 'gateway' },
      'ESP32-E': { publicKey: 'aegis-pub-esp-32e-1122aa', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-F': { publicKey: 'aegis-pub-esp-32f-3344bb', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-G': { publicKey: 'aegis-pub-esp-32g-5566cc', status: 'admitted', admitted: true,  role: 'node' },
      'ESP32-H': { publicKey: 'aegis-pub-esp-32h-7788dd', status: 'admitted', admitted: true,  role: 'node' },
    };
    this.handshakeLogs = [];
    this.challenges = new Map(); // nodeId -> challenge string
    this.quarantinedNodes = new Set();
    this.rogueSimulators = new Set();

    // Initialize with some dummy historical logs
    this.log('GW-001', 'ADMISSION', 'SUCCESS', 'Gateway Trust Root Initialized successfully with signature key.');
    this.log('ESP32-A', 'ADMISSION', 'SUCCESS', 'Cryptographic handshake completed successfully. Admitted to mesh.');
    this.log('ESP32-B', 'ADMISSION', 'SUCCESS', 'Cryptographic handshake completed successfully. Admitted to mesh.');
    this.log('ESP32-C', 'ADMISSION', 'SUCCESS', 'Cryptographic handshake completed successfully. Admitted to mesh.');
    this.log('ESP32-D', 'ADMISSION', 'SUCCESS', 'Cryptographic handshake completed successfully. Admitted to mesh.');
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  log(nodeId, type, status, message) {
    const logEntry = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      timestamp: new Date().toISOString(),
      nodeId,
      type, // CHALLENGE, RESPONSE, VERIFICATION, QUARANTINE, ADMISSION, THREAT_SIM
      status, // SUCCESS, FAILED, INFO, WARNING
      message,
    };
    this.handshakeLogs.unshift(logEntry);
    this.handshakeLogs = this.handshakeLogs.slice(0, 100);
    this.emit('security:log', logEntry);
  }

  getLogs() {
    return this.handshakeLogs;
  }

  getKeys() {
    return Object.entries(this.keys)
      .filter(([nodeId]) => topology.getNode(nodeId) !== null)
      .map(([nodeId, info]) => ({
        nodeId,
        ...info
      }));
  }

  // Stage 1: Request Admission & Send Public Key
  requestAdmission(nodeId, publicKey) {
    this.keys[nodeId] = {
      publicKey,
      status: 'pending',
      admitted: false,
      role: 'node'
    };
    this.log(nodeId, 'CHALLENGE', 'INFO', `Node requested mesh connection. Key received: ${publicKey.substr(0, 15)}...`);

    // Generate challenge
    const challenge = `chal-${Math.random().toString(36).substr(2, 9)}`;
    this.challenges.set(nodeId, challenge);
    
    this.emit('security:update', { keys: this.getKeys() });
    return challenge;
  }

  // Stage 2: Verify Cryptographic Response
  verifyResponse(nodeId, responseSignature) {
    const challenge = this.challenges.get(nodeId);
    if (!challenge) {
      this.log(nodeId, 'VERIFICATION', 'FAILED', 'Admission rejected: challenge session expired or invalid.');
      return false;
    }

    const expectedSignature = `sig-${challenge}-${nodeId}`;
    
    // Simulate forged challenge check
    if (responseSignature !== expectedSignature || this.rogueSimulators.has(nodeId)) {
      this.log(nodeId, 'VERIFICATION', 'FAILED', `Cryptographic challenge failed! Signature mismatch. Target isolated.`);
      this.quarantineNode(nodeId, 'Cryptographic Verification Failure / Unauthorized Credentials');
      return false;
    }

    // Success
    this.challenges.delete(nodeId);
    this.keys[nodeId].status = 'admitted';
    this.keys[nodeId].admitted = true;
    this.quarantinedNodes.delete(nodeId);
    
    this.log(nodeId, 'VERIFICATION', 'SUCCESS', 'Cryptographic signature verified successfully.');
    this.log(nodeId, 'ADMISSION', 'SUCCESS', `Zero-Trust Admission complete. Granted node status: HEALTHY.`);
    
    // Recover node status
    topology.updateNodeStatus(nodeId, 'healthy');
    this.emit('security:update', { keys: this.getKeys() });
    return true;
  }

  // Quarantine node manually or automatically
  quarantineNode(nodeId, reason) {
    if (!this.keys[nodeId]) {
      this.keys[nodeId] = { publicKey: 'unknown-revoked-key', admitted: false, role: 'node' };
    }
    
    this.keys[nodeId].status = 'quarantined';
    this.keys[nodeId].admitted = false;
    this.quarantinedNodes.add(nodeId);

    // Quarantine inside topology
    topology.updateNodeStatus(nodeId, 'quarantined');
    topology.updateNodeMetrics(nodeId, { threatLevel: 90, anomalyScore: 85 });
    
    this.log(nodeId, 'QUARANTINE', 'WARNING', `SECURITY ALARM: Node quarantined. Reason: ${reason}`);
    
    notificationService.sendAlert(nodeId, 'NODE_QUARANTINED', `🚨 ZERO-TRUST ISOLATION: Node ${nodeId} quarantined. Reason: ${reason}`, 'CRITICAL');
    
    const evt = mockData.pushEvent({
      type:     'NODE_QUARANTINED',
      severity: 'CRITICAL',
      message:  `🚨 ZERO-TRUST ISOLATION: Node ${nodeId} quarantined — Reason: ${reason}`,
      nodeId,
    });
    this.emit('event:new', evt);
    this.emit('security:update', { keys: this.getKeys() });
    this.emit('topology:update', topology.getTopologySnapshot());
  }

  // Lift quarantine
  liftQuarantine(nodeId) {
    if (!this.keys[nodeId]) return;

    this.keys[nodeId].status = 'admitted';
    this.keys[nodeId].admitted = true;
    this.quarantinedNodes.delete(nodeId);
    this.rogueSimulators.delete(nodeId);

    topology.updateNodeStatus(nodeId, 'healthy');
    topology.updateNodeMetrics(nodeId, { threatLevel: 0, anomalyScore: 0 });

    this.log(nodeId, 'ADMISSION', 'SUCCESS', 'Quarantine lifted manually by Network Operator. Trust restored.');
    
    notificationService.sendAlert(nodeId, 'QUARANTINE_LIFTED', `✓ Trust restored on node ${nodeId} — isolation lifted`, 'INFO');

    const evt = mockData.pushEvent({
      type:     'QUARANTINE_LIFTED',
      severity: 'INFO',
      message:  `✓ Quarantine lifted for ${nodeId} — trust status verified`,
      nodeId,
    });
    this.emit('event:new', evt);
    this.emit('security:update', { keys: this.getKeys() });
    this.emit('topology:update', topology.getTopologySnapshot());
  }

  // Threat Simulation: Simulate Rogue Node (MitM)
  simulateRogueNode(nodeId) {
    if (!topology.getNode(nodeId)) return false;

    this.log(nodeId, 'THREAT_SIM', 'WARNING', 'Rogue node attack simulation triggered by operator.');
    this.rogueSimulators.add(nodeId);

    // Make node spoof routing advertisements (change neighbor weights to 0 internally)
    topology.updateNodeMetrics(nodeId, { anomalyScore: 99, threatLevel: 95 });
    
    this.emit('threat:attack', { nodeId, type: 'MITM', intensity: 99 });
    
    notificationService.sendAlert(nodeId, 'MITM_ATTACK_DETECTED', `⚡ SECURITY ALARM: Rogue/MitM routing advertisements detected on node ${nodeId}!`, 'CRITICAL');

    // Trigger automated Zero-Trust signature verification check after 3 seconds
    setTimeout(() => {
      if (this.rogueSimulators.has(nodeId)) {
        this.log(nodeId, 'VERIFICATION', 'FAILED', 'Automated audit: cryptographic challenge response verification failed.');
        this.quarantineNode(nodeId, 'Intrusion Detection System: Signature validation failed (Spoofed advertisements)');
      }
    }, 3000);

    return true;
  }
}

module.exports = new SecurityHandshakeService();
