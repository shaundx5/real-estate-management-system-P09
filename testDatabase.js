const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { MongoMemoryReplSet } = require('mongodb-memory-server');

// Starts the genuine MongoDB server binary. No Mongoose, query or API mocks are used.
exports.startDatabase = async () => {
  const db = await MongoMemoryReplSet.create({ binary: { version: process.env.MONGOMS_VERSION || '8.0.12' }, replSet: { count: 1, args: ['--nounixsocket'] } });
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p09-test-'));
  const envFile = path.join(directory, '.env');
  const credentials = { email: 'admin@p09.test', password: crypto.randomBytes(20).toString('hex') + 'A1' };
  fs.writeFileSync(envFile, [
    'PORT=3000', `MONGO_URI=${db.getUri('p09_test')}`, `JWT_SECRET=${crypto.randomBytes(48).toString('hex')}`,
    'JWT_EXPIRY=2h', 'NODE_ENV=test', 'AUTH_RATE_LIMIT_MAX=1000', 'API_RATE_LIMIT_MAX=10000',
    'ADMIN_NAME=P09 Test Admin', `ADMIN_EMAIL=${credentials.email}`, `ADMIN_PASSWORD=${credentials.password}`
  ].join('\n') + '\n', { mode: 0o600 });
  process.env.ENV_FILE = envFile;
  const app = require('../app');
  const { connectDB, disconnectDB } = require('../config/db');
  const User = require('../models/User');
  const bcrypt = require('bcrypt');
  try {
    await connectDB();
    await User.create({ name: 'P09 Test Admin', email: credentials.email, role: 'admin', passwordHash: await bcrypt.hash(credentials.password, 12) });
  } catch (error) {
    await disconnectDB(); await db.stop(); fs.rmSync(directory, { recursive: true, force: true }); throw error;
  }
  return { app, credentials, close: async () => { await disconnectDB(); await db.stop(); fs.rmSync(directory, { recursive: true, force: true }); delete process.env.ENV_FILE; } };
};
