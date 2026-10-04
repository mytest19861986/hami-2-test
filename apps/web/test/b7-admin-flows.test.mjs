import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs';
const root = new URL('..', import.meta.url); const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
test('B7 admin route surface is permission-based and uses real contracts', () => { const shell = read('components/admin-shell.jsx'); assert.match(shell, /can\(session, permission\)/); assert.match(read('pages/admin/users.jsx'), /admin\/users/); assert.match(read('pages/admin/providers.jsx'), /admin\/providers/); assert.match(read('pages/admin/commissions.jsx'), /admin\/commissions/); assert.match(read('pages/admin/settings.jsx'), /admin\/commercial-settings/); });
test('B7 admin UI does not invent role/report capability', () => { const page = read('pages/admin/index.jsx'); assert.match(page, /metric ساختگی/); assert.doesNotMatch(page, /roles|permissions|reports/i); });
test('support surface uses its own read-only allowlisted API contracts and shared RTL shell', () => {
  const page = read('pages/support/index.jsx'); const shell = read('components/support-shell.jsx'); const session = read('lib/session.js'); const api = read('../api/src/main.mjs');
  for (const endpoint of ['/support/summary', '/support/users', '/support/providers', '/support/purchases', '/support/memberships', '/support/redemptions', '/support/refund-cases']) assert.ok(page.includes(endpoint), endpoint);
  assert.match(shell, /support\.dashboard\.read/); assert.match(shell, /AuthenticatedShell/); assert.match(session, /permission\.startsWith\('support\.'\)/);
  assert.match(api, /if \(supportOnly && !canSupport\(permission\)\) throw new Error\('FORBIDDEN'\)/);
  assert.doesNotMatch(page, /api\.(post|patch|put|delete)\s*\(/i);
  assert.doesNotMatch(page, /'phone'|'nationalId'|'amountSnapshot'|'customerUserId'|'doctorNationalId'/i);
  assert.match(read('components/auth-form.jsx'), /supportOnly \? '\/support' : '\/dashboard'/);
});
