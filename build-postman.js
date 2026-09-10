const fs = require('node:fs');
const path = require('node:path');
const folders = [];
let folder;
function group(name) { folder = { name, item: [] }; folders.push(folder); }
function add(name, method, url, status, body, token, extra = [], save = {}, errorCode) {
  const tests = [
    `pm.test('HTTP ${status}', () => pm.response.to.have.status(${status}));`,
    "pm.test('JSON content type', () => pm.expect(pm.response.headers.get('Content-Type')).to.include('application/json'));",
    'const json = pm.response.json();',
    `pm.test('Consistent response envelope', () => { pm.expect(json.success).to.eql(${status < 400}); pm.expect(json.message).to.be.a('string').and.not.empty; pm.expect(json).to.have.all.keys(${status < 400 ? "'success', 'message', 'data'" : "'success', 'message', 'errorCode'"}); ${status < 400 ? "pm.expect(json.data).to.be.an('object');" : "pm.expect(json.errorCode).to.be.a('string').and.not.empty;"} });`,
    "pm.test('No credential or stack leakage', () => { pm.expect(pm.response.text()).not.to.include('passwordHash'); pm.expect(json).not.to.have.property('stack'); });"
  ];
  if (errorCode) tests.push(`pm.test('Expected error code', () => pm.expect(json.errorCode).to.eql('${errorCode}'));`);
  for (const [key, accessor] of Object.entries(save)) tests.push(`if (pm.response.code === ${status} && json.success) pm.collectionVariables.set('${key}', ${accessor});`);
  tests.push(...extra);
  const item = { name, request: { method, header: [], auth: token ? { type: 'bearer', bearer: [{ key: 'token', value: token.includes('{{') ? token : `{{${token}}}`, type: 'string' }] } : { type: 'noauth' }, url: `{{baseUrl}}${url}`, description: `Expected HTTP ${status}. Run the complete collection in order; earlier requests create its prerequisites.` }, event: [{ listen: 'test', script: { type: 'text/javascript', exec: tests } }] };
  if (body !== undefined) { item.request.header.push({ key: 'Content-Type', value: 'application/json' }); item.request.body = { mode: 'raw', raw: JSON.stringify(body, null, 2), options: { raw: { language: 'json' } } }; }
  folder.item.push(item);
  return item;
}
const missing = '000000000000000000000001';
const main = '/api/properties/{{propertyId}}';
const emptyItems = ["pm.test('No private/foreign items exposed', () => pm.expect(json.data.items).to.have.lengthOf(0));"];
const propertyBody = (title = 'Kengeri Garden Apartment', listingFor = 'Sale') => ({ title, type: 'Apartment', listingFor, price: listingFor === 'Sale' ? 7500000 : 25000, city: '{{demoCity}}', locality: 'kengeri', bedrooms: 2, images: ['https://example.com/property.jpg'], description: 'A two-bedroom property used for the CIA-3 API demonstration.' });

group('01 — Health and run initialization');
const health = add('API health; initialize unique demo accounts', 'GET', '/api/health', 200);
health.event.unshift({ listen: 'prerequest', script: { type: 'text/javascript', exec: [
  "const runId = pm.variables.replaceIn('{{$guid}}').replace(/-/g, '');",
  "pm.collectionVariables.set('runId', runId);",
  "pm.collectionVariables.set('demoCity', 'democity-' + runId);",
  "pm.collectionVariables.set('demoPassword', pm.variables.replaceIn('{{$guid}}') + 'Aa7!');",
  "pm.collectionVariables.set('invalidToken', 'this-is-not-a-jwt');",
  "['buyer','buyer2','tenant','agent','agent2'].forEach(role => pm.collectionVariables.set(role + 'Email', role + '.' + runId + '@p09.test'));"
] } });
add('Health rejects unexpected query', 'GET', '/api/health?unexpected=true', 400, undefined, null, [], {}, 'VALIDATION_ERROR');
add('Unknown endpoint returns JSON 404', 'GET', '/api/does-not-exist', 404, undefined, null, [], {}, 'ROUTE_NOT_FOUND');

