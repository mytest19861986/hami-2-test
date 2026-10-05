/* global document, window, getComputedStyle */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseURL = process.env.WAVE41_BASE_URL || 'http://127.0.0.1:8081';
const phone = process.env.WAVE41_SUPPORT_PHONE;
const password = process.env.WAVE41_SUPPORT_PASSWORD;
const outputDir = process.env.WAVE41_EVIDENCE_DIR || path.resolve('docs/10-quality/evidence/wave-41/current-build');
const requiredPermissions = [
  'support.dashboard.read',
  'support.users.read',
  'support.providers.read',
  'support.purchases.read',
  'support.memberships.read',
  'support.redemptions.read',
  'support.refund_cases.read',
].sort();

if (!phone || !password) {
  throw new Error('Set WAVE41_SUPPORT_PHONE and WAVE41_SUPPORT_PASSWORD in the local process environment; values are never logged or read from source files.');
}

await fs.mkdir(outputDir, { recursive: true });
const browserEnv = { ...process.env };
delete browserEnv.WAVE41_SUPPORT_PHONE;
delete browserEnv.WAVE41_SUPPORT_PASSWORD;
const configuredExecutable = process.env.WAVE41_BROWSER_EXECUTABLE;
const executablePath = configuredExecutable && existsSync(configuredExecutable) ? configuredExecutable : undefined;
const browser = await chromium.launch({ headless: true, env: browserEnv, ...(executablePath ? { executablePath } : {}) });
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let consoleErrorCount = 0;
const consoleErrorEvidence = [];
let authenticated = false;
let stage = 'browser-launch';
let drawerMetrics;
page.on('console', (message) => {
  if (message.type() === 'error') {
    const location = message.location();
    let pathname = 'unknown';
    try { pathname = new URL(location.url).pathname; } catch { /* Keep only a sanitized path. */ }
    const expectedUnauthorized401Noise = ['anonymous-auth-check', 'logout-redirect'].includes(stage) && pathname === '/api/v1/auth/me';
    consoleErrorEvidence.push({ type: 'console', pathname, stage, classification: expectedUnauthorized401Noise ? 'expected-unauthorized-401' : 'unexpected' });
    if (!expectedUnauthorized401Noise) consoleErrorCount += 1;
  }
});
page.on('pageerror', () => { consoleErrorCount += 1; consoleErrorEvidence.push({ type: 'pageerror', stage }); });

