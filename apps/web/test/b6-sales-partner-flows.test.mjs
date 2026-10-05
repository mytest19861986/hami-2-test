import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const root = new URL('..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');
test('sales partner issues one-time customer registration invites and only displays safe attribution projections', () => { const page = read('pages/sales/index.jsx'); const shell = read('components/user-shell.jsx'); const sharedShell = read('components/authenticated-shell.jsx'); const auth = read('components/auth-form.jsx'); assert.match(shell, /AuthenticatedShell/); assert.match(shell, /\/sales/); assert.match(sharedShell, /links\.map/); assert.match(page, /sales-partner\/customers/); assert.match(page, /کد دعوت یک‌بارمصرف/); assert.match(page, /displayAlias/); assert.match(page, /customerRef/); assert.doesNotMatch(page, /customerUserId|commission.*\+/i); assert.match(auth, /salesInviteCode/); assert.match(auth, /auth\/register\/verify-otp/); });
test('sales registration and attributed-customer views do not fabricate financial controls or values', () => { const page = read('pages/sales/index.jsx'); assert.doesNotMatch(page, /admin\/commissions|amountSnapshot|commission.*\+/i); });
