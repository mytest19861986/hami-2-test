import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Rewards-Integration-2026!';

async function register() {
  const phone = `0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`;
  const requested = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) }).then((r) => r.json());
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: requested.devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  return fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) }).then((r) => r.json());
}

async function post(path, token, body) {
  return fetch(`${base}${path}`, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) });
}

async function postRefund(purchaseId, headers) {
  return fetch(`${base}/admin/purchases/${purchaseId}/refund`, { method: 'POST', headers, body: JSON.stringify({ refundReference: `TEST-REFUND-${purchaseId}` }) });
}

async function makeAdmin(accessToken, userId) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
  return { authorization: `Bearer ${accessToken}`, 'content-type': 'application/json' };
}

test('real API concurrent withdrawals reserve at most the available ledger balance', async () => {
  const tokens = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json());
  const wallet = await prisma.wallet.create({ data: { userId: me.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 1000n, currency: 'IRR', idempotencyKey: `TEST-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const headers = { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json' };
  const responses = await Promise.all([800, 800].map((amount) => fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount }) })));
  const responseDetails = await Promise.all(responses.map(async (response) => ({ status: response.status, body: await response.text() })));
  assert.equal(responseDetails.filter((response) => response.status >= 200 && response.status < 300).length, 1, JSON.stringify(responseDetails));
  assert.equal(responseDetails.some((response) => response.status >= 500), false, JSON.stringify(responseDetails));
  const rows = await prisma.withdrawalRequest.findMany({ where: { userId: me.id } });
  const ledger = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id } });
  assert.equal(rows.length, 1);
  assert.ok(ledger.reduce((sum, item) => sum + item.amount, 0n) >= 0n);
  assert.equal(ledger.filter((item) => item.type === 'WITHDRAWAL_RESERVATION').length, 1);
});

test('rejected withdrawal appends one compensating release and preserves reservation history', async () => {
  const tokens = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(tokens.accessToken, me.id);
  const wallet = await prisma.wallet.create({ data: { userId: me.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 500n, currency: 'IRR', idempotencyKey: `TEST-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const created = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ amount: 200 }) }).then((r) => r.json());
  const rejected = await fetch(`${base}/admin/withdrawals/${created.id}/reject`, { method: 'POST', headers: adminHeaders });
  assert.equal(rejected.status, 201, await rejected.text());
  const ledger = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id }, orderBy: { createdAt: 'asc' } });
  assert.equal(ledger.filter((item) => item.type === 'WITHDRAWAL_RESERVATION').length, 1);
  assert.equal(ledger.filter((item) => item.type === 'WITHDRAWAL_RELEASE').length, 1);
  assert.equal(ledger.reduce((sum, item) => sum + item.amount, 0n), 500n);
});

test('financial input validation rejects negative, zero, malformed and unsafe withdrawal amounts', async () => {
  const tokens = await register();
  const headers = { authorization: `Bearer ${tokens.accessToken}`, 'content-type': 'application/json' };
  for (const amount of [-1, 0, 'not-a-number', '1.5', Number.MAX_SAFE_INTEGER + 1]) {
    const response = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers, body: JSON.stringify({ amount }) });
    assert.equal(response.status, 400, `${amount}: ${await response.text()}`);
  }
});

test('withdrawal terminal transitions and repeated rejection create no duplicate release', async () => {
  const tokens = await register();
  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(tokens.accessToken, me.id);
  const wallet = await prisma.wallet.create({ data: { userId: me.id, currency: 'IRR' } });
  await prisma.walletTransaction.create({ data: { walletId: wallet.id, type: 'ADMIN_ADJUSTMENT_CREDIT', amount: 500n, currency: 'IRR', idempotencyKey: `TEST-CREDIT:${wallet.id}` } });
  await prisma.commercialSettings.updateMany({ data: { withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const created = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ amount: 200 }) }).then((r) => r.json());
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/reject`, { method: 'POST', headers: adminHeaders })).status, 201);
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/reject`, { method: 'POST', headers: adminHeaders })).status, 400);
  assert.equal((await fetch(`${base}/admin/withdrawals/${created.id}/approve`, { method: 'POST', headers: adminHeaders })).status, 400);
  const releases = await prisma.walletTransaction.count({ where: { type: 'WITHDRAWAL_RELEASE', referenceId: created.id } });
  assert.equal(releases, 1);
});

