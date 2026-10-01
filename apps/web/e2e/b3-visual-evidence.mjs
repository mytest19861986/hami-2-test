import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.B3_BASE_URL ?? 'http://host.docker.internal:8080';
const out = process.env.B3_OUT ?? '/work/temp/review/HC-W6-01/screenshots';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/dashboard-360.png`, fullPage: true });
await page.getByLabel('شماره موبایل').fill('09120000001');
await page.getByLabel('رمز عبور').fill('TEMP-Dev-Password-2026!');
await page.getByRole('button', { name: 'ورود', exact: true }).click();
await page.waitForURL(`${baseURL}/dashboard`);
for (const [route, name] of [['/dashboard','dashboard'], ['/profile','profile'], ['/addresses','addresses']]) {
  await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: `${out}/${name}-360.png`, fullPage: true });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.screenshot({ path: `${out}/${name}-1280.png`, fullPage: true });
  await page.setViewportSize({ width: 360, height: 800 });
}
await page.goto(`${baseURL}/addresses`, { waitUntil: 'networkidle' });
await page.screenshot({ path: `${out}/address-create-360.png`, fullPage: true });
await page.getByLabel('استان').selectOption({ index: 1 });
await page.getByLabel('شهر').locator('option').nth(1).waitFor({ state: 'attached', timeoutMs: 10000 });
await page.getByLabel('شهر').selectOption({ index: 1 });
await page.getByLabel('عنوان').fill('QA address');
await page.getByLabel('نام گیرنده').fill('QA User');
await page.getByLabel('کد پستی').fill('1234567890');
await page.getByLabel('نشانی').fill('خیابان تست، پلاک ۱');
await page.getByLabel('تلفن').fill('09120000001');
await page.getByRole('button', { name: 'افزودن آدرس' }).click();
await page.waitForLoadState('networkidle');
await page.getByRole('button', { name: 'ویرایش', exact: true }).first().click();
await page.screenshot({ path: `${out}/address-edit-360.png`, fullPage: true });
await browser.close();
