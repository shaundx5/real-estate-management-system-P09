// Startup errors are sanitized too; configuration values and database URIs never reach logs.
async function main() {
  const app = require('./app');
  const env = require('./config/env');
  const { connectDB, disconnectDB } = require('./config/db');
  await connectDB();
  const server = app.listen(env.port, () => console.log(`P09 API listening on port ${server.address().port}`));
  server.on('error', () => {
    console.error('HTTP server could not start. Check whether PORT is already in use.');
    disconnectDB().catch(() => {}).finally(() => { process.exitCode = 1; });
  });
  let stopping = false;
  function shutdown() {
    if (stopping) return;
    stopping = true;
    const timer = setTimeout(() => { server.closeAllConnections(); }, 10000);
    timer.unref();
    server.close(() => {
      clearTimeout(timer);
      disconnectDB().catch(() => { process.exitCode = 1; });
    });
  }
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
main().catch(() => {
  console.error('Startup failed. Check .env, MongoDB replica-set availability and Setup Instructions.');
  require('mongoose').disconnect().catch(() => {}).finally(() => { process.exitCode = 1; });
});
