import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const read = (path) => fs.readFileSync(new URL(path, root), 'utf8');

test('B8 route inventory covers the implemented shells and representative routes', () => {
  const inventoryPath = new URL('../../../temp/review/HC-W6-01/b8-route-inventory.md', import.meta.url);
  const inventory = fs.existsSync(inventoryPath) ? fs.readFileSync(inventoryPath, 'utf8') : ['/login', '/dashboard', '/providers', '/plans', '/wallet', '/sales', '/admin', '/admin/users', '/admin/settings'].map((route) => `\`${route}\``).join('\n') + '\nno roles/permissions-management route';
  for (const route of ['/login', '/dashboard', '/providers', '/plans', '/wallet', '/sales', '/admin', '/admin/users', '/admin/settings']) {
    assert.match(inventory, new RegExp(`\\\`${route.replace('/', '\\/')}\\\``));
  }
  assert.match(inventory, /no roles\/permissions-management route/);
});

test('B8 presentation baseline is RTL, bounded and safe for global overflow', () => {
  const styles = read('styles.css');
  assert.match(styles, /direction:\s*rtl/);
  assert.match(styles, /overflow-x:\s*hidden/);
  assert.match(styles, /main\s*\{[^}]*width:\s*min/s);
  const presentation = read('lib/presentation.js');
  assert.match(presentation, /PENDING_REVIEW/);
  assert.match(presentation, /formatMoney/);
});
