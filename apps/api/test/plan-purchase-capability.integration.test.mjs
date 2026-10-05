import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = process.env.API_BASE_URL ?? 'http://127.0.0.1:4000/api/v1';
const password = `Wave44-${crypto.randomBytes(18).toString('base64url')}!`;

async function call(path, { method = 'GET', token, body } = {}) {
  return fetch(`${base}${path}`, { method, headers: { ...(body === undefined ? {} : { 'content-type': 'application/json' }), ...(token ? { authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
async function register() {
  const phone = `0912${crypto.randomInt(0, 10_000_000).toString().padStart(7, '0')}`;
  const requested = await call('/auth/register/request-otp', { method: 'POST', body: { phone } }).then((response) => response.json());
  const verified = await call('/auth/register/verify-otp', { method: 'POST', body: { phone, code: requested.devCode } });
  assert.equal(verified.status, 201, await verified.clone().text());
  const setup = await verified.json();
  const completed = await call('/auth/register/set-password', { method: 'POST', body: { phone, password, passwordSetupToken: setup.passwordSetupToken } });
  assert.equal(completed.status, 201, await completed.clone().text());
  const login = await call('/auth/login/password', { method: 'POST', body: { phone, password } });
  assert.equal(login.status, 201, await login.clone().text());
  const tokens = await login.json();
  const me = await call('/auth/me', { token: tokens.accessToken }).then((response) => response.json());
  return { ...tokens, me };
}
async function grantRole(userId, roleName) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}
async function activePlan() {
  const suffix = crypto.randomBytes(8).toString('hex');
  return prisma.benefitPlan.create({ data: { code: `W44-${suffix}`, name: 'Wave 44 capability test plan', priceAmount: 7300n, currency: 'IRR', validityDays: 21, status: 'ACTIVE' } });
}
async function inactivePlan() {
  const suffix = crypto.randomBytes(8).toString('hex');
  return prisma.benefitPlan.create({ data: { code: `W44-INACTIVE-${suffix}`, name: 'Wave 44 inactive plan test', priceAmount: 9100n, currency: 'USD', validityDays: 5, status: 'INACTIVE' } });
}

test('Wave 44 grants plan selection only to customer actors and creates one authoritative pending purchase on concurrent submit', async () => {
  const [customer, representative, support, providerActor, admin] = await Promise.all(Array.from({ length: 5 }, () => register()));
  await Promise.all([
    grantRole(representative.me.id, 'SALES_PARTNER'),
    grantRole(support.me.id, 'SUPPORT'),
    grantRole(admin.me.id, 'SUPER_ADMIN'),
  ]);
  const province = await prisma.province.findFirstOrThrow();
  const city = await prisma.city.findFirstOrThrow({ where: { provinceId: province.id } });
  const provider = await prisma.provider.create({ data: { type: 'DOCTOR', status: 'APPROVED', displayName: 'Wave 44 provider permission fixture', provinceId: province.id, cityId: city.id, address: 'Local test only', phone: `0912${crypto.randomInt(0, 10_000_000).toString().padStart(7, '0')}` } });
  await prisma.providerMembership.create({ data: { userId: providerActor.me.id, providerId: provider.id, role: 'STAFF' } });
  const plan = await activePlan();

  assert.equal((await call('/users/me/purchases', { method: 'POST', body: { planId: plan.id } })).status, 401);
  for (const actor of [representative, support, providerActor]) {
    const current = await call('/auth/me', { token: actor.accessToken }).then((response) => response.json());
    assert.equal(current.capabilities.includes('plans.select'), false);
    assert.equal((await call('/users/me/purchases', { method: 'POST', token: actor.accessToken, body: { planId: plan.id } })).status, 403);
  }

  const customerMe = await call('/auth/me', { token: customer.accessToken }).then((response) => response.json());
  assert.equal(customerMe.capabilities.includes('plans.select'), true);
  const inactive = await inactivePlan();
  const inactiveResult = await call('/users/me/purchases', { method: 'POST', token: customer.accessToken, body: { planId: inactive.id } });
  assert.equal(inactiveResult.status, 404, 'inactive plans must not be purchasable');
  assert.deepEqual(await inactiveResult.json(), { error: 'PLAN_NOT_FOUND' });
  const unavailableResult = await call('/users/me/purchases', { method: 'POST', token: customer.accessToken, body: { planId: crypto.randomUUID() } });
  assert.equal(unavailableResult.status, 404, 'missing plans must not be purchasable');
  assert.deepEqual(await unavailableResult.json(), { error: 'PLAN_NOT_FOUND' });
  const walletTransactionsBefore = await prisma.walletTransaction.count();
  const forgedOwnerId = '00000000-0000-4000-8000-000000000000';
  const request = () => call('/users/me/purchases', { method: 'POST', token: customer.accessToken, body: { planId: plan.id, userId: forgedOwnerId, amountSnapshot: '1', currencySnapshot: 'USD', paymentStatus: 'PAID' } });
  const parallel = await Promise.all([request(), request()]);
  assert.deepEqual(parallel.map((response) => response.status), [201, 201], await Promise.all(parallel.map((response) => response.clone().text())));
  const rows = await Promise.all(parallel.map((response) => response.json()));
  assert.equal(rows[0].id, rows[1].id, 'parallel duplicate submissions must reuse one pending purchase');
  assert.equal(rows[0].userId, undefined, 'purchase response must not disclose owner identity');
  assert.equal((await prisma.planPurchase.findUniqueOrThrow({ where: { id: rows[0].id } })).userId, customer.me.id, 'client-supplied owner identity must be ignored');
  assert.equal(rows[0].amountSnapshot, plan.priceAmount.toString());
  assert.equal(rows[0].currencySnapshot, plan.currency);
  assert.equal(rows[0].status, 'PENDING_PAYMENT');
  assert.equal(await prisma.planPurchase.count({ where: { userId: customer.me.id, planId: plan.id, status: 'PENDING_PAYMENT' } }), 1);
  assert.equal(await prisma.benefitMembership.count({ where: { purchaseId: rows[0].id } }), 0, 'purchase creation must not create or activate membership');
  assert.equal(await prisma.walletTransaction.count(), walletTransactionsBefore, 'purchase creation must not mutate wallet');
  assert.equal(await prisma.auditLog.count({ where: { action: 'PURCHASE_CREATED', entity: 'PlanPurchase', entityId: rows[0].id } }), 1);
  const adminMe = await call('/auth/me', { token: admin.accessToken }).then((response) => response.json());
  assert.equal(adminMe.capabilities.includes('plans.select'), true, 'Super Admin compatibility remains intact');
  const adminPurchase = await call('/users/me/purchases', { method: 'POST', token: admin.accessToken, body: { planId: plan.id } });
  assert.equal(adminPurchase.status, 201);
});

test.after(async () => { await prisma.$disconnect(); });
