const Property = require('../models/Property');
const AppError = require('./AppError');
const publicFilter = { isDeleted: false, isVerified: true, isFlagged: false };
const publicFields = '_id agentId title description type listingFor price city locality bedrooms status images isVerified createdAt updatedAt';

// This write serializes dependent actions against edit, flag, verify, status and deletion.
async function lockProperty(id, session, { publicOnly = false, accepting = false } = {}) {
  const property = await Property.findOneAndUpdate({ _id: id, isDeleted: false }, { $inc: { activityVersion: 1 } }, { returnDocument: 'after', session, timestamps: false });
  if (!property) throw new AppError(404, 'Property not found.', 'PROPERTY_NOT_FOUND');
  if (publicOnly && (!property.isVerified || property.isFlagged)) throw new AppError(409, 'Property is pending review, rejected or flagged.', 'PROPERTY_NOT_PUBLIC');
  if (accepting && !['Available', 'Under Negotiation'].includes(property.status)) throw new AppError(409, 'Property no longer accepts enquiries.', 'PROPERTY_UNAVAILABLE');
  return property;
}
module.exports = { publicFilter, publicFields, lockProperty };
