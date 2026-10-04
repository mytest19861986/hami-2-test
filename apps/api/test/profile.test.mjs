import test from 'node:test';
import assert from 'node:assert/strict';
import { doctorNationalIdIdentity, normalizeNationalId } from '../src/profile.mjs';

test('Iranian National ID normalization strips formatting before checksum validation', () => {
  assert.equal(normalizeNationalId('123 456-7891'), '1234567891');
  assert.equal(normalizeNationalId('1234567891'), '1234567891');
});

test('Iranian National ID validation rejects repeated, malformed, and bad-checksum values', () => {
  for (const value of ['0000000000', '1234567890', '123456789', '12345678910', '۱۲۳۴۵۶۷۸۹۱']) {
    assert.throws(() => normalizeNationalId(value), { message: 'INVALID_NATIONAL_ID' });
  }
});

test('Doctor identity is a keyed versioned digest and never returns the normalized ID', () => {
  const secret = 'local-test-only-doctor-identity-key-32bytes';
  const identity = doctorNationalIdIdentity('123 456-7891', { secret });
  assert.equal(identity.nationalIdKeyVersion, 1);
  assert.match(identity.nationalIdHmac, /^[a-f0-9]{64}$/);
  assert.deepEqual(identity, doctorNationalIdIdentity('1234567891', { secret }));
  assert.notEqual(identity.nationalIdHmac, doctorNationalIdIdentity('1234567891', { secret: `${secret}!` }).nationalIdHmac);
  assert.equal(JSON.stringify(identity).includes('1234567891'), false);
});

test('Doctor identity fails closed when its dedicated key is absent or too short', () => {
  assert.throws(() => doctorNationalIdIdentity('1234567891', { secret: '' }), { message: 'DOCTOR_NATIONAL_ID_KEY_UNAVAILABLE' });
  assert.throws(() => doctorNationalIdIdentity('1234567891', { secret: 'too-short' }), { message: 'DOCTOR_NATIONAL_ID_KEY_UNAVAILABLE' });
});
