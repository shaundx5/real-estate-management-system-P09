const User = require('../models/User');
const { verifyToken } = require('../utils/token');
const AppError = require('../utils/AppError');

async function authenticate(req, res, next) {
  const match = /^Bearer ([^\s]+)$/i.exec(req.get('authorization') || '');
  if (!match) throw new AppError(401, 'A valid Bearer token is required.', 'UNAUTHORIZED');
  let payload;
  try { payload = verifyToken(match[1]); }
  catch { throw new AppError(401, 'Token is invalid or expired.', 'INVALID_TOKEN'); }
  if (!payload || typeof payload.sub !== 'string' || !/^[a-f\d]{24}$/i.test(payload.sub)) {
    throw new AppError(401, 'Token is invalid.', 'INVALID_TOKEN');
  }
  const user = await User.findById(payload.sub);
  if (!user || user.role !== payload.role) throw new AppError(401, 'Token no longer matches an active account.', 'INVALID_TOKEN');
  req.user = user;
  req.role = user.role;
  next();
}
function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(new AppError(401, 'Authentication required.', 'UNAUTHORIZED'));
    if (!roles.includes(req.role)) return next(new AppError(403, 'This role cannot perform this action.', 'FORBIDDEN_ROLE'));
    next();
  };
}
module.exports = { authenticate, authorize };
