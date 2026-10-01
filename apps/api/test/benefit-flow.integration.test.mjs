import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Integration-Password-2026!';

async function register(phone) {
  const requested = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }).then((r) => r.json());
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: requested.devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) }).then((r) => r.json());
  return login.accessToken;
}

test('HTTP concurrent payment confirmation creates one membership and preserves PAID state', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const accessToken = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: adminRole.id } });
  const plan = await prisma.benefitPlan.create({ data: { code: `HTTP-${suffix}`, name: 'HTTP concurrency test', priceAmount: 1000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchaseResponse = await fetch(`${base}/users/me/purchases`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` }, body: JSON.stringify({ planId: plan.id }) });
  assert.equal(purchaseResponse.status, 201);
  const purchase = await purchaseResponse.json();
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${accessToken}` };
  const results = await Promise.all([
    fetch(`${base}/admin/purchases/${purchase.id}/confirm-payment`, { method: 'POST', headers, body: JSON.stringify({ paymentReference: `HTTP-${suffix}` }) }),
    fetch(`${base}/admin/purchases/${purchase.id}/confirm-payment`, { method: 'POST', headers, body: JSON.stringify({ paymentReference: `HTTP-${suffix}` }) }),
  ]);
  const statuses = results.map((response) => response.status);
  assert.equal(statuses.some((status) => status >= 500), false, `unexpected statuses: ${statuses.join(',')}`);
  const stored = await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  const membershipCount = await prisma.benefitMembership.count({ where: { purchaseId: purchase.id } });
  assert.equal(stored.status, 'PAID');
  assert.equal(membershipCount, 1);
});

test('Wave 06 plan purchase uses active catalog, server snapshots, and activates entitlement after confirmation', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const accessToken = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${accessToken}` } }).then((r) => r.json());
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: adminRole.id } });
  const active = await prisma.benefitPlan.create({ data: { code: `W06-ACTIVE-${suffix}`, name: 'Wave 06 active', priceAmount: 2450n, currency: 'IRR', validityDays: 21, status: 'ACTIVE' } });
  const inactive = await prisma.benefitPlan.create({ data: { code: `W06-INACTIVE-${suffix}`, name: 'Wave 06 inactive', priceAmount: 9999n, currency: 'IRR', validityDays: 1, status: 'INACTIVE' } });
  const headers = { authorization: `Bearer ${accessToken}` };
  const catalog = await fetch(`${base}/benefit-plans`, { headers }).then((r) => r.json());
  assert.ok(catalog.some((row) => row.id === active.id));
  assert.equal(catalog.some((row) => row.id === inactive.id), false);
  const hiddenDetail = await fetch(`${base}/benefit-plans/${inactive.id}`, { headers });
  assert.equal(hiddenDetail.status, 404);
  const createdResponse = await fetch(`${base}/users/me/purchases`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ planId: active.id }) });
  assert.equal(createdResponse.status, 201);
  const created = await createdResponse.json();
  assert.equal(created.status, 'PENDING_PAYMENT');
  assert.equal(created.amountSnapshot, '2450');
  assert.equal(created.currencySnapshot, 'IRR');
  assert.equal(created.validityDaysSnapshot, 21);
  assert.equal(created.userId, undefined);
  assert.equal(created.paymentReference, undefined);
  const confirmedResponse = await fetch(`${base}/admin/purchases/${created.id}/confirm-payment`, { method: 'POST', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `W06-${suffix}` }) });
  assert.ok(confirmedResponse.status >= 200 && confirmedResponse.status < 300);
  const stored = await prisma.planPurchase.findUniqueOrThrow({ where: { id: created.id } });
  const membership = await prisma.benefitMembership.findUniqueOrThrow({ where: { purchaseId: created.id } });
  assert.equal(stored.status, 'PAID');
  assert.equal(membership.status, 'ACTIVE');
  assert.equal(membership.userId, me.id);
  assert.equal(membership.planId, active.id);
});

test('Wave 06 authorization, replay, and cancelled-state matrix fails closed', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tokenA = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const tokenB = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const userA = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokenA}` } }).then((r) => r.json());
  const adminRole = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: userA.id, roleId: adminRole.id } });
  const plan = await prisma.benefitPlan.create({ data: { code: `W06-MATRIX-${suffix}`, name: 'Wave 06 matrix', priceAmount: 3000n, currency: 'IRR', validityDays: 10, status: 'ACTIVE' } });
  const purchase = await fetch(`${base}/users/me/purchases`, { method: 'POST', headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' }, body: JSON.stringify({ planId: plan.id }) }).then((r) => r.json());
  const bHistory = await fetch(`${base}/users/me/purchases`, { headers: { authorization: `Bearer ${tokenB}` } }).then((r) => r.json());
  assert.equal(bHistory.some((row) => row.id === purchase.id), false);
  assert.equal((await fetch(`${base}/admin/purchases/${purchase.id}/confirm-payment`, { method: 'POST', headers: { authorization: `Bearer ${tokenB}`, 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `B-${suffix}` }) })).status, 403);
  assert.equal((await fetch(`${base}/admin/purchases/${purchase.id}/confirm-payment`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `ANON-${suffix}` }) })).status, 401);
  const confirmUrl = `${base}/admin/purchases/${purchase.id}/confirm-payment`;
  const first = await fetch(confirmUrl, { method: 'POST', headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `A-${suffix}` }) });
  assert.ok(first.status >= 200 && first.status < 300);
  const replay = await fetch(confirmUrl, { method: 'POST', headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `A-${suffix}` }) });
  assert.ok(replay.status >= 200 && replay.status < 300);
  assert.equal(await prisma.benefitMembership.count({ where: { purchaseId: purchase.id } }), 1);
  const cancelled = await prisma.planPurchase.create({ data: { userId: userA.id, planId: plan.id, amountSnapshot: plan.priceAmount, currencySnapshot: plan.currency, validityDaysSnapshot: plan.validityDays, status: 'CANCELLED' } });
  const cancelledConfirm = await fetch(`${base}/admin/purchases/${cancelled.id}/confirm-payment`, { method: 'POST', headers: { authorization: `Bearer ${tokenA}`, 'content-type': 'application/json' }, body: JSON.stringify({ paymentReference: `C-${suffix}` }) });
  assert.equal(cancelledConfirm.status, 400);
  assert.equal(await prisma.benefitMembership.count({ where: { purchaseId: cancelled.id } }), 0);
});

