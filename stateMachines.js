const AppError = require('./AppError');
exports.propertyTransitions = { Available: ['Under Negotiation'], 'Under Negotiation': ['Sold', 'Rented'], Sold: [], Rented: [] };
exports.enquiryTransitions = { New: ['In Progress', 'Rejected'], 'In Progress': ['Approved', 'Rejected'], Approved: ['Closed'], Rejected: ['Closed'], Closed: [] };
exports.assertTransition = (machine, current, next) => {
  if (!machine[current]?.includes(next)) throw new AppError(409, `Cannot change status from ${current} to ${next}.`, 'INVALID_STATUS_TRANSITION');
};
