const User = require('../models/User');
const Property = require('../models/Property');
const send = require('../utils/response');
const AppError = require('../utils/AppError');
const transaction = require('../utils/transaction');
const { lockProperty } = require('../utils/propertyRules');
const { pageOptions, pageData } = require('../utils/pagination');

async function moderate(id, action, reason, adminId) {
  return transaction(async session => {
    const property = await lockProperty(id, session);
    if (action === 'verify') {
      if (property.isFlagged) throw new AppError(409, 'Resolve the flag before verifying.', 'PROPERTY_FLAGGED');
      if (property.reviewStatus !== 'Pending') throw new AppError(409, 'Only pending listings can be verified; rejected listings must be edited and resubmitted.', 'NOT_PENDING');
      const agent = await User.findById(property.agentId).session(session);
      if (!agent?.isAgentVerified) throw new AppError(409, 'Verify this agent before approving their listing.', 'AGENT_NOT_VERIFIED');
      property.isVerified = true; property.reviewStatus = 'Verified'; property.rejectionReason = '';
    } else if (action === 'reject') {
      if (property.reviewStatus === 'Rejected') throw new AppError(409, 'Listing is already rejected.', 'ALREADY_REJECTED');
      property.isVerified = false; property.reviewStatus = 'Rejected'; property.rejectionReason = reason;
    } else if (action === 'unflag') {
      if (!property.isFlagged) throw new AppError(409, 'Listing is not flagged.', 'NOT_FLAGGED');
      property.isFlagged = false; property.flagReason = ''; property.flaggedBy = null;
    }
    property.moderatedBy = adminId; property.moderatedAt = new Date();
    await property.save({ session });
    return property;
  });
}
exports.verifyProperty = async (req, res) => send(res, 'Listing verified.', { property: await moderate(req.validated.params.id, 'verify', '', req.user._id) });
exports.moderate = async (req, res) => {
  const { action, reason = '' } = req.validated.body;
  send(res, 'Moderation action applied.', { property: await moderate(req.validated.params.id, action, reason, req.user._id) });
};
exports.verifyAgent = async (req, res) => {
  const agent = await User.findOneAndUpdate({ _id: req.validated.params.id, role: 'agent', isAgentVerified: false }, { $set: { isAgentVerified: true, agentVerifiedAt: new Date() } }, { returnDocument: 'after' });
  if (!agent) {
    if (!await User.exists({ _id: req.validated.params.id, role: 'agent' })) throw new AppError(404, 'Agent not found.', 'AGENT_NOT_FOUND');
    throw new AppError(409, 'Agent is already verified.', 'ALREADY_VERIFIED');
  }
  send(res, 'Agent verified.', { agent });
};
exports.dashboard = async (req, res) => {
  const { page, limit, skip } = pageOptions(req.validated.query);
  const filter = { isDeleted: false };
  const view = req.validated.query.view;
  if (view === 'pending') filter.reviewStatus = 'Pending';
  if (view === 'rejected') filter.reviewStatus = 'Rejected';
  if (view === 'flagged') filter.isFlagged = true;
  const pendingAgentsFilter = { role: 'agent', isAgentVerified: false };
  const [items, total, agents, agentsTotal, counts] = await Promise.all([
    Property.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(), Property.countDocuments(filter),
    User.find(pendingAgentsFilter).select('name email createdAt').sort({ createdAt: 1, _id: 1 }).skip(skip).limit(limit).lean(), User.countDocuments(pendingAgentsFilter),
    Property.aggregate([{ $match: { isDeleted: false } }, { $group: { _id: null,
      pending: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Pending'] }, 1, 0] } },
      flagged: { $sum: { $cond: ['$isFlagged', 1, 0] } },
      rejected: { $sum: { $cond: [{ $eq: ['$reviewStatus', 'Rejected'] }, 1, 0] } },
      verified: { $sum: { $cond: ['$isVerified', 1, 0] } }
    } }, { $project: { _id: 0 } }])
  ]);
  send(res, 'Moderation dashboard.', { counts: { ...(counts[0] || { pending: 0, flagged: 0, rejected: 0, verified: 0 }), pendingAgents: agentsTotal }, listings: pageData(items, total, page, limit), pendingAgents: pageData(agents, agentsTotal, page, limit) });
};