group('02 — Registration, login and JWT');
for (const role of ['buyer', 'buyer2', 'tenant', 'agent', 'agent2']) {
  add(`Register ${role}`, 'POST', '/api/auth/register', 201, { name: `Demo ${role}`, email: `{{${role}Email}}`, password: '{{demoPassword}}', role: role.replace('2', '') }, null, [], { [`${role}Id`]: 'json.data.user._id' });
}
add('Public admin registration blocked', 'POST', '/api/auth/register', 400, { name: 'Blocked admin', email: 'blocked@p09.test', password: '{{demoPassword}}', role: 'admin' }, null, [], {}, 'VALIDATION_ERROR');
add('Registration rejects weak password', 'POST', '/api/auth/register', 400, { name: 'Weak user', email: 'weak@p09.test', password: 'short', role: 'buyer' }, null, [], {}, 'VALIDATION_ERROR');
add('Registration rejects unknown privilege field', 'POST', '/api/auth/register', 400, { name: 'Flag spoof', email: 'spoof@p09.test', password: '{{demoPassword}}', role: 'agent', isAgentVerified: true }, null, [], {}, 'VALIDATION_ERROR');
add('Duplicate email conflicts', 'POST', '/api/auth/register', 409, { name: 'Duplicate', email: '{{buyerEmail}}', password: '{{demoPassword}}', role: 'buyer' }, null, [], {}, 'DUPLICATE_RECORD');
for (const role of ['buyer', 'buyer2', 'tenant', 'agent', 'agent2']) {
  add(`Login ${role}; save token`, 'POST', '/api/auth/login', 200, { email: `{{${role}Email}}`, password: '{{demoPassword}}' }, null, [], { [`${role}Token`]: 'json.data.token' });
}
const adminLogin = add('Login seeded admin; save token', 'POST', '/api/auth/login', 200, { email: '{{adminEmail}}', password: '{{adminPassword}}' }, null, [], { adminToken: 'json.data.token', adminId: 'json.data.user._id' });
adminLogin.event.unshift({ listen: 'prerequest', script: { type: 'text/javascript', exec: ["if (!pm.environment.get('adminEmail') || !pm.environment.get('adminPassword')) throw new Error('Set adminEmail and adminPassword in the selected P09 environment to match your seeded admin.');"] } });
add('Login rejects wrong password', 'POST', '/api/auth/login', 401, { email: '{{buyerEmail}}', password: 'IncorrectPassword91!' }, null, [], {}, 'INVALID_CREDENTIALS');
add('Login validates email', 'POST', '/api/auth/login', 400, { email: 'not-an-email', password: '{{demoPassword}}' }, null, [], {}, 'VALIDATION_ERROR');
add('Inspect authenticated account', 'GET', '/api/auth/me', 200, undefined, 'buyerToken');
add('No token rejected', 'GET', '/api/auth/me', 401, undefined, null, [], {}, 'UNAUTHORIZED');
add('Invalid JWT rejected', 'GET', '/api/auth/me', 401, undefined, 'invalidToken', [], {}, 'INVALID_TOKEN');

