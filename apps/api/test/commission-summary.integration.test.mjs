import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Commission-Summary-2026!';

async function register() {
  const phone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const requested = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }).then((response) => response.json());
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: requested.devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  return fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) }).then((response) => response.json());
}

async function sessionUser(session) {
  return fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
}

async function grantSummary(session) {
  const user = await sessionUser(session);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_PARTNER' } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  return user;
}

test('representative Summary is authenticated, capability-gated, self-scoped, and empty-safe', async () => {
  const session = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_PARTNER' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: role.id } });

  const response = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  const raw = await response.text();
  assert.equal(response.status, 200, raw);
  const body = JSON.parse(raw);
  assert.deepEqual(body, {
    pending_balance: { amount_minor: '0', currency_code: 'IRR', sign_rule: 'positive_pending_earned' },
    available_balance: { amount_minor: '0', currency_code: 'IRR', sign_rule: 'non_negative_server_clamped_available' },
    clawback_due: { amount_minor: '0', currency_code: 'IRR', sign_rule: 'non_negative_amount_due' },
    lifetime_earned: { amount_minor: '0', currency_code: 'IRR', sign_rule: 'signed_ledger_earned' },
    monthly_type_aggregates: [],
    plan_label: null,
    currency_code: 'IRR',
  });
});

test('representative Summary denies anonymous and authenticated users without the capability', async () => {
  const anonymous = await fetch(`${base}/rep/commission/summary`);
  assert.equal(anonymous.status, 401);

  const session = await register();
  const denied = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(denied.status, 403);
});

test('representative Summary response has only the approved schema keys', async () => {
  const session = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_PARTNER' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: role.id } });
  const response = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.deepEqual(Object.keys(body).sort(), ['available_balance', 'clawback_due', 'currency_code', 'lifetime_earned', 'monthly_type_aggregates', 'pending_balance', 'plan_label'].sort());
  for (const field of ['pending_balance', 'available_balance', 'clawback_due', 'lifetime_earned']) assert.deepEqual(Object.keys(body[field]).sort(), ['amount_minor', 'currency_code', 'sign_rule'].sort());
});

test('disabled representative loses summary access without a fallback path', async () => {
  const session = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${session.accessToken}` } }).then((response) => response.json());
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_PARTNER' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: role.id } });
  const allowed = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(allowed.status, 200);
  await prisma.user.update({ where: { id: me.id }, data: { status: 'DISABLED' } });
  const denied = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(denied.status, 401);
});

test('unauthorized summary responses do not disclose a permission reason', async () => {
  const first = await register();
  const second = await register();
  const headers = (session) => ({ authorization: `Bearer ${session.accessToken}` });
  const [a, b] = await Promise.all([
    fetch(`${base}/rep/commission/summary`, { headers: headers(first) }),
    fetch(`${base}/rep/commission/summary`, { headers: headers(second) }),
  ]);
  assert.equal(a.status, 403);
  assert.equal(b.status, 403);
  assert.equal(await a.text(), await b.text());
});

test('representative summary is isolated between two representatives', async () => {
  const aSession = await register();
  const bSession = await register();
  const customerSession = await register();
  const a = await grantSummary(aSession);
  await grantSummary(bSession);
  const customer = await sessionUser(customerSession);
  const plan = await prisma.benefitPlan.create({ data: { code: `SUMMARY-${Date.now()}`, name: 'Summary fixture', description: 'test', priceAmount: 100n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchase = await prisma.planPurchase.create({ data: { userId: customer.id, planId: plan.id, amountSnapshot: 100n, currencySnapshot: 'IRR', validityDaysSnapshot: 30, status: 'PAID' } });
  const attribution = await prisma.salesAttribution.create({ data: { salesPartnerUserId: a.id, customerUserId: customer.id } });
  await prisma.salesCommission.create({ data: { salesPartnerUserId: a.id, purchaseId: purchase.id, salesAttributionId: attribution.id, calculationType: 'PERCENT', calculationValueSnapshot: 10, amountSnapshot: 25n, currencySnapshot: 'IRR', status: 'APPROVED' } });
  const headers = (session) => ({ authorization: `Bearer ${session.accessToken}` });
  const aBody = await fetch(`${base}/rep/commission/summary`, { headers: headers(aSession) }).then((response) => response.json());
  const bBody = await fetch(`${base}/rep/commission/summary`, { headers: headers(bSession) }).then((response) => response.json());
  assert.equal(aBody.available_balance.amount_minor, '25');
  assert.equal(bBody.available_balance.amount_minor, '0');
});

test('summary capability revocation is enforced on the next request within the bound', async () => {
  const session = await register();
  const user = await grantSummary(session);
  const before = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.equal(before.status, 200);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SALES_PARTNER' } });
  await prisma.userRole.delete({ where: { userId_roleId: { userId: user.id, roleId: role.id } } });
  const started = Date.now();
  const after = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${session.accessToken}` } });
  assert.ok(Date.now() - started < 60_000);
  assert.equal(after.status, 403);
  const noCapability = await register();
  const comparable = await fetch(`${base}/rep/commission/summary`, { headers: { authorization: `Bearer ${noCapability.accessToken}` } });
  assert.equal(comparable.status, 403);
  assert.equal(await after.text(), await comparable.text());
});

test.after(async () => { await prisma.$disconnect(); });
