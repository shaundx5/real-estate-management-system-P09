const Joi = require('joi');
const AppError = require('../utils/AppError');
const empty = Joi.object({}).unknown(false);

// Every route validates body, path and query, including requests that accept no body.
module.exports = ({ body = empty, params = empty, query = empty } = {}) => (req, res, next) => {
  req.validated = {};
  for (const [source, schema] of Object.entries({ body, params, query })) {
    const { value, error } = schema.validate(req[source] ?? {}, {
      abortEarly: false, allowUnknown: false, convert: source !== 'body'
    });
    if (error) {
      // Field names and rule types are safe; never echo a submitted password/value.
      const fields = error.details.map(d => `${d.path.join('.') || source} (${d.type})`).join(', ');
      return next(new AppError(400, `Invalid ${source}: ${fields}`, 'VALIDATION_ERROR'));
    }
    req.validated[source] = value;
  }
  next();
};
