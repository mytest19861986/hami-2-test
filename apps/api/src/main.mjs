import 'reflect-metadata';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { Body, Controller, Delete, Get, Module, Patch, Post, Put, Req, Res } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { assertOriginAndCsrf, audit, clearSessionCookies, cookieAuth, consumeVerifiedRegistration, createPasswordSetupToken, createSession, hashPassword, normalizeMobile, prisma, readPasswordSetupToken, rememberVerifiedRegistration, requestOtp, revokeSession, rotateSession, setSessionCookies, verifyOtp, verifyPassword, REFRESH_COOKIE } from './auth.mjs';
import { requireUser, validateAddressInput, validateProfileInput, normalizeNationalId } from './profile.mjs';
import { evaluateEligibility } from './eligibility.mjs';
import { LocalRateLimitStore, enforceRateLimit } from './rate-limit.mjs';
import { FakePayoutProvider, classifyDiscrepancy, isDefinitiveNotPaid, snapshotsEqual } from './payout-core.mjs';
import { emitAuthorizationDecision } from './authorization-audit-emitter.mjs';
import { auditModeDecision, modeDedupKey } from './authorization-audit-mode.mjs';
import { assertComplianceActor, complianceProjection } from './compliance-access.mjs';
import { createRedemptionService, publicRedemption } from './redemption-domain.mjs';

const payoutProvider = new FakePayoutProvider();
const redemptionService = createRedemptionService(prisma);
if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32) throw new Error('AUTH_SECRET_MISSING');

const localRateLimitStore = new LocalRateLimitStore({ limit: 5, windowMs: 60_000 });
if (process.env.NODE_ENV === 'production' && process.env.OTP_PROVIDER !== 'sms') throw new Error('Production requires OTP_PROVIDER=sms');
function rateLimit(key) { enforceRateLimit(localRateLimitStore, key); }
function maskNationalId(value) { const raw = String(value ?? ''); return raw ? `${'*'.repeat(Math.max(0, raw.length - 2))}${raw.slice(-2)}` : null; }
function customerAlias(customerUserId) {
  return `مشتری ${crypto.createHash('sha256').update(String(customerUserId)).digest('hex').slice(0, 8).toUpperCase()}`;
}
function parseFinancialInteger(value, { positive = false, nonNegative = false } = {}) {
  if (typeof value === 'number' && !Number.isSafeInteger(value)) throw new Error('INVALID_FINANCIAL_AMOUNT');
  const raw = String(value ?? '').trim();
  if (!/^-?\d+$/.test(raw)) throw new Error('INVALID_FINANCIAL_AMOUNT');
  const amount = BigInt(raw);
  if ((positive && amount <= 0n) || (nonNegative && amount < 0n)) throw new Error('INVALID_FINANCIAL_AMOUNT');
  return amount;
}
function adminSummary(user) {
  return { id: user.id, phone: user.phone, firstName: user.profile?.firstName ?? null, lastName: user.profile?.lastName ?? null, maskedNationalId: maskNationalId(user.profile?.nationalId), status: user.status, roles: user.roles?.map((link) => link.role.name) ?? [], createdAt: user.createdAt };
}

class HealthController {
  health() { return { status: 'ok' }; }
}
Get()(HealthController.prototype, 'health', Object.getOwnPropertyDescriptor(HealthController.prototype, 'health'));
Controller('health')(HealthController);

class LocationController {
  listProvinces() { return prisma.province.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true, code: true } }); }
  async listCities(req) { if (!await prisma.province.findUnique({ where: { id: req.params.id }, select: { id: true } })) throw new Error('PROVINCE_NOT_FOUND'); return prisma.city.findMany({ where: { provinceId: req.params.id }, orderBy: { name: 'asc' }, select: { id: true, name: true, provinceId: true } }); }
}
Get()(LocationController.prototype, 'listProvinces', Object.getOwnPropertyDescriptor(LocationController.prototype, 'listProvinces'));
Get(':id/cities')(LocationController.prototype, 'listCities', Object.getOwnPropertyDescriptor(LocationController.prototype, 'listCities'));
Req()(LocationController.prototype, 'listCities', 0);
Controller('locations/provinces')(LocationController);

class AuthController {
  async currentWithPermission(req, permission) {
    const { auth } = cookieAuth(req);
    if (!auth) throw new Error('UNAUTHORIZED');
    const current = await prisma.user.findUnique({ where: { id: auth.sub }, select: { id: true, status: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!current || current.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
    const allowed = current.roles.some((link) => link.role.permissions.some((item) => `${item.permission.resource}.${item.permission.action}` === permission));
    if (!allowed) throw new Error('FORBIDDEN');
    return current;
  }
  async requestRegisterOtp(body, req) { rateLimit(`register:${req.ip ?? 'unknown'}:${body.phone}`); return requestOtp(body.phone, 'REGISTER', { idempotencyKey: body.idempotencyKey ?? null }); }
  async verifyRegisterOtp(body) {
    const phone = await verifyOtp(body.phone, 'REGISTER', body.code);
    const user = await prisma.user.upsert({ where: { phone }, update: { mobileVerifiedAt: new Date() }, create: { phone, mobileVerifiedAt: new Date(), status: 'PENDING' } });
    const userRole = await prisma.role.findUnique({ where: { name: 'USER' } });
    await prisma.userRole.upsert({ where: { userId_roleId: { userId: user.id, roleId: userRole.id } }, update: {}, create: { userId: user.id, roleId: userRole.id } });
    await audit(user.id, 'USER_REGISTERED', 'User');
    await audit(user.id, 'ROLE_ASSIGNED', 'UserRole');
    await audit(user.id, 'OTP_VERIFIED', 'User');
    rememberVerifiedRegistration(user.id);
    return { userId: user.id, phone: user.phone, verified: true, passwordSetupToken: createPasswordSetupToken(user.id) };
  }
  async setPassword(body) {
    const phone = normalizeMobile(body.phone);
    const user = await prisma.user.findUnique({ where: { phone } });
    const setup = readPasswordSetupToken(body.passwordSetupToken);
    const proof = user && ((setup?.sub === user.id && consumeVerifiedRegistration(user.id)) || consumeVerifiedRegistration(user.id));
    if (!user || !user.mobileVerifiedAt || !proof || user.status !== 'PENDING') throw new Error('PASSWORD_SETUP_REQUIRED');
    const updated = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id: user.id }, data: { passwordHash: hashPassword(body.password), status: 'ACTIVE' } });
      await tx.sessionFamily.updateMany({ where: { userId: user.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revocationReason: 'PASSWORD_CHANGED' } });
      await tx.authSession.updateMany({ where: { userId: user.id, revokedAt: null }, data: { revokedAt: new Date(), consumedAt: new Date() } });
      return next;
    });
    await audit(updated.id, 'PASSWORD_SET', 'User');
    await audit(updated.id, 'PASSWORD_CHANGED', 'User');
    return { userId: updated.id, active: true };
  }
  async passwordLogin(body, req, res) {
    rateLimit(`password:${req.ip ?? 'unknown'}:${body.phone}`);
    const phone = normalizeMobile(body.phone);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || !verifyPassword(body.password, user.passwordHash) || user.status !== 'ACTIVE') { await audit(user?.id ?? null, 'LOGIN_FAILED', 'User'); throw new Error('AUTH_FAILED'); }
    const tokens = await createSession(user.id); setSessionCookies(res, tokens); await audit(user.id, 'LOGIN_SUCCESS', 'User'); return req.headers['x-auth-mode'] === 'cookie' ? { authenticated: true } : tokens;
  }
  async requestLoginOtp(body, req) { rateLimit(`login:${req.ip ?? 'unknown'}:${body.phone}`); return requestOtp(body.phone, 'LOGIN', { idempotencyKey: body.idempotencyKey ?? null }); }
  async verifyLoginOtp(body, req, res) {
    rateLimit(`verify:${req.ip ?? 'unknown'}:${body.phone}`);
    const phone = await verifyOtp(body.phone, 'LOGIN', body.code);
    const user = await prisma.user.findUnique({ where: { phone } });
    if (!user || user.status !== 'ACTIVE') throw new Error('AUTH_FAILED');
    const tokens = await createSession(user.id); setSessionCookies(res, tokens); await audit(user.id, 'LOGIN_SUCCESS', 'User'); return req.headers['x-auth-mode'] === 'cookie' ? { authenticated: true } : tokens;
  }
  async me(req) {
    const { auth } = cookieAuth(req);
    if (!auth) throw new Error('UNAUTHORIZED');
    const user = await prisma.user.findUnique({ where: { id: auth.sub }, select: { id: true, phone: true, nationalId: true, status: true, roles: { include: { role: { include: { permissions: { include: { permission: true } } } } } } } });
    if (!user || user.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
    return user;
  }
  async adminUsers(req) {
    await this.currentWithPermission(req, 'users.read');
    const users = await prisma.user.findMany({ include: { profile: true, roles: { include: { role: true } } }, orderBy: { createdAt: 'asc' } });
    return users.map(adminSummary);
  }
  async adminUserDetail(req) {
    await this.currentWithPermission(req, 'users.read');
    const user = await prisma.user.findUnique({ where: { id: req.params.id }, include: { profile: true, addresses: { include: { province: true, city: true } }, roles: { include: { role: true } } } });
    if (!user) throw new Error('USER_NOT_FOUND');
    return { ...adminSummary(user), profile: user.profile, addresses: user.addresses, roles: user.roles.map((link) => link.role.name) };
  }
  async updateUserStatus(body, req) {
    const permission = body.status === 'DISABLED' ? 'users.disable' : 'users.update';
    const current = await this.currentWithPermission(req, permission);
    if (!['PENDING', 'ACTIVE', 'SUSPENDED', 'DISABLED'].includes(body.status)) throw new Error('INVALID_STATUS');
    const user = await prisma.$transaction(async (tx) => {
      const next = await tx.user.update({ where: { id: req.params.id }, data: { status: body.status }, include: { profile: true, roles: { include: { role: true } } } });
      if (['DISABLED', 'SUSPENDED'].includes(body.status)) await tx.sessionFamily.updateMany({ where: { userId: req.params.id, status: 'ACTIVE' }, data: { status: 'REVOKED', revocationReason: 'USER_DISABLED' } });
      return next;
    });
    await audit(current.id, 'USER_STATUS_CHANGED', 'User');
    return adminSummary(user);
  }
  async refresh(body, req, res) {
    assertOriginAndCsrf(req);
    const { cookies } = cookieAuth(req);
    const [cookieSessionId, cookieRefreshToken] = String(cookies[REFRESH_COOKIE] ?? '.').split('.', 2);
    const sessionId = body.sessionId ?? cookieSessionId;
    const refreshToken = body.refreshToken ?? cookieRefreshToken;
    const session = await prisma.authSession.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || session.user.status !== 'ACTIVE') throw new Error('REFRESH_INVALID');
    const tokens = await rotateSession(sessionId, refreshToken); setSessionCookies(res, tokens); return req.headers['x-auth-mode'] === 'cookie' ? { authenticated: true } : tokens;
  }
  async logout(body, req, res) { assertOriginAndCsrf(req); const { auth } = cookieAuth(req); if (!auth) throw new Error('UNAUTHORIZED'); if (body.sessionId) await revokeSession(body.sessionId, auth.sub); else await prisma.sessionFamily.updateMany({ where: { userId: auth.sub, status: 'ACTIVE' }, data: { status: 'REVOKED', revocationReason: 'LOGOUT' } }); clearSessionCookies(res); return { revoked: true }; }
  async getProfile(req) {
    const user = await requireUser(req);
    return prisma.userProfile.findUnique({ where: { userId: user.id } });
  }
  async updateProfile(body, req) {
    const user = await requireUser(req);
    const data = validateProfileInput(body);
    const previous = await prisma.userProfile.findUnique({ where: { userId: user.id }, select: { nationalId: true } });
    const profile = await prisma.userProfile.upsert({ where: { userId: user.id }, update: data, create: { ...data, userId: user.id } });
    await audit(user.id, 'PROFILE_UPDATED', 'UserProfile');
    if (!previous?.nationalId && profile.nationalId) await audit(user.id, 'NATIONAL_ID_SET', 'UserProfile');
    if (previous?.nationalId && previous.nationalId !== profile.nationalId) await audit(user.id, 'NATIONAL_ID_CHANGED', 'UserProfile');
    return profile;
  }
  async listAddresses(req) {
    const user = await requireUser(req);
    return prisma.address.findMany({ where: { userId: user.id }, include: { province: true, city: true }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] });
  }
  async createAddress(body, req) {
    const user = await requireUser(req);
    const data = validateAddressInput(body);
    if (!await prisma.city.findFirst({ where: { id: data.cityId, provinceId: data.provinceId }, select: { id: true } })) throw new Error('INVALID_ADDRESS');
    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      return tx.address.create({ data: { ...data, userId: user.id } });
    });
    await audit(user.id, 'ADDRESS_CREATED', 'Address');
    if (data.isDefault) await audit(user.id, 'DEFAULT_ADDRESS_CHANGED', 'Address');
    return address;
  }
  async updateAddress(body, req) {
    const user = await requireUser(req);
    const addressId = body.id ?? req.params?.id;
    if (!addressId) throw new Error('INVALID_ADDRESS');
    const data = validateAddressInput(body);
    if (!await prisma.city.findFirst({ where: { id: data.cityId, provinceId: data.provinceId }, select: { id: true } })) throw new Error('INVALID_ADDRESS');
    const address = await prisma.$transaction(async (tx) => {
      if (data.isDefault) await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      const result = await tx.address.updateMany({ where: { id: addressId, userId: user.id }, data });
      if (result.count !== 1) throw new Error('ADDRESS_NOT_FOUND');
      return tx.address.findUnique({ where: { id: addressId }, include: { province: true, city: true } });
    });
    await audit(user.id, 'ADDRESS_UPDATED', 'Address');
    if (data.isDefault) await audit(user.id, 'DEFAULT_ADDRESS_CHANGED', 'Address');
    return address;
  }
  async deleteAddress(body, req) {
    const user = await requireUser(req);
    const addressId = body?.id ?? req.params?.id;
    if (!addressId) throw new Error('INVALID_ADDRESS');
    const result = await prisma.address.deleteMany({ where: { id: addressId, userId: user.id } });
    if (result.count !== 1) throw new Error('ADDRESS_NOT_FOUND');
    await audit(user.id, 'ADDRESS_DELETED', 'Address');
    return { deleted: true };
  }
  async setDefaultAddress(body, req) {
    const user = await requireUser(req);
    const addressId = body?.id ?? req.params?.id;
    if (!addressId) throw new Error('INVALID_ADDRESS');
    const updated = await prisma.$transaction(async (tx) => {
      const owned = await tx.address.findFirst({ where: { id: addressId, userId: user.id }, select: { id: true } });
      if (!owned) throw new Error('ADDRESS_NOT_FOUND');
      await tx.address.updateMany({ where: { userId: user.id }, data: { isDefault: false } });
      return tx.address.update({ where: { id: addressId }, data: { isDefault: true }, include: { province: true, city: true } });
    });
    await audit(user.id, 'DEFAULT_ADDRESS_CHANGED', 'Address');
    return updated;
  }
}

