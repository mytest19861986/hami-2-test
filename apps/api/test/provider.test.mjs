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
  assert.equal((await fetch(`${base}/users/me/providers`)).status, 401);
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
  assert.equal(a.status, 200); assert.equal(b.status, 200); assert.equal(ordinary.status, 200);
  assert.deepEqual((await a.json()).map((row) => row.id), [rows[0].id]);
  assert.deepEqual((await b.json()).map((row) => row.id), [rows[1].id]);
  assert.deepEqual(await ordinary.json(), []);
  await prisma.providerMembership.deleteMany({ where: { providerId: { in: rows.map((row) => row.id) } } });
  await prisma.doctorProfile.deleteMany({ where: { providerId: { in: rows.map((row) => row.id) } } });
  await prisma.provider.deleteMany({ where: { id: { in: rows.map((row) => row.id) } } });
});

test('doctor national ID eligibility is exact, status-gated, unique, audited, and never echoed', async () => {
  assert.ok(process.env.DOCTOR_NATIONAL_ID_HMAC_KEY?.length >= 32, 'test runtime must provide an isolated test-only doctor identity key');
  const suffix = String(Date.now()).slice(-7);
  const doctor = await registerAndLogin(`0913${suffix}`);
  const other = await registerAndLogin(`0913${String(Number(suffix) + 1).padStart(7, '0')}`);
  const [specialty] = await prisma.medicalSpecialty.findMany({ take: 1 });
  const [province] = await prisma.province.findMany({ take: 1 });
  const [city] = await prisma.city.findMany({ where: { provinceId: province.id }, take: 1 });
  const prefix = String(Date.now()).slice(-9);
  const checksum = prefix.split('').reduce((total, digit, index) => total + Number(digit) * (10 - index), 0) % 11;
  const nationalId = `${prefix}${checksum < 2 ? checksum : 11 - checksum}`;
  const registration = { displayName: `Doctor ${suffix}`, provinceId: province.id, cityId: city.id, medicalCouncilNumber: `NID-${suffix}`, nationalId, specialtyId: specialty.id, address: '', phone: '' };
  const headers = (session) => ({ authorization: `Bearer ${session.accessToken}`, 'content-type': 'application/json' });
  const createdResponse = await fetch(`${base}/providers/doctor-registration`, { method: 'POST', headers: headers(doctor), body: JSON.stringify(registration) });
  assert.equal(createdResponse.status, 201);
  const createdBody = await createdResponse.text();
  assert.equal(createdBody.includes(nationalId), false);
  assert.equal(createdBody.includes('nationalIdHmac'), false);
  const provider = JSON.parse(createdBody);

  const duplicate = await fetch(`${base}/providers/doctor-registration`, { method: 'POST', headers: headers(other), body: JSON.stringify({ ...registration, displayName: 'Duplicate', medicalCouncilNumber: `NID-DUP-${suffix}` }) });
  assert.equal(duplicate.status, 409);
  assert.equal((await duplicate.text()).includes(nationalId), false);

  const invalid = await fetch(`${base}/providers/eligibility/doctor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nationalId: '1234567890' }) });
  assert.equal(invalid.status, 400);
  const lookup = () => fetch(`${base}/providers/eligibility/doctor`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ nationalId }) });
  const pendingResult = await lookup();
  assert.deepEqual(await pendingResult.json(), { eligible: false });

  const superAdmin = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  await prisma.userRole.create({ data: { userId: doctor.user.id, roleId: superAdmin.id } });
  const deniedMutation = await fetch(`${base}/admin/providers/${provider.id}/doctor-national-id`, { method: 'PUT', headers: headers(other), body: JSON.stringify({ nationalId }) });
  assert.equal(deniedMutation.status, 403);
  const approved = await fetch(`${base}/admin/providers/${provider.id}/status`, { method: 'PATCH', headers: headers(doctor), body: JSON.stringify({ status: 'APPROVED' }) });
  assert.equal(approved.status, 200);
  const approvedResult = await lookup();
  const resultBody = await approvedResult.json();
  assert.deepEqual(Object.keys(resultBody).sort(), ['eligible', 'provider']);
  assert.equal(resultBody.eligible, true);
  assert.deepEqual(Object.keys(resultBody.provider).sort(), ['city', 'displayName', 'id', 'province', 'specialty']);
  assert.equal(JSON.stringify(resultBody).includes(nationalId), false);

  for (const path of [`/users/me/providers`, '/admin/providers', `/admin/providers/${provider.id}`]) {
    const response = await fetch(`${base}${path}`, { headers: headers(doctor) });
    assert.equal(response.status, 200);
    assert.equal(JSON.stringify(await response.json()).includes('nationalIdHmac'), false);
    assert.equal(JSON.stringify(await fetch(`${base}${path}`, { headers: headers(doctor) }).then((item) => item.json())).includes(nationalId), false);
  }
  const logRows = await prisma.auditLog.findMany({ where: { entity: 'Provider', entityId: provider.id } });
  assert.equal(JSON.stringify(logRows).includes(nationalId), false);

  const suspended = await fetch(`${base}/admin/providers/${provider.id}/status`, { method: 'PATCH', headers: headers(doctor), body: JSON.stringify({ status: 'SUSPENDED' }) });
  assert.equal(suspended.status, 200);
  assert.deepEqual(await (await lookup()).json(), { eligible: false });
  await prisma.userRole.delete({ where: { userId_roleId: { userId: doctor.user.id, roleId: superAdmin.id } } });
  await prisma.providerMembership.deleteMany({ where: { providerId: provider.id } });
  await prisma.doctorProfile.deleteMany({ where: { providerId: provider.id } });
  await prisma.provider.deleteMany({ where: { id: provider.id } });
});
