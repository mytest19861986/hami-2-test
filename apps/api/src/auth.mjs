import crypto from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { FakeOtpDeliveryProvider, dispatchOtpDelivery, semanticHash } from './otp-delivery.mjs';

export const prisma = new PrismaClient();

export function normalizeMobile(value) {
  const raw = String(value ?? '').trim().replace(/[\s()-]/g, '');
  if (/^09\d{9}$/.test(raw)) return `+98${raw.slice(1)}`;
  if (/^989\d{9}$/.test(raw)) return `+${raw}`;
  if (/^\+989\d{9}$/.test(raw)) return raw;
  throw new Error('INVALID_MOBILE');
}

function digest(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export const AUTH_COOKIE = '__Host-access';
export const REFRESH_COOKIE = '__Host-refresh';
export const CSRF_COOKIE = '__Host-csrf';
const verifiedRegistrationUsers = new Map();
function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error('AUTH_SECRET_MISSING');
  return secret;
}
export function parseCookies(header = '') {
  return Object.fromEntries(String(header).split(';').map((item) => item.trim().split('='))
    .filter(([name, value]) => name && value).map(([name, ...value]) => [name, decodeURIComponent(value.join('='))]));
}
export function cookieHeader(name, value, attributes) { return `${name}=${encodeURIComponent(value)}; ${attributes}`; }
export function setSessionCookies(response, tokens) {
  const csrf = crypto.randomBytes(24).toString('base64url');
  response.header('Set-Cookie', [
    cookieHeader(AUTH_COOKIE, tokens.accessToken, 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=900'),
    cookieHeader(REFRESH_COOKIE, `${tokens.sessionId}.${tokens.refreshToken}`, 'HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=2592000'),
    cookieHeader(CSRF_COOKIE, csrf, 'Secure; SameSite=Lax; Path=/; Max-Age=900'),
  ]);
  return csrf;
}
export function clearSessionCookies(response) {
  response.header('Set-Cookie', [
    cookieHeader(AUTH_COOKIE, '', 'HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'),
    cookieHeader(REFRESH_COOKIE, '', 'HttpOnly; Secure; SameSite=Strict; Path=/api/v1/auth/refresh; Max-Age=0'),
    cookieHeader(CSRF_COOKIE, '', 'Secure; SameSite=Lax; Path=/; Max-Age=0'),
  ]);
}
export function cookieAuth(req) {
  const cookies = parseCookies(req.headers.cookie);
  const cookieIdentity = cookies[AUTH_COOKIE] ? readAccess(cookies[AUTH_COOKIE]) : null;
  const bearer = readAccess(String(req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''));
  if (cookieIdentity && bearer && cookieIdentity.sub !== bearer.sub) throw new Error('AUTH_CONFLICT');
  return { auth: cookieIdentity ?? bearer, cookies, cookieMode: Boolean(cookieIdentity) };
}
export function assertOriginAndCsrf(req) {
  const { cookies, cookieMode } = cookieAuth(req);
  if (!cookieMode) return;
  const origin = req.headers.origin;
  const referer = req.headers.referer;
  const expected = process.env.FRONTEND_ORIGIN ?? 'http://localhost:3000';
  if ((origin && origin !== expected) || (!origin && (!referer || !referer.startsWith(expected)))) throw new Error('CSRF_REJECTED');
  if (!req.headers['x-csrf-token'] || req.headers['x-csrf-token'] !== cookies[CSRF_COOKIE]) throw new Error('CSRF_REJECTED');
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  const [salt, expected] = String(stored ?? '').split(':');
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

export function createPasswordSetupToken(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, purpose: 'PASSWORD_SETUP', exp: Date.now() + 10 * 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readPasswordSetupToken(token) {
  const [payload, signature] = String(token ?? '').split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  let data;
  try { data = JSON.parse(Buffer.from(payload, 'base64url').toString()); } catch { return null; }
  return data.purpose === 'PASSWORD_SETUP' && data.exp > Date.now() ? data : null;
}

export function rememberVerifiedRegistration(userId) { verifiedRegistrationUsers.set(userId, Date.now() + 10 * 60_000); }
export function consumeVerifiedRegistration(userId) {
  const expiresAt = verifiedRegistrationUsers.get(userId);
  if (!expiresAt || expiresAt <= Date.now()) { verifiedRegistrationUsers.delete(userId); return false; }
  verifiedRegistrationUsers.delete(userId);
  return true;
}

function signAccess(userId) {
  const payload = Buffer.from(JSON.stringify({ sub: userId, exp: Date.now() + 15 * 60_000 })).toString('base64url');
  const signature = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function readAccess(token) {
  const [payload, signature] = String(token ?? '').split('.');
  if (!payload || !signature) return null;
  const expected = crypto.createHmac('sha256', authSecret()).update(payload).digest('base64url');
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
  const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
  return data.exp > Date.now() ? data : null;
}

export async function requestOtp(phone, purpose = 'REGISTER', { idempotencyKey = null, provider = new FakeOtpDeliveryProvider() } = {}) {
  const normalized = normalizeMobile(phone);
  const code = String(crypto.randomInt(100000, 1000000));
  const requestHash = semanticHash({ phone: normalized, purpose });
  if (idempotencyKey) {
    const existing = await prisma.otpDelivery.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.semanticHash !== requestHash) throw new Error('IDEMPOTENCY_CONFLICT');
      return { deliveryId: existing.id, idempotentReplay: true };
    }
  }
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.updateMany({ where: { phone: normalized, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
    return tx.otpChallenge.create({ data: { phone: normalized, purpose, codeHash: digest(code), expiresAt: new Date(Date.now() + 5 * 60_000) } });
  });
  let delivery;
  try {
    delivery = await prisma.otpDelivery.create({ data: { challengeId: challenge.id, purpose, providerKey: crypto.randomUUID(), idempotencyKey, semanticHash: requestHash } });
  } catch (error) {
    if (error?.code === 'P2002' && idempotencyKey) {
      const existing = await prisma.otpDelivery.findUnique({ where: { idempotencyKey } });
      if (existing?.semanticHash === requestHash) return { deliveryId: existing.id, idempotentReplay: true };
      throw new Error('IDEMPOTENCY_CONFLICT');
    }
    throw error;
  }
  await dispatchOtpDelivery({ prisma, deliveryId: delivery.id, provider });
  await audit(null, 'OTP_REQUESTED', 'OtpChallenge');
  if (process.env.ALLOW_DEV_OTP_CODE !== 'true') return {};
  return { devCode: code, deliveryId: delivery.id };
}

export async function purgeOtpDeliveryData(now = new Date(), db = prisma) {
  const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
  const removed = await db.otpDelivery.deleteMany({ where: { createdAt: { lt: cutoff }, status: { in: ['DELIVERED', 'FAILED', 'UNKNOWN'] } } });
  return { removedDeliveries: removed.count };
}

export async function verifyOtp(phone, purpose, code) {
  const normalized = normalizeMobile(phone);
  const challenge = await prisma.otpChallenge.findFirst({ where: { phone: normalized, purpose, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (!challenge || challenge.expiresAt <= new Date() || challenge.attemptCount >= challenge.maxAttempts) { await audit(null, 'OTP_FAILED', 'OtpChallenge'); throw new Error('OTP_INVALID'); }
  const valid = digest(code) === challenge.codeHash;
  if (valid) {
    const consumed = await prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null, attemptCount: { lt: challenge.maxAttempts } }, data: { consumedAt: new Date(), attemptCount: { increment: 1 } } });
    if (consumed.count !== 1) { await audit(null, 'OTP_FAILED', 'OtpChallenge'); throw new Error('OTP_INVALID'); }
  } else {
    await prisma.otpChallenge.updateMany({ where: { id: challenge.id, consumedAt: null }, data: { attemptCount: { increment: 1 } } });
  }
  if (!valid) { await audit(null, 'OTP_FAILED', 'OtpChallenge'); throw new Error('OTP_INVALID'); }
  return normalized;
}

export async function createSession(userId) {
  const refreshToken = crypto.randomBytes(32).toString('base64url');
  const now = new Date();
  const absoluteExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60_000);
  const idleExpiresAt = new Date(now.getTime() + 24 * 60 * 60_000);
  const session = await prisma.$transaction(async (tx) => {
    const family = await tx.sessionFamily.create({ data: { userId, absoluteExpiresAt } });
    return tx.authSession.create({ data: { userId, familyId: family.id, generation: 1, refreshTokenHash: digest(refreshToken), expiresAt: idleExpiresAt, idleExpiresAt, absoluteExpiresAt } });
  });
  await audit(userId, 'SESSION_FAMILY_CREATED', 'SessionFamily');
  await audit(userId, 'SESSION_CREATED', 'AuthSession');
  return { accessToken: signAccess(userId), refreshToken, sessionId: session.id };
}

export async function revokeSession(sessionId, expectedUserId = null) {
  const session = await prisma.authSession.findUnique({ where: { id: sessionId }, select: { userId: true, familyId: true } });
  if (expectedUserId && session && session.userId !== expectedUserId) throw new Error('FORBIDDEN');
  if (session?.familyId) {
    await prisma.sessionFamily.updateMany({ where: { id: session.familyId, status: 'ACTIVE' }, data: { status: 'REVOKED', revocationReason: 'LOGOUT' } });
  } else {
    await prisma.authSession.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date(), consumedAt: new Date() } });
  }
  if (session) await audit(session.userId, 'SESSION_FAMILY_REVOKED', 'SessionFamily');
}

