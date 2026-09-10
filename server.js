const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

const root = __dirname;
const port = Number(process.env.FRONTEND_PORT || 8080);
const apiOrigin = new URL(process.env.API_ORIGIN || 'http://127.0.0.1:3000');
const transport = apiOrigin.protocol === 'https:' ? https : http;

const contentTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp'
};
const pages = new Set([
  '/index.html', '/login.html', '/register.html', '/property.html',
  '/agent-profile.html', '/buyer-dashboard.html', '/agent-dashboard.html',
  '/admin-dashboard.html'
]);

function proxyApi(req, res) {
  const headers = { ...req.headers, host: apiOrigin.host };
  delete headers.connection;
  delete headers['proxy-connection'];
  const upstream = transport.request({
    protocol: apiOrigin.protocol,
    hostname: apiOrigin.hostname,
    port: apiOrigin.port,
    method: req.method,
    path: req.url,
    headers
  }, upstreamResponse => {
    const responseHeaders = { ...upstreamResponse.headers };
    delete responseHeaders.connection;
    delete responseHeaders['transfer-encoding'];
    res.writeHead(upstreamResponse.statusCode || 502, responseHeaders);
    upstreamResponse.pipe(res);
  });
  upstream.on('error', () => {
    if (res.headersSent) return res.end();
    res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      success: false,
      message: 'The backend API is unavailable. Start it with npm start.',
      errorCode: 'API_UNAVAILABLE'
    }));
  });
  req.pipe(upstream);
}

function serveStatic(req, res) {
  const requestUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (requestUrl.pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Invalid URL.');
  }
  if (pathname === '/') pathname = '/index.html';
  if (!pages.has(pathname) && !pathname.startsWith('/assets/')) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Page not found.');
  }
  const requestedPath = path.resolve(root, `.${pathname}`);
  if (requestedPath !== root && !requestedPath.startsWith(`${root}${path.sep}`)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    return res.end('Forbidden.');
  }

  fs.stat(requestedPath, (error, stats) => {
    if (error || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      return res.end('Page not found.');
    }
    res.writeHead(200, {
      'Content-Type': contentTypes[path.extname(requestedPath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': pathname.startsWith('/assets/vendor/') ? 'public, max-age=86400' : 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    });
    fs.createReadStream(requestedPath).pipe(res);
  });
}

const server = http.createServer((req, res) => {
  if (req.url === '/api' || req.url.startsWith('/api/')) return proxyApi(req, res);
  return serveStatic(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`P09 frontend available at http://localhost:${port}`);
  console.log(`API requests are proxied to ${apiOrigin.origin}`);
});

server.on('error', () => {
  console.error(`Frontend could not start. Check whether port ${port} is already in use.`);
  process.exitCode = 1;
});
