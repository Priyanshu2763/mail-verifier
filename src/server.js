'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { validate } = require('./validator');
const cache = require('./cache');
const config = require('./config');

// ─── Rate Limiter (in-memory sliding window) ─────────────────────────────────
const rateLimitMap = new Map();

function isRateLimited(ip) {
  const now = Date.now();
  const windowMs = config.rateLimit.windowMs;
  const max = config.rateLimit.max;

  let record = rateLimitMap.get(ip);
  if (!record) {
    record = { count: 0, windowStart: now };
    rateLimitMap.set(ip, record);
  }

  if (now - record.windowStart > windowMs) {
    record.count = 0;
    record.windowStart = now;
  }

  record.count++;
  return record.count > max;
}

// Cleanup old rate limit entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - config.rateLimit.windowMs;
  for (const [ip, record] of rateLimitMap.entries()) {
    if (record.windowStart < cutoff) rateLimitMap.delete(ip);
  }
}, 300_000);

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getClientIp(req) {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    'unknown'
  );
}

function sendJson(res, statusCode, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); }
      catch (_) { resolve(null); }
    });
    req.on('error', reject);
  });
}

// ─── Route Handlers ───────────────────────────────────────────────────────────
async function handleValidateSingle(req, res, url) {
  const email = url.searchParams.get('email');
  if (!email) {
    return sendJson(res, 400, { error: 'Missing ?email= query parameter' });
  }
  try {
    const result = await validate(email);
    sendJson(res, 200, result);
  } catch (err) {
    sendJson(res, 500, { error: 'Validation failed', message: err.message });
  }
}

async function handleValidateBulk(req, res) {
  const body = await readBody(req);
  if (!body || !Array.isArray(body.emails)) {
    return sendJson(res, 400, { error: 'Body must be JSON: { "emails": ["a@b.com", ...] }' });
  }

  const { emails } = body;
  if (emails.length === 0) {
    return sendJson(res, 400, { error: 'Emails array is empty' });
  }
  if (emails.length > config.validation.bulkMaxEmails) {
    return sendJson(res, 400, {
      error: `Too many emails. Maximum is ${config.validation.bulkMaxEmails} per request.`,
    });
  }

  try {
    const results = await Promise.all(emails.map(e => validate(e)));
    sendJson(res, 200, { count: results.length, results });
  } catch (err) {
    sendJson(res, 500, { error: 'Bulk validation failed', message: err.message });
  }
}

function handleHealth(res) {
  sendJson(res, 200, {
    status: 'ok',
    uptime_s: Math.floor(process.uptime()),
    cache: cache.stats(),
    smtp_enabled: config.validation.enableSmtp,
    version: '1.0.0',
  });
}

function handleDashboard(res) {
  const uiPath = path.resolve(__dirname, 'server-ui.html');
  if (fs.existsSync(uiPath)) {
    const html = fs.readFileSync(uiPath, 'utf8');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  } else {
    res.writeHead(302, { Location: '/health' });
    res.end();
  }
}

// ─── Main Server ──────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const ip = getClientIp(req);

  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Rate limiting
  if (isRateLimited(ip)) {
    return sendJson(res, 429, {
      error: 'Rate limit exceeded',
      retry_after_ms: config.rateLimit.windowMs,
    });
  }

  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname.replace(/\/$/, '') || '/';

  if (pathname === '/' && req.method === 'GET') {
    return handleDashboard(res);
  }

  if (pathname === '/health' && req.method === 'GET') {
    return handleHealth(res);
  }

  if (pathname === '/validate' && req.method === 'GET') {
    return handleValidateSingle(req, res, url);
  }

  if (pathname === '/validate/bulk' && req.method === 'POST') {
    return handleValidateBulk(req, res);
  }

  sendJson(res, 404, {
    error: 'Not found',
    endpoints: [
      'GET  /validate?email=<address>',
      'POST /validate/bulk  body: { "emails": ["a@b.com"] }',
      'GET  /health',
      'GET  /  (dashboard)',
    ],
  });
});

server.listen(config.server.port, () => {
  console.log(`\n🚀 Email Validator API running at http://localhost:${config.server.port}`);
  console.log(`   SMTP check: ${config.validation.enableSmtp ? '✅ enabled' : '❌ disabled (set ENABLE_SMTP=true to enable)'}`);
  console.log(`   Cache TTL:  ${config.cache.ttlSeconds}s`);
  console.log(`   Rate limit: ${config.rateLimit.max} req / ${config.rateLimit.windowMs / 1000}s\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${config.server.port} is already in use. Set PORT=<other> in .env`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
});

module.exports = server;