group('03 — Listing ownership and verification gate');
add('Agent creates pending sale listing', 'POST', '/api/properties', 201, propertyBody(), 'agentToken', ["pm.test('Starts pending and Available', () => { pm.expect(json.data.property.isVerified).to.eql(false); pm.expect(json.data.property.status).to.eql('Available'); });"], { propertyId: 'json.data.property._id' });
add('Agent creates rent listing', 'POST', '/api/properties', 201, propertyBody('Kengeri Rental Apartment', 'Rent'), 'agentToken', [], { rentId: 'json.data.property._id' });
add('Agent creates disposable listing', 'POST', '/api/properties', 201, propertyBody('Listing for delete demonstration'), 'agentToken', [], { deleteId: 'json.data.property._id' });
add('Second agent creates own listing', 'POST', '/api/properties', 201, propertyBody('Another agent listing'), 'agent2Token', [], { otherPropertyId: 'json.data.property._id' });
add('Create requires token', 'POST', '/api/properties', 401, propertyBody(), null);
add('Buyer cannot create listings', 'POST', '/api/properties', 403, propertyBody(), 'buyerToken', [], {}, 'FORBIDDEN_ROLE');
add('Create validates positive price', 'POST', '/api/properties', 400, { ...propertyBody(), price: -1 }, 'agentToken', [], {}, 'VALIDATION_ERROR');
add('Agent cannot self-verify in create body', 'POST', '/api/properties', 400, { ...propertyBody(), isVerified: true }, 'agentToken', [], {}, 'VALIDATION_ERROR');
add('Pending listing absent from public search', 'GET', '/api/properties/search?city={{demoCity}}', 200, undefined, null, emptyItems);
add('Pending listing absent from detail', 'GET', main, 404, undefined, null, [], {}, 'PROPERTY_NOT_FOUND');
add('Pending listing absent from city browsing', 'GET', '/api/properties/city/{{demoCity}}', 200, undefined, null, emptyItems);
add('Pending listing absent from location groups', 'GET', '/api/properties/locations?city={{demoCity}}', 200, undefined, null, emptyItems);
add('Pending listing cannot be favourited', 'POST', '/api/favourites', 409, { propertyId: '{{propertyId}}' }, 'buyerToken', [], {}, 'PROPERTY_NOT_PUBLIC');
add('Pending listing cannot receive enquiry', 'POST', '/api/enquiries', 409, { propertyId: '{{propertyId}}', message: 'I would like to arrange a visit.' }, 'buyerToken', [], {}, 'PROPERTY_NOT_PUBLIC');
add('Pending listing cannot change status', 'PUT', `${main}/status`, 409, { status: 'Under Negotiation' }, 'agentToken', [], {}, 'PROPERTY_NOT_PUBLIC');
add('Agent sees own pending listings', 'GET', '/api/properties/mine', 200, undefined, 'agentToken', ["pm.test('Exactly own three listings', () => { pm.expect(json.data.pagination.total).to.eql(3); pm.expect(json.data.items.every(p => p.agentId === pm.collectionVariables.get('agentId'))).to.eql(true); });"]);
add('Buyer cannot access agent listing list', 'GET', '/api/properties/mine', 403, undefined, 'buyerToken');
add('Listing cannot verify before agent approval', 'PUT', `${main}/verify`, 409, {}, 'adminToken', [], {}, 'AGENT_NOT_VERIFIED');
add('Buyer cannot verify agent', 'PUT', '/api/admin/agents/{{agentId}}/verify', 403, {}, 'buyerToken');
add('Agent verification needs admin JWT', 'PUT', '/api/admin/agents/{{agentId}}/verify', 401, {});
add('Agent verification rejects missing agent', 'PUT', `/api/admin/agents/${missing}/verify`, 404, {}, 'adminToken');
add('Admin verifies agent', 'PUT', '/api/admin/agents/{{agentId}}/verify', 200, {}, 'adminToken');
add('Repeated agent approval conflicts', 'PUT', '/api/admin/agents/{{agentId}}/verify', 409, {}, 'adminToken', [], {}, 'ALREADY_VERIFIED');
add('Admin verifies second agent', 'PUT', '/api/admin/agents/{{agent2Id}}/verify', 200, {}, 'adminToken');
add('Agent cannot verify own listing', 'PUT', `${main}/verify`, 403, {}, 'agentToken');
add('Verification validates ID', 'PUT', '/api/properties/invalid/verify', 400, {}, 'adminToken');
add('Verification rejects missing listing', 'PUT', `/api/properties/${missing}/verify`, 404, {}, 'adminToken');
add('Admin verifies sale listing', 'PUT', `${main}/verify`, 200, {}, 'adminToken');
add('Repeated listing verification conflicts', 'PUT', `${main}/verify`, 409, {}, 'adminToken', [], {}, 'NOT_PENDING');
add('Admin verifies rent listing', 'PUT', '/api/properties/{{rentId}}/verify', 200, {}, 'adminToken');
add('Read public property details', 'GET', main, 200);

group('04 — Combined search and location grouping');
add('Combine city, price, type, bedrooms and sale/rent', 'GET', '/api/properties/search?city={{demoCity}}&minPrice=7000000&maxPrice=8000000&type=Apartment&bedrooms=2&listingFor=Sale&sort=price_asc', 200, undefined, null, ["pm.test('Only matching verified listing', () => { pm.expect(json.data.items).to.have.lengthOf(1); pm.expect(json.data.items[0]._id).to.eql(pm.collectionVariables.get('propertyId')); });"]);
add('Nonmatching bedrooms returns empty success', 'GET', '/api/properties/search?city={{demoCity}}&bedrooms=6', 200, undefined, null, emptyItems);
add('Invalid price range rejected', 'GET', '/api/properties/search?minPrice=100&maxPrice=1', 400, undefined, null, [], {}, 'VALIDATION_ERROR');
add('Operator injection query rejected', 'GET', '/api/properties/search?price[$gt]=0', 400);
add('Invalid pagination rejected', 'GET', '/api/properties/search?limit=9999', 400);
add('Browse verified city listings', 'GET', '/api/properties/city/{{demoCity}}', 200, undefined, null, ["pm.test('Two public listings', () => pm.expect(json.data.pagination.total).to.eql(2));"]);
add('City browse validates filters', 'GET', '/api/properties/city/{{demoCity}}?bedrooms=-2', 400);
add('Group by city', 'GET', '/api/properties/locations?city={{demoCity}}&groupBy=city', 200, undefined, null, ["pm.test('City has two listings', () => pm.expect(json.data.items[0].listingsCount).to.eql(2));"]);
add('Group by locality', 'GET', '/api/properties/locations?city={{demoCity}}&groupBy=locality', 200, undefined, null, ["pm.test('Locality grouping', () => pm.expect(json.data.items[0].locality).to.eql('kengeri'));"]);
add('Invalid location grouping rejected', 'GET', '/api/properties/locations?groupBy=country', 400);

