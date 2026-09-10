## Project Title & Team Details

**P09 — Real Estate Property Listing & Enquiry Portal**  

## Problem Statement

A real estate agency needs a reliable backend connecting buyers and tenants with verified property listings while enabling agents to manage their own inventory and enquiries and administrators to approve agents, verify listings, moderate reported content and review platform activity. This application implements the complete journey from registration and JWT login through combined property search, saved properties and enquiry submission to agent lead handling, property status progression, post-enquiry ratings and aggregated administrator reports, with server-side validation, role and ownership enforcement, and consistent error responses throughout.

## Tech Stack Used

| Component | Implementation |
| --- | --- |
| Runtime | Node.js 24 LTS; package engine accepts Node 24.x |
| HTTP framework | Express 5.2.1 |
| Database / ODM | MongoDB replica set or Atlas cluster; Mongoose 9.9.5 |
| Authentication | Self-built JWT login using jsonwebtoken 9.0.3; HS256 with issuer, audience and expiry checks |
| Password hashing | bcrypt 6.0.0, cost factor 12 |
| Validation | Joi 18.2.8; every route validates body, parameters and query before its controller |
| Configuration | dotenv 17.4.2; validated environment configuration |
| HTTP hardening | Helmet 8.3.0; express-rate-limit 8.7.0; 64 KB JSON body limit |
| API demonstration | Postman Collection v2.1; Newman 6.2.2 |
| Integration verification | Node test runner, Supertest 7.2.2 and mongodb-memory-server 11.2.0 starting a **real MongoDB 8.0.12 replica set** |

`package-lock.json` records the exact dependency versions. Application routes use Express's [automatic forwarding of rejected async handlers](https://expressjs.com/en/guide/error-handling/) to the final JSON error handler. Cross-document operations use [Mongoose transactions](https://mongoosejs.com/docs/transactions.html); MongoDB requires a [replica set or sharded deployment for these transactions](https://www.mongodb.com/docs/manual/core/transactions-production-consideration/).

## Setup Instructions

**1. Install prerequisites and dependencies.** Install Node.js **24.x** with npm. Extract the ZIP, open a terminal inside `p09-real-estate`, and run:

```bash
npm install
```

Use `npm ci` instead when you want an installation strictly matching the included lockfile. The first dependency installation/test run needs Internet access to download npm packages and the genuine MongoDB test binary.

**2. Create your environment file.** In Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

In macOS/Linux:

```bash
cp .env.example .env
```

Open `.env` in your editor. Set your own `JWT_SECRET`, `ADMIN_NAME`, `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Keep the file private. No admin account or usable JWT secret is shipped. To generate a suitable random JWT secret locally:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Copy that generated value into `JWT_SECRET` in `.env`. Passwords must contain at least 12 characters, a letter and a digit, and must fit within bcrypt's 72-byte UTF-8 limit. JWT expiry accepts a positive integer followed by `s`, `m`, `h` or `d`, such as `2h`.

| Environment variable | Purpose |
| --- | --- |
| `PORT` | HTTP port; example 3000 |
| `MONGO_URI` | Connection string, stored only in your private `.env`; the example matches the included local MongoDB configuration |
| `JWT_SECRET` | Your random signing secret, at least 48 characters |
| `JWT_EXPIRY` | Access-token lifetime; example `2h` |
| `NODE_ENV` | `development`, `test` or `production` |
| `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD` | Credentials used by the restricted seed command |
| `AUTH_RATE_LIMIT_MAX` | Per-IP authentication requests per 15 minutes; example 100 for repeated demos, code default 30 if omitted |
| `API_RATE_LIMIT_MAX` | Per-IP API requests per minute; default 600 |

**3. Start MongoDB using either option.**

- **Local Docker option:** Install/start Docker Desktop (or Docker Engine with Compose), then run the command below. `compose.yaml` starts MongoDB, initializes replica set `rs0`, waits for a writable primary, binds the published database port to `127.0.0.1`, and stores data in a named volume. Leave `MONGO_URI` at the sample value copied into `.env`.
- **Atlas option:** Create a MongoDB Atlas cluster and database user, permit your machine's IP through Atlas network access, and replace `MONGO_URI` in `.env` with your own connection string containing a database name. Use the options provided by Atlas; remove the local-only `directConnection` setting when replacing the sample string. Docker is unnecessary for this option.

```bash
docker compose up -d --wait
```

A default standalone `mongod` is insufficient because it cannot execute the required transactions. The application detects this at startup. An existing local MongoDB installation can be used after configuring it as a replica set; the supplied Compose configuration is the simpler reproducible local route. If port 27017 is already occupied, use Atlas or stop the conflicting local database before starting the dedicated project database.

**4. Seed the administrator and start the application.**

```bash
npm run seed:admin
npm start
```

For automatic restarts while editing source:

```bash
npm run dev
```

The seed command is idempotent: it leaves an existing admin's password unchanged and refuses to promote an existing buyer, tenant or agent using the same email. Public registration never permits `admin`. Check `GET http://localhost:3000/api/health` in Postman; it should return `success: true` with `database: "connected"`. Start the application with npm/Node; there is no HTML index file to open.

