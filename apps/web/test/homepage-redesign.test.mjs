import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../pages/index.jsx', import.meta.url), 'utf8');
const styles = await readFile(new URL('../styles.css', import.meta.url), 'utf8');

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

test('hero MRI promo card follows the reference artwork and price hierarchy without demo badges', () => {
  for (const text of ['HAMICARD', 'جامعه تخفیف درمان', 'حامی‌کارت', 'عضویت سامانه تخفیف درمان', 'سامانه تخفیف درمان', 'MRI کمر', 'در مرکز تصویربرداری پارس', 'هزینه عادی', '۵,۲۰۰,۰۰۰', 'با حامی‌کارت', '۲,۹۰۰,۰۰۰', 'صرفه‌جویی شما', '۲,۳۰۰,۰۰۰']) {
    assert.ok(source.includes(text), `missing promo card copy: ${text}`);
  }
  assert.match(source, /اطلاعات نمونه این صفحه صرفاً نمایشی است/);
  assert.match(source, /home-promo-backdrop[\s\S]*src="\/home-promo-clinic-bg\.webp"[\s\S]*home-card-brand[\s\S]*HAMICARD[\s\S]*home-demo-card-copy[\s\S]*home-promo-details/);
  assert.match(source, /home-card-chip">\+H/);
  assert.match(source, /home-demo-card-copy" dir="ltr"/);
  assert.match(source, /home-demo-card-bottom" dir="ltr"><span className="home-card-bars"/);
  assert.doesNotMatch(source, /home-promo-label|home-promo-disclaimer|قیمت‌ها صرفاً نمونه نمایشی‌اند/);
  assert.match(styles, /\.home-promo-panel\s*\{[^}]*aspect-ratio:\s*2\.3\s*\/\s*1/s);
  assert.match(styles, /\.home-promo-image \.home-demo-card\s*\{[^}]*width:\s*min\(78%,\s*250px\)[^}]*min-height:\s*136px[^}]*rotate\(-8deg\)[^}]*perspective/s);
  assert.match(styles, /\.home-promo-backdrop::before\s*\{[^}]*radial-gradient/s);
  assert.match(styles, /\.home-promo-backdrop img\s*\{[^}]*width:\s*100%[^}]*blur\(3\.5px\)/s);
  assert.match(styles, /\.home-promo-price-row--old del\s*\{[^}]*text-decoration-thickness/s);
  assert.match(styles, /\.home-promo-details\s*\{[^}]*direction:\s*rtl/s);
  assert.match(styles, /\.home-savings-panel\s*\{[^}]*min-height:\s*62px[^}]*background:\s*rgb\(157 233 196 \/ 94%\)/s);
  assert.match(source, /home-savings-panel" dir="ltr"[\s\S]*Icon name="coins"/);
  assert.match(styles, /@media\s*\(max-width:\s*760px\)[\s\S]*\.home-promo-panel\s*\{[^}]*aspect-ratio:\s*auto/s);
  assert.match(styles, /\.home-promo-image \.home-demo-card\s*\{[^}]*width:\s*min\(78%,\s*210px\)[^}]*min-height:\s*108px/s);
});

test('mobile navigation is a labelled dialog and offers an explicit close control', () => {
  assert.match(source, /role="dialog" aria-modal="true" aria-label="منوی اصلی"/);
  assert.match(source, /aria-label="بستن منو"/);
  assert.match(source, /event\.key === 'Escape'/);
  assert.match(source, /event\.key !== 'Tab'/);
  assert.match(source, /event\.shiftKey/);
  assert.match(source, /previousFocus\.focus\(\)/);
  assert.match(source, /input:not\(\[disabled\]\)/);
  assert.match(source, /select:not\(\[disabled\]\)/);
  assert.match(source, /textarea:not\(\[disabled\]\)/);
});

test('homepage keeps provider cards in semantic RTL grid order and meets mobile touch sizing', () => {
  assert.match(styles, /\.home-provider-card\s*\{[^}]*grid-template-columns:\s*minmax\(0,\s*1fr\)\s+92px;[^}]*grid-template-areas:\s*"copy art"/s);
  assert.doesNotMatch(styles, /\.home-provider-card\s*\{[^}]*direction:\s* ltr/s);
  assert.match(styles, /\.home-search-tab\s*\{[^}]*min-height:\s*44px/s);
  assert.match(styles, /\.home-category-grid\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/s);
  assert.match(styles, /\.home-provider-meta\s*\{[^}]*color:\s*#596b71/i);
});
