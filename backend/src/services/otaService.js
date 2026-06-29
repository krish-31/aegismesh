/**
 * OTAService — Handles Over-The-Air Firmware Updates for Mesh Nodes
 *
 * Implements firmware version tracking, staged updates progress simulation,
 * and integration with failoverService during reboot phase.
 */

const topology = require('./topologyService');
const failoverService = require('./failoverService');

const FIRMWARE_REGISTRY = [
  { version: 'v1.0', releaseDate: '2026-01-10', changelog: 'Initial stable release of AegisMesh core protocol.', size: '1.1MB', compatible: ['esp32', 'gateway'] },
  { version: 'v1.1', releaseDate: '2026-02-14', changelog: 'Optimized Dijkstra routing frequency; fixed DHT11 read delay.', size: '1.2MB', compatible: ['esp32'] },
  { version: 'v1.2', releaseDate: '2026-03-22', changelog: 'Power management mode integration; sleeping node recovery fix.', size: '1.2MB', compatible: ['esp32'] },
  { version: 'v2.0', releaseDate: '2026-05-05', changelog: 'Major update. EWMA anomaly metrics support; multi-channel MQTT sync.', size: '1.4MB', compatible: ['esp32', 'gateway'] },
  { version: 'v2.1', releaseDate: '2026-06-01', changelog: 'Latest stable. Fast path failover detection (<500ms); battery drainage optimization.', size: '1.5MB', compatible: ['esp32'] },
];

