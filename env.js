const path = require('node:path');
const dotenv = require('dotenv');
const Joi = require('joi');

// ENV_FILE lets isolated tests use a temporary .env without changing a user's file.
dotenv.config({ path: process.env.ENV_FILE || path.join(__dirname, '..', '.env'), quiet: true, override: true });
const schema = Joi.object({
  PORT: Joi.number().port().default(3000),
  MONGO_URI: Joi.string().pattern(/^mongodb(?:\+srv)?:\/\//).required(),
  JWT_SECRET: Joi.string().min(48).required().invalid('REPLACE_WITH_A_RANDOM_SECRET_OF_AT_LEAST_48_CHARACTERS'),
  JWT_EXPIRY: Joi.string().pattern(/^[1-9]\d*(s|m|h|d)$/).default('2h'),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  AUTH_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(30),
  API_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(600),
  ADMIN_NAME: Joi.string().trim().min(2).max(100),
  ADMIN_EMAIL: Joi.string().email({ tlds: { allow: false } }).lowercase(),
  ADMIN_PASSWORD: Joi.string().min(12).max(72)
}).unknown(true);
const { error, value } = schema.validate(process.env, { abortEarly: false });
if (error) {
  // Never include invalid values: a value may contain a credential or database URI.
  throw new Error(`Invalid environment keys: ${error.details.map(d => d.path.join('.')).join(', ')}. Check .env.example.`);
}
module.exports = Object.freeze({
  port: value.PORT, mongoUri: value.MONGO_URI, jwtSecret: value.JWT_SECRET,
  jwtExpiry: value.JWT_EXPIRY, nodeEnv: value.NODE_ENV,
  authLimit: value.AUTH_RATE_LIMIT_MAX, apiLimit: value.API_RATE_LIMIT_MAX,
  admin: { name: value.ADMIN_NAME, email: value.ADMIN_EMAIL, password: value.ADMIN_PASSWORD }
});
