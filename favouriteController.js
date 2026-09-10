const Favourite = require('../models/Favourite');
const send = require('../utils/response');
const transaction = require('../utils/transaction');
const AppError = require('../utils/AppError');
const { publicFilter, publicFields, lockProperty } = require('../utils/propertyRules');
const { pageOptions, pageData } = require('../utils/pagination');
exports.create = async (req, res) => {
  const favourite = await transaction(async session => {
    await lockProperty(req.validated.body.propertyId, session, { publicOnly: true });
    const [doc] = await Favourite.create([{ userId: req.user._id, propertyId: req.validated.body.propertyId }], { session });
    return doc;
  });
  send(res, 'Property saved.', { favourite }, 201);
};
exports.list = async (req, res) => {
  const { page, limit, skip } = pageOptions(req.validated.query);
  const filter = { userId: req.user._id };
  const [items, total] = await Promise.all([
    Favourite.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate({ path: 'propertyId', match: publicFilter, select: publicFields }).lean(),
    Favourite.countDocuments(filter)
  ]);
  send(res, 'Your saved properties. A null propertyId means the listing is no longer public.', pageData(items, total, page, limit));
};
exports.remove = async (req, res) => {
  const result = await Favourite.deleteOne({ _id: req.resource._id, userId: req.user._id });
  if (!result.deletedCount) throw new AppError(404, 'Favourite not found.', 'FAVOURITE_NOT_FOUND');
  send(res, 'Property removed from favourites.', {});
};
