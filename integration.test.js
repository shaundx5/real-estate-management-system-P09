const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const crypto = require('node:crypto');
const { startDatabase } = require('./testDatabase');
let fixture, app, users, tokens, User, Property, Enquiry, Favourite, Rating;
const password = crypto.randomBytes(20).toString('hex') + 'A1';
const missing = '000000000000000000000001';

async function api(method, endpoint, token, body, expected) {
  let call = request(app)[method](endpoint);
  if (token) call = call.auth(token, { type: 'bearer' });
  if (body !== undefined) call = call.send(body);
  const result = await call;
  if (expected) assert.equal(result.status, expected, `${method.toUpperCase()} ${endpoint}: ${result.body.errorCode || 'success'}`);
  assert.equal(typeof result.body.success, 'boolean');
  assert.equal(typeof result.body.message, 'string');
  assert.equal(result.text.includes('passwordHash'), false);
  assert.equal(Object.hasOwn(result.body, 'stack'), false);
  return result;
}
function listing(extra = {}) { return { title: 'Integration test apartment', type: 'Apartment', listingFor: 'Sale', price: 5000000, city: 'testcity', locality: 'central', bedrooms: 2, images: [], ...extra }; }
async function createProperty(extra = {}, agent = 'agent', verified = true) {
  const response = await api('post', '/api/properties', tokens[agent], listing(extra), 201);
  const id = response.body.data.property._id;
  if (verified) await api('put', `/api/properties/${id}/verify`, tokens.admin, {}, 200);
  return id;
}
async function createEnquiry(id, buyer = 'buyer') {
  const response = await api('post', '/api/enquiries', tokens[buyer], { propertyId: id, message: 'Please schedule a property viewing for me.' }, 201);
  return response.body.data.enquiry._id;
}

before(async () => {
  fixture = await startDatabase(); app = fixture.app;
  User = require('../models/User'); Property = require('../models/Property'); Enquiry = require('../models/Enquiry'); Favourite = require('../models/Favourite'); Rating = require('../models/Rating');
  users = {}; tokens = {};
  for (const account of ['buyer', 'buyer2', 'tenant', 'agent', 'agent2', 'agent3']) {
    const role = account.replace(/\d/g, '');
    const response = await api('post', '/api/auth/register', null, { name: `Test ${account}`, email: `${account}@p09.test`, password, role }, 201);
    users[account] = response.body.data.user._id;
    const login = await api('post', '/api/auth/login', null, { email: `${account}@p09.test`, password }, 200);
    tokens[account] = login.body.data.token;
  }
  const login = await api('post', '/api/auth/login', null, fixture.credentials, 200);
  tokens.admin = login.body.data.token;
  for (const agent of ['agent', 'agent2']) await api('put', `/api/admin/agents/${users[agent]}/verify`, tokens.admin, {}, 200);
}, { timeout: 180000 });
after(async () => { if (fixture) await fixture.close(); });

test('Passwords are bcrypt hashes; email is unique case-insensitively; JWT is signed and expiring', async () => {
  const bcrypt = require('bcrypt');
  const jwt = require('jsonwebtoken');
  const stored = await User.findById(users.buyer).select('+passwordHash');
  assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(password, stored.passwordHash), true);
  assert.equal(Object.hasOwn(stored.toJSON(), 'passwordHash'), false);
  assert.ok(jwt.decode(tokens.buyer).exp > jwt.decode(tokens.buyer).iat);
  const duplicate = await api('post', '/api/auth/register', null, { name: 'Duplicate user', email: 'BUYER@P09.TEST', password, role: 'buyer' }, 409);
  assert.equal(duplicate.body.errorCode, 'DUPLICATE_RECORD');
  const bad = await api('get', '/api/auth/me', tokens.buyer.slice(0, -8) + 'modified', undefined, 401);
  assert.equal(bad.body.errorCode, 'INVALID_TOKEN');
  const expired = jwt.sign({ role: 'buyer' }, require('../config/env').jwtSecret, { subject: users.buyer, issuer: 'p09-api', audience: 'p09-client', algorithm: 'HS256', expiresIn: -1 });
  await api('get', '/api/auth/me', expired, undefined, 401);
});

