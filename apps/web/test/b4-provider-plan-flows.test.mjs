import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

test('B4 provider directory uses the real filtered provider contract', () => {
  const page = read('pages/providers/index.jsx');
  assert.match(page, /\/providers/);
  assert.match(page, /provinceId/);
  assert.match(page, /cityId/);
  assert.match(page, /setFilters\(\{ provinceId, cityId: '', specialtyId: filters\.specialtyId \}\)/);
  assert.match(page, /در حال بارگذاری/);
  assert.match(page, /پیدا نشد/);
});
test('B4 provider discovery exposes the specialty chain and safe states', () => {
  const page = read('pages/providers/index.jsx');
  assert.match(page, /specialties/);
  assert.match(page, /specialtyId/);
  assert.match(page, /تخصص/);
  assert.match(page, /\/specialties/);
});

test('doctor national-ID eligibility UI submits transient input and renders only safe provider fields', () => {
  const page = read('pages/providers/index.jsx');
  assert.match(page, /providers\/eligibility\/doctor/);
  assert.match(page, /provider-directory-empty/);
  assert.match(page, /setNationalId\(''\)/);
  assert.match(page, /eligibility\.provider\.displayName/);
  assert.doesNotMatch(page, /nationalIdHmac|maskedNationalId/);
  const onboarding = read('pages/providers/onboarding.jsx');
  assert.match(onboarding, /provider-national-id/);
  assert.match(onboarding, /provider-onboarding-form/);
  assert.match(onboarding, /nationalId: ''/);
  const admin = read('pages/admin/providers.jsx');
  assert.match(admin, /providers\.doctor_national_id\.manage/);
  assert.match(admin, /doctor-national-id/);
  assert.doesNotMatch(admin, /nationalIdHmac|maskedNationalId/);
});

test('B4 provider detail renders only public response fields', () => {
  const page = read('pages/providers/[id].jsx');
  assert.match(page, /\/providers\/\$\{router\.query\.id\}/);
  assert.match(page, /displayName/);
  assert.match(page, /doctorProfile\?\.specialty/);
  assert.match(page, /این پزشک پیدا نشد/);
  assert.doesNotMatch(page, /memberships|userId|audit/);
});

test('B4 provider operations exposes self-scoped status and guarded review controls', () => {
  const self = read('pages/providers/me.jsx');
  assert.match(self, /users\/me\/providers/);
  assert.match(self, /PENDING_REVIEW/);
  const admin = read('pages/admin/providers.jsx');
  assert.match(admin, /providers\.read/);
  assert.match(admin, /PENDING_REVIEW/);
  assert.match(admin, /REJECTED/);
  assert.doesNotMatch(admin, /status !== 'APPROVED'.*APPROVED/);
});

test('B4 plan catalog and detail use active plan contracts', () => {
  assert.match(read('pages/plans/index.jsx'), /\/benefit-plans/);
  assert.match(read('pages/plans/[id].jsx'), /\/benefit-plans\/\$\{router\.query\.id\}/);
  assert.match(read('pages/plans/[id].jsx'), /api\.post\('\/users\/me\/purchases'/);
});

test('B4 purchase flow does not submit arbitrary user identity', () => {
  const page = read('pages/plans/[id].jsx');
  assert.match(page, /\{ planId: item\.id \}/);
  assert.doesNotMatch(page, /userId/);
  assert.match(read('pages/purchases/[id].jsx'), /amountSnapshot/);
  assert.match(read('pages/purchases/[id].jsx'), /PENDING_PAYMENT/);
});

test('B4 membership page maps backend states without inventing states', () => {
  const page = read('pages/memberships/index.jsx');
  const presentation = read('lib/presentation.js');
  assert.match(page, /users\/me\/memberships/);
  assert.match(page, /labelStatus\(item\.status\)/);
  for (const status of ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING']) assert.match(presentation, new RegExp(status));
});

test('B4 user shell exposes the user journey routes', () => {
  const shell = read('components/user-shell.jsx');
  for (const route of ['/providers', '/providers/me', '/plans', '/purchases', '/memberships']) assert.match(shell, new RegExp(route));
});
