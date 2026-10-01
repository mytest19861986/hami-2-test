import { chromium } from '@playwright/test';
import fs from 'node:fs/promises';

const baseURL = process.env.B8_BASE_URL ?? 'http://host.docker.internal:8080';
const out = process.env.B8_OUT ?? '/work/temp/review/HC-W6-01/screenshots/b8';
await fs.mkdir(out, { recursive: true });

const roles = [
  { name: 'user', phone: '09120000003', password: 'TEMP-Dev-Password-2026!', routes: ['/dashboard', '/providers', '/plans', '/wallet'] },
  { name: 'sales-partner', phone: '09120000999', password: 'TEMP-B8-Sales-2026!', routes: ['/sales'] },
  { name: 'admin', phone: '09120000001', password: 'TEMP-Dev-Password-2026!', routes: ['/admin', '/admin/users', '/admin/providers', '/admin/commissions', '/admin/settings'] },
];
const widths = [360, 768, 1280];
const browser = await chromium.launch({ headless: true });
const results = [];

for (const role of roles) {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
  await page.getByLabel('شماره موبایل').fill(role.phone);
  await page.getByLabel('رمز عبور').fill(role.password);
  await page.getByRole('button', { name: 'ورود', exact: true }).click();
  await page.waitForURL(`${baseURL}/dashboard`);
  for (const route of role.routes) {
    for (const width of widths) {
      await page.setViewportSize({ width, height: width === 360 ? 800 : width === 768 ? 1024 : 900 });
      await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
      const slug = route.slice(1).replaceAll('/', '-') || 'dashboard';
      await page.screenshot({ path: `${out}/${role.name}-${slug}-${width}.png`, fullPage: true });
      results.push({ role: role.name, route, width, url: page.url(), overflow });
    }
  }
  await page.close();
}
await browser.close();
if (results.some((item) => item.overflow)) throw new Error(`GLOBAL_OVERFLOW:${JSON.stringify(results.filter((item) => item.overflow))}`);
console.log(JSON.stringify({ status: 'PASS', results }, null, 2));
