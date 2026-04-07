'use strict';

const { validateSyntax } = require('./validators/syntax');
const { checkDisposable } = require('./validators/disposable');
const { checkDns } = require('./validators/dns');
const { checkSmtp } = require('./validators/smtp');
const { checkMicrosoft } = require('./validators/microsoft');
const cache = require('./cache');

/**
 * Compute a confidence score 0–100 based on which layers passed.
 */
function computeScore(layers) {
  let score = 0;
  if (layers.syntax?.valid) score += 25;
  if (layers.disposable && !layers.disposable.isDisposable) score += 15;
  if (layers.dns?.hasMx) score += 35;
  if (layers.dns?.portOpen === true) score += 10;
  
  if (layers.microsoft?.exists === true) score += 15;
  else if (layers.smtp?.exists === true) score += 15;
  else if (layers.smtp?.catchAll === true) score += 5; // give a little for catchall
  
  return Math.min(score, 100);
}

/**
 * Determine top-level verdict from layer results.
 */
function computeVerdict(layers, score) {
  if (!layers.syntax?.valid) return 'INVALID';
  if (layers.disposable?.isDisposable) return 'DISPOSABLE';
  if (!layers.dns?.hasMx) return 'NO_MX';
  
  // Microsoft API verdict
  if (layers.microsoft?.exists === false) return 'INVALID';
  if (layers.microsoft?.exists === true) return 'VALID';

  // SMTP verdict
  if (layers.smtp?.exists === false) return 'INVALID';
  if (layers.smtp?.catchAll === true) return 'UNVERIFIABLE'; // Explicitly mark catch-alls as unverifiable
  if (layers.smtp?.exists === true) return 'VALID';
  if (layers.smtp?.verdict === 'GREYLISTED') return 'RISKY';
  
  if (layers.dns?.portOpen === false) return 'UNVERIFIABLE';
  
  // MX exists, port open (or unknown), SMTP not run → likely valid
  if (score >= 75) return 'VALID';
  if (score >= 50) return 'RISKY';
  return 'UNVERIFIABLE';
}

/**
 * Validate a single email address through the full pipeline.
 * @param {string} email
 * @returns {Promise<object>} Structured validation result
 */
async function validate(email) {
  const startTime = Date.now();
  const normalizedEmail = (email || '').trim().toLowerCase();

  // Check cache first
  const cached = cache.get(normalizedEmail);
  if (cached) {
    return { ...cached, cached: true, duration_ms: Date.now() - startTime };
  }

  const layers = {};

  // ── Layer 1: Syntax ──────────────────────────────────────────
  const syntaxResult = validateSyntax(email);
  layers.syntax = syntaxResult;

  if (!syntaxResult.valid) {
    const result = buildResult(email, false, 0, 'INVALID', layers, startTime);
    cache.set(normalizedEmail, result);
    return { ...result, cached: false };
  }

  // Extract domain for subsequent checks
  const domain = normalizedEmail.slice(normalizedEmail.lastIndexOf('@') + 1);

  // ── Layer 2: Disposable ───────────────────────────────────────
  const disposableResult = checkDisposable(email);
  layers.disposable = disposableResult;

  if (disposableResult.isDisposable) {
    const result = buildResult(email, false, 10, 'DISPOSABLE', layers, startTime);
    cache.set(normalizedEmail, result);
    return { ...result, cached: false };
  }

  // ── Layer 3: DNS / MX ─────────────────────────────────────────
  const dnsResult = await checkDns(domain);
  layers.dns = dnsResult;

  if (!dnsResult.hasMx) {
    const result = buildResult(email, false, 25, 'NO_MX', layers, startTime);
    cache.set(normalizedEmail, result);
    return { ...result, cached: false };
  }

  // ── Layer 3.5: Microsoft API ──────────────────────────────────
  const msResult = await checkMicrosoft(email);
  layers.microsoft = msResult;

  if (msResult.isMicrosoft && msResult.exists !== null) {
    // We got a definitive answer from Microsoft API, skip SMTP
    layers.smtp = null;
  } else {
    // ── Layer 4: SMTP (optional) ──────────────────────────────────
    const primaryMx = dnsResult.mxRecords[0]?.host;
    let smtpResult = await checkSmtp(email, primaryMx);
    
    // Basic greylist retry logic (wait 2.5s and retry once)
    if (smtpResult.verdict === 'GREYLISTED') {
      await new Promise(r => setTimeout(r, 2500));
      smtpResult = await checkSmtp(email, primaryMx);
    }
    
    layers.smtp = smtpResult;
  }

  // ── Final scoring & verdict ───────────────────────────────────
  const score = computeScore(layers);
  const verdict = computeVerdict(layers, score);
  const isValid = verdict === 'VALID';

  const result = buildResult(email, isValid, score, verdict, layers, startTime);
  cache.set(normalizedEmail, result);
  return { ...result, cached: false };
}

function buildResult(email, valid, score, verdict, details, startTime) {
  return {
    email,
    valid,
    score,
    verdict,
    details: {
      syntax: details.syntax || null,
      disposable: details.disposable || null,
      dns: details.dns || null,
      microsoft: details.microsoft || null,
      smtp: details.smtp || null,
    },
    duration_ms: Date.now() - startTime,
  };
}

module.exports = { validate };
