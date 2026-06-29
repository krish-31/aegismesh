/**
 * TopologyService v3 — Enhanced with live/simulation mode, node metadata,
 * addLiveNode support, edge latency labels, and operating mode detection
 */

class TopologyService {
  constructor() {
    this.meshes = {
      'mesh-hq': { graph: {}, nodes: {}, routes: {}, activeEdges: new Set() },
      'mesh-warehouse': { graph: {}, nodes: {}, routes: {}, activeEdges: new Set() }
    };
    this.activeMeshId = 'mesh-hq';
    this.packetCounters = {}; // per-node rolling packet counters
    this.systemStartTime = Date.now();
    this.routingPolicy = 'latency';
    this.edgeMetadata = {};
    this.obstacles = [
      { id: 'obs-wall-1', name: 'Concrete Partition', type: 'wall', x1: 300, y1: 50, x2: 300, y2: 250, attenuation: -18 },
      { id: 'obs-metal-1', name: 'Server Rack Shielding', type: 'metal', x1: 500, y1: 200, x2: 500, y2: 400, attenuation: -30 }
    ];
    this.initializeDefaultTopology();
  }

  get graph() { return this.meshes[this.activeMeshId].graph; }
  set graph(v) { this.meshes[this.activeMeshId].graph = v; }

  get nodes() { return this.meshes[this.activeMeshId].nodes; }
  set nodes(v) { this.meshes[this.activeMeshId].nodes = v; }

  get routes() { return this.meshes[this.activeMeshId].routes; }
  set routes(v) { this.meshes[this.activeMeshId].routes = v; }

  get activeEdges() { return this.meshes[this.activeMeshId].activeEdges; }
  set activeEdges(v) { this.meshes[this.activeMeshId].activeEdges = v; }

  switchMesh(meshId) {
    if (this.meshes[meshId]) {
      this.activeMeshId = meshId;
      
      // Reset lastHeartbeat for all nodes in the target mesh so they don't immediately time out
      const now = new Date();
      Object.values(this.meshes[meshId].nodes).forEach(node => {
        if (node) {
          node.lastHeartbeat = now;
        }
      });
      
      this.recalculateAllRoutes();
      return true;
    }
    return false;
  }

  getGatewayId() {
    const gw = Object.values(this.nodes).find(n => n.isGateway);
    return gw ? gw.nodeId : 'GW-001';
  }

