import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(path, import.meta.url), 'utf8');

test('FW-01 Phase 7 covers dashboard and wallet component states', () => {
  const dashboard = read('../pages/dashboard.jsx');
  const wallet = read('../pages/wallet.jsx');
  for (const marker of ['Card', 'تراکنش‌های اخیر', 'وضعیت برداشت', 'اعلان‌ها', 'LoadingState', 'ErrorState', 'DegradedState']) {
    assert.match(dashboard, new RegExp(marker));
  }
  for (const marker of ['confirming', 'PAYOUT_UNKNOWN', 'FROZEN', 'disabled={busy}', 'تأیید و ثبت درخواست']) {
    assert.match(wallet, new RegExp(marker.replace(/[{}]/g, '\\$&')));
  }
});

test('FW-01 Phase 7 covers every frozen financial lifecycle state', () => {
  const source = read('../pages/wallet.jsx');
  for (const state of ['PENDING', 'APPROVED', 'PAYOUT_PENDING', 'PAYOUT_UNKNOWN', 'PAID', 'FAILED', 'CANCELLED', 'FROZEN']) {
    assert.match(source, new RegExp(state));
  }
  assert.match(source, /درخواست مجدد|لغو/);
  assert.match(source, /PAYOUT_UNKNOWN[\s\S]{0,1200}(?:نهایی|پیشنهاد)/i);
});

test('FW-01 Phase 7 keeps auth and error boundaries safe', () => {
  const api = read('../lib/api-client.js');
  const auth = read('../components/auth-state.jsx');
  const dashboard = read('../pages/dashboard.jsx');
  assert.match(api, /401|refreshInFlight/);
  assert.match(auth, /session|نشست|منقضی/i);
  for (const marker of ['429', '503', 'retryAfterMs', 'داده مالی']) assert.match(dashboard, new RegExp(marker, 'i'));
  assert.doesNotMatch(dashboard, /console\.log\(.*(?:token|secret|authorization)/i);
});

test('FW-01 Phase 7 preserves RTL, bidi, responsive and Tehran formatting', () => {
  const dashboard = read('../pages/dashboard.jsx');
  const wallet = read('../pages/wallet.jsx');
  assert.match(read('../components/user-shell.jsx'), /rtl/i);
  assert.match(dashboard, /dashboard-grid/);
  assert.match(wallet, /bdi|direction/);
  assert.match(wallet, /Asia\/Tehran/);
});