test('referral reward and refund reversal are exactly once across payment replay', async () => {
  const referrer = await register();
  const referred = await register();
  const referrerMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${referrer.accessToken}` } }).then((r) => r.json());
  const referredMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${referred.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(referred.accessToken, referredMe.id);
  const codeResponse = await post('/users/me/referral', referrer.accessToken, {});
  assert.equal(codeResponse.status, 201);
  const code = await codeResponse.json();
  const claim = await post('/referrals/claim', referred.accessToken, { code: code.code });
  assert.equal(claim.status, 201);
  const secondClaim = await post('/referrals/claim', referred.accessToken, { code: code.code });
  assert.equal(secondClaim.status, 409);
  await prisma.commercialSettings.updateMany({ data: { referralEnabled: true, referralRewardAmount: 100n } });
  const plan = await prisma.benefitPlan.create({ data: { code: `REF-${Date.now()}-${Math.random()}`, name: 'Referral test plan', priceAmount: 1000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchaseResponse = await post('/users/me/purchases', referred.accessToken, { planId: plan.id });
  assert.equal(purchaseResponse.status, 201);
  const purchase = await purchaseResponse.json();
  const confirm = await post(`/admin/purchases/${purchase.id}/confirm-payment`, referred.accessToken, { paymentReference: `REF-PAY-${purchase.id}` });
  assert.ok(confirm.status >= 200 && confirm.status < 300);
  const replay = await post(`/admin/purchases/${purchase.id}/confirm-payment`, referred.accessToken, { paymentReference: `REF-PAY-${purchase.id}` });
  assert.ok(replay.status < 500);
  const attribution = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: referredMe.id } });
  const rewardRows = await prisma.walletTransaction.findMany({ where: { type: 'REFERRAL_REWARD', idempotencyKey: `REFERRAL_REWARD:${attribution.id}` } });
  assert.equal(rewardRows.length, 1);
  const rewardSnapshot = { amount: rewardRows[0].amount, type: rewardRows[0].type, idempotencyKey: rewardRows[0].idempotencyKey };
  assert.equal(attribution.status, 'REWARDED');
  const secondPurchase = await post('/users/me/purchases', referred.accessToken, { planId: plan.id }).then((r) => r.json());
  const concurrentConfirms = await Promise.all([
    post(`/admin/purchases/${secondPurchase.id}/confirm-payment`, referred.accessToken, { paymentReference: `REF-PAY-2-${secondPurchase.id}` }),
    post(`/admin/purchases/${secondPurchase.id}/confirm-payment`, referred.accessToken, { paymentReference: `REF-PAY-2-${secondPurchase.id}` }),
  ]);
  assert.equal(concurrentConfirms.some((response) => response.status >= 500), false);
  const rewardAfterSecondPurchase = await prisma.walletTransaction.count({ where: { type: 'REFERRAL_REWARD', idempotencyKey: `REFERRAL_REWARD:${attribution.id}` } });
  assert.equal(rewardAfterSecondPurchase, 1);
  const refund = await postRefund(purchase.id, adminHeaders);
  assert.ok(refund.status >= 200 && refund.status < 300);
  const refundReplay = await postRefund(purchase.id, adminHeaders);
  assert.ok(refundReplay.status < 500);
  const reversalRows = await prisma.walletTransaction.findMany({ where: { type: 'REFERRAL_REVERSAL', idempotencyKey: `REFERRAL_REVERSAL:${attribution.id}` } });
  const storedAttribution = await prisma.referralAttribution.findUniqueOrThrow({ where: { id: attribution.id } });
  assert.equal(reversalRows.length, 1);
  assert.equal(reversalRows[0].amount, -rewardRows[0].amount);
  const rewardAfterRefund = await prisma.walletTransaction.findUniqueOrThrow({ where: { id: rewardRows[0].id } });
  assert.deepEqual({ amount: rewardAfterRefund.amount, type: rewardAfterRefund.type, idempotencyKey: rewardAfterRefund.idempotencyKey }, rewardSnapshot);
  assert.equal(storedAttribution.status, 'REVERSED');
  assert.equal(referrerMe.status, 'ACTIVE');
});

test('integrated concurrent payment creates one membership, referral reward, and commission', async () => {
  const referrer = await register();
  const customer = await register();
  const partner = await register();
  const customerMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${customer.accessToken}` } }).then((r) => r.json());
  const partnerMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${partner.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(customer.accessToken, customerMe.id);
  await makeAdmin(partner.accessToken, partnerMe.id);
  const code = await post('/users/me/referral', referrer.accessToken, {}).then((r) => r.json());
  assert.equal((await post('/referrals/claim', customer.accessToken, { code: code.code })).status, 201);
  const attributionResponse = await post('/sales-partner/customers', partner.accessToken, { customerUserId: customerMe.id });
  assert.equal(attributionResponse.status, 201, await attributionResponse.text());
  const plan = await prisma.benefitPlan.create({ data: { code: `INT-${Date.now()}-${Math.random()}`, name: 'Integrated test plan', priceAmount: 2000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchase = await post('/users/me/purchases', customer.accessToken, { planId: plan.id }).then((r) => r.json());
  await prisma.salesCommissionRule.create({ data: { type: 'PERCENT', value: 10 } });
  await prisma.commercialSettings.updateMany({ data: { referralEnabled: true, referralRewardAmount: 100n, salesCommissionEnabled: true, autoApproveCommissionAfterPayment: false } });
  const responses = await Promise.all([
    post(`/admin/purchases/${purchase.id}/confirm-payment`, customer.accessToken, { paymentReference: `INT-${purchase.id}` }),
    post(`/admin/purchases/${purchase.id}/confirm-payment`, customer.accessToken, { paymentReference: `INT-${purchase.id}` }),
  ]);
  assert.equal(responses.some((r) => r.status >= 500), false, await Promise.all(responses.map((r) => r.text())));
  assert.equal((await prisma.planPurchase.findUniqueOrThrow({ where: { id: purchase.id } })).status, 'PAID');
  assert.equal(await prisma.benefitMembership.count({ where: { purchaseId: purchase.id } }), 1);
  const referral = await prisma.referralAttribution.findUniqueOrThrow({ where: { referredUserId: customerMe.id } });
  assert.equal(await prisma.walletTransaction.count({ where: { type: 'REFERRAL_REWARD', referenceId: referral.id } }), 1);
  const commission = await prisma.salesCommission.findUniqueOrThrow({ where: { purchaseId: purchase.id } });
  assert.equal(commission.status, 'PENDING_APPROVAL');
  assert.equal(commission.amountSnapshot, 200n);
  const commissionSnapshot = { calculationType: commission.calculationType, calculationValueSnapshot: commission.calculationValueSnapshot, amountSnapshot: commission.amountSnapshot, currencySnapshot: commission.currencySnapshot };
  const rule = await prisma.salesCommissionRule.findFirstOrThrow({ where: { isActive: true } });
  await prisma.salesCommissionRule.update({ where: { id: rule.id }, data: { value: 99 } });
  const unchangedCommission = await prisma.salesCommission.findUniqueOrThrow({ where: { id: commission.id } });
  assert.deepEqual({ calculationType: unchangedCommission.calculationType, calculationValueSnapshot: unchangedCommission.calculationValueSnapshot, amountSnapshot: unchangedCommission.amountSnapshot, currencySnapshot: unchangedCommission.currencySnapshot }, commissionSnapshot);
  const refund = await postRefund(purchase.id, adminHeaders);
  assert.ok(refund.status >= 200 && refund.status < 300, await refund.text());
  const refundReplay = await postRefund(purchase.id, adminHeaders);
  assert.ok(refundReplay.status < 500, await refundReplay.text());
  const reversedCommission = await prisma.salesCommission.findUniqueOrThrow({ where: { id: commission.id } });
  assert.equal(reversedCommission.status, 'REVERSED');
  assert.equal(await prisma.salesCommission.count({ where: { purchaseId: purchase.id } }), 1);
});

test('refund and withdrawal race preserves ledger invariants', async () => {
  const referrer = await register();
  const referred = await register();
  const referrerMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${referrer.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(referrer.accessToken, referrerMe.id);
  await prisma.commercialSettings.updateMany({ data: { referralEnabled: true, referralRewardAmount: 100n, withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });

  const code = await post('/users/me/referral', referrer.accessToken, {}).then((r) => r.json());
  assert.equal((await post('/referrals/claim', referred.accessToken, { code: code.code })).status, 201);
  const plan = await prisma.benefitPlan.create({ data: { code: `RACE-${Date.now()}-${Math.random()}`, name: 'Refund withdrawal race', priceAmount: 1000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchase = await post('/users/me/purchases', referred.accessToken, { planId: plan.id }).then((r) => r.json());
  const confirmation = await post(`/admin/purchases/${purchase.id}/confirm-payment`, adminHeaders.authorization.slice('Bearer '.length), { paymentReference: `RACE-PAY-${purchase.id}` });
  assert.ok(confirmation.status >= 200 && confirmation.status < 300, await confirmation.text());

  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: referrerMe.id } });
  const before = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id } });
  assert.equal(before.filter((row) => row.type === 'REFERRAL_REWARD').length, 1);
  const [refund, withdrawal] = await Promise.all([
    postRefund(purchase.id, adminHeaders),
    fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers: { authorization: `Bearer ${referrer.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ amount: 100 }) }),
  ]);
  assert.equal(refund.status >= 200 && refund.status < 500, true, await refund.text());
  assert.equal(withdrawal.status >= 200 && withdrawal.status < 500, true, await withdrawal.text());

  const refundReplay = await postRefund(purchase.id, adminHeaders);
  assert.ok(refundReplay.status < 500, await refundReplay.text());

  const ledger = await prisma.walletTransaction.findMany({ where: { walletId: wallet.id } });
  const withdrawals = await prisma.withdrawalRequest.findMany({ where: { userId: referrerMe.id } });
  assert.equal(ledger.filter((row) => row.type === 'REFERRAL_REWARD').length, 1);
  assert.equal(ledger.filter((row) => row.type === 'REFERRAL_REVERSAL').length, 1);
  assert.ok(withdrawals.length <= 1);
  assert.ok(ledger.reduce((sum, row) => sum + row.amount, 0n) >= 0n);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id, type: 'REFERRAL_REVERSAL' } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id, type: 'WITHDRAWAL_RESERVATION' } }), withdrawals.length);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id, type: 'WITHDRAWAL_RELEASE' } }), withdrawals.length);
  assert.equal(await prisma.walletTransaction.count({ where: { walletId: wallet.id, type: 'REFERRAL_REVERSAL' } }), 1);
  if (withdrawals.length) assert.equal(withdrawals[0].status, 'CANCELLED');
});

test('refund-first ordering rejects a later withdrawal without negative ledger', async () => {
  const referrer = await register();
  const referred = await register();
  const referrerMe = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${referrer.accessToken}` } }).then((r) => r.json());
  const adminHeaders = await makeAdmin(referrer.accessToken, referrerMe.id);
  await prisma.commercialSettings.updateMany({ data: { referralEnabled: true, referralRewardAmount: 100n, withdrawalsEnabled: true, minimumWithdrawalAmount: 1n } });
  const code = await post('/users/me/referral', referrer.accessToken, {}).then((r) => r.json());
  assert.equal((await post('/referrals/claim', referred.accessToken, { code: code.code })).status, 201);
  const plan = await prisma.benefitPlan.create({ data: { code: `RACE-FIRST-${Date.now()}-${Math.random()}`, name: 'Refund first race', priceAmount: 1000n, currency: 'IRR', validityDays: 30, status: 'ACTIVE' } });
  const purchase = await post('/users/me/purchases', referred.accessToken, { planId: plan.id }).then((r) => r.json());
  const confirmation = await post(`/admin/purchases/${purchase.id}/confirm-payment`, adminHeaders.authorization.slice('Bearer '.length), { paymentReference: `RACE-FIRST-PAY-${purchase.id}` });
  assert.ok(confirmation.status >= 200 && confirmation.status < 300, await confirmation.text());
  const refund = await postRefund(purchase.id, adminHeaders);
  assert.ok(refund.status >= 200 && refund.status < 300, await refund.text());
  const withdrawal = await fetch(`${base}/users/me/wallet/withdrawals`, { method: 'POST', headers: { authorization: `Bearer ${referrer.accessToken}`, 'content-type': 'application/json' }, body: JSON.stringify({ amount: 100 }) });
  assert.ok(withdrawal.status < 500);
  assert.equal(await prisma.walletTransaction.count({ where: { type: 'REFERRAL_REWARD', referenceId: { not: null }, wallet: { userId: referrerMe.id } } }), 1);
  assert.equal(await prisma.walletTransaction.count({ where: { type: 'REFERRAL_REVERSAL', wallet: { userId: referrerMe.id } } }), 1);
  assert.equal(await prisma.withdrawalRequest.count({ where: { userId: referrerMe.id } }), 0);
  const wallet = await prisma.wallet.findUniqueOrThrow({ where: { userId: referrerMe.id }, include: { transactions: true } });
  assert.ok(wallet.transactions.reduce((sum, row) => sum + row.amount, 0n) >= 0n);
});
