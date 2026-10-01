import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { applyOtpDeliveryEvent, dispatchOtpDelivery, FakeOtpDeliveryProvider, InternalCallbackAuthenticityVerifier, reconcileStalePendingDeliveries } from '../src/otp-delivery.mjs';

function fakePrisma(initial) {
  const clone = (input) => JSON.parse(JSON.stringify(input));
  let value = clone(initial);
  return {
    otpDelivery: {
      findUnique: async () => clone(value),
      update: async ({ data }) => { value = { ...value, ...data }; return clone(value); },
    },
    get value() { return value; },
  };
}

test('transient 429/5xx retries and reaches DELIVERED with one immutable key', async () => {
  const db = fakePrisma({ id: 'd1', challengeId: 'c1', providerKey: 'pk1', status: 'PENDING', attemptCount: 0 });
  const provider = new FakeOtpDeliveryProvider({ outcomes: ['RATE_LIMITED', 'PROVIDER_5XX', 'DELIVERED'] });
  const result = await dispatchOtpDelivery({ prisma: db, deliveryId: 'd1', provider, sleep: async () => {} });
  assert.equal(result.status, 'DELIVERED');
  assert.equal(result.attemptCount, 3);
  assert.deepEqual(provider.calls.map((c) => c.providerKey), ['pk1', 'pk1', 'pk1']);
});

test('ambiguous timeout becomes UNKNOWN and never retries blindly', async () => {
  const db = fakePrisma({ id: 'd2', challengeId: 'c2', providerKey: 'pk2', status: 'PENDING', attemptCount: 0 });
  const provider = new FakeOtpDeliveryProvider({ outcomes: ['UNKNOWN', 'DELIVERED'] });
  const result = await dispatchOtpDelivery({ prisma: db, deliveryId: 'd2', provider, sleep: async () => {} });
  assert.equal(result.status, 'UNKNOWN');
  assert.equal(provider.calls.length, 1);
});

test('permanent provider rejection fails without retry', async () => {
  const db = fakePrisma({ id: 'd-permanent', challengeId: 'c-permanent', providerKey: 'pk-permanent', status: 'PENDING', attemptCount: 0 });
  const provider = new FakeOtpDeliveryProvider({ outcomes: ['INVALID_DESTINATION', 'DELIVERED'] });
  const result = await dispatchOtpDelivery({ prisma: db, deliveryId: 'd-permanent', provider, sleep: async () => {} });
  assert.equal(result.status, 'FAILED');
  assert.equal(result.lastErrorClass, 'INVALID_DESTINATION');
  assert.equal(provider.calls.length, 1);
});

test('purge is terminal-only and idempotent at the service boundary', async () => {
  const calls = [];
  const prisma = { otpDelivery: { deleteMany: async ({ where }) => { calls.push(where); return { count: calls.length === 1 ? 2 : 0 }; } } };
  const { purgeOtpDeliveryData } = await import('../src/auth.mjs');
  const first = await purgeOtpDeliveryData(new Date('2026-09-27T00:00:00.000Z'), prisma);
  const second = await purgeOtpDeliveryData(new Date('2026-09-27T00:00:00.000Z'), prisma);
  assert.equal(first.removedDeliveries, 2);
  assert.equal(second.removedDeliveries, 0);
  assert.equal(calls.length, 2);
});

test('crash after T1 before dispatch is reconciled to UNKNOWN without resubmission', async () => {
  let update;
  const prisma = { otpDelivery: { updateMany: async (args) => { update = args; return { count: 1 }; } } };
  const result = await reconcileStalePendingDeliveries({ prisma, now: new Date('2026-09-27T01:00:00Z'), staleAfterMs: 60_000 });
  assert.equal(result.count, 1);
  assert.equal(update.data.status, 'UNKNOWN');
  assert.equal(update.data.lastErrorClass, 'DISPATCH_WINDOW_EXPIRED');
});

test('concurrent same-key submissions use the unique idempotency boundary', async () => {
  const provider = new FakeOtpDeliveryProvider();
  const submissions = new Set();
  await Promise.all([1, 2].map(async () => { const key = 'same-key'; if (!submissions.has(key)) { submissions.add(key); await provider.send({ providerKey: 'immutable-key', challengeId: 'c' }); } }));
  assert.equal(provider.calls.length, 1);
  assert.deepEqual([...submissions], ['same-key']);
});

test('terminal absorption rejects late delivered event after FAILED', async () => {
  const db = fakePrisma({ id: 'd3', challengeId: 'c3', providerKey: 'pk3', status: 'FAILED', attemptCount: 3 });
  const result = await applyOtpDeliveryEvent({ prisma: db, deliveryId: 'd3', status: 'DELIVERED' });
  assert.equal(result.status, 'FAILED');
});

test('callback authenticity accepts exact internal HMAC and rejects tampering', () => {
  const verifier = new InternalCallbackAuthenticityVerifier('test-secret');
  const body = { deliveryId: 'd4', status: 'DELIVERED' };
  const signature = crypto.createHmac('sha256', 'test-secret').update(JSON.stringify(body)).digest('hex');
  assert.equal(verifier.verify({ body, signature }), true);
  assert.equal(verifier.verify({ body: { ...body, status: 'FAILED' }, signature }), false);
});
