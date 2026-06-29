/**
 * REST API routes v3 — System info, MQTT status, export endpoints
 */

const express       = require('express');
const router        = express.Router();
const topology      = require('../services/topologyService');
const mockData      = require('../services/mockDataService');
const failoverSvc   = require('../services/failoverService');
const mqttBridge    = require('../services/mqttBridge');
const demoService   = require('../services/demoService');

// New Services
const predictionService = require('../services/predictionService');
const historyService    = require('../services/historyService');
const otaService        = require('../services/otaService');
const powerService      = require('../services/powerService');
const playbookService   = require('../services/playbookService');
const zoneService       = require('../services/zoneService');
const replayService     = require('../services/replayService');
const slaService        = require('../services/slaService');
const capacityService   = require('../services/capacityService');
const notificationService = require('../services/notificationService');
const securityService = require('../services/securityHandshakeService');
const edgeService = require('../services/edgeComputingService');
const schedulingService = require('../services/schedulingService');

// ── Health ───────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/health:
 *   get:
 *     summary: Retrieve backend status health
 *     description: Verifies that backend and internal services are online.
 *     responses:
 *       200:
 *         description: Health confirmation payload
 */
router.get('/health', (req, res) => {
  res.json({ status: 'AegisMesh Backend Online', version: '3.0', timestamp: new Date() });
});

// ── Topology ──────────────────────────────────────────────────────────────────
/**
 * @openapi
 * /api/topology:
 *   get:
 *     summary: Get live mesh topology
 *     description: Returns the adjacency list, node lists, and active communication paths.
 *     responses:
 *       200:
 *         description: Active nodes and links snapshot
 */
router.get('/topology', (req, res) => {
  res.json({ success: true, data: topology.getTopologySnapshot() });
});

// ── Nodes ─────────────────────────────────────────────────────────────────────
router.get('/nodes', (req, res) => {
  res.json({ success: true, data: topology.getAllNodes() });
});

router.get('/nodes/:nodeId', (req, res) => {
  const node = topology.getNode(req.params.nodeId);
  if (!node) return res.status(404).json({ success: false, error: 'Node not found' });

  const allIds = topology.getAllNodes().map(n => n.nodeId);
  const routes = allIds
    .filter(id => id !== req.params.nodeId)
    .map(id => ({ to: id, ...topology.getShortestPath(req.params.nodeId, id) }));

  res.json({ success: true, data: { node, routes } });
});

// ── Routes ────────────────────────────────────────────────────────────────────
router.get('/routes/:from/:to', (req, res) => {
  const result = topology.getShortestPath(req.params.from, req.params.to);
  res.json({ success: true, data: result });
});

router.get('/routes', (req, res) => {
  const allIds = topology.getAllNodes().map(n => n.nodeId);
  const routes = [];
  allIds.forEach(from => {
    allIds.filter(to => to !== from).forEach(to => {
      routes.push({ from, to, ...topology.getShortestPath(from, to) });
    });
  });
  res.json({ success: true, data: routes });
});

// ── Events ────────────────────────────────────────────────────────────────────
router.get('/events', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  res.json({ success: true, data: mockData.getEvents(limit) });
});

// ── Alerts ────────────────────────────────────────────────────────────────────
router.get('/alerts', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  res.json({ success: true, data: mockData.getAlerts(limit) });
});

// ── Failover log ──────────────────────────────────────────────────────────────
router.get('/failover-logs', (req, res) => {
  res.json({ success: true, data: failoverSvc.getLog(20) });
});

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  const snap       = topology.getTopologySnapshot();
  const failedNodes = snap.nodes.filter(n => n.status === 'failed').length;

  res.json({
    success: true,
    data: {
      totalNodes:       snap.nodes.length,
      activeNodes:      snap.nodes.length - failedNodes,
      failedNodes,
      networkHealth:    snap.healthPercentage,
      activeRoutes:     snap.activeRoutes,
      avgLatency:       snap.avgLatency,
      totalPackets:     snap.totalPackets,
      packetThroughput: Math.floor(Math.random() * 4000 + 2000),
      mqttStatus:       mqttBridge.getStatus().brokerOnline ? 'CONNECTED' : 'OFFLINE',
      lastFailover:     failoverSvc.getLog(1)[0]?.timestamp || null,
      activeAlerts:     mockData.getAlerts(50).filter(a => !a.acknowledged).length,
      operatingMode:    snap.operatingMode,
      systemUptime:     snap.systemUptime,
    }
  });
});

// ── Telemetry ─────────────────────────────────────────────────────────────────
router.get('/telemetry/:nodeId', (req, res) => {
  const node = topology.getNode(req.params.nodeId);
  if (!node) return res.status(404).json({ success: false, error: 'Node not found' });
  res.json({ success: true, data: node.telemetry || {} });
});

// ── System info ───────────────────────────────────────────────────────────────
router.get('/system/mode', (req, res) => {
  res.json({ success: true, data: { mode: topology.getOperatingMode() } });
});

router.get('/system/uptime', (req, res) => {
  res.json({ success: true, data: { uptime: topology.getSystemUptime() } });
});

// ── MQTT status ───────────────────────────────────────────────────────────────
router.get('/mqtt/status', (req, res) => {
  res.json({ success: true, data: mqttBridge.getStatus() });
});

// ── Demo status ───────────────────────────────────────────────────────────────
router.get('/demo/status', (req, res) => {
  res.json({ success: true, data: demoService.getStatus() });
});