  initializeDefaultTopology() {
    // 1. Build Building A HQ topology
    this.activeMeshId = 'mesh-hq';
    this._buildMeshTopology([
      { nodeId: 'GW-001',  label: 'Gateway',    ipAddress: '192.168.1.1',   status: 'gateway', isGateway: true,  nodeType: 'gateway', position: { x: 400, y: 280 } },
      { nodeId: 'ESP32-A', label: 'Node Alpha',  ipAddress: '192.168.1.101', status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 180, y: 120 } },
      { nodeId: 'ESP32-B', label: 'Node Beta',   ipAddress: '192.168.1.102', status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 620, y: 120 } },
      { nodeId: 'ESP32-C', label: 'Node Gamma',  ipAddress: '192.168.1.103', status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 620, y: 440 } },
      { nodeId: 'ESP32-D', label: 'Node Delta',  ipAddress: '192.168.1.104', status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 180, y: 440 } },
    ], [
      { from: 'GW-001',  to: 'ESP32-A', latency: 5  },
      { from: 'GW-001',  to: 'ESP32-B', latency: 8  },
      { from: 'GW-001',  to: 'ESP32-C', latency: 12 },
      { from: 'ESP32-A', to: 'ESP32-B', latency: 15 },
      { from: 'ESP32-A', to: 'ESP32-D', latency: 20 },
      { from: 'ESP32-B', to: 'ESP32-C', latency: 18 },
      { from: 'ESP32-C', to: 'ESP32-D', latency: 10 },
    ]);

    // 2. Build Building B Warehouse topology
    this.activeMeshId = 'mesh-warehouse';
    this._buildMeshTopology([
      { nodeId: 'GW-002',  label: 'Gateway 2',  ipAddress: '10.0.0.1',      status: 'gateway', isGateway: true,  nodeType: 'gateway', position: { x: 400, y: 280 } },
      { nodeId: 'ESP32-E', label: 'Node Echo',   ipAddress: '10.0.0.101',    status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 180, y: 120 } },
      { nodeId: 'ESP32-F', label: 'Node Foxtrot',ipAddress: '10.0.0.102',    status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 620, y: 120 } },
      { nodeId: 'ESP32-G', label: 'Node Golf',   ipAddress: '10.0.0.103',    status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 620, y: 440 } },
      { nodeId: 'ESP32-H', label: 'Node Hotel',  ipAddress: '10.0.0.104',    status: 'healthy', isGateway: false, nodeType: 'esp32',   position: { x: 180, y: 440 } },
    ], [
      { from: 'GW-002',  to: 'ESP32-E', latency: 6  },
      { from: 'GW-002',  to: 'ESP32-F', latency: 9  },
      { from: 'GW-002',  to: 'ESP32-G', latency: 14 },
      { from: 'ESP32-E', to: 'ESP32-F', latency: 12 },
      { from: 'ESP32-E', to: 'ESP32-H', latency: 22 },
      { from: 'ESP32-F', to: 'ESP32-G', latency: 16 },
      { from: 'ESP32-G', to: 'ESP32-H', latency: 11 },
    ]);

    // Default back to hq
    this.activeMeshId = 'mesh-hq';
    this.recalculateRSSIAndLinks();
  }

  _buildMeshTopology(defaultNodes, defaultEdges) {
    defaultNodes.forEach(node => {
      this.nodes[node.nodeId] = {
        ...node,
        mode:            'simulation',
        isReal:          false,
        mqttConnected:   false,
        firmwareVersion: 'sim-1.0',
        cpuUsage:        Math.random() * 25 + 10,
        uptime:          Math.floor(Math.random() * 86400),
        uptimeStart:     Date.now(),
        wifiSignal:      -(Math.random() * 30 + 45),
        packetCount:     Math.floor(Math.random() * 5000 + 1000),
        packetLoss:      0,
        latency:         Math.random() * 15 + 3,
        lastHeartbeat:   new Date(),
        anomalyScore:    0,
        activeRoute:     [],
        threatLevel:     0,
        mqttReconnects:  0,
        heartbeatDrift:  0,
        telemetry: {
          temperature:    Math.random() * 10 + 25,
          humidity:       Math.random() * 20 + 45,
          gasLevel:       Math.random() * 10 + 2,
          motionDetected: false,
          powerStatus:    'normal',
          networkLoad:    Math.random() * 30 + 20,
          batteryLevel:   Math.random() * 20 + 80,
        }
      };
      this.graph[node.nodeId] = {};
      this.packetCounters[node.nodeId] = 0;
    });

    defaultEdges.forEach(edge => {
      this.graph[edge.from][edge.to] = edge.latency;
      this.graph[edge.to][edge.from] = edge.latency;
      const key = [edge.from, edge.to].sort().join('--');
      this.activeEdges.add(key);
    });

    this.recalculateAllRoutes();
  }

  // ── Add live ESP32 node ────────────────────────────────────────────────
  addLiveNode({ nodeId, label, ipAddress, nodeType, mode, firmwareVersion, status }) {
    if (this.nodes[nodeId]) {
      // Already exists — update to live mode
      this.nodes[nodeId].mode = mode || 'live';
      this.nodes[nodeId].isReal = true;
      this.nodes[nodeId].mqttConnected = true;
      this.nodes[nodeId].firmwareVersion = firmwareVersion || this.nodes[nodeId].firmwareVersion;
      this.nodes[nodeId].ipAddress = ipAddress || this.nodes[nodeId].ipAddress;
      return;
    }

    // New node — add to graph with reasonable defaults
    this.nodes[nodeId] = {
      nodeId,
      label:           label || nodeId,
      ipAddress:       ipAddress || '0.0.0.0',
      status:          status || 'healthy',
      isGateway:       nodeType === 'gateway',
      nodeType:        nodeType || 'esp32',
      mode:            mode || 'live',
      isReal:          true,
      mqttConnected:   true,
      firmwareVersion: firmwareVersion || 'unknown',
      position:        (() => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 80;
        return { x: 400 + Math.cos(angle) * radius, y: 280 + Math.sin(angle) * radius };
      })(),
      cpuUsage:        0,
      uptime:          0,
      uptimeStart:     Date.now(),
      wifiSignal:      -60,
      packetCount:     0,
      packetLoss:      0,
      latency:         10,
      lastHeartbeat:   new Date(),
      anomalyScore:    0,
      activeRoute:     [],
      threatLevel:     0,
      mqttReconnects:  0,
      heartbeatDrift:  0,
      telemetry: {
        temperature: 25, humidity: 50, gasLevel: 0,
        motionDetected: false, powerStatus: 'normal',
        networkLoad: 20, batteryLevel: 100,
      }
    };
    this.graph[nodeId] = {};
    this.packetCounters[nodeId] = 0;

    // Connect to gateway by default
    const gwId = this.getGatewayId();
    if (this.graph[gwId]) {
      const lat = Math.floor(Math.random() * 15) + 5;
      this.graph[nodeId][gwId] = lat;
      this.graph[gwId][nodeId] = lat;
      const key = [nodeId, gwId].sort().join('--');
      this.activeEdges.add(key);
    }

    this.recalculateAllRoutes();
  }

  // ── Operating mode ─────────────────────────────────────────────────────
  getOperatingMode() {
    const allNodes  = Object.values(this.nodes);
    const liveNodes = allNodes.filter(n => n.mode === 'live');
    const simNodes  = allNodes.filter(n => n.mode !== 'live' && !n.isGateway);

    if (liveNodes.length === 0)  return 'SIMULATION';
    if (simNodes.length === 0)   return 'LIVE';
    return 'HYBRID';
  }

  getSystemUptime() {
    return Math.floor((Date.now() - this.systemStartTime) / 1000);
  }

  setRoutingPolicy(policy) {
    const valid = ['latency', 'energy', 'reliability', 'hybrid'];
    if (valid.includes(policy)) {
      this.routingPolicy = policy;
      this.recalculateAllRoutes();
      return true;
    }
    return false;
  }

  getLinkCost(from, to, baseLatency) {
    const toNode = this.nodes[to];
    if (!toNode) return baseLatency;

    let cost = baseLatency;
    const policy = this.routingPolicy || 'latency';

    if (policy === 'energy') {
      const battery = toNode.telemetry?.batteryLevel !== undefined ? toNode.telemetry.batteryLevel : 100;
      cost = baseLatency * (1 + (100 - battery) / 20);
      if (battery < 20) {
        cost += 200; // severe penalty
      }
    } else if (policy === 'reliability') {
      const loss = toNode.packetLoss || 0;
      cost = baseLatency * (1 + loss * 5);
    } else if (policy === 'hybrid') {
      const battery = toNode.telemetry?.batteryLevel !== undefined ? toNode.telemetry.batteryLevel : 100;
      const loss = toNode.packetLoss || 0;
      const cpu = toNode.cpuUsage || 0;
      cost = baseLatency * (1 + (100 - battery) / 40) * (1 + loss * 2) * (1 + cpu / 100);
    }

    return cost;
  }

  // ── Dijkstra ──────────────────────────────────────────────────────────

  dijkstra(startNode, endNode) {
    const distances = {};
    const previous  = {};
    const unvisited = new Set();

    Object.keys(this.graph).forEach(n => {
      distances[n] = n === startNode ? 0 : Infinity;
      previous[n]  = null;
      unvisited.add(n);
    });

    while (unvisited.size > 0) {
      let current = null, minDist = Infinity;
      unvisited.forEach(n => {
        if (distances[n] < minDist && this.nodes[n]?.status !== 'failed' && this.nodes[n]?.status !== 'quarantined') {
          minDist = distances[n];
          current = n;
        }
      });

      if (!current || current === endNode) break;
      unvisited.delete(current);

      Object.entries(this.graph[current] || {}).forEach(([neighbor, weight]) => {
        if (unvisited.has(neighbor) && this.nodes[neighbor]?.status !== 'failed' && this.nodes[neighbor]?.status !== 'quarantined') {
          const edgeKey = [current, neighbor].sort().join('--');
          if (!this.activeEdges.has(edgeKey)) return; // edge is down
          const cost = this.getLinkCost(current, neighbor, weight);
          const alt = distances[current] + cost;
          if (alt < distances[neighbor]) {
            distances[neighbor] = alt;
            previous[neighbor]  = current;
          }
        }
      });
    }

    const path = [];
    let cur = endNode;
    while (cur) { path.unshift(cur); cur = previous[cur]; }

    return {
      path:     path[0] === startNode ? path : [],
      distance: distances[endNode] === Infinity ? null : distances[endNode]
    };
  }

  recalculateAllRoutes() {
    const ids = Object.keys(this.nodes);
    ids.forEach(from => {
      ids.forEach(to => {
        if (from !== to) this.routes[`${from}->${to}`] = this.dijkstra(from, to);
      });
    });

    // Update each node's activeRoute to gateway
    const gwId = this.getGatewayId();
    ids.forEach(id => {
      if (id !== gwId && this.nodes[id]) {
        const r = this.routes[`${gwId}->${id}`] || { path: [] };
        this.nodes[id].activeRoute = r.path;
      }
    });
  }

  getShortestPath(from, to) {
    return this.routes[`${from}->${to}`] || this.dijkstra(from, to);
  }

  // ── Node / Edge management ────────────────────────────────────────────

  updateNodeStatus(nodeId, status) {
    if (!this.nodes[nodeId]) return;
    this.nodes[nodeId].status = status;

    if (status !== 'failed' && status !== 'quarantined') {
      this.nodes[nodeId].lastHeartbeat = new Date();
      // Re-enable edges connected to this node
      Object.keys(this.graph[nodeId] || {}).forEach(neighbor => {
        const key = [nodeId, neighbor].sort().join('--');
        this.activeEdges.add(key);
      });
    } else {
      // Disable all edges connected to failed/quarantined node
      Object.keys(this.graph[nodeId] || {}).forEach(neighbor => {
        const key = [nodeId, neighbor].sort().join('--');
        this.activeEdges.delete(key);
      });
    }
    this.recalculateAllRoutes();
  }

  updateNodeMetrics(nodeId, metrics) {
    if (this.nodes[nodeId]) Object.assign(this.nodes[nodeId], metrics);
  }

  updateEdgeLatency(from, to, latency) {
    if (this.graph[from]?.[to] !== undefined) {
      this.graph[from][to] = latency;
      this.graph[to][from] = latency;
      this.recalculateAllRoutes();
    }
  }

  // Simulate heartbeat tick (called periodically by mockDataService or MQTT)
  tickHeartbeat(nodeId) {
    if (this.nodes[nodeId] && this.nodes[nodeId].status !== 'failed') {
      const now = Date.now();
      const prevHB = this.nodes[nodeId].lastHeartbeat ? new Date(this.nodes[nodeId].lastHeartbeat).getTime() : now;
      this.nodes[nodeId].heartbeatDrift = now - prevHB;
      this.nodes[nodeId].lastHeartbeat = new Date();
      this.nodes[nodeId].uptime = Math.floor((now - (this.nodes[nodeId].uptimeStart || now)) / 1000);
      this.packetCounters[nodeId] = (this.packetCounters[nodeId] || 0) + Math.floor(Math.random() * 60 + 10);
      this.nodes[nodeId].packetCount = this.packetCounters[nodeId];
    }
  }

  // ── Snapshot ──────────────────────────────────────────────────────────

  getTopologySnapshot() {
    const nodes = Object.values(this.nodes).map(n => ({
      ...n,
      neighbors: Object.keys(this.graph[n.nodeId] || {}).filter(nb => {
        const key = [n.nodeId, nb].sort().join('--');
        return this.activeEdges.has(key);
      })
    }));

    const edges = [];
    const seen  = new Set();
    Object.entries(this.graph).forEach(([from, neighbors]) => {
      Object.entries(neighbors).forEach(([to, weight]) => {
        const key = [from, to].sort().join('--');
        if (!seen.has(key)) {
          seen.add(key);
          const edgeId = `${from}-${to}`;
          const active = this.activeEdges.has(key);
          edges.push({ from, to, weight, id: edgeId, active, latencyLabel: `${weight}ms` });
        }
      });
    });

    const healthyCount     = nodes.filter(n => n.status === 'healthy' || n.status === 'gateway').length;
    const failedCount      = nodes.filter(n => n.status === 'failed').length;
    const activeRoutes     = Object.values(this.routes).filter(r => r.path.length > 0).length;
    const avgLatency       = nodes.reduce((s, n) => s + (n.latency || 10), 0) / nodes.length;
    const totalPackets     = nodes.reduce((s, n) => s + (n.packetCount || 0), 0);
    const operatingMode    = this.getOperatingMode();
    const systemUptime     = this.getSystemUptime();

    // Device counts
    const liveCount    = nodes.filter(n => n.mode === 'live' || n.isReal).length;
    const simCount     = nodes.filter(n => n.mode === 'simulation' && !n.isReal).length;
    const offlineCount = failedCount;
    const gatewayCount = nodes.filter(n => n.isGateway).length;

    // Improved health calculation: weighted multi-factor
    const nodeHealth     = nodes.length > 0 ? (healthyCount / nodes.length) * 100 : 100;
    const latencyPenalty = Math.min(20, avgLatency > 100 ? 20 : avgLatency > 50 ? 10 : avgLatency > 25 ? 5 : 0);
    const lossPenalty    = Math.min(15, nodes.reduce((s, n) => s + (n.packetLoss || 0), 0) / Math.max(1, nodes.length));
    const maxAnomaly     = Math.max(...nodes.map(n => n.anomalyScore || 0), 0);
    const threatPenalty  = Math.min(15, maxAnomaly > 60 ? 15 : maxAnomaly > 30 ? 8 : 0);
    const routePenalty   = activeRoutes < 4 ? 10 : 0;
    const healthPercentage = Math.max(0, Math.min(100, Math.round(
      nodeHealth - latencyPenalty - lossPenalty - threatPenalty - routePenalty
    )));

    return {
      nodes, edges, healthPercentage, activeRoutes,
      avgLatency: +avgLatency.toFixed(1), totalPackets,
      operatingMode, systemUptime,
      liveCount, simCount, offlineCount, gatewayCount,
      activeMeshId: this.activeMeshId,
      routingPolicy: this.routingPolicy,
      obstacles: this.obstacles
    };
  }

  getNode(nodeId)  { return this.nodes[nodeId] || null; }
  getAllNodes()     { return Object.values(this.nodes); }
  getActiveEdges() { return [...this.activeEdges]; }

  updateNodePosition(nodeId, position) {
    if (this.nodes[nodeId]) {
      this.nodes[nodeId].position = position;
      this.recalculateRSSIAndLinks();
      return true;
    }
    return false;
  }

  recalculateRSSIAndLinks() {
    const ids = Object.keys(this.nodes);
    ids.forEach(from => {
      ids.forEach(to => {
        if (from === to) return;
        if (this.graph[from]?.[to] === undefined) return;
        
        const nodeA = this.nodes[from];
        const nodeB = this.nodes[to];
        if (!nodeA || !nodeB) return;
        
        const dx = nodeA.position.x - nodeB.position.x;
        const dy = nodeA.position.y - nodeB.position.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        
        // Scale distance to simulate real-world meters
        const meters = dist * 0.15;
        
        // Free Space Path Loss model approximation
        let rssi = -30 - 20 * Math.log10(Math.max(1, meters));
        
        // Attenuate based on obstacle intersection
        let totalAttenuation = 0;
        this.obstacles.forEach(obs => {
          const intersects = this.checkLineIntersection(
            nodeA.position, nodeB.position,
            { x: obs.x1, y: obs.y1 }, { x: obs.x2, y: obs.y2 }
          );
          if (intersects) {
            totalAttenuation += obs.attenuation;
          }
        });
        
        rssi += totalAttenuation;
        
        const key = [from, to].sort().join('--');
        
        // Update WIFI signals and active status
        if (rssi < -85) {
          this.activeEdges.delete(key);
        } else if (nodeA.status !== 'failed' && nodeB.status !== 'failed' && nodeA.status !== 'quarantined' && nodeB.status !== 'quarantined') {
          this.activeEdges.add(key);
        }
        
        if (!this.edgeMetadata) this.edgeMetadata = {};
        this.edgeMetadata[key] = { rssi: Math.round(rssi), attenuated: totalAttenuation < 0 };
        
        // Set dynamic WIFI signal telemetry
        const gwId = this.getGatewayId();
        if (to === gwId || from === gwId) {
          const leafNode = from === gwId ? nodeB : nodeA;
          leafNode.wifiSignal = Math.round(rssi);
        }
      });
    });
    
    this.recalculateAllRoutes();
  }

  computeMST() {
    const nodes = Object.keys(this.nodes).filter(n => this.nodes[n].status !== 'failed' && this.nodes[n].status !== 'quarantined');
    if (nodes.length === 0) return [];

    const startNode = nodes.find(n => this.nodes[n].isGateway) || nodes[0];
    const visited = new Set([startNode]);
    const mstEdges = [];

    while (visited.size < nodes.length) {
      let minEdge = null;
      let minCost = Infinity;

      visited.forEach(u => {
        const neighbors = this.graph[u] || {};
        Object.entries(neighbors).forEach(([v, weight]) => {
          if (!visited.has(v) && nodes.includes(v)) {
            const edgeKey = [u, v].sort().join('--');
            if (this.activeEdges.has(edgeKey)) {
              const cost = this.getLinkCost(u, v, weight);
              if (cost < minCost) {
                minCost = cost;
                minEdge = { from: u, to: v, cost };
              }
            }
          }
        });
      });

      if (!minEdge) break;

      visited.add(minEdge.to);
      mstEdges.push(minEdge);
    }

    return mstEdges;
  }

  checkLineIntersection(p1, p2, q1, q2) {
    const det = (p2.x - p1.x) * (q2.y - q1.y) - (q2.x - q1.x) * (p2.y - p1.y);
    if (det === 0) return false;
    const lambda = ((q2.y - q1.y) * (q2.x - p1.x) + (q1.x - q2.x) * (q2.y - p1.y)) / det;
    const gamma = ((p1.y - p2.y) * (q2.x - p1.x) + (p2.x - p1.x) * (q2.y - p1.y)) / det;
    return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
  }
}

module.exports = new TopologyService();