**5. Run the complete Postman demonstration.**

1. Import `postman/P09.postman_collection.json` and `postman/P09.local.postman_environment.json` into Postman.
2. Select **P09 Local (set seeded admin credentials)** as the active environment.
3. Set `adminEmail` and `adminPassword` to the values used by `npm run seed:admin`. Set `baseUrl` to your application address if you changed the port.
4. Open Collection Runner, select **all 10 folders**, and run them in order with one iteration. The first request creates a unique run identifier, account emails, demonstration city and random user password. Registration/login requests automatically capture IDs and tokens. Subsequent requests use those values.
5. Inspect the green assertions and the resulting database documents. Expected 400/401/403/404/409 responses are deliberate passing test cases. The collection has **185 requests and 809 assertions**. Use a dedicated project database; the manual collection retains its records so they remain available for your viva and screenshots.

The demonstration order is authentication → pending listings → agent/listing verification → search/location browsing → edits/deletion → favourites → enquiry workflow → ratings → moderation → property completion and reports. The administrator login needs the credentials you supplied; demo account credentials are generated automatically and are not fixed source-code credentials. When repeating a complete run, start again from folder 01. Clear exported tokens/passwords before sharing a Postman export. Very large numbers of repeated manual runs can reach rate limits or place old records ahead of the current run's report page; a dedicated clean demo database keeps the runner deterministic.

**6. Run the automated verification.**

```bash
npm test
```

This command runs **16 integration tests**, then executes the same Postman collection with Newman. It starts isolated, genuine MongoDB replica sets, creates temporary `.env` files containing random secrets, seeds the test administrator, and shuts down/removes the temporary databases and environment files afterwards. Your `.env` and application database are not used or erased. The test server binds an available loopback port, so your application can remain running on port 3000. There are no database or API mocks. The tests also start the actual `server.js` entry point and verify that the administrator seed command refuses to elevate an existing buyer.

```bash
npm run test:integration
npm run test:postman
```

The delivered `test-results/postman-results.json` contains sanitized request/assertion totals and no passwords or tokens. `test-results/verification.json` records the build's integration and requirements check. Concurrency tests check duplicate prevention, mutually consistent enquiry/deletion operations and one-time status transitions. Authentication/authorization tests exercise every protected route family. To rebuild the collection after changing its request definitions, run `node scripts/build-postman.js`.

**7. Stop and reopen.** Press `Ctrl+C` in the server terminal to stop Node cleanly. `docker compose stop` stops the local database while retaining its volume. Later, run `docker compose up -d --wait`, followed by `npm start`; Atlas users only need `npm start`. Do not remove Docker volumes if you want to retain your demo data.

## List of Implemented Modules

Each row is implemented with real database operations, Joi input validation, applicable authentication/role/ownership middleware and passing Postman coverage. Public browsing intentionally needs no token; protected actions require both authentication and authorization.

