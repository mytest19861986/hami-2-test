import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
test('B6 sales partner uses only real attribution routes', () => { const page = read('pages/sales/index.jsx'); const shell = read('components/user-shell.jsx'); const sharedShell = read('components/authenticated-shell.jsx'); assert.match(shell, /AuthenticatedShell/); assert.match(shell, /\/sales/); assert.match(sharedShell, /links\.map/); assert.match(page, /sales-partner\/customers/); assert.match(page, /customerUserId/); assert.doesNotMatch(page, /commission.*\+/i); });
test('B6 commission capability gap is documented instead of fabricated', () => { const page = read('pages/sales/index.jsx'); assert.match(page, /API کاربر برای فهرست کمیسیون وجود ندارد/); assert.doesNotMatch(page, /admin\/commissions/); });