test('Wave 07 customer eligibility is session-scoped, provider-state guarded, and read-only', async () => {
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const tokenA = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const tokenB = await register(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const userA = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokenA}` } }).then((r) => r.json());
  const provider = await prisma.provider.findFirstOrThrow({ where: { status: 'APPROVED' } });
  const plan = await prisma.benefitPlan.create({ data: { code: `W07-${suffix}`, name: 'Wave 07 eligibility', priceAmount: 4000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  await prisma.planProviderBenefit.create({ data: { planId: plan.id, providerId: provider.id, discountType: 'PERCENT', discountValue: 15 } });
  const purchase = await prisma.planPurchase.create({ data: { userId: userA.id, planId: plan.id, amountSnapshot: plan.priceAmount, currencySnapshot: plan.currency, validityDaysSnapshot: plan.validityDays, status: 'PAID', paidAt: new Date() } });
  const now = new Date();
  await prisma.benefitMembership.create({ data: { userId: userA.id, planId: plan.id, purchaseId: purchase.id, status: 'ACTIVE', startsAt: new Date(now.getTime() - 60_000), endsAt: new Date(now.getTime() + 86_400_000) } });
  const before = await prisma.$transaction([
    prisma.planPurchase.count(), prisma.benefitMembership.count(), prisma.planProviderBenefit.count(), prisma.provider.count(),
  ]);
  const url = `${base}/providers/${provider.id}/eligibility`;
  assert.equal((await fetch(url)).status, 401);
  const aResponse = await fetch(url, { headers: { authorization: `Bearer ${tokenA}` } });
  assert.equal(aResponse.status, 200);
  const aResult = await aResponse.json();
  assert.equal(aResult.eligible, true);
  assert.equal(aResult.providerStatus, 'APPROVED');
  assert.equal(aResult.benefits[0].discountValue, '15');
  assert.equal(aResult.userId, undefined);
  assert.equal(aResult.nationalId, undefined);
  const bResult = await fetch(url, { headers: { authorization: `Bearer ${tokenB}` } }).then((r) => r.json());
  assert.equal(bResult.eligible, false);
  assert.equal(JSON.stringify(bResult).includes(userA.id), false);
  const after = await prisma.$transaction([
    prisma.planPurchase.count(), prisma.benefitMembership.count(), prisma.planProviderBenefit.count(), prisma.provider.count(),
  ]);
  assert.deepEqual(after, before);
});
