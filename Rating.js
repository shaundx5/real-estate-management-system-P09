const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  enquiryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Enquiry', required: true, immutable: true },
  score: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, default: '', maxlength: 1000 }
}, { timestamps: true, collection: 'ratings' });
schema.index({ agentId: 1, buyerId: 1 }, { unique: true });
schema.index({ agentId: 1, createdAt: -1 });
module.exports = mongoose.model('Rating', schema);
