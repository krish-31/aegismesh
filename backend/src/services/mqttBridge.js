/**
 * MQTTBridge v1 — Embedded Aedes MQTT broker + topic handler
 *
 * Starts an Aedes MQTT broker on port 1883.
 * Subscribes to aegismesh/nodes/# topics for live ESP32 integration.
 * Auto-registers ESP32 devices and feeds telemetry into topologyService.
 *
 * Topics:
 *   aegismesh/nodes/{nodeId}/heartbeat   → JSON { rssi, latency, uptime, fw }
 *   aegismesh/nodes/{nodeId}/telemetry   → JSON { temperature, humidity, gasLevel, motionDetected, ... }
 *   aegismesh/nodes/{nodeId}/status      → JSON { status: 'online'|'offline' }
 *   aegismesh/nodes/{nodeId}/register    → JSON { label, ipAddress, nodeType, firmwareVersion }
 */

const aedes   = require('aedes')();
const net     = require('net');
const mqtt    = require('mqtt');
const topology = require('./topologyService');
const mockData = require('./mockDataService');
const historyService    = require('./historyService');
const predictionService = require('./predictionService');

const MQTT_PORT = 1883;

class MQTTBridge {
  constructor() {
    this.io              = null;
    this.server          = null;
    this.mqttClient      = null;   // external broker subscriber (fallback)
    this.connectedNodes  = new Map();   // nodeId → { lastSeen, ipAddress, fw }
    this.clientNodeMap    = new Map();   // MQTT clientId → nodeId
    this.reconnectCount  = 0;
    this.brokerStartTime = null;
    this.brokerOnline    = false;
    this.lastTopologyEmit = 0;
    this.topologyTimeout = null;
  }

  setIO(io) { this.io = io; }

  emit(event, data) { if (this.io) this.io.emit(event, data); }

  /**
   * Resolve an MQTT client ID (e.g. "ESP32-A_xxxx") to a topology nodeId.
   * Checks: explicit clientNodeMap → connectedNodes → direct topology lookup.
   */
  _resolveClientToNodeId(clientId) {
    if (!clientId) return null;

    // 1. Explicit mapping (stored during registration / heartbeat)
    if (this.clientNodeMap.has(clientId)) {
      return this.clientNodeMap.get(clientId);
    }

    // 2. Try common ESP naming patterns: "ESP32-A", "ESP32-A_1234", "aegismesh-ESP32-A"
    const patterns = [
      /^(ESP32-[A-Z])/i,
      /^(GW-\d+)/i,
      /aegismesh[_-]?(ESP32-[A-Z]|GW-\d+)/i,
    ];
    for (const re of patterns) {
      const m = clientId.match(re);
      if (m) {
        const candidate = m[1].toUpperCase();
        if (topology.getNode(candidate)) return candidate;
        // Also check the NODE_MAPS for mesh-mapped IDs
        const activeMesh = topology.activeMeshId || 'mesh-hq';
        const NODE_MAPS = {
          'mesh-hq': { 'ESP32-E': 'ESP32-A', 'ESP32-F': 'ESP32-B', 'ESP32-G': 'ESP32-C', 'ESP32-H': 'ESP32-D' },
          'mesh-warehouse': { 'ESP32-A': 'ESP32-E', 'ESP32-B': 'ESP32-F', 'ESP32-C': 'ESP32-G', 'ESP32-D': 'ESP32-H' },
        };
        const mapped = NODE_MAPS[activeMesh]?.[candidate];
        if (mapped && topology.getNode(mapped)) return mapped;
      }
    }

    // 3. Direct topology lookup (clientId IS the nodeId)
    if (topology.getNode(clientId)) return clientId;

    return null;
  }

  _emitTopology() {
    const now = Date.now();
    if (now - this.lastTopologyEmit > 1000) {
      this.emit('topology:update', topology.getTopologySnapshot());
      this.lastTopologyEmit = now;
      if (this.topologyTimeout) { clearTimeout(this.topologyTimeout); this.topologyTimeout = null; }
    } else if (!this.topologyTimeout) {
      this.topologyTimeout = setTimeout(() => {
        this.emit('topology:update', topology.getTopologySnapshot());
        this.lastTopologyEmit = Date.now();
        this.topologyTimeout = null;
      }, 1000 - (now - this.lastTopologyEmit));
    }
  }