test('Registration rejects admin roles and bcrypt-truncated Unicode passwords', async () => {
  await api('post', '/api/auth/register', null, { name: 'Untrusted admin', email: 'bad@p09.test', password, role: 'admin' }, 400);
  await api('post', '/api/auth/register', null, { name: 'Unicode test', email: 'unicode@p09.test', password: 'Aa1' + '🔥'.repeat(24), role: 'buyer' }, 400);
  await api('post', '/api/auth/login', null, { email: 'buyer@p09.test', password: 'Aa1' + '🔥'.repeat(24) }, 400);
  await api('post', '/api/auth/register', null, { name: ' A ', email: 'padding@p09.test', password, role: 'buyer' }, 400);
  assert.equal(await User.countDocuments({ email: 'unicode@p09.test' }), 0);
});

test('All protected route families reject missing JWT and wrong roles before controller mutations', async () => {
  const id = await createProperty();
  const cases = [
    ['post', '/api/properties', listing(), 'buyer'],
    ['get', '/api/properties/mine', undefined, 'tenant'],
    ['put', `/api/properties/${id}`, { price: 2000000 }, 'buyer'],
    ['delete', `/api/properties/${id}`, undefined, 'buyer'],
    ['put', `/api/properties/${id}/status`, { status: 'Under Negotiation' }, 'buyer'],
    ['put', `/api/properties/${id}/verify`, {}, 'agent'],
    ['post', `/api/properties/${id}/flag`, { reason: 'A valid accuracy concern.' }, 'agent'],
    ['post', '/api/favourites', { propertyId: id }, 'agent'],
    ['get', '/api/favourites', undefined, 'admin'],
    ['delete', `/api/favourites/${missing}`, undefined, 'agent'],
    ['post', '/api/enquiries', { propertyId: id, message: 'Please schedule a visit.' }, 'agent'],
    ['get', '/api/enquiries', undefined, 'buyer'],
    ['get', '/api/enquiries/mine', undefined, 'agent'],
    ['put', `/api/enquiries/${missing}/status`, { status: 'In Progress' }, 'buyer'],
    ['post', `/api/agents/${users.agent}/ratings`, { enquiryId: missing, score: 4 }, 'agent'],
    ['put', `/api/admin/agents/${users.agent}/verify`, {}, 'agent'],
    ['get', '/api/admin/moderation', undefined, 'buyer'],
    ['put', `/api/admin/moderation/${id}`, { action: 'unflag' }, 'buyer'],
    ['get', '/api/admin/reports/top-properties', undefined, 'agent'],
    ['get', '/api/admin/reports/agent-performance', undefined, 'tenant']
  ];
  for (const [method, url, body, wrongRole] of cases) {
    await api(method, url, null, body, 401);
    await api(method, url, tokens[wrongRole], body, 403);
  }
  assert.equal((await Property.findById(id)).status, 'Available');
});

test('Visibility gate holds across all public reading and interaction endpoints', async () => {
  const city = 'visibility-city';
  const id = await createProperty({ city }, 'agent3', false);
  const path = `/api/properties/${id}`;
  await api('put', `${path}/verify`, tokens.admin, {}, 409);
  for (const endpoint of [`/api/properties/search?city=${city}`, `/api/properties/city/${city}`, `/api/properties/locations?city=${city}`]) {
    const r = await api('get', endpoint, null, undefined, 200);
    assert.equal(r.body.data.items.length, 0);
  }
  const profile = await api('get', `/api/agents/${users.agent3}/profile`, null, undefined, 200);
  assert.equal(profile.body.data.listingsCount, 0);
  await api('get', path, null, undefined, 404);
  await api('post', '/api/favourites', tokens.buyer, { propertyId: id }, 409);
  await api('post', '/api/enquiries', tokens.buyer, { propertyId: id, message: 'Please schedule a visit.' }, 409);
  await api('put', `${path}/status`, tokens.agent3, { status: 'Under Negotiation' }, 409);
  await api('put', `/api/admin/agents/${users.agent3}/verify`, tokens.admin, {}, 200);
  await api('put', `${path}/verify`, tokens.admin, {}, 200);
  await api('post', '/api/favourites', tokens.buyer, { propertyId: id }, 201);
  await api('post', `${path}/flag`, tokens.buyer, { reason: 'Property photographs need review.' }, 200);
  const saved = await api('get', '/api/favourites', tokens.buyer, undefined, 200);
  assert.equal(saved.body.data.items.find(f => f.userId === users.buyer).propertyId, null);
  await api('put', `/api/admin/moderation/${id}`, tokens.admin, { action: 'reject', reason: 'Please correct the listing information.' }, 200);
  await api('put', `/api/admin/moderation/${id}`, tokens.admin, { action: 'unflag' }, 200);
  await api('get', path, null, undefined, 404);
  await api('put', path, tokens.agent3, { title: 'Corrected property details' }, 200);
  await api('put', `${path}/verify`, tokens.admin, {}, 200);
  await api('get', path, null, undefined, 200);
});

