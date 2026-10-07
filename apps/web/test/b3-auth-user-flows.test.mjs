import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = (file) => readFile(new URL(`../${file}`, import.meta.url), 'utf8');

test('B3 route surface is present', async () => {
  for (const route of ['pages/login.jsx', 'pages/register.jsx', 'pages/dashboard.jsx', 'pages/profile.jsx', 'pages/addresses.jsx']) {
    const content = await source(route);
    assert.ok(content.includes('export default'), route);
  }
});

test('B3 auth flows use only verified auth endpoints', async () => {
  const content = await source('components/auth-form.jsx');
  for (const endpoint of ['/auth/login/password', '/auth/login/request-otp', '/auth/login/verify-otp', '/auth/register/request-otp', '/auth/register/verify-otp', '/auth/register/set-password']) assert.match(content, new RegExp(endpoint.replaceAll('/', '\\/')));
  assert.match(content, /accessToken|writeSession/);
  assert.match(content, /confirm/);
});

test('authentication pages share the branded shell and expose login failures assertively', async () => {
  const shell = await source('components/auth-page-shell.jsx');
  const form = await source('components/auth-form.jsx');
  const styles = await source('styles.css');
  const api = await source('lib/api-client.js');
  assert.match(shell, /auth-stage/);
  assert.match(shell, /HamiBrand/);
  assert.match(await source('pages/login.jsx'), /AuthPageShell/);
  assert.match(await source('pages/register.jsx'), /AuthPageShell/);
  assert.match(form, /role=\{messageKind === 'error' \? 'alert' : 'status'\}/);
  assert.match(form, /autoComplete=\{mode === 'register' \? 'new-password' : 'current-password'\}/);
  assert.match(styles, /\.auth-feedback--error/);
  assert.match(styles, /\.auth-submit[\s\S]*?background: var\(--auth-orange\)/);
  assert.match(api, /AUTH_FAILED: 'شماره همراه یا رمز عبور صحیح نیست\.'/);
});

test('B3 API client maps errors and bounds refresh retry', async () => {
  const content = await source('lib/api-client.js');
  for (const status of ['400', '401', '403', '409', '429', 'NETWORK_ERROR']) assert.match(content, new RegExp(status));
  assert.match(content, /retried/);
  assert.match(content, /clearSession/);
});

test('B3 address flow covers CRUD, default, refetch, and geography cascade', async () => {
  const content = await source('pages/addresses.jsx');
  for (const endpoint of ['/users/me/addresses', '/locations/provinces', '/default']) assert.match(content, new RegExp(endpoint.replaceAll('/', '\\/')));
  for (const verb of ['post', 'put', 'delete', 'reload']) assert.match(content, new RegExp(verb));
  assert.match(content, /cityId.*''/);
  assert.match(content, /confirm/);
});

test('B3 protected user flows use real profile and session endpoints', async () => {
  const profile = await source('pages/profile.jsx');
  const shell = await source('components/user-shell.jsx');
  assert.match(profile, /users\/me\/profile/);
  assert.match(shell, /revokeCurrentSession/);
  assert.match(await source('lib/api-client.js'), /api\.post\('\/auth\/logout'/);
  assert.match(shell, /login/);
});