group('05 — Editing and deletion enforce ownership');
add('Second agent cannot edit first agent listing', 'PUT', main, 403, { price: 7600000 }, 'agent2Token', [], {}, 'NOT_OWNER');
add('Buyer cannot edit listing', 'PUT', main, 403, { price: 7600000 }, 'buyerToken');
add('Update rejects status privilege injection', 'PUT', main, 400, { status: 'Sold' }, 'agentToken');
add('Empty update rejected', 'PUT', main, 400, {}, 'agentToken');
add('Missing listing update returns 404', 'PUT', `/api/properties/${missing}`, 404, { price: 1000 }, 'agentToken');
add('Owner updates listing', 'PUT', main, 200, { price: 7600000 }, 'agentToken', ["pm.test('Edit resets verification', () => { pm.expect(json.data.property.isVerified).to.eql(false); pm.expect(json.data.property.reviewStatus).to.eql('Pending'); });"]);
add('Edited listing immediately disappears from detail', 'GET', main, 404);
add('Admin re-verifies edited listing', 'PUT', `${main}/verify`, 200, {}, 'adminToken');
add('Nonowner cannot delete listing', 'DELETE', '/api/properties/{{deleteId}}', 403, undefined, 'agent2Token', [], {}, 'NOT_OWNER');
add('Buyer cannot delete listing', 'DELETE', '/api/properties/{{deleteId}}', 403, undefined, 'buyerToken');
add('Delete validates ID', 'DELETE', '/api/properties/invalid', 400, undefined, 'agentToken');
add('Owner deletes unused listing', 'DELETE', '/api/properties/{{deleteId}}', 200, undefined, 'agentToken');
add('Repeated delete returns 404', 'DELETE', '/api/properties/{{deleteId}}', 404, undefined, 'agentToken');

group('06 — Saved properties and user isolation');
add('Buyer saves verified property', 'POST', '/api/favourites', 201, { propertyId: '{{propertyId}}' }, 'buyerToken', [], { favouriteId: 'json.data.favourite._id' });
add('Duplicate bookmark conflicts', 'POST', '/api/favourites', 409, { propertyId: '{{propertyId}}' }, 'buyerToken', [], {}, 'DUPLICATE_RECORD');
add('Bookmark requires authentication', 'POST', '/api/favourites', 401, { propertyId: '{{propertyId}}' });
add('Agent cannot bookmark', 'POST', '/api/favourites', 403, { propertyId: '{{propertyId}}' }, 'agentToken');
add('Bookmark validates property ID', 'POST', '/api/favourites', 400, { propertyId: 'invalid' }, 'buyerToken');
add('Missing property cannot be bookmarked', 'POST', '/api/favourites', 404, { propertyId: missing }, 'buyerToken');
add('List own favourites', 'GET', '/api/favourites', 200, undefined, 'buyerToken', ["pm.test('Saved listing populated', () => pm.expect(json.data.items[0].propertyId._id).to.eql(pm.collectionVariables.get('propertyId')));"]);
add('Another buyer has no access to saved items', 'GET', '/api/favourites', 200, undefined, 'buyer2Token', emptyItems);
add('Favourites list requires JWT', 'GET', '/api/favourites', 401);
add('Cannot override favourites owner in query', 'GET', '/api/favourites?userId={{buyerId}}', 400, undefined, 'buyer2Token');
add('Another buyer cannot remove favourite', 'DELETE', '/api/favourites/{{favouriteId}}', 403, undefined, 'buyer2Token', [], {}, 'NOT_OWNER');
add('Missing favourite removal returns 404', 'DELETE', `/api/favourites/${missing}`, 404, undefined, 'buyerToken');
add('Owner removes favourite by favourite ID', 'DELETE', '/api/favourites/{{favouriteId}}', 200, undefined, 'buyerToken');
add('Save again for moderation visibility check', 'POST', '/api/favourites', 201, { propertyId: '{{propertyId}}' }, 'buyerToken', [], { favouriteId: 'json.data.favourite._id' });
add('Tenant can save property', 'POST', '/api/favourites', 201, { propertyId: '{{rentId}}' }, 'tenantToken', [], { tenantFavouriteId: 'json.data.favourite._id' });

