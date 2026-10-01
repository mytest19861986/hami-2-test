import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateEligibility } from '../src/eligibility.mjs';

test('eligibility returns all active benefits and denies stale state', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  const provider = { id: 'provider-1', status: 'APPROVED' };
  const base = { id: 'membership-1', planId: 'plan-1', status: 'ACTIVE', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z') };
  const benefits = [{ planId: 'plan-1', providerId: 'provider-1', isActive: true, discountType: 'PERCENT', discountValue: 20, plan: { name: 'Gold', status: 'ACTIVE' } }, { planId: 'plan-2', providerId: 'provider-1', isActive: true, discountType: 'FIXED_AMOUNT', discountValue: 100, plan: { name: 'Silver', status: 'ACTIVE' } }];
  const result = evaluateEligibility({ user: { status: 'ACTIVE' }, provider, memberships: [base, { ...base, id: 'membership-2', planId: 'plan-2' }], benefits, now });
  assert.equal(result.eligible, true);
  assert.equal(result.benefits.length, 2);
  assert.equal(evaluateEligibility({ user: { status: 'ACTIVE' }, provider: { ...provider, status: 'SUSPENDED' }, memberships: [base], benefits, now }).eligible, false);
  assert.equal(evaluateEligibility({ user: { status: 'ACTIVE' }, provider, memberships: [{ ...base, endsAt: new Date('2026-09-01T00:00:00Z') }], benefits, now }).eligible, false);
});

test('eligibility denies active membership backed by non-paid purchase', () => {
  const now = new Date('2026-09-27T10:00:00Z');
  const membership = { planId: 'plan-1', status: 'ACTIVE', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z'), purchase: { status: 'REFUNDED' } };
  const result = evaluateEligibility({ user: { status: 'ACTIVE' }, provider: { id: 'provider-1', status: 'APPROVED' }, memberships: [membership], benefits: [{ planId: 'plan-1', providerId: 'provider-1', isActive: true, discountType: 'PERCENT', discountValue: 20, plan: { name: 'Gold', status: 'ACTIVE' } }], now });
  assert.deepEqual(result, { eligible: false, benefits: [] });
});

test('eligibility denies a cancelled membership explicitly', () => {
  const result = evaluateEligibility({
    user: { status: 'ACTIVE' },
    provider: { id: 'provider-1', status: 'APPROVED' },
    memberships: [{ planId: 'plan-1', status: 'CANCELLED', startsAt: new Date('2026-09-01T00:00:00Z'), endsAt: new Date('2026-10-01T00:00:00Z'), purchase: { status: 'PAID' } }],
    benefits: [{ planId: 'plan-1', providerId: 'provider-1', isActive: true, discountType: 'PERCENT', discountValue: 20, plan: { name: 'Gold', status: 'ACTIVE' } }],
    now: new Date('2026-09-27T00:00:00Z'),
  });
  assert.equal(result.eligible, false);
});
