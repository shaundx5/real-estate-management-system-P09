const express = require('express');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const env = require('./config/env');
const AppError = require('./utils/AppError');
const validate = require('./middleware/validate');
const errorHandler = require('./middleware/errorHandler');
const health = require('./controllers/healthController');

const app = express();
app.disable('x-powered-by');
app.set('query parser', 'simple');
app.use(helmet());
app.use(express.json({ limit: '64kb', strict: true }));
app.use((req, res, next) => {
  const hasBody = req.headers['transfer-encoding'] || Number(req.headers['content-length'] || 0) > 0;
  if (hasBody && !req.is('application/json')) return next(new AppError(400, 'Use Content-Type: application/json for request bodies.', 'UNSUPPORTED_CONTENT_TYPE'));
  next();
});
const limiter = (limit, windowMs) => rateLimit({
  windowMs, limit, standardHeaders: 'draft-8', legacyHeaders: false,
  handler: (req, res, next) => next(new AppError(429, 'Too many requests. Try again later.', 'RATE_LIMITED'))
});
app.use('/api', limiter(env.apiLimit, 60000));
app.use('/api/auth', limiter(env.authLimit, 15 * 60000), require('./routes/authRoutes'));
app.get('/api/health', validate(), health.health);
app.use('/api/properties', require('./routes/propertyRoutes'));
app.use('/api/favourites', require('./routes/favouriteRoutes'));
app.use('/api/enquiries', require('./routes/enquiryRoutes'));
app.use('/api/agents', require('./routes/agentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use((req, res, next) => next(new AppError(404, 'Endpoint not found.', 'ROUTE_NOT_FOUND')));
app.use(errorHandler);
module.exports = app;
