/**
 * SLAService — SLA Compliance Monitor
 *
 * Tracks network SLAs in real time (e.g. latency, packet loss, availability)
 * and records breaches for reporting.
 */

const topology = require('./topologyService');

const SLA_TARGETS = {
  availability: 99.5, // Uptime percentage target
  latency:      150,  // Max latency in ms (relaxed from 50ms)
  packetLoss:   5.0,  // Max packet loss in % (relaxed from 1.0%)
};

class SLAService {
  constructor() {
    this.io = null;
    this.breaches = [];
    this.evalInterval = null;
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  getSLATargets() {
    return SLA_TARGETS;
  }

  getBreachLog() {
    return this.breaches;
  }

  evaluateCompliance() {
    const historyService = require('./historyService');
    const nodes = topology.getAllNodes();
    const currentBreaches = [];

    nodes.forEach(node => {
      const nodeId = node.nodeId;
      const uptime = historyService.getUptimePercentage(nodeId);
      const metrics = node.telemetry || {};

      // 1. Availability check
      if (uptime < SLA_TARGETS.availability) {
        currentBreaches.push({
          nodeId,
          metric: 'availability',
          value: uptime,
          target: SLA_TARGETS.availability,
          type: 'CRITICAL',
          message: `${node.label} availability is ${uptime}% (target is >= ${SLA_TARGETS.availability}%)`,
        });
      }

      // 2. Latency check
      const lat = node.latency || 0;
      if (lat > SLA_TARGETS.latency && node.status !== 'failed') {
        currentBreaches.push({
          nodeId,
          metric: 'latency',
          value: +lat.toFixed(1),
          target: SLA_TARGETS.latency,
          type: 'WARNING',
          message: `${node.label} latency is ${lat.toFixed(1)}ms (target is <= ${SLA_TARGETS.latency}ms)`,
        });
      }

      // 3. Packet Loss check
      const loss = node.packetLoss || 0;
      if (loss > SLA_TARGETS.packetLoss && node.status !== 'failed') {
        currentBreaches.push({
          nodeId,
          metric: 'packetLoss',
          value: +loss.toFixed(1),
          target: SLA_TARGETS.packetLoss,
          type: 'WARNING',
          message: `${node.label} packet loss is ${loss.toFixed(1)}% (target is <= ${SLA_TARGETS.packetLoss}%)`,
        });
      }
    });

    // Handle reporting and alerts for new breaches
    currentBreaches.forEach(b => {
      const isLogged = this.breaches.some(prev => 
        prev.nodeId === b.nodeId && 
        prev.metric === b.metric && 
        (Date.now() - new Date(prev.timestamp).getTime()) < 60000 // deduplicate within 60s
      );

      if (!isLogged) {
        const fullBreach = {
          ...b,
          _id: Date.now() + Math.random(),
          timestamp: new Date().toISOString()
        };
        this.breaches.unshift(fullBreach);
        if (this.breaches.length > 100) this.breaches.pop();

        this.emit('sla:breach', fullBreach);
        
        // Also feed into events
        const mockDataService = require('./mockDataService');
        const evt = mockDataService.pushEvent({
          type: 'SLA_BREACH',
          severity: b.type,
          message: b.message,
          nodeId: b.nodeId,
        });
        this.emit('event:new', evt);
      }
    });

    // Calculate global SLA metric
    const globalSla = this._calculateGlobalSla(nodes, historyService);
    this.emit('sla:update', {
      globalCompliance: globalSla,
      breaches: this.breaches.slice(0, 10),
      timestamp: new Date().toISOString()
    });
  }

  _calculateGlobalSla(nodes, historyService) {
    if (nodes.length === 0) return 100;
    
    let totalScore = 0;
    nodes.forEach(n => {
      let nodeScore = 100;
      const uptime = historyService.getUptimePercentage(n.nodeId);
      
      // Weight availability heavily (60%)
      const availDeficit = Math.max(0, SLA_TARGETS.availability - uptime);
      nodeScore -= availDeficit * 5; // drop score quickly for low uptime

      // Weight latency (20%)
      if ((n.latency || 0) > SLA_TARGETS.latency) {
        nodeScore -= 10;
      }

      // Weight packet loss (20%)
      if ((n.packetLoss || 0) > SLA_TARGETS.packetLoss) {
        nodeScore -= 10;
      }

      totalScore += Math.max(0, nodeScore);
    });

    return Math.round(totalScore / nodes.length);
  }

  start() {
    this.evalInterval = setInterval(() => this.evaluateCompliance(), 10000); // Check compliance every 10s
  }

  stop() {
    if (this.evalInterval) clearInterval(this.evalInterval);
  }
}

module.exports = new SLAService();
