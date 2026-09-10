const fs = require('node:fs');
const path = require('node:path');
const newman = require('newman');
const { startDatabase } = require('../tests/testDatabase');

async function main() {
  const testDB = await startDatabase();
  let server;
  try {
    server = testDB.app.listen(0, '127.0.0.1');
    await new Promise((resolve, reject) => { server.once('listening', resolve); server.once('error', reject); });
    const collection = JSON.parse(fs.readFileSync(path.join(__dirname, '../postman/P09.postman_collection.json'), 'utf8'));
    const summary = await new Promise((resolve, reject) => newman.run({
      collection,
      envVar: [
        { key: 'baseUrl', value: `http://127.0.0.1:${server.address().port}` },
        { key: 'adminEmail', value: testDB.credentials.email },
        { key: 'adminPassword', value: testDB.credentials.password }
      ], reporters: ['cli'], reporter: { cli: { noConsole: true } }, timeoutRequest: 15000
    }, (error, result) => error ? reject(error) : resolve(result)));
    // Do not export raw requests/responses: they include passwords and JWTs.
    const safe = { generatedAt: new Date().toISOString(), database: 'Real MongoDB replica set (isolated test database)',
      requests: summary.run.stats.requests, assertions: summary.run.stats.assertions,
      failures: summary.run.failures.map(f => ({ request: f.source?.name || 'collection', test: f.error?.test || f.error?.name || 'unknown' })) };
    fs.mkdirSync(path.join(__dirname, '../test-results'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '../test-results/postman-results.json'), JSON.stringify(safe, null, 2) + '\n');
    if (summary.run.failures.length) process.exitCode = 1;
  } finally {
    if (server) await new Promise(resolve => server.close(resolve));
    await testDB.close();
  }
}
main().catch(() => { console.error('Postman run could not complete. Check MongoDB test-binary availability and collection setup.'); process.exitCode = 1; });
