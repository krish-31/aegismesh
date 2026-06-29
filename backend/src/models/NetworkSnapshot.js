const mongoose = require('mongoose');

const NetworkSnapshotSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  nodes: [{ type: mongoose.Schema.Types.Mixed }],
  edges: [{ type: mongoose.Schema.Types.Mixed }],
  healthPercentage: { type: Number, default: 100 },
  activeRoutes: { type: Number, default: 0 }
}, { timestamps: true });

module.exports = mongoose.model('NetworkSnapshot', NetworkSnapshotSchema);
