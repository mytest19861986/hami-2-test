import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const page = fs.readFileSync(new URL('../pages/rep-dashboard.jsx', import.meta.url), 'utf8');

test('Wave 29 representative reporting consumes the read-only frozen contract', () => {
  assert.match(page, /rep\/reporting\/summary/);
  assert.match(page, /created_timestamp/);
  assert.match(page, /paid_timestamp/);
  assert.match(page, /currency_groups/);
  assert.match(page, /Active Customer.*Membership Activation.*Paid Commission/);
  assert.doesNotMatch(page, /reduce\(/);
  assert.doesNotMatch(page, /withdrawal_readiness/);
});

test('Wave 29 keeps loading, error, and unauthorized states', () => {
  for (const marker of ['LoadingState', 'ErrorState', 'status === 403', 'period']) assert.match(page, new RegExp(marker));
});
