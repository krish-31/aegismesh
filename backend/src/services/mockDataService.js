/**
 * MockDataService v2 — Fully in-memory simulation engine (no MongoDB dependency).
 * Emits rich realtime events via Socket.IO every 2s.
 * 
 * MQTT-READY: Topics are defined per node for future ESP32 bridging.
 * When real hardware connects, replace the mock tick with MQTT message handlers.
 */

const topology = require('./topologyService');
const historyService = require('./historyService');
const predictionService = require('./predictionService');
const powerService = require('./powerService');
const playbookService = require('./playbookService');
const replayService = require('./replayService');
const firebaseService = require('./firebaseService');

// In-memory event log (replaces MongoDB Event model)
const inMemoryEvents = [];
const inMemoryAlerts = [];
const MAX_EVENTS = 500;

function pushEvent(evt) {
  const full = { ...evt, _id: Date.now() + Math.random(), timestamp: new Date().toISOString() };
  inMemoryEvents.unshift(full);
  if (inMemoryEvents.length > MAX_EVENTS) inMemoryEvents.length = MAX_EVENTS;
  return full;
}

function pushAlert(alert) {
  const full = { ...alert, _id: Date.now() + Math.random(), timestamp: new Date().toISOString(), acknowledged: false };
  inMemoryAlerts.unshift(full);
  if (inMemoryAlerts.length > 100) inMemoryAlerts.length = 100;
  return full;
}

// Export so API routes can access them
module.exports.getEvents = (limit = 100) => inMemoryEvents.slice(0, limit);
module.exports.getAlerts = (limit = 50)  => inMemoryAlerts.slice(0, limit);

class MockDataService {
  constructor() {
    this.io = null;

    // Per-node base sensor values
    this.baseData = {
      'GW-001':  { temp: 35, humidity: 45, gas: 5,  networkLoad: 60 },
      'ESP32-A': { temp: 28, humidity: 55, gas: 8,  networkLoad: 30 },
      'ESP32-B': { temp: 30, humidity: 60, gas: 12, networkLoad: 45 },
      'ESP32-C': { temp: 27, humidity: 50, gas: 6,  networkLoad: 35 },
      'ESP32-D': { temp: 32, humidity: 65, gas: 15, networkLoad: 55 },
      // Warehouse nodes
      'GW-002':  { temp: 36, humidity: 40, gas: 6,  networkLoad: 65 },
      'ESP32-E': { temp: 29, humidity: 50, gas: 9,  networkLoad: 35 },
      'ESP32-F': { temp: 31, humidity: 55, gas: 13, networkLoad: 50 },
      'ESP32-G': { temp: 28, humidity: 48, gas: 7,  networkLoad: 40 },
      'ESP32-H': { temp: 33, humidity: 60, gas: 16, networkLoad: 60 },
    };

    // MQTT topic map (future ESP32 bridging)
    this.mqttTopics = {
      'GW-001':  'aegismesh/nodes/gw001',
      'ESP32-A': 'aegismesh/nodes/esp32a',
      'ESP32-B': 'aegismesh/nodes/esp32b',
      'ESP32-C': 'aegismesh/nodes/esp32c',
      'ESP32-D': 'aegismesh/nodes/esp32d',
    };

    this.threatLevel     = 15;
    this.attackActive    = false;
    this.packetLossNode  = null;    // node under packet loss injection
    this.highLatencyNode = null;    // node under latency injection
    this.intervals       = [];
    this.tickCount       = 0;
  }

  setIO(io) { this.io = io; }

  emit(event, data) { if (this.io) this.io.emit(event, data); }

  rnd(base, range) { return +(base + (Math.random() - 0.5) * range * 2).toFixed(2); }
  rndBetween(a, b) { return +(Math.random() * (b - a) + a).toFixed(2); }
  randomNode(excludeGW = false) {
    const nodes = Object.values(topology.nodes);
    const filtered = excludeGW ? nodes.filter(n => !n.isGateway) : nodes;
    if (filtered.length === 0) return 'GW-001';
    return filtered[Math.floor(Math.random() * filtered.length)].nodeId;
  }

