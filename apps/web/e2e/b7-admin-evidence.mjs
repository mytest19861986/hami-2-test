import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.B7_BASE_URL ?? 'http://host.docker.internal:8080';
const out = process.env.B7_OUT ?? '/work/temp/review/HC-W6-01/screenshots';
await fs.mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('شماره موبایل').fill('09120000001');
await page.getByLabel('رمز عبور').fill('TEMP-Dev-Password-2026!');
await page.getByRole('button', { name: 'ورود', exact: true }).click();
await page.waitForURL(`${baseURL}/dashboard`);
for (const route of ['/admin', '/admin/users', '/admin/providers', '/admin/plans', '/admin/commissions', '/admin/settings']) {
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    const slug = route.slice(1).replaceAll('/', '-') || 'dashboard';
    await page.screenshot({ path: `${out}/admin-${slug}-${width}.png`, fullPage: true });
  }
}
await browser.close();
