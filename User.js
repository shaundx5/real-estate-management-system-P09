const mongoose = require('mongoose');
const schema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  email: { type: String, required: true, trim: true, lowercase: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['buyer', 'tenant', 'agent', 'admin'], required: true },
  isAgentVerified: { type: Boolean, default: false },
  agentVerifiedAt: { type: Date, default: null }
}, { timestamps: true, collection: 'users' });
schema.index({ email: 1 }, { unique: true });
schema.index({ role: 1, isAgentVerified: 1 });
schema.methods.toJSON = function () {
  const result = this.toObject();
  delete result.passwordHash;
  delete result.__v;
  return result;
};
module.exports = mongoose.model('User', schema);