group('07 — Enquiry submission and agent lead workflow');
add('Buyer submits enquiry', 'POST', '/api/enquiries', 201, { propertyId: '{{propertyId}}', message: 'I would like a viewing this weekend.' }, 'buyerToken', [], { enquiryId: 'json.data.enquiry._id' });
add('Duplicate enquiry conflicts', 'POST', '/api/enquiries', 409, { propertyId: '{{propertyId}}', message: 'I would like another viewing this weekend.' }, 'buyerToken', [], {}, 'DUPLICATE_RECORD');
add('Tenant submits separate enquiry', 'POST', '/api/enquiries', 201, { propertyId: '{{propertyId}}', message: 'Please provide details of this listing.' }, 'tenantToken', [], { tenantEnquiryId: 'json.data.enquiry._id' });
add('Submission requires JWT', 'POST', '/api/enquiries', 401, { propertyId: '{{propertyId}}', message: 'Please arrange a property visit.' });
add('Agent cannot submit buyer enquiry', 'POST', '/api/enquiries', 403, { propertyId: '{{propertyId}}', message: 'Please arrange a property visit.' }, 'agentToken');
add('Short enquiry rejected', 'POST', '/api/enquiries', 400, { propertyId: '{{propertyId}}', message: 'Hi' }, 'buyerToken');
add('Nonexistent property enquiry returns 404', 'POST', '/api/enquiries', 404, { propertyId: missing, message: 'Please arrange a property visit.' }, 'buyerToken');
add('Buyer views own enquiry', 'GET', '/api/enquiries/mine', 200, undefined, 'buyerToken', ["pm.test('Only own enquiry', () => { pm.expect(json.data.items).to.have.lengthOf(1); pm.expect(json.data.items[0].buyerId).to.eql(pm.collectionVariables.get('buyerId')); });"]);
add('Agent cannot use buyer enquiry endpoint', 'GET', '/api/enquiries/mine', 403, undefined, 'agentToken');
add('Owner sees two leads', 'GET', '/api/enquiries?propertyId={{propertyId}}&status=New', 200, undefined, 'agentToken', ["pm.test('Both enquiries reach listing agent', () => pm.expect(json.data.pagination.total).to.eql(2));"]);
add('Other agent sees no foreign leads', 'GET', '/api/enquiries?propertyId={{propertyId}}', 200, undefined, 'agent2Token', emptyItems);
add('Buyer cannot read agent lead endpoint', 'GET', '/api/enquiries', 403, undefined, 'buyerToken');
add('Lead list requires JWT', 'GET', '/api/enquiries', 401);
add('Lead list rejects invalid status filter', 'GET', '/api/enquiries?status=Invalid', 400, undefined, 'agentToken');
add('Another agent cannot change lead', 'PUT', '/api/enquiries/{{enquiryId}}/status', 403, { status: 'In Progress' }, 'agent2Token', [], {}, 'NOT_OWNER');
add('Buyer cannot change lead status', 'PUT', '/api/enquiries/{{enquiryId}}/status', 403, { status: 'In Progress' }, 'buyerToken');
add('Missing lead returns 404', 'PUT', `/api/enquiries/${missing}/status`, 404, { status: 'In Progress' }, 'agentToken');
add('Invalid lead state rejected', 'PUT', '/api/enquiries/{{enquiryId}}/status', 400, { status: 'Done' }, 'agentToken');
add('Cannot skip from New to Closed', 'PUT', '/api/enquiries/{{enquiryId}}/status', 409, { status: 'Closed', remarks: 'Trying an invalid shortcut.' }, 'agentToken', [], {}, 'INVALID_STATUS_TRANSITION');
add('Cannot rate before enquiry closure', 'POST', '/api/agents/{{agentId}}/ratings', 409, { enquiryId: '{{enquiryId}}', score: 5 }, 'buyerToken', [], {}, 'ENQUIRY_NOT_CLOSED');
add('Agent begins lead work', 'PUT', '/api/enquiries/{{enquiryId}}/status', 200, { status: 'In Progress', remarks: 'Viewing has been scheduled.' }, 'agentToken');
add('Repeated lead transition conflicts', 'PUT', '/api/enquiries/{{enquiryId}}/status', 409, { status: 'In Progress' }, 'agentToken');
add('Cannot delete listing while enquiries are open', 'DELETE', main, 409, undefined, 'agentToken', [], {}, 'OPEN_ENQUIRIES');
add('Agent approves lead', 'PUT', '/api/enquiries/{{enquiryId}}/status', 200, { status: 'Approved', remarks: 'Buyer accepted the proposed terms.' }, 'agentToken');
add('Closure requires remarks', 'PUT', '/api/enquiries/{{enquiryId}}/status', 400, { status: 'Closed' }, 'agentToken');
add('Agent closes approved lead', 'PUT', '/api/enquiries/{{enquiryId}}/status', 200, { status: 'Closed', remarks: 'Viewing and enquiry handling completed.' }, 'agentToken', ["pm.test('Status history retains four steps', () => pm.expect(json.data.enquiry.statusHistory).to.have.lengthOf(4));"]);
add('Closed lead cannot reopen', 'PUT', '/api/enquiries/{{enquiryId}}/status', 409, { status: 'In Progress' }, 'agentToken');
add('Agent rejects second lead with reason', 'PUT', '/api/enquiries/{{tenantEnquiryId}}/status', 200, { status: 'Rejected', remarks: 'Buyer requirements do not match this property.' }, 'agentToken');
add('Agent closes rejected lead', 'PUT', '/api/enquiries/{{tenantEnquiryId}}/status', 200, { status: 'Closed', remarks: 'Buyer was informed and enquiry is resolved.' }, 'agentToken');

