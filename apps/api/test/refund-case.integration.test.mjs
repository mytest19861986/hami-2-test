import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = process.env.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Refund-Case-Integration-2026!';

async function register() {
  const phone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }).then((response) => response.json());
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: request.devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) }).then((response) => response.json());
  const user = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${login.accessToken}` } }).then((response) => response.json());
  return { token: login.accessToken, user };
}

function headers(token, extra = {}) { return { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extra }; }

async function post(path, token, body, extra = {}) {
  return fetch(`${base}${path}`, { method: 'POST', headers: headers(token, extra), body: JSON.stringify(body) });
}

async function makeSuperAdmin(userId) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

async function prepareRejectedPurchase() {
  const customer = await register();
  const admin = await register();
  await makeSuperAdmin(admin.user.id);
  const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const plan = await prisma.benefitPlan.create({ data: { code: `REFUND-CASE-${suffix}`, name: 'Refund case test plan', priceAmount: 3210n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchase = await post('/users/me/purchases', customer.token, { planId: plan.id }).then((response) => response.json());
  const payment = await post(`/admin/purchases/${purchase.id}/confirm-payment`, admin.token, { paymentReference: `REFUND-CASE-PAY-${suffix}` });
  assert.equal(payment.status, 201, await payment.text());
  const membership = await prisma.benefitMembership.findUniqueOrThrow({ where: { purchaseId: purchase.id } });
  const rejection = await post(`/admin/memberships/${membership.id}/reject`, admin.token, { reasonCode: 'POLICY_REQUIREMENT_NOT_MET' });
  assert.equal(rejection.status, 201, await rejection.text());
  return { customer, admin, purchase, membership };
}

async function assignReadOnlyPurchaseRole(userId) {
  const role = await prisma.role.upsert({ where: { name: 'REFUND_CASE_READ_ONLY_TEST' }, update: {}, create: { name: 'REFUND_CASE_READ_ONLY_TEST' } });
  const permission = await prisma.permission.findUniqueOrThrow({ where: { resource_action: { resource: 'purchases', action: 'read' } } });
  await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: role.id, permissionId: permission.id } }, update: {}, create: { roleId: role.id, permissionId: permission.id } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}

test('case request, replay, privacy boundary, and concurrent approval never execute refund', async () => {
  const { customer, admin, purchase, membership } = await prepareRejectedPurchase();
  const path = `/users/me/purchases/${purchase.id}/refund-case`;
  const key = `refund-case:${purchase.id}`;
  assert.equal((await post(path, customer.token, {}, { 'idempotency-key': key })).status, 400);
  assert.equal((await post(path, customer.token, { reasonCode: 'ACTIVATION_REJECTED' })).status, 400);

  const duplicateRequests = await Promise.all([
    post(path, customer.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': key }),
    post(path, customer.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': key }),
  ]);
  assert.deepEqual(duplicateRequests.map((response) => response.status), [201, 201]);
  const duplicateBodies = await Promise.all(duplicateRequests.map((response) => response.json()));
  assert.equal(duplicateBodies[0].id, duplicateBodies[1].id);
  assert.equal(duplicateBodies[0].status, 'REQUESTED');
  assert.equal(await prisma.refundReconciliationCase.count({ where: { purchaseId: purchase.id } }), 1);
  assert.equal((await post(path, customer.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': `${key}:different` })).status, 409);

  const outsider = await register();
  assert.equal((await post(path, outsider.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': `outsider:${purchase.id}` })).status, 404);
  const ownPurchases = await fetch(`${base}/users/me/purchases`, { headers: headers(customer.token) }).then((response) => response.json());
  assert.equal(ownPurchases.find((row) => row.id === purchase.id).refundCase.id, duplicateBodies[0].id);
  assert.equal((await fetch(`${base}/admin/refund-cases`, { headers: headers(customer.token) })).status, 403);

  const readOnly = await register();
  await assignReadOnlyPurchaseRole(readOnly.user.id);
  const list = await fetch(`${base}/admin/refund-cases`, { headers: headers(readOnly.token) });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).some((row) => row.id === duplicateBodies[0].id), true);
  assert.equal((await fetch(`${base}/admin/refund-cases/${duplicateBodies[0].id}`, { headers: headers(readOnly.token) })).status, 200);
  assert.equal((await post(`/admin/refund-cases/${duplicateBodies[0].id}/approve`, readOnly.token, {})).status, 403);
  assert.equal((await fetch(`${base}/admin/refund-cases/${duplicateBodies[0].id}`, { headers: headers(customer.token) })).status, 403);

  const approvals = await Promise.all([
    post(`/admin/refund-cases/${duplicateBodies[0].id}/approve`, admin.token, {}),
    post(`/admin/refund-cases/${duplicateBodies[0].id}/approve`, admin.token, {}),
  ]);
  assert.deepEqual(approvals.map((response) => response.status), [201, 201]);
  const approved = await Promise.all(approvals.map((response) => response.json()));
  assert.equal(approved[0].id, approved[1].id);
  assert.equal(approved[0].status, 'APPROVED_PENDING_EXECUTION');

  const storedPurchase = await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  assert.equal(storedPurchase.status, 'PAID');
  assert.equal(storedPurchase.refundReference, null);
  assert.equal(storedPurchase.refundedAt, null);
  assert.equal((await prisma.benefitMembership.findUniqueOrThrow({ where: { id: membership.id } })).status, 'REJECTED');
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: purchase.id, type: { in: ['REFERRAL_REVERSAL', 'WITHDRAWAL_RELEASE'] } } }), 0);
  assert.equal(await prisma.salesCommission.count({ where: { purchaseId: purchase.id, status: 'REVERSED' } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entity: 'RefundReconciliationCase', entityId: duplicateBodies[0].id, action: 'REFUND_CASE_REQUESTED' } }), 1);
  assert.equal(await prisma.auditLog.count({ where: { entity: 'RefundReconciliationCase', entityId: duplicateBodies[0].id, action: 'REFUND_CASE_APPROVED' } }), 1);

  const legacy = await post(`/admin/purchases/${purchase.id}/refund`, admin.token, { refundReference: `MANUAL-${purchase.id}` });
  assert.equal(legacy.status, 409);
  assert.equal((await legacy.json()).error, 'REFUND_PROVIDER_VERIFICATION_REQUIRED');
  assert.equal((await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).status, 'PAID');
});

test('case rejection requires a reason and is replay-safe without financial side effects', async () => {
  const { customer, admin, purchase } = await prepareRejectedPurchase();
  const response = await post(`/users/me/purchases/${purchase.id}/refund-case`, customer.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': `refund-case:${purchase.id}` });
  assert.equal(response.status, 201);
  const refundCase = await response.json();
  assert.equal((await post(`/admin/refund-cases/${refundCase.id}/reject`, admin.token, {})).status, 400);
  const rejected = await post(`/admin/refund-cases/${refundCase.id}/reject`, admin.token, { reasonCode: 'POLICY_REQUIREMENT_NOT_MET' });
  assert.equal(rejected.status, 201);
  assert.equal((await rejected.json()).status, 'REJECTED');
  const replay = await post(`/admin/refund-cases/${refundCase.id}/reject`, admin.token, { reasonCode: 'POLICY_REQUIREMENT_NOT_MET' });
  assert.equal(replay.status, 201);
  assert.equal((await replay.json()).status, 'REJECTED');
  assert.equal((await post(`/admin/refund-cases/${refundCase.id}/reject`, admin.token, { reasonCode: 'NOT_ELIGIBLE' })).status, 409);
  assert.equal((await post(`/admin/refund-cases/${refundCase.id}/approve`, admin.token, {})).status, 409);
  const stored = await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } });
  assert.equal(stored.status, 'PAID');
  assert.equal(stored.refundedAt, null);
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: purchase.id, type: { in: ['REFERRAL_REVERSAL', 'WITHDRAWAL_RELEASE'] } } }), 0);
  assert.equal(await prisma.salesCommission.count({ where: { purchaseId: purchase.id, status: 'REVERSED' } }), 0);
  assert.equal(await prisma.auditLog.count({ where: { entity: 'RefundReconciliationCase', entityId: refundCase.id, action: 'REFUND_CASE_REJECTED' } }), 1);
});

test('refund case creation is rejected for unpaid or non-rejected purchases', async () => {
  const customer = await register();
  const plan = await prisma.benefitPlan.create({ data: { code: `REFUND-INELIGIBLE-${Date.now()}-${Math.random()}`, name: 'Refund case ineligible', priceAmount: 900n, currency: 'IRR', validityDays: 10, status: 'ACTIVE' } });
  const purchase = await post('/users/me/purchases', customer.token, { planId: plan.id }).then((response) => response.json());
  const attempt = await post(`/users/me/purchases/${purchase.id}/refund-case`, customer.token, { reasonCode: 'ACTIVATION_REJECTED' }, { 'idempotency-key': `refund-case:${purchase.id}` });
  assert.equal(attempt.status, 400);
  assert.equal(await prisma.refundReconciliationCase.count({ where: { purchaseId: purchase.id } }), 0);
  assert.equal((await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).status, 'PENDING_PAYMENT');
});

test.after(async () => { await prisma.$disconnect(); });
