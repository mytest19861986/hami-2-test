import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.B4_BASE_URL ?? 'http://host.docker.internal:8080';
const out = process.env.B4_OUT ?? '/work/temp/review/HC-W6-01/screenshots';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('شماره موبایل').fill('09120000001');
await page.getByLabel('رمز عبور').fill('TEMP-Dev-Password-2026!');
await page.getByRole('button', { name: 'ورود', exact: true }).click();
await page.waitForURL(`${baseURL}/dashboard`);

const routes = [['/providers', 'providers'], ['/plans', 'plans'], ['/purchases', 'purchases'], ['/memberships', 'memberships']];
for (const [route, name] of routes) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  if (page.url().endsWith('/login')) throw new Error(`unauthenticated route: ${route}`);
  await page.screenshot({ path: `${out}/${name}-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/${name}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
}

await page.goto(`${baseURL}/providers`, { waitUntil: 'networkidle' });
const providerLink = page.locator('a[href^="/providers/"]').first();
if (await providerLink.count()) {
  await providerLink.click(); await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${out}/provider-detail-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/provider-detail-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
}
await page.goto(`${baseURL}/plans`, { waitUntil: 'networkidle' });
const planLink = page.locator('a[href^="/plans/"]').first();
if (await planLink.count()) {
  await planLink.click(); await page.waitForLoadState('networkidle');
  await page.screenshot({ path: `${out}/plan-detail-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/plan-detail-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
  await page.getByRole('button', { name: 'خرید طرح' }).click();
  await page.waitForURL(/\/purchases\/.+/);
  await page.getByText('در انتظار پرداخت').waitFor();
  await page.screenshot({ path: `${out}/purchase-detail-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/purchase-detail-1280.png`, fullPage: true });
}
await browser.close();
