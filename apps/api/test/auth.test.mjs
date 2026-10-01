import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';
import { purgeSessionFamilyData } from '../src/auth.mjs';

const prisma = new PrismaClient();

const base = 'http://127.0.0.1:4000/api/v1';
const phone = `0912${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;

async function registerAndLogin(testPhone) {
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: testPhone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: testPhone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: testPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: testPhone, password: 'TEMP-Dev-Password-2026!' }) });
  assert.equal(login.status, 201);
  return login.json();
}

test('registration OTP, password login, session and me flow', async () => {
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
  assert.equal(request.status, 201);
  const requested = await request.json();
  assert.match(requested.devCode, /^\d{6}$/);

  const verify = await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: requested.devCode }) });
  assert.equal(verify.status, 201);
  assert.equal((await verify.json()).verified, true);

  const password = await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: 'TEMP-Dev-Password-2026!' }) });
  assert.equal(password.status, 201);

  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: 'TEMP-Dev-Password-2026!' }) });
  assert.equal(login.status, 201);
  const tokens = await login.json();
  assert.ok(tokens.accessToken);
  assert.ok(tokens.refreshToken);

  const refreshed = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(refreshed.status, 201);
  const rotated = await refreshed.json();
  assert.notEqual(rotated.sessionId, tokens.sessionId);
  const replay = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(replay.status, 401);

  const me = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } });
  assert.equal(me.status, 200);
  assert.equal((await me.json()).phone, `+98${phone.slice(1)}`);

  const unauthAdmin = await fetch(`${base}/admin/users`);
  assert.equal(unauthAdmin.status, 401);
  const noPermissionTokens = await registerAndLogin(`0912${String(Math.floor(Math.random() * 1e7)).padStart(7, '0')}`);
  const forbiddenAdmin = await fetch(`${base}/admin/users`, { headers: { authorization: `Bearer ${noPermissionTokens.accessToken}` } });
  assert.equal(forbiddenAdmin.status, 403);

  const logout = await fetch(`${base}/auth/logout`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${tokens.accessToken}` }, body: JSON.stringify({ sessionId: tokens.sessionId }) });
  assert.equal(logout.status, 201);
});

test('password setup is rejected without a verified registration proof', async () => {
  const target = '09120000991';
  const response = await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: target, password: 'Attacker-Password-2026!' }) });
  assert.equal(response.status, 401);
});

test('OTP request is rate-limited per mobile and IP key', async () => {
  const target = `0912${String(Math.floor(Math.random() * 10000000)).padStart(7, '0')}`;
  const responses = [];
  for (let index = 0; index < 6; index += 1) responses.push(await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: target }) }));
  assert.deepEqual(responses.slice(0, 5).map((response) => response.status), [201, 201, 201, 201, 201]);
  assert.equal(responses[5].status, 429);
});

test('cookie-authenticated mutation requires origin and CSRF token', async () => {
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-auth-mode': 'cookie' }, body: JSON.stringify({ phone, password: 'TEMP-Dev-Password-2026!' }) });
  assert.equal(login.status, 201);
  const cookie = login.headers.get('set-cookie');
  assert.ok(cookie);
  const cookieHeader = cookie.split(',').map((item) => item.split(';')[0]).join('; ');
  const noOrigin = await fetch(`${base}/users/me/profile`, { method: 'PUT', headers: { cookie: cookieHeader, 'content-type': 'application/json' }, body: JSON.stringify({ firstName: 'بدون', lastName: 'CSRF' }) });
  assert.equal(noOrigin.status, 403);
  const noToken = await fetch(`${base}/users/me/profile`, { method: 'PUT', headers: { cookie: cookieHeader, origin: 'http://localhost:3000', 'content-type': 'application/json' }, body: JSON.stringify({ firstName: 'بدون', lastName: 'Token' }) });
  assert.equal(noToken.status, 403);
});

test('wrong OTP is rejected and cannot be reused', async () => {
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000002' }) });
  const { devCode } = await request.json();
  const wrong = await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000002', code: '000000' }) });
  assert.equal(wrong.status, 401);
  const right = await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000002', code: devCode }) });
  assert.equal(right.status, 201);
  const reused = await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000002', code: devCode }) });
  assert.equal(reused.status, 401);
});

