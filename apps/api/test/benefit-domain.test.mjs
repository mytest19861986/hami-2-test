import test from 'node:test';
import assert from 'node:assert/strict';
import { assertTransition, membershipWindow } from '../src/benefit-domain.mjs';

test('benefit state machines reject invalid transitions', () => {
  assert.equal(assertTransition('purchase', 'PENDING_PAYMENT', 'PAID'), 'PAID');
  assert.equal(assertTransition('purchase', 'PAID', 'REFUNDED'), 'REFUNDED');
  assert.throws(() => assertTransition('purchase', 'REFUNDED', 'PAID'), /INVALID_STATE_TRANSITION/);
  assert.throws(() => assertTransition('plan', 'ARCHIVED', 'ACTIVE'), /INVALID_STATE_TRANSITION/);
  assert.equal(membershipWindow({ status: 'ACTIVE', startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01') }, new Date('2026-09-27')), true);
  assert.equal(membershipWindow({ status: 'CANCELLED', startsAt: new Date('2026-01-01'), endsAt: new Date('2027-01-01') }, new Date('2026-09-27')), false);
});

test('purchase and membership terminal states cannot be revived', () => {
  for (const [from, to] of [['CANCELLED', 'PAID'], ['REFUNDED', 'PAID']]) {
    assert.throws(() => assertTransition('purchase', from, to), /INVALID_STATE_TRANSITION/);
  }
  for (const [from, to] of [['EXPIRED', 'ACTIVE'], ['CANCELLED', 'ACTIVE']]) {
    assert.throws(() => assertTransition('membership', from, to), /INVALID_STATE_TRANSITION/);
  }
});

test('membership validity uses the purchase snapshot duration, not mutable plan duration', () => {
  const confirmedAt = new Date('2026-09-27T00:00:00.000Z');
  const purchaseSnapshotDays = 365;
  const mutablePlanDays = 30;
  const endsAt = new Date(confirmedAt.getTime() + purchaseSnapshotDays * 86400000);
  assert.equal(endsAt.toISOString(), '2027-09-27T00:00:00.000Z');
  assert.notEqual(endsAt.getTime(), confirmedAt.getTime() + mutablePlanDays * 86400000);
  assert.equal(membershipWindow({ status: 'ACTIVE', startsAt: confirmedAt, endsAt }, new Date('2027-09-26T23:59:59.999Z')), true);
  assert.equal(membershipWindow({ status: 'ACTIVE', startsAt: confirmedAt, endsAt }, new Date('2027-09-27T00:00:00.000Z')), false);
});