  // ── Main telemetry tick (every 2s) ────────────────────────────────────────
  telemetryTick() {
    this.tickCount++;
    this.meshSyncTimer = (this.meshSyncTimer || 0) + 1;

    // Tick the power management simulation
    powerService.tick();

    const nodeIds = Object.keys(topology.nodes);

    for (const nodeId of nodeIds) {
      const node = topology.getNode(nodeId);
      if (!node || node.status === 'failed') continue;
      // Skip live ESP32 nodes — their telemetry comes from MQTT
      if (node.mode === 'live') continue;

      const base       = this.baseData[nodeId];
      const isUnstable = node.status === 'unstable';
      const isTarget   = this.packetLossNode === nodeId;
      const isHighLat  = this.highLatencyNode === nodeId;

      // Read battery level from power service
      const powerState = powerService.getNodePower(nodeId);
      const batteryLevel = powerState ? powerState.battery : this.rndBetween(70, 100);

      // Sensor telemetry
      const telemetry = {
        nodeId,
        timestamp:     new Date().toISOString(),
        temperature:   this.rnd(base.temp, isUnstable ? 10 : 3),
        humidity:      Math.min(100, Math.max(0, this.rnd(base.humidity, 5))),
        gasLevel:      Math.max(0, this.rnd(base.gas, isUnstable ? 25 : 4)),
        motionDetected: Math.random() < (isUnstable ? 0.3 : 0.08),
        powerStatus:   powerState ? (powerState.mode === 'CRITICAL' ? 'low' : powerState.mode.toLowerCase()) : 'normal',
        networkLoad:   Math.min(100, Math.max(0, this.rnd(base.networkLoad, isUnstable ? 35 : 12))),
        batteryLevel:  Math.round(batteryLevel),
      };

      // Node metrics
      const latency = isHighLat
        ? this.rndBetween(200, 500)
        : isTarget
          ? this.rndBetween(50, 150)
          : this.rnd(node.latency || 10, 5);

      const packetLoss = isTarget ? this.rndBetween(15, 35) : isUnstable ? this.rndBetween(2, 8) : 0;

      topology.tickHeartbeat(nodeId);
      topology.updateNodeMetrics(nodeId, {
        cpuUsage:     this.rnd(isUnstable ? 65 : 30, isUnstable ? 25 : 15),
        latency:      Math.max(1, latency),
        packetLoss,
        wifiSignal:   this.rnd(node.wifiSignal || -60, 5),
        anomalyScore: this.attackActive ? this.rndBetween(65, 95) : this.rndBetween(0, 15),
        telemetry,
      });

      // Record to history and telemetry
      const updatedNode = topology.getNode(nodeId);
      const fullTelemetry = {
        ...telemetry,
        cpuUsage:   updatedNode.cpuUsage,
        latency:    updatedNode.latency,
        packetLoss: updatedNode.packetLoss,
        wifiSignal: updatedNode.wifiSignal,
      };
      historyService.record(nodeId, fullTelemetry);

      // Feed metrics to AI prediction engine
      const predMetrics = {
        temperature: telemetry.temperature,
        humidity: telemetry.humidity,
        gasLevel: telemetry.gasLevel,
        cpuUsage: updatedNode.cpuUsage,
        latency: updatedNode.latency,
        packetLoss: updatedNode.packetLoss,
      };
      predictionService.ingest(nodeId, predMetrics);

      // Evaluate automated response playbooks
      playbookService.evaluateRules(nodeId, telemetry, updatedNode);

      // Sync to Firebase Cloud
      firebaseService.saveTelemetry(nodeId, telemetry);

      this.emit('telemetry:update', telemetry);
    }

    // Broadcast topology snapshot every tick
    const snapshot = topology.getTopologySnapshot();

    // Sync snapshot to Firebase Cloud
    firebaseService.saveSnapshot(snapshot);

    // Save snap frame to DVR traffic replay service
    replayService.recordSnapshot();

    // Dynamically update stats
    const failedCount  = snapshot.nodes.filter(n => n.status === 'failed').length;
    const threatLevel  = this.attackActive ? this.rndBetween(70, 95) : Math.max(5, this.rnd(this.threatLevel, 10));
    this.threatLevel   = threatLevel;

    this.emit('topology:update', snapshot);
    this.emit('stats:update', {
      totalNodes:       snapshot.nodes.length,
      activeNodes:      snapshot.nodes.length - failedCount,
      failedNodes:      failedCount,
      networkHealth:    snapshot.healthPercentage,
      activeRoutes:     snapshot.activeRoutes,
      packetThroughput: Math.floor(this.rndBetween(2500, 6500)),
      avgLatency:       snapshot.avgLatency,
      threatLevel,
    });
  }

