import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Dashboard-Integration-2026!';

async function registerAndLogin(phone) {
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  assert.equal(login.status, 201);
  const tokens = await login.json();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((response) => response.json());
  return { ...tokens, user: me };
}

async function assignRole(userId, roleName) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, update: {}, create: { userId, roleId: role.id } });
}

test('dashboard summaries enforce authenticated access, role isolation, and read-only behavior', async () => {
  const suffix = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
  const customer = await registerAndLogin(`0912${suffix.slice(-7)}`);
  const otherCustomer = await registerAndLogin(`0912${String(Number(suffix.slice(-7)) + 1).padStart(7, '0')}`);
  const representative = await registerAndLogin(`0912${String(Number(suffix.slice(-7)) + 2).padStart(7, '0')}`);
  const otherRepresentative = await registerAndLogin(`0912${String(Number(suffix.slice(-7)) + 3).padStart(7, '0')}`);
  const admin = await registerAndLogin(`0912${String(Number(suffix.slice(-7)) + 4).padStart(7, '0')}`);

  await assignRole(representative.user.id, 'SALES_PARTNER');
  await assignRole(otherRepresentative.user.id, 'SALES_PARTNER');
  await assignRole(admin.user.id, 'SUPER_ADMIN');

  const unauthenticated = await Promise.all(['customer', 'rep', 'admin'].map((surface) => fetch(`${base}/${surface}/dashboard/summary`)));
  assert.deepEqual(unauthenticated.map((response) => response.status), [401, 401, 401]);

  const before = await Promise.all([
    prisma.wallet.count({ where: { userId: customer.user.id } }),
    prisma.planPurchase.count({ where: { userId: customer.user.id } }),
    prisma.salesCommission.count({ where: { salesPartnerUserId: representative.user.id } }),
    prisma.withdrawalRequest.count({ where: { userId: customer.user.id } }),
  ]);

  const customerSummary = await fetch(`${base}/customer/dashboard/summary`, { headers: { authorization: `Bearer ${customer.accessToken}` } });
  assert.equal(customerSummary.status, 200);
  const customerPayload = await customerSummary.json();
  assert.deepEqual(Object.keys(customerPayload).sort(), ['customer', 'surface'].sort());
  assert.deepEqual(Object.keys(customerPayload.customer).sort(), ['active_plan', 'purchase_count', 'recent_purchase_summary', 'wallet_balance'].sort());
  const otherCustomerSummary = await fetch(`${base}/customer/dashboard/summary`, { headers: { authorization: `Bearer ${otherCustomer.accessToken}` } });
  assert.equal(otherCustomerSummary.status, 200);

  const repSummary = await fetch(`${base}/rep/dashboard/summary`, { headers: { authorization: `Bearer ${representative.accessToken}` } });
  assert.equal(repSummary.status, 200);
  const repPayload = await repSummary.json();
  assert.equal(repPayload.period, 'all');
  assert.deepEqual(Object.keys(repPayload.representative).sort(), ['attributed_customer_count', 'commission_summary', 'new_attributed_customer_count', 'recent_attributable_activity', 'withdrawal_readiness'].sort());
  assert.ok(Array.isArray(repPayload.representative.withdrawal_readiness.pending_requests));
  const filteredRep = await fetch(`${base}/rep/dashboard/summary?period=7d`, { headers: { authorization: `Bearer ${representative.accessToken}` } });
  assert.equal(filteredRep.status, 200);
  assert.equal((await filteredRep.json()).period, '7d');
  const otherRepSummary = await fetch(`${base}/rep/dashboard/summary`, { headers: { authorization: `Bearer ${otherRepresentative.accessToken}` } });
  assert.equal(otherRepSummary.status, 200);
  const nonRep = await fetch(`${base}/rep/dashboard/summary`, { headers: { authorization: `Bearer ${customer.accessToken}` } });
  assert.equal(nonRep.status, 403);

  const adminSummary = await fetch(`${base}/admin/dashboard/summary`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
  assert.equal(adminSummary.status, 200);
  const adminPayload = await adminSummary.json();
  assert.equal(adminPayload.period, 'all');
  assert.deepEqual(Object.keys(adminPayload.admin).sort(), ['attention_queue', 'plan_count', 'purchases_by_status', 'providers_by_status', 'recent_activity', 'representatives_by_status', 'users_by_status', 'withdrawals_by_status'].sort());
  assert.ok(Array.isArray(adminPayload.admin.attention_queue));
  assert.ok(Array.isArray(adminPayload.admin.recent_activity));
  const filteredAdmin = await fetch(`${base}/admin/dashboard/summary?period=7d`, { headers: { authorization: `Bearer ${admin.accessToken}` } });
  assert.equal(filteredAdmin.status, 200);
  assert.equal((await filteredAdmin.json()).period, '7d');
  const nonAdmin = await fetch(`${base}/admin/dashboard/summary`, { headers: { authorization: `Bearer ${customer.accessToken}` } });
  assert.equal(nonAdmin.status, 403);

  const after = await Promise.all([
    prisma.wallet.count({ where: { userId: customer.user.id } }),
    prisma.planPurchase.count({ where: { userId: customer.user.id } }),
    prisma.salesCommission.count({ where: { salesPartnerUserId: representative.user.id } }),
    prisma.withdrawalRequest.count({ where: { userId: customer.user.id } }),
  ]);
  assert.deepEqual(after, before);
  await prisma.$disconnect();
});
