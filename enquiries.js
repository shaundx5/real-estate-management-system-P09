const { Joi, id, pagination } = require('./common');
const states = ['New', 'In Progress', 'Approved', 'Rejected', 'Closed'];
exports.create = Joi.object({ propertyId: id.required(), message: Joi.string().trim().min(10).max(2000).pattern(/\S/).required() });
exports.status = Joi.object({
  status: Joi.string().valid(...states).required(),
  remarks: Joi.string().trim().min(3).max(2000).pattern(/\S/).when('status', { is: Joi.valid('Rejected', 'Closed'), then: Joi.required(), otherwise: Joi.optional() })
});
exports.list = Joi.object({ ...pagination, propertyId: id, status: Joi.string().valid(...states) });
