const mongoose = require('mongoose');

const FailoverLogSchema = new mongoose.Schema({
  triggeredBy: { type: String, required: true },
  failedNode: { type: String, required: true },
  previousRoute: [{ type: String }],
  newRoute: [{ type: String }],
  duration: { type: Number, default: 0 },
  timestamp: { type: Date, default: Date.now },
  success: { type: Boolean, default: true },
  reason: { type: String, default: 'Node timeout' }
}, { timestamps: true });

module.exports = mongoose.model('FailoverLog', FailoverLogSchema);
