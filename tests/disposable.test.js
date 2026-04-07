'use strict';

const assert = require('assert');
const { checkDisposable } = require('../src/validators/disposable');

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

console.log('\n── Disposable Domain Checker ─────────────────────────────');

test('Detects mailinator.com as disposable', () => {
  assert.strictEqual(checkDisposable('user@mailinator.com').isDisposable, true);
});
test('Detects guerrillamail.com as disposable', () => {
  assert.strictEqual(checkDisposable('user@guerrillamail.com').isDisposable, true);
});
test('Detects yopmail.com as disposable', () => {
  assert.strictEqual(checkDisposable('user@yopmail.com').isDisposable, true);
});
test('gmail.com is NOT disposable', () => {
  assert.strictEqual(checkDisposable('user@gmail.com').isDisposable, false);
});
test('outlook.com is NOT disposable', () => {
  assert.strictEqual(checkDisposable('user@outlook.com').isDisposable, false);
});
test('Returns domain in result', () => {
  const r = checkDisposable('x@mailinator.com');
  assert.strictEqual(r.domain, 'mailinator.com');
});

console.log('');
module.exports = { passed, failed };
