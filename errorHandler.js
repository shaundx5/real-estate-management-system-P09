const AppError = require('../utils/AppError');

module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  let status = 500;
  let message = 'An unexpected server error occurred.';
  let errorCode = 'INTERNAL_ERROR';
  if (err instanceof AppError) ({ status, message, errorCode } = err);
  else if (err.code === 11000) {
    status = 409; message = 'This record already exists.'; errorCode = 'DUPLICATE_RECORD';
  } else if (err.type === 'entity.parse.failed') {
    status = 400; message = 'Request body must be valid JSON.'; errorCode = 'INVALID_JSON';
  } else if (err.type === 'entity.too.large') {
    status = 400; message = 'Request body exceeds the 64 KB limit.'; errorCode = 'BODY_TOO_LARGE';
  } else if (err.name === 'ValidationError' || err.name === 'CastError' || err instanceof URIError) {
    status = 400; message = 'Invalid field value or identifier.'; errorCode = 'VALIDATION_ERROR';
  } else if (err.name === 'VersionError' || err.code === 112) {
    status = 409; message = 'Record changed concurrently. Read it again and retry.'; errorCode = 'CONCURRENT_CHANGE';
  } else if (['MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError'].includes(err.name)) {
    status = 503; message = 'Database temporarily unavailable.'; errorCode = 'DATABASE_UNAVAILABLE';
  } else if (err.status >= 400 && err.status < 500) {
    status = 400; message = 'Invalid HTTP request.'; errorCode = 'INVALID_REQUEST';
  }
  // Do not log bodies, headers, tokens, raw DB errors, or error.message.
  if (status >= 500) console.error(JSON.stringify({ event: 'request_error', errorCode, method: req.method }));
  res.status(status).json({ success: false, message, errorCode });
};
