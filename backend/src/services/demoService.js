/**
 * DemoService v1 — Automated demonstration state machine
 *
 * Runs a scripted 8-step demo sequence that showcases all AegisMesh capabilities.
 * Each step has: name, duration, description, and an action function.
 *
 * Sequence:
 *   1. HEALTHY_NETWORK  — All nodes green, stable topology
 *   2. LIVE_PACKET_FLOW — Show packet animations + telemetry flowing
 *   3. NODE_FAILURE     — Disconnect ESP32-A
 *   4. FAILOVER_INIT    — Show failover banner + Dijkstra recalculation
 *   5. ROUTE_REROUTE    — Highlight new paths
 *   6. NODE_RECOVERY    — Bring ESP32-A back online
 *   7. FLOOD_ATTACK     — Simulate DDoS on GW-001
 *   8. RESTORATION      — Clear attack + show green state
 */

const topology      = require('./topologyService');
const failoverSvc   = require('./failoverService');
const mockDataSvc   = require('./mockDataService');

class DemoService {
  constructor() {
    this.io          = null;
    this.running     = false;
    this.paused      = false;
    this.currentStep = 0;
    this.timer       = null;
    this.steps       = this._buildSteps();
  }

  setIO(io) { this.io = io; }
  emit(event, data) { if (this.io) this.io.emit(event, data); }