test('concurrent refresh consumes one generation and revokes the family on replay', async () => {
  const concurrentPhone = '09120000005';
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: concurrentPhone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: concurrentPhone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: concurrentPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: concurrentPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  const body = JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken });
  const responses = await Promise.all([
    fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
    fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }),
  ]);
  assert.equal(responses.filter((response) => response.status === 201).length, 1);
  assert.equal(responses.filter((response) => response.status === 401).length, 1);
  const session = await prisma.authSession.findUnique({ where: { id: tokens.sessionId } });
  assert.ok(session.familyId);
  const family = await prisma.sessionFamily.findUnique({ where: { id: session.familyId } });
  assert.equal(family.status, 'REVOKED');
  assert.equal(await prisma.authSession.count({ where: { familyId: session.familyId, generation: 2 } }), 1);
});

test('legacy first refresh race is atomic and replay audit persists', async () => {
  const legacyPhone = '09120000006';
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: legacyPhone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: legacyPhone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: legacyPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: legacyPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  await prisma.authSession.update({ where: { id: tokens.sessionId }, data: { familyId: null } });
  const body = JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken });
  const [first, second] = await Promise.all([fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body }), fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })]);
  assert.equal([first.status, second.status].filter((status) => status === 201).length, 1);
  assert.equal([first.status, second.status].filter((status) => status === 401).length, 1);
  const legacy = await prisma.authSession.findUnique({ where: { id: tokens.sessionId } });
  const family = await prisma.sessionFamily.findUnique({ where: { id: legacy.familyId } });
  assert.equal(family.status, 'REVOKED');
  assert.equal(await prisma.auditLog.count({ where: { actorUserId: legacy.userId, action: 'REFRESH_REUSE_DETECTED' } }) > 0, true);
});

test('legacy session past the compatibility window requires login', async () => {
  const cutoffPhone = '09120000007';
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: cutoffPhone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: cutoffPhone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: cutoffPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: cutoffPhone, password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  await prisma.authSession.update({ where: { id: tokens.sessionId }, data: { familyId: null, createdAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) } });
  const response = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(response.status, 401);
});

test('revoked-family refresh is rejected and purge is bounded/idempotent', async () => {
  const phoneForPurge = '09120000008';
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: phoneForPurge }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: phoneForPurge, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: phoneForPurge, password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: phoneForPurge, password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  const session = await prisma.authSession.findUnique({ where: { id: tokens.sessionId } });
  await prisma.sessionFamily.update({ where: { id: session.familyId }, data: { status: 'REVOKED', revocationReason: 'SECURITY_EVENT', createdAt: new Date(Date.now() - 100 * 24 * 60 * 60_000) } });
  const rejected = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(rejected.status, 401);
  await prisma.authSession.update({ where: { id: tokens.sessionId }, data: { consumedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000), expiresAt: new Date(Date.now() - 8 * 24 * 60 * 60_000), revokedAt: new Date(Date.now() - 8 * 24 * 60 * 60_000) } });
  const firstPurge = await purgeSessionFamilyData();
  const secondPurge = await purgeSessionFamilyData();
  assert.ok(firstPurge.removedGenerations >= 1);
  assert.equal(secondPurge.removedGenerations, 0);
});

test('old-generation replay and independent device families remain isolated', async () => {
  const first = await registerAndLogin('09120000009');
  const secondLogin = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000009', password: 'TEMP-Dev-Password-2026!' }) });
  assert.equal(secondLogin.status, 201);
  const second = await secondLogin.json();
  const firstSession = await prisma.authSession.findUnique({ where: { id: first.sessionId } });
  const secondSession = await prisma.authSession.findUnique({ where: { id: second.sessionId } });
  assert.notEqual(firstSession.familyId, secondSession.familyId);
  const r1 = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: first.sessionId, refreshToken: first.refreshToken }) });
  assert.equal(r1.status, 201);
  const r1Tokens = await r1.json();
  const r2 = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: r1Tokens.sessionId, refreshToken: r1Tokens.refreshToken }) });
  assert.equal(r2.status, 201);
  const replay = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: first.sessionId, refreshToken: first.refreshToken }) });
  assert.equal(replay.status, 401);
  const familyA = await prisma.sessionFamily.findUnique({ where: { id: firstSession.familyId } });
  const familyB = await prisma.sessionFamily.findUnique({ where: { id: secondSession.familyId } });
  assert.equal(familyA.status, 'REVOKED');
  assert.equal(familyB.status, 'ACTIVE');
  assert.equal(await prisma.authSession.count({ where: { familyId: firstSession.familyId, generation: 4 } }), 0);
  assert.ok(await prisma.auditLog.count({ where: { actorUserId: firstSession.userId, action: 'REFRESH_REUSE_DETECTED' } }));
});

