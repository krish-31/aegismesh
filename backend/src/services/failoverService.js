/**
 * FailoverService v2 — Self-healing route recalculation with animated path emission
 */

const topology = require('./topologyService');
const notificationService = require('./notificationService');
const firebaseService = require('./firebaseService');
const historyService = require('./historyService');

// In-memory failover log
const failoverLog = [];

class FailoverService {
  constructor() {
    this.io = null;
  }

  setIO(io) { this.io = io; }

  emit(event, data) { if (this.io) this.io.emit(event, data); }

  async triggerFailover(nodeId, reason = 'Simulation') {
    const node = topology.getNode(nodeId);
    if (!node) return;

    const mockData = require('./mockDataService');
    console.log(`[Failover] Triggering failover for ${nodeId} — reason: ${reason}`);

    // Step 1: Mark node failed
    topology.updateNodeStatus(nodeId, 'failed');
    this.emit('node:failed', { nodeId, label: node.label });
    this.emit('topology:update', topology.getTopologySnapshot());
    
    notificationService.sendAlert(nodeId, 'NODE_FAILED', `⚠ ${node.label} went OFFLINE — initiating failover [${reason}]`, 'CRITICAL');
    
    // Dynamic import to resolve circular dependency
    const playbookService = require('./playbookService');
    playbookService.recordFailure(nodeId);

    const failEvt = mockData.pushEvent({
      type:     'NODE_FAILED',
      severity: 'CRITICAL',
      message:  `⚠ ${node.label} [${nodeId}] went OFFLINE — initiating failover [${reason}]`,
      nodeId,
    });
    this.emit('event:new', failEvt);
    firebaseService.saveEvent(failEvt);

    // Step 2: Slight delay for UI to show red node
    await sleep(600);

    // Step 3: Emit failover started
    this.emit('failover:started', { nodeId });
    const startEvt = mockData.pushEvent({
      type:     'FAILOVER_INITIATED',
      severity: 'WARNING',
      message:  `Failover initiated — recalculating routes for ${nodeId} loss`,
      nodeId:   topology.getGatewayId(),
    });
    this.emit('event:new', startEvt);

    // Step 4: Run Dijkstra
    await sleep(400);
    topology.recalculateAllRoutes();
    const snapshot = topology.getTopologySnapshot();
    this.emit('topology:update', snapshot);

    // Step 5: Find new routes for all affected nodes
    const affectedNodes = topology.getAllNodes()
      .map(n => n.nodeId)
      .filter(id => id !== nodeId);

    let bestNewRoute = [];
    let longestPath  = 0;

    const gwId = topology.getGatewayId();
    affectedNodes.forEach(id => {
      const route = topology.getShortestPath(gwId, id);
      if (route.path.length > longestPath && !route.path.includes(nodeId)) {
        longestPath  = route.path.length;
        bestNewRoute = route.path;
      }
    });

    // Step 6: Highlight new active path
    if (bestNewRoute.length > 0) {
      this.emit('route:highlighted', { path: bestNewRoute, type: 'failover' });
      this.emit('failover:complete', {
        nodeId,
        newRoute: bestNewRoute,
        duration: 1200,
      });

      const routeEvt = mockData.pushEvent({
        type:     'ROUTE_RECALCULATED',
        severity: 'INFO',
        message:  `✓ New path established: ${bestNewRoute.join(' → ')} [Dijkstra]`,
        nodeId:   topology.getGatewayId(),
      });
      this.emit('event:new', routeEvt);
    } else {
      this.emit('failover:complete', { nodeId, newRoute: [], duration: 800 });
      const noRouteEvt = mockData.pushEvent({
        type:     'ROUTE_LOST',
        severity: 'CRITICAL',
        message:  `No alternate path available after ${nodeId} failure — mesh partitioned`,
        nodeId:   topology.getGatewayId(),
      });
      this.emit('event:new', noRouteEvt);
    }

    // Step 7: Log to in-memory store — capture old route for comparison
    // Try to find what the previous route was through the failed node
    const oldRouteThrough = affectedNodes
      .map(id => topology.getShortestPath(gwId, id))
      .find(r => r.path.length > 0);
    const oldRoute = oldRouteThrough ? [gwId, nodeId, ...(oldRouteThrough.path.slice(1))] : [gwId, nodeId];

    const logItem = {
      failedNode:    nodeId,
      oldRoute:      oldRoute,
      newRoute:      bestNewRoute,
      duration:      1200,
      success:       bestNewRoute.length > 0,
      timestamp:     new Date().toISOString(),
      reason,
    };
    failoverLog.unshift(logItem);
    historyService.recordFailover(logItem);
    firebaseService.saveFailoverLog(logItem);
    if (failoverLog.length > 50) failoverLog.length = 50;
  }

  async recoverNode(nodeId) {
    const node = topology.getNode(nodeId);
    if (!node || node.status !== 'failed') {
      console.log(`[Failover] Node ${nodeId} is not failed — skipping recovery`);
      return;
    }

    const mockData = require('./mockDataService');
    console.log(`[Failover] Recovering node: ${nodeId}`);

    // Restore to healthy
    topology.updateNodeStatus(nodeId, 'healthy');
    this.emit('node:recovered', { nodeId, label: node.label });
    
    notificationService.sendAlert(nodeId, 'NODE_RECOVERED', `✓ ${node.label} reconnected to mesh — routes restored`, 'INFO');

    const snapshot = topology.getTopologySnapshot();
    this.emit('topology:update', snapshot);

    const recEvt = mockData.pushEvent({
      type:     'NODE_RECOVERED',
      severity: 'INFO',
      message:  `✓ ${node.label} [${nodeId}] reconnected to mesh — routes restored`,
      nodeId,
    });
    this.emit('event:new', recEvt);
    firebaseService.saveEvent(recEvt);

    // Show restored optimal route
    await sleep(400);
    topology.recalculateAllRoutes();
    this.emit('topology:update', topology.getTopologySnapshot());

    const gwId = topology.getGatewayId();
    const optRoute = topology.getShortestPath(gwId, nodeId);
    if (optRoute.path.length > 0) {
      this.emit('route:highlighted', { path: optRoute.path, type: 'recovery' });
      const routeEvt = mockData.pushEvent({
        type:     'TOPOLOGY_RESTORED',
        severity: 'INFO',
        message:  `Mesh topology restored — optimal path: ${optRoute.path.join(' → ')}`,
        nodeId:   gwId,
      });
      this.emit('event:new', routeEvt);
    }
  }

  getLog(limit = 20) { return failoverLog.slice(0, limit); }
}

const instance = new FailoverService();
module.exports = instance;
module.exports.getLog = (limit) => failoverLog.slice(0, limit);

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
