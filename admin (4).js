const { Joi, pagination } = require('./common');
exports.moderation = Joi.object({ ...pagination, view: Joi.string().valid('all', 'pending', 'flagged', 'rejected').default('pending') });
exports.action = Joi.object({
  action: Joi.string().valid('verify', 'reject', 'unflag').required(),
  reason: Joi.string().trim().min(10).max(1000).pattern(/\S/).when('action', { is: 'reject', then: Joi.required(), otherwise: Joi.optional() })
});
exports.reports = Joi.object({ ...pagination });