| # | Module | Main endpoints | Enforced business rule | Postman folders |
| --- | --- | --- | --- | --- |
| 1 | User Registration & Authentication | `POST /api/auth/register`, `POST /api/auth/login` | bcrypt hashes; unique normalized email; no public admin registration; signed expiring JWTs | 02 |
| 2 | Property Listing Management | `POST /api/properties`, `PUT/DELETE /api/properties/:id`, `GET /api/properties/mine` | Agents manage only their own listings; edits reset approval; open enquiries prevent deletion; deletion preserves history | 03, 05, 07, 10 |
| 3 | Property Verification Workflow | `PUT /api/properties/:id/verify` | Admin only; agent must be approved; only pending, unflagged listings can be verified; private listings fail public reads and interactions | 03, 05, 09 |
| 4 | Advanced Search & Filtering | `GET /api/properties/search` | Combined filters, bounded pagination, positive/ordered price ranges, no client-supplied MongoDB operators; public visibility gate | 04 |
| 5 | Favourites/Saved Properties | `POST/GET /api/favourites`, `DELETE /api/favourites/:id` | Buyer/tenant only; unique bookmark per user/property; only owner can list/remove; hidden property data is withheld | 06, 09 |
| 6 | Enquiry Submission Module | `POST /api/enquiries`, `GET /api/enquiries/mine` | Buyer/tenant only; existing verified unflagged active listing required; one enquiry per user/property | 03, 07, 09, 10 |
| 7 | Lead Management for Agents | `GET /api/enquiries`, `PUT /api/enquiries/:id/status` | Only listing owner sees/updates leads; explicit transition graph and attributable history; closure/rejection needs remarks | 07 |
| 8 | Property Status Tracking | `PUT /api/properties/:id/status` | Verified, unflagged property; `Available → Under Negotiation → Sold/Rented`; sale/rent purpose enforced; terminal states cannot reopen | 03, 10 |
| 9 | Agent Profile & Ratings | `GET /api/agents/:id/profile`, `POST /api/agents/:id/ratings` | Public listing count includes only public listings; only the enquiry owner can rate its agent after `Closed`; one rating per buyer/agent; average computed by aggregation | 07, 08 |
| 10 | Location-Based Listing Grouping | `GET /api/properties/city/:city`, `GET /api/properties/locations` | Public listings only; normalized city/locality keys; counts and price ranges grouped in MongoDB | 03, 04 |
| 11 | Admin Moderation Dashboard | `GET/PUT /api/admin/moderation[/:id]`, `PUT /api/admin/agents/:id/verify`, `POST /api/properties/:id/flag` | Admin-only queues and decisions; flag hides listing immediately; rejection needs a reason; resubmission required before approval | 03, 09 |
| 12 | Reports & Analytics | `GET /api/admin/reports/top-properties`, `GET /api/admin/reports/agent-performance` | Admin only; MongoDB aggregation pipelines count enquiries and listing conversion, include zero-listing agents and retain historical totals | 10 |
| 13 | Role-Based Access Control | All protected endpoints | JWT middleware loads the current database user/role; separate role middleware; shared resource ownership middleware precedes controllers; own-data queries cannot be overridden | 02–10 |

**Lifecycle rules.** Property transitions are `Available → Under Negotiation → Sold` for a Sale listing and `Available → Under Negotiation → Rented` for a Rent listing. The same-state transition, skipped stages, backwards transitions and the wrong terminal state return 409. Changing sale/rent purpose during negotiation is also a 409. Sold/Rented listings remain publicly inspectable as historical listings, but no longer accept enquiries or edits/deletion. Agents may record a transaction negotiated outside the portal; a property transition does not require a portal lead.

Enquiry transitions are `New → In Progress/Rejected`, `In Progress → Approved/Rejected`, `Approved → Closed`, and `Rejected → Closed`. `Closed` is terminal. `Rejected` and `Closed` require remarks; history records every status, remark, actor and timestamp. Closing an enquiry does not automatically sell/rent the property; the property state has its own dedicated endpoint. A rating measures the agent's service after a resolved enquiry, including a rejected enquiry that was properly closed; it does not claim a purchase occurred.

New properties are `isVerified:false`, `reviewStatus:Pending`. Editing a nonterminal listing returns it to Pending. Flagged properties are hidden immediately. Clearing a flag restores visibility only when the listing is already verified; it does not approve a rejected or pending listing. Rejected properties must be corrected by the owner before an admin can verify them. Agent approval is one-way in this project; an agent may prepare pending listings before being approved, but none can be published first.

Property-affecting cross-collection actions use a transaction and an internal property write counter to serialize conflicting operations. Unique indexes prevent simultaneous duplicate enquiries, favourites and ratings. Deleting a property with any enquiry other than `Closed` returns 409. Eligible deletions are soft deletions so references and administrator report history remain valid.

## API Endpoint Reference