group('08 — Profiles and post-enquiry ratings');
add('Public agent profile', 'GET', '/api/agents/{{agentId}}/profile', 200, undefined, null, ["pm.test('Only verified listings counted; no private email', () => { pm.expect(json.data.listingsCount).to.eql(2); pm.expect(json.data.agent).not.to.have.property('email'); });"]);
add('Missing agent profile returns 404', 'GET', `/api/agents/${missing}/profile`, 404);
add('Profile validates ObjectId', 'GET', '/api/agents/bad-id/profile', 400);
add('Rating missing agent returns 404', 'POST', `/api/agents/${missing}/ratings`, 404, { enquiryId: '{{enquiryId}}', score: 5 }, 'buyerToken', [], {}, 'AGENT_NOT_FOUND');
add('Rating missing enquiry returns 404', 'POST', '/api/agents/{{agentId}}/ratings', 404, { enquiryId: missing, score: 5 }, 'buyerToken', [], {}, 'ENQUIRY_NOT_FOUND');
add('Another buyer cannot rate using this enquiry', 'POST', '/api/agents/{{agentId}}/ratings', 403, { enquiryId: '{{enquiryId}}', score: 5 }, 'buyer2Token', [], {}, 'NOT_OWNER');
add('Cannot rate a different agent using this enquiry', 'POST', '/api/agents/{{agent2Id}}/ratings', 409, { enquiryId: '{{enquiryId}}', score: 5 }, 'buyerToken', [], {}, 'AGENT_ENQUIRY_MISMATCH');
add('Rating score must be an integer from 1 to 5', 'POST', '/api/agents/{{agentId}}/ratings', 400, { enquiryId: '{{enquiryId}}', score: 6 }, 'buyerToken');
add('Rating requires JWT', 'POST', '/api/agents/{{agentId}}/ratings', 401, { enquiryId: '{{enquiryId}}', score: 5 });
add('Agent cannot rate agent', 'POST', '/api/agents/{{agentId}}/ratings', 403, { enquiryId: '{{enquiryId}}', score: 5 }, 'agentToken');
add('Buyer rates agent after closed enquiry', 'POST', '/api/agents/{{agentId}}/ratings', 201, { enquiryId: '{{enquiryId}}', score: 5, comment: 'Clear communication and a useful property viewing.' }, 'buyerToken');
add('Duplicate buyer-agent rating conflicts', 'POST', '/api/agents/{{agentId}}/ratings', 409, { enquiryId: '{{enquiryId}}', score: 4 }, 'buyerToken', [], {}, 'DUPLICATE_RECORD');
add('Tenant rates after resolved enquiry', 'POST', '/api/agents/{{agentId}}/ratings', 201, { enquiryId: '{{tenantEnquiryId}}', score: 3, comment: 'The listing was not suitable, but the agent explained it.' }, 'tenantToken');
add('Profile aggregates ratings correctly', 'GET', '/api/agents/{{agentId}}/profile', 200, undefined, null, ["pm.test('Average is 4 from two distinct users', () => { pm.expect(json.data.ratings.average).to.eql(4); pm.expect(json.data.ratings.count).to.eql(2); });"]);

