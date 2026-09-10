const Property = require('../models/Property');
const Enquiry = require('../models/Enquiry');
const send = require('../utils/response');
const AppError = require('../utils/AppError');
const transaction = require('../utils/transaction');
const { pageOptions, pageData } = require('../utils/pagination');
const { publicFilter, publicFields, lockProperty } = require('../utils/propertyRules');
const { assertTransition, propertyTransitions } = require('../utils/stateMachines');

function normalize(body) {
  const result = { ...body };
  for (const key of ['city', 'locality']) if (result[key]) result[key] = result[key].trim().toLowerCase();
  if (result.title) result.title = result.title.trim();
  return result;
}
exports.create = async (req, res) => {
  const property = await Property.create({ ...normalize(req.validated.body), agentId: req.user._id });
  send(res, 'Listing created and awaiting admin verification.', { property }, 201);
};
exports.update = async (req, res) => {
  const property = await transaction(async session => {
    const doc = await lockProperty(req.resource._id, session);
    if (['Sold', 'Rented'].includes(doc.status)) throw new AppError(409, 'Completed listings cannot be edited.', 'TERMINAL_PROPERTY');
    if (doc.status !== 'Available' && req.validated.body.listingFor && req.validated.body.listingFor !== doc.listingFor) throw new AppError(409, 'Cannot change sale/rent purpose during negotiation.', 'PURPOSE_LOCKED');
    Object.assign(doc, normalize(req.validated.body), { isVerified: false, reviewStatus: 'Pending', rejectionReason: '', moderatedAt: null, moderatedBy: null });
    await doc.save({ session });
    return doc;
  });
  send(res, 'Listing updated; admin verification is required again.', { property });
};
exports.remove = async (req, res) => {
  await transaction(async session => {
    const property = await lockProperty(req.resource._id, session);
    if (['Sold', 'Rented'].includes(property.status)) throw new AppError(409, 'Completed listings must be retained.', 'TERMINAL_PROPERTY');
    if (await Enquiry.exists({ propertyId: property._id, status: { $ne: 'Closed' } }).session(session)) throw new AppError(409, 'Close all enquiries before deleting this listing.', 'OPEN_ENQUIRIES');
    property.isDeleted = true;
    property.deletedAt = new Date();
    property.isVerified = false;
    await property.save({ session });
  });
  send(res, 'Listing deleted; its historical references are retained.', {});
};
exports.search = async (req, res) => {
  const q = req.validated.query;
  const filter = { ...publicFilter };
  for (const key of ['city', 'locality', 'type', 'bedrooms', 'listingFor', 'status']) {
    if (q[key] !== undefined) filter[key] = ['city', 'locality'].includes(key) ? q[key].trim().toLowerCase() : q[key];
  }
  if (req.validated.params.city) filter.city = req.validated.params.city.trim().toLowerCase();
  if (q.minPrice !== undefined || q.maxPrice !== undefined) {
    filter.price = {};
    if (q.minPrice !== undefined) filter.price.$gte = q.minPrice;
    if (q.maxPrice !== undefined) filter.price.$lte = q.maxPrice;
  }
  const { page, limit, skip } = pageOptions(q);
  const sort = q.sort === 'price_asc' ? { price: 1, _id: 1 } : q.sort === 'price_desc' ? { price: -1, _id: -1 } : { createdAt: -1, _id: -1 };
  const [items, total] = await Promise.all([Property.find(filter).select(publicFields).sort(sort).skip(skip).limit(limit).lean(), Property.countDocuments(filter)]);
  send(res, 'Verified listings.', pageData(items, total, page, limit));
};
exports.detail = async (req, res) => {
  const property = await Property.findOne({ _id: req.validated.params.id, ...publicFilter }).select(publicFields).lean();
  if (!property) throw new AppError(404, 'Public property not found.', 'PROPERTY_NOT_FOUND');
  send(res, 'Property details.', { property });
};
exports.mine = async (req, res) => {
  const filter = { agentId: req.user._id, isDeleted: false };
  const { page, limit, skip } = pageOptions(req.validated.query);
  const [items, total] = await Promise.all([Property.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(), Property.countDocuments(filter)]);
  send(res, 'Your listings, including pending and rejected listings.', pageData(items, total, page, limit));
};
exports.status = async (req, res) => {
  const property = await transaction(async session => {
    const doc = await lockProperty(req.resource._id, session, { publicOnly: true });
    const next = req.validated.body.status;
    assertTransition(propertyTransitions, doc.status, next);
    if ((next === 'Sold' && doc.listingFor !== 'Sale') || (next === 'Rented' && doc.listingFor !== 'Rent')) throw new AppError(409, 'Final status must match the sale/rent purpose.', 'PURPOSE_STATUS_MISMATCH');
    doc.status = next;
    await doc.save({ session });
    return doc;
  });
  send(res, 'Property status updated.', { property });
};
exports.flag = async (req, res) => {
  await transaction(async session => {
    const doc = await lockProperty(req.validated.params.id, session);
    if (doc.isFlagged) throw new AppError(409, 'Property is already flagged.', 'ALREADY_FLAGGED');
    if (!doc.isVerified) throw new AppError(409, 'Only a public listing can be flagged.', 'PROPERTY_NOT_PUBLIC');
    doc.isFlagged = true; doc.flagReason = req.validated.body.reason; doc.flaggedBy = req.user._id;
    await doc.save({ session });
  });
  send(res, 'Listing flagged and hidden pending moderation.', {});
};
exports.locations = async (req, res) => {
  const q = req.validated.query;
  const { page, limit, skip } = pageOptions(q);
  const filter = { ...publicFilter };
  if (q.city) filter.city = q.city.trim().toLowerCase();
  const group = q.groupBy === 'city' ? { city: '$city' } : { city: '$city', locality: '$locality' };
  const [result] = await Property.aggregate([
    { $match: filter }, { $group: { _id: group, listingsCount: { $sum: 1 }, minPrice: { $min: '$price' }, maxPrice: { $max: '$price' } } },
    { $sort: { '_id.city': 1, '_id.locality': 1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }, { $project: { _id: 0, city: '$_id.city', locality: '$_id.locality', listingsCount: 1, minPrice: 1, maxPrice: 1 } }], count: [{ $count: 'total' }] } }
  ]);
  send(res, 'Listings grouped by location.', pageData(result.items, result.count[0]?.total || 0, page, limit));
};
