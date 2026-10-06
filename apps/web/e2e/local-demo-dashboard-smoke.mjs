import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const baseURL = process.env.LOCAL_DEMO_BASE_URL ?? 'http://localhost:8080';
const localBase = new URL(baseURL);
assert.ok(['localhost', '127.0.0.1'].includes(localBase.hostname), 'local demo browser smoke only permits supported loopback hosts');
assert.equal(localBase.protocol, 'http:', 'local demo browser smoke requires plain HTTP loopback');
assert.ok(['8080', '18080'].includes(localBase.port), 'local demo browser smoke only permits approved local web ports');
assert.equal(localBase.pathname, '/', 'local demo browser smoke expects an origin-only base URL');
assert.equal(localBase.username, '', 'base URL must not contain credentials');
assert.equal(localBase.password, '', 'base URL must not contain credentials');
assert.equal(localBase.search, '', 'base URL must not contain query data');
assert.equal(localBase.hash, '', 'base URL must not contain a fragment');
assert.match(process.env.DEMO_FIXTURE_DB_NAME ?? '', /^local_demo_[a-f0-9]{12}$/, 'expected disposable database identity is required');
assert.equal(process.env.DEMO_FIXTURE_COMPOSE_PROJECT, 'hami-demo-fixture', 'browser smoke requires the dedicated hami-demo-fixture runtime');
assert.equal(process.env.DEMO_FIXTURES_ENABLED, 'true', 'local demo browser smoke requires explicit opt-in');
const password = process.env.DEMO_FIXTURE_PASSWORD;
const browserExecutable = process.env.LOCAL_DEMO_BROWSER_EXECUTABLE;
const accounts = [
  { key: 'ADMIN', route: '/admin', heading: 'مرکز عملیات مدیریت' },
  { key: 'DOCTOR', route: '/providers/me', heading: 'وضعیت همکاری پزشک', content: 'LOCAL DEMO — doctor' },
  { key: 'VISIT', route: '/rep-dashboard', heading: 'گزارش‌دهی همکار فروش' },
  { key: 'USER', route: '/dashboard', heading: 'داشبورد' },
].map((account) => ({ ...account, phone: process.env[`DEMO_FIXTURE_PHONE_${account.key}`] }));

assert.ok(password && password.length >= 16, 'temporary fixture password must be passed through the environment');
for (const account of accounts) assert.ok(account.phone, `DEMO_FIXTURE_PHONE_${account.key} is required`);
assert.notEqual(process.env.NODE_ENV, 'production', 'demo dashboard checks are forbidden in production');

const browser = await chromium.launch({ headless: true, ...(browserExecutable ? { executablePath: browserExecutable } : {}) });
const failures = [];

try {
  for (const account of accounts) {
    const context = await browser.newContext();
    const page = await context.newPage();
    page.on('pageerror', () => failures.push(`${account.key} pageerror`));
    page.on('console', (message) => {
      if (message.type() === 'error') failures.push(`${account.key} console error`);
    });
    page.on('response', (response) => {
      if (response.status() >= 500) failures.push(`${account.key} HTTP ${response.status()}`);
    });

    try {
      await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
      await page.getByLabel('شماره همراه').fill(account.phone);
      await page.getByLabel('رمز عبور').fill(password);
      await page.getByRole('button', { name: 'ورود به حساب' }).click();
      await page.waitForURL('**/dashboard', { timeout: 15_000 });
      await page.goto(`${baseURL}${account.route}`, { waitUntil: 'networkidle' });
      await page.getByRole('heading', { name: account.heading }).waitFor({ state: 'visible', timeout: 15_000 });
      if (account.content) await page.getByText(account.content, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });

      await page.getByRole('button', { name: 'خروج' }).click();
      await page.waitForURL('**/login', { timeout: 15_000 });
      const postLogout = await context.request.get(`${baseURL}/api/v1/auth/me`);
      assert.equal(postLogout.status(), 401, `${account.key} post-logout /auth/me must be 401`);
      console.log(`${account.key}: real UI login PASS; target page PASS; UI logout PASS; post-logout 401 PASS`);
    } finally {
      await context.close();
    }
  }

  assert.deepEqual(failures, [], `unexpected browser errors: ${failures.join(' | ')}`);
  console.log('LOCAL_DEMO_DASHBOARD_SMOKE PASS; credentials and phone numbers were not logged.');
} finally {
  await browser.close();
}
