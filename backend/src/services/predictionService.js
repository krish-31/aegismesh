/**
 * PredictionService — Predictive Anomaly Detection Engine
 *
 * Maintains rolling buffers of raw readings per node per metric,
 * computes EWMA trend lines, Z-score anomalies, and linear-regression
 * time-to-failure predictions.  Broadcasts Socket.IO events every 5 ticks
 * and emits high-risk warnings in real time.
 *
 * Metrics tracked: temperature, humidity, gasLevel, cpuUsage, latency, packetLoss
 */

const topology = require('./topologyService');
const notificationService = require('./notificationService');

// ── Configuration ────────────────────────────────────────────────────────────

const BUFFER_SIZE   = 30;     // Rolling window of readings per metric
const EWMA_ALPHA    = 0.3;    // Exponential weight — higher = more reactive
const Z_THRESHOLD   = 2.0;    // Standard-deviation threshold for anomaly flag
const HIGH_RISK     = 70;     // Risk score above which we emit a warning
const EMIT_INTERVAL = 5;      // Broadcast predictions every N ticks

/** Metric danger thresholds — crossing these means imminent failure */
const DANGER_THRESHOLDS = {
  temperature: 50,
  humidity:    90,
  gasLevel:    40,
  cpuUsage:    90,
  latency:     200,
  packetLoss:  25,
};

/** All metric names we track */
const METRIC_NAMES = Object.keys(DANGER_THRESHOLDS);

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Simple linear regression on an array of y-values (x = 0,1,2,…).
 * Returns { slope, intercept }.
 */
function linearRegression(values) {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] || 0 };

  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX  += i;
    sumY  += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return { slope: 0, intercept: sumY / n };

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;
  return { slope, intercept };
}

/**
 * Compute mean and standard deviation for an array.
 */
function meanStd(arr) {
  if (arr.length === 0) return { mean: 0, std: 0 };
  const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
  const variance = arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
  return { mean, std: Math.sqrt(variance) };
}

// ── Service ──────────────────────────────────────────────────────────────────

class PredictionService {
  constructor() {
    this.io        = null;
    this.tickCount = 0;

    /**
     * Per-node, per-metric rolling buffers & EWMA state.
     * Structure: { [nodeId]: { [metric]: { buffer: number[], ewma: number } } }
     */
    this.state = {};

    /**
     * Cache of the most recent per-node prediction result so getTopRisk()
     * and REST endpoints can read it without re-computing.
     */
    this.predictionCache = {};
  }

  // ── Socket.IO plumbing (matches project pattern) ─────────────────────────

  setIO(io)          { this.io = io; }
  emit(event, data)  { if (this.io) this.io.emit(event, data); }

  // ── Core ingestion — called from mockDataService every tick ───────────────

  /**
   * Ingest a batch of metric values for a single node.
   *
   * @param {string} nodeId   e.g. 'ESP32-A'
   * @param {object} metrics  { temperature, humidity, gasLevel, cpuUsage, latency, packetLoss }
   */
  ingest(nodeId, metrics) {
    if (!nodeId || !metrics) return;

    // Lazily initialise per-node state
    if (!this.state[nodeId]) {
      this.state[nodeId] = {};
      METRIC_NAMES.forEach(m => {
        this.state[nodeId][m] = { buffer: [], ewma: null };
      });
    }

    const nodeState = this.state[nodeId];

    // Push each metric value into its rolling buffer & update EWMA
    METRIC_NAMES.forEach(metric => {
      const raw = metrics[metric];
      if (raw === undefined || raw === null) return;

      const s = nodeState[metric];

      // Rolling buffer — oldest values drop off the front
      s.buffer.push(raw);
      if (s.buffer.length > BUFFER_SIZE) s.buffer.shift();

      // EWMA update
      if (s.ewma === null) {
        s.ewma = raw;   // Seed with first observation
      } else {
        s.ewma = EWMA_ALPHA * raw + (1 - EWMA_ALPHA) * s.ewma;
      }
    });

    // Recompute this node's prediction & cache it
    this.predictionCache[nodeId] = this._computePrediction(nodeId);

    // Increment tick counter & broadcast periodically
    this.tickCount++;
    if (this.tickCount % EMIT_INTERVAL === 0) {
      this._broadcastPredictions();
    }

    // Immediate warning if node crosses high-risk threshold
    const pred = this.predictionCache[nodeId];
    if (pred && pred.riskScore > HIGH_RISK) {
      this.emit('prediction:warning', {
        nodeId,
        riskScore:           pred.riskScore,
        anomalies:           pred.anomalies,
        predictedFailureTime: pred.predictedFailureTime,
        timestamp:           new Date().toISOString(),
      });
      notificationService.sendPredictiveAlert(nodeId, pred.riskScore, pred.predictedFailureTime);
    }
  }

  // ── Public query methods ─────────────────────────────────────────────────

  /**
   * Get the full prediction payload for a single node.
   *
   * @returns {{ riskScore, predictedFailureTime, anomalies, trendDirection, metrics }}
   */
  getNodePrediction(nodeId) {
    if (this.predictionCache[nodeId]) return this.predictionCache[nodeId];
    if (!this.state[nodeId]) return this._emptyPrediction(nodeId);
    return this._computePrediction(nodeId);
  }

  /**
   * All nodes ranked by descending risk score with full details.
   */
  getAnomalyReport() {
    const nodes = topology.getAllNodes();
    const report = nodes.map(n => {
      const pred = this.getNodePrediction(n.nodeId);
      return {
        nodeId:              n.nodeId,
        label:               n.label,
        status:              n.status,
        riskScore:           pred.riskScore,
        predictedFailureTime: pred.predictedFailureTime,
        anomalies:           pred.anomalies,
        trendDirection:      pred.trendDirection,
        metrics:             pred.metrics,
      };
    });

    // Sort highest risk first
    report.sort((a, b) => b.riskScore - a.riskScore);
    return report;
  }

