'use strict';

const fs = require('fs');
const path = require('path');

// Load the disposable domains list into a Set for O(1) lookup
let disposableSet = null;

function loadDisposableDomains() {
  if (disposableSet) return disposableSet;
  const filePath = path.resolve(__dirname, '..', 'data', 'disposable-domains.txt');
  if (!fs.existsSync(filePath)) {
    console.warn('[disposable] Warning: disposable-domains.txt not found — disposable check skipped');
    disposableSet = new Set();
    return disposableSet;
  }
  const lines = fs.readFileSync(filePath, 'utf8').split('\n');
  disposableSet = new Set(
    lines
      .map(l => l.trim().toLowerCase())
      .filter(l => l.length > 0 && !l.startsWith('#'))
  );
  return disposableSet;
}

/**
 * Check if an email's domain is a known disposable/throwaway provider.
 * @param {string} email - Full email address
 * @returns {{ isDisposable: boolean, domain: string }}
 */
function checkDisposable(email) {
  const domains = loadDisposableDomains();
  const atIdx = email.lastIndexOf('@');
  if (atIdx === -1) return { isDisposable: false, domain: '' };

  const domain = email.slice(atIdx + 1).toLowerCase().trim();

  // Direct match
  if (domains.has(domain)) {
    return { isDisposable: true, domain };
  }

  // Subdomain check — e.g. mail.mailinator.com
  const parts = domain.split('.');
  if (parts.length > 2) {
    const rootDomain = parts.slice(-2).join('.');
    if (domains.has(rootDomain)) {
      return { isDisposable: true, domain };
    }
  }

  return { isDisposable: false, domain };
}

module.exports = { checkDisposable };
