/**
 * HistoryService — Telemetry History & Analytics Engine
 *
 * Stores per-node telemetry in fixed-size ring buffers (1 hour @ 2s ticks = 1800
 * entries), tracks node status transitions for uptime calculation, records
 * failover events, and exposes time-range queries, cross-node comparisons,
 * statistical aggregates, and a full reliability report.
 *
 * All data lives in memory — no database dependency.
 */

const topology = require('./topologyService');

// ── Configuration ────────────────────────────────────────────────────────────

const RING_BUFFER_SIZE     = 1800;   // 1 hour at 2-second intervals
const MAX_STATUS_HISTORY   = 500;    // Status transitions retained per node
const MAX_FAILOVER_LOG     = 200;    // Failover events retained globally

/** Metric keys stored in each telemetry record */
const METRIC_KEYS = [
  'temperature', 'humidity', 'gasLevel',
  'cpuUsage', 'latency', 'packetLoss',
  'networkLoad', 'batteryLevel', 'wifiSignal',
];

/** Map human-readable range strings to milliseconds */
const RANGE_MS = {
  '5m':  5  * 60 * 1000,
  '15m': 15 * 60 * 1000,
  '30m': 30 * 60 * 1000,
  '1h':  60 * 60 * 1000,
};

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Compute the p-th percentile of a sorted array (linear interpolation).
 */
function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = (p / 100) * (sorted.length - 1);
  const lo  = Math.floor(idx);
  const hi  = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ── Service ──────────────────────────────────────────────────────────────────

class HistoryService {
  constructor() {
    this.io = null;

    /**
     * Per-node ring buffer of timestamped telemetry objects.
     * { [nodeId]: { buffer: Array, head: number } }
     */
    this.telemetry = {};

    /**
     * Per-node status transition log.
     * { [nodeId]: [ { status, timestamp } , … ] }
     */
    this.statusHistory = {};

    /**
     * Global failover event log (most recent first).
     */
    this.failoverLog = [];
  }

  // ── Socket.IO plumbing ───────────────────────────────────────────────────

  setIO(io)          { this.io = io; }
  emit(event, data)  { if (this.io) this.io.emit(event, data); }

  // ── Telemetry recording ──────────────────────────────────────────────────

  /**
   * Append a telemetry data point for a given node.
   * Called every tick from mockDataService (or MQTT bridge for live nodes).
   *
   * @param {string} nodeId
   * @param {object} data  Raw telemetry object (should include metric values)
   */
  record(nodeId, data) {
    if (!nodeId || !data) return;

    // Lazily initialise ring buffer for this node
    if (!this.telemetry[nodeId]) {
      this.telemetry[nodeId] = {
        buffer: new Array(RING_BUFFER_SIZE).fill(null),
        head:   0,
        count:  0,
      };
    }

    const store = this.telemetry[nodeId];
    const entry = {
      timestamp: data.timestamp || new Date().toISOString(),
    };

    // Copy over every tracked metric (only if present in data)
    METRIC_KEYS.forEach(key => {
      if (data[key] !== undefined) entry[key] = data[key];
    });

    // Write into ring buffer at current head position
    store.buffer[store.head] = entry;
    store.head = (store.head + 1) % RING_BUFFER_SIZE;
    if (store.count < RING_BUFFER_SIZE) store.count++;

    // Also track status transitions
    this._trackStatus(nodeId);
  }

  // ── Time-range queries ───────────────────────────────────────────────────

  /**
   * Retrieve telemetry history for a single node within a time range.
   *
   * @param {string} nodeId
   * @param {string} range  '5m' | '15m' | '30m' | '1h'
   * @returns {object[]}    Array of timestamped readings, chronological order
   */
  getHistory(nodeId, range = '1h') {
    const store = this.telemetry[nodeId];
    if (!store || store.count === 0) return [];

    const cutoff = Date.now() - (RANGE_MS[range] || RANGE_MS['1h']);
    return this._readBuffer(store)
      .filter(e => new Date(e.timestamp).getTime() >= cutoff);
  }

  /**
   * Compare a specific metric across multiple nodes over a given range.
   *
   * @param {string[]} nodeIds  Array of node IDs to compare
   * @param {string}   metric   Metric key (e.g. 'temperature')
   * @param {string}   range    '5m' | '15m' | '30m' | '1h'
   * @returns {object}          { [nodeId]: [ { timestamp, value } , … ] }
   */
  getCompare(nodeIds, metric, range = '1h') {
    const result = {};
    (nodeIds || []).forEach(id => {
      const history = this.getHistory(id, range);
      result[id] = history.map(entry => ({
        timestamp: entry.timestamp,
        value:     entry[metric] !== undefined ? entry[metric] : null,
      }));
    });
    return result;
  }

  // ── Statistical aggregates ───────────────────────────────────────────────

  /**
   * Compute { min, max, avg, p95, stddev } per metric for a given node & range.
   *
   * @param {string} nodeId
   * @param {string} range  '5m' | '15m' | '30m' | '1h'
   * @returns {object}      { [metric]: { min, max, avg, p95, stddev } }
   */
  getAggregates(nodeId, range = '1h') {
    const history = this.getHistory(nodeId, range);
    const result  = {};

    METRIC_KEYS.forEach(metric => {
      const values = history
        .map(e => e[metric])
        .filter(v => v !== undefined && v !== null);

      if (values.length === 0) {
        result[metric] = { min: 0, max: 0, avg: 0, p95: 0, stddev: 0, samples: 0 };
        return;
      }

      const sorted = [...values].sort((a, b) => a - b);
      const sum    = values.reduce((a, b) => a + b, 0);
      const avg    = sum / values.length;
      const variance = values.reduce((s, v) => s + (v - avg) ** 2, 0) / values.length;

      result[metric] = {
        min:     +sorted[0].toFixed(2),
        max:     +sorted[sorted.length - 1].toFixed(2),
        avg:     +avg.toFixed(2),
        p95:     +percentile(sorted, 95).toFixed(2),
        stddev:  +Math.sqrt(variance).toFixed(2),
        samples: values.length,
      };
    });

    return result;
  }

