import crypto from 'node:crypto';

export const DELIVERY_MAX_ATTEMPTS = 3;
export const TRANSIENT_ERRORS = new Set(['NETWORK_TRANSIENT', 'RATE_LIMITED', 'PROVIDER_5XX', 'TEMPORARY_PROVIDER_FAILURE']);

export class OtpDeliveryProvider {
  async send() { throw new Error('PROVIDER_NOT_IMPLEMENTED'); }
}

export class CallbackAuthenticityVerifier {
  verify() { throw new Error('CALLBACK_VERIFIER_NOT_CONFIGURED'); }
}

export class InternalCallbackAuthenticityVerifier extends CallbackAuthenticityVerifier {
  constructor(secret) { super(); this.secret = secret; }
  verify({ body, signature }) {
    if (!this.secret || !signature) return false;
    const expected = crypto.createHmac('sha256', this.secret).update(JSON.stringify(body)).digest('hex');
    return signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  }
}

export class FakeOtpDeliveryProvider extends OtpDeliveryProvider {
  constructor({ outcomes = [] } = {}) { super(); this.outcomes = [...outcomes]; this.calls = []; }
  async send(request) {
    this.calls.push({ providerKey: request.providerKey, challengeId: request.challengeId });
    const outcome = this.outcomes.shift() ?? 'DELIVERED';
    if (outcome instanceof Error) throw outcome;
    if (outcome === 'UNKNOWN') throw Object.assign(new Error('PROVIDER_TIMEOUT'), { code: 'PROVIDER_TIMEOUT', ambiguous: true });
    if (outcome !== 'DELIVERED') throw Object.assign(new Error(outcome), { code: outcome });
    return { accepted: true, delivered: true, providerMessageId: crypto.randomUUID() };
  }
}

export function semanticHash({ phone, purpose, channel = 'SMS' }) {
  return crypto.createHash('sha256').update(JSON.stringify({ phone, purpose, channel })).digest('hex');
}

export function classifyProviderError(error) {
  const code = String(error?.code ?? error?.message ?? 'PROVIDER_FAILURE');
  if (code === 'PROVIDER_TIMEOUT' || error?.ambiguous) return { kind: 'UNKNOWN', code: 'PROVIDER_TIMEOUT' };
  if (TRANSIENT_ERRORS.has(code)) return { kind: 'TRANSIENT', code };
  return { kind: 'PERMANENT', code };
}

export function nextRetryDelay(attempt) { return Math.min(1000 * (2 ** Math.max(0, attempt - 1)), 8000); }

export async function dispatchOtpDelivery({ prisma, deliveryId, provider, sleep = async () => {} }) {
  for (;;) {
    const delivery = await prisma.otpDelivery.findUnique({ where: { id: deliveryId } });
    if (!delivery || ['DELIVERED', 'FAILED'].includes(delivery.status)) return delivery;
    const attempt = delivery.attemptCount + 1;
    await prisma.otpDelivery.update({ where: { id: deliveryId }, data: { attemptCount: attempt } });
    try {
      const result = await provider.send({ deliveryId: delivery.id, challengeId: delivery.challengeId, providerKey: delivery.providerKey });
      return prisma.otpDelivery.update({ where: { id: delivery.id }, data: { status: result.delivered ? 'DELIVERED' : 'ACCEPTED', providerMessageId: result.providerMessageId ?? null, acceptedAt: new Date(), deliveredAt: result.delivered ? new Date() : null, lastErrorClass: null } });
    } catch (error) {
      const classified = classifyProviderError(error);
      if (classified.kind === 'UNKNOWN') return prisma.otpDelivery.update({ where: { id: delivery.id }, data: { status: 'UNKNOWN', lastErrorClass: classified.code } });
      if (classified.kind === 'TRANSIENT' && attempt < DELIVERY_MAX_ATTEMPTS) { await sleep(nextRetryDelay(attempt)); continue; }
      return prisma.otpDelivery.update({ where: { id: delivery.id }, data: { status: 'FAILED', failedAt: new Date(), lastErrorClass: classified.code } });
    }
  }
}

const terminal = new Set(['DELIVERED', 'FAILED']);
export async function applyOtpDeliveryEvent({ prisma, deliveryId, status, providerMessageId = null }) {
  const current = await prisma.otpDelivery.findUnique({ where: { id: deliveryId } });
  if (!current || terminal.has(current.status)) return current;
  const data = { status, providerMessageId };
  if (status === 'ACCEPTED') data.acceptedAt = new Date();
  if (status === 'DELIVERED') { data.acceptedAt = current.acceptedAt ?? new Date(); data.deliveredAt = new Date(); }
  if (status === 'FAILED') data.failedAt = new Date();
  return prisma.otpDelivery.update({ where: { id: deliveryId }, data });
}

export async function reconcileStalePendingDeliveries({ prisma, now = new Date(), staleAfterMs = 60_000 }) {
  const cutoff = new Date(now.getTime() - staleAfterMs);
  return prisma.otpDelivery.updateMany({ where: { status: 'PENDING', createdAt: { lt: cutoff } }, data: { status: 'UNKNOWN', lastErrorClass: 'DISPATCH_WINDOW_EXPIRED' } });
}
