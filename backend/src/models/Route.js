const mongoose = require('mongoose');

const RouteSchema = new mongoose.Schema({
  fromNode: { type: String, required: true },
  toNode: { type: String, required: true },
  path: [{ type: String }],
  hopCount: { type: Number, default: 1 },
  totalLatency: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Route', RouteSchema);