Base URL: `http://localhost:3000`. Protected calls use `Authorization: Bearer <token>`. Bodies use `Content-Type: application/json`. IDs are 24-character hexadecimal MongoDB ObjectIds. **`:id` in the favourites DELETE route is the favourite document ID returned by POST/GET, not the property ID.** Routes accepting no body accept an omitted body or `{}` and reject other body fields.

| Method | Path | Access | Short description / body |
| --- | --- | --- | --- |
| GET | `/api/health` | Public | Database-backed readiness check |
| POST | `/api/auth/register` | Public | `{name,email,password,role}`; role buyer/tenant/agent |
| POST | `/api/auth/login` | Public | `{email,password}`; returns JWT and safe user details |
| GET | `/api/auth/me` | Any authenticated listed role | Current database-backed account details |
| POST | `/api/properties` | Agent | Create own pending listing; body below |
| GET | `/api/properties/search` | Public | Combined filters and pagination; public listings only |
| GET | `/api/properties/mine` | Agent | Own nondeleted listings, including pending/rejected |
| GET | `/api/properties/locations` | Public | Group public listings by city/locality |
| GET | `/api/properties/city/:city` | Public | Browse public listings in a city; accepts search filters except city |
| GET | `/api/properties/:id` | Public | Read verified, unflagged, nondeleted listing |
| PUT | `/api/properties/:id` | Owning agent | Nonempty subset of editable create fields; re-verification required |
| DELETE | `/api/properties/:id` | Owning agent | Soft delete nonterminal listing only after enquiries are closed |
| PUT | `/api/properties/:id/verify` | Admin | Empty body; verify pending listing from approved agent |
| PUT | `/api/properties/:id/status` | Owning agent | `{status}`; enforce property state machine |
| POST | `/api/properties/:id/flag` | Buyer/tenant | `{reason}`; report listing and hide it pending moderation |
| POST | `/api/favourites` | Buyer/tenant | `{propertyId}`; save public listing |
| GET | `/api/favourites` | Buyer/tenant | Own paginated favourites; hidden listing represented by null propertyId |
| DELETE | `/api/favourites/:id` | Owning buyer/tenant | Remove own favourite using its document ID |
| POST | `/api/enquiries` | Buyer/tenant | `{propertyId,message}`; verified active listing required |
| GET | `/api/enquiries/mine` | Buyer/tenant | Own enquiries, including status/history |
| GET | `/api/enquiries` | Agent | Enquiries attached only to own properties |
| PUT | `/api/enquiries/:id/status` | Property's owning agent | `{status,remarks?}`; remarks required for Rejected/Closed |
| GET | `/api/agents/:id/profile` | Public | Agent details, paginated public listings, public listing count and ratings |
| POST | `/api/agents/:id/ratings` | Buyer/tenant owning the referenced enquiry | `{enquiryId,score,comment?}`; score integer 1–5, enquiry Closed |
| PUT | `/api/admin/agents/:id/verify` | Admin | Empty body; approve registered agent |
| GET | `/api/admin/moderation` | Admin | Queues, totals and paginated pending agents |
| PUT | `/api/admin/moderation/:id` | Admin | `{action,reason?}`; action verify/reject/unflag; reason required for reject |
| GET | `/api/admin/reports/top-properties` | Admin | Paginated properties ranked by enquiry count |
| GET | `/api/admin/reports/agent-performance` | Admin | Paginated agent listing, lead and conversion metrics |

**Create-property body.** `title`, `type`, `listingFor`, `price`, `city`, `locality` and `bedrooms` are required. `description` and `images` are optional. Valid types: `Apartment`, `House`, `Villa`, `Plot`, `Commercial`. `listingFor` is `Sale` or `Rent`. Price is a JSON number between 1 and 1,000,000,000,000, with at most two decimal places. Bedrooms is an integer 0–30; use 0 for plots/commercial properties without bedrooms. Images is an array of up to 12 distinct HTTP/HTTPS URLs; URLs are stored, not fetched by the server. Agents cannot supply `agentId`, status, verification, moderation or deletion fields.

```json
{
  "title": "Two-bedroom apartment in Kengeri",
  "type": "Apartment",
  "listingFor": "Sale",
  "price": 7500000,
  "city": "Bangalore",
  "locality": "Kengeri",
  "bedrooms": 2,
  "images": ["https://example.com/apartment.jpg"],
  "description": "Two-bedroom apartment available for viewing."
}
```

**Query parameters.**

