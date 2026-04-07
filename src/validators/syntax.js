'use strict';

const validatorLib = require('validator');

// Common role-based prefixes that are technically valid but risky
const ROLE_PREFIXES = new Set([
  'admin', 'info', 'support', 'noreply', 'no-reply', 'postmaster',
  'webmaster', 'hostmaster', 'abuse', 'root', 'mailer-daemon',
  'bounce', 'contact', 'hello', 'help', 'sales', 'billing',
]);

/**
 * Validate email syntax against RFC 5322 rules.
 * @param {string} email - Raw email address string
 * @returns {{ valid: boolean, reason: string|null, isRole: boolean }}
 */
function validateSyntax(email) {
  if (typeof email !== 'string') {
    return { valid: false, reason: 'Email must be a string', isRole: false };
  }

  const trimmed = email.trim();

  // Basic length guards (RFC 5321: max 254 chars total, local part max 64)
  if (trimmed.length === 0) {
    return { valid: false, reason: 'Email is empty', isRole: false };
  }
  if (trimmed.length > 254) {
    return { valid: false, reason: `Email too long (${trimmed.length} chars, max 254)`, isRole: false };
  }

  const atIdx = trimmed.lastIndexOf('@');
  if (atIdx === -1) {
    return { valid: false, reason: 'Missing @ symbol', isRole: false };
  }

  const localPart = trimmed.slice(0, atIdx);
  const domain = trimmed.slice(atIdx + 1);

  if (localPart.length === 0) {
    return { valid: false, reason: 'Local part (before @) is empty', isRole: false };
  }
  if (localPart.length > 64) {
    return { valid: false, reason: `Local part too long (${localPart.length} chars, max 64)`, isRole: false };
  }
  if (domain.length === 0) {
    return { valid: false, reason: 'Domain (after @) is empty', isRole: false };
  }

  // Consecutive dots not allowed in local part (unless quoted)
  if (localPart.includes('..')) {
    return { valid: false, reason: 'Consecutive dots in local part', isRole: false };
  }

  // Domain must have at least one dot for a TLD
  if (!domain.includes('.')) {
    return { valid: false, reason: 'Domain has no TLD', isRole: false };
  }

  // Domain cannot start or end with hyphen
  if (domain.startsWith('-') || domain.endsWith('-')) {
    return { valid: false, reason: 'Domain cannot start or end with a hyphen', isRole: false };
  }

  // Use validator.js for comprehensive RFC check
  if (!validatorLib.isEmail(trimmed, { allow_utf8_local_part: false, require_tld: true })) {
    return { valid: false, reason: 'Failed RFC 5322 format check', isRole: false };
  }

  // Check for role-based addresses (valid but flagged)
  const localLower = localPart.toLowerCase();
  const isRole = ROLE_PREFIXES.has(localLower);

  return { valid: true, reason: null, isRole };
}

module.exports = { validateSyntax };
