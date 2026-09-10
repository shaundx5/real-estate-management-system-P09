const mongoose = require('mongoose');
const env = require('./env');

mongoose.set('strictQuery', true);
mongoose.set('bufferCommands', false);

async function connectDB() {
  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000, autoIndex: false });
  const hello = await mongoose.connection.db.admin().command({ hello: 1 });
  if (!hello.setName && hello.msg !== 'isdbgrid') {
    await mongoose.disconnect();
    throw new Error('MongoDB must be a replica set or Atlas cluster; see Setup Instructions.');
  }
  // Wait for unique indexes before accepting traffic; duplicate protection is a DB constraint.
  for (const model of Object.values(mongoose.models)) await model.createIndexes();
}

module.exports = { connectDB, disconnectDB: () => mongoose.disconnect() };
