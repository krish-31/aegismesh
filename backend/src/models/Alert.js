const mongoose = require('mongoose');

const AlertSchema = new mongoose.Schema({
  type: { type: String, required: true },
  nodeId: { type: String, default: null },
  severity: { type: String, enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'], default: 'MEDIUM' },
  description: { type: String, required: true },
  acknowledged: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
}, { timestamps: true });

module.exports = mongoose.model('Alert', AlertSchema);