try {
  stage = 'open-login';
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  stage = 'anonymous-auth-check';
  const anonymousStatus = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
  assert.equal(anonymousStatus, 401, 'fresh context must be unauthenticated before login');

  stage = 'password-login';
  await page.getByLabel('شماره موبایل').fill(phone);
  await page.getByLabel('رمز عبور').fill(password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  stage = 'wait-support-dashboard';
  await page.waitForURL((url) => url.pathname === '/support', { timeout: 20_000 });
  await page.locator('.support-dashboard').waitFor({ state: 'visible', timeout: 15_000 });
  authenticated = true;

  stage = 'verify-auth-contract';
  const auth = await page.evaluate(async () => {
    const response = await fetch('/api/v1/auth/me', { credentials: 'include' });
    const body = await response.json();
    const roles = (body.roles || []).map((link) => link?.role?.name).filter(Boolean);
    const permissions = (body.roles || []).flatMap((link) => (link?.role?.permissions || []).map(({ permission }) => `${permission.resource}.${permission.action}`));
    return { status: response.status, roles, permissions: [...new Set(permissions)].sort() };
  });
  assert.equal(auth.status, 200, 'authenticated /auth/me must return 200');
  assert.ok(auth.roles.includes('SUPPORT'), 'authenticated user must have SUPPORT role');
  assert.ok(!auth.roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(role)), 'fixture must not use an Admin role');
  assert.deepEqual(auth.permissions, requiredPermissions, 'fixture must have exactly the seven read-only Support permissions');

  const audit = [];
  const checkLayout = async (width, height, suffix) => {
    await page.setViewportSize({ width, height });
    await page.goto(`${baseURL}/support`, { waitUntil: 'networkidle' });
    await page.locator('.support-dashboard').waitFor({ state: 'visible', timeout: 15_000 });
    const layout = await page.evaluate(() => {
      const sidebar = document.querySelector('.app-sidebar')?.getBoundingClientRect();
      const content = document.querySelector('.app-content')?.getBoundingClientRect();
      const root = document.documentElement;
      return {
        viewportWidth: window.innerWidth,
        scrollWidth: root.scrollWidth,
        rtl: getComputedStyle(document.querySelector('.app-layout')).direction === 'rtl',
        sidebarLeft: sidebar?.left,
        sidebarRight: sidebar?.right,
        contentRight: content?.right,
        emptySummaryCount: document.querySelectorAll('.support-summary-empty').length,
        adminLinks: document.querySelectorAll('a[href^="/admin"]').length,
      };
    });
    assert.equal(layout.rtl, true, 'authenticated shell must have RTL layout direction');
    assert.ok(layout.scrollWidth <= layout.viewportWidth, `horizontal overflow at ${width}px`);
    assert.equal(layout.adminLinks, 0, 'Support navigation must not expose Admin links');
    if (width === 1440) assert.ok(layout.sidebarLeft >= layout.contentRight - 1, 'desktop sidebar must sit to the right of main content');
    await page.screenshot({ path: path.join(outputDir, `support-${suffix}.png`) });
    audit.push({ viewport: `${width}x${height}`, overflow: false, rtl: layout.rtl, emptySummaryCount: layout.emptySummaryCount, adminLinks: layout.adminLinks });
  };

  await checkLayout(1440, 900, 'desktop-1440x900');
  await checkLayout(390, 844, 'mobile-390x844');
  stage = 'mobile-drawer';
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const opener = page.getByRole('button', { name: 'بازکردن ناوبری' });
  await opener.focus();
  await page.getByRole('button', { name: 'بازکردن ناوبری' }).click();
  stage = 'drawer-visible';
  await page.locator('.app-sidebar--open').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const sidebar = document.querySelector('.app-sidebar--open');
    return sidebar && getComputedStyle(sidebar).visibility === 'visible' && getComputedStyle(sidebar).transform === 'matrix(1, 0, 0, 1, 0, 0)';
  });
  const drawer = await page.locator('.app-sidebar').evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { left: rect.left, right: rect.right, width: rect.width, viewport: window.innerWidth, scrollWidth: document.documentElement.scrollWidth };
  });
  drawerMetrics = drawer;
  stage = 'drawer-right-edge-check';
  assert.ok(Math.abs(drawer.right - 390) <= 1, 'mobile drawer must be anchored to the right viewport edge');
  stage = 'drawer-bounds-check';
  assert.ok(drawer.left >= 0 && drawer.width > 0, 'mobile drawer must be fully within the viewport');
  const drawerAccessibility = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    firstLinkFocused: document.activeElement === document.querySelector('.app-sidebar a[href]'),
    transitionDuration: getComputedStyle(document.querySelector('.app-sidebar')).transitionDuration,
  }));
  assert.equal(drawerAccessibility.bodyOverflow, 'hidden', 'background scroll must lock while drawer is open');
  assert.equal(drawerAccessibility.firstLinkFocused, true, 'opening drawer must focus its first link');
  assert.equal(drawerAccessibility.transitionDuration, '0s', 'reduced-motion preference must disable drawer transition');
  stage = 'drawer-overflow-check';
  await page.screenshot({ path: path.join(outputDir, 'support-mobile-drawer-390x844.png') });
  assert.ok(drawer.scrollWidth <= drawer.viewport, 'open mobile drawer must not create horizontal overflow');
  await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.app-sidebar a[href]:last-of-type')), true, 'Shift+Tab from first link must wrap to last link');
  await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('.app-sidebar a[href]')), true, 'Tab from last link must wrap to first link');
  await page.keyboard.press('Escape');
  await page.locator('.app-sidebar--open').waitFor({ state: 'hidden' });
  const closedDrawerAccessibility = await page.evaluate(() => ({
    bodyOverflow: document.body.style.overflow,
    triggerFocused: document.activeElement === document.querySelector('.navigation-toggle'),
  }));
  assert.equal(closedDrawerAccessibility.bodyOverflow, '', 'background scroll lock must be restored when drawer closes');
  assert.equal(closedDrawerAccessibility.triggerFocused, true, 'Escape must return focus to the drawer trigger');
  stage = 'console-error-check';
  assert.equal(consoleErrorCount, 0, 'no unexpected browser console/page errors');

  stage = 'logout';
  const logoutResponsePromise = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/v1/auth/logout', { timeout: 10_000 });
  await page.getByRole('button', { name: 'خروج' }).click();
  const logoutResponse = await logoutResponsePromise;
  stage = `logout-http-${logoutResponse.status()}`;
  assert.ok([200, 201].includes(logoutResponse.status()), 'real logout endpoint must confirm session revocation');
  stage = 'logout-redirect';
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 15_000 });
  const postLogoutStatus = await page.evaluate(async () => (await fetch('/api/v1/auth/me', { credentials: 'include' })).status);
  assert.equal(postLogoutStatus, 401, 'real logout must revoke the test session');
  authenticated = false;

  console.log(JSON.stringify({
    status: 'PASS',
    baseURL,
    anonymousAuthMe: anonymousStatus,
    authenticatedAuthMe: auth.status,
    postLogoutAuthMe: postLogoutStatus,
    roles: auth.roles,
    permissions: auth.permissions,
    viewports: audit,
    drawer: { anchoredRight: true, horizontalOverflow: false },
    consoleErrors: consoleErrorCount,
    consoleEvents: consoleErrorEvidence,
    classifiedExpectedConsoleEvents: consoleErrorEvidence.filter((event) => event.classification === 'expected-unauthorized-401').length,
    screenshots: ['support-desktop-1440x900.png', 'support-mobile-390x844.png', 'support-mobile-drawer-390x844.png'],
  }, null, 2));
} catch (error) {
  const safeError = ['TimeoutError', 'AssertionError', 'Error'].includes(error?.name) ? error.name : 'UnknownError';
  console.log(JSON.stringify({ status: 'FAIL', stage, error: safeError, ...(stage.startsWith('drawer-') ? { drawer: drawerMetrics } : {}), ...(stage === 'console-error-check' ? { consoleErrors: consoleErrorEvidence } : {}) }));
  process.exitCode = 1;
} finally {
  if (authenticated) {
    try {
      await page.getByRole('button', { name: 'خروج' }).click({ timeout: 3_000 });
      await page.waitForURL((url) => url.pathname === '/login', { timeout: 5_000 });
    } catch { /* The one-shot runner revokes sessions created during this attempt. */ }
  }
  await context.close();
  await browser.close();
}
  stage = 'capture-layouts';
