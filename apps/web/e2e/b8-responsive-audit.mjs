import { chromium } from '@playwright/test';

const baseURL = process.env.B8_BASE_URL ?? 'http://host.docker.internal:8080';
const routes = ['/dashboard', '/providers', '/plans', '/wallet', '/sales', '/admin', '/admin/users', '/admin/providers', '/admin/commissions'];
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto(`${baseURL}/login`, { waitUntil: 'networkidle' });
await page.getByLabel('شماره موبایل').fill('09120000001');
await page.getByLabel('رمز عبور').fill('TEMP-Dev-Password-2026!');
await page.getByRole('button', { name: 'ورود', exact: true }).click();
await page.waitForURL(`${baseURL}/dashboard`);

const failures = [];
for (const width of [360, 768, 1280]) {
  await page.setViewportSize({ width, height: width === 360 ? 800 : 900 });
  for (const route of routes) {
    await page.goto(`${baseURL}${route}`, { waitUntil: 'networkidle' });
    const result = await page.evaluate(() => ({
      viewport: window.innerWidth,
      scrollWidth: document.documentElement.scrollWidth,
      title: document.title,
    }));
    if (result.scrollWidth > result.viewport) failures.push({ width, route, ...result });
  }
}
await browser.close();
if (failures.length) {
  console.error(JSON.stringify({ failures }, null, 2));
  process.exitCode = 1;
} else {
  console.log(`B8 responsive audit PASS: ${routes.length} routes × 3 viewports; no global horizontal overflow.`);
}
