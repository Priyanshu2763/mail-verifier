'use strict';

const dns = require('dns').promises;
const net = require('net');
const config = require('../config');

/**
 * Look up MX records for a domain and optionally probe port 25 reachability.
 * @param {string} domain
 * @returns {Promise<{ hasMx: boolean, mxRecords: Array, portOpen: boolean|null, reason: string|null }>}
 */
async function checkDns(domain) {
  // Wrap DNS lookup in a timeout
  let mxRecords;
  try {
    mxRecords = await Promise.race([
      dns.resolveMx(domain),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('DNS_TIMEOUT')), config.validation.dnsTimeoutMs)
      ),
    ]);
  } catch (err) {
    if (err.message === 'DNS_TIMEOUT') {
      return { hasMx: false, mxRecords: [], portOpen: null, reason: 'DNS lookup timed out' };
    }
    // ENOTFOUND, ENODATA, ESERVFAIL etc.
    const code = err.code || err.message;
    return { hasMx: false, mxRecords: [], portOpen: null, reason: `DNS error: ${code}` };
  }

  if (!mxRecords || mxRecords.length === 0) {
    return { hasMx: false, mxRecords: [], portOpen: null, reason: 'No MX records found' };
  }

  // Sort by priority (lower = higher pref)
  const sorted = mxRecords
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map(r => ({ host: r.exchange, priority: r.priority }));

  // Quick TCP port-25 reachability check on primary MX (non-blocking, no SMTP handshake)
  const primaryMx = sorted[0].host;
  const portOpen = await probeTcpPort(primaryMx, 25, 3000);

  return {
    hasMx: true,
    mxRecords: sorted,
    portOpen,
    reason: null,
  };
}

/**
 * Attempt a TCP connection to host:port and return true if successful.
 * Closes the socket immediately — never sends data.
 * @param {string} host
 * @param {number} port
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
function probeTcpPort(host, port, timeoutMs) {
  return new Promise(resolve => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (result) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };

    socket.setTimeout(timeoutMs);
    socket.on('connect', () => finish(true));
    socket.on('timeout', () => finish(false));
    socket.on('error', () => finish(false));

    socket.connect(port, host);
  });
}

module.exports = { checkDns };