  // ── Event generation tick (every 3s) ──────────────────────────────────────
  eventTick() {
    const r = Math.random();

    let evt;
    if (this.attackActive && r < 0.5) {
      evt = pushEvent({
        type:     'INTRUSION_DETECTED',
        severity: 'CRITICAL',
        message:  `Suspicious traffic on ${this.randomNode()} — possible DDoS [${Math.floor(Math.random() * 5000 + 2000)} pkt/s]`,
        nodeId:   this.randomNode(),
      });
    } else if (r < 0.35) {
      evt = pushEvent({
        type:     'HEARTBEAT',
        severity: 'INFO',
        message:  `Heartbeat OK from ${this.randomNode()} — latency nominal`,
        nodeId:   this.randomNode(),
      });
    } else if (r < 0.55) {
      evt = pushEvent({
        type:     'PACKET_RECEIVED',
        severity: 'INFO',
        message:  `Data packet processed on ${this.randomNode()} — mesh link stable`,
        nodeId:   this.randomNode(),
      });
    } else if (r < 0.65) {
      evt = pushEvent({
        type:     'ROUTE_CHECK',
        severity: 'INFO',
        message:  'Dijkstra route integrity verified — optimal paths confirmed',
        nodeId:   topology.getGatewayId(),
      });
    } else if (r < 0.75) {
      evt = pushEvent({
        type:     'HIGH_LATENCY',
        severity: 'WARNING',
        message:  `Latency spike on ${this.randomNode(true)}: ${Math.floor(Math.random() * 80 + 50)}ms`,
        nodeId:   this.randomNode(true),
      });
    } else if (r < 0.82) {
      evt = pushEvent({
        type:     'PACKET_LOSS',
        severity: 'WARNING',
        message:  `Packet loss ${Math.floor(Math.random() * 8 + 2)}% on mesh link`,
        nodeId:   this.randomNode(true),
      });
    } else if (r < 0.90) {
      evt = pushEvent({
        type:     'SENSOR_READING',
        severity: 'INFO',
        message:  `Sensor data batch received from ${this.randomNode(true)}`,
        nodeId:   this.randomNode(true),
      });
    } else {
      evt = pushEvent({
        type:     'MESH_SYNC',
        severity: 'INFO',
        message:  'Mesh topology synchronized — all nodes in consensus',
        nodeId:   topology.getGatewayId(),
      });
    }

    if (evt) this.emit('event:new', evt);
  }

  // ── Simulation controls ───────────────────────────────────────────────────

  setAttackMode(active, targetNodeId = null) {
    this.attackActive = active;
    this.threatLevel  = active ? this.rndBetween(70, 90) : this.rndBetween(5, 20);
    if (targetNodeId) topology.updateNodeMetrics(targetNodeId, { anomalyScore: active ? 85 : 5 });
  }

  setPacketLossMode(nodeId) {
    this.packetLossNode = nodeId;
  }

  clearPacketLossMode() {
    this.packetLossNode = null;
  }

  setHighLatencyMode(nodeId) {
    this.highLatencyNode = nodeId;
  }

  clearHighLatencyMode(nodeId) {
    if (this.highLatencyNode === nodeId) this.highLatencyNode = null;
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  start() {
    this.intervals.push(setInterval(() => this.telemetryTick(), 2000));
    this.intervals.push(setInterval(() => this.eventTick(), 3000));
    // Initial emit after short delay (let socket clients connect first)
    setTimeout(() => this.telemetryTick(), 500);
    console.log('[MockData] ✓ Simulation engine started');
  }

  stop() {
    this.intervals.forEach(i => clearInterval(i));
    this.intervals = [];
  }
}

const instance = new MockDataService();
module.exports = instance;

function clearAlerts() {
  inMemoryAlerts.length = 0;
}

// Re-export helpers on the same module object
module.exports.getEvents = (limit = 100) => inMemoryEvents.slice(0, limit);
module.exports.getAlerts = (limit = 50)  => inMemoryAlerts.slice(0, limit);
module.exports.pushEvent  = pushEvent;
module.exports.pushAlert  = pushAlert;
module.exports.clearAlerts = clearAlerts;