  // ── Status tracking & uptime ─────────────────────────────────────────────

  /**
   * Record the current status of a node if it differs from the last recorded
   * status (i.e. a transition occurred).  Called internally from record().
   */
  _trackStatus(nodeId) {
    const node = topology.getNode(nodeId);
    if (!node) return;

    if (!this.statusHistory[nodeId]) {
      this.statusHistory[nodeId] = [];
    }

    const log    = this.statusHistory[nodeId];
    const last   = log.length > 0 ? log[log.length - 1].status : null;
    const current = node.status;

    if (current !== last) {
      log.push({
        status:    current,
        timestamp: new Date().toISOString(),
      });
      if (log.length > MAX_STATUS_HISTORY) log.shift();
    }
  }

  /**
   * Calculate the uptime percentage for a node over the retained status
   * history window.  Uptime = fraction of time the node was NOT 'failed'.
   *
   * @param {string} nodeId
   * @returns {number}  0–100 percentage
   */
  getUptimePercentage(nodeId) {
    const log = this.statusHistory[nodeId];
    if (!log || log.length === 0) return 100; // Assume healthy if no history

    let uptimeMs   = 0;
    let downtimeMs = 0;
    const now = Date.now();

    for (let i = 0; i < log.length; i++) {
      const start = new Date(log[i].timestamp).getTime();
      const end   = i < log.length - 1
        ? new Date(log[i + 1].timestamp).getTime()
        : now;
      const duration = end - start;

      if (log[i].status === 'failed') {
        downtimeMs += duration;
      } else {
        uptimeMs += duration;
      }
    }

    const total = uptimeMs + downtimeMs;
    if (total === 0) return 100;
    return +((uptimeMs / total) * 100).toFixed(2);
  }

  // ── Failover event logging ───────────────────────────────────────────────

  /**
   * Record a failover event.  Called by failoverService (or externally).
   *
   * @param {object} failoverData  { failedNode, oldRoute, newRoute, duration, success, reason }
   */
  recordFailover(failoverData) {
    this.failoverLog.unshift({
      ...failoverData,
      timestamp: failoverData.timestamp || new Date().toISOString(),
    });
    if (this.failoverLog.length > MAX_FAILOVER_LOG) {
      this.failoverLog.length = MAX_FAILOVER_LOG;
    }
  }

  // ── Full report compilation ──────────────────────────────────────────────

  /**
   * Generate a comprehensive report suitable for the analytics / report page.
   *
   * Returns:
   * - uptime:            per-node uptime percentages
   * - failoverSummary:   recent failover events + success rate
   * - reliabilityRanking: nodes ranked by uptime desc
   * - anomalyFrequency:  per-node count of status transitions to 'failed' or 'unstable'
   * - aggregates:        per-node statistical summaries for the last hour
   */
  getReportData() {
    const nodes = topology.getAllNodes();

    // Per-node uptime
    const uptime = {};
    nodes.forEach(n => {
      uptime[n.nodeId] = this.getUptimePercentage(n.nodeId);
    });

    // Failover summary
    const totalFailovers     = this.failoverLog.length;
    const successfulFailovers = this.failoverLog.filter(f => f.success).length;
    const failoverSuccessRate = totalFailovers > 0
      ? +((successfulFailovers / totalFailovers) * 100).toFixed(1)
      : 100;

    const failoverSummary = {
      total:       totalFailovers,
      successful:  successfulFailovers,
      failed:      totalFailovers - successfulFailovers,
      successRate: failoverSuccessRate,
      recent:      this.failoverLog.slice(0, 10),
    };

    // Reliability ranking (highest uptime first)
    const reliabilityRanking = nodes
      .map(n => ({
        nodeId: n.nodeId,
        label:  n.label,
        status: n.status,
        uptime: uptime[n.nodeId],
      }))
      .sort((a, b) => b.uptime - a.uptime);

    // Anomaly frequency: how many times each node entered 'failed' or 'unstable'
    const anomalyFrequency = {};
    nodes.forEach(n => {
      const log = this.statusHistory[n.nodeId] || [];
      anomalyFrequency[n.nodeId] = {
        failedCount:   log.filter(e => e.status === 'failed').length,
        unstableCount: log.filter(e => e.status === 'unstable').length,
        totalEvents:   log.length,
      };
    });

    // Per-node aggregates (last hour)
    const aggregates = {};
    nodes.forEach(n => {
      aggregates[n.nodeId] = this.getAggregates(n.nodeId, '1h');
    });

    return {
      generatedAt: new Date().toISOString(),
      uptime,
      failoverSummary,
      reliabilityRanking,
      anomalyFrequency,
      aggregates,
    };
  }

  // ── Internal helpers ─────────────────────────────────────────────────────

  /**
   * Read all non-null entries from a ring buffer in chronological order.
   */
  _readBuffer(store) {
    const results = [];
    const { buffer, head, count } = store;

    if (count === 0) return results;

    // Start reading from the oldest entry
    const start = count < RING_BUFFER_SIZE ? 0 : head;
    for (let i = 0; i < count; i++) {
      const idx = (start + i) % RING_BUFFER_SIZE;
      if (buffer[idx]) results.push(buffer[idx]);
    }

    return results;
  }
}

module.exports = new HistoryService();