// ── Export: Topology snapshot ─────────────────────────────────────────────────
router.get('/export/topology', (req, res) => {
  const snap = topology.getTopologySnapshot();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=aegismesh-topology-${Date.now()}.json`);
  res.json(snap);
});

// ── Export: Event logs ────────────────────────────────────────────────────────
router.get('/export/events', (req, res) => {
  const events = mockData.getEvents(500);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=aegismesh-events-${Date.now()}.json`);
  res.json(events);
});

// ── Predictions ─────────────────────────────────────────────────────────────
router.get('/predictions', (req, res) => {
  res.json({ success: true, data: predictionService.getAnomalyReport() });
});

router.get('/predictions/:nodeId', (req, res) => {
  res.json({ success: true, data: predictionService.getNodePrediction(req.params.nodeId) });
});

// ── Analytics & History ───────────────────────────────────────────────────────
router.get('/analytics/history/:nodeId', (req, res) => {
  const range = req.query.range || '15m';
  res.json({ success: true, data: historyService.getHistory(req.params.nodeId, range) });
});

router.get('/analytics/report', (req, res) => {
  res.json({ success: true, data: historyService.getReportData() });
});

router.get('/analytics/compare', (req, res) => {
  const nodes = req.query.nodes ? req.query.nodes.split(',') : [];
  const metric = req.query.metric || 'temperature';
  const range = req.query.range || '15m';
  res.json({ success: true, data: historyService.getCompare(nodes, metric, range) });
});

// ── Power ────────────────────────────────────────────────────────────────────
router.get('/power', (req, res) => {
  res.json({ success: true, data: powerService.getAllPower() });
});

router.get('/power/:nodeId', (req, res) => {
  const power = powerService.getNodePower(req.params.nodeId);
  if (!power) return res.status(404).json({ success: false, error: 'Node not found' });
  res.json({ success: true, data: power });
});

// ── Playbooks ────────────────────────────────────────────────────────────────
router.get('/playbooks', (req, res) => {
  res.json({ success: true, data: playbookService.getPlaybooks() });
});

router.get('/playbooks/logs', (req, res) => {
  res.json({ success: true, data: playbookService.getExecutionLogs() });
});

// ── Zones ────────────────────────────────────────────────────────────────────
router.get('/zones', (req, res) => {
  res.json({ success: true, data: zoneService.getZones() });
});

// ── Replay ───────────────────────────────────────────────────────────────────
router.get('/replay/history', (req, res) => {
  res.json({ success: true, data: replayService.getHistory() });
});

router.get('/replay/frame/:index', (req, res) => {
  const idx = parseInt(req.params.index);
  const frame = replayService.getFrame(idx);
  if (!frame) return res.status(404).json({ success: false, error: 'Frame index not found' });
  res.json({ success: true, data: frame });
});

// ── SLA ──────────────────────────────────────────────────────────────────────
router.get('/sla/targets', (req, res) => {
  res.json({ success: true, data: slaService.getSLATargets() });
});

router.get('/sla/breaches', (req, res) => {
  res.json({ success: true, data: slaService.getBreachLog() });
});

// ── Capacity ─────────────────────────────────────────────────────────────────
router.get('/capacity/report', (req, res) => {
  res.json({ success: true, data: capacityService.getCapacityReport() });
});

router.get('/capacity/simulate', (req, res) => {
  const added = parseInt(req.query.added) || 0;
  res.json({ success: true, data: capacityService.simulateExpansion(added) });
});

// ── Security & Zero-Trust ───────────────────────────────────────────────────
router.get('/security/keys', (req, res) => {
  res.json({ success: true, data: securityService.getKeys() });
});

router.get('/security/logs', (req, res) => {
  res.json({ success: true, data: securityService.getLogs() });
});

router.post('/security/quarantine', (req, res) => {
  const { nodeId, reason } = req.body;
  securityService.quarantineNode(nodeId, reason);
  res.json({ success: true });
});

router.post('/security/admit', (req, res) => {
  const { nodeId } = req.body;
  securityService.liftQuarantine(nodeId);
  res.json({ success: true });
});

router.post('/security/simulate-rogue', (req, res) => {
  const { nodeId } = req.body;
  const success = securityService.simulateRogueNode(nodeId);
  res.json({ success });
});

// ── Edge Computing ───────────────────────────────────────────────────────────
router.get('/edge/tasks', (req, res) => {
  res.json({ success: true, data: edgeService.getTasks() });
});

router.post('/edge/tasks', (req, res) => {
  const { nodeId, type } = req.body;
  const task = edgeService.generateTask(nodeId, type);
  res.json({ success: true, data: task });
});

// ── DAA Algorithmic Enhancements ─────────────────────────────────────────────

// Dynamic Programming Knapsack edge task scheduling
router.get('/scheduling/tasks', (req, res) => {
  res.json({ success: true, data: schedulingService.getMockTasks() });
});

router.post('/scheduling/solve', (req, res) => {
  const { tasks, capacity } = req.body;
  const result = schedulingService.solveKnapsack(tasks, capacity);
  res.json({ success: true, data: result });
});

// Prim's Minimum Spanning Tree (MST) firmware distribution
router.get('/ota/mst', (req, res) => {
  res.json({ success: true, data: otaService.getMST() });
});

router.post('/ota/mst/flash', (req, res) => {
  const { version } = req.body;
  const success = otaService.startMSTUpdate(version);
  res.json({ success });
});

module.exports = router;