test('Ownership middleware blocks another agent and prevents list-filter escape', async () => {
  const id = await createProperty();
  const enquiry = await createEnquiry(id);
  for (const [method, url, body] of [['put', `/api/properties/${id}`, { title: 'Changed by wrong agent' }], ['delete', `/api/properties/${id}`, undefined], ['put', `/api/properties/${id}/status`, { status: 'Under Negotiation' }], ['put', `/api/enquiries/${enquiry}/status`, { status: 'In Progress' }]]) {
    const r = await api(method, url, tokens.agent2, body, 403); assert.equal(r.body.errorCode, 'NOT_OWNER');
  }
  const other = await api('get', `/api/enquiries?propertyId=${id}`, tokens.agent2, undefined, 200);
  assert.equal(other.body.data.pagination.total, 0);
  await api('get', `/api/properties/mine?agentId=${users.agent}`, tokens.agent2, undefined, 400);
});

test('Combined filters are conjunctive, normalized, paginated and injection-resistant', async () => {
  const city = 'filter-city';
  const chosen = await createProperty({ city: 'FILTER-CITY', price: 2000000, bedrooms: 2 });
  await createProperty({ city, price: 9000000, bedrooms: 2 });
  await createProperty({ city, price: 2000000, bedrooms: 3 });
  await createProperty({ city, price: 2000000, bedrooms: 2 }, 'agent', false);
  const response = await api('get', `/api/properties/search?city=${city}&type=Apartment&minPrice=1900000&maxPrice=2100000&bedrooms=2&sort=price_asc&limit=1`, null, undefined, 200);
  assert.equal(response.body.data.pagination.total, 1);
  assert.equal(response.body.data.items[0]._id, chosen);
  for (const query of ['minPrice=4&maxPrice=2', 'bedrooms=2&bedrooms=3', 'city[$ne]=x', 'page=0', 'sort=$where']) await api('get', `/api/properties/search?${query}`, null, undefined, 400);
});

test('Concurrent bookmark and enquiry submissions create exactly one record', async () => {
  const id = await createProperty();
  const favouriteResults = await Promise.all(Array.from({ length: 4 }, () => api('post', '/api/favourites', tokens.buyer, { propertyId: id })));
  assert.deepEqual(favouriteResults.map(r => r.status).sort(), [201, 409, 409, 409]);
  assert.equal(await Favourite.countDocuments({ propertyId: id, userId: users.buyer }), 1);
  const enquiryResults = await Promise.all(Array.from({ length: 4 }, () => api('post', '/api/enquiries', tokens.buyer, { propertyId: id, message: 'Please schedule a visit next weekend.' })));
  assert.deepEqual(enquiryResults.map(r => r.status).sort(), [201, 409, 409, 409]);
  assert.equal(await Enquiry.countDocuments({ propertyId: id, buyerId: users.buyer }), 1);
});

