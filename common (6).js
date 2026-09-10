const Joi = require('joi');
const id = Joi.string().hex().length(24);
const idParams = Joi.object({ id: id.required() });
const pagination = { page: Joi.number().integer().min(1).max(10000).default(1), limit: Joi.number().integer().min(1).max(100).default(20) };
const password = Joi.string().min(12).max(72).pattern(/[A-Za-z]/).pattern(/[0-9]/)
  .custom((value, helpers) => Buffer.byteLength(value, 'utf8') <= 72 ? value : helpers.error('string.max', { limit: 72 }));
module.exports = { Joi, id, idParams, pagination, password };
