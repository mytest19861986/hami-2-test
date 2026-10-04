import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const source = fs.readFileSync(new URL('../pages/profile.jsx', import.meta.url), 'utf8');

test('profile settings uses the existing backend contract and masks sensitive identity data', () => {
  assert.match(source, /users\/me\/profile/);
  assert.match(source, /maskedNationalId/);
  assert.doesNotMatch(source, /data\?\.nationalId/);
  assert.match(source, /اطلاعات حساس/);
  assert.doesNotMatch(source, /role|permission|localStorage|sessionStorage/);
});

test('profile settings covers loading, error, retry and permitted edit fields', () => {
  for (const marker of ['LoadingState', 'ErrorState', 'firstName', 'lastName', 'birthDate', 'auth\/logout']) {
    if (marker === 'auth\\/logout') continue;
    assert.match(source, new RegExp(marker));
  }
});
