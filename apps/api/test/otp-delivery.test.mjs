import test from 'node:test';
import assert from 'node:assert/strict';
import { FakeOtpDeliveryProvider, classifyProviderError, nextRetryDelay } from '../src/otp-delivery.mjs';

test('OTP provider contract classifies transient, permanent, and ambiguous outcomes', () => {
  assert.deepEqual(classifyProviderError(Object.assign(new Error('429'), { code: 'RATE_LIMITED' })), { kind: 'TRANSIENT', code: 'RATE_LIMITED' });
  assert.deepEqual(classifyProviderError(Object.assign(new Error('bad config'), { code: 'INVALID_CONFIGURATION' })), { kind: 'PERMANENT', code: 'INVALID_CONFIGURATION' });
  assert.deepEqual(classifyProviderError(Object.assign(new Error('timeout'), { code: 'PROVIDER_TIMEOUT', ambiguous: true })), { kind: 'UNKNOWN', code: 'PROVIDER_TIMEOUT' });
  assert.equal(nextRetryDelay(1), 1000);
  assert.equal(nextRetryDelay(4), 8000);
});

test('fake provider preserves the immutable provider key across calls', async () => {
  const provider = new FakeOtpDeliveryProvider({ outcomes: ['RATE_LIMITED', 'DELIVERED'] });
  await assert.rejects(() => provider.send({ providerKey: 'fixed-key', challengeId: 'challenge-1' }), /RATE_LIMITED/);
  const result = await provider.send({ providerKey: 'fixed-key', challengeId: 'challenge-1' });
  assert.equal(result.delivered, true);
  assert.deepEqual(provider.calls.map((call) => call.providerKey), ['fixed-key', 'fixed-key']);
});
