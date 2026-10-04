import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/purchases/index.jsx', import.meta.url), 'utf8');

test('purchase history displays backend refund-case state without a financial refund action', () => {
  assert.match(source, /users\/me\/purchases/);
  assert.match(source, /validityDaysSnapshot/);
  assert.match(source, /labelStatus/);
  assert.match(source, /refundCase/);
  assert.match(source, /بازپرداخت مالی انجام نشده است/);
  assert.doesNotMatch(source, /admin\/purchases\/.*\/refund|paymentGateway|confirm-payment|renew|پرداخت جدید/i);
});

test('purchase history covers loading, empty, error and degraded states', () => {
  for (const state of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState']) assert.match(source, new RegExp(state));
});
