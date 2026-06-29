const mongoose = require('mongoose');

const NodeSchema = new mongoose.Schema({
  nodeId: { type: String, required: true, unique: true },
  label: { type: String, required: true },
  ipAddress: { type: String, default: '' },
  status: { type: String, enum: ['healthy', 'unstable', 'failed', 'gateway'], default: 'healthy' },
  cpuUsage: { type: Number, default: 0 },
  uptime: { type: Number, default: 0 },
  wifiSignal: { type: Number, default: -50 },
  packetCount: { type: Number, default: 0 },
  latency: { type: Number, default: 5 },
  lastHeartbeat: { type: Date, default: Date.now },
  neighbors: [{ type: String }],
  currentRoute: [{ type: String }],
  position: {
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 }
  },
  anomalyScore: { type: Number, default: 0 },
  isGateway: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Node', NodeSchema);
