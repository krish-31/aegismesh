/**
 * Socket.IO Handlers v3 — All realtime simulation controls, demo automation,
 * new attack types, keyboard shortcut support, and system info broadcasting
 */

const topology        = require('../services/topologyService');
const failoverService = require('../services/failoverService');
const mockDataService = require('../services/mockDataService');
const demoService     = require('../services/demoService');
const mqttBridge      = require('../services/mqttBridge');

// New Services
const predictionService = require('../services/predictionService');
const historyService    = require('../services/historyService');
const commandService    = require('../services/commandService');
const otaService        = require('../services/otaService');
const powerService      = require('../services/powerService');
const playbookService   = require('../services/playbookService');
const zoneService       = require('../services/zoneService');
const replayService     = require('../services/replayService');
const slaService        = require('../services/slaService');
const firebaseService   = require('../services/firebaseService');
const notificationService = require('../services/notificationService');
const securityService = require('../services/securityHandshakeService');
const edgeService = require('../services/edgeComputingService');
const clusterService = require('../services/clusterService');
const schedulingService = require('../services/schedulingService');

module.exports = function registerSocketHandlers(io) {

  // Give services access to io
  failoverService.setIO(io);
  demoService.setIO(io);
  predictionService.setIO(io);
  historyService.setIO(io);
  otaService.setIO(io);
  powerService.setIO(io);
  playbookService.setIO(io);
  zoneService.setIO(io);
  replayService.setIO(io);
  slaService.setIO(io);
  securityService.setIO(io);
  edgeService.setIO(io);
  edgeService.start();
  clusterService.setIO(io);
  clusterService.start();
  schedulingService.setIO(io);

  // Start SLA Monitoring
  slaService.start();

  // ── System uptime broadcast every 10s ────────────────────────────────────
  setInterval(() => {
    io.emit('system:uptime', { uptime: topology.getSystemUptime() });
    io.emit('system:mode',   { mode: topology.getOperatingMode() });
  }, 10000);

  io.on('connection', (socket) => {
    console.log(`[Socket] ✓ Client connected: ${socket.id}`);

    // ── Initial state burst ──────────────────────────────────────────────────
    const snapshot = topology.getTopologySnapshot();
    socket.emit('topology:init', snapshot);
    socket.emit('system:mode',   { mode: topology.getOperatingMode() });
    socket.emit('system:uptime', { uptime: topology.getSystemUptime() });
    socket.emit('mqtt:status',   mqttBridge.getStatus());

    // Send recent in-memory events
    const recentEvents = mockDataService.getEvents(30);
    socket.emit('events:init', recentEvents);

    // ── Topology ─────────────────────────────────────────────────────────────
    socket.on('topology:request', () => {
      socket.emit('topology:update', topology.getTopologySnapshot());
    });

    socket.on('node:details', ({ nodeId }) => {
      const node = topology.getNode(nodeId);
      if (!node) return;

      const allIds = topology.getAllNodes().map(n => n.nodeId);
      const routes = allIds
        .filter(id => id !== nodeId)
        .map(id => ({
          to: id,
          ...topology.getShortestPath(nodeId, id)
        }));

      socket.emit('node:details:response', { node, routes });
    });

    // ── Simulation: Fail Node ─────────────────────────────────────────────────
    socket.on('simulation:fail-node', async ({ nodeId }) => {
      if (!nodeId) return;
      const node = topology.getNode(nodeId);
      if (!node || node.status === 'failed') {
        socket.emit('simulation:error', { message: `${nodeId} is already failed or not found` });
        return;
      }
      console.log(`[Sim] ▼ Disconnecting node: ${nodeId}`);
      await failoverService.triggerFailover(nodeId, 'Manual Simulation');
    });

    // ── Simulation: Recover Node ──────────────────────────────────────────────
    socket.on('simulation:recover-node', async ({ nodeId }) => {
      if (!nodeId) return;
      console.log(`[Sim] ▲ Recovering node: ${nodeId}`);
      await failoverService.recoverNode(nodeId);
    });

    // ── Simulation: Packet Loss ───────────────────────────────────────────────
    socket.on('simulation:packet-loss', ({ nodeId }) => {
      const target = nodeId || 'ESP32-B';
      console.log(`[Sim] ≈ Packet loss injection on: ${target}`);

      mockDataService.setPacketLossMode(target);
      topology.updateNodeStatus(target, 'unstable');
      io.emit('topology:update', topology.getTopologySnapshot());
      io.emit('node:unstable', { nodeId: target });

      const lossPercent = Math.floor(Math.random() * 20 + 15);
      notificationService.sendAlert(target, 'PACKET_LOSS_INJECTION', `⚠️ WARNING: High Packet Loss injected on ${target} (${lossPercent}% packet loss rate active)`, 'WARNING');

      const evt = mockDataService.pushEvent({
        type:     'PACKET_LOSS_INJECTION',
        severity: 'WARNING',
        message:  `Packet loss injection: ${target} — ${lossPercent}% loss rate active`,
        nodeId:   target,
      });
      io.emit('event:new', evt);

      setTimeout(() => {
        mockDataService.clearPacketLossMode();
        topology.updateNodeStatus(target, 'healthy');
        io.emit('topology:update', topology.getTopologySnapshot());
        
        notificationService.sendAlert(target, 'PACKET_LOSS_CLEARED', `✓ Packet loss cleared on ${target} — link performance restored`, 'INFO');

        const clearEvt = mockDataService.pushEvent({
          type: 'PACKET_LOSS_CLEARED', severity: 'INFO',
          message: `Packet loss cleared on ${target} — link restored`, nodeId: target,
        });
        io.emit('event:new', clearEvt);
      }, 10000);
    });

    // ── Simulation: High Latency ──────────────────────────────────────────────
    socket.on('simulation:high-latency', ({ nodeId }) => {
      const target = nodeId || 'ESP32-C';
      console.log(`[Sim] ↑ High latency injection on: ${target}`);

      mockDataService.setHighLatencyMode(target);
      topology.updateNodeStatus(target, 'unstable');
      const latencyVal = Math.floor(Math.random() * 300 + 200);
      topology.updateNodeMetrics(target, { latency: latencyVal });
      io.emit('topology:update', topology.getTopologySnapshot());

      notificationService.sendAlert(target, 'HIGH_LATENCY_INJECTION', `⚠️ WARNING: High Latency spike injected on ${target} (${latencyVal}ms)`, 'WARNING');

      const evt = mockDataService.pushEvent({
        type: 'HIGH_LATENCY_INJECTION', severity: 'WARNING',
        message: `High latency injected on ${target}: ${latencyVal}ms`, nodeId: target,
      });
      io.emit('event:new', evt);

      setTimeout(() => {
        mockDataService.clearHighLatencyMode(target);
        topology.updateNodeStatus(target, 'healthy');
        topology.updateNodeMetrics(target, { latency: Math.random() * 15 + 3 });
        io.emit('topology:update', topology.getTopologySnapshot());
        
        notificationService.sendAlert(target, 'LATENCY_NORMALIZED', `✓ Latency normalized on ${target} — link performance restored`, 'INFO');

        const clearEvt = mockDataService.pushEvent({
          type: 'LATENCY_NORMALIZED', severity: 'INFO',
          message: `Latency normalized on ${target} — link restored`, nodeId: target,
        });
        io.emit('event:new', clearEvt);
      }, 8000);
    });

    // ── Simulation: Route Optimize ────────────────────────────────────────────
    socket.on('simulation:route-optimize', () => {
      console.log('[Sim] ↻ Route optimization triggered');
      topology.recalculateAllRoutes();
      const snapshot = topology.getTopologySnapshot();
      io.emit('topology:update', snapshot);

      const gwId = topology.getGatewayId();
      const allNodes = topology.getAllNodes().filter(n => !n.isGateway && n.status !== 'failed');
      const paths    = allNodes.map(n => topology.getShortestPath(gwId, n.nodeId).path).filter(p => p.length > 0);
      io.emit('routes:optimized', { paths });

      notificationService.sendAlert(gwId, 'ROUTE_OPTIMIZATION', `✓ Dijkstra optimization complete — ${paths.length} optimal routes recalculated`, 'INFO');

      const evt = mockDataService.pushEvent({
        type: 'ROUTE_OPTIMIZATION', severity: 'INFO',
        message: `Dijkstra optimization complete — ${paths.length} optimal routes recalculated`, nodeId: gwId,
      });
      io.emit('event:new', evt);
    });

    socket.on('simulation:flood-attack', ({ nodeId }) => {
      const target = nodeId || topology.getGatewayId();
      console.log(`[Sim] ⚡ Flood attack simulation on: ${target}`);

      mockDataService.setAttackMode(true, target);
      topology.updateNodeMetrics(target, { anomalyScore: 87, cpuUsage: 97 });
      io.emit('topology:update', topology.getTopologySnapshot());

      const attackRate = Math.floor(Math.random() * 8000 + 5000);
      const alert = mockDataService.pushAlert({
        type: 'FLOOD_ATTACK', nodeId: target, severity: 'CRITICAL',
        description: `DDoS/Flood attack detected on ${target} — ${attackRate} pkt/s`,
      });
      io.emit('alert:new', alert);
      io.emit('threat:attack', { nodeId: target, type: 'FLOOD', intensity: 87, rate: attackRate });

      notificationService.sendAlert(target, 'FLOOD_ATTACK', `⚡ DDOS/FLOOD ATTACK detected on ${target} — rate: ${attackRate} pkt/s`, 'CRITICAL');

      const evt = mockDataService.pushEvent({
        type: 'FLOOD_ATTACK', severity: 'CRITICAL',
        message: `⚡ FLOOD ATTACK on ${target} — ${attackRate} pkt/s anomaly score: 87/100`, nodeId: target,
      });
      io.emit('event:new', evt);

      setTimeout(() => {
        mockDataService.setAttackMode(false);
        topology.updateNodeMetrics(target, { anomalyScore: 5, cpuUsage: 20 });
        io.emit('topology:update', topology.getTopologySnapshot());
        const clearEvt = mockDataService.pushEvent({
          type: 'ATTACK_MITIGATED', severity: 'INFO',
          message: `✓ Flood attack on ${target} mitigated — traffic normalized`, nodeId: target,
        });
        io.emit('event:new', clearEvt);
        io.emit('threat:cleared', { nodeId: target });
      }, 12000);
    });

    // ── Simulation: Node Spoofing ─────────────────────────────────────────────
    socket.on('simulation:node-spoof', ({ nodeId }) => {
      const target = nodeId || 'ESP32-B';
      console.log(`[Sim] 🎭 Node spoofing simulation on: ${target}`);

      const alert = mockDataService.pushAlert({
        type: 'NODE_SPOOF', nodeId: target, severity: 'CRITICAL',
        description: `Rogue node detected — impersonating ${target} MAC address`,
      });
      io.emit('alert:new', alert);
      io.emit('threat:attack', { nodeId: target, type: 'SPOOF', intensity: 75 });

      notificationService.sendAlert(target, 'NODE_SPOOF', `🎭 ROGUE NODE detected — impersonating ${target} identity!`, 'CRITICAL');

      const evt = mockDataService.pushEvent({
        type: 'NODE_SPOOF', severity: 'CRITICAL',
        message: `🎭 ROGUE NODE detected — impersonating ${target} identity`, nodeId: target,
      });
      io.emit('event:new', evt);

      // Quarantine after 3s
      setTimeout(() => {
        topology.updateNodeStatus(target, 'unstable');
        io.emit('topology:update', topology.getTopologySnapshot());
        const qEvt = mockDataService.pushEvent({
          type: 'NODE_QUARANTINED', severity: 'WARNING',
          message: `⚠ ${target} quarantined for identity verification`, nodeId: target,
        });
        io.emit('event:new', qEvt);
      }, 3000);

      // Clear after 10s
      setTimeout(() => {
        topology.updateNodeStatus(target, 'healthy');
        io.emit('topology:update', topology.getTopologySnapshot());
        io.emit('threat:cleared', { nodeId: target });
        const clearEvt = mockDataService.pushEvent({
          type: 'SPOOF_CLEARED', severity: 'INFO',
          message: `✓ Node ${target} identity verified — quarantine lifted`, nodeId: target,
        });
        io.emit('event:new', clearEvt);
      }, 10000);
    });

    // ── Simulation: Packet Replay ─────────────────────────────────────────────
    socket.on('simulation:packet-replay', ({ nodeId }) => {
      const target = nodeId || 'ESP32-C';
      console.log(`[Sim] 🔄 Packet replay attack on: ${target}`);

      const alert = mockDataService.pushAlert({
        type: 'PACKET_REPLAY', nodeId: target, severity: 'WARNING',
        description: `Packet replay attack detected on ${target} — duplicate packets flagged`,
      });
      io.emit('alert:new', alert);
      io.emit('threat:attack', { nodeId: target, type: 'REPLAY', intensity: 55 });

      notificationService.sendAlert(target, 'PACKET_REPLAY', `🔄 WARNING: Packet replay attack detected on ${target} — duplicate packet sequences!`, 'WARNING');

      const evt = mockDataService.pushEvent({
        type: 'PACKET_REPLAY', severity: 'WARNING',
        message: `🔄 Packet replay attack on ${target} — duplicate sequence numbers detected`, nodeId: target,
      });
      io.emit('event:new', evt);

      setTimeout(() => {
        io.emit('threat:cleared', { nodeId: target });
        
        notificationService.sendAlert(target, 'REPLAY_BLOCKED', `✓ Replay packets on ${target} blocked — sequence validation restored`, 'INFO');

        const clearEvt = mockDataService.pushEvent({
          type: 'REPLAY_BLOCKED', severity: 'INFO',
          message: `✓ Replay packets on ${target} blocked — sequence validation restored`, nodeId: target,
        });
        io.emit('event:new', clearEvt);
      }, 8000);
    });

    // ── Simulation: Network Partition ─────────────────────────────────────────
    socket.on('simulation:network-partition', () => {
      console.log('[Sim] 🔌 Network partition simulation');

      // Fail two nodes to create partition
      const isHQ = topology.activeMeshId === 'mesh-hq';
      const partitionNodes = isHQ ? ['ESP32-A', 'ESP32-D'] : ['ESP32-E', 'ESP32-H'];
      partitionNodes.forEach(id => {
        topology.updateNodeStatus(id, 'failed');
      });
      topology.recalculateAllRoutes();
      io.emit('topology:update', topology.getTopologySnapshot());

      const gwId = topology.getGatewayId();
      notificationService.sendAlert(gwId, 'NETWORK_PARTITION', `🔌 CRITICAL: Network partition! ${partitionNodes.join(', ')} isolated from mesh`, 'CRITICAL');

      const evt = mockDataService.pushEvent({
        type: 'NETWORK_PARTITION', severity: 'CRITICAL',
        message: `🔌 NETWORK PARTITION — ${partitionNodes.join(', ')} isolated from mesh`, nodeId: gwId,
      });
      io.emit('event:new', evt);

      // Heal after 12s
      setTimeout(() => {
        partitionNodes.forEach(id => {
          topology.updateNodeStatus(id, 'healthy');
        });
        topology.recalculateAllRoutes();
        io.emit('topology:update', topology.getTopologySnapshot());

        notificationService.sendAlert(gwId, 'PARTITION_HEALED', `✓ Network partition healed — ${partitionNodes.join(', ')} rejoined mesh`, 'INFO');

        const healEvt = mockDataService.pushEvent({
          type: 'PARTITION_HEALED', severity: 'INFO',
          message: `✓ Network partition healed — ${partitionNodes.join(', ')} rejoined mesh`, nodeId: gwId,
        });
        io.emit('event:new', healEvt);
      }, 12000);
    });

    // ── Demo automation ───────────────────────────────────────────────────────
    socket.on('demo:start', () => {
      console.log('[Demo] ▶ Starting auto-demo via socket');
      demoService.start();
    });

    socket.on('demo:stop', () => {
      demoService.stop();
    });

    socket.on('demo:pause', () => {
      demoService.pause();
    });

    socket.on('demo:resume', () => {
      demoService.resume();
    });

    socket.on('demo:skip', () => {
      demoService.skip();
    });

    // ── System info request ───────────────────────────────────────────────────
    socket.on('system:request-info', () => {
      socket.emit('system:mode',   { mode: topology.getOperatingMode() });
      socket.emit('system:uptime', { uptime: topology.getSystemUptime() });
      socket.emit('mqtt:status',   mqttBridge.getStatus());
    });

    // ── New Features Listeners ────────────────────────────────────────────────
    
    // Commands CLI
    socket.on('command:execute', async ({ command }) => {
      const result = await commandService.execute(command);
      socket.emit('command:result', result);
    });

    // OTA firmware
    socket.on('ota:start', ({ nodeId, version }) => {
      otaService.startUpdate(nodeId, version);
    });
    socket.on('ota:start-mst', ({ version }) => {
      otaService.startMSTUpdate(version);
    });
    socket.on('ota:cancel', ({ nodeId }) => {
      otaService.cancelUpdate(nodeId);
    });
    socket.on('ota:rollback', ({ nodeId }) => {
      otaService.rollback(nodeId);
    });

    // Dynamic Programming scheduling
    socket.on('scheduling:solve', ({ tasks, capacity }) => {
      const solution = schedulingService.solveKnapsack(tasks, capacity);
      io.emit('scheduling:solved', solution);
    });

    // Power
    socket.on('power:set-mode', ({ nodeId, mode }) => {
      powerService.setMode(nodeId, mode);
    });

    // Playbooks
    socket.on('playbook:toggle', ({ playbookId }) => {
      playbookService.togglePlaybook(playbookId);
    });

    // Replay
    socket.on('replay:start', ({ speed }) => {
      replayService.startPlayback(speed);
    });
    socket.on('replay:pause', () => {
      replayService.pausePlayback();
    });
    socket.on('replay:stop', () => {
      replayService.stopPlayback();
    });
    socket.on('replay:scrub', ({ index }) => {
      replayService.setPlaybackIndex(index);
    });
    socket.on('replay:save', async ({ name }) => {
      const res = await replayService.saveSession(name);
      socket.emit('replay:save:response', res);
    });

    // Zones
    socket.on('zone:move-node', ({ nodeId, position }) => {
      zoneService.setNodePosition(nodeId, position);
    });

    // Notifications
    socket.on('notifications:update', (settings) => {
      notificationService.updateSettings(settings);
      socket.emit('notifications:init', notificationService.getSettings());
    });

    // Multi-mesh switcher
    socket.on('mesh:switch', ({ meshId }) => {
      const success = topology.switchMesh(meshId);
      if (success) {
        io.emit('topology:update', topology.getTopologySnapshot());
        io.emit('prediction:init', predictionService.getAnomalyReport());
        io.emit('power:init', powerService.getAllPower());
        io.emit('zones:init', zoneService.getZones());
      }
    });

    // Routing policy
    socket.on('routing:policy-set', ({ policy }) => {
      const success = topology.setRoutingPolicy(policy);
      if (success) {
        io.emit('topology:update', topology.getTopologySnapshot());
        const evt = mockDataService.pushEvent({
          type: 'QOS_POLICY_SET',
          severity: 'INFO',
          message: `Routing policy changed to: ${policy.toUpperCase()}`,
          nodeId: topology.getGatewayId()
        });
        io.emit('event:new', evt);
      }
    });


    // Security / Zero-Trust handshakes
    socket.on('security:request-state', () => {
      socket.emit('security:init', { keys: securityService.getKeys(), logs: securityService.getLogs() });
    });
    socket.on('security:quarantine', ({ nodeId, reason }) => {
      securityService.quarantineNode(nodeId, reason || 'Manual operator intervention');
    });
    socket.on('security:admit', ({ nodeId }) => {
      securityService.liftQuarantine(nodeId);
    });
    socket.on('security:simulate-rogue', ({ nodeId }) => {
      securityService.simulateRogueNode(nodeId);
    });

    // Edge Computing & Job Offloading
    socket.on('edge:request-state', () => {
      socket.emit('edge:tasks:update', edgeService.getTasks());
    });
    socket.on('edge:task:create', ({ nodeId, type }) => {
      edgeService.generateTask(nodeId, type);
    });

    // Emit initial states
    socket.emit('security:init', { keys: securityService.getKeys(), logs: securityService.getLogs() });
    socket.emit('edge:tasks:update', edgeService.getTasks());
    socket.emit('prediction:init', predictionService.getAnomalyReport());
    socket.emit('power:init', powerService.getAllPower());
    socket.emit('ota:init', { 
      registry: otaService.getRegistry(), 
      batch: otaService.getBatchStatus(), 
      history: otaService.getUpdateHistory() 
    });
    socket.emit('playbooks:init', { 
      playbooks: playbookService.getPlaybooks(), 
      logs: playbookService.getExecutionLogs() 
    });
    socket.emit('zones:init', zoneService.getZones());
    socket.emit('replay:init', { 
      frames: replayService.getHistory(), 
      recording: replayService.recording 
    });
    socket.emit('sla:init', { breachLog: slaService.getBreachLog() });
    socket.emit('notifications:init', notificationService.getSettings());

    // ── Error feedback from backend ──────────────────────────────────────────
    socket.on('simulation:error', ({ message }) => {
      const evt = mockDataService.pushEvent({
        type: 'SIM_ERROR', severity: 'WARNING',
        message: `Simulation: ${message}`, nodeId: topology.getGatewayId(),
      });
      io.emit('event:new', evt);
    });

    socket.on('alerts:clear', () => {
      console.log('[Socket] Clearing all threat alerts');
      mockDataService.clearAlerts();
      io.emit('alerts:cleared');
    });

    socket.on('disconnect', () => {
      console.log(`[Socket] Client disconnected: ${socket.id}`);
    });
  });
};
