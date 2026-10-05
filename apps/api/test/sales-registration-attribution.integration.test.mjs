import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = process.env.API_BASE_URL || 'http://127.0.0.1:4000/api/v1';
const password = 'TEMP-Sales-Registration-2026!';

function phone() { return `0912${String(crypto.randomInt(0, 10_000_000)).padStart(7, '0')}`; }
async function post(path, body, token) {
  return fetch(`${base}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
}
async function register({ salesInviteCode } = {}) {
  const mobile = phone();
  const requested = await post('/auth/register/request-otp', { phone: mobile }).then((response) => response.json());
  const verified = await post('/auth/register/verify-otp', { phone: mobile, code: requested.devCode, ...(salesInviteCode ? { salesInviteCode } : {}) });
  assert.equal(verified.status, 201, await verified.clone().text());
  const setup = await verified.json();
  const completed = await post('/auth/register/set-password', { phone: mobile, password, passwordSetupToken: setup.passwordSetupToken });
  assert.equal(completed.status, 201, await completed.clone().text());
  const loggedIn = await post('/auth/login/password', { phone: mobile, password }).then((response) => response.json());
  return { mobile, ...loggedIn };
}
async function assignRole(userId, roleName) {
  const role = await prisma.role.findUniqueOrThrow({ where: { name: roleName } });
  await prisma.userRole.create({ data: { userId, roleId: role.id } });
}
async function me(token) { return fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${token}` } }).then((response) => response.json()); }

test('representative registration invite binds attribution only after verified customer registration', async () => {
  const representative = await register();
  const representativeUser = await me(representative.accessToken);
  await assignRole(representativeUser.id, 'SALES_PARTNER');

  const anonymous = await post('/sales-partner/customers', {});
  assert.equal(anonymous.status, 401);
  const inviteResponse = await post('/sales-partner/customers', { customerUserId: 'attacker-chosen-id', salesPartnerUserId: 'attacker-chosen-rep' }, representative.accessToken);
  assert.equal(inviteResponse.status, 201, await inviteResponse.clone().text());
  const invite = await inviteResponse.json();
  assert.match(invite.code, /^[A-Za-z0-9_-]{43}$/);
  const persistedInvite = await prisma.salesRegistrationInvite.findUniqueOrThrow({ where: { id: invite.id } });
  assert.equal(persistedInvite.codeHash, crypto.createHash('sha256').update(invite.code).digest('hex'));
  assert.notEqual(persistedInvite.codeHash, invite.code);
  assert.equal(await prisma.salesAttribution.count({ where: { salesPartnerUserId: representativeUser.id } }), 0);

  const customer = await register({ salesInviteCode: invite.code });
  const customerUser = await me(customer.accessToken);
  assert.equal((await post('/sales-partner/customers', {}, customer.accessToken)).status, 403);
  const attribution = await prisma.salesAttribution.findUniqueOrThrow({ where: { customerUserId: customerUser.id } });
  assert.equal(attribution.salesPartnerUserId, representativeUser.id);
  assert.equal(attribution.status, 'ACTIVE');
  assert.equal(await prisma.salesAttribution.count({ where: { customerUserId: customerUser.id } }), 1);
  assert.equal(await prisma.wallet.count({ where: { userId: customerUser.id } }), 0);
  assert.equal(await prisma.salesCommission.count({ where: { salesPartnerUserId: representativeUser.id } }), 0);
  assert.ok((await prisma.salesRegistrationInvite.findUniqueOrThrow({ where: { id: invite.id } })).redeemedAt);

  const partnerRows = await fetch(`${base}/sales-partner/customers`, { headers: { authorization: `Bearer ${representative.accessToken}` } }).then((response) => response.json());
  assert.equal(partnerRows.length, 1);
  assert.equal(partnerRows[0].customerRef.startsWith('cust_'), true);
  assert.equal(JSON.stringify(partnerRows).includes(customerUser.id), false);
  assert.equal(JSON.stringify(partnerRows).includes(customer.mobile), false);

  const otherRepresentative = await register();
  const otherRepresentativeUser = await me(otherRepresentative.accessToken);
  await assignRole(otherRepresentativeUser.id, 'SALES_PARTNER');
  const otherRows = await fetch(`${base}/sales-partner/customers`, { headers: { authorization: `Bearer ${otherRepresentative.accessToken}` } }).then((response) => response.json());
  assert.deepEqual(otherRows, []);

  const secondInvite = await post('/sales-partner/customers', {}, representative.accessToken).then((response) => response.json());
  const existingRequest = await post('/auth/register/request-otp', { phone: customer.mobile }).then((response) => response.json());
  const existingAttempt = await post('/auth/register/verify-otp', { phone: customer.mobile, code: existingRequest.devCode, salesInviteCode: secondInvite.code });
  assert.equal(existingAttempt.status, 409, await existingAttempt.text());
  assert.equal(await prisma.salesAttribution.count({ where: { customerUserId: customerUser.id } }), 1);
  assert.equal((await prisma.salesRegistrationInvite.findUniqueOrThrow({ where: { id: secondInvite.id } })).redeemedAt, null);

  const replayPhone = phone();
  const replayRequest = await post('/auth/register/request-otp', { phone: replayPhone }).then((response) => response.json());
  const replay = await post('/auth/register/verify-otp', { phone: replayPhone, code: replayRequest.devCode, salesInviteCode: invite.code });
  assert.equal(replay.status, 409, await replay.text());
  assert.equal(await prisma.user.count({ where: { phone: `+98${replayPhone.slice(1)}` } }), 0);
});