test('Concurrent status requests cannot apply the same transition twice', async () => {
  const id = await createProperty();
  const responses = await Promise.all(Array.from({ length: 4 }, () => api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Under Negotiation' })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409, 409, 409]);
  assert.equal((await Property.findById(id)).status, 'Under Negotiation');
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Sold' }, 200);
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Available' }, 409);
});

test('Concurrent deletion and enquiry cannot leave an active lead on an archived property', async () => {
  const id = await createProperty();
  const results = await Promise.all([
    api('delete', `/api/properties/${id}`, tokens.agent),
    api('post', '/api/enquiries', tokens.tenant, { propertyId: id, message: 'Please schedule a visit next week.' })
  ]);
  const property = await Property.findById(id);
  const count = await Enquiry.countDocuments({ propertyId: id });
  if (property.isDeleted) { assert.equal(count, 0); assert.deepEqual(results.map(r => r.status), [200, 404]); }
  else { assert.equal(count, 1); assert.deepEqual(results.map(r => r.status), [409, 201]); }
});

test('Soft deletion preserves enquiry, rating and bookmark references after closure', async () => {
  const id = await createProperty({}, 'agent2');
  const enquiryId = await createEnquiry(id, 'buyer2');
  const fav = await api('post', '/api/favourites', tokens.buyer2, { propertyId: id }, 201);
  await api('put', `/api/enquiries/${enquiryId}/status`, tokens.agent2, { status: 'Rejected', remarks: 'Property does not meet buyer requirements.' }, 200);
  await api('put', `/api/enquiries/${enquiryId}/status`, tokens.agent2, { status: 'Closed', remarks: 'Buyer informed and enquiry resolved.' }, 200);
  await api('post', `/api/agents/${users.agent2}/ratings`, tokens.buyer2, { enquiryId, score: 4, comment: 'Helpful explanation.' }, 201);
  await api('delete', `/api/properties/${id}`, tokens.agent2, undefined, 200);
  assert.equal((await Property.findById(id)).isDeleted, true);
  assert.equal((await Enquiry.findById(enquiryId)).propertyId.toString(), id);
  assert.equal(await Rating.countDocuments({ enquiryId }), 1);
  assert.ok(await Favourite.findById(fav.body.data.favourite._id));
  await api('get', `/api/properties/${id}`, null, undefined, 404);
  await api('delete', `/api/favourites/${fav.body.data.favourite._id}`, tokens.buyer2, undefined, 200);
});

test('Sale/rent state machine enforces both terminal states and locks listing purpose', async () => {
  const id = await createProperty({ listingFor: 'Rent', price: 20000 });
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Rented' }, 409);
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Under Negotiation' }, 200);
  await api('put', `/api/properties/${id}`, tokens.agent, { listingFor: 'Sale' }, 409);
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Sold' }, 409);
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Rented' }, 200);
  await api('post', '/api/enquiries', tokens.tenant, { propertyId: id, message: 'Please arrange a visit for me.' }, 409);
  await api('put', `/api/properties/${id}/status`, tokens.agent, { status: 'Available' }, 409);
});

test('Aggregation includes agents with zero listings and computes counts in the database', async () => {
  const empty = await api('post', '/api/auth/register', null, { name: 'Zero listing agent', email: 'zero@p09.test', password, role: 'agent' }, 201);
  const response = await api('get', '/api/admin/reports/agent-performance?limit=100', tokens.admin, undefined, 200);
  const zero = response.body.data.items.find(r => r.agentId === empty.body.data.user._id);
  assert.equal(zero.listingsCount, 0); assert.equal(zero.enquiriesReceived, 0); assert.equal(zero.conversionRatePercent, 0);
  const row = response.body.data.items.find(r => r.agentId === users.agent);
  const properties = await Property.find({ agentId: users.agent });
  const sold = properties.filter(p => ['Sold', 'Rented'].includes(p.status)).length;
  assert.equal(row.listingsCount, properties.length);
  assert.equal(row.conversionRatePercent, Math.round(sold / properties.length * 10000) / 100);
  const report = await api('get', '/api/admin/reports/top-properties', tokens.admin, undefined, 200);
  assert.ok(report.body.data.items.length > 0);
});

test('Unknown bodies, primitive JSON, non-JSON, malformed JSON and oversized bodies are clean 400 errors', async () => {
  const beforeCount = await Property.countDocuments();
  await api('post', '/api/properties', tokens.agent, { ...listing(), agentId: users.agent2 }, 400);
  await api('get', '/api/properties/search', null, { unexpected: true }, 400);
  for (const raw of ['{bad', 'null', '[1,2,3]']) {
    const result = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(raw);
    assert.equal(result.status, 400); assert.equal(result.body.success, false);
  }
  const oversized = await request(app).post('/api/auth/login').send({ data: 'x'.repeat(66000) });
  assert.equal(oversized.status, 400); assert.equal(oversized.body.errorCode, 'BODY_TOO_LARGE');
  const text = await request(app).post('/api/auth/login').type('text').send('hello');
  assert.equal(text.status, 400); assert.equal(text.body.errorCode, 'UNSUPPORTED_CONTENT_TYPE');
  assert.equal(await Property.countDocuments(), beforeCount);
});

test('Database unique indexes exist on required reference and identity fields', async () => {
  const ui = await User.collection.indexes();
  assert.ok(ui.some(i => i.key.email === 1 && i.unique));
  assert.ok((await Property.collection.indexes()).some(i => i.key.agentId === 1));
  assert.ok((await Enquiry.collection.indexes()).some(i => i.key.propertyId === 1));
  const fi = await Favourite.collection.indexes();
  assert.ok(fi.some(i => i.key.userId === 1));
  assert.ok(fi.some(i => i.key.userId === 1 && i.key.propertyId === 1 && i.unique));
});

test('Unexpected async exceptions reach the centralized JSON error handler without leaking internals', async () => {
  const express = require('express');
  const probe = express();
  probe.get('/probe', async () => { throw new Error('sensitive-internal-detail'); });
  probe.use(require('../middleware/errorHandler'));
  const response = await request(probe).get('/probe');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { success: false, message: 'An unexpected server error occurred.', errorCode: 'INTERNAL_ERROR' });
  assert.equal(response.text.includes('sensitive-internal-detail'), false);
  await api('get', '/api/health', null, undefined, 200);
});

test('Documented admin seed and server entry point work; seed refuses role elevation', { timeout: 60000 }, async () => {
  const fs = require('node:fs');
  const os = require('node:os');
  const path = require('node:path');
  const { spawn, execFile } = require('node:child_process');
  const { promisify } = require('node:util');
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'p09-cli-'));
  const childEnvFile = path.join(directory, '.env');
  const config = fs.readFileSync(process.env.ENV_FILE, 'utf8').replace(/^PORT=.*$/m, 'PORT=0');
  fs.writeFileSync(childEnvFile, config, { mode: 0o600 });
  const options = { cwd: path.join(__dirname, '..'), env: { ...process.env, ENV_FILE: childEnvFile, MONGO_URI: 'invalid-inherited-value-must-be-overridden' }, timeout: 20000 };
  let child;
  try {
    const seeded = await promisify(execFile)(process.execPath, ['scripts/seed-admin.js'], options);
    assert.match(seeded.stdout, /Admin already exists/);
    child = spawn(process.execPath, ['server.js'], { cwd: options.cwd, env: options.env, stdio: ['ignore', 'pipe', 'pipe'] });
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Server startup timed out')), 20000);
      let output = '';
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        const match = /P09 API listening on port (\d+)/.exec(output);
        if (match) { clearTimeout(timer); resolve(Number(match[1])); }
      });
      child.once('error', error => { clearTimeout(timer); reject(error); });
      child.once('exit', code => { clearTimeout(timer); if (code) reject(new Error('Server exited before readiness')); });
    });
    const response = await fetch(`http://127.0.0.1:${port}/api/health`);
    assert.equal(response.status, 200);
    assert.equal((await response.json()).data.database, 'connected');
    fs.writeFileSync(childEnvFile, config.replace(/^ADMIN_EMAIL=.*$/m, 'ADMIN_EMAIL=buyer@p09.test'), { mode: 0o600 });
    await assert.rejects(promisify(execFile)(process.execPath, ['scripts/seed-admin.js'], options), error => error.code === 1);
    assert.equal((await User.findById(users.buyer)).role, 'buyer');
  } finally {
    if (child && child.exitCode === null) {
      await new Promise(resolve => { child.once('exit', resolve); child.kill('SIGTERM'); });
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
