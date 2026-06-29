/**
 * CapacityService — Network Capacity and Growth Simulation Engine
 *
 * Models overall mesh bandwidth, traffic limits, congestion ratios,
 * and allows simulating the adding of N nodes to verify routing health.
 */

const topology = require('./topologyService');

class CapacityService {
  constructor() {
    this.maxCapacityPackets = 10000; // max packets the mesh can route per second
  }

  getCapacityReport() {
    const snap = topology.getTopologySnapshot();
    const load = snap.packetThroughput || 3500;
    const utilization = +(load / this.maxCapacityPackets * 100).toFixed(1);
    
    // Growth analysis
    const maxHealthyNodes = 12;
    const currentNodes = snap.nodes.length;
    const remainingNodes = Math.max(0, maxHealthyNodes - currentNodes);

    return {
      totalCapacity: this.maxCapacityPackets,
      currentLoad: load,
      utilizationPercentage: utilization,
      maxNodesRecommended: maxHealthyNodes,
      currentNodeCount: currentNodes,
      remainingExpansionCount: remainingNodes,
      congestionLevel: utilization > 80 ? 'CRITICAL' : utilization > 50 ? 'MODERATE' : 'OPTIMAL'
    };
  }

  simulateExpansion(addedNodesCount) {
    const report = this.getCapacityReport();
    const futureNodes = report.currentNodeCount + addedNodesCount;
    
    // Simple load growth model: linear + exponential coupling penalty
    const extraLoadFactor = addedNodesCount * 450;
    const feedbackLoad = Math.pow(futureNodes, 1.3) * 35;
    const simulatedLoad = Math.round(report.currentLoad + extraLoadFactor + feedbackLoad);
    const simulatedUtil = +(simulatedLoad / this.maxCapacityPackets * 100).toFixed(1);

    // Predict changes
    const expectedLatency = Math.max(5, Math.round(10 + (simulatedUtil * 0.4)));
    const expectedPacketLoss = simulatedUtil > 80 ? +((simulatedUtil - 80) * 0.5).toFixed(1) : 0;

    return {
      nodeCount: futureNodes,
      simulatedLoad,
      simulatedUtilization: simulatedUtil,
      projectedLatency: expectedLatency,
      projectedPacketLoss: expectedPacketLoss,
      status: simulatedUtil > 90 ? 'CRITICAL_CONGESTION' : simulatedUtil > 70 ? 'HIGH_LOAD' : 'STABLE'
    };
  }
}

module.exports = new CapacityService();
