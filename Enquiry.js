const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, immutable: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  message: { type: String, required: true, maxlength: 2000 },
  status: { type: String, enum: ['New', 'In Progress', 'Approved', 'Rejected', 'Closed'], default: 'New' },
  remarks: { type: String, default: '', maxlength: 2000 },
  statusHistory: [{
    _id: false,
    status: { type: String, enum: ['New', 'In Progress', 'Approved', 'Rejected', 'Closed'], required: true },
    remarks: { type: String, default: '' },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changedAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true, collection: 'enquiries', optimisticConcurrency: true });
schema.index({ propertyId: 1 });
schema.index({ buyerId: 1, createdAt: -1 });
schema.index({ propertyId: 1, buyerId: 1 }, { unique: true });
schema.index({ propertyId: 1, status: 1, createdAt: -1 });
module.exports = mongoose.model('Enquiry', schema);