  _buildSteps() {
    return [
      {
        name: 'HEALTHY_NETWORK',
        label: 'Healthy Network',
        description: 'All nodes operational — mesh connectivity verified',
        duration: 6000,
        action: () => {
          // Ensure all nodes are healthy
          ['ESP32-A', 'ESP32-B', 'ESP32-C', 'ESP32-D'].forEach(id => {
            const node = topology.getNode(id);
            if (node && node.status === 'failed') {
              topology.updateNodeStatus(id, 'healthy');
            }
          });
          topology.recalculateAllRoutes();
          this.emit('topology:update', topology.getTopologySnapshot());
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: Healthy network state — all 5 nodes online',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
      {
        name: 'LIVE_PACKET_FLOW',
        label: 'Live Packet Flow',
        description: 'Realtime telemetry streaming across mesh edges',
        duration: 7000,
        action: () => {
          // Trigger a route optimization to show paths
          topology.recalculateAllRoutes();
          const allNodes = topology.getAllNodes().filter(n => !n.isGateway && n.status !== 'failed');
          const paths = allNodes.map(n => topology.getShortestPath('GW-001', n.nodeId).path).filter(p => p.length > 0);
          this.emit('routes:optimized', { paths });
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: Live packet flow active — Dijkstra optimal paths displayed',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
      {
        name: 'NODE_FAILURE',
        label: 'Node Failure',
        description: 'ESP32-A disconnected — simulating hardware failure',
        duration: 7000,
        action: async () => {
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'WARNING',
            message: '▶ DEMO: Triggering node failure on ESP32-A',
            nodeId: 'ESP32-A',
          });
          this.emit('event:new', evt);
          await failoverSvc.triggerFailover('ESP32-A', 'Demo Sequence');
        },
      },
      {
        name: 'FAILOVER_ACTIVE',
        label: 'Failover Active',
        description: 'Self-healing in progress — Dijkstra recalculating routes',
        duration: 6000,
        action: () => {
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: Failover complete — network rerouted through alternate paths',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
      {
        name: 'ROUTE_REROUTE',
        label: 'Route Reroute',
        description: 'New optimal paths established via alternate mesh links',
        duration: 6000,
        action: () => {
          // Highlight the rerouted paths
          const paths = topology.getAllNodes()
            .filter(n => !n.isGateway && n.status !== 'failed')
            .map(n => topology.getShortestPath('GW-001', n.nodeId).path)
            .filter(p => p.length > 0);
          if (paths.length > 0) {
            this.emit('route:highlighted', { path: paths[0], type: 'failover' });
          }
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: Alternate routes highlighted — mesh resilience demonstrated',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
      {
        name: 'NODE_RECOVERY',
        label: 'Node Recovery',
        description: 'ESP32-A reconnected — topology restored',
        duration: 7000,
        action: async () => {
          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: Recovering ESP32-A — restoring original topology',
            nodeId: 'ESP32-A',
          });
          this.emit('event:new', evt);
          await failoverSvc.recoverNode('ESP32-A');
        },
      },
      {
        name: 'FLOOD_ATTACK',
        label: 'Flood Attack',
        description: 'DDoS simulation on Gateway — threat detection active',
        duration: 8000,
        action: () => {
          mockDataSvc.setAttackMode(true, 'GW-001');
          topology.updateNodeMetrics('GW-001', { anomalyScore: 87, cpuUsage: 95 });
          this.emit('topology:update', topology.getTopologySnapshot());

          const alert = mockDataSvc.pushAlert({
            type: 'FLOOD_ATTACK', nodeId: 'GW-001', severity: 'CRITICAL',
            description: 'DEMO: DDoS flood attack on Gateway — 8500 pkt/s',
          });
          this.emit('alert:new', alert);
          this.emit('threat:attack', { nodeId: 'GW-001', type: 'FLOOD', intensity: 87, rate: 8500 });

          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'CRITICAL',
            message: '▶ DEMO: ⚡ FLOOD ATTACK on Gateway — intrusion detection active',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
      {
        name: 'RESTORATION',
        label: 'Network Restoration',
        description: 'Attack mitigated — all systems nominal',
        duration: 6000,
        action: () => {
          mockDataSvc.setAttackMode(false);
          topology.updateNodeMetrics('GW-001', { anomalyScore: 5, cpuUsage: 20 });
          this.emit('topology:update', topology.getTopologySnapshot());
          this.emit('threat:cleared', { nodeId: 'GW-001' });

          const evt = mockDataSvc.pushEvent({
            type: 'DEMO', severity: 'INFO',
            message: '▶ DEMO: ✓ Network restored — all nodes operational, attack mitigated',
            nodeId: 'GW-001',
          });
          this.emit('event:new', evt);
        },
      },
    ];
  }

  async start() {
    if (this.running) return;
    this.running     = true;
    this.paused      = false;
    this.currentStep = 0;

    console.log('[Demo] ▶ Auto demo sequence started');
    this.emit('demo:started', { totalSteps: this.steps.length });

    await this._runStep();
  }

  stop() {
    this.running = false;
    this.paused  = false;
    clearTimeout(this.timer);
    console.log('[Demo] ■ Demo stopped');
    this.emit('demo:stopped', {});
  }

  pause() {
    this.paused = true;
    clearTimeout(this.timer);
    this.emit('demo:paused', { step: this.currentStep });
  }

  resume() {
    if (!this.running || !this.paused) return;
    this.paused = false;
    this._runStep();
  }

  skip() {
    clearTimeout(this.timer);
    this.currentStep++;
    if (this.currentStep >= this.steps.length) {
      this._finish();
    } else {
      this._runStep();
    }
  }

  async _runStep() {
    if (!this.running || this.paused) return;
    if (this.currentStep >= this.steps.length) {
      this._finish();
      return;
    }

    const step = this.steps[this.currentStep];
    console.log(`[Demo] Step ${this.currentStep + 1}/${this.steps.length}: ${step.name}`);

    this.emit('demo:step', {
      step:        this.currentStep,
      totalSteps:  this.steps.length,
      name:        step.name,
      label:       step.label,
      description: step.description,
      progress:    Math.round(((this.currentStep) / this.steps.length) * 100),
    });

    try {
      await step.action();
    } catch (err) {
      console.error(`[Demo] Step error: ${err.message}`);
    }

    this.timer = setTimeout(() => {
      this.currentStep++;
      this._runStep();
    }, step.duration);
  }

  _finish() {
    this.running = false;
    console.log('[Demo] ✓ Demo sequence complete');
    this.emit('demo:complete', {});
  }

  isRunning() { return this.running; }
  getStatus() {
    return {
      running:     this.running,
      paused:      this.paused,
      currentStep: this.currentStep,
      totalSteps:  this.steps.length,
      stepName:    this.running ? this.steps[this.currentStep]?.name : null,
    };
  }
}

module.exports = new DemoService();
