import crypto from 'node:crypto';

export const PAYOUT_STATUS = Object.freeze({
  CREATED: 'CREATED', PAYOUT_PENDING: 'PAYOUT_PENDING', PAYOUT_UNKNOWN: 'PAYOUT_UNKNOWN', FAILED: 'FAILED', PAID: 'PAID',
});

export class FakePayoutProvider {
  constructor({ outcomes = [] } = {}) { this.outcomes = [...outcomes]; this.calls = []; this.references = new Map(); }
  async submit(request) {
    this.calls.push({ ...request });
    const outcome = this.outcomes.length ? this.outcomes.shift() : 'ACCEPT';
    if (outcome === 'TIMEOUT_BEFORE_ACCEPTANCE' || outcome === 'TIMEOUT_BEFORE_SUBMISSION') throw Object.assign(new Error('PROVIDER_TIMEOUT'), { code: 'TIMEOUT_BEFORE_SUBMISSION' });
    if (outcome === 'AMBIGUOUS_TIMEOUT_AFTER_ACCEPTANCE' || outcome === 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION') throw Object.assign(new Error('PROVIDER_TIMEOUT'), { code: 'AMBIGUOUS_TIMEOUT_AFTER_SUBMISSION', accepted: true, providerReference: crypto.randomUUID() });
    if (outcome === 'DEFINITIVE_NOT_PAID') throw Object.assign(new Error('PROVIDER_NOT_PAID'), { code: 'DEFINITIVE_NOT_PAID' });
    if (outcome === 'TRANSIENT_ERROR' || outcome === 'RATE_LIMITED_429' || outcome === '429' || outcome === 'PROVIDER_5XX' || outcome === '5XX') throw Object.assign(new Error('PROVIDER_TRANSIENT_ERROR'), { code: outcome });
    const providerReference = this.references.get(request.payoutOperationId) ?? crypto.randomUUID();
    this.references.set(request.payoutOperationId, providerReference);
    if (outcome === 'WRONG_AMOUNT') return { status: 'PAID', providerReference, amount: BigInt(request.amount) + 1n, beneficiary: request.beneficiary };
    if (outcome === 'WRONG_BENEFICIARY') return { status: 'PAID', providerReference, amount: request.amount, beneficiary: { mismatch: true } };
    if (outcome === 'WRONG_PROVIDER_REFERENCE') return { status: 'PAID', providerReference: `wrong:${providerReference}`, amount: request.amount, beneficiary: request.beneficiary };
    if (outcome === 'DUPLICATE_CALLBACK') return { status: 'PAID', providerReference, amount: request.amount, beneficiary: request.beneficiary, duplicate: true };
    if (outcome === 'LATE_CALLBACK') return { status: 'PAID', providerReference, amount: request.amount, beneficiary: request.beneficiary, late: true };
    if (outcome === 'CONTRADICTORY_CALLBACK') return { status: 'FAILED', providerReference, amount: request.amount, beneficiary: request.beneficiary, contradictory: true };
    return { status: outcome === 'PAID' ? 'PAID' : 'ACCEPTED', providerReference, amount: request.amount, beneficiary: request.beneficiary, feeAmount: request.feeAmount ?? 0n };
  }
  async reconcile({ providerReference, outcome = 'PAID', amount, beneficiary }) {
    return { status: outcome, providerReference, amount, beneficiary };
  }
}

export function classifyDiscrepancy({ internalStatus, providerStatus, amountMatches = true, beneficiaryMatches = true, referenceMatches = true, allowUnknownResolution = false }) {
  if (amountMatches === false) return 'AMOUNT_MISMATCH';
  if (beneficiaryMatches === false) return 'BENEFICIARY_MISMATCH';
  if (referenceMatches === false) return 'PROVIDER_REFERENCE_MISMATCH';
  if (internalStatus === 'PAYOUT_UNKNOWN' && providerStatus === 'PAID' && !allowUnknownResolution) return 'INTERNAL_UNKNOWN_PROVIDER_PAID';
  if (internalStatus === 'FAILED' && providerStatus === 'PAID') return 'INTERNAL_FAILED_PROVIDER_LATER_PAID';
  if (internalStatus === 'PAYOUT_PENDING' && providerStatus === 'PAID') return 'INTERNAL_PENDING_PROVIDER_PAID';
  if (internalStatus === 'PAYOUT_PENDING' && providerStatus === 'FAILED') return 'INTERNAL_PENDING_PROVIDER_FAILED';
  return 'NONE';
}

export function snapshotsEqual(left, right) {
  return JSON.stringify(left ?? {}) === JSON.stringify(right ?? {});
}

export function isDefinitiveNotPaid(error) { return error?.code === 'DEFINITIVE_NOT_PAID'; }
