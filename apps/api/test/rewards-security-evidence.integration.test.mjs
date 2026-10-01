import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Security-Evidence-2026!';

async function register() {
  const phone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const json = (path, body) => fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then((r) => r.json());
  const otp = await json('/auth/register/request-otp', { phone });
  await json('/auth/register/verify-otp', { phone, code: otp.devCode });
  await json('/auth/register/set-password', { phone, password });
  return json('/auth/login/password', { phone, password });
}

async function me(token) { return fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${token}` } }).then((r) => r.json()); }
async function admin(token, userId) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  return { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
}

test('C4 B1 withdrawal terminal matrix: paid-after-reject and repeated mark-paid are inert', async () => {
  const tokens = await register(); const user = await me(tokens.accessToken); const headers = await admin(tokens.accessToken, user.id);
  const wallet = await prisma.wallet.create({ data: { userId: user.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 1000n, currency: 'IRR', idempotencyKey: `C4-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const create = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount: 100 }) }).then((r) => r.json());
  assert.equal((await fetch(`${base}/admin/withdrawals/${create.id}/reject`, { method: 'POST', headers })).status, 201);
  const before = await prisma.walletTransaction.count({ where: { walletId: wallet.id } });
  assert.equal((await fetch(`${base}/admin/withdrawals/${create.id}/mark-paid`, { method: 'POST', headers })).status, 400);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id } }), before);
  const approved = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount: 100 }) }).then((r) => r.json());
  assert.equal((await fetch(`${base}/admin/withdrawals/${approved.id}/approve`, { method: 'POST', headers })).status, 201);
  assert.equal((await fetch(`${base}/admin/withdrawals/${approved.id}/mark-paid`, { method: 'POST', headers })).status, 201);
  const afterPaid = await prisma.walletTransaction.count({ where: { walletId: wallet.id } });
  assert.equal((await fetch(`${base}/admin/withdrawals/${approved.id}/mark-paid`, { method: 'POST', headers })).status, 400);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id } }), afterPaid);
  assert.equal((await fetch(`${base}/admin/withdrawals/${create.id}/approve`, { method: 'POST', headers })).status, 400);
});

test('C4 B2 cross-user wallet APIs are self-scoped and do not expose another user', async () => {
  const a = await register(); const b = await register(); const userA = await me(a.accessToken); await me(b.accessToken);
  const walletA = await prisma.wallet.create({ data: { userId: userA.id, currency: 'IRR' } });
  const headersB = { authorization: `Bearer ${b.accessToken}` };
  const own = await fetch(`${base}/users/me/wallet`, { headers: headersB });
  assert.notEqual((await own.json()).id, walletA.id);
  assert.equal((await fetch(`${base}/users/me/wallet/transactions`, { headers: headersB })).status, 200);
  assert.equal((await fetch(`${base}/users/me/wallet/withdrawals`, { headers: headersB })).status, 200);
});

test('C4 B3/B4 anonymous commission and settings mutations are denied', async () => {
  assert.equal((await fetch(`${base}/admin/commissions/not-a-real-id/approve`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/admin/commissions/not-a-real-id/reject`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${base}/admin/commercial-settings`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ autoApproveCommissionAfterPayment: true }) })).status, 401);
});

test('C4 B5 WalletTransaction idempotencyKey is DB-authoritative', async () => {
  const tokens = await register(); const user = await me(tokens.accessToken);
  const wallet = await prisma.wallet.create({ data: { userId: user.id, currency: 'IRR' } });
  const data = { walletId: wallet.id, type: 'REFERRAL_REWARD', amount: 10n, currency: 'IRR', idempotencyKey: `C4-IDEMPOTENCY:${wallet.id}` };
  await prisma.walletTransaction.create({ data });
  await assert.rejects(() => prisma.walletTransaction.create({ data }), { code: 'P2002' });
  assert.equal(await prisma.walletTransaction.count({ where: { idempotencyKey: data.idempotencyKey } }), 1);
});
