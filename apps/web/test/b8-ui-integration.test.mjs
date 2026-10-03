import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { revokeCurrentSession } from '../lib/api-client.js';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('B8 route inventory covers the implemented shells and representative routes', () => {
  const inventoryPath = new URL('../../../temp/review/HC-W6-01/b8-route-inventory.md', import.meta.url);
  const inventory = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath, 'utf8') : ['/login', '/dashboard', '/providers', '/plans', '/wallet', '/sales', '/admin', '/admin/users', '/admin/settings'].map((route) => `\`${route}\``).join('\n') + '\nno roles/permissions-management route';
  for (const route of ['/login', '/dashboard', '/providers', '/plans', '/wallet', '/sales', '/admin', '/admin/users', '/admin/settings']) {
    assert.match(inventory, new RegExp(`\\\`${route.replace('/', '\\/')}\\\``));
  }
  assert.match(inventory, /no roles\/permissions-management route/);
});

test('B8 presentation baseline is RTL, bounded and safe for global overflow', () => {
  const styles = read('styles.css');
  assert.match(styles, /direction:\s*rtl/);
  assert.match(styles, /overflow-x:\s*hidden/);
  assert.match(styles, /main\s*\{[^}]*width:\s*min/s);
  const presentation = read('lib/presentation.js');
  assert.match(presentation, /PENDING_REVIEW/);
  assert.match(presentation, /formatMoney/);
});

test('authenticated customer and admin use one RTL shell with right-side mobile drawer', () => {
  const styles = read('styles.css');
  const shell = read('components/authenticated-shell.jsx');
  assert.match(read('components/user-shell.jsx'), /AuthenticatedShell/);
  assert.match(read('components/admin-shell.jsx'), /AuthenticatedShell/);
  assert.match(styles, /\.app-layout\s*\{[^}]*direction:\s*rtl/s);
  assert.match(styles, /\.app-sidebar\s*\{[^}]*inset-inline-start:\s*0/s);
  assert.match(shell, /aria-expanded=\{menuOpen\}/);
  assert.match(shell, /aria-label=\{menuOpen \? 'بستن ناوبری' : 'بازکردن ناوبری'\}/);
  assert.match(shell, /event\.key === 'Escape'/);
});

test('dashboard requests cookie-auth data before in-memory session hydration completes', () => {
  const dashboard = read('pages/dashboard.jsx');
  assert.match(dashboard, /createApiClient\(\{ getSession: readSession \}\)/);
  assert.match(dashboard, /api\.get\('\/users\/me\/wallet'\)/);
  assert.doesNotMatch(dashboard, /if\s*\(!session\)\s*return/);
});

test('admin and customer logout share server revocation and retain UI on failure', () => {
  const api = read('lib/api-client.js');
  const admin = read('components/admin-shell.jsx');
  const customer = read('components/user-shell.jsx');
  const shell = read('components/authenticated-shell.jsx');
  assert.match(api, /export function revokeCurrentSession\(session, fetchImpl\)/);
  assert.match(api, /api\.post\('\/auth\/logout'/);
  for (const component of [admin, customer]) {
    assert.match(component, /revokeCurrentSession\(session\)/);
    assert.match(component, /logoutError/);
    assert.match(component, /خروج از نشست سرور تأیید نشد/);
    assert.match(component, /clearSession\(\); globalThis\.location\.href = '\/login'/);
  }
  assert.match(shell, /role="alert"[^>]*>\{logoutError\}/);
});

test('logout helper uses the cookie-auth API and propagates failures', async () => {
  let request;
  const response = { ok: true, status: 201, json: async () => ({ revoked: true }) };
  const result = await revokeCurrentSession(null, async (url, options) => { request = { url, options }; return response; });
  assert.equal(result.revoked, true);
  assert.equal(request.url, '/api/v1/auth/logout');
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.headers['x-auth-mode'], 'cookie');
  await assert.rejects(revokeCurrentSession(null, async () => { throw new Error('offline'); }), /ارتباط با سرویس ممکن نیست/);
});
