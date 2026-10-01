import test from 'node:test';
import assert from 'node:assert/strict';
import { FakePayoutProvider, classifyDiscrepancy, snapshotsEqual } from '../src/payout-core.mjs';

test('fake provider covers deterministic acceptance and ambiguous timeout', async () => {
  const provider = new FakePayoutProvider({ outcomes: ['ACCEPT', 'AMBIGUOUS_TIMEOUT_AFTER_ACCEPTANCE'] });
  const first = await provider.submit({ payoutOperationId: 'op-1', amount: 100n, beneficiary: {} });
  assert.equal(first.status, 'ACCEPTED');
  await assert.rejects(() => provider.submit({ payoutOperationId: 'op-1', amount: 100n, beneficiary: {} }), (error) => error.code === 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION');
  assert.equal(provider.calls.length, 2);
});

test('discrepancy classifier freezes conflicting payout evidence', () => {
  assert.equal(classifyDiscrepancy({ internalStatus: 'PAYOUT_UNKNOWN', providerStatus: 'PAID' }), 'INTERNAL_UNKNOWN_PROVIDER_PAID');
  assert.equal(classifyDiscrepancy({ internalStatus: 'FAILED', providerStatus: 'PAID' }), 'INTERNAL_FAILED_PROVIDER_LATER_PAID');
  assert.equal(classifyDiscrepancy({ internalStatus: 'PAYOUT_PENDING', providerStatus: 'PAID', amountMatches: false }), 'AMOUNT_MISMATCH');
  assert.equal(classifyDiscrepancy({ internalStatus: 'PAYOUT_PENDING', providerStatus: 'PAID' }), 'INTERNAL_PENDING_PROVIDER_PAID');
});

test('snapshot comparison detects beneficiary substitution and preserves exact structure', () => {
  const approved = { name: 'Test', accountFingerprint: 'fp-1' };
  assert.equal(snapshotsEqual(approved, { name: 'Test', accountFingerprint: 'fp-1' }), true);
  assert.equal(snapshotsEqual(approved, { name: 'Test', accountFingerprint: 'fp-2' }), false);
});

test('fake provider scenario matrix is deterministic and provider-neutral', async () => {
  const outcomes = ['ACCEPT', 'PAID', 'DEFINITIVE_NOT_PAID', 'TRANSIENT_ERROR', 'RATE_LIMITED_429', 'PROVIDER_5XX', 'TIMEOUT_BEFORE_SUBMISSION', 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION', 'WRONG_AMOUNT', 'WRONG_BENEFICIARY', 'WRONG_PROVIDER_REFERENCE'];
  for (const outcome of outcomes) {
    const provider = new FakePayoutProvider({ outcomes: [outcome] });
    if (['DEFINITIVE_NOT_PAID', 'TRANSIENT_ERROR', 'RATE_LIMITED_429', 'PROVIDER_5XX', 'TIMEOUT_BEFORE_SUBMISSION', 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION'].includes(outcome)) {
      await assert.rejects(() => provider.submit({ payoutOperationId: 'op', amount: 10n, beneficiary: { id: 'b' } }));
    } else {
      const result = await provider.submit({ payoutOperationId: 'op', amount: 10n, beneficiary: { id: 'b' } });
      assert.ok(result.providerReference);
      if (outcome === 'WRONG_AMOUNT') assert.equal(result.amount, 11n);
    }
  }
});

test('callback replay scenarios reuse the same provider reference deterministically', async () => {
  for (const outcome of ['DUPLICATE_CALLBACK', 'LATE_CALLBACK', 'CONTRADICTORY_CALLBACK']) {
    const provider = new FakePayoutProvider({ outcomes: [outcome] });
    const first = await provider.submit({ payoutOperationId: `op-${outcome}`, amount: 10n, beneficiary: { id: 'b' } });
    const replay = await provider.submit({ payoutOperationId: `op-${outcome}`, amount: 10n, beneficiary: { id: 'b' } });
    assert.equal(first.providerReference, replay.providerReference);
    assert.equal(first.amount, 10n);
  }
});
