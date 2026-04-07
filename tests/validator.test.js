'use strict';

const assert = require('assert');
const { validate } = require('../src/validator');

let passed = 0;
let failed = 0;

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

console.log('\n── End-to-End Orchestrator ───────────────────────────────');

(async () => {
  await asyncTest('Valid email with real domain → verdict not INVALID/NO_MX', async () => {
    const r = await validate('test@gmail.com');
    assert.notStrictEqual(r.verdict, 'INVALID');
    assert.notStrictEqual(r.verdict, 'NO_MX');
  });

  await asyncTest('Disposable email returns verdict DISPOSABLE', async () => {
    const r = await validate('user@mailinator.com');
    assert.strictEqual(r.verdict, 'DISPOSABLE');
    assert.strictEqual(r.valid, false);
  });

  await asyncTest('Fake domain returns NO_MX', async () => {
    const r = await validate('user@thisdoesnotexist99999xyz.com');
    assert.strictEqual(r.verdict, 'NO_MX');
    assert.strictEqual(r.valid, false);
  });

  await asyncTest('Bad syntax returns INVALID', async () => {
    const r = await validate('notanemail');
    assert.strictEqual(r.verdict, 'INVALID');
    assert.strictEqual(r.valid, false);
  });

  await asyncTest('Result has required fields', async () => {
    const r = await validate('test@gmail.com');
    assert.ok('email' in r);
    assert.ok('valid' in r);
    assert.ok('score' in r);
    assert.ok('verdict' in r);
    assert.ok('details' in r);
    assert.ok('duration_ms' in r);
    assert.ok('cached' in r);
  });

  await asyncTest('Score is between 0 and 100', async () => {
    const r = await validate('test@gmail.com');
    assert.ok(r.score >= 0 && r.score <= 100, `Score ${r.score} out of range`);
  });

  await asyncTest('Result is cached on second call', async () => {
    await validate('cached-test@gmail.com');
    const r2 = await validate('cached-test@gmail.com');
    assert.strictEqual(r2.cached, true);
  });

  console.log('');
  module.exports = { passed, failed };
})();
