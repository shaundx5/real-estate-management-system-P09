const jwt = require('jsonwebtoken');
const env = require('../config/env');
const options = { algorithm: 'HS256', issuer: 'p09-api', audience: 'p09-client' };
exports.generateToken = user => jwt.sign({ role: user.role }, env.jwtSecret, {
  ...options, subject: user._id.toString(), expiresIn: env.jwtExpiry
});
exports.verifyToken = token => jwt.verify(token, env.jwtSecret, {
  algorithms: ['HS256'], issuer: options.issuer, audience: options.audience
});
