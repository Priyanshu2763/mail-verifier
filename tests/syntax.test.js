'use strict';

const assert = require('assert');
const { validateSyntax } = require('../src/validators/syntax');

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

console.log('\n── Syntax Validator ──────────────────────────────────────');

// Valid emails
test('Accepts standard email', () => assert.strictEqual(validateSyntax('user@example.com').valid, true));
test('Accepts email with dots in local part', () => assert.strictEqual(validateSyntax('first.last@example.com').valid, true));
test('Accepts email with plus sign', () => assert.strictEqual(validateSyntax('user+tag@example.com').valid, true));
test('Accepts subdomain email', () => assert.strictEqual(validateSyntax('user@mail.example.co.uk').valid, true));
test('Accepts gmail address', () => assert.strictEqual(validateSyntax('test@gmail.com').valid, true));
test('Detects role-based address', () => {
  const r = validateSyntax('admin@example.com');
  assert.strictEqual(r.valid, true);
  assert.strictEqual(r.isRole, true);
});

// Invalid emails
test('Rejects missing @', () => assert.strictEqual(validateSyntax('notanemail').valid, false));
test('Rejects empty string', () => assert.strictEqual(validateSyntax('').valid, false));
test('Rejects double dots in local part', () => assert.strictEqual(validateSyntax('user..name@example.com').valid, false));
test('Rejects no TLD', () => assert.strictEqual(validateSyntax('user@nodot').valid, false));
test('Rejects empty local part', () => assert.strictEqual(validateSyntax('@example.com').valid, false));
test('Rejects too long email (255+ chars)', () => {
  const long = 'a'.repeat(250) + '@example.com';
  assert.strictEqual(validateSyntax(long).valid, false);
});
test('Rejects non-string input', () => assert.strictEqual(validateSyntax(null).valid, false));

console.log('');
module.exports = { passed, failed };
