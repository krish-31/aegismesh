/**
 * ZoneService — Handles building zone layout mappings and localized metrics aggregation.
 *
 * Defines logical geofenced zones (e.g. Server Room, Lab), maps physical nodes
 * to zones, and computes aggregated metrics & alarms per sector.
 */

const topology = require('./topologyService');

class ZoneService {
  constructor() {
    this.io = null;
    this.zones = [
      { id: 'zone-server-room', name: 'Server Room Alpha', description: 'Core server hosting cabinet & main gateway link.', bounds: { x: 50, y: 50, width: 350, height: 250 }, color: 'rgba(0, 245, 255, 0.15)' },
      { id: 'zone-corridor', name: 'Main Access Corridor', description: 'Heavy transit pathway; links Server Room to Lab.', bounds: { x: 450, y: 50, width: 300, height: 180 }, color: 'rgba(255, 170, 0, 0.15)' },
      { id: 'zone-lab', name: 'Engineering Lab B', description: 'Testing workstations & development sensor array.', bounds: { x: 450, y: 260, width: 300, height: 230 }, color: 'rgba(57, 255, 20, 0.15)' },
      { id: 'zone-outdoor', name: 'Outdoor Loading Bay', description: 'Corrosion testing; external temperature probe node.', bounds: { x: 50, y: 330, width: 350, height: 160 }, color: 'rgba(168, 85, 247, 0.15)' },
    ];

    this.nodeMappings = {
      'GW-001': 'zone-server-room',
      'ESP32-A': 'zone-server-room',
      'ESP32-B': 'zone-corridor',
      'ESP32-C': 'zone-lab',
      'ESP32-D': 'zone-outdoor',
    };
  }

  setIO(io) {
    this.io = io;
  }

  emit(event, data) {
    if (this.io) this.io.emit(event, data);
  }

  getZones() {
    const snap = topology.getTopologySnapshot();
    const allNodes = snap.nodes;

    return this.zones.map(z => {
      const zoneNodeIds = Object.keys(this.nodeMappings).filter(nodeId => this.nodeMappings[nodeId] === z.id);
      const zoneNodes = allNodes.filter(n => zoneNodeIds.includes(n.nodeId));

      let activeCount = 0;
      let failedCount = 0;
      let totalTemp = 0;
      let totalHumid = 0;
      let totalCpu = 0;

      zoneNodes.forEach(n => {
        if (n.status === 'failed') {
          failedCount++;
        } else {
          activeCount++;
        }

        if (n.telemetry) {
          totalTemp += n.telemetry.temperature || 0;
          totalHumid += n.telemetry.humidity || 0;
        }
        totalCpu += n.cpuUsage || 0;
      });

      const count = zoneNodes.length;
      const zoneHealth = count > 0 ? Math.round(((count - failedCount) / count) * 100) : 100;

      return {
        ...z,
        nodes: zoneNodes.map(n => n.nodeId),
        metrics: {
          nodeCount: count,
          activeNodes: activeCount,
          failedNodes: failedCount,
          healthScore: zoneHealth,
          avgTemperature: count > 0 ? +(totalTemp / count).toFixed(1) : 0,
          avgHumidity: count > 0 ? +(totalHumid / count).toFixed(1) : 0,
          avgCpuUsage: count > 0 ? +(totalCpu / count).toFixed(1) : 0,
        }
      };
    });
  }

  setNodePosition(nodeId, position) {
    const node = topology.getNode(nodeId);
    if (node) {
      topology.updateNodePosition(nodeId, position);
      
      // Check which zone bounds contain this position
      const x = position.x;
      const y = position.y;
      const matchingZone = this.zones.find(z => {
        return x >= z.bounds.x && x <= (z.bounds.x + z.bounds.width) &&
               y >= z.bounds.y && y <= (z.bounds.y + z.bounds.height);
      });

      if (matchingZone) {
        this.nodeMappings[nodeId] = matchingZone.id;
      }

      this.emit('topology:update', topology.getTopologySnapshot());
      this.emit('zones:update', this.getZones());
      return true;
    }
    return false;
  }
}

module.exports = new ZoneService();
