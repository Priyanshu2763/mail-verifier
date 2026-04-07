'use strict';

const fs = require('fs');
const path = require('path');

// Load .env file if present (no external deps — parse manually)
const envPath = path.resolve(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const lines = fs.readFileSync(envPath, 'utf8').split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
}

const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
  },
  validation: {
    enableSmtp: process.env.ENABLE_SMTP === 'true',
    dnsTimeoutMs: parseInt(process.env.DNS_TIMEOUT_MS || '5000', 10),
    smtpTimeoutMs: parseInt(process.env.SMTP_TIMEOUT_MS || '10000', 10),
    bulkMaxEmails: parseInt(process.env.BULK_MAX_EMAILS || '50', 10),
  },
  cache: {
    ttlSeconds: parseInt(process.env.CACHE_TTL_SECONDS || '3600', 10),
  },
  rateLimit: {
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
  },
};

module.exports = config;
