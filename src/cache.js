'use strict';

const NodeCache = require('node-cache');
const config = require('./config');

const cache = new NodeCache({
  stdTTL: config.cache.ttlSeconds,
  checkperiod: 120,
  useClones: false,
});

/**
 * Normalize an email key for consistent caching
 * @param {string} email
 * @returns {string}
 */
function normalizeKey(email) {
  return email.toLowerCase().trim();
}

/**
 * Get cached validation result
 * @param {string} email
 * @returns {object|undefined}
 */
function get(email) {
  return cache.get(normalizeKey(email));
}

/**
 * Store validation result
 * @param {string} email
 * @param {object} result
 */
function set(email, result) {
  cache.set(normalizeKey(email), result);
}

/**
 * Get cache statistics
 * @returns {object}
 */
function stats() {
  return cache.getStats();
}

module.exports = { get, set, stats };
