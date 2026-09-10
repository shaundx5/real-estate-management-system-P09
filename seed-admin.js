const bcrypt = require('bcrypt');
const env = require('../config/env');
const User = require('../models/User');
const { connectDB, disconnectDB } = require('../config/db');
const { Joi, password } = require('../validators/common');

async function main() {
  const schema = Joi.object({ name: Joi.string().trim().min(2).max(100).required(), email: Joi.string().email({ tlds: { allow: false } }).required(), password: password.required() });
  const { error, value } = schema.validate(env.admin);
  if (error || value.password.startsWith('REPLACE_')) throw new Error('Set valid ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in .env first.');
  await connectDB();
  const existing = await User.findOne({ email: value.email });
  if (existing && existing.role !== 'admin') throw new Error('Email belongs to a non-admin. Refusing to elevate that account.');
  if (!existing) await User.create({ name: value.name, email: value.email, role: 'admin', passwordHash: await bcrypt.hash(value.password, 12) });
  console.log(existing ? 'Admin already exists; credentials were not changed.' : 'Admin created. Use the credentials you set in .env.');
}
main().catch(() => { console.error('Admin seed failed. Check .env and MongoDB replica-set availability.'); process.exitCode = 1; }).finally(disconnectDB);