class OTAService {
  constructor() {
    this.io = null;
    this.history = [];
    this.activeUpdates = new Map(); // nodeId -> updateState
    this.nodeFirmwareVersions = {}; // nodeId -> version
    this.previousFirmwareVersions = {}; // nodeId -> version (for rollback)

    // Set initial versions
    setTimeout(() => {
      topology.getAllNodes().forEach(n => {
        this.nodeFirmwareVersions[n.nodeId] = n.isGateway ? 'v2.0' : 'v1.0';
      });
    }, 1000);
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  getRegistry() {
    return FIRMWARE_REGISTRY;
  }

  getNodeFirmware(nodeId) {
    const current = this.nodeFirmwareVersions[nodeId] || 'v1.0';
    const compatible = FIRMWARE_REGISTRY.filter(fw => {
      const node = topology.getNode(nodeId);
      return node && fw.compatible.includes(node.nodeType);
    });

    return {
      current,
      available: compatible.filter(fw => fw.version !== current),
      registry: compatible,
    };
  }

  getUpdateHistory() {
    return this.history;
  }

  getBatchStatus() {
    const nodes = topology.getAllNodes();
    const status = {};
    nodes.forEach(n => {
      status[n.nodeId] = {
        version: this.nodeFirmwareVersions[n.nodeId] || 'v1.0',
        updating: this.activeUpdates.has(n.nodeId),
        updateState: this.activeUpdates.get(n.nodeId) || null,
      };
    });
    return status;
  }

  startUpdate(nodeId, targetVersion) {
    const node = topology.getNode(nodeId);
    if (!node || node.status === 'failed') return false;
    if (this.activeUpdates.has(nodeId)) return false;

    // Validate version exists
    const fw = FIRMWARE_REGISTRY.find(f => f.version === targetVersion);
    if (!fw) return false;

    console.log(`[OTA] Starting firmware update for ${nodeId} to version ${targetVersion}`);
    this.previousFirmwareVersions[nodeId] = this.nodeFirmwareVersions[nodeId] || 'v1.0';

    const updateState = {
      nodeId,
      version: targetVersion,
      stage: 'DOWNLOADING',
      progress: 0,
      startedAt: new Date().toISOString(),
    };

    this.activeUpdates.set(nodeId, updateState);
    this.emit('ota:progress', updateState);

    // Record in history
    this.history.unshift({
      _id: Date.now() + Math.random(),
      nodeId,
      fromVersion: this.previousFirmwareVersions[nodeId],
      toVersion: targetVersion,
      status: 'IN_PROGRESS',
      timestamp: new Date().toISOString()
    });

    const intervalId = setInterval(() => {
      if (!this.activeUpdates.has(nodeId)) {
        clearInterval(intervalId);
        return;
      }

      const state = this.activeUpdates.get(nodeId);
      state.progress += 10;

      // Handle transitions
      if (state.progress < 30) {
        state.stage = 'DOWNLOADING';
      } else if (state.progress < 50) {
        state.stage = 'VERIFYING';
      } else if (state.progress < 80) {
        state.stage = 'INSTALLING';
      } else if (state.progress < 95) {
        if (state.stage !== 'REBOOTING') {
          state.stage = 'REBOOTING';
          console.log(`[OTA] Node ${nodeId} entering reboot phase. Triggering failover...`);
          // Temporarily set node status to failed to simulate reboot failover
          topology.updateNodeStatus(nodeId, 'failed');
          this.emit('topology:update', topology.getTopologySnapshot());
        }
      } else {
        // Complete (100)
        clearInterval(intervalId);
        state.progress = 100;
        state.stage = 'COMPLETE';
        
        this.nodeFirmwareVersions[nodeId] = targetVersion;
        topology.updateNodeMetrics(nodeId, { firmwareVersion: targetVersion });
        
        // Recover node
        console.log(`[OTA] Node ${nodeId} successfully rebooted with firmware ${targetVersion}. Restoring...`);
        topology.updateNodeStatus(nodeId, 'healthy');
        this.emit('topology:update', topology.getTopologySnapshot());

        // Update history status
        const record = this.history.find(h => h.nodeId === nodeId && h.toVersion === targetVersion && h.status === 'IN_PROGRESS');
        if (record) record.status = 'SUCCESS';

        this.emit('ota:complete', { nodeId, version: targetVersion });
        this.activeUpdates.delete(nodeId);
        return;
      }

      this.activeUpdates.set(nodeId, state);
      this.emit('ota:progress', state);
    }, 1500); // Takes ~15s to complete

    return true;
  }

  cancelUpdate(nodeId) {
    if (!this.activeUpdates.has(nodeId)) return false;
    const state = this.activeUpdates.get(nodeId);
    
    // If it was rebooting, recover it
    if (state.stage === 'REBOOTING') {
      topology.updateNodeStatus(nodeId, 'healthy');
    }

    const record = this.history.find(h => h.nodeId === nodeId && h.toVersion === state.version && h.status === 'IN_PROGRESS');
    if (record) record.status = 'CANCELLED';

    this.activeUpdates.delete(nodeId);
    this.emit('ota:failed', { nodeId, reason: 'User cancelled update' });
    return true;
  }

  getMST() {
    return topology.computeMST();
  }

  startMSTUpdate(targetVersion) {
    const mst = topology.computeMST();
    if (mst.length === 0) return false;

    // Build MST adjacency tree
    const adj = {};
    mst.forEach(edge => {
      if (!adj[edge.from]) adj[edge.from] = [];
      if (!adj[edge.to]) adj[edge.to] = [];
      adj[edge.from].push(edge.to);
      adj[edge.to].push(edge.from);
    });

    const startNode = Object.keys(topology.nodes).find(n => topology.nodes[n].isGateway) || Object.keys(adj)[0];
    if (!startNode) return false;

    const queue = [startNode];
    const visited = new Set([startNode]);
    const updateOrder = [];

    while (queue.length > 0) {
      const u = queue.shift();
      if (u !== startNode) {
        updateOrder.push(u);
      }
      const neighbors = adj[u] || [];
      neighbors.forEach(v => {
        if (!visited.has(v)) {
          visited.add(v);
          queue.push(v);
        }
      });
    }

    console.log(`[OTA MST] Running sequential update order: ${updateOrder.join(' -> ')}`);
    
    let idx = 0;
    const runNext = () => {
      if (idx >= updateOrder.length) {
        console.log(`[OTA MST] Multicast complete!`);
        this.emit('ota:mst-complete', { version: targetVersion });
        return;
      }
      const nodeId = updateOrder[idx];
      this.startUpdate(nodeId, targetVersion);
      
      const checkInterval = setInterval(() => {
        if (!this.activeUpdates.has(nodeId)) {
          clearInterval(checkInterval);
          idx++;
          setTimeout(runNext, 1000);
        }
      }, 500);
    };

    runNext();
    this.emit('ota:mst-start', { mst, order: updateOrder });
    return true;
  }

  rollback(nodeId) {
    const prev = this.previousFirmwareVersions[nodeId];
    if (!prev) return false;

    console.log(`[OTA] Rolling back firmware on ${nodeId} to ${prev}`);
    const success = this.startUpdate(nodeId, prev);
    return success;
  }
}

module.exports = new OTAService();
