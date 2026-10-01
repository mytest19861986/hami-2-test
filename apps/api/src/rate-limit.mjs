import crypto from 'node:crypto';

const WINDOW_MS = 60_000;
export const RateLimitResult = Object.freeze({ ALLOW: 'ALLOW', DENY: 'DENY', STORE_UNAVAILABLE: 'STORE_UNAVAILABLE' });
export const OutagePolicy = Object.freeze({
  PASSWORD_LOGIN: 'FAIL_SOFT',
  OTP_REQUEST: 'FAIL_CLOSED',
  OTP_VERIFY: 'FAIL_CLOSED',
  ELIGIBILITY: 'FAIL_CLOSED',
  FINANCIAL: 'FAIL_CLOSED',
  ADMIN_FINANCIAL: 'FAIL_CLOSED',
});

export function resolveStoreUnavailable(policy, { abusive = false } = {}) {
  if (OutagePolicy[policy] === 'FAIL_SOFT') return abusive ? { status: 429, event: 'RATE_LIMIT_DEGRADED' } : { status: 503, event: 'RATE_LIMIT_DEGRADED' };
  return abusive ? { status: 429, event: 'RATE_LIMIT_DEGRADED' } : { status: 503, event: 'RATE_LIMIT_DEGRADED' };
}

// Single-instance compatibility store. A shared atomic backend can implement
// the same consume contract without moving policy decisions into controllers.
export class LocalRateLimitStore {
  #entries = new Map();
  constructor({ limit = 5, windowMs = WINDOW_MS } = {}) { this.limit = limit; this.windowMs = windowMs; }
  consume(key, now = Date.now()) {
    const current = this.#entries.get(key);
    if (!current || now - current.startedAt >= this.windowMs) { this.#entries.set(key, { startedAt: now, count: 1 }); return { result: RateLimitResult.ALLOW, retryAfterMs: 0 }; }
    current.count += 1;
    if (current.count > this.limit) return { result: RateLimitResult.DENY, retryAfterMs: Math.max(1, this.windowMs - (now - current.startedAt)) };
    return { result: RateLimitResult.ALLOW, retryAfterMs: 0 };
  }

  purge(now = Date.now()) {
    for (const [key, entry] of this.#entries) if (now - entry.startedAt >= this.windowMs) this.#entries.delete(key);
  }

  get size() { return this.#entries.size; }
}
export function enforceRateLimit(store, key) {
  const decision = store.consume(key);
  if (decision.result === RateLimitResult.DENY) throw new Error('RATE_LIMITED');
  if (decision.result === RateLimitResult.STORE_UNAVAILABLE) throw new Error('RATE_LIMIT_STORE_UNAVAILABLE');
  return decision;
}

export function pseudonymize(subject, secret = process.env.RATE_LIMIT_HMAC_KEY) {
  if (!secret) throw new Error('RATE_LIMIT_HMAC_KEY_MISSING');
  return crypto.createHmac('sha256', secret).update(String(subject)).digest('hex');
}

export function clientIp({ remoteAddress, forwardedFor, trustedProxyCidrs = [] }) {
  const remote = String(remoteAddress ?? '').trim();
  if (!trustedProxyCidrs.includes(remote)) return remote;
  const chain = String(forwardedFor ?? '').split(',').map((value) => value.trim()).filter(Boolean);
  for (let index = chain.length - 1; index >= 0; index -= 1) {
    const candidate = chain[index];
    if (!trustedProxyCidrs.includes(candidate)) return candidate;
  }
  return remote;
}

export const ATOMIC_QUOTA_SCRIPT = `
local current = redis.call('GET', KEYS[1])
local count = tonumber(current or '0')
local limit = tonumber(ARGV[1])
local ttl = tonumber(ARGV[2])
if count >= limit then
  return {0, redis.call('PTTL', KEYS[1])}
end
count = redis.call('INCR', KEYS[1])
redis.call('PEXPIRE', KEYS[1], ttl)
return {1, 0}
`;

export class RedisCompatibleRateLimitStore {
  constructor(client, { limit = 5, windowMs = WINDOW_MS, keyPrefix = 'rl:v1' } = {}) {
    this.client = client;
    this.limit = limit;
    this.windowMs = windowMs;
    this.keyPrefix = keyPrefix;
  }

  async consume(policy, subject) {
    const key = `${this.keyPrefix}:${policy}:${subject}`;
    try {
      const [allowed, retryAfterMs] = await this.client.eval(ATOMIC_QUOTA_SCRIPT, { keys: [key], arguments: [String(this.limit), String(this.windowMs)] });
      return allowed === 1 ? { result: RateLimitResult.ALLOW, retryAfterMs: 0 } : { result: RateLimitResult.DENY, retryAfterMs: Math.max(1, Number(retryAfterMs) || this.windowMs) };
    } catch {
      return { result: RateLimitResult.STORE_UNAVAILABLE, retryAfterMs: 0 };
    }
  }
}
