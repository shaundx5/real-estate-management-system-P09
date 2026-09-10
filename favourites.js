const { Joi, id, pagination } = require('./common');
exports.create = Joi.object({ propertyId: id.required() });
exports.list = Joi.object({ ...pagination });
