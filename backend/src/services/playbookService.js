/**
 * PlaybookService — automated incident response engine for the AegisMesh NOC.
 *
 * Continuously evaluates predefined security/network rules (if-this-then-that)
 * and triggers immediate automated remediation.
 */

const topology = require('./topologyService');
// Dynamically imported inside action block to resolve circular dependency

class PlaybookService {
  constructor() {
    this.io = null;
    this.history = [];
    this.playbooks = [
      {
        id: 'pb-thermal-isolation',
        name: 'Thermal Node Isolation',
        trigger: 'IF Temperature > 50°C',
        action: 'Isolate node, trigger warning, reroute traffic',
        enabled: true,
        severity: 'CRITICAL',
        lastTriggered: null,
      },
      {
        id: 'pb-cascade-mitigation',
        name: 'Cascade Failure Mitigation',
        trigger: 'IF > 2 nodes fail within 60 seconds',
        action: 'Recalculate entire topology paths, alert admin via telegram, trigger recovery mode',
        enabled: true,
        severity: 'CRITICAL',
        lastTriggered: null,
      },
      {
        id: 'pb-power-saver',
        name: 'Proactive Power Conservation',
        trigger: 'IF Node Battery < 20%',
        action: 'Switch node to ECO mode, alert NOC, trigger rerouting around node',
        enabled: true,
        severity: 'WARNING',
        lastTriggered: null,
      },
      {
        id: 'pb-proactive-reroute',
        name: 'Preemptive Anomaly Rerouting',
        trigger: 'IF AI anomaly score > 80%',
        action: 'Bypass node routes preemptively, flag for inspections',
        enabled: true,
        severity: 'WARNING',
        lastTriggered: null,
      }
    ];

    this.failureTimestamps = [];
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  getPlaybooks() {
    return this.playbooks;
  }

  getExecutionLogs() {
    return this.history;
  }

  togglePlaybook(id) {
    const pb = this.playbooks.find(p => p.id === id);
    if (pb) {
      pb.enabled = !pb.enabled;
      this.emit('playbooks:update', this.playbooks);
      return true;
    }
    return false;
  }

  executeAction(pbId, nodeId, reason) {
    const pb = this.playbooks.find(p => p.id === pbId);
    if (!pb || !pb.enabled) return;

    console.log(`[Playbook] 🤖 Executing Playbook: "${pb.name}" for Node: ${nodeId} (${reason})`);
    pb.lastTriggered = new Date().toISOString();

    const executionLog = {
      _id: Date.now() + Math.random(),
      playbookId: pbId,
      playbookName: pb.name,
      nodeId,
      trigger: pb.trigger,
      action: pb.action,
      timestamp: new Date().toISOString(),
      status: 'EXECUTED',
      details: reason
    };

    this.history.unshift(executionLog);
    if (this.history.length > 100) this.history.pop();

    this.emit('playbook:triggered', executionLog);
    this.emit('playbooks:update', this.playbooks);

    // Actual system actions based on playbook logic
    switch (pbId) {
      case 'pb-thermal-isolation':
        // Set node to unstable or fail it manually to isolate it
        topology.updateNodeStatus(nodeId, 'failed');
        const failoverSvc = require('./failoverService');
        failoverSvc.triggerFailover(nodeId, 'Automated Thermal Isolation Playbook');
        break;

      case 'pb-power-saver':
        // Change power state to ECO
        const powerService = require('./powerService');
        powerService.setMode(nodeId, 'ECO');
        break;

      case 'pb-proactive-reroute':
        // Modify topology to bypass this node (increase edge weights connected to this node to route around it)
        console.log(`[Playbook] Preemptively adjusting link costs to route around ${nodeId}`);
        Object.keys(topology.graph[nodeId] || {}).forEach(neighbor => {
          topology.updateEdgeLatency(nodeId, neighbor, 150); // Set latency high to discourage use
        });
        topology.recalculateAllRoutes();
        this.emit('topology:update', topology.getTopologySnapshot());
        break;

      case 'pb-cascade-mitigation':
        // Trigger optimized paths check and global recovery mode
        topology.recalculateAllRoutes();
        this.emit('topology:update', topology.getTopologySnapshot());
        break;
    }
  }

  evaluateRules(nodeId, telemetry, metrics) {
    // 1. Thermal Isolation
    if (telemetry.temperature > 50) {
      const pb = this.playbooks.find(p => p.id === 'pb-thermal-isolation');
      if (pb && pb.enabled && (!pb.lastTriggered || (Date.now() - new Date(pb.lastTriggered).getTime()) > 30000)) {
        this.executeAction('pb-thermal-isolation', nodeId, `Temperature crossed critical threshold: ${telemetry.temperature}°C`);
      }
    }

    // 2. Power Saver
    if (telemetry.batteryLevel < 20) {
      const pb = this.playbooks.find(p => p.id === 'pb-power-saver');
      if (pb && pb.enabled && (!pb.lastTriggered || (Date.now() - new Date(pb.lastTriggered).getTime()) > 120000)) {
        const powerService = require('./powerService');
        const pState = powerService.getNodePower(nodeId);
        if (pState && pState.mode === 'NORMAL') {
          this.executeAction('pb-power-saver', nodeId, `Battery dropped to ${telemetry.batteryLevel.toFixed(1)}%`);
        }
      }
    }

    // 3. Proactive Reroute
    const anomaly = metrics.anomalyScore || 0;
    if (anomaly > 80) {
      const pb = this.playbooks.find(p => p.id === 'pb-proactive-reroute');
      if (pb && pb.enabled && (!pb.lastTriggered || (Date.now() - new Date(pb.lastTriggered).getTime()) > 60000)) {
        this.executeAction('pb-proactive-reroute', nodeId, `AI Anomaly score reached ${anomaly}`);
      }
    }
  }

  recordFailure(nodeId) {
    this.failureTimestamps.push(Date.now());
    
    // Keep only last 60 seconds
    const cutoff = Date.now() - 60000;
    this.failureTimestamps = this.failureTimestamps.filter(t => t >= cutoff);

    if (this.failureTimestamps.length > 2) {
      const pb = this.playbooks.find(p => p.id === 'pb-cascade-mitigation');
      if (pb && pb.enabled && (!pb.lastTriggered || (Date.now() - new Date(pb.lastTriggered).getTime()) > 60000)) {
        this.executeAction('pb-cascade-mitigation', nodeId, `${this.failureTimestamps.length} network node failures registered within 60s`);
      }
    }
  }
}

module.exports = new PlaybookService();
