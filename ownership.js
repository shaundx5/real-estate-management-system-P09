const Property = require('../models/Property');
const Enquiry = require('../models/Enquiry');
const Favourite = require('../models/Favourite');
const User = require('../models/User');
const AppError = require('../utils/AppError');

// Role middleware always runs before this resource-level authorization middleware.
exports.ownProperty = async (req, res, next) => {
  const property = await Property.findOne({ _id: req.validated.params.id, isDeleted: false });
  if (!property) throw new AppError(404, 'Property not found.', 'PROPERTY_NOT_FOUND');
  if (!property.agentId.equals(req.user._id)) throw new AppError(403, 'You do not own this property.', 'NOT_OWNER');
  req.resource = property;
  next();
};
exports.ownLead = async (req, res, next) => {
  const enquiry = await Enquiry.findById(req.validated.params.id);
  if (!enquiry) throw new AppError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
  const property = await Property.findById(enquiry.propertyId);
  if (!property || !property.agentId.equals(req.user._id)) throw new AppError(403, 'This enquiry belongs to another agent.', 'NOT_OWNER');
  req.resource = enquiry;
  next();
};
exports.ownFavourite = async (req, res, next) => {
  const favourite = await Favourite.findById(req.validated.params.id);
  if (!favourite) throw new AppError(404, 'Favourite not found.', 'FAVOURITE_NOT_FOUND');
  if (!favourite.userId.equals(req.user._id)) throw new AppError(403, 'You do not own this favourite.', 'NOT_OWNER');
  req.resource = favourite;
  next();
};
exports.ownRatingEnquiry = async (req, res, next) => {
  const agent = await User.findOne({ _id: req.validated.params.id, role: 'agent' }).select('_id');
  if (!agent) throw new AppError(404, 'Agent not found.', 'AGENT_NOT_FOUND');
  const enquiry = await Enquiry.findById(req.validated.body.enquiryId);
  if (!enquiry) throw new AppError(404, 'Enquiry not found.', 'ENQUIRY_NOT_FOUND');
  if (!enquiry.buyerId.equals(req.user._id)) throw new AppError(403, 'You can rate only using your own enquiry.', 'NOT_OWNER');
  const property = await Property.findById(enquiry.propertyId);
  if (!property || property.agentId.toString() !== req.validated.params.id.toLowerCase()) throw new AppError(409, 'Enquiry does not belong to this agent.', 'AGENT_ENQUIRY_MISMATCH');
  req.resource = enquiry;
  req.agent = agent;
  next();
};