group('09 — Flags, moderation and visibility across reads');
add('Buyer flags misleading listing', 'POST', `${main}/flag`, 200, { reason: 'The listing information needs an accuracy review.' }, 'buyerToken');
add('Duplicate flag conflicts', 'POST', `${main}/flag`, 409, { reason: 'The listing information needs an accuracy review.' }, 'tenantToken', [], {}, 'ALREADY_FLAGGED');
add('Flag requires meaningful reason', 'POST', '/api/properties/{{rentId}}/flag', 400, { reason: 'Bad' }, 'buyerToken');
add('Agent cannot flag listings', 'POST', '/api/properties/{{rentId}}/flag', 403, { reason: 'The listing requires further review.' }, 'agentToken');
add('Flag missing property returns 404', 'POST', `/api/properties/${missing}/flag`, 404, { reason: 'The listing requires further review.' }, 'buyerToken');
add('Flagged listing hidden from detail', 'GET', main, 404);
add('Flagged listing hidden from sale search', 'GET', '/api/properties/search?city={{demoCity}}&listingFor=Sale', 200, undefined, null, emptyItems);
add('Favourites do not expose flagged property', 'GET', '/api/favourites', 200, undefined, 'buyerToken', ["pm.test('Hidden listing represented by null', () => pm.expect(json.data.items[0].propertyId).to.eql(null));"]);
add('Flagged listing refuses new enquiry', 'POST', '/api/enquiries', 409, { propertyId: '{{propertyId}}', message: 'Please arrange a viewing for me.' }, 'buyer2Token', [], {}, 'PROPERTY_NOT_PUBLIC');
add('Admin reviews flagged queue', 'GET', '/api/admin/moderation?view=flagged', 200, undefined, 'adminToken', ["pm.test('Flag is in queue', () => pm.expect(json.data.listings.items.some(p => p._id === pm.collectionVariables.get('propertyId'))).to.eql(true));"]);
add('Agent cannot read admin dashboard', 'GET', '/api/admin/moderation', 403, undefined, 'agentToken');
add('Admin dashboard needs token', 'GET', '/api/admin/moderation', 401);
add('Dashboard validates queue filter', 'GET', '/api/admin/moderation?view=invalid', 400, undefined, 'adminToken');
add('Buyer cannot moderate', 'PUT', '/api/admin/moderation/{{propertyId}}', 403, { action: 'unflag' }, 'buyerToken');
add('Moderation validates action', 'PUT', '/api/admin/moderation/{{propertyId}}', 400, { action: 'erase' }, 'adminToken');
add('Moderation missing property returns 404', 'PUT', `/api/admin/moderation/${missing}`, 404, { action: 'unflag' }, 'adminToken');
add('Admin clears reviewed flag', 'PUT', '/api/admin/moderation/{{propertyId}}', 200, { action: 'unflag' }, 'adminToken');
add('Unflagging twice conflicts', 'PUT', '/api/admin/moderation/{{propertyId}}', 409, { action: 'unflag' }, 'adminToken', [], {}, 'NOT_FLAGGED');
add('Unflagged verified property is public again', 'GET', main, 200);
add('Reject requires a reason', 'PUT', '/api/admin/moderation/{{otherPropertyId}}', 400, { action: 'reject' }, 'adminToken');
add('Admin rejects pending listing', 'PUT', '/api/admin/moderation/{{otherPropertyId}}', 200, { action: 'reject', reason: 'Please correct the property details before approval.' }, 'adminToken');
add('Rejected listing cannot be verified without resubmission', 'PUT', '/api/properties/{{otherPropertyId}}/verify', 409, {}, 'adminToken');
add('Owner edits and resubmits rejected listing', 'PUT', '/api/properties/{{otherPropertyId}}', 200, { title: 'Corrected property listing details' }, 'agent2Token');
add('Admin verifies through moderation endpoint', 'PUT', '/api/admin/moderation/{{otherPropertyId}}', 200, { action: 'verify' }, 'adminToken');
add('Admin pending moderation view', 'GET', '/api/admin/moderation?view=pending', 200, undefined, 'adminToken');