test('suspended and disabled users cannot refresh, and revocation ordering is terminal', async () => {
  const tokens = await registerAndLogin('09120000010');
  const session = await prisma.authSession.findUnique({ where: { id: tokens.sessionId } });
  await prisma.user.update({ where: { id: session.userId }, data: { status: 'SUSPENDED' } });
  const suspended = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(suspended.status, 401);
  await prisma.user.update({ where: { id: session.userId }, data: { status: 'DISABLED' } });
  const disabled = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: tokens.sessionId, refreshToken: tokens.refreshToken }) });
  assert.equal(disabled.status, 401);
  await prisma.user.update({ where: { id: session.userId }, data: { status: 'ACTIVE' } });

  const first = await registerAndLogin('09120000011');
  const firstSession = await prisma.authSession.findUnique({ where: { id: first.sessionId } });
  await prisma.sessionFamily.update({ where: { id: firstSession.familyId }, data: { status: 'REVOKED', revocationReason: 'SECURITY_EVENT' } });
  const revokeFirst = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: first.sessionId, refreshToken: first.refreshToken }) });
  assert.equal(revokeFirst.status, 401);
  assert.equal(await prisma.authSession.count({ where: { familyId: firstSession.familyId, generation: 2 } }), 0);

  const second = await registerAndLogin('09120000012');
  const secondSession = await prisma.authSession.findUnique({ where: { id: second.sessionId } });
  const rotated = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: second.sessionId, refreshToken: second.refreshToken }) });
  assert.equal(rotated.status, 201);
  await prisma.sessionFamily.update({ where: { id: secondSession.familyId }, data: { status: 'REVOKED', revocationReason: 'SECURITY_EVENT' } });
  const rotatedTokens = await rotated.json();
  const afterCommit = await fetch(`${base}/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ sessionId: rotatedTokens.sessionId, refreshToken: rotatedTokens.refreshToken }) });
  assert.equal(afterCommit.status, 401);
});

test('authenticated profile and address lifecycle', async () => {
  const provinces = await fetch(`${base}/locations/provinces`);
  assert.equal(provinces.status, 200);
  const [province] = await provinces.json();
  const cities = await fetch(`${base}/locations/provinces/${province.id}/cities`);
  assert.equal(cities.status, 200);
  const [city] = await cities.json();
  const profile = await fetch(`${base}/users/me/profile`);
  assert.equal(profile.status, 401);

  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000003' }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000003', code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000003', password: 'TEMP-Dev-Password-2026!' }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000003', password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  const headers = { 'content-type': 'application/json', authorization: `Bearer ${tokens.accessToken}` };

  const invalid = await fetch(`${base}/users/me/profile`, { method: 'PUT', headers, body: JSON.stringify({ firstName: 'A', lastName: 'B', nationalId: '0000000000' }) });
  assert.equal(invalid.status, 400);
  const updated = await fetch(`${base}/users/me/profile`, { method: 'PUT', headers, body: JSON.stringify({ firstName: 'Ali', lastName: 'Ahmadi', nationalId: '1234567891' }) });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).firstName, 'Ali');

  const created = await fetch(`${base}/users/me/addresses`, { method: 'POST', headers, body: JSON.stringify({ title: 'خانه', recipientName: 'Ali Ahmadi', phone: '09120000003', provinceId: province.id, cityId: city.id, postalCode: '1234567890', line1: 'خیابان نمونه', isDefault: true }) });
  assert.equal(created.status, 201);
  const address = await created.json();
  const mismatch = await fetch(`${base}/users/me/addresses`, { method: 'POST', headers, body: JSON.stringify({ title: 'نامعتبر', recipientName: 'Ali Ahmadi', phone: '09120000003', provinceId: 'missing-province', cityId: city.id, postalCode: '1234567890', line1: 'x' }) });
  assert.equal(mismatch.status, 400);
  const listed = await fetch(`${base}/users/me/addresses`, { headers });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).length >= 1, true);
  const requestB = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000004' }) });
  const { devCode: codeB } = await requestB.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000004', code: codeB }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000004', password: 'TEMP-Dev-Password-2026!' }) });
  const loginB = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone: '09120000004', password: 'TEMP-Dev-Password-2026!' }) });
  const headersB = { 'content-type': 'application/json', authorization: `Bearer ${(await loginB.json()).accessToken}` };
  const duplicateNationalId = await fetch(`${base}/users/me/profile`, { method: 'PUT', headers: headersB, body: JSON.stringify({ firstName: 'Other', lastName: 'User', nationalId: '1234567891' }) });
  assert.equal(duplicateNationalId.status, 409);
  const hidden = await fetch(`${base}/users/me/addresses`, { headers: headersB });
  assert.deepEqual(await hidden.json(), []);
  const idorUpdate = await fetch(`${base}/users/me/addresses/${address.id}`, { method: 'PUT', headers: headersB, body: JSON.stringify({ title: 'غیرمجاز', recipientName: 'Other', phone: '09120000004', provinceId: province.id, cityId: city.id, postalCode: '1234567890', line1: 'x', isDefault: false }) });
  assert.equal(idorUpdate.status, 404);
  const idorDelete = await fetch(`${base}/users/me/addresses/${address.id}`, { method: 'DELETE', headers: headersB });
  assert.equal(idorDelete.status, 404);
  const changed = await fetch(`${base}/users/me/addresses/${address.id}`, { method: 'PUT', headers, body: JSON.stringify({ title: 'محل کار', recipientName: 'Ali Ahmadi', phone: '09120000003', provinceId: province.id, cityId: city.id, postalCode: '1234567890', line1: 'خیابان دوم', isDefault: false }) });
  assert.equal(changed.status, 200);
  const second = await fetch(`${base}/users/me/addresses`, { method: 'POST', headers, body: JSON.stringify({ title: 'دوم', recipientName: 'Ali Ahmadi', phone: '09120000003', provinceId: province.id, cityId: city.id, postalCode: '1234567890', line1: 'خیابان سوم', isDefault: false }) });
  const secondAddress = await second.json();
  const defaultResults = await Promise.all([address.id, secondAddress.id].map((id) => fetch(`${base}/users/me/addresses/${id}/default`, { method: 'PUT', headers })));
  assert.ok(defaultResults.every((response) => [200, 409].includes(response.status)));
  const afterSwitch = await fetch(`${base}/users/me/addresses`, { headers });
  assert.equal((await afterSwitch.json()).filter((item) => item.isDefault).length, 1);
  const removed = await fetch(`${base}/users/me/addresses/${address.id}`, { method: 'DELETE', headers });
  assert.equal(removed.status, 200);
  await fetch(`${base}/users/me/addresses/${secondAddress.id}`, { method: 'DELETE', headers });
});

test('admin user summary, detail and status permissions', async () => {
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password: 'TEMP-Dev-Password-2026!' }) });
  const tokens = await login.json();
  const user = await prisma.user.findUnique({ where: { phone: `+98${phone.slice(1)}` } });
  const role = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: role.id } }, update: {}, create: { userId: user.id, roleId: role.id } });
  const headers = { authorization: `Bearer ${tokens.accessToken}` };
  const list = await fetch(`${base}/admin/users`, { headers });
  assert.equal(list.status, 200);
  const summaries = await list.json();
  assert.ok(summaries.every((item) => !('passwordHash' in item) && !('refreshTokenHash' in item)));
  const detail = await fetch(`${base}/admin/users/${user.id}`, { headers });
  assert.equal(detail.status, 200);
  const detailPayload = await detail.json();
  assert.ok(detailPayload.roles.includes('SUPER_ADMIN'));
  assert.equal('passwordHash' in detailPayload, false);
  assert.equal('otpChallenges' in detailPayload, false);
  assert.equal('sessions' in detailPayload, false);
  assert.equal('nationalId' in detailPayload, false);
  const status = await fetch(`${base}/admin/users/${user.id}/status`, { method: 'PATCH', headers: { ...headers, 'content-type': 'application/json' }, body: JSON.stringify({ status: 'ACTIVE' }) });
  assert.equal(status.status, 200);
  await prisma.$disconnect();
});
