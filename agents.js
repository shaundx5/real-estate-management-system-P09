const { Joi, id, pagination } = require('./common');
exports.rate = Joi.object({ enquiryId: id.required(), score: Joi.number().integer().min(1).max(5).required(), comment: Joi.string().max(1000).allow('') });
exports.profile = Joi.object({ ...pagination });
