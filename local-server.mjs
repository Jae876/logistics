import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const PORT = Number(process.env.PORT || 3001);
const apiRoot = path.resolve(process.cwd(), 'api');

const ROUTES = {
  '/api/login': path.join(apiRoot, 'login.js'),
  '/api/health': path.join(apiRoot, 'health.js'),
  '/api/public/shipments': path.join(apiRoot, 'public', 'shipments.js'),
  '/api/public/geofences': path.join(apiRoot, 'public', 'geofences.js'),
  '/api/admin/shipments': path.join(apiRoot, 'admin', 'shipments.js'),
  '/api/admin/geofences': path.join(apiRoot, 'admin', 'geofences.js'),
  '/api/admin/account': path.join(apiRoot, 'admin', 'account.js')
};

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', () => {
    const raw = Buffer.concat(chunks).toString('utf8');
    if (!raw) return resolve({});
    try {
      resolve(JSON.parse(raw));
    } catch (error) {
      reject(error);
    }
  });
  req.on('error', reject);
});

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
  });
  res.end(body);
};

const createRes = (res) => ({
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(payload) {
    sendJson(res, this.statusCode || 200, payload);
    return this;
  },
  end(payload) {
    res.writeHead(this.statusCode || 200, {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    });
    if (payload !== undefined) res.end(payload);
    else res.end();
    return this;
  }
});

const server = createServer(async (req, res) => {
  if (!req.url) return sendJson(res, 400, { error: 'Invalid request' });

  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);
  const pathname = url.pathname;
  const routeFile = ROUTES[pathname];

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (!routeFile) {
    sendJson(res, 404, { error: 'Not found' });
    return;
  }

  try {
    const module = await import(pathToFileURL(routeFile).href);
    const handler = module.default;
    const body = req.method !== 'GET' && req.method !== 'DELETE'
      ? await readBody(req)
      : {};

    const reqObj = {
      method: req.method,
      url: req.url,
      headers: req.headers,
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      params: {}
    };

    const response = createRes(res);
    await handler(reqObj, response);
  } catch (error) {
    console.error(`Handler error for ${pathname}:`, error?.message || error);
    sendJson(res, 500, { error: 'Internal server error' });
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Local serverless runtime listening on http://127.0.0.1:${PORT}`);
});
