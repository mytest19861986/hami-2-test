import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const read = (file) => fs.readFileSync(new URL(file, import.meta.url), 'utf8');

test('customer dashboard remains backend-driven and fail-safe', () => {
  const source = read('../pages/dashboard.jsx');
  assert.match(source, /users\/me\/wallet/);
  assert.match(source, /users\/me\/wallet\/withdrawals/);
  assert.match(source, /PAYOUT_UNKNOWN/);
  assert.match(source, /DegradedState/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
});

test('customer shell provides the approved portal navigation and cookie logout', () => {
  const source = read('../components/user-shell.jsx');
  assert.match(source, /داشبورد/);
  assert.match(source, /کیف پول/);
  assert.match(source, /revokeCurrentSession/);
  const api = read('../lib/api-client.js');
  assert.match(api, /api\.post\('\/auth\/logout'/);
});
