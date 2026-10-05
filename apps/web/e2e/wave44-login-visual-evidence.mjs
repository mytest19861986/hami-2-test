import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseURL = process.env.WAVE44_BASE_URL ?? 'http://127.0.0.1:3102';
const out = process.env.WAVE44_OUT ?? '../../docs/10-quality/evidence/wave-44/frontend-rescue';
const outputDirectory = path.resolve(out);
const failures = [];
let expectedAuthErrorInProgress = false;
const invalidPhone = process.env.WAVE44_TEST_PHONE;
const invalidPassword = process.env.WAVE44_TEST_PASSWORD;
assert.ok(invalidPhone && invalidPassword, 'temporary invalid form values must be passed through the environment');

await fs.mkdir(outputDirectory, { recursive: true });
const configuredExecutable = process.env.WAVE44_BROWSER_EXECUTABLE;
const executablePath = configuredExecutable && existsSync(configuredExecutable) ? configuredExecutable : undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage();
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error' && !(expectedAuthErrorInProgress && message.text().includes('401 (Unauthorized)'))) {
    failures.push(`console: ${message.text()}`);
  }
});
page.on('response', (response) => {
  const expectedAuthError = response.status() === 401 && new URL(response.url()).pathname.endsWith('/api/v1/auth/login/password');
  if (response.status() >= 400 && !expectedAuthError) failures.push(`http ${response.status()}: ${response.url()}`);
});

async function visitLogin(width, height, name) {
  await page.setViewportSize({ width, height });
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'خوش آمدید' }).count(), 1, `${name}: login heading`);
  assert.equal(await page.getByLabel('شماره همراه').count(), 1, `${name}: phone field`);
  assert.equal(await page.getByLabel('رمز عبور').count(), 1, `${name}: password is the default method`);
  await page.evaluate(() => window.scrollTo(0, 0));
  const dimensions = await page.evaluate(() => {
    const shell = document.querySelector('.auth-shell').getBoundingClientRect();
    const brand = document.querySelector('.auth-brand-panel').getBoundingClientRect();
    const footerLink = document.querySelector('.auth-footer-link').getBoundingClientRect();
    const methodOption = document.querySelector('.auth-method-option').getBoundingClientRect();
    const submit = document.querySelector('.auth-submit').getBoundingClientRect();
    return {
      viewport: window.innerWidth,
      scroll: document.documentElement.scrollWidth,
      brandRatio: brand.width / shell.width,
      footerLinkHeight: footerLink.height,
      methodOptionHeight: methodOption.height,
      submitHeight: submit.height,
    };
  });
  assert.ok(dimensions.scroll <= dimensions.viewport, `${name}: horizontal overflow ${JSON.stringify(dimensions)}`);
  if (width > 760) assert.ok(dimensions.brandRatio >= 0.42 && dimensions.brandRatio <= 0.45, `${name}: brand panel ratio ${dimensions.brandRatio}`);
  assert.ok(dimensions.footerLinkHeight >= 44, `${name}: registration touch target ${dimensions.footerLinkHeight}px`);
  assert.ok(dimensions.methodOptionHeight >= 44, `${name}: method touch target ${dimensions.methodOptionHeight}px`);
  assert.ok(dimensions.submitHeight >= 48, `${name}: primary action height ${dimensions.submitHeight}px`);
  await page.screenshot({ path: path.join(outputDirectory, name), fullPage: true });
  return dimensions;
}

try {
  const desktop = await visitLogin(1440, 900, 'AFTER-login-desktop-1440x900.png');
  const mobile = await visitLogin(390, 844, 'AFTER-login-mobile-390x844.png');

  await page.getByRole('button', { name: 'کد یک‌بارمصرف' }).click();
  assert.equal(await page.getByRole('button', { name: 'کد یک‌بارمصرف' }).getAttribute('aria-pressed'), 'true', 'OTP method state must be announced');
  assert.equal(await page.getByLabel('رمز عبور').count(), 0, 'OTP request state must not show password');
  assert.equal(await page.getByRole('button', { name: 'درخواست کد' }).count(), 1, 'OTP request CTA is shown');
  const otpDimensions = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(otpDimensions.scroll <= otpDimensions.viewport, `mobile OTP state overflow ${JSON.stringify(otpDimensions)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(outputDirectory, 'AFTER-login-mobile-otp-390x844.png'), fullPage: true });

  await page.goto(`${baseURL}/register`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'ثبت‌نام' }).count(), 1, 'shared shell remains available on registration');

  await page.route('**/api/v1/auth/login/password', (route) => route.fulfill({
    status: 401,
    contentType: 'application/json',
    body: JSON.stringify({ error: 'INVALID_CREDENTIALS' }),
  }));
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('شماره همراه').fill(invalidPhone);
  await page.getByLabel('رمز عبور').fill(invalidPassword);
  expectedAuthErrorInProgress = true;
  await page.getByRole('button', { name: 'ورود به حساب' }).click();
  const loginError = page.locator('.auth-status--error');
  await loginError.waitFor({ state: 'visible' });
  assert.match(await loginError.getAttribute('class'), /auth-status--error/, 'login errors use explicit error styling');
  assert.equal(await loginError.getAttribute('role'), 'alert', 'login errors are announced assertively');
  expectedAuthErrorInProgress = false;
  assert.ok(failures.length === 0, `unexpected browser errors: ${failures.join(' | ')}`);
  console.log(JSON.stringify({ result: 'PASS', desktop, mobile, otp: otpDimensions, unexpectedBrowserErrors: failures.length, screenshots: outputDirectory }));
} finally {
  await browser.close();
}
