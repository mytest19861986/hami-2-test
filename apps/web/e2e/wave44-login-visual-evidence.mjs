import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { chromium } from '@playwright/test';

const baseURL = process.env.WAVE44_BASE_URL ?? 'http://127.0.0.1:3102';
const out = process.env.WAVE44_OUT ?? '../../docs/10-quality/evidence/wave-44/frontend-rescue';
const outputDirectory = path.resolve(out);
const failures = [];

await fs.mkdir(outputDirectory, { recursive: true });
const configuredExecutable = process.env.WAVE44_BROWSER_EXECUTABLE;
const executablePath = configuredExecutable && existsSync(configuredExecutable) ? configuredExecutable : undefined;
const browser = await chromium.launch({ headless: true, ...(executablePath ? { executablePath } : {}) });
const page = await browser.newPage();
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') failures.push(`console: ${message.text()}`);
});

async function visitLogin(width, height, name) {
  await page.setViewportSize({ width, height });
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'خوش آمدید' }).count(), 1, `${name}: login heading`);
  assert.equal(await page.getByLabel('شماره همراه').count(), 1, `${name}: phone field`);
  assert.equal(await page.getByLabel('رمز عبور').count(), 1, `${name}: password is the default method`);
  await page.evaluate(() => window.scrollTo(0, 0));
  const dimensions = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(dimensions.scroll <= dimensions.viewport, `${name}: horizontal overflow ${JSON.stringify(dimensions)}`);
  await page.screenshot({ path: path.join(outputDirectory, name), fullPage: true });
  return dimensions;
}

try {
  const desktop = await visitLogin(1440, 900, 'AFTER-login-desktop-1440x900.png');
  const mobile = await visitLogin(390, 844, 'AFTER-login-mobile-390x844.png');

  await page.getByRole('button', { name: 'کد یک‌بارمصرف' }).click();
  assert.equal(await page.getByLabel('رمز عبور').count(), 0, 'OTP request state must not show password');
  assert.equal(await page.getByRole('button', { name: 'درخواست کد' }).count(), 1, 'OTP request CTA is shown');
  const otpDimensions = await page.evaluate(() => ({ viewport: window.innerWidth, scroll: document.documentElement.scrollWidth }));
  assert.ok(otpDimensions.scroll <= otpDimensions.viewport, `mobile OTP state overflow ${JSON.stringify(otpDimensions)}`);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: path.join(outputDirectory, 'AFTER-login-mobile-otp-390x844.png'), fullPage: true });

  await page.goto(`${baseURL}/register`, { waitUntil: 'networkidle' });
  assert.equal(await page.getByRole('heading', { name: 'ثبت‌نام' }).count(), 1, 'shared shell remains available on registration');
  assert.ok(failures.length === 0, `unexpected browser errors: ${failures.join(' | ')}`);
  console.log(JSON.stringify({ result: 'PASS', desktop, mobile, otp: otpDimensions, unexpectedBrowserErrors: failures.length, screenshots: outputDirectory }));
} finally {
  await browser.close();
}
