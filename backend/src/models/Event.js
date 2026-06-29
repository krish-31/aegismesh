const mongoose = require('mongoose');

const EventSchema = new mongoose.Schema({
  type: { type: String, required: true },
  severity: { type: String, enum: ['INFO', 'WARNING', 'CRITICAL'], default: 'INFO' },
  message: { type: String, required: true },
  nodeId: { type: String, default: null },
  timestamp: { type: Date, default: Date.now },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

EventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Event', EventSchema);