| Endpoints | Accepted query fields |
| --- | --- |
| Property search | `city`, `locality`, `minPrice`, `maxPrice`, `type`, `bedrooms`, `listingFor`, `status`, `sort`, `page`, `limit` |
| City browsing | Same search fields except `city`, which comes from the URL |
| Location groups | `groupBy=city\|locality`, optional `city`, `page`, `limit` |
| Own listings, favourites, agent profile, both reports | `page`, `limit` |
| Agent leads and buyer/tenant own enquiries | Optional `propertyId`, `status`, plus `page`, `limit` |
| Moderation dashboard | `view=pending\|flagged\|rejected\|all`, `page`, `limit`; default pending |

Filters combine with AND. City/locality are stored lowercase and searched case-insensitively by exact normalized name. Numeric query strings are converted by Joi; JSON body numbers must already be numbers. Duplicate/unknown query keys and unknown body fields are rejected. Text fields with `.trim()` validation reject surrounding whitespace in JSON bodies. Pagination defaults to page 1 and limit 20; limit is capped at 100 and page at 10,000. Search sort is `newest` (default), `price_asc` or `price_desc`, with deterministic ID tie-breaking. Search includes all public property states by default; add `status=Available` or `listingFor=Rent` for a more specific view.

Example combined search:

```text
GET /api/properties/search?city=Bangalore&type=Apartment&minPrice=5000000&maxPrice=9000000&bedrooms=2&listingFor=Sale&sort=price_asc&page=1&limit=10
```

**Response contract.** Every implemented endpoint and route/error fallback returns one of these JSON shapes:

```json
{ "success": true, "message": "Operation completed.", "data": {} }
```

```json
{ "success": false, "message": "Cannot change status from Sold to Available.", "errorCode": "INVALID_STATUS_TRANSITION" }
```

Lists use `data.items` and `data.pagination`, containing `page`, `limit`, `total` and `pages`. An empty list is 200 with an empty array and zero pages, not 404. The moderation dashboard nests separate list envelopes under `data.listings` and `data.pendingAgents`; both use the supplied page/limit independently. Agent profile nests its listing envelope under `data.listings` and returns the ten most recent rating comments alongside the full aggregate count/average.

| HTTP code | Meaning |
| --- | --- |
| 200 | Successful read/update/delete |
| 201 | Account/listing/favourite/enquiry/rating created |
| 400 | Invalid body, ID, query, JSON or content type; oversized body |
| 401 | Missing/invalid/expired JWT or incorrect login credentials |
| 403 | Wrong role or resource owner |
| 404 | Missing endpoint/resource; a nonpublic property is also 404 on public detail reads |
| 409 | Duplicate record or violated workflow/verification/business rule |
| 429 | Explicit authentication/API rate limit exceeded |
| 503 | Recognized temporary database unavailability |
| 500 | Unexpected unhandled application error, sanitized by centralized middleware |

Useful error codes include `VALIDATION_ERROR`, `UNAUTHORIZED`, `INVALID_TOKEN`, `FORBIDDEN_ROLE`, `NOT_OWNER`, `DUPLICATE_RECORD`, `PROPERTY_NOT_PUBLIC`, `PROPERTY_UNAVAILABLE`, `AGENT_NOT_VERIFIED`, `INVALID_STATUS_TRANSITION`, `OPEN_ENQUIRIES` and `ENQUIRY_NOT_CLOSED`. Error messages never echo passwords, JWTs, database connection strings or stack traces. All controllers return/await their asynchronous work so rejected operations reach the error middleware.

**Report definitions.** Top properties aggregates all enquiries by property and counts their current Approved/Closed status. Properties without enquiries are not in that ranking. Agent performance includes every registered agent, including those with zero listings. `listingsCount` is all-time created listings, including soft-deleted history; `activeListingsCount` counts nondeleted records, including completed listings. `enquiriesReceived` counts leads across those listings. `soldCount`/`rentedCount` count terminal property states. `conversionRatePercent = (soldCount + rentedCount) / listingsCount × 100`, rounded to two decimals, or 0 when the denominator is 0. It is listing conversion, not a claim that every closed enquiry resulted in a sale. All these metrics are computed with MongoDB aggregation stages, not application loops. The top report uses one lookup after pagination; performance uses two purposeful summary lookups.

## Database Schema Summary + a simple text/ASCII ER diagram

