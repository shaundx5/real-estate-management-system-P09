const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, immutable: true },
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Property', required: true, immutable: true }
}, { timestamps: true, collection: 'favourites' });
schema.index({ userId: 1 });
schema.index({ userId: 1, propertyId: 1 }, { unique: true });
module.exports = mongoose.model('Favourite', schema);