class ProviderController {
  normalizeCouncil(value) { const normalized = String(value ?? '').trim().replace(/\s+/g, ''); if (!/^[0-9A-Za-z-]{4,32}$/.test(normalized)) throw new Error('INVALID_MEDICAL_COUNCIL_NUMBER'); return normalized; }
  publicInclude() { return { province: { select: { id: true, name: true, code: true } }, city: { select: { id: true, name: true, provinceId: true } }, doctorProfile: { select: { specialty: { select: { id: true, name: true } } } } }; }
  async list(req) {
    const where = { status: 'APPROVED', ...(req.query?.type ? { type: req.query.type } : {}), ...(req.query?.provinceId ? { provinceId: req.query.provinceId } : {}), ...(req.query?.cityId ? { cityId: req.query.cityId } : {}), ...(req.query?.specialtyId ? { doctorProfile: { specialtyId: req.query.specialtyId } } : {}) };
    return prisma.provider.findMany({ where, select: { id: true, type: true, status: true, displayName: true, address: true, phone: true, imageUrl: true, ...this.publicInclude() }, orderBy: { displayName: 'asc' } });
  }
  async specialties() {
    return prisma.medicalSpecialty.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } });
  }
  async detail(req) {
    const provider = await prisma.provider.findFirst({ where: { id: req.params.id, status: 'APPROVED' }, select: { id: true, type: true, status: true, displayName: true, address: true, phone: true, imageUrl: true, ...this.publicInclude() } });
    if (!provider) throw new Error('PROVIDER_NOT_FOUND');
    return provider;
  }
  async registerDoctor(body, req) {
    const user = await requireUser(req);
    if (!body?.displayName || !body?.provinceId || !body?.cityId || !body?.medicalCouncilNumber || !body?.specialtyId) throw new Error('INVALID_PROVIDER');
    body.medicalCouncilNumber = this.normalizeCouncil(body.medicalCouncilNumber);
    if (!await prisma.city.findFirst({ where: { id: body.cityId, provinceId: body.provinceId }, select: { id: true } })) throw new Error('INVALID_PROVIDER');
    return prisma.$transaction(async (tx) => {
      const provider = await tx.provider.create({ data: { type: 'DOCTOR', status: 'PENDING_REVIEW', displayName: body.displayName, provinceId: body.provinceId, cityId: body.cityId, address: body.address ?? '', phone: body.phone ?? '', imageUrl: body.imageUrl ?? null, memberships: { create: { userId: user.id, role: 'OWNER' } }, doctorProfile: { create: { medicalCouncilNumber: body.medicalCouncilNumber, specialtyId: body.specialtyId } } }, include: { doctorProfile: true } });
      await audit(user.id, 'DOCTOR_REGISTRATION_SUBMITTED', 'Provider');
      return provider;
    });
  }
  async me(req) { const user = await requireUser(req); const rows = await prisma.provider.findMany({ where: { memberships: { some: { userId: user.id } } }, include: { doctorProfile: { include: { specialty: true } }, province: true, city: true } }); if (!rows.length) throw new Error('FORBIDDEN'); return rows; }
  async adminList(req) { await new AuthController().currentWithPermission(req, 'providers.read'); return prisma.provider.findMany({ include: { doctorProfile: { include: { specialty: true } }, province: true, city: true }, orderBy: { createdAt: 'desc' } }); }
  async adminDetail(req) { await new AuthController().currentWithPermission(req, 'providers.read'); const provider = await prisma.provider.findUnique({ where: { id: req.params.id }, include: { doctorProfile: { include: { specialty: true } }, province: true, city: true, memberships: true } }); if (!provider) throw new Error('PROVIDER_NOT_FOUND'); return provider; }
  async adminStatus(body, req) {
    const actor = await new AuthController().currentWithPermission(req, body.status === 'APPROVED' ? 'providers.approve' : body.status === 'SUSPENDED' ? 'providers.suspend' : 'providers.update');
    if (!['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'].includes(body.status)) throw new Error('INVALID_PROVIDER_STATUS');
    const current = await prisma.provider.findUnique({ where: { id: req.params.id }, select: { status: true } });
    if (!current) throw new Error('PROVIDER_NOT_FOUND');
    const allowed = { DRAFT: ['PENDING_REVIEW', 'REJECTED'], PENDING_REVIEW: ['APPROVED', 'REJECTED'], APPROVED: ['SUSPENDED'], REJECTED: ['DRAFT'], SUSPENDED: ['DRAFT'] };
    if (!allowed[current.status]?.includes(body.status)) throw new Error('INVALID_PROVIDER_TRANSITION');
    const updated = await prisma.provider.update({ where: { id: req.params.id }, data: { status: body.status }, include: { doctorProfile: true } });
    await audit(actor.id, `PROVIDER_${body.status}`, 'Provider');
    return updated;
  }
  async adminCreate(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'providers.create');
    if (!body?.displayName || !body?.provinceId || !body?.cityId || !body?.medicalCouncilNumber || !body?.specialtyId) throw new Error('INVALID_PROVIDER');
    body.medicalCouncilNumber = this.normalizeCouncil(body.medicalCouncilNumber);
    if (!await prisma.city.findFirst({ where: { id: body.cityId, provinceId: body.provinceId }, select: { id: true } })) throw new Error('INVALID_PROVIDER');
    const provider = await prisma.provider.create({ data: { type: 'DOCTOR', status: 'DRAFT', displayName: body.displayName, provinceId: body.provinceId, cityId: body.cityId, address: body.address ?? '', phone: body.phone ?? '', imageUrl: body.imageUrl ?? null, doctorProfile: { create: { medicalCouncilNumber: body.medicalCouncilNumber, specialtyId: body.specialtyId } } }, include: { doctorProfile: true } });
    await audit(actor.id, 'PROVIDER_CREATED', 'Provider');
    return provider;
  }
  async update(reqBody, req) {
    const user = await requireUser(req);
    const owned = await prisma.provider.findFirst({ where: { id: req.params.id, memberships: { some: { userId: user.id, role: { in: ['OWNER', 'MANAGER'] } } } }, include: { doctorProfile: true } });
    if (!owned) throw new Error('PROVIDER_NOT_FOUND');
    if (!['DRAFT', 'PENDING_REVIEW'].includes(owned.status)) throw new Error('PROVIDER_NOT_EDITABLE');
    const data = { displayName: reqBody.displayName ?? owned.displayName, address: reqBody.address ?? owned.address, phone: reqBody.phone ?? owned.phone, imageUrl: reqBody.imageUrl ?? owned.imageUrl };
    if (reqBody.provinceId || reqBody.cityId) { const provinceId = reqBody.provinceId ?? owned.provinceId; const cityId = reqBody.cityId ?? owned.cityId; if (!await prisma.city.findFirst({ where: { id: cityId, provinceId }, select: { id: true } })) throw new Error('INVALID_PROVIDER'); data.provinceId = provinceId; data.cityId = cityId; }
    const updated = await prisma.provider.update({ where: { id: owned.id }, data, include: { doctorProfile: true } }); await audit(user.id, 'PROVIDER_UPDATED', 'Provider'); return updated;
  }
}

