const { Joi, password } = require('./common');
exports.register = Joi.object({
  name: Joi.string().trim().min(2).max(100).pattern(/\S/).required(),
  email: Joi.string().email({ tlds: { allow: false } }).max(254).required(),
  password: password.required(),
  role: Joi.string().valid('buyer', 'tenant', 'agent').required()
});
exports.login = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).max(254).required(),
  password: Joi.string().min(1).max(72).custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('string.max', { limit: 72 })).required()
});
