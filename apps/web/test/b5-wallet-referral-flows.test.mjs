import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('..', import.meta.url);
const read = (file) => fs.readFileSync(new URL(file, root), 'utf8');

test('B5 real wallet and referral routes are exposed without fabricated detail route', () => {
  const shell = read('components/user-shell.jsx');
  assert.match(shell, /AuthenticatedShell/); assert.match(shell, /'\/wallet'/); assert.match(shell, /'\/referrals'/);
  assert.ok(fs.existsSync(new URL('pages/wallet.jsx', root))); assert.ok(fs.existsSync(new URL('pages/referrals.jsx', root)));
  assert.ok(!fs.existsSync(new URL('pages/withdrawals/[id].jsx', root)));
});

test('B5 wallet uses backend balance and safe transaction mapping', () => {
  const page = read('pages/wallet.jsx');
  assert.match(page, /users\/me\/wallet/); assert.match(page, /users\/me\/wallet\/withdrawals/);
  assert.match(page, /REFERRAL_REWARD/); assert.match(page, /item\.type\] \|\| 'تراکنش کیف پول'/);
  assert.match(page, /amount: String\(value\)/); assert.doesNotMatch(page, /userId/);
});

test('B5 referral page uses real code/history/claim contracts and copy action', () => {
  const page = read('pages/referrals.jsx');
  const presentation = read('lib/presentation.js');
  assert.match(page, /users\/me\/referral/); assert.match(page, /users\/me\/referrals/); assert.match(page, /referrals\/claim/);
  assert.match(page, /navigator\?\.clipboard/); assert.match(page, /labelStatus\(row\.status\)/);
  assert.match(presentation, /REWARDED:\s*['"]پاداش/);
});
