const mongoose = require('mongoose');

const TelemetrySchema = new mongoose.Schema({
  nodeId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now },
  temperature: { type: Number, default: 25 },
  humidity: { type: Number, default: 50 },
  gasLevel: { type: Number, default: 0 },
  motionDetected: { type: Boolean, default: false },
  powerStatus: { type: String, enum: ['normal', 'low', 'critical'], default: 'normal' },
  networkLoad: { type: Number, default: 0 },
  batteryLevel: { type: Number, default: 100 }
}, { timestamps: true });

TelemetrySchema.index({ nodeId: 1, timestamp: -1 });

module.exports = mongoose.model('Telemetry', TelemetrySchema);