  /**
   * Return the single highest-risk node (for the dashboard summary card).
   */
  getTopRisk() {
    const report = this.getAnomalyReport();
    return report.length > 0 ? report[0] : null;
  }

  // ── Internal prediction computation ──────────────────────────────────────

  /**
   * Compute a full prediction object for a given node based on its
   * current rolling buffers.
   */
  _computePrediction(nodeId) {
    const nodeState = this.state[nodeId];
    if (!nodeState) return this._emptyPrediction(nodeId);

    const anomalies      = [];
    const metricDetails  = {};
    let   totalRisk      = 0;
    let   metricsCounted = 0;
    let   soonestFailure = Infinity;   // seconds until predicted threshold breach
    let   trendUp        = 0;
    let   trendDown      = 0;

    METRIC_NAMES.forEach(metric => {
      const s = nodeState[metric];
      if (s.buffer.length < 3) {
        // Not enough data yet — skip
        metricDetails[metric] = {
          current: s.buffer[s.buffer.length - 1] || 0,
          ewma:    s.ewma || 0,
          zScore:  0,
          trend:   'stable',
          ttf:     null,
        };
        return;
      }

      const current     = s.buffer[s.buffer.length - 1];
      const { mean, std } = meanStd(s.buffer);

      // Z-score anomaly detection
      const zScore = std > 0 ? Math.abs((current - mean) / std) : 0;
      const isAnomaly = zScore > Z_THRESHOLD;

      // Linear regression for trend & time-to-failure
      const { slope } = linearRegression(s.buffer);
      const trend = slope > 0.05 ? 'rising' : slope < -0.05 ? 'falling' : 'stable';
      if (trend === 'rising')  trendUp++;
      if (trend === 'falling') trendDown++;

      // Time-to-failure: how many ticks (at current slope) until danger threshold?
      // Each tick = 2s in simulation time.
      const threshold = DANGER_THRESHOLDS[metric];
      let ttfSeconds  = null;

      if (slope > 0 && current < threshold) {
        const ticksToThreshold = (threshold - current) / slope;
        ttfSeconds = Math.round(ticksToThreshold * 2); // 2s per tick
      } else if (current >= threshold) {
        ttfSeconds = 0; // Already in danger zone
      }

      if (ttfSeconds !== null && ttfSeconds < soonestFailure) {
        soonestFailure = ttfSeconds;
      }

      // Per-metric risk contribution (0-100)
      const proximityRisk = Math.min(100, (current / threshold) * 100);
      const anomalyBoost  = isAnomaly ? 20 : 0;
      const trendBoost    = slope > 0 ? Math.min(15, slope * 10) : 0;
      const metricRisk    = Math.min(100, proximityRisk * 0.5 + anomalyBoost + trendBoost);

      totalRisk += metricRisk;
      metricsCounted++;

      if (isAnomaly) {
        anomalies.push({
          metric,
          value:   +current.toFixed(2),
          zScore:  +zScore.toFixed(2),
          ewma:    +s.ewma.toFixed(2),
          threshold,
        });
      }

      metricDetails[metric] = {
        current:   +current.toFixed(2),
        ewma:      +(s.ewma || 0).toFixed(2),
        zScore:    +zScore.toFixed(2),
        trend,
        ttf:       ttfSeconds,
        slope:     +slope.toFixed(4),
        mean:      +mean.toFixed(2),
        std:       +std.toFixed(2),
        threshold,
      };
    });

    // Composite risk score (0-100)
    const baseRisk  = metricsCounted > 0 ? totalRisk / metricsCounted : 0;
    const anomalyPenalty = anomalies.length * 8;  // Extra penalty per active anomaly
    const riskScore = Math.min(100, Math.round(baseRisk + anomalyPenalty));

    // Overall trend direction
    const trendDirection = trendUp > trendDown ? 'degrading'
                         : trendDown > trendUp ? 'improving'
                         : 'stable';

    // Predicted failure time as ISO string (null if no predicted failure)
    let predictedFailureTime = null;
    if (soonestFailure !== Infinity && soonestFailure >= 0) {
      predictedFailureTime = new Date(Date.now() + soonestFailure * 1000).toISOString();
    }

    return {
      nodeId,
      riskScore,
      predictedFailureTime,
      anomalies,
      trendDirection,
      metrics: metricDetails,
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Default empty prediction for nodes with no data yet.
   */
  _emptyPrediction(nodeId) {
    const metrics = {};
    METRIC_NAMES.forEach(m => {
      metrics[m] = {
        current: 0, ewma: 0, zScore: 0, trend: 'stable', ttf: null,
        slope: 0, mean: 0, std: 0, threshold: DANGER_THRESHOLDS[m],
      };
    });

    return {
      nodeId,
      riskScore:            0,
      predictedFailureTime: null,
      anomalies:            [],
      trendDirection:       'stable',
      metrics,
      updatedAt: new Date().toISOString(),
    };
  }

  // ── Broadcast ────────────────────────────────────────────────────────────

  /**
   * Emit 'prediction:update' with the full report for every known node.
   */
  _broadcastPredictions() {
    const report = this.getAnomalyReport();
    this.emit('prediction:update', {
      nodes:     report,
      timestamp: new Date().toISOString(),
    });
  }
}

module.exports = new PredictionService();
