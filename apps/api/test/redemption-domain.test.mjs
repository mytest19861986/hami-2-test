import test from 'node:test';
import assert from 'node:assert/strict';
import { assertRedemptionTransition, makeToken, publicRedemption, requestFingerprint, tokenHash } from '../src/redemption-domain.mjs';

test('redemption state machine accepts only locked transitions', () => {
  assert.doesNotThrow(() => assertRedemptionTransition('INITIATED', 'CONFIRMED'));
  assert.doesNotThrow(() => assertRedemptionTransition('CONFIRMED', 'REVERSED'));
  assert.throws(() => assertRedemptionTransition('CONFIRMED', 'CANCELLED'), { message: 'INVALID_REDEMPTION_TRANSITION' });
  assert.throws(() => assertRedemptionTransition('CANCELLED', 'CONFIRMED'), { message: 'INVALID_REDEMPTION_TRANSITION' });
});

test('verification token is high entropy and only its hash is persisted', () => {
  const token = makeToken();
  assert.ok(token.length >= 40);
  assert.notEqual(tokenHash(token), token);
  const row = { id: 'r1', verificationTokenHash: tokenHash(token), status: 'INITIATED' };
  assert.deepEqual(publicRedemption(row), { id: 'r1', status: 'INITIATED' });
});

test('idempotency fingerprint is stable and request-scoped', () => {
  assert.equal(requestFingerprint({ providerId: 'p1', benefitMembershipId: 'm1' }), requestFingerprint({ providerId: 'p1', benefitMembershipId: 'm1' }));
  assert.notEqual(requestFingerprint({ providerId: 'p1', benefitMembershipId: 'm1' }), requestFingerprint({ providerId: 'p2', benefitMembershipId: 'm1' }));
});
