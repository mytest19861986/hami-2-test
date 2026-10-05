import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/plans/index.jsx', import.meta.url), 'utf8');

test('customer plan purchase uses backend catalog, a server capability and the authenticated purchase contract', () => {
  assert.match(source, /benefit-plans/);
  assert.match(source, /normalizeCapabilities/);
  assert.match(source, /capabilityState/);
  assert.match(source, /disabled=\{selectionState !== 'allowed' \|\| purchasingId !== null\}/);
  assert.match(source, /\.post\('\/users\/me\/purchases', \{ planId: item\.id \}\)/);
  assert.match(source, /\/purchases\/\$\{row\.id\}/);
  assert.match(source, /در حال ایجاد خرید/);
  assert.doesNotMatch(source, /confirm-payment|paymentGateway|\/admin\/purchases/);
});

test('plan detail purchase CTA also fails closed without backend capability', () => {
  const detail = fs.readFileSync(new URL('../pages/plans/[id].jsx', import.meta.url), 'utf8');
  assert.match(detail, /api\.get\('\/auth\/me'\)/);
  assert.match(detail, /capabilityState\(capabilities, 'plans\.select'\)/);
  assert.match(detail, /disabled=\{!canSelect \|\| busy\}/);
  assert.match(detail, /ثبت خرید به‌تنهایی پرداخت یا فعال‌سازی عضویت نیست/);
});

test('customer plan selection covers loading, empty, error and degraded states', () => {
  for (const state of ['LoadingState', 'EmptyState', 'ErrorState', 'DegradedState']) assert.match(source, new RegExp(state));
});
