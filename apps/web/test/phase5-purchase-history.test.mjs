import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/purchases/index.jsx', import.meta.url), 'utf8');

test('purchase history is read-only and backend authoritative', () => {
  assert.match(source, /users\/me\/purchases/);
  assert.match(source, /validityDaysSnapshot/);
  assert.match(source, /labelStatus/);
  assert.doesNotMatch(source, /confirm-payment|refund|renew|paymentGateway|پرداخت جدید/i);
});

test('purchase history covers loading, empty, error and degraded states', () => {
  for (const state of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState']) assert.match(source, new RegExp(state));
});
