import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/purchases/[id].jsx', import.meta.url), 'utf8');

test('payment result is backend-driven and only requests an internal refund case', () => {
  assert.match(source, /users\/me\/purchases/);
  assert.match(source, /PENDING_PAYMENT/);
  assert.match(source, /PAYMENT_UNKNOWN|UNKNOWN/);
  assert.match(source, /بازخوانی وضعیت/);
  assert.match(source, /refund-case/);
  assert.doesNotMatch(source, /confirm-payment|paymentGateway|refundReference|admin\/purchases\/.*\/refund|پرداخت واقعی/);
});

test('payment result covers success, pending, failed/unknown, empty and degraded states', () => {
  for (const state of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState', 'resultText']) assert.match(source, new RegExp(state));
});

test('payment and activation states remain separate in customer-facing result', () => {
  assert.match(source, /وضعیت فعال‌سازی/);
  assert.match(source, /فعال‌سازی در انتظار تصمیم جداگانه است/);
  assert.match(source, /بازپرداخت خودکار انجام نمی‌شود/);
});