  // ── Start embedded Aedes broker ─────────────────────────────────────────
  start() {
    const externalBrokerUrl = process.env.MQTT_BROKER_URL;
    if (externalBrokerUrl) {
      console.log(`[MQTT] Cloud broker URL configured: ${externalBrokerUrl}`);
      this.brokerOnline    = true;
      this.brokerStartTime = Date.now();
      this._connectExternalBroker(externalBrokerUrl);
      
      // ── Periodic status broadcast ────────────────────────────────────────
      setInterval(() => this._broadcastMQTTStatus(), 10000);
      return;
    }

    this.server = net.createServer(aedes.handle);

    this.server.listen(MQTT_PORT, () => {
      this.brokerOnline    = true;
      this.brokerStartTime = Date.now();
      console.log(`[MQTT] ✓ Aedes broker listening on port ${MQTT_PORT}`);
    });

    this.server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        console.log(`[MQTT] ⚠ Port ${MQTT_PORT} in use — connecting as subscriber to external broker...`);
        this.brokerOnline    = true;
        this.brokerStartTime = Date.now();
        // ── Bridge: subscribe to external Mosquitto so hardware messages arrive ──
        this._connectExternalBroker();
      } else {
        console.error('[MQTT] Broker error:', err.message);
      }
    });

    // ── Aedes events ────────────────────────────────────────────────────
    aedes.on('client', (client) => {
      console.log(`[MQTT] Client connected: ${client.id}`);
      this.reconnectCount++;

      // Resolve MQTT client ID to a topology node ID and auto-recover
      const nodeId = this._resolveClientToNodeId(client.id);
      if (nodeId) {
        // Store mapping so clientDisconnect can resolve this client later
        this.clientNodeMap.set(client.id, nodeId);
        const node = topology.getNode(nodeId);
        if (node && node.status === 'failed') {
          console.log(`[MQTT] ✓ Live node ${nodeId} reconnected via broker — recovering`);
          topology.updateNodeStatus(nodeId, 'healthy');
          this.emit('node:recovered', { nodeId, label: node.label });
          this._emitTopology();

          const evt = mockData.pushEvent({
            type:     'NODE_RECOVERED',
            severity: 'INFO',
            message:  `✓ ${node.label} [${nodeId}] reconnected to MQTT broker`,
            nodeId,
          });
          this.emit('event:new', evt);
        }
      }
    });

    aedes.on('clientDisconnect', (client) => {
      console.log(`[MQTT] Client disconnected: ${client.id}`);

      // Resolve MQTT client ID to a topology node ID and mark failed
      const nodeId = this._resolveClientToNodeId(client.id);
      if (nodeId) {
        const node = topology.getNode(nodeId);
        if (node && node.mode === 'live' && node.status !== 'failed') {
          console.log(`[MQTT] ✗ Live node ${nodeId} disconnected from broker — marking FAILED`);
          topology.updateNodeStatus(nodeId, 'failed');
          this.emit('node:failed', { nodeId, label: node.label });
          this._emitTopology();

          const evt = mockData.pushEvent({
            type:     'NODE_FAILED',
            severity: 'CRITICAL',
            message:  `⚠ ${node.label} [${nodeId}] disconnected from MQTT broker`,
            nodeId,
          });
          this.emit('event:new', evt);
        }
      }
    });

    aedes.on('publish', (packet, client) => {
      if (!client) return; // skip internal ($SYS) messages
      console.log(`[MQTT Broker] Publish from ${client.id} on ${packet.topic}: ${packet.payload.toString()}`);
      this._handleMessage(packet.topic, packet.payload.toString());
    });

    // ── Periodic status broadcast ────────────────────────────────────────
    setInterval(() => this._broadcastMQTTStatus(), 10000);

    // ── UDP Broadcast Auto-Discovery Responder ───────────────────────────
    try {
      const dgram = require('dgram');
      const udpServer = dgram.createSocket('udp4');

      udpServer.on('message', (msg, rinfo) => {
        if (msg.toString() === 'AEGISMESH_DISCOVER') {
          console.log(`[Discovery] Received auto-discover packet from ESP32 at ${rinfo.address}:${rinfo.port}`);
          const response = Buffer.from('AEGISMESH_REPORT');
          udpServer.send(response, 0, response.length, rinfo.port, rinfo.address, (err) => {
            if (err) console.error('[Discovery] Failed to send discovery reply:', err.message);
          });
        }
      });

      udpServer.on('error', (err) => {
        console.error('[Discovery] UDP Discovery server error:', err.message);
      });

      udpServer.bind(4001, () => {
        udpServer.setBroadcast(true);
        console.log('[Discovery] ✓ UDP Auto-Discovery listener active on port 4001');
      });
    } catch (err) {
      console.error('[Discovery] Failed to start UDP Discovery server:', err.message);
    }
  }

  _connectExternalBroker(brokerUrl) {
    let url = brokerUrl || `mqtt://localhost:${MQTT_PORT}`;
    
    if (brokerUrl && !brokerUrl.includes('://')) {
      if (brokerUrl.includes(':8883') || brokerUrl.includes('hivemq.cloud')) {
        url = `mqtts://${brokerUrl}`;
      } else {
        url = `mqtt://${brokerUrl}`;
      }
      console.log(`[MQTT] Auto-resolved missing protocol: ${url}`);
    }

    const options = {
      clientId: `aegismesh-backend-${Date.now()}`,
      keepalive: 30,
      reconnectPeriod: 3000,
      rejectUnauthorized: false,
    };

    if (process.env.MQTT_USERNAME) {
      options.username = process.env.MQTT_USERNAME;
    }
    if (process.env.MQTT_PASSWORD) {
      options.password = process.env.MQTT_PASSWORD;
    }

    this.mqttClient = mqtt.connect(url, options);

    this.mqttClient.on('connect', () => {
      console.log(`[MQTT] ✓ Subscribed to external broker at ${url}`);
      this.mqttClient.subscribe('aegismesh/nodes/#', { qos: 1 }, (err) => {
        if (err) console.error('[MQTT] Subscribe error:', err.message);
        else console.log('[MQTT] ✓ Listening on aegismesh/nodes/# via external broker');
      });
    });

    this.mqttClient.on('message', (topic, payload) => {
      this._handleMessage(topic, payload.toString());
    });

    this.mqttClient.on('reconnect', () => {
      this.reconnectCount++;
      console.log('[MQTT] Reconnecting to external broker...');
    });

    this.mqttClient.on('error', (err) => {
      console.error('[MQTT] External broker error:', err.message);
    });
  }

  // ── Topic message router ───────────────────────────────────────────────
  _handleMessage(topic, payloadStr) {
    try {
      // Topic format: aegismesh/nodes/{nodeId}/{type}
      const parts = topic.split('/');
      if (parts.length < 4 || parts[0] !== 'aegismesh' || parts[1] !== 'nodes') return;

      let nodeId  = parts[2];
      const msgType = parts[3];
      const payload = JSON.parse(payloadStr);

      // Clean up nodeId (remove any [HW] or (HW) suffixes if they exist)
      const baseNodeId = nodeId.replace(/[\s\[\(]+HW[\s\]\)]*/i, '').trim();
      const activeMesh = topology.activeMeshId || 'mesh-hq';
      const NODE_MAPS = {
        'mesh-hq': {
          'GW-001': 'GW-001',
          'GW-002': 'GW-001',
          'ESP32-E': 'ESP32-A',
          'ESP32-F': 'ESP32-B',
          'ESP32-G': 'ESP32-C',
          'ESP32-H': 'ESP32-D',
        },
        'mesh-warehouse': {
          'GW-001': 'GW-002',
          'GW-002': 'GW-002',
          'ESP32-A': 'ESP32-E',
          'ESP32-B': 'ESP32-F',
          'ESP32-C': 'ESP32-G',
          'ESP32-D': 'ESP32-H',
        }
      };

      const mappedId = NODE_MAPS[activeMesh]?.[baseNodeId];
      if (mappedId) {
        nodeId = mappedId;
      }

      switch (msgType) {
        case 'register':  this._handleRegister(nodeId, payload);  break;
        case 'heartbeat': this._handleHeartbeat(nodeId, payload); break;
        case 'telemetry': this._handleTelemetry(nodeId, payload); break;
        case 'status':    this._handleStatus(nodeId, payload);    break;
        default:
          console.log(`[MQTT] Unknown message type: ${msgType} from mapped ID: ${nodeId}`);
      }
    } catch (err) {
      console.error('[MQTT] Message parse error:', err.message);
    }
  }

  // ── Register ───────────────────────────────────────────────────────────
  _handleRegister(nodeId, payload) {
    console.log(`[MQTT] ✓ Node registration: ${nodeId} — ${payload.label || 'Unknown'}`);

    // Check if node already exists in topology
    const existing = topology.getNode(nodeId);
    if (!existing) {
      // Auto-add new hardware node to topology
      topology.addLiveNode({
        nodeId,
        label:           payload.label ? (payload.label.includes('[HW]') || payload.label.includes('(HW)') ? payload.label : `${payload.label} [HW]`) : `${nodeId} [HW]`,
        ipAddress:       payload.ipAddress || '0.0.0.0',
        nodeType:        payload.nodeType || 'esp32',
        mode:            'live',
        firmwareVersion: payload.firmwareVersion || 'unknown',
        status:          'healthy',
      });
    } else {
      // Update existing node to live mode
      let newLabel = existing.label;
      if (!newLabel.includes('[HW]') && !newLabel.includes('(HW)')) {
        newLabel = `${newLabel} [HW]`;
      }
      topology.updateNodeMetrics(nodeId, {
        label:           newLabel,
        mode:            'live',
        isReal:          true,
        mqttConnected:   true,
        firmwareVersion: payload.firmwareVersion || existing.firmwareVersion,
        ipAddress:       payload.ipAddress || existing.ipAddress,
      });
      
      // Auto-recover if the node was previously failed
      if (existing.status === 'failed') {
        topology.updateNodeStatus(nodeId, 'healthy');
        this.emit('node:recovered', { nodeId, label: newLabel });
        this._emitTopology();
      }
    }

    this.connectedNodes.set(nodeId, {
      lastSeen:  Date.now(),
      ipAddress: payload.ipAddress,
      fw:        payload.firmwareVersion,
    });

    // Store client ID → node ID mapping for broker-level disconnect detection
    if (payload.clientId) {
      this.clientNodeMap.set(payload.clientId, nodeId);
    }

    const evt = mockData.pushEvent({
      type:     'ESP32_REGISTERED',
      severity: 'INFO',
      message:  `✓ ESP32 [${nodeId}] registered via MQTT — fw:${payload.firmwareVersion || '?'} @ ${payload.ipAddress || '?'}`,
      nodeId,
    });
    this.emit('event:new', evt);
    this._emitTopology();
    this._emitOperatingMode();
  }

  _ensureNodeIsLive(node, nodeId) {
    if (node.mode !== 'live' || !node.isReal) {
      let newLabel = node.label;
      if (!newLabel.includes('[HW]') && !newLabel.includes('(HW)')) {
        newLabel = `${newLabel} [HW]`;
      }
      topology.updateNodeMetrics(nodeId, {
        label:           newLabel,
        mode:            'live',
        isReal:          true,
        mqttConnected:   true,
      });
      this._emitTopology();
      this._emitOperatingMode();
    }
  }

  // ── Heartbeat ──────────────────────────────────────────────────────────
  _handleHeartbeat(nodeId, payload) {
    const node = topology.getNode(nodeId);
    if (!node) return;

    this._ensureNodeIsLive(node, nodeId);

    // Auto-recover if the node was previously failed
    if (node.status === 'failed') {
      topology.updateNodeStatus(nodeId, 'healthy');
      this.emit('node:recovered', { nodeId, label: node.label });
      this._emitTopology();
    }

    topology.tickHeartbeat(nodeId);
    topology.updateNodeMetrics(nodeId, {
      wifiSignal:    payload.rssi     || node.wifiSignal,
      latency:       payload.latency  || node.latency,
      mode:          'live',
      isReal:        true,
      mqttConnected: true,
      lastHeartbeat: new Date(),
    });

    this.connectedNodes.set(nodeId, {
      ...this.connectedNodes.get(nodeId),
      lastSeen: Date.now(),
    });
  }

  // ── Telemetry ──────────────────────────────────────────────────────────
  _handleTelemetry(nodeId, payload) {
    const node = topology.getNode(nodeId);
    if (!node) return;

    this._ensureNodeIsLive(node, nodeId);

    const telemetry = {
      nodeId,
      timestamp:      new Date().toISOString(),
      temperature:    payload.temperature  ?? node.telemetry?.temperature  ?? 25,
      humidity:       payload.humidity     ?? node.telemetry?.humidity     ?? 50,
      gasLevel:       payload.gasLevel     ?? node.telemetry?.gasLevel     ?? 0,
      motionDetected: payload.motionDetected ?? false,
      batteryLevel:   payload.batteryLevel ?? 100,
      powerStatus:    payload.powerStatus  ?? 'normal',
      networkLoad:    payload.networkLoad  ?? 30,
    };

    topology.updateNodeMetrics(nodeId, {
      cpuUsage:  payload.cpuUsage || node.cpuUsage,
      latency:   payload.latency  || node.latency,
      mode:      'live',
      isReal:    true,
      mqttConnected: true,
      telemetry,
    });

    // ── Record live hardware telemetry into history ring buffer ──────────
    const fullTelemetry = {
      ...telemetry,
      cpuUsage:    payload.cpuUsage  ?? node.cpuUsage  ?? 0,
      latency:     payload.latency   ?? node.latency   ?? 10,
      packetLoss:  payload.packetLoss ?? node.packetLoss ?? 0,
      wifiSignal:  payload.rssi      ?? node.wifiSignal ?? -60,
    };
    historyService.record(nodeId, fullTelemetry);

    // ── Feed live telemetry into predictive AI engine ────────────────────
    predictionService.ingest(nodeId, {
      temperature: telemetry.temperature,
      humidity:    telemetry.humidity,
      gasLevel:    telemetry.gasLevel,
      cpuUsage:    payload.cpuUsage  ?? node.cpuUsage  ?? 0,
      latency:     payload.latency   ?? node.latency   ?? 10,
      packetLoss:  payload.packetLoss ?? node.packetLoss ?? 0,
    });

     this.emit('telemetry:update', telemetry);

     // ── Link live hardware battery values into PowerService ──────────────
     try {
       const powerService = require('./powerService');
       if (powerService.nodesPower && powerService.nodesPower[nodeId]) {
         const pNode = powerService.nodesPower[nodeId];
         pNode.battery = telemetry.batteryLevel;
         
         // Map MQTT charging status to solar harvesting simulation status
         pNode.solarActive = (telemetry.powerStatus === 'charging');
         
         // Trigger real-time power updates via socket to UI
         this.emit('power:change', { nodeId, mode: pNode.mode, battery: pNode.battery });
       }
     } catch (err) {
       console.error('[MQTT] Failed to map telemetry to PowerService:', err.message);
     }
   }

  // ── Status ─────────────────────────────────────────────────────────────
  _handleStatus(nodeId, payload) {
    if (payload.status === 'offline') {
      topology.updateNodeStatus(nodeId, 'failed');
      this.emit('node:failed', { nodeId, label: topology.getNode(nodeId)?.label });
    } else if (payload.status === 'online') {
      topology.updateNodeStatus(nodeId, 'healthy');
      this.emit('node:recovered', { nodeId, label: topology.getNode(nodeId)?.label });
    }
    this._emitTopology();
  }

  // ── Operating mode detection ───────────────────────────────────────────
  getOperatingMode() {
    const allNodes  = topology.getAllNodes();
    const liveNodes = allNodes.filter(n => n.mode === 'live');
    const simNodes  = allNodes.filter(n => n.mode !== 'live');

    if (liveNodes.length === 0)                return 'SIMULATION';
    if (simNodes.filter(n => !n.isGateway).length === 0) return 'LIVE';
    return 'HYBRID';
  }

  _emitOperatingMode() {
    const mode = this.getOperatingMode();
    this.emit('system:mode', { mode });
  }

  _broadcastMQTTStatus() {
    this.emit('mqtt:status', {
      brokerOnline:   this.brokerOnline,
      port:           MQTT_PORT,
      connectedNodes: this.connectedNodes.size,
      reconnects:     this.reconnectCount,
      uptime:         this.brokerStartTime ? Math.floor((Date.now() - this.brokerStartTime) / 1000) : 0,
    });
    this._emitOperatingMode();
  }

  getStatus() {
    return {
      brokerOnline:   this.brokerOnline,
      port:           MQTT_PORT,
      connectedNodes: this.connectedNodes.size,
      reconnects:     this.reconnectCount,
      uptime:         this.brokerStartTime ? Math.floor((Date.now() - this.brokerStartTime) / 1000) : 0,
      nodeList:       [...this.connectedNodes.entries()].map(([id, data]) => ({ id, ...data })),
    };
  }
}

const instance = new MQTTBridge();
module.exports = instance;
