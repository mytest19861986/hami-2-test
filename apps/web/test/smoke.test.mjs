import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('Next page source contains the RTL foundation shell', async () => {
  const source = await readFile(new URL('../pages/index.jsx', import.meta.url), 'utf8');
  assert.match(source, /حمایت کارت/);
  assert.match(source, /dir="rtl"/);
});
