#!/bin/bash
# =============================================================
#  Email Validator — Test Runner
# =============================================================

set -e
cd "$(dirname "$0")/.."

PASS=0
FAIL=0
TOTAL=0

run_test() {
  local FILE="$1"
  echo "Running $FILE..."
  OUTPUT=$(node "$FILE" 2>&1)
  echo "$OUTPUT"
  PASS=$((PASS + $(echo "$OUTPUT" | grep -c "✔" || true)))
  FAIL=$((FAIL + $(echo "$OUTPUT" | grep -c "✖" || true)))
}

echo "============================================"
echo "  Email Validator Test Suite"
echo "============================================"

run_test "tests/syntax.test.js"
run_test "tests/disposable.test.js"
run_test "tests/dns.test.js"
run_test "tests/validator.test.js"

TOTAL=$((PASS + FAIL))
echo "============================================"
echo "  Results: $PASS passed / $FAIL failed / $TOTAL total"
echo "============================================"

if [ "$FAIL" -gt 0 ]; then
  echo "  ❌ Some tests FAILED."
  exit 1
else
  echo "  ✅ All tests PASSED."
  exit 0
fi
