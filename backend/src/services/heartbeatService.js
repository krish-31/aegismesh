/**
 * HeartbeatService v3 — Active watchdog for both sim and live nodes
 *
 * Live nodes:  15s timeout → FAILED + automatic failover
 * Sim nodes:   always refreshed by mockDataService (never timeout)
 * Tracks heartbeat drift (jitter) per node
 */

const topology      = require('./topologyService');
const failoverSvc   = require('./failoverService');
const mockDataSvc   = require('./mockDataService');

class HeartbeatService {
  constructor() {
    this.io          = null;
    this.interval    = null;
    this.TIMEOUT_MS  = 15000;  // 15s without heartbeat = FAILED for live nodes
    this.UNSTABLE_MS = 10000;  // 10s = mark unstable first
    this.driftHistory = {};    // nodeId -> [lastN drift values]
  }

  setIO(io) { this.io = io; }

  start() {
    this.interval = setInterval(() => this.checkHeartbeats(), 5000);
    console.log('[Heartbeat] ✓ Watchdog active (5s interval, 15s live timeout)');
  }

  stop() {
    clearInterval(this.interval);
  }

  checkHeartbeats() {
    const now   = Date.now();
    const nodes = topology.getAllNodes();

    nodes.forEach(node => {
      if (node.isGateway && node.mode !== 'live') return; // simulated gateway never times out
      if (node.status === 'failed') return; // already failed

      const lastHB  = node.lastHeartbeat ? new Date(node.lastHeartbeat).getTime() : 0;
      const elapsed = now - lastHB;

      // Track drift for live nodes
      if (node.mode === 'live') {
        if (!this.driftHistory[node.nodeId]) this.driftHistory[node.nodeId] = [];
        this.driftHistory[node.nodeId].push(node.heartbeatDrift || 0);
        if (this.driftHistory[node.nodeId].length > 20) {
          this.driftHistory[node.nodeId].shift();
        }

        // Live node timeout detection
        if (elapsed > this.TIMEOUT_MS) {
          console.log(`[Heartbeat] ✗ Live node ${node.nodeId} timed out (${elapsed}ms) — triggering failover`);
          failoverSvc.triggerFailover(node.nodeId, 'Heartbeat Timeout');
        } else if (elapsed > this.UNSTABLE_MS && node.status === 'healthy') {
          console.log(`[Heartbeat] ⚠ Live node ${node.nodeId} heartbeat delayed (${elapsed}ms) — marking unstable`);
          topology.updateNodeStatus(node.nodeId, 'unstable');
          if (this.io) {
            this.io.emit('node:unstable', { nodeId: node.nodeId });
            this.io.emit('topology:update', topology.getTopologySnapshot());
            const evt = mockDataSvc.pushEvent({
              type:     'HEARTBEAT_DELAYED',
              severity: 'WARNING',
              message:  `⚠ ${node.label} heartbeat delayed — ${elapsed}ms since last signal`,
              nodeId:   node.nodeId,
            });
            this.io.emit('event:new', evt);
          }
        }
      }
      // Simulation nodes: mockDataService keeps them alive, no timeout needed
    });
  }

  getDriftStats(nodeId) {
    const history = this.driftHistory[nodeId] || [];
    if (history.length === 0) return { avg: 0, max: 0, min: 0, jitter: 0 };
    const avg    = history.reduce((a, b) => a + b, 0) / history.length;
    const max    = Math.max(...history);
    const min    = Math.min(...history);
    const jitter = max - min;
    return { avg: +avg.toFixed(1), max, min, jitter };
  }
}

module.exports = new HeartbeatService();
