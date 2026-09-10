const bcrypt = require('bcrypt');
const crypto = require('node:crypto');
const User = require('../models/User');
const { generateToken } = require('../utils/token');
const AppError = require('../utils/AppError');
const send = require('../utils/response');

// A real bcrypt comparison for missing accounts reduces account-enumeration timing differences.
const dummyHash = bcrypt.hashSync(crypto.randomBytes(32).toString('hex'), 12);
exports.register = async (req, res) => {
  const { name, email, password, role } = req.validated.body;
  const user = await User.create({ name: name.trim(), email: email.toLowerCase(), role, passwordHash: await bcrypt.hash(password, 12) });
  send(res, 'Account created. Log in to obtain your token.', { user }, 201);
};
exports.login = async (req, res) => {
  const { email, password } = req.validated.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user ? user.passwordHash : dummyHash);
  if (!user || !matches) throw new AppError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS');
  send(res, 'Login successful.', { token: generateToken(user), user });
};
exports.me = async (req, res) => send(res, 'Authenticated account.', { user: req.user });