function planView(plan) { return { ...plan, priceAmount: plan.priceAmount.toString() }; }
function purchaseView(item) {
  return {
    id: item.id,
    planId: item.planId,
    amountSnapshot: item.amountSnapshot.toString(),
    currencySnapshot: item.currencySnapshot,
    validityDaysSnapshot: item.validityDaysSnapshot,
    status: item.status,
    paidAt: item.paidAt,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}

class BenefitController {
  async plans() { const rows = await prisma.benefitPlan.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } }); return rows.map(planView); }
  async plan(req) { const row = await prisma.benefitPlan.findFirst({ where: { id: req.params.id, status: 'ACTIVE' } }); if (!row) throw new Error('PLAN_NOT_FOUND'); return planView(row); }
  async purchase(body, req) {
    const user = await requireUser(req); const plan = await prisma.benefitPlan.findFirst({ where: { id: body.planId, status: 'ACTIVE' } });
    if (!plan) throw new Error('PLAN_NOT_FOUND');
    const row = await prisma.planPurchase.create({ data: { userId: user.id, planId: plan.id, amountSnapshot: plan.priceAmount, currencySnapshot: plan.currency, validityDaysSnapshot: plan.validityDays } });
    await audit(user.id, 'PURCHASE_CREATED', 'PlanPurchase'); return purchaseView(row);
  }
  async myPurchases(req) { const user = await requireUser(req); const rows = await prisma.planPurchase.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }); return rows.map(purchaseView); }
  async myMemberships(req) { const user = await requireUser(req); return prisma.benefitMembership.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } }); }
  async adminPlans(req) { await new AuthController().currentWithPermission(req, 'plans.read'); const rows = await prisma.benefitPlan.findMany({ include: { providerBenefits: true }, orderBy: { createdAt: 'desc' } }); return rows.map(planView); }
  async adminPlan(req) { await new AuthController().currentWithPermission(req, 'plans.read'); const row = await prisma.benefitPlan.findUnique({ where: { id: req.params.id }, include: { providerBenefits: true } }); if (!row) throw new Error('PLAN_NOT_FOUND'); return planView(row); }
  async createPlan(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'plans.create');
    if (!body?.code || !body?.name || !Number.isInteger(body.validityDays) || body.validityDays <= 0 || body.priceAmount === undefined) throw new Error('INVALID_PLAN');
    const row = await prisma.benefitPlan.create({ data: { code: String(body.code).trim(), name: String(body.name).trim(), description: body.description ?? null, priceAmount: BigInt(body.priceAmount), currency: String(body.currency ?? 'IRR'), validityDays: body.validityDays, status: body.status ?? 'DRAFT' } });
    await audit(actor.id, 'BENEFIT_PLAN_CREATED', 'BenefitPlan'); return planView(row);
  }
  async updatePlan(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'plans.update'); const current = await prisma.benefitPlan.findUnique({ where: { id: req.params.id } }); if (!current) throw new Error('PLAN_NOT_FOUND');
    const data = {}; for (const key of ['name', 'description', 'currency']) if (body[key] !== undefined) data[key] = body[key]; if (body.priceAmount !== undefined) data.priceAmount = BigInt(body.priceAmount); if (body.validityDays !== undefined) { if (!Number.isInteger(body.validityDays) || body.validityDays <= 0) throw new Error('INVALID_PLAN'); data.validityDays = body.validityDays; }
    const row = await prisma.benefitPlan.update({ where: { id: current.id }, data }); await audit(actor.id, 'BENEFIT_PLAN_UPDATED', 'BenefitPlan'); return planView(row);
  }
  async planStatus(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'plans.update'); const current = await prisma.benefitPlan.findUnique({ where: { id: req.params.id } }); if (!current) throw new Error('PLAN_NOT_FOUND');
    assertPlanTransition(current.status, body.status); const row = await prisma.benefitPlan.update({ where: { id: current.id }, data: { status: body.status } }); await audit(actor.id, 'BENEFIT_PLAN_STATUS_CHANGED', 'BenefitPlan'); return planView(row);
  }
  async adminPurchases(req) { await new AuthController().currentWithPermission(req, 'purchases.read'); const rows = await prisma.planPurchase.findMany({ orderBy: { createdAt: 'desc' } }); return rows.map(purchaseView); }
  async adminMemberships(req) { await new AuthController().currentWithPermission(req, 'memberships.read'); return prisma.benefitMembership.findMany({ orderBy: { createdAt: 'desc' } }); }
  async addBenefit(body, req) { const actor = await new AuthController().currentWithPermission(req, 'plans.manage_providers'); await validateBenefitInput(req.params.id, req.params.providerId, body); const row = await prisma.planProviderBenefit.upsert({ where: { planId_providerId: { planId: req.params.id, providerId: req.params.providerId } }, update: { discountType: body.discountType ?? 'PERCENT', discountValue: body.discountValue, isActive: body.isActive ?? true }, create: { planId: req.params.id, providerId: req.params.providerId, discountType: body.discountType ?? 'PERCENT', discountValue: body.discountValue, isActive: body.isActive ?? true } }); await audit(actor.id, 'PLAN_PROVIDER_BENEFIT_ADDED', 'PlanProviderBenefit'); return row; }
  async updateBenefit(body, req) { const actor = await new AuthController().currentWithPermission(req, 'plans.manage_providers'); await validateBenefitInput(req.params.id, req.params.providerId, body); const row = await prisma.planProviderBenefit.update({ where: { planId_providerId: { planId: req.params.id, providerId: req.params.providerId } }, data: { discountType: body.discountType ?? 'PERCENT', discountValue: body.discountValue, isActive: body.isActive ?? true } }); await audit(actor.id, 'PLAN_PROVIDER_BENEFIT_UPDATED', 'PlanProviderBenefit'); return row; }
  async removeBenefit(req) { const actor = await new AuthController().currentWithPermission(req, 'plans.manage_providers'); const row = await prisma.planProviderBenefit.update({ where: { planId_providerId: { planId: req.params.id, providerId: req.params.providerId } }, data: { isActive: false } }); await audit(actor.id, 'PLAN_PROVIDER_BENEFIT_REMOVED', 'PlanProviderBenefit'); return { deleted: true, deactivated: true, id: row.id }; }
  async confirm(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'purchases.confirm_payment');
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.planPurchase.findUnique({ where: { id: req.params.id }, include: { plan: true, membership: true } });
      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.status === 'PAID') return purchase.membership ?? tx.benefitMembership.create({ data: { userId: purchase.userId, planId: purchase.planId, purchaseId: purchase.id, status: 'ACTIVE', startsAt: new Date(), endsAt: new Date(Date.now() + purchase.validityDaysSnapshot * 86400000) } });
      if (purchase.status !== 'PENDING_PAYMENT') throw new Error('PAYMENT_NOT_CONFIRMABLE');
      const now = new Date();
      const claimed = await tx.planPurchase.updateMany({ where: { id: purchase.id, status: 'PENDING_PAYMENT' }, data: { status: 'PAID', paidAt: now, paymentReference: body.paymentReference ?? undefined } });
      if (claimed.count !== 1) {
        const settled = await tx.planPurchase.findUnique({ where: { id: purchase.id }, include: { membership: true } });
        if (settled?.status === 'PAID' && settled.membership) return settled.membership;
        throw new Error('PAYMENT_CONFIRMATION_RACE');
      }
      const membership = await tx.benefitMembership.create({ data: { userId: purchase.userId, planId: purchase.planId, purchaseId: purchase.id, status: 'ACTIVE', startsAt: now, endsAt: new Date(now.getTime() + purchase.validityDaysSnapshot * 86400000) } });
      const settings = await tx.commercialSettings.findFirst();
      const attribution = await tx.referralAttribution.findUnique({ where: { referredUserId: purchase.userId } });
      if (settings?.referralEnabled && attribution && attribution.status === 'ATTRIBUTED') {
        const wallet = await tx.wallet.upsert({ where: { userId: attribution.referrerUserId }, update: {}, create: { userId: attribution.referrerUserId, currency: purchase.currencySnapshot } });
        await tx.walletTransaction.create({ data: { walletId: wallet.id, type: 'REFERRAL_REWARD', amount: settings.referralRewardAmount, currency: wallet.currency, referenceType: 'ReferralAttribution', referenceId: attribution.id, idempotencyKey: `REFERRAL_REWARD:${attribution.id}` } });
        await tx.referralAttribution.update({ where: { id: attribution.id }, data: { status: 'REWARDED', qualifyingPurchaseId: purchase.id, qualifiedAt: now } });
      }
      const salesAttribution = await tx.salesAttribution.findFirst({ where: { customerUserId: purchase.userId, status: 'ACTIVE' } });
      const rule = await tx.salesCommissionRule.findFirst({ where: { isActive: true }, orderBy: { createdAt: 'desc' } });
      if (settings?.salesCommissionEnabled && salesAttribution && rule) {
        const amount = rule.type === 'PERCENT' ? (purchase.amountSnapshot * BigInt(Math.round(Number(rule.value) * 100))) / 10000n : BigInt(Math.round(Number(rule.value)));
        await tx.salesCommission.create({ data: { salesPartnerUserId: salesAttribution.salesPartnerUserId, purchaseId: purchase.id, salesAttributionId: salesAttribution.id, ruleId: rule.id, calculationType: rule.type, calculationValueSnapshot: rule.value, amountSnapshot: amount, currencySnapshot: purchase.currencySnapshot, status: settings.autoApproveCommissionAfterPayment ? 'APPROVED' : 'PENDING_APPROVAL' } });
      }
      return membership;
    });
    await audit(actor.id, 'PAYMENT_CONFIRMED', 'PlanPurchase'); return result;
  }
  async refund(req) {
    const actor = await new AuthController().currentWithPermission(req, 'purchases.refund');
    const result = await prisma.$transaction(async (tx) => {
      const purchase = await tx.planPurchase.findUnique({ where: { id: req.params.id }, include: { membership: true } });
      if (!purchase) throw new Error('PURCHASE_NOT_FOUND');
      if (purchase.status === 'REFUNDED') return purchase;
      if (purchase.status !== 'PAID') throw new Error('REFUND_NOT_ALLOWED');
      await tx.planPurchase.update({ where: { id: purchase.id }, data: { status: 'REFUNDED' } });
      if (purchase.membership?.status === 'ACTIVE') await tx.benefitMembership.update({ where: { id: purchase.membership.id }, data: { status: 'CANCELLED' } });
      const attribution = await tx.referralAttribution.findUnique({ where: { qualifyingPurchaseId: purchase.id } });
      if (attribution?.status === 'REWARDED') {
        const reward = await tx.walletTransaction.findUnique({ where: { idempotencyKey: `REFERRAL_REWARD:${attribution.id}` } });
        if (reward) {
          await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${reward.walletId}))`;
          const reversalKey = `REFERRAL_REVERSAL:${attribution.id}`;
          const existingReversal = await tx.walletTransaction.findUnique({ where: { idempotencyKey: reversalKey } });
          if (!existingReversal) {
            let ledger = await tx.walletTransaction.aggregate({ where: { walletId: reward.walletId }, _sum: { amount: true } });
            let projected = (ledger._sum.amount ?? 0n) - reward.amount;
            if (projected < 0n) {
              const releasable = await tx.withdrawalRequest.findMany({ where: { walletId: reward.walletId, status: { in: ['PENDING', 'APPROVED'] } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }] });
              for (const withdrawal of releasable) {
                if (projected >= 0n) break;
                await tx.walletTransaction.create({ data: { walletId: reward.walletId, type: 'WITHDRAWAL_RELEASE', amount: withdrawal.amount, currency: reward.currency, referenceType: 'WithdrawalRequest', referenceId: withdrawal.id, idempotencyKey: `WITHDRAWAL_RELEASE:${withdrawal.id}` } });
                await tx.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: 'CANCELLED', rejectedAt: new Date() } });
                projected += withdrawal.amount;
              }
            }
            if (projected < 0n) throw new Error('REFUND_WALLET_FUNDS_UNAVAILABLE');
            await tx.walletTransaction.create({ data: { walletId: reward.walletId, type: 'REFERRAL_REVERSAL', amount: -reward.amount, currency: reward.currency, referenceType: 'ReferralAttribution', referenceId: attribution.id, idempotencyKey: reversalKey } });
          }
        }
        await tx.referralAttribution.update({ where: { id: attribution.id }, data: { status: 'REVERSED' } });
      }
      await tx.salesCommission.updateMany({ where: { purchaseId: purchase.id, status: { in: ['PENDING_APPROVAL', 'APPROVED'] } }, data: { status: 'REVERSED', reversedAt: new Date() } });
      return { ...purchase, status: 'REFUNDED' };
    });
    await audit(actor.id, 'PURCHASE_REFUNDED', 'PlanPurchase'); await audit(actor.id, 'MEMBERSHIP_CANCELLED', 'BenefitMembership'); return purchaseView(result);
  }
  async eligibility(body, req) {
    const actor = await requireUser(req); const provider = await prisma.provider.findFirst({ where: { id: req.params.providerId, status: 'APPROVED', memberships: { some: { userId: actor.id, role: { in: ['OWNER', 'MANAGER', 'STAFF'] } } } } });
    if (!provider) throw new Error('FORBIDDEN');
    rateLimit(`eligibility:${req.params.providerId}:${actor.id}:${req.ip ?? 'unknown'}`);
    let nationalId; try { nationalId = normalizeNationalId(body.nationalId); } catch { await audit(actor.id, 'ELIGIBILITY_CHECKED', 'Eligibility'); return { eligible: false }; }
    const profile = await prisma.userProfile.findFirst({ where: { nationalId }, select: { userId: true, firstName: true, lastName: true } });
    const user = profile ? await prisma.user.findUnique({ where: { id: profile.userId }, select: { id: true, status: true } }) : null;
    const memberships = user ? await prisma.benefitMembership.findMany({ where: { userId: user.id }, include: { plan: true, purchase: { select: { status: true } } } }) : [];
    const benefits = await prisma.planProviderBenefit.findMany({ where: { providerId: provider.id, isActive: true }, include: { plan: true } });
    const result = evaluateEligibility({ user, provider, memberships, benefits }); await audit(actor.id, 'ELIGIBILITY_CHECKED', 'Eligibility');
    await audit(actor.id, result.eligible ? 'ELIGIBILITY_GRANTED' : 'ELIGIBILITY_DENIED', 'Eligibility');
    if (!result.eligible) return { eligible: false };
    return { eligible: true, memberDisplayName: `${profile.firstName} ${profile.lastName}`, benefits: result.benefits };
  }
  async selfEligibility(req) {
    const actor = await requireUser(req);
    const provider = await prisma.provider.findFirst({ where: { id: req.params.providerId, status: 'APPROVED' } });
    if (!provider) throw new Error('PROVIDER_NOT_FOUND');
    rateLimit(`self-eligibility:${req.params.providerId}:${actor.id}:${req.ip ?? 'unknown'}`);
    const [user, memberships, benefits] = await Promise.all([
      prisma.user.findUnique({ where: { id: actor.id }, select: { id: true, status: true } }),
      prisma.benefitMembership.findMany({ where: { userId: actor.id }, include: { plan: true, purchase: { select: { status: true } } } }),
      prisma.planProviderBenefit.findMany({ where: { providerId: provider.id, isActive: true }, include: { plan: true } }),
    ]);
    const result = evaluateEligibility({ user, provider, memberships, benefits });
    await audit(actor.id, result.eligible ? 'ELIGIBILITY_GRANTED' : 'ELIGIBILITY_DENIED', 'Eligibility');
    return { eligible: result.eligible, providerStatus: provider.status, membershipStatus: memberships.find((membership) => membership.status === 'ACTIVE')?.status ?? null, benefits: result.benefits };
  }
}

class RedemptionController {
  async adminList(req) { await new AuthController().currentWithPermission(req, 'redemptions.reverse'); return (await prisma.redemption.findMany({ orderBy: { createdAt: 'desc' }, take: 100, include: { provider: { select: { id: true, displayName: true } } } })).map(publicRedemption); }
  async initiate(body, req) {
    const actor = await requireUser(req);
    const key = req.headers['idempotency-key'] ?? body?.idempotencyKey;
    const result = await redemptionService.initiate({ customerUserId: actor.id, providerId: body?.providerId, benefitMembershipId: body?.benefitMembershipId, idempotencyKey: key });
    await audit(actor.id, 'REDEMPTION_INITIATED', 'Redemption');
    return { id: result.redemption.id, status: result.redemption.status, providerId: result.redemption.providerId, token: result.rawToken, tokenExpiresAt: result.redemption.tokenExpiresAt, replay: result.replay };
  }
  async get(req) { const actor = await requireUser(req); return redemptionService.get(req.params.id, { id: actor.id }); }
  async mine(req) { const actor = await requireUser(req); return (await prisma.redemption.findMany({ where: { customerUserId: actor.id }, orderBy: { createdAt: 'desc' } })).map(publicRedemption); }
  async cancel(req) { const actor = await requireUser(req); const row = await redemptionService.cancel({ id: req.params.id, customerUserId: actor.id }); await audit(actor.id, 'REDEMPTION_CANCELLED', 'Redemption'); return publicRedemption(row); }
  async confirm(body, req) { const actor = await requireUser(req); const result = await redemptionService.confirm({ providerUserId: actor.id, token: body?.token }); if (!result.replay) await audit(actor.id, 'REDEMPTION_CONFIRMED', 'Redemption'); return result.redemption; }
  async providerMine(req) { const actor = await requireUser(req); const membership = await prisma.providerMembership.findFirst({ where: { userId: actor.id, role: { in: ['OWNER', 'MANAGER', 'STAFF'] } } }); if (!membership) throw new Error('FORBIDDEN'); return (await prisma.redemption.findMany({ where: { providerId: membership.providerId }, orderBy: { createdAt: 'desc' } })).map(publicRedemption); }
  async reverse(body, req) { const actor = await new AuthController().currentWithPermission(req, 'redemptions.reverse'); const row = await redemptionService.reverse({ id: req.params.id, actorId: actor.id, reason: body?.reason }); return publicRedemption(row); }
}

Post('redemptions')(RedemptionController.prototype, 'initiate', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'initiate')); Body()(RedemptionController.prototype, 'initiate', 0); Req()(RedemptionController.prototype, 'initiate', 1);
Get('redemptions/:id')(RedemptionController.prototype, 'get', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'get')); Req()(RedemptionController.prototype, 'get', 0);
Get('users/me/redemptions')(RedemptionController.prototype, 'mine', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'mine')); Req()(RedemptionController.prototype, 'mine', 0);
Post('redemptions/:id/cancel')(RedemptionController.prototype, 'cancel', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'cancel')); Req()(RedemptionController.prototype, 'cancel', 0);
Post('providers/me/redemptions/confirm')(RedemptionController.prototype, 'confirm', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'confirm')); Body()(RedemptionController.prototype, 'confirm', 0); Req()(RedemptionController.prototype, 'confirm', 1);
Get('providers/me/redemptions')(RedemptionController.prototype, 'providerMine', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'providerMine')); Req()(RedemptionController.prototype, 'providerMine', 0);
Get('admin/redemptions')(RedemptionController.prototype, 'adminList', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'adminList')); Req()(RedemptionController.prototype, 'adminList', 0);
Post('admin/redemptions/:id/reverse')(RedemptionController.prototype, 'reverse', Object.getOwnPropertyDescriptor(RedemptionController.prototype, 'reverse')); Body()(RedemptionController.prototype, 'reverse', 0); Req()(RedemptionController.prototype, 'reverse', 1);
Controller()(RedemptionController);

class RewardsController {
  async referral(req) {
    const user = await requireUser(req);
    const code = await prisma.referralCode.findFirst({ where: { userId: user.id, isActive: true }, select: { code: true, isActive: true, createdAt: true } });
    return code ?? { code: null, isActive: false };
  }
  async createReferralCode(req) {
    const user = await requireUser(req);
    const existing = await prisma.referralCode.findFirst({ where: { userId: user.id, isActive: true } });
    if (existing) return { code: existing.code, isActive: true };
    const code = `HC-${crypto.randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    return prisma.referralCode.create({ data: { userId: user.id, code }, select: { code: true, isActive: true } });
  }
  async claimReferral(body, req) {
    const user = await requireUser(req);
    const code = String(body?.code ?? '').trim().toUpperCase();
    if (!code) throw new Error('INVALID_REFERRAL_CODE');
    const referral = await prisma.referralCode.findUnique({ where: { code }, select: { id: true, userId: true, isActive: true } });
    if (!referral || !referral.isActive) throw new Error('REFERRAL_NOT_FOUND');
    if (referral.userId === user.id) throw new Error('SELF_REFERRAL');
    const row = await prisma.referralAttribution.create({ data: { referrerUserId: referral.userId, referredUserId: user.id, referralCodeId: referral.id } });
    await audit(user.id, 'REFERRAL_CLAIMED', 'ReferralAttribution');
    return { id: row.id, status: row.status };
  }
  async referrals(req) {
    const user = await requireUser(req);
    return prisma.referralAttribution.findMany({ where: { referrerUserId: user.id }, select: { id: true, referredUserId: true, status: true, createdAt: true, qualifiedAt: true }, orderBy: { createdAt: 'desc' } });
  }
  async wallet(req) {
    const user = await requireUser(req);
    const wallet = await prisma.wallet.findUnique({ where: { userId: user.id }, include: { transactions: { orderBy: { createdAt: 'desc' } } } });
    if (!wallet) return { currency: 'IRR', balance: '0', transactions: [] };
    const balance = wallet.transactions.reduce((sum, item) => sum + item.amount, 0n);
    return { id: wallet.id, currency: wallet.currency, balance: balance.toString(), transactions: wallet.transactions.map((item) => ({ ...item, amount: item.amount.toString() })) };
  }
  async transactions(req) { const result = await this.wallet(req); return result.transactions; }
  async adminWalletReporting(req) {
    await new AuthController().currentWithPermission(req, 'users.read');
    const [walletCount, transactions, withdrawals] = await Promise.all([
      prisma.wallet.count(),
      prisma.walletTransaction.groupBy({ by: ['currency', 'type'], _count: { _all: true }, _sum: { amount: true } }),
      prisma.withdrawalRequest.groupBy({ by: ['currency', 'status'], _count: { _all: true } }),
    ]);
    return {
      generatedAt: new Date().toISOString(),
      walletCount,
      currencies: [...new Set([...transactions.map((row) => row.currency), ...withdrawals.map((row) => row.currency)])].sort(),
      ledger: transactions.map((row) => ({ currency: row.currency, type: row.type, count: row._count._all, signedAmountMinor: String(row._sum.amount ?? 0n) })),
      withdrawals: withdrawals.map((row) => ({ currency: row.currency, status: row.status, count: row._count._all })),
    };
  }
  async withdraw(body, req) {
    const user = await requireUser(req); let amount;
    try { amount = parseFinancialInteger(body?.amount, { positive: true }); } catch { throw new Error('INVALID_WITHDRAWAL_AMOUNT'); }
    let row;
    try { row = await prisma.$transaction(async (tx) => {
      const settings = await tx.commercialSettings.findFirst();
      if (!settings?.withdrawalsEnabled || amount < settings.minimumWithdrawalAmount) throw new Error('WITHDRAWAL_NOT_ALLOWED');
      const wallet = await tx.wallet.upsert({ where: { userId: user.id }, update: {}, create: { userId: user.id, currency: 'IRR' } });
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${wallet.id}))`;
      const ledger = await tx.walletTransaction.aggregate({ where: { walletId: wallet.id }, _sum: { amount: true } });
      if ((ledger._sum.amount ?? 0n) < amount) throw new Error('INSUFFICIENT_BALANCE');
      const beneficiary = body?.beneficiary && typeof body.beneficiary === 'object' ? {
        name: String(body.beneficiary.name ?? '').slice(0, 120),
        accountFingerprint: body.beneficiary.accountFingerprint ? String(body.beneficiary.accountFingerprint).slice(0, 128) : null,
      } : {};
      const withdrawal = await tx.withdrawalRequest.create({ data: { userId: user.id, walletId: wallet.id, amount, currency: wallet.currency, beneficiarySnapshot: beneficiary, destinationSnapshot: beneficiary } });
      await tx.walletTransaction.create({ data: { walletId: wallet.id, type: 'WITHDRAWAL_RESERVATION', amount: -amount, currency: wallet.currency, referenceType: 'WithdrawalRequest', referenceId: withdrawal.id, idempotencyKey: `WITHDRAWAL_RESERVATION:${withdrawal.id}` } });
      return withdrawal;
    }); } catch (error) { if (['INSUFFICIENT_BALANCE', 'WITHDRAWAL_NOT_ALLOWED', 'INVALID_WITHDRAWAL_AMOUNT'].includes(error?.message)) throw error; throw new Error('WITHDRAWAL_CONFLICT'); }
    await audit(user.id, 'WITHDRAWAL_REQUESTED', 'WithdrawalRequest');
    return { ...row, amount: row.amount.toString() };
  }

  async myWithdrawals(req) {
    const user = await requireUser(req);
    const rows = await prisma.withdrawalRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ ...row, amount: row.amount.toString() }));
  }
}
Get('users/me/referral')(RewardsController.prototype, 'referral', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'referral')); Req()(RewardsController.prototype, 'referral', 0);
Post('users/me/referral')(RewardsController.prototype, 'createReferralCode', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'createReferralCode')); Req()(RewardsController.prototype, 'createReferralCode', 0);
Post('referrals/claim')(RewardsController.prototype, 'claimReferral', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'claimReferral')); Body()(RewardsController.prototype, 'claimReferral', 0); Req()(RewardsController.prototype, 'claimReferral', 1);
Get('users/me/referrals')(RewardsController.prototype, 'referrals', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'referrals')); Req()(RewardsController.prototype, 'referrals', 0);
Get('users/me/wallet')(RewardsController.prototype, 'wallet', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'wallet')); Req()(RewardsController.prototype, 'wallet', 0);
Get('users/me/wallet/transactions')(RewardsController.prototype, 'transactions', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'transactions')); Req()(RewardsController.prototype, 'transactions', 0);
Get('admin/wallet/reporting')(RewardsController.prototype, 'adminWalletReporting', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'adminWalletReporting')); Req()(RewardsController.prototype, 'adminWalletReporting', 0);
Post('users/me/wallet/withdrawals')(RewardsController.prototype, 'withdraw', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'withdraw')); Body()(RewardsController.prototype, 'withdraw', 0); Req()(RewardsController.prototype, 'withdraw', 1);
Get('users/me/wallet/withdrawals')(RewardsController.prototype, 'myWithdrawals', Object.getOwnPropertyDescriptor(RewardsController.prototype, 'myWithdrawals')); Req()(RewardsController.prototype, 'myWithdrawals', 0);
Controller()(RewardsController);

class CommercialAdminController {
  async settings(req) { await new AuthController().currentWithPermission(req, 'commercial_settings.read'); return prisma.commercialSettings.findFirst({ orderBy: { createdAt: 'asc' } }); }
  async updateSettings(body, req) {
    await new AuthController().currentWithPermission(req, 'commercial_settings.manage');
    const current = await prisma.commercialSettings.findFirst({ orderBy: { createdAt: 'asc' } }) ?? await prisma.commercialSettings.create({ data: {} });
    const data = {};
    for (const key of ['referralEnabled', 'withdrawalsEnabled', 'salesCommissionEnabled', 'autoApproveCommissionAfterPayment']) if (body?.[key] !== undefined) data[key] = Boolean(body[key]);
    for (const key of ['referralRewardAmount', 'minimumWithdrawalAmount']) if (body?.[key] !== undefined) data[key] = parseFinancialInteger(body[key], { nonNegative: true });
    const updated = await prisma.commercialSettings.update({ where: { id: current.id }, data });
    await audit((await requireUser(req)).id, 'COMMERCIAL_SETTINGS_UPDATED', 'CommercialSettings');
    return { ...updated, referralRewardAmount: updated.referralRewardAmount.toString(), minimumWithdrawalAmount: updated.minimumWithdrawalAmount.toString() };
  }
}
Get('admin/commercial-settings')(CommercialAdminController.prototype, 'settings', Object.getOwnPropertyDescriptor(CommercialAdminController.prototype, 'settings')); Req()(CommercialAdminController.prototype, 'settings', 0);
Patch('admin/commercial-settings')(CommercialAdminController.prototype, 'updateSettings', Object.getOwnPropertyDescriptor(CommercialAdminController.prototype, 'updateSettings')); Body()(CommercialAdminController.prototype, 'updateSettings', 0); Req()(CommercialAdminController.prototype, 'updateSettings', 1);
Controller()(CommercialAdminController);

class SalesCommissionController {
  async createAttribution(body, req) {
    const actor = await new AuthController().currentWithPermission(req, 'sales_attributions.create');
    const customerUserId = String(body?.customerUserId ?? '');
    if (!customerUserId || customerUserId === actor.id) throw new Error('INVALID_SALES_CUSTOMER');
    const customer = await prisma.user.findUnique({ where: { id: customerUserId }, select: { id: true, status: true } });
    if (!customer || customer.status !== 'ACTIVE') throw new Error('USER_NOT_FOUND');
    const row = await prisma.salesAttribution.create({ data: { salesPartnerUserId: actor.id, customerUserId } });
    await audit(actor.id, 'SALES_ATTRIBUTION_CREATED', 'SalesAttribution');
    return { id: row.id, status: row.status, createdAt: row.createdAt, customerRef: `cust_${crypto.createHash('sha256').update(customerUserId).digest('hex').slice(0, 12)}`, displayAlias: customerAlias(customerUserId) };
  }
  async myAttributions(req) {
    const actor = await new AuthController().currentWithPermission(req, 'sales_attributions.read');
    const rows = await prisma.salesAttribution.findMany({ where: { salesPartnerUserId: actor.id }, orderBy: { createdAt: 'desc' }, select: { id: true, customerUserId: true, status: true, createdAt: true, customer: { select: { status: true, createdAt: true, purchases: { orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, plan: { select: { name: true } } } } } } } });
    return rows.map(({ customerUserId, customer, ...row }) => ({ ...row, customerRef: `cust_${crypto.createHash('sha256').update(customerUserId).digest('hex').slice(0, 12)}`, displayAlias: customerAlias(customerUserId), customerStatus: customer.status, customerCreatedAt: customer.createdAt, latestPurchaseStatus: customer.purchases[0]?.status ?? null, latestPlanName: customer.purchases[0]?.plan?.name ?? null }));
  }
  async commissions(req) {
    await new AuthController().currentWithPermission(req, 'commissions.read');
    const rows = await prisma.salesCommission.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ ...row, calculationValueSnapshot: row.calculationValueSnapshot.toString(), amountSnapshot: row.amountSnapshot.toString() }));
  }
  async representativeSummary(req) {
    const actor = await new AuthController().currentWithPermission(req, 'commissions.summary_read');
    const mode = auditModeDecision();
    if (mode.observerEnabled) await emitAuthorizationDecision(prisma, req, {
        actorId: actor.id,
        action: 'VIEW_COMMISSION_SUMMARY_GRANTED',
        entity: `CommissionSummary|${mode.provenance}`,
        endpoint: '/api/v1/rep/commission/summary',
        capability: 'commissions.summary_read',
        result: 'GRANTED',
        dedupKey: modeDedupKey(mode.mode, req.headers['x-request-id'] ?? 'generated', 'VIEW_COMMISSION_SUMMARY_GRANTED'),
      });
    const rows = await prisma.salesCommission.findMany({
      where: { salesPartnerUserId: actor.id },
      orderBy: [{ currencySnapshot: 'asc' }, { createdAt: 'asc' }],
      select: { amountSnapshot: true, currencySnapshot: true, status: true },
    });
    const currencies = [...new Set(rows.map((row) => row.currencySnapshot))];
    if (currencies.length > 1) throw new Error('COMMISSION_CURRENCY_CONTEXT_REQUIRED');
    const currencyCode = currencies[0] ?? 'IRR';
    const scoped = rows.filter((row) => row.currencySnapshot === currencyCode);
    const sum = (statuses) => scoped.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + row.amountSnapshot, 0n);
    const pending = sum(['PENDING_APPROVAL']);
    const available = sum(['APPROVED']);
    const clawback = sum(['REVERSED']);
    const money = (amount, signRule) => ({ amount_minor: amount.toString(), currency_code: currencyCode, sign_rule: signRule });
    return {
      pending_balance: money(pending, 'positive_pending_earned'),
      available_balance: money(available < 0n ? 0n : available, 'non_negative_server_clamped_available'),
      clawback_due: money(clawback < 0n ? -clawback : clawback, 'non_negative_amount_due'),
      lifetime_earned: money(sum(['APPROVED', 'REVERSED']), 'signed_ledger_earned'),
      monthly_type_aggregates: [],
      plan_label: null,
      currency_code: currencyCode,
    };
  }
  async decide(body, req) {
    const actor = await new AuthController().currentWithPermission(req, body?.status === 'APPROVED' ? 'commissions.approve' : 'commissions.reject');
    const status = body?.status;
    if (!['APPROVED', 'REJECTED'].includes(status)) throw new Error('INVALID_STATUS');
    const current = await prisma.salesCommission.findUnique({ where: { id: req.params.id } });
    if (!current || current.status !== 'PENDING_APPROVAL') throw new Error('COMMISSION_NOT_ACTIONABLE');
    const row = await prisma.salesCommission.update({ where: { id: current.id }, data: { status, approvedAt: status === 'APPROVED' ? new Date() : null, rejectedAt: status === 'REJECTED' ? new Date() : null } });
    await audit(actor.id, status === 'APPROVED' ? 'COMMISSION_APPROVED' : 'COMMISSION_REJECTED', 'SalesCommission');
    return { ...row, calculationValueSnapshot: row.calculationValueSnapshot.toString(), amountSnapshot: row.amountSnapshot.toString() };
  }
  async approve(req) { return this.decide({ status: 'APPROVED' }, req); }
  async reject(req) { return this.decide({ status: 'REJECTED' }, req); }
}

class ComplianceController {
  async auditEvents(req) {
    const actor = assertComplianceActor(await new AuthController().currentWithPermission(req, 'compliance.audit_read'));
    const rows = await prisma.authorizationAuditEvent.findMany({
      select: { auditId: true, requestId: true, actorType: true, action: true, entity: true, result: true, reasonCode: true, endpoint: true, capability: true, schemaVersion: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    // Audit-of-access sink is deliberately the legacy append-only log; this
    // path never emits another AuthorizationAuditEvent (recursion depth 0).
    await audit(actor.id, 'COMPLIANCE_AUDIT_ACCESSED', 'AuthorizationAuditEvent');
    return rows.map(complianceProjection);
  }
}

function dashboardMoney(amount, currency = 'IRR') {
  return { amount_minor: String(amount ?? 0n), currency_code: currency };
}

class DashboardController {
  async representativeReporting(req) {
    const actor = await new AuthController().currentWithPermission(req, 'commissions.summary_read');
    const period = ['7d', '30d', 'all'].includes(req.query?.period) ? req.query.period : 'all';
    const since = period === 'all' ? undefined : new Date(Date.now() - Number(period.slice(0, -1)) * 86400000);
    const createdAt = since ? { gte: since } : undefined;
    const attributions = await prisma.salesAttribution.findMany({
      where: { salesPartnerUserId: actor.id },
      select: { customerUserId: true, status: true, createdAt: true },
    });
    const customerIds = attributions.map((row) => row.customerUserId);
    const [commissions, createdPurchases, paidPurchases] = await Promise.all([
      prisma.salesCommission.findMany({
        where: { salesPartnerUserId: actor.id },
        select: { amountSnapshot: true, currencySnapshot: true, status: true, createdAt: true, approvedAt: true, reversedAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      customerIds.length ? prisma.planPurchase.count({ where: { userId: { in: customerIds }, ...(createdAt ? { createdAt } : {}) } }) : 0,
      customerIds.length ? prisma.planPurchase.count({ where: { userId: { in: customerIds }, status: 'PAID', ...(since ? { paidAt: { gte: since } } : { paidAt: { not: null } }) } }) : 0,
    ]);
    const scopedCommissions = createdAt ? commissions.filter((row) => row.createdAt >= since) : commissions;
    const currencies = [...new Set(scopedCommissions.map((row) => row.currencySnapshot))].sort();
    const groups = currencies.map((currency) => {
      const rows = scopedCommissions.filter((row) => row.currencySnapshot === currency);
      const sum = (statuses) => rows.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + row.amountSnapshot, 0n);
      return {
        currency_code: currency,
        states: Object.fromEntries(['PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'REVERSED'].map((status) => [status, dashboardMoney(sum([status]), currency)])),
      };
    });
    return {
      surface: 'representative',
      period,
      reporting: {
        attribution: {
          active_count: attributions.filter((row) => row.status === 'ACTIVE').length,
          created_count: attributions.filter((row) => !createdAt || row.createdAt >= since).length,
        },
        purchases: {
          created_count: createdPurchases,
          paid_count: paidPurchases,
          created_timestamp: 'createdAt',
          paid_timestamp: 'paidAt',
        },
        commissions: { currency_groups: groups },
        unsupported_metrics: ['active_customer_count', 'membership_activation_count', 'paid_commission'],
      },
    };
  }

  async customerSummary(req) {
    const actor = await requireUser(req);
    const [memberships, purchases, redemptions, wallet, withdrawals] = await Promise.all([
      prisma.benefitMembership.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 1, select: { status: true, endsAt: true, plan: { select: { name: true } } } }),
      prisma.planPurchase.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, amountSnapshot: true, currencySnapshot: true, createdAt: true, plan: { select: { name: true } } } }),
      prisma.redemption.findMany({ where: { customerUserId: actor.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true, confirmedAt: true, cancelledAt: true, expiredAt: true, provider: { select: { displayName: true } } } }),
      prisma.wallet.findUnique({ where: { userId: actor.id }, include: { transactions: { orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, type: true, amount: true, currency: true, createdAt: true } } } }),
      prisma.withdrawalRequest.findMany({ where: { userId: actor.id }, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, amount: true, currency: true, createdAt: true, paidAt: true, rejectedAt: true } }),
    ]);
    const currency = wallet?.currency ?? purchases[0]?.currencySnapshot ?? 'IRR';
    const walletRows = wallet?.transactions ?? [];
    const balance = walletRows.filter((row) => row.currency === currency).reduce((sum, row) => sum + row.amount, 0n);
    const activity = [
      ...purchases.map((row) => ({ type: 'PURCHASE', id: row.id, status: row.status, label: row.plan?.name ?? 'خرید طرح', createdAt: row.createdAt, amount: dashboardMoney(row.amountSnapshot, row.currencySnapshot) })),
      ...redemptions.map((row) => ({ type: 'REDEMPTION', id: row.id, status: row.status, label: row.provider?.displayName ?? 'استفاده از مزیت', createdAt: row.createdAt, confirmedAt: row.confirmedAt, cancelledAt: row.cancelledAt, expiredAt: row.expiredAt })),
      ...walletRows.map((row) => ({ type: 'WALLET_TRANSACTION', id: row.id, status: row.type, label: 'تراکنش کیف پول', createdAt: row.createdAt, amount: dashboardMoney(row.amount, row.currency) })),
      ...withdrawals.map((row) => ({ type: 'WITHDRAWAL', id: row.id, status: row.status, label: 'درخواست برداشت', createdAt: row.createdAt, paidAt: row.paidAt, rejectedAt: row.rejectedAt, amount: dashboardMoney(row.amount, row.currency) })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    return { surface: 'customer', customer: { active_plan: memberships[0] ?? null, purchase_count: purchases.length, recent_purchase_summary: purchases.map((row) => ({ ...row, amountSnapshot: dashboardMoney(row.amountSnapshot, row.currencySnapshot) })), wallet_balance: wallet ? dashboardMoney(balance, currency) : null, recent_activity: activity } };
  }

  async representativeSummary(req) {
    const actor = await new AuthController().currentWithPermission(req, 'commissions.summary_read');
    const period = ['7d', '30d', 'all'].includes(req.query?.period) ? req.query.period : 'all';
    const since = period === 'all' ? undefined : new Date(Date.now() - Number(period.slice(0, -1)) * 86400000);
    const createdAt = since ? { gte: since } : undefined;
    const [customers, newCustomers, commissions, attributions, wallet, withdrawals] = await Promise.all([
      prisma.salesAttribution.count({ where: { salesPartnerUserId: actor.id, status: 'ACTIVE' } }),
      prisma.salesAttribution.count({ where: { salesPartnerUserId: actor.id, status: 'ACTIVE', ...(createdAt ? { createdAt } : {}) } }),
      prisma.salesCommission.findMany({ where: { salesPartnerUserId: actor.id, ...(createdAt ? { createdAt } : {}) }, select: { amountSnapshot: true, currencySnapshot: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
      prisma.salesAttribution.findMany({ where: { salesPartnerUserId: actor.id, ...(createdAt ? { createdAt } : {}) }, select: { id: true, status: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 10 }),
      prisma.wallet.findUnique({ where: { userId: actor.id }, include: { transactions: { select: { amount: true, currency: true } } } }),
      prisma.withdrawalRequest.findMany({ where: { userId: actor.id, status: { in: ['PENDING', 'APPROVED', 'PAYOUT_PENDING', 'PAYOUT_UNKNOWN'] } }, select: { id: true, status: true, amount: true, currency: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 5 }),
    ]);
    const currencies = [...new Set(commissions.map((row) => row.currencySnapshot))];
    if (currencies.length > 1) throw new Error('COMMISSION_CURRENCY_CONTEXT_REQUIRED');
    const currency = currencies[0] ?? 'IRR';
    const sum = (statuses) => commissions.filter((row) => statuses.includes(row.status)).reduce((total, row) => total + row.amountSnapshot, 0n);
    const walletCurrency = wallet?.currency ?? currency;
    const walletBalance = (wallet?.transactions ?? []).filter((row) => row.currency === walletCurrency).reduce((total, row) => total + row.amount, 0n);
    return { surface: 'representative', period, representative: { attributed_customer_count: customers, new_attributed_customer_count: newCustomers, commission_summary: { pending: dashboardMoney(sum(['PENDING_APPROVAL']), currency), available: dashboardMoney(sum(['APPROVED']), currency), reversed: dashboardMoney(sum(['REVERSED']), currency) }, withdrawal_readiness: { available_balance: dashboardMoney(walletBalance, walletCurrency), pending_requests: withdrawals.map((row) => ({ id: row.id, status: row.status, amount: dashboardMoney(row.amount, row.currency), createdAt: row.createdAt })) }, recent_attributable_activity: [...attributions.map((row) => ({ type: 'CUSTOMER_ATTRIBUTION', status: row.status, createdAt: row.createdAt })), ...commissions.slice(0, 5).map((row) => ({ type: 'COMMISSION', status: row.status, createdAt: row.createdAt }))].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10) } };
  }

  async adminSummary(req) {
    await new AuthController().currentWithPermission(req, 'users.read');
    const period = ['7d', '30d', 'all'].includes(req.query?.period) ? req.query.period : 'all';
    const since = period === 'all' ? undefined : new Date(Date.now() - Number(period.slice(0, -1)) * 86400000);
    const createdAt = since ? { gte: since } : undefined;
    const [users, plans, purchases, partners, withdrawals, providers, recentUsers, recentPurchases, recentWithdrawals, recentAttributions] = await Promise.all([
      prisma.user.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.benefitPlan.count(),
      prisma.planPurchase.groupBy({ by: ['status'], _count: { _all: true }, ...(createdAt ? { where: { createdAt } } : {}) }),
      prisma.salesAttribution.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.withdrawalRequest.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.provider.groupBy({ by: ['status'], _count: { _all: true } }),
      prisma.user.findMany({ where: createdAt ? { createdAt } : undefined, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true } }),
      prisma.planPurchase.findMany({ where: createdAt ? { createdAt } : undefined, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true } }),
      prisma.withdrawalRequest.findMany({ where: createdAt ? { createdAt } : undefined, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true } }),
      prisma.salesAttribution.findMany({ where: createdAt ? { createdAt } : undefined, orderBy: { createdAt: 'desc' }, take: 5, select: { id: true, status: true, createdAt: true } }),
    ]);
    const countBy = (rows) => Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
    const activity = [
      ...recentUsers.map((row) => ({ type: 'USER_REGISTERED', id: row.id, status: row.status, createdAt: row.createdAt })),
      ...recentPurchases.map((row) => ({ type: 'PURCHASE', id: row.id, status: row.status, createdAt: row.createdAt })),
      ...recentWithdrawals.map((row) => ({ type: 'WITHDRAWAL', id: row.id, status: row.status, createdAt: row.createdAt })),
      ...recentAttributions.map((row) => ({ type: 'REPRESENTATIVE_ATTRIBUTION', id: row.id, status: row.status, createdAt: row.createdAt })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 10);
    return { surface: 'admin', period, admin: { users_by_status: countBy(users), plan_count: plans, purchases_by_status: countBy(purchases), representatives_by_status: countBy(partners), withdrawals_by_status: countBy(withdrawals), providers_by_status: countBy(providers), attention_queue: [
      { key: 'pending_purchases', count: purchases.find((row) => row.status === 'PENDING_PAYMENT')?._count._all ?? 0, href: '/admin/purchases' },
      { key: 'pending_withdrawals', count: withdrawals.find((row) => ['PENDING', 'APPROVED', 'PAYOUT_UNKNOWN'].includes(row.status))?._count._all ?? 0, href: '/admin/withdrawals' },
      { key: 'pending_providers', count: providers.find((row) => row.status === 'PENDING_REVIEW')?._count._all ?? 0, href: '/admin/providers' },
    ].filter((item) => item.count > 0), recent_activity: activity } };
  }
}
Get('customer/dashboard/summary')(DashboardController.prototype, 'customerSummary', Object.getOwnPropertyDescriptor(DashboardController.prototype, 'customerSummary')); Req()(DashboardController.prototype, 'customerSummary', 0);
Get('rep/dashboard/summary')(DashboardController.prototype, 'representativeSummary', Object.getOwnPropertyDescriptor(DashboardController.prototype, 'representativeSummary')); Req()(DashboardController.prototype, 'representativeSummary', 0);
Get('rep/reporting/summary')(DashboardController.prototype, 'representativeReporting', Object.getOwnPropertyDescriptor(DashboardController.prototype, 'representativeReporting')); Req()(DashboardController.prototype, 'representativeReporting', 0);
Get('admin/dashboard/summary')(DashboardController.prototype, 'adminSummary', Object.getOwnPropertyDescriptor(DashboardController.prototype, 'adminSummary')); Req()(DashboardController.prototype, 'adminSummary', 0);
Controller()(DashboardController);

Get('admin/compliance/audit-events')(ComplianceController.prototype, 'auditEvents', Object.getOwnPropertyDescriptor(ComplianceController.prototype, 'auditEvents')); Req()(ComplianceController.prototype, 'auditEvents', 0);
Controller()(ComplianceController);
Post('sales-partner/customers')(SalesCommissionController.prototype, 'createAttribution', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'createAttribution')); Body()(SalesCommissionController.prototype, 'createAttribution', 0); Req()(SalesCommissionController.prototype, 'createAttribution', 1);
Get('sales-partner/customers')(SalesCommissionController.prototype, 'myAttributions', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'myAttributions')); Req()(SalesCommissionController.prototype, 'myAttributions', 0);
Get('rep/commission/summary')(SalesCommissionController.prototype, 'representativeSummary', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'representativeSummary')); Req()(SalesCommissionController.prototype, 'representativeSummary', 0);
Get('admin/commissions')(SalesCommissionController.prototype, 'commissions', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'commissions')); Req()(SalesCommissionController.prototype, 'commissions', 0);
Post('admin/commissions/:id/decision')(SalesCommissionController.prototype, 'decide', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'decide')); Body()(SalesCommissionController.prototype, 'decide', 0); Req()(SalesCommissionController.prototype, 'decide', 1);
Post('admin/commissions/:id/approve')(SalesCommissionController.prototype, 'approve', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'approve')); Req()(SalesCommissionController.prototype, 'approve', 0);
Post('admin/commissions/:id/reject')(SalesCommissionController.prototype, 'reject', Object.getOwnPropertyDescriptor(SalesCommissionController.prototype, 'reject')); Req()(SalesCommissionController.prototype, 'reject', 0);
Controller()(SalesCommissionController);

class WithdrawalAdminController {
  async list(req) {
    await new AuthController().currentWithPermission(req, 'withdrawals.read');
    const rows = await prisma.withdrawalRequest.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map((row) => ({ ...row, amount: row.amount.toString() }));
  }
  async transition(req, target) {
    const permission = target === 'APPROVED' ? 'withdrawals.approve' : target === 'PAID' ? 'withdrawals.mark_paid' : 'withdrawals.reject';
    const actor = await new AuthController().currentWithPermission(req, permission);
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error('WITHDRAWAL_NOT_FOUND');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${current.walletId}))`;
      const locked = await tx.withdrawalRequest.findUnique({ where: { id: req.params.id } });
      if (target === 'APPROVED' && locked.status !== 'PENDING') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      if (target === 'PAID' && locked.status !== 'APPROVED') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      if (target === 'REJECTED' && !['PENDING', 'APPROVED'].includes(locked.status)) throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      if (target === 'REJECTED') {
        await tx.walletTransaction.create({ data: { walletId: locked.walletId, type: 'WITHDRAWAL_RELEASE', amount: locked.amount, currency: 'IRR', referenceType: 'WithdrawalRequest', referenceId: locked.id, idempotencyKey: `WITHDRAWAL_RELEASE:${locked.id}` } });
      }
      const updated = await tx.withdrawalRequest.update({ where: { id: locked.id }, data: { status: target, approvedAt: target === 'APPROVED' ? new Date() : locked.approvedAt, rejectedAt: target === 'REJECTED' ? new Date() : locked.rejectedAt, paidAt: target === 'PAID' ? new Date() : locked.paidAt } });
      if (target === 'APPROVED') {
        await tx.payoutOperation.create({ data: {
          withdrawalId: locked.id, idempotencyKey: `PAYOUT:${locked.id}`, amountSnapshot: locked.amount,
          currencySnapshot: locked.currency, beneficiarySnapshot: locked.beneficiarySnapshot ?? {},
        } });
      }
      return updated;
    });
    const event = target === 'APPROVED' ? 'WITHDRAWAL_APPROVED' : target === 'PAID' ? 'WITHDRAWAL_PAID' : 'WITHDRAWAL_REJECTED';
    await audit(actor.id, event, 'WithdrawalRequest');
    return { ...row, amount: row.amount.toString() };
  }
  async initiate(req) {
    const actor = await new AuthController().currentWithPermission(req, 'withdrawals.mark_paid');
    const prepared = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawalRequest.findUnique({ where: { id: req.params.id }, include: { payoutOperation: true } });
      if (!withdrawal) throw new Error('WITHDRAWAL_NOT_FOUND');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${withdrawal.walletId}))`;
      const locked = await tx.withdrawalRequest.findUnique({ where: { id: withdrawal.id }, include: { payoutOperation: true } });
      if (!locked.payoutOperation || locked.status !== 'APPROVED') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      await tx.payoutOperation.update({ where: { id: locked.payoutOperation.id }, data: { status: 'PAYOUT_PENDING', externalAttemptStarted: true } });
      await tx.withdrawalRequest.update({ where: { id: locked.id }, data: { status: 'PAYOUT_PENDING', externalAttemptStarted: true } });
      return { ...locked, payoutOperation: { ...locked.payoutOperation, status: 'PAYOUT_PENDING', externalAttemptStarted: true } };
    });
    let result;
    try {
      result = await payoutProvider.submit({ payoutOperationId: prepared.payoutOperation.id, amount: prepared.amount, beneficiary: prepared.beneficiarySnapshot ?? {} });
    } catch (error) {
      const unknown = ['AMBIGUOUS_TIMEOUT_AFTER_ACCEPTANCE', 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION'].includes(error?.code);
      const definitive = isDefinitiveNotPaid(error);
      await prisma.$transaction(async (tx) => {
        const current = await tx.withdrawalRequest.findUnique({ where: { id: prepared.id } });
        const status = unknown ? 'PAYOUT_UNKNOWN' : definitive ? 'FAILED' : 'PAYOUT_UNKNOWN';
        await tx.withdrawalRequest.update({ where: { id: prepared.id }, data: { status, failedAt: definitive ? new Date() : null } });
        await tx.payoutOperation.update({ where: { withdrawalId: prepared.id }, data: { status, providerReference: error?.providerReference ?? null, lastErrorClass: error?.code ?? 'PROVIDER_ERROR' } });
        if (definitive) await tx.walletTransaction.create({ data: { walletId: current.walletId, type: 'WITHDRAWAL_RELEASE', amount: current.amount, currency: current.currency, referenceType: 'WithdrawalRequest', referenceId: current.id, idempotencyKey: `WITHDRAWAL_RELEASE:${current.id}` } });
      });
      await audit(actor.id, unknown ? 'PAYOUT_UNKNOWN' : definitive ? 'PAYOUT_FAILED' : 'PAYOUT_UNKNOWN', 'PayoutOperation');
      return { status: unknown ? 'PAYOUT_UNKNOWN' : 'FAILED', id: prepared.payoutOperation.id };
    }
    const settled = await prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUnique({ where: { id: prepared.id } });
      const amountMatches = result.amount === current?.amount;
      const beneficiaryMatches = snapshotsEqual(result.beneficiary, prepared.payoutOperation.beneficiarySnapshot);
      const referenceMatches = typeof result.providerReference === 'string' && result.providerReference.length > 0;
      if (!current || current.status !== 'PAYOUT_PENDING' || !amountMatches || !beneficiaryMatches || !referenceMatches) {
        const classification = classifyDiscrepancy({ internalStatus: current?.status ?? 'PAYOUT_PENDING', providerStatus: result.status, amountMatches, beneficiaryMatches, referenceMatches });
        await tx.payoutDiscrepancy.create({ data: { payoutOperationId: prepared.payoutOperation.id, withdrawalId: prepared.id, classification, details: { providerReference: result.providerReference } } });
        return null;
      }
      const row = await tx.withdrawalRequest.update({ where: { id: current.id }, data: { status: 'PAID', paidAt: new Date() } });
      await tx.payoutOperation.update({ where: { id: prepared.payoutOperation.id }, data: { status: 'PAID', providerReference: result.providerReference, providerStatus: result.status, settledAt: new Date() } });
      await tx.payoutFeeEvent.upsert({ where: { payoutOperationId_status: { payoutOperationId: prepared.payoutOperation.id, status: 'RECOGNIZED' } }, update: { recognizedAt: new Date() }, create: { payoutOperationId: prepared.payoutOperation.id, amount: 0n, currency: current.currency, status: 'RECOGNIZED', recognizedAt: new Date() } });
      return row;
    });
    if (!settled) throw new Error('PAYOUT_DISCREPANCY');
    await audit(actor.id, 'PAYOUT_SETTLED', 'PayoutOperation');
    return { ...settled, amount: settled.amount.toString() };
  }
  async reconcile(req) {
    const actor = await new AuthController().currentWithPermission(req, 'withdrawals.mark_paid');
    const operation = await prisma.payoutOperation.findUnique({ where: { withdrawalId: req.params.id }, include: { withdrawal: true } });
    if (!operation) throw new Error('WITHDRAWAL_NOT_FOUND');
    const body = req.body ?? {};
    if (operation.status === 'PAID' && (body.outcome ?? 'PAID') === 'PAID') return { status: 'PAID', id: operation.id, idempotent: true };
    if (operation.status === 'FAILED' && (body.outcome ?? 'FAILED') === 'FAILED') return { status: 'FAILED', id: operation.id, idempotent: true };
    if (operation.status === 'FAILED' && (body.outcome ?? 'PAID') === 'PAID') {
      await prisma.payoutDiscrepancy.create({ data: { payoutOperationId: operation.id, withdrawalId: operation.withdrawalId, classification: 'INTERNAL_FAILED_PROVIDER_LATER_PAID', details: { providerReference: body.providerReference ?? operation.providerReference } } });
      return { status: 'FROZEN', classification: 'INTERNAL_FAILED_PROVIDER_LATER_PAID' };
    }
    if (operation.status !== 'PAYOUT_UNKNOWN') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
    const evidence = await payoutProvider.reconcile({ providerReference: body.providerReference ?? operation.providerReference, outcome: body.outcome ?? 'PAID', amount: body.amount ?? operation.amountSnapshot, beneficiary: body.beneficiary ?? operation.beneficiarySnapshot });
    const classification = classifyDiscrepancy({
      internalStatus: operation.status,
      providerStatus: evidence.status,
      amountMatches: BigInt(evidence.amount) === operation.amountSnapshot,
      beneficiaryMatches: snapshotsEqual(evidence.beneficiary, operation.beneficiarySnapshot),
      referenceMatches: evidence.providerReference === operation.providerReference,
      allowUnknownResolution: true,
    });
    if (classification !== 'NONE') {
      await prisma.payoutDiscrepancy.create({ data: { payoutOperationId: operation.id, withdrawalId: operation.withdrawalId, classification, details: { providerReference: evidence.providerReference } } });
      return { status: 'FROZEN', classification };
    }
    if (evidence.status === 'PAID') {
      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({ where: { id: operation.withdrawalId }, data: { status: 'PAID', paidAt: new Date() } });
        await tx.payoutOperation.update({ where: { id: operation.id }, data: { status: 'PAID', providerReference: evidence.providerReference, settledAt: new Date() } });
        await tx.payoutFeeEvent.upsert({ where: { payoutOperationId_status: { payoutOperationId: operation.id, status: 'RECOGNIZED' } }, update: { recognizedAt: new Date() }, create: { payoutOperationId: operation.id, amount: 0n, currency: operation.currencySnapshot, status: 'RECOGNIZED', recognizedAt: new Date() } });
      });
    } else if (evidence.status === 'FAILED') {
      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({ where: { id: operation.withdrawalId }, data: { status: 'FAILED', failedAt: new Date() } });
        await tx.payoutOperation.update({ where: { id: operation.id }, data: { status: 'FAILED', failedAt: new Date() } });
        await tx.walletTransaction.create({ data: { walletId: operation.withdrawal.walletId, type: 'WITHDRAWAL_RELEASE', amount: operation.amountSnapshot, currency: operation.currencySnapshot, referenceType: 'WithdrawalRequest', referenceId: operation.withdrawalId, idempotencyKey: `WITHDRAWAL_RELEASE:${operation.withdrawalId}` } });
      });
    }
    await audit(actor.id, 'PAYOUT_RECONCILED', 'PayoutOperation');
    return { status: evidence.status, id: operation.id };
  }
  async cancel(req) {
    const actor = await new AuthController().currentWithPermission(req, 'withdrawals.reject');
    const row = await prisma.$transaction(async (tx) => {
      const current = await tx.withdrawalRequest.findUnique({ where: { id: req.params.id } });
      if (!current) throw new Error('WITHDRAWAL_NOT_FOUND');
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${current.walletId}))`;
      const locked = await tx.withdrawalRequest.findUnique({ where: { id: current.id } });
      if (!['PENDING', 'APPROVED'].includes(locked.status) || locked.externalAttemptStarted) throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      await tx.walletTransaction.create({ data: { walletId: locked.walletId, type: 'WITHDRAWAL_RELEASE', amount: locked.amount, currency: locked.currency, referenceType: 'WithdrawalRequest', referenceId: locked.id, idempotencyKey: `WITHDRAWAL_RELEASE:${locked.id}` } });
      return tx.withdrawalRequest.update({ where: { id: locked.id }, data: { status: 'CANCELLED', rejectedAt: new Date() } });
    });
    await audit(actor.id, 'WITHDRAWAL_CANCELLED', 'WithdrawalRequest');
    return { ...row, amount: row.amount.toString() };
  }
  async retry(req) {
    const actor = await new AuthController().currentWithPermission(req, 'withdrawals.mark_paid');
    const operation = await prisma.payoutOperation.findUnique({ where: { withdrawalId: req.params.id }, include: { withdrawal: true } });
    if (!operation || operation.status !== 'FAILED') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
    const evidence = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${operation.withdrawal.walletId}))`;
      const current = await tx.payoutOperation.findUnique({ where: { id: operation.id }, include: { withdrawal: true } });
      if (!current || current.status !== 'FAILED' || current.withdrawal.status !== 'FAILED') throw new Error('WITHDRAWAL_NOT_ACTIONABLE');
      await tx.payoutOperation.update({ where: { id: current.id }, data: { status: 'PAYOUT_PENDING', externalAttemptStarted: true, lastErrorClass: null } });
      await tx.withdrawalRequest.update({ where: { id: current.withdrawalId }, data: { status: 'PAYOUT_PENDING', externalAttemptStarted: true } });
      return current;
    });
    try {
      const result = await payoutProvider.submit({ payoutOperationId: evidence.id, amount: evidence.amountSnapshot, beneficiary: evidence.beneficiarySnapshot });
      await prisma.$transaction(async (tx) => {
        await tx.withdrawalRequest.update({ where: { id: evidence.withdrawalId }, data: { status: 'PAID', paidAt: new Date() } });
        await tx.payoutOperation.update({ where: { id: evidence.id }, data: { status: 'PAID', providerReference: result.providerReference, settledAt: new Date() } });
        await tx.payoutFeeEvent.upsert({ where: { payoutOperationId_status: { payoutOperationId: evidence.id, status: 'RECOGNIZED' } }, update: { recognizedAt: new Date() }, create: { payoutOperationId: evidence.id, amount: 0n, currency: evidence.currencySnapshot, status: 'RECOGNIZED', recognizedAt: new Date() } });
      });
      await audit(actor.id, 'PAYOUT_RETRIED_AND_SETTLED', 'PayoutOperation');
      return { status: 'PAID', id: evidence.id };
    } catch (error) {
      await prisma.payoutOperation.update({ where: { id: evidence.id }, data: { status: 'PAYOUT_UNKNOWN', lastErrorClass: error?.code ?? 'PROVIDER_ERROR' } });
      await prisma.withdrawalRequest.update({ where: { id: evidence.withdrawalId }, data: { status: 'PAYOUT_UNKNOWN' } });
      await audit(actor.id, 'PAYOUT_RETRY_UNKNOWN', 'PayoutOperation');
      return { status: 'PAYOUT_UNKNOWN', id: evidence.id };
    }
  }
  approve(req) { return this.transition(req, 'APPROVED'); }
  reject(req) { return this.transition(req, 'REJECTED'); }
  paid(req) { return this.initiate(req); }
}
Get('admin/withdrawals')(WithdrawalAdminController.prototype, 'list', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'list')); Req()(WithdrawalAdminController.prototype, 'list', 0);
Post('admin/withdrawals/:id/approve')(WithdrawalAdminController.prototype, 'approve', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'approve')); Req()(WithdrawalAdminController.prototype, 'approve', 0);
Post('admin/withdrawals/:id/reject')(WithdrawalAdminController.prototype, 'reject', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'reject')); Req()(WithdrawalAdminController.prototype, 'reject', 0);
Post('admin/withdrawals/:id/mark-paid')(WithdrawalAdminController.prototype, 'paid', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'paid')); Req()(WithdrawalAdminController.prototype, 'paid', 0);
Post('admin/withdrawals/:id/initiate-payout')(WithdrawalAdminController.prototype, 'initiate', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'initiate')); Req()(WithdrawalAdminController.prototype, 'initiate', 0);
Post('admin/withdrawals/:id/reconcile-payout')(WithdrawalAdminController.prototype, 'reconcile', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'reconcile')); Req()(WithdrawalAdminController.prototype, 'reconcile', 0);
Post('admin/withdrawals/:id/cancel')(WithdrawalAdminController.prototype, 'cancel', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'cancel')); Req()(WithdrawalAdminController.prototype, 'cancel', 0);
Post('admin/withdrawals/:id/retry-payout')(WithdrawalAdminController.prototype, 'retry', Object.getOwnPropertyDescriptor(WithdrawalAdminController.prototype, 'retry')); Req()(WithdrawalAdminController.prototype, 'retry', 0);
Controller()(WithdrawalAdminController);
async function validateBenefitInput(planId, providerId, body) { const [plan, provider] = await Promise.all([prisma.benefitPlan.findUnique({ where: { id: planId }, select: { id: true } }), prisma.provider.findUnique({ where: { id: providerId }, select: { id: true } })]); if (!plan || !provider) throw new Error('PLAN_OR_PROVIDER_NOT_FOUND'); const type = body.discountType ?? 'PERCENT'; if (!['PERCENT', 'FIXED_AMOUNT', 'OTHER'].includes(type)) throw new Error('INVALID_DISCOUNT'); if (type === 'PERCENT' && (!(Number(body.discountValue) > 0) || Number(body.discountValue) > 100)) throw new Error('INVALID_DISCOUNT'); }
function assertPlanTransition(from, to) { const allowed = { DRAFT: ['ACTIVE', 'ARCHIVED'], ACTIVE: ['INACTIVE', 'ARCHIVED'], INACTIVE: ['ACTIVE', 'ARCHIVED'], ARCHIVED: [] }; if (!allowed[from]?.includes(to)) throw new Error('INVALID_STATE_TRANSITION'); }
Get('benefit-plans')(BenefitController.prototype, 'plans', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'plans'));
Get('benefit-plans/:id')(BenefitController.prototype, 'plan', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'plan')); Req()(BenefitController.prototype, 'plan', 0);
Post('users/me/purchases')(BenefitController.prototype, 'purchase', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'purchase')); Body()(BenefitController.prototype, 'purchase', 0); Req()(BenefitController.prototype, 'purchase', 1);
Get('users/me/purchases')(BenefitController.prototype, 'myPurchases', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'myPurchases')); Req()(BenefitController.prototype, 'myPurchases', 0);
Get('users/me/memberships')(BenefitController.prototype, 'myMemberships', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'myMemberships')); Req()(BenefitController.prototype, 'myMemberships', 0);
Post('admin/purchases/:id/confirm-payment')(BenefitController.prototype, 'confirm', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'confirm')); Body()(BenefitController.prototype, 'confirm', 0); Req()(BenefitController.prototype, 'confirm', 1);
Post('admin/purchases/:id/refund')(BenefitController.prototype, 'refund', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'refund')); Req()(BenefitController.prototype, 'refund', 0);
Post('providers/:providerId/eligibility/check')(BenefitController.prototype, 'eligibility', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'eligibility')); Body()(BenefitController.prototype, 'eligibility', 0); Req()(BenefitController.prototype, 'eligibility', 1);
Get('providers/:providerId/eligibility')(BenefitController.prototype, 'selfEligibility', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'selfEligibility')); Req()(BenefitController.prototype, 'selfEligibility', 0);
Controller()(BenefitController);
Get('admin/benefit-plans')(BenefitController.prototype, 'adminPlans', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'adminPlans')); Req()(BenefitController.prototype, 'adminPlans', 0);
Get('admin/benefit-plans/:id')(BenefitController.prototype, 'adminPlan', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'adminPlan')); Req()(BenefitController.prototype, 'adminPlan', 0);
Post('admin/benefit-plans')(BenefitController.prototype, 'createPlan', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'createPlan')); Body()(BenefitController.prototype, 'createPlan', 0); Req()(BenefitController.prototype, 'createPlan', 1);
Patch('admin/benefit-plans/:id')(BenefitController.prototype, 'updatePlan', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'updatePlan')); Body()(BenefitController.prototype, 'updatePlan', 0); Req()(BenefitController.prototype, 'updatePlan', 1);
Patch('admin/benefit-plans/:id/status')(BenefitController.prototype, 'planStatus', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'planStatus')); Body()(BenefitController.prototype, 'planStatus', 0); Req()(BenefitController.prototype, 'planStatus', 1);
Get('admin/purchases')(BenefitController.prototype, 'adminPurchases', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'adminPurchases')); Req()(BenefitController.prototype, 'adminPurchases', 0);
Get('admin/memberships')(BenefitController.prototype, 'adminMemberships', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'adminMemberships')); Req()(BenefitController.prototype, 'adminMemberships', 0);
Post('admin/benefit-plans/:id/providers/:providerId')(BenefitController.prototype, 'addBenefit', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'addBenefit')); Body()(BenefitController.prototype, 'addBenefit', 0); Req()(BenefitController.prototype, 'addBenefit', 1);
Patch('admin/benefit-plans/:id/providers/:providerId')(BenefitController.prototype, 'updateBenefit', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'updateBenefit')); Body()(BenefitController.prototype, 'updateBenefit', 0); Req()(BenefitController.prototype, 'updateBenefit', 1);
Delete('admin/benefit-plans/:id/providers/:providerId')(BenefitController.prototype, 'removeBenefit', Object.getOwnPropertyDescriptor(BenefitController.prototype, 'removeBenefit')); Req()(BenefitController.prototype, 'removeBenefit', 0);
Get('providers')(ProviderController.prototype, 'list', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'list')); Req()(ProviderController.prototype, 'list', 0);
Get('specialties')(ProviderController.prototype, 'specialties', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'specialties'));
Get('providers/:id')(ProviderController.prototype, 'detail', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'detail')); Req()(ProviderController.prototype, 'detail', 0);
Post('providers/doctor-registration')(ProviderController.prototype, 'registerDoctor', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'registerDoctor')); Body()(ProviderController.prototype, 'registerDoctor', 0); Req()(ProviderController.prototype, 'registerDoctor', 1);
Get('users/me/providers')(ProviderController.prototype, 'me', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'me')); Req()(ProviderController.prototype, 'me', 0);
Get('admin/providers')(ProviderController.prototype, 'adminList', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'adminList')); Req()(ProviderController.prototype, 'adminList', 0);
Get('admin/providers/:id')(ProviderController.prototype, 'adminDetail', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'adminDetail')); Req()(ProviderController.prototype, 'adminDetail', 0);
Post('admin/providers')(ProviderController.prototype, 'adminCreate', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'adminCreate')); Body()(ProviderController.prototype, 'adminCreate', 0); Req()(ProviderController.prototype, 'adminCreate', 1);
Patch('admin/providers/:id')(ProviderController.prototype, 'update', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'update')); Body()(ProviderController.prototype, 'update', 0); Req()(ProviderController.prototype, 'update', 1);
Patch('admin/providers/:id/status')(ProviderController.prototype, 'adminStatus', Object.getOwnPropertyDescriptor(ProviderController.prototype, 'adminStatus')); Body()(ProviderController.prototype, 'adminStatus', 0); Req()(ProviderController.prototype, 'adminStatus', 1);
Controller()(ProviderController);
for (const [name, path] of [['requestRegisterOtp', 'auth/register/request-otp'], ['verifyRegisterOtp', 'auth/register/verify-otp'], ['setPassword', 'auth/register/set-password'], ['passwordLogin', 'auth/login/password'], ['requestLoginOtp', 'auth/login/request-otp'], ['verifyLoginOtp', 'auth/login/verify-otp'], ['refresh', 'auth/refresh'], ['logout', 'auth/logout']]) {
  Post(path)(AuthController.prototype, name, Object.getOwnPropertyDescriptor(AuthController.prototype, name));
  Body()(AuthController.prototype, name, 0);
}
Body()(AuthController.prototype, 'requestRegisterOtp', 1);
Body()(AuthController.prototype, 'requestLoginOtp', 1);
Req()(AuthController.prototype, 'requestRegisterOtp', 1);
Req()(AuthController.prototype, 'requestLoginOtp', 1);
Req()(AuthController.prototype, 'passwordLogin', 1);
Req()(AuthController.prototype, 'verifyLoginOtp', 1);
Req()(AuthController.prototype, 'refresh', 1);
Req()(AuthController.prototype, 'logout', 1);
Res({ passthrough: true })(AuthController.prototype, 'passwordLogin', 2);
Res({ passthrough: true })(AuthController.prototype, 'verifyLoginOtp', 2);
Res({ passthrough: true })(AuthController.prototype, 'refresh', 2);
Res({ passthrough: true })(AuthController.prototype, 'logout', 2);
Get('auth/me')(AuthController.prototype, 'me', Object.getOwnPropertyDescriptor(AuthController.prototype, 'me'));
Req()(AuthController.prototype, 'me', 0);
Get('admin/users')(AuthController.prototype, 'adminUsers', Object.getOwnPropertyDescriptor(AuthController.prototype, 'adminUsers'));
Req()(AuthController.prototype, 'adminUsers', 0);
Get('admin/users/:id')(AuthController.prototype, 'adminUserDetail', Object.getOwnPropertyDescriptor(AuthController.prototype, 'adminUserDetail'));
Req()(AuthController.prototype, 'adminUserDetail', 0);
Patch('admin/users/:id/status')(AuthController.prototype, 'updateUserStatus', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateUserStatus'));
Body()(AuthController.prototype, 'updateUserStatus', 0);
Req()(AuthController.prototype, 'updateUserStatus', 1);
Get('users/me/profile')(AuthController.prototype, 'getProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'getProfile'));
Req()(AuthController.prototype, 'getProfile', 0);
Put('users/me/profile')(AuthController.prototype, 'updateProfile', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateProfile'));
Body()(AuthController.prototype, 'updateProfile', 0);
Req()(AuthController.prototype, 'updateProfile', 1);
Get('users/me/addresses')(AuthController.prototype, 'listAddresses', Object.getOwnPropertyDescriptor(AuthController.prototype, 'listAddresses'));
Req()(AuthController.prototype, 'listAddresses', 0);
Post('users/me/addresses')(AuthController.prototype, 'createAddress', Object.getOwnPropertyDescriptor(AuthController.prototype, 'createAddress'));
Body()(AuthController.prototype, 'createAddress', 0);
Req()(AuthController.prototype, 'createAddress', 1);
Put('users/me/addresses/:id')(AuthController.prototype, 'updateAddress', Object.getOwnPropertyDescriptor(AuthController.prototype, 'updateAddress'));
Body()(AuthController.prototype, 'updateAddress', 0);
Req()(AuthController.prototype, 'updateAddress', 1);
Delete('users/me/addresses/:id')(AuthController.prototype, 'deleteAddress', Object.getOwnPropertyDescriptor(AuthController.prototype, 'deleteAddress'));
Body()(AuthController.prototype, 'deleteAddress', 0);
Req()(AuthController.prototype, 'deleteAddress', 1);
Put('users/me/addresses/:id/default')(AuthController.prototype, 'setDefaultAddress', Object.getOwnPropertyDescriptor(AuthController.prototype, 'setDefaultAddress'));
Body()(AuthController.prototype, 'setDefaultAddress', 0);
Req()(AuthController.prototype, 'setDefaultAddress', 1);
Controller()(AuthController);

class AppModule {}
Module({ controllers: [HealthController, LocationController, AuthController, ProviderController, BenefitController, RedemptionController, RewardsController, CommercialAdminController, SalesCommissionController, WithdrawalAdminController, ComplianceController, DashboardController] })(AppModule);

async function seedRbac() {
  const roles = ['SUPER_ADMIN', 'ADMIN', 'SUPPORT', 'COMPLIANCE_AUDITOR', 'SALES_PARTNER', 'USER'];
  const permissions = [['users', 'read'], ['users', 'create'], ['users', 'update'], ['users', 'disable'], ['providers', 'read'], ['providers', 'create'], ['providers', 'update'], ['providers', 'approve'], ['providers', 'suspend'], ['specialties', 'read'], ['specialties', 'manage'], ['roles', 'read'], ['roles', 'manage'], ['permissions', 'read'], ['permissions', 'manage'], ['audit', 'read'], ['compliance', 'audit_read'], ['plans', 'read'], ['plans', 'create'], ['plans', 'update'], ['plans', 'manage_providers'], ['purchases', 'read'], ['purchases', 'confirm_payment'], ['purchases', 'refund'], ['memberships', 'read'], ['eligibility', 'check'], ['redemptions', 'reverse'], ['commercial_settings', 'read'], ['commercial_settings', 'manage'], ['withdrawals', 'read'], ['withdrawals', 'approve'], ['withdrawals', 'reject'], ['withdrawals', 'mark_paid'], ['commissions', 'read'], ['commissions', 'summary_read'], ['commissions', 'approve'], ['commissions', 'reject'], ['sales_attributions', 'read'], ['sales_attributions', 'create'], ['sales_attributions', 'manage']];
  for (const name of roles) await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
  for (const [resource, action] of permissions) await prisma.permission.upsert({ where: { resource_action: { resource, action } }, update: {}, create: { resource, action } });
  const admin = await prisma.role.findUnique({ where: { name: 'SUPER_ADMIN' } });
  for (const [resource, action] of permissions) {
    const permission = await prisma.permission.findUnique({ where: { resource_action: { resource, action } } });
    await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: admin.id, permissionId: permission.id } }, update: {}, create: { roleId: admin.id, permissionId: permission.id } });
  }
  const salesPartner = await prisma.role.findUnique({ where: { name: 'SALES_PARTNER' } });
  const summaryPermission = await prisma.permission.findUnique({ where: { resource_action: { resource: 'commissions', action: 'summary_read' } } });
  await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: salesPartner.id, permissionId: summaryPermission.id } }, update: {}, create: { roleId: salesPartner.id, permissionId: summaryPermission.id } });
  const compliance = await prisma.role.findUnique({ where: { name: 'COMPLIANCE_AUDITOR' } });
  const compliancePermission = await prisma.permission.findUnique({ where: { resource_action: { resource: 'compliance', action: 'audit_read' } } });
  await prisma.rolePermission.upsert({ where: { roleId_permissionId: { roleId: compliance.id, permissionId: compliancePermission.id } }, update: {}, create: { roleId: compliance.id, permissionId: compliancePermission.id } });
}

async function seedCommercialSettings() {
  if (!await prisma.commercialSettings.findFirst()) await prisma.commercialSettings.create({ data: { referralEnabled: true, withdrawalsEnabled: true, salesCommissionEnabled: true, autoApproveCommissionAfterPayment: false } });
}

async function seedSpecialties() {
  const names = ['General Practitioner', 'Cardiology', 'Dermatology', 'Dentistry', 'Pediatrics', 'Gynecology', 'Orthopedics', 'Neurology', 'Psychiatry', 'Ophthalmology', 'ENT', 'Internal Medicine'];
  for (const name of names) await prisma.medicalSpecialty.upsert({ where: { name }, update: {}, create: { name } });
}

async function seedGeography() {
  const base = new URL('../../../data/reference/iran-geography/1404/', import.meta.url);
  const provinces = JSON.parse(await fs.readFile(new URL('provinces.json', base), 'utf8'));
  const cities = JSON.parse(await fs.readFile(new URL('cities.json', base), 'utf8'));
  await prisma.$transaction(async (tx) => {
    const byCode = new Map();
    for (const item of provinces) {
      const existing = await tx.province.findUnique({ where: { sourceCode: item.sourceCode }, select: { id: true } }) ?? await tx.province.findFirst({ where: { name: item.name }, select: { id: true } });
      const province = existing
        ? await tx.province.update({ where: { id: existing.id }, data: { name: item.name, code: item.sourceCode, sourceCode: item.sourceCode, sourceVersion: item.sourceVersion } })
        : await tx.province.create({ data: { name: item.name, code: item.sourceCode, sourceCode: item.sourceCode, sourceVersion: item.sourceVersion } });
      byCode.set(item.sourceCode, province.id);
    }
    for (const item of cities) {
      const provinceId = byCode.get(item.provinceCode);
      if (!provinceId) throw new Error('GEOGRAPHY_SEED_INVALID');
      const existing = await tx.city.findUnique({ where: { sourceCode: item.sourceCode }, select: { id: true } });
      if (existing) await tx.city.update({ where: { id: existing.id }, data: { name: item.name, provinceId, sourceVersion: item.sourceVersion } });
      else await tx.city.create({ data: { name: item.name, sourceCode: item.sourceCode, sourceVersion: item.sourceVersion, provinceId } });
    }
    const addresses = await tx.address.findMany({ include: { city: true } });
    for (const address of addresses) {
      const canonicalCity = cities.find((item) => item.name === address.city.name);
      if (canonicalCity) {
        const canonicalProvinceId = byCode.get(canonicalCity.provinceCode);
        const target = await tx.city.findUnique({ where: { sourceCode: canonicalCity.sourceCode }, select: { id: true } });
        if (target && target.id !== address.cityId) await tx.address.update({ where: { id: address.id }, data: { cityId: target.id, provinceId: canonicalProvinceId } });
      }
    }
    const staleCities = await tx.city.findMany({ where: { sourceCode: { notIn: cities.map((item) => item.sourceCode) } }, select: { id: true, sourceCode: true } });
    const staleCityIds = staleCities.map((item) => item.id);
    if (staleCityIds.length && await tx.address.findFirst({ where: { cityId: { in: staleCityIds } }, select: { id: true } })) {
      throw new Error('GEOGRAPHY_SEED_REFERENCED_STALE_CITY');
    }
    const staleProvinces = await tx.province.findMany({ where: { sourceCode: { notIn: provinces.map((item) => item.sourceCode) } }, select: { id: true, sourceCode: true } });
    const staleProvinceIds = staleProvinces.map((item) => item.id);
    if (staleProvinceIds.length && await tx.address.findFirst({ where: { provinceId: { in: staleProvinceIds } }, select: { id: true } })) {
      throw new Error('GEOGRAPHY_SEED_REFERENCED_STALE_PROVINCE');
    }
    await tx.city.deleteMany({ where: { id: { in: staleCityIds } } });
    await tx.province.deleteMany({ where: { id: { in: staleProvinceIds } } });
  }, { timeout: 30000 });
  if (provinces.length !== 31 || cities.length !== 1481) throw new Error('GEOGRAPHY_SEED_INVALID');
}

const app = await NestFactory.create(AppModule);
app.setGlobalPrefix('api/v1');
app.use((req, res, next) => {
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) assertOriginAndCsrf(req);
  next();
});
app.useGlobalFilters({ catch(exception, host) {
  const response = host.switchToHttp().getResponse();
  const code = exception?.message ?? 'INTERNAL_ERROR';
  const status = exception?.code === 'P2002' || code === 'P2002' ? 409 : code === 'RATE_LIMITED' ? 429 : ['UNAUTHORIZED', 'AUTH_FAILED', 'OTP_INVALID', 'REFRESH_INVALID', 'MOBILE_NOT_VERIFIED', 'PASSWORD_SETUP_REQUIRED'].includes(code) ? 401 : ['FORBIDDEN', 'CSRF_REJECTED', 'AUTH_CONFLICT'].includes(code) ? 403 : ['INVALID_MOBILE', 'INVALID_PROFILE', 'INVALID_NATIONAL_ID', 'INVALID_ADDRESS', 'INVALID_STATUS', 'INVALID_PROVIDER', 'INVALID_PROVIDER_STATUS', 'INVALID_PROVIDER_TRANSITION', 'INVALID_MEDICAL_COUNCIL_NUMBER', 'PROVIDER_NOT_EDITABLE', 'PAYMENT_NOT_CONFIRMABLE', 'REFUND_NOT_ALLOWED', 'INVALID_PLAN', 'INVALID_DISCOUNT', 'INVALID_STATE_TRANSITION', 'INVALID_REDEMPTION_TRANSITION', 'IDEMPOTENCY_KEY_REQUIRED', 'REDEMPTION_TOKEN_REQUIRED', 'REDEMPTION_NOT_ELIGIBLE', 'REDEMPTION_NOT_CONFIRMABLE', 'REDEMPTION_NOT_CANCELLABLE', 'REDEMPTION_TOKEN_INVALID', 'REDEMPTION_EXPIRED', 'REVERSAL_REASON_REQUIRED', 'INSUFFICIENT_BALANCE', 'INVALID_WITHDRAWAL_AMOUNT', 'INVALID_FINANCIAL_AMOUNT', 'WITHDRAWAL_NOT_ALLOWED', 'WITHDRAWAL_NOT_ACTIONABLE'].includes(code) ? 400 : ['ADDRESS_NOT_FOUND', 'USER_NOT_FOUND', 'PROVINCE_NOT_FOUND', 'PROVIDER_NOT_FOUND', 'PLAN_NOT_FOUND', 'PURCHASE_NOT_FOUND', 'REDEMPTION_NOT_FOUND', 'PLAN_OR_PROVIDER_NOT_FOUND', 'WITHDRAWAL_NOT_FOUND'].includes(code) ? 404 : ['IDEMPOTENCY_CONFLICT', 'REDEMPTION_CONFIRMATION_RACE', 'REDEMPTION_CANCEL_RACE', 'REDEMPTION_REVERSAL_RACE'].includes(code) ? 409 : 500;
  const safeStatus = ['P2034', 'P2028', 'P40001'].includes(exception?.code) || ['WITHDRAWAL_CONFLICT', 'REFUND_WALLET_FUNDS_UNAVAILABLE', 'COMMISSION_CURRENCY_CONTEXT_REQUIRED'].includes(code) ? 409 : status;
  response.status(safeStatus).json({ error: safeStatus === 500 ? 'INTERNAL_ERROR' : code });
} });
await seedRbac();
await seedCommercialSettings();
await seedSpecialties();
await seedGeography();
await app.listen(Number(process.env.PORT ?? 4000), '0.0.0.0');
