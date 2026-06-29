/**
 * CommandService — Interactive CLI Engine for AegisMesh NOC
 *
 * Implements a command registry that handles network diagnostics, simulation commands,
 * and service diagnostic integrations.
 */

const topology = require('./topologyService');
const failoverService = require('./failoverService');
const mockDataService = require('./mockDataService');

class CommandService {
  constructor() {
    this.commands = {};
    this.registerDefaultCommands();
  }

  register(name, desc, handler) {
    this.commands[name] = { desc, handler };
  }

  getSuggestions(partial) {
    if (!partial) return Object.keys(this.commands);
    return Object.keys(this.commands).filter(cmd => cmd.startsWith(partial.toLowerCase()));
  }

  async execute(commandString) {
    if (!commandString || commandString.trim() === '') {
      return { output: '', type: 'info' };
    }

    const parts = commandString.trim().split(/\s+/);
    const cmdName = parts[0].toLowerCase();
    const args = parts.slice(1);

    const command = this.commands[cmdName];
    if (!command) {
      return {
        output: `command not found: ${cmdName}. Type 'help' to see list of available commands.`,
        type: 'error'
      };
    }

    try {
      return await command.handler(args);
    } catch (error) {
      return {
        output: `Error executing command '${cmdName}': ${error.message}`,
        type: 'error'
      };
    }
  }