test('customer registration OTP remains single-use under concurrent verification', async () => {
  const representative = await register();
  const representativeUser = await me(representative.accessToken);
  await assignRole(representativeUser.id, 'SALES_PARTNER');
  const invite = await post('/sales-partner/customers', {}, representative.accessToken).then((response) => response.json());
  const mobile = phone();
  const requested = await post('/auth/register/request-otp', { phone: mobile }).then((response) => response.json());
  const attempts = await Promise.all([
    post('/auth/register/verify-otp', { phone: mobile, code: requested.devCode, salesInviteCode: invite.code }),
    post('/auth/register/verify-otp', { phone: mobile, code: requested.devCode, salesInviteCode: invite.code }),
  ]);
  assert.equal(attempts.filter((response) => response.status === 201).length, 1);
  assert.equal(attempts.filter((response) => response.status === 401).length, 1);
  const user = await prisma.user.findUniqueOrThrow({ where: { phone: `+98${mobile.slice(1)}` } });
  assert.equal(user.status, 'PENDING');
  assert.equal(await prisma.salesAttribution.count({ where: { customerUserId: user.id } }), 0);
});

test('a registration invite can be redeemed by at most one concurrent customer password setup', async () => {
  const representative = await register();
  const representativeUser = await me(representative.accessToken);
  await assignRole(representativeUser.id, 'SALES_PARTNER');
  const invite = await post('/sales-partner/customers', {}, representative.accessToken).then((response) => response.json());
  const mobiles = [phone(), phone()];
  const requests = await Promise.all(mobiles.map((mobile) => post('/auth/register/request-otp', { phone: mobile }).then((response) => response.json())));
  const verified = await Promise.all(mobiles.map((mobile, index) => post('/auth/register/verify-otp', { phone: mobile, code: requests[index].devCode, salesInviteCode: invite.code })));
  assert.deepEqual(verified.map((response) => response.status), [201, 201]);
  const setupTokens = await Promise.all(verified.map((response) => response.json().then((body) => body.passwordSetupToken)));
  const completions = await Promise.all(mobiles.map((mobile, index) => post('/auth/register/set-password', { phone: mobile, password, passwordSetupToken: setupTokens[index] })));
  assert.equal(completions.filter((response) => response.status === 201).length, 1);
  assert.equal(completions.filter((response) => response.status === 409).length, 1);
  assert.equal(await prisma.salesAttribution.count({ where: { salesPartnerUserId: representativeUser.id } }), 1);
  assert.equal(await prisma.user.count({ where: { phone: { in: mobiles.map((mobile) => `+98${mobile.slice(1)}`) }, status: 'ACTIVE' } }), 1);
  assert.ok((await prisma.salesRegistrationInvite.findUniqueOrThrow({ where: { id: invite.id } })).redeemedAt);
});
