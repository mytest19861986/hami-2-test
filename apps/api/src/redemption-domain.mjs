import crypto from 'node:crypto';
import { evaluateEligibility } from './eligibility.mjs';

const transitions = {
  INITIATED: ['CONFIRMED', 'CANCELLED', 'EXPIRED'],
  CONFIRMED: ['REVERSED'],
  CANCELLED: [],
  EXPIRED: [],
  REVERSED: [],
};

export function assertRedemptionTransition(from, to) {
  if (!transitions[from]?.includes(to)) throw new Error('INVALID_REDEMPTION_TRANSITION');
}

export function tokenHash(token) { return crypto.createHash('sha256').update(token).digest('hex'); }
export function requestFingerprint({ providerId, benefitMembershipId }) {
  return crypto.createHash('sha256').update(JSON.stringify({ providerId: String(providerId ?? ''), benefitMembershipId: String(benefitMembershipId ?? '') })).digest('hex');
}
export function makeToken() { return crypto.randomBytes(32).toString('base64url'); }
export function publicRedemption(row) {
  if (!row) return row;
  const safe = { ...row };
  delete safe.verificationTokenHash;
  return safe;
}

function safeBenefitSnapshot({ membership, benefit, provider, confirmedAt = null }) {
  return {
    membershipId: membership.id,
    planId: membership.planId,
    planCode: membership.plan.code,
    planName: membership.plan.name,
    providerId: provider.id,
    providerName: provider.displayName,
    planProviderBenefitId: benefit.id,
    discountType: benefit.discountType,
    discountValue: String(benefit.discountValue),
    currency: null,
    terms: membership.plan.description ?? null,
    confirmedAt,
  };
}

async function eligibleContext(db, customerUserId, providerId, membershipId, now) {
  const [user, provider, membership, benefits] = await Promise.all([
    db.user.findUnique({ where: { id: customerUserId }, select: { id: true, status: true } }),
    db.provider.findUnique({ where: { id: providerId } }),
    db.benefitMembership.findFirst({ where: { id: membershipId, userId: customerUserId }, include: { plan: true, purchase: { select: { status: true } } } }),
    db.planProviderBenefit.findMany({ where: { providerId, isActive: true }, include: { plan: true } }),
  ]);
  const result = evaluateEligibility({ user, provider, memberships: membership ? [membership] : [], benefits, now });
  if (!result.eligible) throw new Error('REDEMPTION_NOT_ELIGIBLE');
  const benefit = benefits.find((item) => item.planId === membership.planId && item.providerId === providerId && item.isActive && item.plan.status === 'ACTIVE');
  if (!benefit) throw new Error('REDEMPTION_NOT_ELIGIBLE');
  return { user, provider, membership, benefit };
}