  registerDefaultCommands() {
    // 1. HELP
    this.register('help', 'List all commands and their descriptions', () => {
      let out = 'AegisMesh v3 Interactive Shell — Available Commands:\n\n';
      Object.keys(this.commands).sort().forEach(name => {
        const pad = name.padEnd(20, ' ');
        out += `  ${pad} - ${this.commands[name].desc}\n`;
      });
      return { output: out, type: 'info' };
    });

    // 2. CLEAR
    this.register('clear', 'Clear the terminal screen', () => {
      return { output: '__CLEAR__', type: 'system' };
    });

    // 3. WHOAMI
    this.register('whoami', 'Show current system authorization and version details', () => {
      const mode = topology.getOperatingMode();
      let out = '==========================================\n';
      out += '        AEGISMESH COMMAND CONSOLE\n';
      out += '==========================================\n';
      out += `System Status : ACTIVE (NOC Mode)\n`;
      out += `Build Version : v3.0.0-enterprise\n`;
      out += `Engine Mode   : ${mode}\n`;
      out += `Node Count    : 5 Configured\n`;
      out += `User Profile  : NOC Administrator\n`;
      out += '==========================================';
      return { output: out, type: 'success' };
    });

    // 4. UPTIME
    this.register('uptime', 'Show network system uptime', () => {
      const up = topology.getSystemUptime();
      const hrs = Math.floor(up / 3600);
      const mins = Math.floor((up % 3600) / 60);
      const secs = up % 60;
      const formatted = `${hrs}h ${mins}m ${secs}s`;
      return { output: `AegisMesh NOC Uptime: ${formatted} (since boot)`, type: 'success' };
    });

    // 5. PING
    this.register('ping', 'Ping a mesh node: ping <nodeId>', (args) => {
      if (args.length === 0) {
        return { output: 'Usage: ping <nodeId> (e.g. ping ESP32-A)', type: 'warning' };
      }
      const nodeId = args[0].toUpperCase();
      const node = topology.getNode(nodeId);
      if (!node) {
        return { output: `Node ${nodeId} not found in mesh topology registry.`, type: 'error' };
      }

      if (node.status === 'failed') {
        return { output: `PING ${nodeId} (${node.ipAddress}): Packet timed out. Node is OFFLINE.`, type: 'error' };
      }

      const latency = (node.latency || Math.random() * 10 + 2).toFixed(1);
      return {
        output: `PING ${nodeId} (${node.ipAddress}): 64 bytes - time=${latency}ms - status=${node.status.toUpperCase()}`,
        type: 'success'
      };
    });

    // 6. TRACEROUTE
    this.register('traceroute', 'Trace shortest Dijkstra route to a node: traceroute <nodeId>', (args) => {
      if (args.length === 0) {
        return { output: 'Usage: traceroute <nodeId> (e.g. traceroute ESP32-D)', type: 'warning' };
      }
      const targetId = args[0].toUpperCase();
      const node = topology.getNode(targetId);
      if (!node) {
        return { output: `Destination ${targetId} is unregistered.`, type: 'error' };
      }

      const routeResult = topology.getShortestPath('GW-001', targetId);
      if (routeResult.path.length === 0) {
        return { output: `TRACEROUTE to ${targetId}: Connection timed out. Route unreachable.`, type: 'error' };
      }

      const hopString = routeResult.path.join(' ➔ ');
      const hops = routeResult.path.length - 1;
      return {
        output: `Trace route to ${targetId} (${node.ipAddress}):\n  ${hopString}\n  [${hops} hop(s), cumulative cost: ${routeResult.distance}ms]`,
        type: 'success'
      };
    });

    // 7. STATUS
    this.register('status', 'Show status of all nodes or a specific node', (args) => {
      if (args.length > 0 && args[0].toLowerCase() !== 'all') {
        const nodeId = args[0].toUpperCase();
        const node = topology.getNode(nodeId);
        if (!node) return { output: `Node ${nodeId} not found.`, type: 'error' };

        let out = `Node Status details for ${nodeId}:\n`;
        out += `  Label      : ${node.label}\n`;
        out += `  IP Address : ${node.ipAddress}\n`;
        out += `  Status     : ${node.status.toUpperCase()}\n`;
        out += `  Mode       : ${node.mode.toUpperCase()}\n`;
        out += `  CPU Usage  : ${Math.round(node.cpuUsage || 0)}%\n`;
        out += `  WiFi Signal: ${Math.round(node.wifiSignal || 0)} dBm\n`;
        out += `  Uptime     : ${node.uptime || 0}s\n`;
        return { output: out, type: 'info' };
      }

      const nodes = topology.getAllNodes();
      let out = 'Node ID   | IP Address     | Status    | CPU Usage | Uptime     | Health Bar\n';
      out += '----------+----------------+-----------+-----------+------------+------------\n';
      
      nodes.forEach(node => {
        const idCol = node.nodeId.padEnd(9, ' ');
        const ipCol = node.ipAddress.padEnd(14, ' ');
        const statusCol = node.status.toUpperCase().padEnd(9, ' ');
        const cpuCol = `${Math.round(node.cpuUsage || 0)}%`.padEnd(9, ' ');
        const uptimeCol = `${node.uptime || 0}s`.padEnd(10, ' ');
        
        let bar = '';
        if (node.status === 'failed') {
          bar = '░░░░░░░░░░ 0%';
        } else if (node.status === 'unstable') {
          bar = '▓▓▓▓░░░░░░ 40%';
        } else {
          bar = '▓▓▓▓▓▓▓▓▓▓ 100%';
        }

        out += `${idCol} | ${ipCol} | ${statusCol} | ${cpuCol} | ${uptimeCol} | ${bar}\n`;
      });

      return { output: out, type: 'info' };
    });

    // 8. FAIL
    this.register('fail', 'Simulate failure on a node: fail <nodeId>', async (args) => {
      if (args.length === 0) {
        return { output: 'Usage: fail <nodeId>', type: 'warning' };
      }
      const nodeId = args[0].toUpperCase();
      const node = topology.getNode(nodeId);
      if (!node) return { output: `Node ${nodeId} not found.`, type: 'error' };
      if (node.status === 'failed') return { output: `Node ${nodeId} is already offline.`, type: 'warning' };

      await failoverService.triggerFailover(nodeId, 'CLI command injection');
      return { output: `⚠ Command Dispatched: Disconnecting ${nodeId}. Routing recalculating...`, type: 'warning' };
    });

    // 9. HEAL
    this.register('heal', 'Recover a failed node: heal <nodeId>', async (args) => {
      if (args.length === 0) {
        return { output: 'Usage: heal <nodeId>', type: 'warning' };
      }
      const nodeId = args[0].toUpperCase();
      const node = topology.getNode(nodeId);
      if (!node) return { output: `Node ${nodeId} not found.`, type: 'error' };
      if (node.status !== 'failed') return { output: `Node ${nodeId} is already online.`, type: 'warning' };

      await failoverService.recoverNode(nodeId);
      return { output: `✓ Command Dispatched: Re-connecting ${nodeId}. Mesh consensus syncing...`, type: 'success' };
    });

    // 10. ROUTE
    this.register('route', 'Show route between two nodes: route <from> <to>', (args) => {
      if (args.length < 2) {
        return { output: 'Usage: route <from> <to> (e.g. route ESP32-A ESP32-C)', type: 'warning' };
      }
      const from = args[0].toUpperCase();
      const to = args[1].toUpperCase();

      if (!topology.getNode(from)) return { output: `Node ${from} not found.`, type: 'error' };
      if (!topology.getNode(to)) return { output: `Node ${to} not found.`, type: 'error' };

      const routeResult = topology.getShortestPath(from, to);
      if (routeResult.path.length === 0) {
        return { output: `No route exists between ${from} and ${to}.`, type: 'error' };
      }

      return {
        output: `Shortest Path: ${routeResult.path.join(' ➔ ')}\nCost: ${routeResult.distance}ms`,
        type: 'success'
      };
    });

    // 11. NETSTAT
    this.register('netstat', 'Show network statistics', () => {
      const snapshot = topology.getTopologySnapshot();
      const activeCount = snapshot.nodes.filter(n => n.status !== 'failed').length;
      let out = '==========================================\n';
      out += '         MESH NETWORK STATS (NOC)\n';
      out += '==========================================\n';
      out += `Total Active Nodes   : ${activeCount} / ${snapshot.nodes.length}\n`;
      out += `Active Path Count    : ${snapshot.activeRoutes}\n`;
      out += `Network Health Index : ${snapshot.healthPercentage}%\n`;
      out += `Average Network Lat  : ${snapshot.avgLatency} ms\n`;
      out += `Total Packets Routed : ${snapshot.totalPackets}\n`;
      out += `MQTT Status          : ONLINE\n`;
      out += `Threat/Intrusion Idx : LOW (0/100)\n`;
      out += '==========================================';
      return { output: out, type: 'info' };
    });

    // 12. TOPOLOGY
    this.register('topology', 'Draw ASCII topology representation of the network', () => {
      const snap = topology.getTopologySnapshot();
      let out = '      [Node Alpha (A)] ═══════ [Node Beta (B)]\n';
      out += '            ║      \\             /     ║\n';
      out += '            ║       \\           /      ║\n';
      out += '            ║        [Gateway]         ║\n';
      out += '            ║       /           \\      ║\n';
      out += '            ║      /             \\     ║\n';
      out += '      [Node Delta (D)] ═══════ [Node Gamma (C)]\n\n';
      out += 'Current Active Links:\n';
      
      snap.edges.forEach(e => {
        if (e.active) {
          out += `  Link ${e.from} ➔ ${e.to} : ACTIVE (${e.weight}ms)\n`;
        } else {
          out += `  Link ${e.from} ➔ ${e.to} : DOWN (OFFLINE)\n`;
        }
      });
      return { output: out, type: 'info' };
    });

    // 13. PREDICT
    this.register('predict', 'Show risk warning prediction data: predict [<nodeId>]', (args) => {
      let predictionService;
      try {
        predictionService = require('./predictionService');
      } catch (err) {
        return { output: 'Prediction Service is currently unavailable.', type: 'error' };
      }

      if (args.length > 0) {
        const nodeId = args[0].toUpperCase();
        const pred = predictionService.getNodePrediction(nodeId);
        let out = `Risk Analysis for ${nodeId}:\n`;
        out += `  Risk Score      : ${pred.riskScore}/100\n`;
        out += `  Trend Direction : ${pred.trendDirection.toUpperCase()}\n`;
        out += `  Failure Outlook : ${pred.predictedFailureTime ? `TTF estimated at ${new Date(pred.predictedFailureTime).toLocaleTimeString()}` : 'STABLE'}\n`;
        out += `  Active Anomalies: ${pred.anomalies.length}\n`;
        if (pred.anomalies.length > 0) {
          pred.anomalies.forEach(a => {
            out += `    * Anomaly detected on ${a.metric}: raw=${a.value} (threshold=${a.threshold}, z-score=${a.zScore})\n`;
          });
        }
        return { output: out, type: pred.riskScore > 50 ? 'warning' : 'success' };
      }

      const report = predictionService.getAnomalyReport();
      let out = 'Node ID   | Risk Score | Trend      | TTF Forecast     | Active Anomalies\n';
      out += '----------+------------+------------+------------------+-----------------\n';
      report.forEach(p => {
        const idCol = p.nodeId.padEnd(9, ' ');
        const riskCol = `${p.riskScore}/100`.padEnd(10, ' ');
        const trendCol = p.trendDirection.padEnd(10, ' ');
        const ttfCol = (p.predictedFailureTime ? new Date(p.predictedFailureTime).toLocaleTimeString() : 'STABLE').padEnd(16, ' ');
        const anomalyCol = `${p.anomalies.length}`.padEnd(15, ' ');
        out += `${idCol} | ${riskCol} | ${trendCol} | ${ttfCol} | ${anomalyCol}\n`;
      });

      return { output: out, type: 'info' };
    });

    // 14. NODES
    this.register('nodes', 'List all nodes registered in the mesh network', () => {
      const nodes = topology.getAllNodes();
      let out = 'Node ID   | Label            | IP Address     | Status    | Operating Mode\n';
      out += '----------+------------------+----------------+-----------+----------------\n';
      nodes.forEach(n => {
        const id = n.nodeId.padEnd(9, ' ');
        const label = n.label.padEnd(16, ' ');
        const ip = n.ipAddress.padEnd(14, ' ');
        const status = n.status.toUpperCase().padEnd(9, ' ');
        const mode = n.mode.toUpperCase();
        out += `${id} | ${label} | ${ip} | ${status} | ${mode}\n`;
      });
      return { output: out, type: 'info' };
    });

    // 15. EXPORT
    this.register('export', 'Export current network configuration as JSON', () => {
      const snapshot = topology.getTopologySnapshot();
      return { output: JSON.stringify(snapshot, null, 2), type: 'success' };
    });

    // 16. OTA
    this.register('ota', 'Orchestrate OTA updates: ota <nodeId> <version>', async (args) => {
      let otaService;
      try {
        otaService = require('./otaService');
      } catch (err) {
        return { output: 'OTA Firmware Service is currently unavailable.', type: 'error' };
      }

      if (args.length < 2) {
        return { output: 'Usage: ota <nodeId> <version> (e.g. ota ESP32-A v2.1)', type: 'warning' };
      }

      const nodeId = args[0].toUpperCase();
      const version = args[1];

      const success = otaService.startUpdate(nodeId, version);
      if (!success) {
        return { output: `Could not initiate OTA update for ${nodeId} to version ${version}. Check node state.`, type: 'error' };
      }

      return { output: `Pushing firmware version ${version} to ${nodeId} via OTA. Initiating staged update...`, type: 'success' };
    });

    // 17. POWER
    this.register('power', 'Diagnostics for battery/solar power: power <nodeId> [mode]', (args) => {
      let powerService;
      try {
        powerService = require('./powerService');
      } catch (err) {
        return { output: 'Power Management Service is currently unavailable.', type: 'error' };
      }

      if (args.length === 0) {
        return { output: 'Usage: power <nodeId> [mode] (e.g. power ESP32-B ECO)', type: 'warning' };
      }

      const nodeId = args[0].toUpperCase();
      const node = topology.getNode(nodeId);
      if (!node) return { output: `Node ${nodeId} not found.`, type: 'error' };

      if (args.length > 1) {
        const mode = args[1].toUpperCase();
        const success = powerService.setMode(nodeId, mode);
        if (!success) {
          return { output: `Invalid mode. Choose NORMAL, ECO, or SLEEP.`, type: 'error' };
        }
        return { output: `✓ Success: Node ${nodeId} operating mode set to ${mode}`, type: 'success' };
      }

      const data = powerService.getNodePower(nodeId);
      if (!data) return { output: `No energy details available for node ${nodeId}`, type: 'error' };

      let out = `Power profile details for ${nodeId}:\n`;
      out += `  Battery Level : ${data.battery.toFixed(1)}%\n`;
      out += `  Power Mode    : ${data.mode}\n`;
      out += `  Solar Charging: ${data.solarActive ? 'ACTIVE (RECHARGING)' : 'INACTIVE'}\n`;
      out += `  Current Drain : ${data.drainRate.toFixed(4)}% per tick\n`;
      out += `  Time Remaining: ${data.estimatedTimeRemaining}\n`;
      return { output: out, type: 'info' };
    });
  }
}

module.exports = new CommandService();
