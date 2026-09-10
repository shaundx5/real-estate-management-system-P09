const Enquiry = require('../models/Enquiry');
const User = require('../models/User');
const send = require('../utils/response');
const { pageOptions, pageData } = require('../utils/pagination');
exports.topProperties = async (req, res) => {
  const { page, limit, skip } = pageOptions(req.validated.query);
  const [result] = await Enquiry.aggregate([
    { $group: { _id: '$propertyId', enquiriesCount: { $sum: 1 }, approvedCount: { $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] } }, closedCount: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } } } },
    { $sort: { enquiriesCount: -1, _id: 1 } },
    { $facet: {
      items: [{ $skip: skip }, { $limit: limit }, { $lookup: { from: 'properties', localField: '_id', foreignField: '_id', pipeline: [{ $project: { title: 1, city: 1, agentId: 1, status: 1, isDeleted: 1 } }], as: 'property' } }, { $unwind: '$property' }, { $project: { _id: 0, property: 1, enquiriesCount: 1, approvedCount: 1, closedCount: 1 } }],
      count: [{ $count: 'total' }]
    } }
  ]);
  send(res, 'Most-enquired properties (all time, including archived listings).', pageData(result.items, result.count[0]?.total || 0, page, limit));
};
exports.agentPerformance = async (req, res) => {
  const { page, limit, skip } = pageOptions(req.validated.query);
  // Two bounded-purpose lookups: one summary of listings and one summary of their leads.
  // All counts, conversion calculations, sorting and pagination happen in MongoDB.
  const [result] = await User.aggregate([
    { $match: { role: 'agent' } },
    { $lookup: { from: 'properties', localField: '_id', foreignField: 'agentId', pipeline: [
      { $group: { _id: null, ids: { $push: '$_id' }, listingsCount: { $sum: 1 },
        activeListingsCount: { $sum: { $cond: ['$isDeleted', 0, 1] } },
        soldCount: { $sum: { $cond: [{ $eq: ['$status', 'Sold'] }, 1, 0] } },
        rentedCount: { $sum: { $cond: [{ $eq: ['$status', 'Rented'] }, 1, 0] } }
      } }
    ], as: 'listingStats' } },
    { $set: { listingStats: { $ifNull: [{ $first: '$listingStats' }, { ids: [], listingsCount: 0, activeListingsCount: 0, soldCount: 0, rentedCount: 0 }] } } },
    { $lookup: { from: 'enquiries', let: { propertyIds: '$listingStats.ids' }, pipeline: [
      { $match: { $expr: { $in: ['$propertyId', '$$propertyIds'] } } },
      { $group: { _id: null, enquiriesReceived: { $sum: 1 }, closedEnquiries: { $sum: { $cond: [{ $eq: ['$status', 'Closed'] }, 1, 0] } } } }
    ], as: 'leadStats' } },
    { $set: { leadStats: { $ifNull: [{ $first: '$leadStats' }, { enquiriesReceived: 0, closedEnquiries: 0 }] } } },
    { $project: { _id: 0, agentId: '$_id', name: 1, isAgentVerified: 1,
      listingsCount: '$listingStats.listingsCount', activeListingsCount: '$listingStats.activeListingsCount',
      soldCount: '$listingStats.soldCount', rentedCount: '$listingStats.rentedCount',
      enquiriesReceived: '$leadStats.enquiriesReceived', closedEnquiries: '$leadStats.closedEnquiries',
      conversionRatePercent: { $cond: [{ $gt: ['$listingStats.listingsCount', 0] }, { $round: [{ $multiply: [{ $divide: [{ $add: ['$listingStats.soldCount', '$listingStats.rentedCount'] }, '$listingStats.listingsCount'] }, 100] }, 2] }, 0] }
    } },
    { $sort: { enquiriesReceived: -1, listingsCount: -1, agentId: 1 } },
    { $facet: { items: [{ $skip: skip }, { $limit: limit }], count: [{ $count: 'total' }] } }
  ]);
  send(res, 'Agent performance (all-time listing conversion to Sold/Rented).', pageData(result.items, result.count[0]?.total || 0, page, limit));
};
