import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';
const baseURL = process.env.B5_BASE_URL ?? 'http://host.docker.internal:8080';
const out = process.env.B5_OUT ?? '/work/temp/review/HC-W6-01/screenshots';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('شماره موبایل').fill('09120000001');
await page.getByLabel('رمز عبور').fill('TEMP-Dev-Password-2026!');
await page.getByRole('button', { name: 'ورود', exact: true }).click();
await page.waitForURL(`${baseURL}/dashboard`);
for (const [route, name] of [['/wallet', 'wallet'], ['/referrals', 'referrals']]) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  if (page.url().endsWith('/login')) throw new Error(`unauthenticated route: ${route}`);
  await page.screenshot({ path: `${out}/${name}-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/${name}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
}
await page.goto(`${baseURL}/wallet`, { waitUntil: 'networkidle' });
await page.getByLabel(/مبلغ/).fill('0');
await page.getByRole('button', { name: 'ثبت درخواست' }).click();
await page.getByText('مبلغ برداشت باید یک عدد صحیح مثبت باشد.').waitFor();
await page.screenshot({ path: `${out}/withdrawal-create-360.png`, fullPage: true });
await browser.close();