export async function rotateSession(sessionId, refreshToken) {
  const presentedHash = digest(refreshToken);
  const next = await prisma.$transaction(async (tx) => {
    const lockedRows = await tx.$queryRaw`SELECT "id", "userId", "familyId", "generation", "refreshTokenHash", "createdAt", "expiresAt", "absoluteExpiresAt", "revokedAt", "consumedAt" FROM "AuthSession" WHERE "id" = ${sessionId} FOR UPDATE`;
    let session = lockedRows[0] ?? null;
    if (!session) throw new Error('REFRESH_INVALID');
    if (session.familyId) await tx.$queryRaw`SELECT id FROM "SessionFamily" WHERE id = ${session.familyId} FOR UPDATE`;
    if (session.familyId) session = (await tx.$queryRaw`SELECT "id", "userId", "familyId", "generation", "refreshTokenHash", "createdAt", "expiresAt", "absoluteExpiresAt", "revokedAt", "consumedAt" FROM "AuthSession" WHERE "id" = ${sessionId}`)[0];
    const now = new Date();
    if (!session.familyId && now.getTime() - session.createdAt.getTime() > 7 * 24 * 60 * 60_000) return { invalid: true, userId: session.userId, familyId: null };
    const invalid = session.refreshTokenHash !== presentedHash || session.revokedAt || session.consumedAt || session.expiresAt <= now || session.absoluteExpiresAt <= now;
    const family = session.familyId ? await tx.sessionFamily.findUnique({ where: { id: session.familyId } }) : null;
    if (invalid || (family && family.status !== 'ACTIVE')) {
      return { invalid: true, userId: session.userId, familyId: family?.id ?? session.familyId };
    }
    if (!family) {
      const legacy = await tx.sessionFamily.create({ data: { userId: session.userId, absoluteExpiresAt: session.absoluteExpiresAt } });
      session = await tx.authSession.update({ where: { id: session.id }, data: { familyId: legacy.id } });
    }
    const consumed = await tx.authSession.updateMany({ where: { id: session.id, consumedAt: null, revokedAt: null, refreshTokenHash: presentedHash }, data: { consumedAt: now, revokedAt: now, lastUsedAt: now } });
    if (consumed.count !== 1) {
      return { invalid: true, userId: session.userId, familyId: session.familyId };
    }
    const token = crypto.randomBytes(32).toString('base64url');
    const idleExpiresAt = new Date(Math.min(session.absoluteExpiresAt.getTime(), now.getTime() + 24 * 60 * 60_000));
    const created = await tx.authSession.create({ data: { userId: session.userId, familyId: session.familyId, generation: session.generation + 1, refreshTokenHash: digest(token), expiresAt: idleExpiresAt, idleExpiresAt, absoluteExpiresAt: session.absoluteExpiresAt } });
    await tx.sessionFamily.update({ where: { id: session.familyId }, data: { lastRefreshedAt: now } });
    await tx.auditLog.create({ data: { actorUserId: session.userId, action: 'REFRESH_ROTATED', entity: 'AuthSession' } });
    return { accessToken: signAccess(session.userId), refreshToken: token, sessionId: created.id };
  });
  if (next.invalid) {
    if (next.familyId) {
      await prisma.sessionFamily.updateMany({ where: { id: next.familyId, status: 'ACTIVE' }, data: { status: 'REVOKED', revocationReason: 'REPLAY_DETECTED' } });
      await audit(next.userId, 'REFRESH_REUSE_DETECTED', 'SessionFamily');
    }
    throw new Error('REFRESH_INVALID');
  }
  return next;
}

export async function purgeSessionFamilyData(now = new Date()) {
  const generationCutoff = new Date(now.getTime() - 7 * 24 * 60 * 60_000);
  const familyCutoff = new Date(now.getTime() - 90 * 24 * 60 * 60_000);
  const removedGenerations = await prisma.authSession.deleteMany({
    where: { consumedAt: { not: null }, expiresAt: { lt: generationCutoff } },
  });
  const removedFamilies = await prisma.sessionFamily.deleteMany({
    where: {
      status: { in: ['REVOKED', 'EXPIRED'] },
      createdAt: { lt: familyCutoff },
      sessions: { none: {} },
    },
  });
  return { removedGenerations: removedGenerations.count, removedFamilies: removedFamilies.count };
}

export async function audit(actorUserId, action, entity, details = {}, db = prisma) {
  const data = { actorUserId, action, entity };
  if (details.entityId !== undefined) data.entityId = details.entityId;
  if (details.metadata !== undefined) data.metadata = details.metadata;
  if (details.idempotencyKey !== undefined) data.idempotencyKey = details.idempotencyKey;
  return db.auditLog.create({ data });
}
