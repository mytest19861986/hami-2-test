import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Payout-Integration-2026!';

async function register() {
  const phone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const requested = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }).then((r) => r.json());
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: requested.devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  return fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) }).then((r) => r.json());
}

async function setupApproved() {
  const tokens = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json());
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: role.id } });
  const headers = { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json' };
  const wallet = await prisma.wallet.create({ data: { userId: me.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 1000n, currency: 'IRR', idempotencyKey: `PAYOUT-TEST-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const created = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } }) }).then((r) => r.json());
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/approve`, { method: 'POST', headers })).status, 201);
  return { headers, created };
}

test('payout approval creates one operation and fake settlement recognizes one fee event', async () => {
  const tokens = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json());
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: me.id, roleId: role.id } });
  const headers = { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json' };
  const wallet = await prisma.wallet.create({ data: { userId: me.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 1000n, currency: 'IRR', idempotencyKey: `PAYOUT-TEST-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const created = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } }) }).then((r) => r.json());
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/approve`, { method: 'POST', headers })).status, 201);
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  const settled = await fetch(`${base}/admin/withdrawals/${created.id}/initiate-payout`, { method: 'POST', headers });
  assert.equal(settled.status, 201, await settled.text());
  const finalWithdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(finalWithdrawal.status, 'PAID');
  const operations = await prisma.payoutOperation.count({ where: { withdrawalId: created.id } });
  const fees = await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } });
  assert.equal(operations, 1);
  assert.equal(fees, 1);
});

test('concurrent initiation keeps one operation and one fee event at the DB boundary', async () => {
  const { headers, created } = await setupApproved();
  const responses = await Promise.all([
    fetch(`${base}/admin/withdrawals/${created.id}/initiate-payout`, { method: 'POST', headers }),
    fetch(`${base}/admin/withdrawals/${created.id}/initiate-payout`, { method: 'POST', headers }),
  ]);
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }), 1);
  assert.equal(await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } }).then((row) => row.status), 'PAID');
  assert.ok(responses.some((response) => response.status === 201));
});

test('reconciliation beneficiary mismatch freezes without financial mutation', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-ref-1' } });
  const beforeLedger = await prisma.walletTransaction.count({ where: { referenceId: created.id } });
  const response = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify({ providerReference: 'provider-ref-1', outcome: 'PAID', amount: 300, beneficiary: { name: 'Substituted', accountFingerprint: 'wrong-fingerprint' } }) });
  assert.equal(response.status, 201);
  const payload = await response.json();
  assert.equal(payload.status, 'FROZEN');
  assert.equal(payload.classification, 'BENEFICIARY_MISMATCH');
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAYOUT_UNKNOWN');
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id } }), beforeLedger);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
});

test('UNKNOWN reconciliation to PAID recognizes one fee and absorbs duplicate evidence', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-ref-paid' } });
  const evidence = { providerReference: 'provider-ref-paid', outcome: 'PAID', amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } };
  const first = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) });
  assert.equal(first.status, 201);
  assert.equal((await first.json()).status, 'PAID');
  const second = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) });
  assert.equal(second.status, 201);
  assert.equal((await second.json()).idempotent, true);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }), 1);
  assert.equal(await prisma.payoutDiscrepancy.count({ where: { payoutOperationId: operation.id } }), 0);
});

test('concurrent definitive FAILED retries reuse the same operation and economic identity', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'FAILED', failedAt: new Date() } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'FAILED', failedAt: new Date(), lastErrorClass: 'DEFINITIVE_NOT_PAID' } });
  const responses = await Promise.all([
    fetch(`${base}/admin/withdrawals/${created.id}/retry-payout`, { method: 'POST', headers }),
    fetch(`${base}/admin/withdrawals/${created.id}/retry-payout`, { method: 'POST', headers }),
  ]);
  const current = await prisma.payoutOperation.findUniqueOrThrow({ where: { id: operation.id } });
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
  assert.equal(current.id, operation.id);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }), 1);
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAID');
  assert.ok(responses.some((response) => response.status === 201));
});

test('UNKNOWN definitive NOT_PAID becomes FAILED with one release and no fee', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-ref-failed' } });
  const response = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify({ providerReference: 'provider-ref-failed', outcome: 'FAILED', amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } }) });
  assert.equal(response.status, 201);
  assert.equal((await response.json()).status, 'FAILED');
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'FAILED');
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), 1);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
});

test('UNKNOWN cannot be manually retried or released', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-ref-unknown' } });
  const response = await fetch(`${base}/admin/withdrawals/${created.id}/retry-payout`, { method: 'POST', headers });
  assert.notEqual(response.status, 201);
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAYOUT_UNKNOWN');
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), 0);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
});

test('FAILED followed by provider PAID freezes as discrepancy without financial mutation', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'FAILED', failedAt: new Date() } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'FAILED', failedAt: new Date(), lastErrorClass: 'DEFINITIVE_NOT_PAID' } });
  const beforeRelease = await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } });
  const response = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify({ providerReference: 'provider-later-paid', outcome: 'PAID', amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } }) });
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), { status: 'FROZEN', classification: 'INTERNAL_FAILED_PROVIDER_LATER_PAID' });
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'FAILED');
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), beforeRelease);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
  assert.equal(await prisma.payoutDiscrepancy.count({ where: { payoutOperationId: operation.id, classification: 'INTERNAL_FAILED_PROVIDER_LATER_PAID' } }), 1);
});

