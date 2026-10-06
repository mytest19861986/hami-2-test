import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Next home page source contains the Persian RTL homepage shell', async () => {
  const source = await readFile(new URL('../pages/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /حامی‌کارت/);
  assert.match(source, /dir="rtl"/);
  assert.match(source, /home-search-card/);
  assert.match(source, /home-mobile-drawer/);
});