| Collection / schema file | Main fields | References |
| --- | --- | --- |
| `users` / `models/User.js` | name, normalized email, passwordHash (excluded by default), role, isAgentVerified, agentVerifiedAt, createdAt, updatedAt | User is the shared identity root |
| `properties` / `models/Property.js` | agentId, title, description, type, listingFor, price, normalized city/locality, bedrooms, status, images[], isVerified, isFlagged, reviewStatus, moderation fields, isDeleted, deletedAt, internal activityVersion, timestamps | agentId, flaggedBy and moderatedBy reference `users._id` |
| `enquiries` / `models/Enquiry.js` | propertyId, buyerId, message, status, remarks, statusHistory[], timestamps | propertyId → `properties._id`; buyerId and statusHistory.changedBy → `users._id` |
| `favourites` / `models/Favourite.js` | userId, propertyId, timestamps | userId → `users._id`; propertyId → `properties._id` |
| `ratings` / `models/Rating.js` | agentId, buyerId, enquiryId, score, comment, timestamps | agentId and buyerId → `users._id`; enquiryId → `enquiries._id` |

```text
users._id (agent)  1 ----< many properties.agentId
properties._id    1 ----< many enquiries.propertyId
users._id (buyer/
tenant)           1 ----< many enquiries.buyerId

users._id         1 ----< many favourites.userId
properties._id    1 ----< many favourites.propertyId

users._id (agent)  1 ----< many ratings.agentId
users._id (buyer/
tenant)           1 ----< many ratings.buyerId
enquiries._id     1 ----< many ratings.enquiryId
                         (one rating per buyer-agent pair)
```

**Referencing versus embedding.** Users, properties, enquiries and favourites are independently updated, shared entities with potentially large many-to-one relationships. ObjectId references let several buyers enquire about or save the same property without copying its fields, let an agent's property be updated in one place, and allow ownership checks and index-backed queries directly on reference fields. Embedding enquiries inside a property or favourites inside a user would create continually growing parent documents and force unrelated operations to contend on and rewrite the same arrays. Accordingly, no enquiry documents are embedded in properties and no favourites are embedded in users. Ratings have their own collection, as permitted by Module 9, so their independent growth and uniqueness constraints are handled directly.

Only small data owned by a single record is embedded: property image URLs and enquiry transition history. The transition graph is acyclic and caps an enquiry history at four entries, so that history cannot grow without bound. History entries still reference the acting user by ObjectId. Mongoose `ref` fields are application-level relationships rather than database-enforced foreign keys; controllers validate referents, transactions protect dependent writes and soft deletion preserves history. Direct database edits bypass application rules and should be restricted to administrators.

**Indexes.**

| Collection | Indexes and purpose |
| --- | --- |
| users | Required unique `{email:1}`; `{role:1,isAgentVerified:1}` for pending agents |
| properties | Required `{agentId:1}`; `{city:1,type:1,price:1}` for combined searches; `{isDeleted:1,isVerified:1,isFlagged:1,city:1,type:1,price:1}` for public filtered search; `{city:1,locality:1}`; `{reviewStatus:1,isFlagged:1,isDeleted:1}` for moderation |
| enquiries | Required `{propertyId:1}`; unique `{propertyId:1,buyerId:1}`; `{buyerId:1,createdAt:-1}`; `{propertyId:1,status:1,createdAt:-1}` |
| favourites | Required `{userId:1}`; unique `{userId:1,propertyId:1}` |
| ratings | Unique `{agentId:1,buyerId:1}`; `{agentId:1,createdAt:-1}` |

Collections are declared individually in `models/`. `config/db.js` waits for index creation before accepting traffic; duplicate-key errors become clean 409 responses. `routes/` contains only route composition and middleware wiring; controllers implement workflows, `middleware/auth.js` supplies authentication and role checks, `middleware/ownership.js` supplies resource ownership checks, `middleware/validate.js` supplies consistent Joi validation, and `middleware/errorHandler.js` handles errors. `utils/` holds response, pagination, token, transaction and state-machine helpers. Secrets are never committed: `.env` is ignored and `.env.example` contains sample placeholders.

## Known Limitations

