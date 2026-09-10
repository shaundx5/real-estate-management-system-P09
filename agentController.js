const User = require('../models/User');
const Property = require('../models/Property');
const Rating = require('../models/Rating');
const Enquiry = require('../models/Enquiry');
const send = require('../utils/response');
const AppError = require('../utils/AppError');
const transaction = require('../utils/transaction');
const { publicFilter, publicFields } = require('../utils/propertyRules');
const { pageOptions, pageData } = require('../utils/pagination');
exports.profile = async (req, res) => {
  const agent = await User.findOne({ _id: req.validated.params.id, role: 'agent' }).select('name isAgentVerified createdAt').lean();
  if (!agent) throw new AppError(404, 'Agent not found.', 'AGENT_NOT_FOUND');
  const filter = { ...publicFilter, agentId: agent._id };
  const { page, limit, skip } = pageOptions(req.validated.query);
  const [listings, listingsCount, summary, recentRatings] = await Promise.all([
    Property.find(filter).select(publicFields).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).lean(),
    Property.countDocuments(filter),
    Rating.aggregate([{ $match: { agentId: agent._id } }, { $group: { _id: null, average: { $avg: '$score' }, count: { $sum: 1 } } }, { $project: { _id: 0, average: { $round: ['$average', 2] }, count: 1 } }]),
    Rating.find({ agentId: agent._id }).select('score comment createdAt').sort({ createdAt: -1, _id: -1 }).limit(10).lean()
  ]);
  send(res, 'Public agent profile.', { agent, listingsCount, listings: pageData(listings, listingsCount, page, limit), ratings: { ...(summary[0] || { average: 0, count: 0 }), recent: recentRatings } });
};
exports.rate = async (req, res) => {
  const agent = req.agent;
  const rating = await transaction(async session => {
    const enquiry = await Enquiry.findById(req.resource._id).session(session);
    if (enquiry.status !== 'Closed') throw new AppError(409, 'Close the enquiry workflow before rating the agent.', 'ENQUIRY_NOT_CLOSED');
    const [doc] = await Rating.create([{
      agentId: agent._id, buyerId: req.user._id, enquiryId: enquiry._id,
      score: req.validated.body.score, comment: req.validated.body.comment || ''
    }], { session });
    return doc;
  });
  send(res, 'Agent rated.', { rating }, 201);
};
