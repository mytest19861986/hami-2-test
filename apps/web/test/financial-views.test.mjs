import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FW-01 Phase 4 preserves financial view invariants', () => {
  const page = fs.readFileSync(new URL('../pages/wallet.jsx', import.meta.url), 'utf8');
  assert.match(page, /PAYOUT_UNKNOWN/);
  assert.match(page, /FROZEN/);
  assert.match(page, /reference/);
  assert.match(page, /Asia\/Tehran/);
});
