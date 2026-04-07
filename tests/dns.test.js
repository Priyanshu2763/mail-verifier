'use strict';

const assert = require('assert');
const { checkDns } = require('../src/validators/dns');

let passed = 0;
let failed = 0;

function test(description, fn) {
  try {
    fn();
    console.log(`  ✔  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✖  ${description}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

async function asyncTest(description, fn) {
  try {
    await fn();
    console.log(`  ✔  ${description}`);
    passed++;
  } catch (err) {
    console.error(`  ✖  ${description}`);
    console.error(`     → ${err.message}`);
    failed++;
  }
}

console.log('\n── DNS / MX Validator ────────────────────────────────────');

(async () => {
  await asyncTest('gmail.com has MX records', async () => {
    const r = await checkDns('gmail.com');
    assert.strictEqual(r.hasMx, true, 'Expected MX records for gmail.com');
    assert.ok(r.mxRecords.length > 0, 'Expected at least one MX record');
  });

  await asyncTest('yahoo.com has MX records', async () => {
    const r = await checkDns('yahoo.com');
    assert.strictEqual(r.hasMx, true, 'Expected MX records for yahoo.com');
  });

  await asyncTest('MX records are sorted by priority', async () => {
    const r = await checkDns('gmail.com');
    for (let i = 1; i < r.mxRecords.length; i++) {
      assert.ok(r.mxRecords[i].priority >= r.mxRecords[i - 1].priority, 'MX records should be sorted ascending');
    }
  });

  await asyncTest('Nonexistent domain returns hasMx=false', async () => {
    const r = await checkDns('thisdoaesnotexist99999xyz.com');
    assert.strictEqual(r.hasMx, false, 'Expected NO MX for nonexistent domain');
  });

  await asyncTest('Result contains reason when no MX', async () => {
    const r = await checkDns('thisdoaesnotexist99999xyz.com');
    assert.ok(typeof r.reason === 'string' && r.reason.length > 0, 'Expected a reason string');
  });

  console.log('');
  module.exports = { passed, failed };
})();
