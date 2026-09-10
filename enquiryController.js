const Enquiry = require('../models/Enquiry');
const Property = require('../models/Property');
const send = require('../utils/response');
const transaction = require('../utils/transaction');
const { lockProperty } = require('../utils/propertyRules');
const { assertTransition, enquiryTransitions } = require('../utils/stateMachines');
const { pageOptions, pageData } = require('../utils/pagination');
exports.create = async (req, res) => {
  const enquiry = await transaction(async session => {
    const property = await lockProperty(req.validated.body.propertyId, session, { publicOnly: true, accepting: true });
    const [doc] = await Enquiry.create([{
      propertyId: property._id, buyerId: req.user._id, message: req.validated.body.message,
      statusHistory: [{ status: 'New', changedBy: req.user._id }]
    }], { session });
    return doc;
  });
  send(res, 'Enquiry submitted to the listing agent.', { enquiry }, 201);
};
async function list(req, res, agentView) {
  const q = req.validated.query;
  const filter = agentView ? { propertyId: { $in: await Property.find({ agentId: req.user._id }).distinct('_id') } } : { buyerId: req.user._id };
  if (q.propertyId) filter.$and = [{ propertyId: q.propertyId }];
  if (q.status) filter.status = q.status;
  const { page, limit, skip } = pageOptions(q);
  let request = Enquiry.find(filter).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit).populate({ path: 'propertyId', select: 'title agentId status isDeleted' });
  if (agentView) request = request.populate({ path: 'buyerId', select: 'name email role' });
  const [items, total] = await Promise.all([request.lean(), Enquiry.countDocuments(filter)]);
  send(res, agentView ? 'Enquiries on your listings.' : 'Your enquiries.', pageData(items, total, page, limit));
}
exports.list = (req, res) => list(req, res, true);
exports.mine = (req, res) => list(req, res, false);
exports.status = async (req, res) => {
  const enquiry = await transaction(async session => {
    // Property lock makes deletion and lead updates mutually consistent.
    await lockProperty(req.resource.propertyId, session);
    const doc = await Enquiry.findById(req.resource._id).session(session);
    const { status, remarks = '' } = req.validated.body;
    assertTransition(enquiryTransitions, doc.status, status);
    doc.status = status; doc.remarks = remarks;
    doc.statusHistory.push({ status, remarks, changedBy: req.user._id });
    await doc.save({ session });
    return doc;
  });
  send(res, 'Enquiry status updated.', { enquiry });
};