test('crash window B preserves UNKNOWN after submission ambiguity with no economic side effects', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-ambiguous-submit', lastErrorClass: 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION' } });
  const beforeRelease = await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } });
  const retry = await fetch(`${base}/admin/withdrawals/${created.id}/retry-payout`, { method: 'POST', headers });
  assert.notEqual(retry.status, 201);
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), beforeRelease);
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAYOUT_UNKNOWN');
});

test('concurrent callback and reconciliation converge to one terminal outcome and one fee', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-race' } });
  const evidence = { providerReference: 'provider-race', outcome: 'PAID', amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } };
  const responses = await Promise.all([
    fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) }),
    fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) }),
  ]);
  const statuses = await Promise.all(responses.map(async (response) => ({ code: response.status, body: await response.json() })));
  assert.ok(statuses.every(({ code }) => code === 201));
  const finalWithdrawal = await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } });
  assert.equal(finalWithdrawal.status, 'PAID');
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }), 1);
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
  assert.equal(await prisma.payoutDiscrepancy.count({ where: { payoutOperationId: operation.id } }), 0);
});

test('FP4 releasable-state composition allows release only for PENDING or APPROVED', async () => {
  for (const state of ['PENDING', 'APPROVED', 'PAYOUT_PENDING', 'PAYOUT_UNKNOWN', 'FAILED', 'PAID']) {
    const { headers, created } = await setupApproved();
    const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
    await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: state, externalAttemptStarted: ['PAYOUT_PENDING', 'PAYOUT_UNKNOWN', 'PAID'].includes(state) } });
    if (!['PENDING', 'APPROVED'].includes(state)) await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: state } });
    const before = await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } });
    const response = await fetch(`${base}/admin/withdrawals/${created.id}/cancel`, { method: 'POST', headers });
    if (['PENDING', 'APPROVED'].includes(state)) {
      assert.equal(response.status, 201, `${state} cancellation should be releasable`);
      assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), before + 1);
    } else {
      assert.notEqual(response.status, 201, `${state} cancellation must be blocked`);
      assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), before);
    }
  }
});

test('crash window A cancellation recovery preserves one operation and releases once', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'APPROVED', externalAttemptStarted: false } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'CREATED', externalAttemptStarted: false } });
  const response = await fetch(`${base}/admin/withdrawals/${created.id}/cancel`, { method: 'POST', headers });
  assert.equal(response.status, 201);
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'CANCELLED');
  assert.equal(await prisma.payoutOperation.count({ where: { withdrawalId: created.id } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), 1);
});

test('wrong amount and provider reference reconciliation freeze without financial mutation', async () => {
  for (const evidence of [
    { amount: 301, providerReference: 'provider-correct' },
    { amount: 300, providerReference: 'provider-wrong' },
  ]) {
    const { headers, created } = await setupApproved();
    const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
    await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
    await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-correct' } });
    const beforeRelease = await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } });
    const response = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify({ providerReference: evidence.providerReference, outcome: 'PAID', amount: evidence.amount, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } }) });
    assert.equal(response.status, 201);
    const payload = await response.json();
    assert.equal(payload.status, 'FROZEN');
    assert.ok(['AMOUNT_MISMATCH', 'PROVIDER_REFERENCE_MISMATCH'].includes(payload.classification));
    assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAYOUT_UNKNOWN');
    assert.equal(await prisma.walletTransaction.count({ where: { referenceId: created.id, type: 'WITHDRAWAL_RELEASE' } }), beforeRelease);
    assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }), 0);
  }
});

test('late and contradictory terminal evidence cannot silently mutate settled state', async () => {
  const { headers, created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  await prisma.withdrawalRequest.update({ where: { id: created.id }, data: { status: 'PAYOUT_UNKNOWN', externalAttemptStarted: true } });
  await prisma.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAYOUT_UNKNOWN', providerReference: 'provider-terminal' } });
  const evidence = { providerReference: 'provider-terminal', outcome: 'PAID', amount: 300, beneficiary: { name: 'Test', accountFingerprint: 'test-fingerprint' } };
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) })).status, 201);
  const before = await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } });
  const late = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify(evidence) });
  assert.equal(late.status, 201);
  assert.equal((await late.json()).idempotent, true);
  const contradictory = await fetch(`${base}/admin/withdrawals/${created.id}/reconcile-payout`, { method: 'POST', headers, body: JSON.stringify({ ...evidence, outcome: 'FAILED' }) });
  assert.notEqual(contradictory.status, 201);
  assert.equal((await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id } })).status, 'PAID');
  assert.equal(await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }), before);
});

test('read-side financial snapshot is non-mutating', async () => {
  const { created } = await setupApproved();
  const operation = await prisma.payoutOperation.findUniqueOrThrow({ where: { withdrawalId: created.id } });
  const snapshot = async () => ({
    withdrawal: await prisma.withdrawalRequest.findUniqueOrThrow({ where: { id: created.id }, select: { status: true, amount: true, externalAttemptStarted: true } }),
    operation: await prisma.payoutOperation.findUniqueOrThrow({ where: { id: operation.id }, select: { status: true, providerReference: true, amountSnapshot: true } }),
    ledger: await prisma.walletTransaction.count({ where: { referenceId: created.id } }),
    fees: await prisma.payoutFeeEvent.count({ where: { payoutOperationId: operation.id } }),
  });
  const before = await snapshot();
  await prisma.withdrawalRequest.findMany({ where: { id: created.id }, select: { id: true, status: true, amount: true } });
  await prisma.payoutOperation.findMany({ where: { id: operation.id }, select: { id: true, status: true } });
  const after = await snapshot();
  assert.deepEqual(after, before);
});