group('10 — Property lifecycle and final analytics');
add('Cannot skip Available directly to Sold', 'PUT', `${main}/status`, 409, { status: 'Sold' }, 'agentToken', [], {}, 'INVALID_STATUS_TRANSITION');
add('Nonowner cannot change property status', 'PUT', `${main}/status`, 403, { status: 'Under Negotiation' }, 'agent2Token', [], {}, 'NOT_OWNER');
add('Buyer cannot change property status', 'PUT', `${main}/status`, 403, { status: 'Under Negotiation' }, 'buyerToken');
add('Status requires JWT', 'PUT', `${main}/status`, 401, { status: 'Under Negotiation' });
add('Status validates enum', 'PUT', `${main}/status`, 400, { status: 'Done' }, 'agentToken');
add('Missing property status update returns 404', 'PUT', `/api/properties/${missing}/status`, 404, { status: 'Under Negotiation' }, 'agentToken');
add('Available to Under Negotiation', 'PUT', `${main}/status`, 200, { status: 'Under Negotiation' }, 'agentToken');
add('Sale listing cannot become Rented', 'PUT', `${main}/status`, 409, { status: 'Rented' }, 'agentToken', [], {}, 'PURPOSE_STATUS_MISMATCH');
add('Negotiation to Sold', 'PUT', `${main}/status`, 200, { status: 'Sold' }, 'agentToken');
add('Sold cannot return to Available', 'PUT', `${main}/status`, 409, { status: 'Available' }, 'agentToken', [], {}, 'INVALID_STATUS_TRANSITION');
add('Sold listing cannot be edited', 'PUT', main, 409, { price: 8000000 }, 'agentToken', [], {}, 'TERMINAL_PROPERTY');
add('Sold listing cannot be deleted', 'DELETE', main, 409, undefined, 'agentToken', [], {}, 'TERMINAL_PROPERTY');
add('Sold listing refuses new enquiry', 'POST', '/api/enquiries', 409, { propertyId: '{{propertyId}}', message: 'I would like to visit this property.' }, 'buyer2Token', [], {}, 'PROPERTY_UNAVAILABLE');
add('Rental Available to Under Negotiation', 'PUT', '/api/properties/{{rentId}}/status', 200, { status: 'Under Negotiation' }, 'agentToken');
add('Rental cannot become Sold', 'PUT', '/api/properties/{{rentId}}/status', 409, { status: 'Sold' }, 'agentToken');
add('Rental negotiation to Rented', 'PUT', '/api/properties/{{rentId}}/status', 200, { status: 'Rented' }, 'agentToken');
add('Rented cannot return to Available', 'PUT', '/api/properties/{{rentId}}/status', 409, { status: 'Available' }, 'agentToken');
add('Admin most-enquired property report', 'GET', '/api/admin/reports/top-properties?limit=100', 200, undefined, 'adminToken', ["pm.test('Sale listing has two enquiries', () => { const row = json.data.items.find(r => r.property._id === pm.collectionVariables.get('propertyId')); pm.expect(row).to.exist; pm.expect(row.enquiriesCount).to.eql(2); pm.expect(row.closedCount).to.eql(2); });"]);
add('Top properties report requires JWT', 'GET', '/api/admin/reports/top-properties', 401);
add('Agent cannot access platform top report', 'GET', '/api/admin/reports/top-properties', 403, undefined, 'agentToken');
add('Top report validates pagination', 'GET', '/api/admin/reports/top-properties?limit=0', 400, undefined, 'adminToken');
add('Admin agent performance report', 'GET', '/api/admin/reports/agent-performance?limit=100', 200, undefined, 'adminToken', ["pm.test('Agent totals and conversion are exact', () => { const row = json.data.items.find(r => r.agentId === pm.collectionVariables.get('agentId')); pm.expect(row).to.exist; pm.expect(row.listingsCount).to.eql(3); pm.expect(row.activeListingsCount).to.eql(2); pm.expect(row.enquiriesReceived).to.eql(2); pm.expect(row.soldCount).to.eql(1); pm.expect(row.rentedCount).to.eql(1); pm.expect(row.conversionRatePercent).to.eql(66.67); });"]);
add('Buyer cannot access performance report', 'GET', '/api/admin/reports/agent-performance', 403, undefined, 'buyerToken');
add('Performance report requires JWT', 'GET', '/api/admin/reports/agent-performance', 401);
add('Performance report validates pagination', 'GET', '/api/admin/reports/agent-performance?page=-1', 400, undefined, 'adminToken');

const collection = { info: { name: 'P09 — Real Estate Portal | Complete ordered demo and failure cases', description: 'Import P09.local.postman_environment.json, set adminEmail/adminPassword to your seeded admin, select that environment, and run all folders in order. The collection generates unique users and captures IDs/JWTs automatically. Use a dedicated demo database; records are intentionally retained for inspection. Every request has automated assertions. Secrets are blank in exports.', schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, variable: [{ key: 'baseUrl', value: 'http://localhost:3000' }], item: folders };
const environment = { name: 'P09 Local (set seeded admin credentials)', values: [
  { key: 'baseUrl', value: 'http://localhost:3000', enabled: true, type: 'default' },
  { key: 'adminEmail', value: '', enabled: true, type: 'default' },
  { key: 'adminPassword', value: '', enabled: true, type: 'secret' }
], _postman_variable_scope: 'environment' };
fs.mkdirSync(path.join(__dirname, '../postman'), { recursive: true });
fs.writeFileSync(path.join(__dirname, '../postman/P09.postman_collection.json'), JSON.stringify(collection, null, 2) + '\n');
fs.writeFileSync(path.join(__dirname, '../postman/P09.local.postman_environment.json'), JSON.stringify(environment, null, 2) + '\n');
console.log(`Built ${folders.length} folders with ${folders.reduce((count, f) => count + f.item.length, 0)} requests.`);