export function createRedemptionService(db, { now = () => new Date(), tokenTtlMs = Number(process.env.REDEMPTION_TOKEN_TTL_MS ?? 600000) } = {}) {
  return {
    async initiate({ customerUserId, providerId, benefitMembershipId, idempotencyKey }) {
      if (!idempotencyKey || String(idempotencyKey).length > 200) throw new Error('IDEMPOTENCY_KEY_REQUIRED');
      const current = now();
      const existing = await db.redemption.findUnique({ where: { customerUserId_idempotencyKey: { customerUserId, idempotencyKey: String(idempotencyKey) } } });
      const fingerprint = requestFingerprint({ providerId, benefitMembershipId });
      if (existing) {
        if (existing.benefitSnapshot?.requestFingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
        return { redemption: existing, rawToken: null, replay: true };
      }
      const context = await eligibleContext(db, customerUserId, providerId, benefitMembershipId, current);
      const rawToken = makeToken();
      const snapshot = { ...safeBenefitSnapshot(context), requestFingerprint: fingerprint };
      try {
        const redemption = await db.redemption.create({ data: { customerUserId, providerId, benefitMembershipId, idempotencyKey: String(idempotencyKey), verificationTokenHash: tokenHash(rawToken), benefitSnapshot: snapshot, tokenExpiresAt: new Date(current.getTime() + tokenTtlMs) } });
        return { redemption, rawToken, replay: false };
      } catch (error) {
        if (error?.code !== 'P2002') throw error;
        const raced = await db.redemption.findUnique({ where: { customerUserId_idempotencyKey: { customerUserId, idempotencyKey: String(idempotencyKey) } } });
        if (!raced) throw error;
        if (raced.benefitSnapshot?.requestFingerprint !== fingerprint) throw new Error('IDEMPOTENCY_CONFLICT');
        return { redemption: raced, rawToken: null, replay: true };
      }
    },
    async get(id, actor) {
      const row = await db.redemption.findUnique({ where: { id }, include: { provider: true } });
      if (!row) throw new Error('REDEMPTION_NOT_FOUND');
      if (row.customerUserId !== actor.id && !actor.isAdmin && row.providerId !== actor.providerId) throw new Error('FORBIDDEN');
      if (row.status === 'INITIATED' && row.tokenExpiresAt <= now()) {
        await db.redemption.updateMany({ where: { id, status: 'INITIATED', tokenExpiresAt: { lte: now() } }, data: { status: 'EXPIRED', expiredAt: now() } });
        return publicRedemption({ ...row, status: 'EXPIRED', expiredAt: now() });
      }
      return publicRedemption(row);
    },
    async confirm({ providerUserId, token }) {
      if (!token) throw new Error('REDEMPTION_TOKEN_REQUIRED');
      return db.$transaction(async (tx) => {
        const providerMembership = await tx.providerMembership.findFirst({ where: { userId: providerUserId, role: { in: ['OWNER', 'MANAGER', 'STAFF'] }, provider: { status: 'APPROVED' } } });
        if (!providerMembership) throw new Error('FORBIDDEN');
        const row = await tx.redemption.findUnique({ where: { verificationTokenHash: tokenHash(token) } });
        if (!row || row.providerId !== providerMembership.providerId) throw new Error('REDEMPTION_TOKEN_INVALID');
        const current = now();
        if (row.status === 'CONFIRMED') return { redemption: publicRedemption(row), replay: true };
        if (row.status !== 'INITIATED') throw new Error('REDEMPTION_NOT_CONFIRMABLE');
        if (row.tokenExpiresAt <= current) {
          await tx.redemption.updateMany({ where: { id: row.id, status: 'INITIATED' }, data: { status: 'EXPIRED', expiredAt: current } });
          throw new Error('REDEMPTION_EXPIRED');
        }
        const context = await eligibleContext(tx, row.customerUserId, row.providerId, row.benefitMembershipId, current);
        assertRedemptionTransition(row.status, 'CONFIRMED');
        const snapshot = { ...safeBenefitSnapshot({ ...context, confirmedAt: current.toISOString() }), requestFingerprint: row.benefitSnapshot?.requestFingerprint };
        const claimed = await tx.redemption.updateMany({ where: { id: row.id, status: 'INITIATED' }, data: { status: 'CONFIRMED', confirmedAt: current, benefitSnapshot: snapshot } });
        if (claimed.count !== 1) throw new Error('REDEMPTION_CONFIRMATION_RACE');
        return { redemption: publicRedemption({ ...row, status: 'CONFIRMED', confirmedAt: current, benefitSnapshot: snapshot }), replay: false };
      }, { isolationLevel: 'Serializable' });
    },
    async cancel({ id, customerUserId }) {
      return db.$transaction(async (tx) => {
        const row = await tx.redemption.findUnique({ where: { id } });
        if (!row) throw new Error('REDEMPTION_NOT_FOUND');
        if (row.customerUserId !== customerUserId) throw new Error('FORBIDDEN');
        if (row.status !== 'INITIATED') throw new Error('REDEMPTION_NOT_CANCELLABLE');
        const changed = await tx.redemption.updateMany({ where: { id, customerUserId, status: 'INITIATED' }, data: { status: 'CANCELLED', cancelledAt: now() } });
        if (changed.count !== 1) throw new Error('REDEMPTION_CANCEL_RACE');
        return tx.redemption.findUnique({ where: { id } });
      }, { isolationLevel: 'Serializable' });
    },
    async reverse({ id, actorId, reason }) {
      if (!reason || String(reason).trim().length < 3) throw new Error('REVERSAL_REASON_REQUIRED');
      const result = await db.$transaction(async (tx) => {
        const row = await tx.redemption.findUnique({ where: { id } });
        if (!row) throw new Error('REDEMPTION_NOT_FOUND');
        if (row.status === 'REVERSED') return row;
        assertRedemptionTransition(row.status, 'REVERSED');
        const changed = await tx.redemption.updateMany({ where: { id, status: 'CONFIRMED' }, data: { status: 'REVERSED', reversedAt: now() } });
        if (changed.count !== 1) throw new Error('REDEMPTION_REVERSAL_RACE');
        await tx.auditLog.create({ data: { actorUserId: actorId, action: 'REDEMPTION_REVERSED', entity: `Redemption:${id}:${String(reason).trim().slice(0, 200)}` } });
        return tx.redemption.findUnique({ where: { id } });
      }, { isolationLevel: 'Serializable' });
      return result;
    },
  };
}
