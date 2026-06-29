/**
 * PowerService — Simulates battery consumption, solar harvesting, and power states for IoT nodes.
 *
 * Tracks battery levels, calculates drain dynamically based on CPU/packet activity,
 * handles automatic power mode transitions, and integrates with the mesh topology.
 */

const topology = require('./topologyService');

class PowerService {
  constructor() {
    this.io = null;
    this.nodesPower = {}; // nodeId -> powerState
    this.history = {}; // nodeId -> batteryHistory[]
    this.tickCount = 0;

    // Initialize power state for all default nodes
    setTimeout(() => {
      topology.getAllNodes().forEach(n => {
        const battery = 75 + Math.random() * 25; // start between 75% and 100%
        this.nodesPower[n.nodeId] = {
          nodeId: n.nodeId,
          battery,
          mode: 'NORMAL', // NORMAL, ECO, SLEEP, CRITICAL, DEAD
          solarActive: false,
          drainRate: 0.02,
          history: Array(30).fill(battery),
        };
        this.history[n.nodeId] = Array(30).fill(battery);
      });
    }, 1000);
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  setMode(nodeId, mode) {
    const validModes = ['NORMAL', 'ECO', 'SLEEP', 'CRITICAL', 'DEAD'];
    if (!validModes.includes(mode)) return false;

    if (this.nodesPower[nodeId]) {
      this.nodesPower[nodeId].mode = mode;
      
      // If we manually revived a DEAD node, reset battery to 10%
      if (mode !== 'DEAD' && this.nodesPower[nodeId].battery < 5) {
        this.nodesPower[nodeId].battery = 10;
        topology.updateNodeStatus(nodeId, 'healthy');
      }

      // If we set to DEAD, trigger failure
      if (mode === 'DEAD') {
        this.nodesPower[nodeId].battery = 0;
        topology.updateNodeStatus(nodeId, 'failed');
      }

      this.emit('power:change', { nodeId, mode, battery: this.nodesPower[nodeId].battery });
      return true;
    }
    return false;
  }

  getNodePower(nodeId) {
    const power = this.nodesPower[nodeId];
    if (!power) return null;

    // Calculate dynamic drain rate and estimated time remaining
    const drain = this._calculateDrainRate(nodeId);
    let etrSecs = 'Stable';
    if (drain > 0 && power.mode !== 'DEAD') {
      const remainingPct = power.battery;
      const ticksRemaining = remainingPct / drain;
      const secondsRemaining = Math.round(ticksRemaining * 2); // 2s per tick
      
      const hrs = Math.floor(secondsRemaining / 3600);
      const mins = Math.floor((secondsRemaining % 3600) / 60);
      etrSecs = hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
    }

    return {
      ...power,
      drainRate: drain,
      estimatedTimeRemaining: etrSecs,
    };
  }

  getAllPower() {
    const result = {};
    Object.keys(this.nodesPower).forEach(nodeId => {
      result[nodeId] = this.getNodePower(nodeId);
    });
    return result;
  }

  getPowerHistory(nodeId) {
    return this.history[nodeId] || [];
  }

  getEnergyEfficiency(nodeId) {
    const node = topology.getNode(nodeId);
    const power = this.nodesPower[nodeId];
    if (!node || !power || power.battery === 0) return 0;
    
    // Work done = packetCount. Energy consumed = (100 - batteryLevel) or a ratio.
    // Efficiency = packetCount / (average drain + 1)
    const drain = this._calculateDrainRate(nodeId);
    const efficiency = (node.packetCount || 0) / (drain * 100 + 1);
    return Math.round(efficiency);
  }

  tick() {
    this.tickCount++;
    const nodeIds = Object.keys(this.nodesPower);

    nodeIds.forEach(nodeId => {
      const node = topology.getNode(nodeId);
      const power = this.nodesPower[nodeId];
      if (!power) return;

      // If the node is in live hardware mode, skip simulated drainage/solar calculations.
      // Its battery state is driven directly by real ESP32 telemetry.
      if (node && node.mode === 'live') {
        if (node.telemetry && node.telemetry.batteryLevel !== undefined) {
          power.battery = node.telemetry.batteryLevel;
        }

        // Auto state transition boundaries still apply for UI states (CRITICAL / DEAD)
        const oldMode = power.mode;
        if (power.battery < 5) {
          power.mode = 'DEAD';
          if (oldMode !== 'DEAD') {
            console.log(`[Power] Live Node ${nodeId} battery depleted.`);
            topology.updateNodeStatus(nodeId, 'failed');
            this.emit('power:dead', { nodeId });
          }
        } else if (power.battery < 20) {
          power.mode = 'CRITICAL';
          if (oldMode !== 'CRITICAL') {
            this.emit('power:critical', { nodeId, battery: power.battery });
          }
        } else {
          power.mode = 'NORMAL';
        }

        // Maintain running history
        this.history[nodeId].push(power.battery);
        if (this.history[nodeId].length > 100) this.history[nodeId].shift();
        power.history = this.history[nodeId].slice(-30);
        return;
      }

      // Skip processing if node has failed or disconnected
      if (node && node.status === 'failed' && power.mode !== 'DEAD') {
        // failed node has minimal standby drain
        power.battery = Math.max(0, power.battery - 0.001);
        if (power.battery === 0) {
          power.mode = 'DEAD';
        }
        return;
      }

      // 1. Solar harvesting simulation (20% chance recharge burst)
      const isSolarActive = Math.random() < 0.20;
      power.solarActive = isSolarActive && power.mode !== 'DEAD';
      
      let recharge = 0;
      if (power.solarActive) {
        recharge = 0.5 + Math.random() * 1.5; // recharge 0.5% - 2%
      }

      // 2. Battery drain calculations
      const drain = this._calculateDrainRate(nodeId);
      
      // Update battery level
      const netChange = recharge - drain;
      power.battery = Math.max(0, Math.min(100, power.battery + netChange));

      // 3. Auto state transitions based on battery limits
      const oldMode = power.mode;
      if (power.battery < 5) {
        power.mode = 'DEAD';
        if (oldMode !== 'DEAD') {
          console.log(`[Power] Node ${nodeId} battery depleted. Triggering failover.`);
          topology.updateNodeStatus(nodeId, 'failed');
          this.emit('power:dead', { nodeId });
          const failoverService = require('./failoverService');
          failoverService.triggerFailover(nodeId, 'Battery Depletion');
        }
      } else if (power.battery < 20) {
        power.mode = 'CRITICAL';
        if (oldMode !== 'CRITICAL') {
          this.emit('power:critical', { nodeId, battery: power.battery });
        }
      } else if (power.battery < 35 && oldMode === 'NORMAL') {
        power.mode = 'ECO'; // Auto-transition to ECO if running low
      }

      // Update node telemetry battery
      if (node && node.telemetry) {
        node.telemetry.batteryLevel = Math.round(power.battery);
      }

      // Maintain running history
      this.history[nodeId].push(power.battery);
      if (this.history[nodeId].length > 100) this.history[nodeId].shift();
      power.history = this.history[nodeId].slice(-30);
    });

    // Broadcast power status updates to clients periodically
    if (this.tickCount % 5 === 0) {
      this.emit('power:update', this.getAllPower());
    }
  }

  _calculateDrainRate(nodeId) {
    const node = topology.getNode(nodeId);
    const power = this.nodesPower[nodeId];
    if (!power) return 0;
    if (power.mode === 'DEAD') return 0;

    let baseDrain = 0.02; // base drain per 2s tick

    // Apply CPU usage multiplier
    const cpu = node ? (node.cpuUsage || 0) : 0;
    const cpuMult = 1 + (cpu / 100);

    // Apply traffic multipliers
    const packets = node ? (node.packetCount || 0) : 0;
    const packetMult = 1 + (packets / 20000);

    let drain = baseDrain * cpuMult * packetMult;

    // Apply state multipliers
    if (power.mode === 'SLEEP') {
      drain *= 0.1; // Sleep mode consumes 90% less power
    } else if (power.mode === 'ECO') {
      drain *= 0.5; // ECO mode consumes 50% less power
    } else if (power.mode === 'CRITICAL') {
      drain *= 0.4; // Critical automatically throttles consumption
    }

    return drain;
  }
}

module.exports = new PowerService();