- **No mocked integrations or stubbed mandatory modules.** All 13 modules use the live MongoDB database. The added static frontend covers the core role-based workflows, while Postman remains the complete endpoint and failure-case demonstration.
- Amounts use one assumed currency, **INR**. Sale prices mean total asking price; rent prices mean monthly asking rent. The API does not calculate payments, exchange rates, commissions or taxes. Location-group min/max values span both purposes unless the stored group contains only one purpose; compare Sale/Rent prices using the search filters.
- All persisted timestamps are UTC. Location names are normalized English text; there is no address geocoder, map, distance search or alias dictionary. `Bangalore` and `Bengaluru` remain distinct keys.
- Images are validated external URLs, not uploaded files or fetched content. Image availability and ownership are outside this backend. User comments/messages are plain text; any future frontend must render them as text rather than executable HTML.
- One enquiry is allowed per buyer/tenant and property, including after closure. One immutable rating is allowed per buyer/tenant and agent, using a closed enquiry. These deliberate constraints prevent duplicate leads and repeated rating inflation.
- JWTs are access tokens with configurable expiry. The application rechecks the database user and role on protected requests, but does not implement refresh tokens, password recovery, email verification or a token-revocation list; those are outside the specified modules. Agent verification is a one-way administrative approval; property moderation provides the listing-level controls.
- Local Docker MongoDB is intentionally limited to the host loopback interface and uses no database authentication for the college demo. Use an authenticated database and HTTPS termination for an Internet deployment. The Compose recipe is supplied for local setup; the verified test runs used a real ephemeral replica set, not Docker Desktop on Windows.
- Rate limits are in memory per Node process. Horizontal deployment would need a shared limiter store. Reports and offset pagination suit a college/agency dataset; the performance aggregation gathers an agent's property IDs and is not intended for millions of listings per agent. Load balancing, large-scale analytics infrastructure and external monitoring are outside scope.
- Request errors return centralized JSON without stack traces. Invalid startup configuration prevents the server from starting; a stopped database is reported as unavailable. Operating-system termination or fatal runtime failures cannot be converted into an HTTP response by application middleware.

## Frontend UI

The frontend is contained entirely in `frontend/`. The original Express application and every backend route, controller, model, validator, middleware file and utility remain unchanged. A small Node server in `frontend/server.js` serves the HTML, local Bootstrap files, CSS and JavaScript on port 8080. It proxies browser requests from `/api` to the existing backend on port 3000. This keeps browser requests on one origin without adding CORS or static-file middleware to `app.js`.

Complete the normal backend setup first. Start MongoDB and the API in the project root:

```bash
docker compose up -d --wait
npm run seed:admin
npm start
```

Leave that terminal running. Open a second terminal in the same project root and start the frontend:

```bash
node frontend/server.js
```

Open `http://localhost:8080`. The frontend needs no separate dependency installation or build command. Bootstrap 5.3.8 is stored locally under `frontend/assets/vendor/`, so the UI does not require a CDN connection. `FRONTEND_PORT` can change the frontend port, and `API_ORIGIN` can point the proxy at another backend origin if required.

| Frontend screen | Existing backend endpoints called |
| --- | --- |
| Register and login | `POST /api/auth/register`, `POST /api/auth/login` |
| Public property search | `GET /api/properties/search`, `GET /api/properties/locations` |
| Property details and buyer actions | `GET /api/properties/:id`, `POST /api/favourites`, `POST /api/enquiries`, `POST /api/properties/:id/flag` |
| Public agent profile | `GET /api/agents/:id/profile` |
| Buyer/tenant dashboard | `GET /api/auth/me`, `GET /api/favourites`, `DELETE /api/favourites/:id`, `GET /api/enquiries/mine`, `POST /api/agents/:id/ratings` |
| Agent dashboard | `GET /api/auth/me`, `POST /api/properties`, `GET /api/properties/mine`, `PUT/DELETE /api/properties/:id`, `PUT /api/properties/:id/status`, `GET /api/enquiries`, `PUT /api/enquiries/:id/status` |
| Admin dashboard | `GET /api/auth/me`, `GET /api/admin/moderation`, `PUT /api/properties/:id/verify`, `PUT /api/admin/moderation/:id`, `PUT /api/admin/agents/:id/verify`, and both `/api/admin/reports/*` endpoints |

The login token and safe user details are stored in browser `localStorage`. The navbar and dashboard guards read the token role only to control navigation and visible actions. Every request still reaches the existing authentication, role, ownership, validation and business-rule middleware. Backend errors are displayed as Bootstrap alerts containing the returned `message` and `errorCode`.
