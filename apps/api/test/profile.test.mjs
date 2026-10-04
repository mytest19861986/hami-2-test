import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeNationalId } from '../src/profile.mjs';

test('Iranian National ID normalization strips formatting before checksum validation', () => {
  assert.equal(normalizeNationalId('123 456-7891'), '1234567891');
  assert.equal(normalizeNationalId('1234567891'), '1234567891');
});

test('Iranian National ID validation rejects repeated, malformed, and bad-checksum values', () => {
  for (const value of ['0000000000', '1234567890', '123456789', '12345678910', '۱۲۳۴۵۶۷۸۹۱']) {
    assert.throws(() => normalizeNationalId(value), { message: 'INVALID_NATIONAL_ID' });
  }
});
