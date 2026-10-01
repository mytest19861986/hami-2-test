import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('FW-01 Phase 3 dashboard freezes financial display rules', () => {
  const page = fs.readFileSync(new URL('../pages/dashboard.jsx', import.meta.url), 'utf8');
  assert.match(page, /PAYOUT_UNKNOWN/);
  assert.match(page, /feeTypes/);
  assert.ok(page.includes('/users/me/wallet'));
  assert.ok(page.includes('Asia/Tehran'));
});
