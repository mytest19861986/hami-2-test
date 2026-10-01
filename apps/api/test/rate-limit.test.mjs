import test from 'node:test';
import assert from 'node:assert/strict';
import { ATOMIC_QUOTA_SCRIPT, LocalRateLimitStore, OutagePolicy, RateLimitResult, RedisCompatibleRateLimitStore, clientIp, enforceRateLimit, pseudonymize, resolveStoreUnavailable } from '../src/rate-limit.mjs';

test('local rate-limit store allows up to the configured window limit', () => {
  const store = new LocalRateLimitStore({ limit: 2, windowMs: 1000 });
  assert.equal(store.consume('k', 100).result, RateLimitResult.ALLOW);
  assert.equal(store.consume('k', 200).result, RateLimitResult.ALLOW);
  const denied = store.consume('k', 300);
  assert.equal(denied.result, RateLimitResult.DENY);
  assert.ok(denied.retryAfterMs > 0);
});

test('local rate-limit windows reset deterministically and keys remain isolated', () => {
  const store = new LocalRateLimitStore({ limit: 1, windowMs: 1000 });
  assert.equal(store.consume('a', 100).result, RateLimitResult.ALLOW);
  assert.equal(store.consume('b', 100).result, RateLimitResult.ALLOW);
  assert.equal(store.consume('a', 500).result, RateLimitResult.DENY);
  assert.equal(store.consume('a', 1100).result, RateLimitResult.ALLOW);
});

test('enforceRateLimit preserves the shared-store tri-state boundary', () => {
  assert.doesNotThrow(() => enforceRateLimit({ consume: () => ({ result: RateLimitResult.ALLOW, retryAfterMs: 0 }) }, 'k'));
  assert.throws(() => enforceRateLimit({ consume: () => ({ result: RateLimitResult.DENY, retryAfterMs: 10 }) }, 'k'), { message: 'RATE_LIMITED' });
  assert.throws(() => enforceRateLimit({ consume: () => ({ result: RateLimitResult.STORE_UNAVAILABLE }) }, 'k'), { message: 'RATE_LIMIT_STORE_UNAVAILABLE' });
});

test('limiter subjects are HMAC-pseudonymized and trusted proxy parsing is right-to-left', () => {
  const first = pseudonymize('09120000001', 'test-rate-key');
  assert.equal(first, pseudonymize('09120000001', 'test-rate-key'));
  assert.notEqual(first, '09120000001');
  assert.notEqual(first, pseudonymize('09120000002', 'test-rate-key'));
  assert.equal(clientIp({ remoteAddress: '10.0.0.8', forwardedFor: '198.51.100.7, 10.0.0.9', trustedProxyCidrs: ['10.0.0.8', '10.0.0.9'] }), '198.51.100.7');
  assert.equal(clientIp({ remoteAddress: '203.0.113.4', forwardedFor: '198.51.100.7', trustedProxyCidrs: ['10.0.0.8'] }), '203.0.113.4');
});

test('redis-compatible adapter uses one atomic server-side primitive and exposes outage state', async () => {
  const calls = [];
  const store = new RedisCompatibleRateLimitStore({ eval: async (script, options) => { calls.push({ script, options }); return [0, 125]; } }, { limit: 5, windowMs: 60000 });
  const denied = await store.consume('AUTH', 'pseudonymized-subject');
  assert.equal(denied.result, RateLimitResult.DENY);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].script, ATOMIC_QUOTA_SCRIPT);
  assert.deepEqual(calls[0].options.arguments, ['5', '60000']);
  const unavailable = await new RedisCompatibleRateLimitStore({ eval: async () => { throw new Error('down'); } }).consume('AUTH', 'subject');
  assert.equal(unavailable.result, RateLimitResult.STORE_UNAVAILABLE);
});

test('A+B certification enforces one combined quota and survives API-A restart', async () => {
  const state = new Map();
  const shared = {
    async eval(_script, { keys, arguments: args }) {
      const key = keys[0];
      const current = state.get(key) ?? { count: 0, expiresAt: Date.now() + Number(args[1]) };
      if (current.expiresAt <= Date.now()) current.count = 0;
      if (current.count >= Number(args[0])) return [0, Math.max(1, current.expiresAt - Date.now())];
      current.count += 1;
      current.expiresAt = Date.now() + Number(args[1]);
      state.set(key, current);
      return [1, 0];
    },
  };
  const apiA = new RedisCompatibleRateLimitStore(shared, { limit: 5, windowMs: 60_000 });
  const apiB = new RedisCompatibleRateLimitStore(shared, { limit: 5, windowMs: 60_000 });
  assert.equal((await apiA.consume('AUTH', 'same-subject')).result, RateLimitResult.ALLOW);
  assert.equal((await apiA.consume('AUTH', 'same-subject')).result, RateLimitResult.ALLOW);
  assert.equal((await apiA.consume('AUTH', 'same-subject')).result, RateLimitResult.ALLOW);
  assert.equal((await apiB.consume('AUTH', 'same-subject')).result, RateLimitResult.ALLOW);
  assert.equal((await apiB.consume('AUTH', 'same-subject')).result, RateLimitResult.ALLOW);
  assert.equal((await apiB.consume('AUTH', 'same-subject')).result, RateLimitResult.DENY);
  const restartedApiA = new RedisCompatibleRateLimitStore(shared, { limit: 5, windowMs: 60_000 });
  assert.equal((await restartedApiA.consume('AUTH', 'same-subject')).result, RateLimitResult.DENY);
});

test('outage policy matrix is explicit and emits degraded security telemetry', () => {
  for (const policy of Object.keys(OutagePolicy)) {
    const normal = resolveStoreUnavailable(policy, { abusive: false });
    const abusive = resolveStoreUnavailable(policy, { abusive: true });
    assert.equal(normal.status, 503);
    assert.equal(abusive.status, 429);
    assert.equal(normal.event, 'RATE_LIMIT_DEGRADED');
    assert.equal(abusive.event, 'RATE_LIMIT_DEGRADED');
  }
  assert.equal(OutagePolicy.PASSWORD_LOGIN, 'FAIL_SOFT');
  assert.equal(OutagePolicy.OTP_REQUEST, 'FAIL_CLOSED');
  assert.equal(OutagePolicy.FINANCIAL, 'FAIL_CLOSED');
});

test('local limiter has bounded window retention and purgeable cardinality', () => {
  const store = new LocalRateLimitStore({ limit: 1, windowMs: 1000 });
  for (let index = 0; index < 100; index += 1) store.consume(`subject-${index}`, 100);
  assert.equal(store.size, 100);
  store.purge(1099);
  assert.equal(store.size, 100);
  store.purge(1100);
  assert.equal(store.size, 0);
});
