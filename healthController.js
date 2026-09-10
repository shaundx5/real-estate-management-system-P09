const mongoose = require('mongoose');
const send = require('../utils/response');
const AppError = require('../utils/AppError');
exports.health = async (req, res) => {
  if (mongoose.connection.readyState !== 1) throw new AppError(503, 'Database temporarily unavailable.', 'DATABASE_UNAVAILABLE');
  await mongoose.connection.db.admin().ping();
  send(res, 'API ready.', { service: 'P09 Real Estate API', database: 'connected' });
};
