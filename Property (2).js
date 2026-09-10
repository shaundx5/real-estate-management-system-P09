const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  title: { type: String, required: true, trim: true, maxlength: 150 },
  description: { type: String, default: '', maxlength: 3000 },
  type: { type: String, enum: ['Apartment', 'House', 'Villa', 'Plot', 'Commercial'], required: true },
  listingFor: { type: String, enum: ['Sale', 'Rent'], required: true },
  price: { type: Number, required: true, min: 1, max: 1000000000000 },
  city: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  locality: { type: String, required: true, trim: true, lowercase: true, maxlength: 100 },
  bedrooms: { type: Number, required: true, min: 0, max: 30 },
  status: { type: String, enum: ['Available', 'Under Negotiation', 'Sold', 'Rented'], default: 'Available' },
  images: { type: [String], default: [] },
  isVerified: { type: Boolean, default: false },
  reviewStatus: { type: String, enum: ['Pending', 'Verified', 'Rejected'], default: 'Pending' },
  isFlagged: { type: Boolean, default: false },
  flagReason: { type: String, default: '' },
  flaggedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  rejectionReason: { type: String, default: '' },
  moderatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  moderatedAt: { type: Date, default: null },
  isDeleted: { type: Boolean, default: false },
  deletedAt: { type: Date, default: null },
  activityVersion: { type: Number, default: 0, select: false }
}, { timestamps: true, collection: 'properties', optimisticConcurrency: true });
schema.index({ agentId: 1 });
schema.index({ city: 1, type: 1, price: 1 });
schema.index({ isDeleted: 1, isVerified: 1, isFlagged: 1, city: 1, type: 1, price: 1 });
schema.index({ city: 1, locality: 1 });
schema.index({ reviewStatus: 1, isFlagged: 1, isDeleted: 1 });
module.exports = mongoose.model('Property', schema);
