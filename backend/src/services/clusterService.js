/**
 * ClusterService — Handles LEACH dynamic clustering elections based on battery and proximity
 */

const topology = require('./topologyService');
const mockData = require('./mockDataService');

class ClusterService {
  constructor() {
    this.io = null;
    this.isActive = false;
    this.intervalId = null;
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;
    this.runElection();
    this.intervalId = setInterval(() => this.runElection(), 15000);
  }

  stop() {
    this.isActive = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  runElection() {
    const nodes = topology.getAllNodes();
    const liveNodes = nodes.filter(n => n.status === 'healthy' && !n.isGateway);
    if (liveNodes.length === 0) return;

    // Define geographical groups (Clusters)
    // Cluster 1: Left nodes (x < 400) -> ESP32-A, ESP32-D, etc.
    // Cluster 2: Right nodes (x >= 400) -> ESP32-B, ESP32-C, etc.
    
    const cluster1Nodes = liveNodes.filter(n => n.position && n.position.x < 400);
    const cluster2Nodes = liveNodes.filter(n => n.position && n.position.x >= 400);

    let ch1 = null;
    let ch2 = null;

    // Elect Cluster Head for Cluster 1: highest battery level
    if (cluster1Nodes.length > 0) {
      cluster1Nodes.sort((a, b) => {
        const batA = a.telemetry?.batteryLevel || 100;
        const batB = b.telemetry?.batteryLevel || 100;
        return batB - batA; // highest battery first
      });
      ch1 = cluster1Nodes[0].nodeId;
    }

    // Elect Cluster Head for Cluster 2: highest battery level
    if (cluster2Nodes.length > 0) {
      cluster2Nodes.sort((a, b) => {
        const batA = a.telemetry?.batteryLevel || 100;
        const batB = b.telemetry?.batteryLevel || 100;
        return batB - batA;
      });
      ch2 = cluster2Nodes[0].nodeId;
    }

    // Update all nodes in topology with cluster membership
    nodes.forEach(node => {
      if (node.isGateway) {
        node.clusterId = 'gateway';
        node.isClusterHead = false;
        return;
      }

      if (node.status === 'failed' || node.status === 'quarantined') {
        node.clusterId = 'none';
        node.isClusterHead = false;
        return;
      }

      const isLeft = node.position && node.position.x < 400;
      if (isLeft) {
        node.clusterId = 'cluster-1';
        node.isClusterHead = node.nodeId === ch1;
      } else {
        node.clusterId = 'cluster-2';
        node.isClusterHead = node.nodeId === ch2;
      }
    });

    const electedMessage = `LEACH Election: Cluster Heads elected — CH1: ${ch1 || 'None'}, CH2: ${ch2 || 'None'}`;
    console.log(`[LEACH] ${electedMessage}`);

    // Create event log
    const evt = mockData.pushEvent({
      type: 'LEACH_ELECTION',
      severity: 'INFO',
      message: `🌐 LEACH dynamic clustering election completed: CH1: ${ch1 || 'None'} (Left Cluster) | CH2: ${ch2 || 'None'} (Right Cluster)`,
      nodeId: 'GW-001'
    });
    this.emit('event:new', evt);

    this.emit('topology:update', topology.getTopologySnapshot());
    this.emit('cluster:election', { ch1, ch2 });
  }
}

module.exports = new ClusterService();
