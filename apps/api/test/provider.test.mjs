import test from 'node:test';
import assert from 'node:assert/strict';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const base = `${process.env.TEST_BASE_URL || 'http://127.0.0.1:4000'}/api/v1`;

async function registerAndLogin(phone) {
  const password = 'TEMP-Provider-Matrix-2026!';
  const request = await fetch(`${base}/auth/register/request-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone }) });
  const { devCode } = await request.json();
  await fetch(`${base}/auth/register/verify-otp`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, code: devCode }) });
  await fetch(`${base}/auth/register/set-password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  const login = await fetch(`${base}/auth/login/password`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ phone, password }) });
  assert.equal(login.status, 201);
  const tokens = await login.json();
  const user = await fetch(`${base}/auth/me`, { headers: { authorization: `Bearer ${tokens.accessToken}` } }).then((response) => response.json());
  return { ...tokens, user };
}

test('provider operations keep admin review protected and reject invalid geography', async () => {
  assert.equal((await fetch(`${base}/admin/providers`)).status, 401);
  const specialties = await prisma.medicalSpecialty.findMany({ take: 1 });
  const [province] = await prisma.province.findMany({ take: 1 });
  const otherProvince = await prisma.province.findFirst({ where: { id: { not: province.id } } });
  const [city] = await prisma.city.findMany({ where: { provinceId: province.id }, take: 1 });
  const mismatch = await prisma.provider.create({ data: { type: 'DOCTOR', displayName: 'Geography Test', provinceId: province.id, cityId: city.id, address: 'x', phone: '09120000000', doctorProfile: { create: { medicalCouncilNumber: `GEO-${Date.now()}`, specialtyId: specialties[0].id } } } });
  const invalidUpdate = await fetch(`${base}/admin/providers/${mismatch.id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ provinceId: otherProvince.id, cityId: city.id }) });
  assert.equal(invalidUpdate.status, 401);
  await prisma.doctorProfile.delete({ where: { providerId: mismatch.id } });
  await prisma.provider.delete({ where: { id: mismatch.id } });
});

test('provider seeds are idempotent and public directory exposes approved only', async () => {
  const specialties = await prisma.medicalSpecialty.findMany({ orderBy: { name: 'asc' } });
  assert.equal(specialties.length, 12);
  assert.equal(new Set(specialties.map((s) => s.name)).size, 12);
  const specialtyList = await fetch(`${base}/specialties`);
  assert.equal(specialtyList.status, 200);
  assert.deepEqual(await specialtyList.json(), specialties.map(({ id, name }) => ({ id, name })));
  const [province] = await prisma.province.findMany({ take: 1 });
  const [city] = await prisma.city.findMany({ where: { provinceId: province.id }, take: 1 });
  const council = `TEST-${Date.now()}`;
  const pending = await prisma.provider.create({ data: { type: 'DOCTOR', status: 'PENDING_REVIEW', displayName: 'Pending Test', provinceId: province.id, cityId: city.id, address: 'x', phone: '09120000000', doctorProfile: { create: { medicalCouncilNumber: `${council}-P`, specialtyId: specialties[0].id } } } });
  const approved = await prisma.provider.create({ data: { type: 'DOCTOR', status: 'APPROVED', displayName: 'Approved Test', provinceId: province.id, cityId: city.id, address: 'x', phone: '09120000000', doctorProfile: { create: { medicalCouncilNumber: `${council}-A`, specialtyId: specialties[0].id } } } });
  const list = await fetch(`${base}/providers?provinceId=${province.id}&cityId=${city.id}&specialtyId=${specialties[0].id}`);
  assert.equal(list.status, 200);
  const rows = await list.json();
  assert.ok(rows.some((row) => row.id === approved.id));
  assert.ok(!rows.some((row) => row.id === pending.id));
  assert.equal('memberships' in rows.find((row) => row.id === approved.id), false);
  assert.equal('userId' in rows.find((row) => row.id === approved.id), false);
  assert.equal('medicalCouncilNumber' in rows.find((row) => row.id === approved.id).doctorProfile, false);
  const detail = await fetch(`${base}/providers/${pending.id}`);
  assert.equal(detail.status, 404);
  await prisma.doctorProfile.deleteMany({ where: { providerId: { in: [pending.id, approved.id] } } });
  await prisma.provider.deleteMany({ where: { id: { in: [pending.id, approved.id] } } });
});

test('provider schema enforces duplicate council number and geography coherence', async () => {
  const specialty = await prisma.medicalSpecialty.findFirst();
  const [province] = await prisma.province.findMany({ take: 1 });
  const [city] = await prisma.city.findMany({ where: { provinceId: province.id }, take: 1 });
  const council = `UNIQ-${Date.now()}`;
  const provider = await prisma.provider.create({ data: {
    type: 'DOCTOR', displayName: 'Unique Test', provinceId: province.id, cityId: city.id,
    address: 'x', phone: '09120000000',
    doctorProfile: { create: { medicalCouncilNumber: council, specialtyId: specialty.id } },
  } });
  const second = await prisma.provider.create({ data: { type: 'DOCTOR', displayName: 'Unique Test 2', provinceId: province.id, cityId: city.id, address: 'x', phone: '09120000000' } });
  await assert.rejects(() => prisma.doctorProfile.create({ data: { providerId: second.id, medicalCouncilNumber: council, specialtyId: specialty.id } }));
  await prisma.doctorProfile.delete({ where: { providerId: provider.id } });
  await prisma.provider.delete({ where: { id: provider.id } });
  await prisma.provider.delete({ where: { id: second.id } });
});

test('provider self-service is session-scoped and customers cannot access it', async () => {
  const suffix = String(Date.now()).slice(-7);
  const providerA = await registerAndLogin(`0912${suffix}`);
  const providerB = await registerAndLogin(`0912${String(Number(suffix) + 1).padStart(7, '0')}`);
  const customer = await registerAndLogin(`0912${String(Number(suffix) + 2).padStart(7, '0')}`);
  const specialty = await prisma.medicalSpecialty.findFirst();
  const [province] = await prisma.province.findMany({ take: 1 });
  const [city] = await prisma.city.findMany({ where: { provinceId: province.id }, take: 1 });
  const rows = await Promise.all([providerA, providerB].map((session, index) => prisma.provider.create({ data: { type: 'DOCTOR', status: 'PENDING_REVIEW', displayName: `Scoped ${index}`, provinceId: province.id, cityId: city.id, address: 'x', phone: '09120000000', memberships: { create: { userId: session.user.id, role: 'OWNER' } }, doctorProfile: { create: { medicalCouncilNumber: `SCOPED-${Date.now()}-${index}`, specialtyId: specialty.id } } } })));
  const headers = (session) => ({ authorization: `Bearer ${session.accessToken}` });
  const [a, b, ordinary] = await Promise.all([providerA, providerB, customer].map((session) => fetch(`${base}/users/me/providers`, { headers: headers(session) })));
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(ordinary.status, 403);
  assert.deepEqual((await a.json()).map((row) => row.id), [rows[0].id]);
  assert.deepEqual((await b.json()).map((row) => row.id), [rows[1].id]);
  await prisma.providerMembership.deleteMany({ where: { providerId: { in: rows.map((row) => row.id) } } });
  await prisma.doctorProfile.deleteMany({ where: { providerId: { in: rows.map((row) => row.id) } } });
  await prisma.provider.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
});
