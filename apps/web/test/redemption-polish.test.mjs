import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('redemption customer flow keeps token memory-only and cancel is state-gated', () => {
  const page = read('pages/redemptions/index.jsx');
  assert.match(page, /row\.status === 'INITIATED'/);
  assert.match(page, /api\.post\(`\/redemptions\/\$\{id\}\/cancel`/);
  assert.doesNotMatch(page, /localStorage|sessionStorage/);
  const detail = read('pages/providers/[id].jsx');
  assert.match(detail, /setCode\(await api\.post\('\/redemptions'/);
  assert.match(detail, /پس از refresh قابل بازیابی نیست/);
});

test('provider and admin surfaces use real scoped contracts and safe reversal UX', () => {
  const provider = read('pages/providers/redemptions.jsx');
  assert.match(provider, /\/providers\/me\/redemptions\/confirm/);
  assert.match(provider, /!token\.trim\(\)/);
  assert.doesNotMatch(provider, /nationalId|tokenHash/);
  const admin = read('pages/admin/redemptions.jsx');
  assert.match(admin, /permission="redemptions\.reverse"/);
  assert.match(admin, /reason\[id\]\?\.trim\(\)/);
  assert.match(admin, /\/admin\/redemptions\/\$\{id\}\/reverse/);
});

test('redemption status and errors have user-facing Persian mappings', () => {
  const presentation = read('lib/presentation.js');
  const client = read('lib/api-client.js');
  assert.match(presentation, /INITIATED: 'در انتظار تأیید'/);
  assert.match(presentation, /CONFIRMED: 'تأیید شده'/);
  assert.match(client, /REDEMPTION_TOKEN_INVALID/);
  assert.match(client, /REDEMPTION_EXPIRED/);
});
