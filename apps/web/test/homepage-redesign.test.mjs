import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../pages/index.jsx', import.meta.url), 'utf8');

test('homepage preserves the reference page sections and RTL document language', () => {
  assert.match(source, /<div className="home-page" dir="rtl" lang="fa">/);
  for (const section of ['home-hero', 'home-search-card', 'home-benefits', 'home-categories', 'home-providers', 'home-how', 'home-footer']) {
    assert.ok(source.includes(section), `missing homepage section ${section}`);
  }
});

test('homepage search exposes keyboard-operable tabs, autocomplete and result states', () => {
  assert.match(source, /role="tablist"/);
  assert.match(source, /role="listbox"/);
  assert.match(source, /ArrowDown/);
  assert.match(source, /searchState === 'loading'/);
  assert.match(source, /searchState === 'empty'/);
  assert.match(source, /searchState === 'results'/);
});

test('demo content is disclosed and does not invent provider metrics or discounts', () => {
  assert.match(source, /اطلاعات نمونه این صفحه صرفاً نمایشی است/);
  assert.match(source, /امتیاز ثبت نشده/);
  assert.match(source, /اطلاعات تخفیف در دسترس نیست/);
  assert.doesNotMatch(source, /۵۰۰۰\s*\+|۵۰۰\s*\+|٪\s*تخفیف/);
});

test('mobile navigation is a labelled dialog and offers an explicit close control', () => {
  assert.match(source, /role="dialog" aria-modal="true" aria-label="منوی اصلی"/);
  assert.match(source, /aria-label="بستن منو"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /previousFocus\.focus\(\)/);
});
