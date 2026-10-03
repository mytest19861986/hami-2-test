# FW-02-R-WAVE-REFUND-RECONCILIATION-CONTRACT-34

**Status:** contract gate; LOCAL/TEST only
**Runtime implementation:** not authorized
**Production:** LOCKED / NO-GO

## 1. Repository inventory (verified at Wave 34 start)

- `PlanPurchase` stores immutable amount/currency/validity snapshots, payment
  and refund references, `paidAt`, `refundedAt`, and `refundedByUserId`.
- Purchase states are `PENDING_PAYMENT`, `PAID`, `CANCELLED`, `REFUNDED`.
  There is no refund-case/reconciliation entity or intermediate refund state.
- `BenefitMembership` is unique per purchase and has PENDING, ACTIVE, EXPIRED,
  CANCELLED, REJECTED. No refund-case relation exists.
- Wallet ledger types cover referral reward/reversal, withdrawal reservation/
  release, and admin adjustment; there is no purchase-refund principal entry.
- Referral attribution and sales commission link to the purchase. Commission
  has a unique purchase key and `REVERSED` state.
- Existing `POST /api/v1/admin/purchases/:id/refund` requires
  `purchases.refund` and a caller-supplied `refundReference`. It conditionally
  changes PAID to REFUNDED in a transaction; same-reference replay is returned,
  a different reference conflicts. It cancels PENDING/ACTIVE/REJECTED
  membership, reverses eligible referral reward and commission, records an
  audit event, and may release only PENDING/APPROVED withdrawals to protect
  wallet non-negativity. If funds remain insufficient, it fails closed.
- Audit metadata labels the evidence `OPERATOR_ATTESTED_EXTERNAL_REFUND` and
  fingerprints (does not store) the reference. Neither that label nor a unique
  operator-entered reference independently proves money was returned.
- No payment-provider refund integration, provider query/callback evidence,
  refund workflow UI, or dedicated refund permission set was found. Existing
  audit helper supports entity, metadata, and idempotency key; Wave 32's older
  statement that those fields were absent is stale relative to current code.
- Existing financial integration tests cover refund replay, exactly-once
  referral reversal, and refund/withdrawal concurrency. Withdrawal payout
  states Payout Pending/Unknown/Paid are not in the refund handler's releasable
  set. The endpoint performs no provider-side principal transfer.

## 2. Contract boundaries and target state machine

Keep the payment fact separate from a future refund case/workflow:

```text
Purchase: PENDING_PAYMENT -> PAID -> REFUNDED
                       \-> CANCELLED (before PAID only)

Refund case (proposed workflow; not a current schema):
  OPEN -> UNDER_REVIEW -> APPROVED -> SUBMISSION_PENDING
       \-> REJECTED                    -> UNKNOWN -> RECONCILIATION_REQUIRED
                                       -> COMPLETED (only authoritative proof)
```

The case-state names are a contract proposal, not implemented schema. Approval,
request, timeout, operator reference, or an ambiguous provider response MUST NOT
change Purchase to REFUNDED or trigger financial reversals. A definitive,
verified completed refund may do so exactly once, subject to exact purchase,
amount, currency, and provider-operation identity match. A mismatch or
contradictory/late result is frozen for reconciliation, never silently
accepted. `UNKNOWN` does not mean failed, refundable again, or safe to retry.

## 3. Financial source of truth (open decision; no assumption)

The repository has no authoritative external refund-completion source today.
The current operator-attested reference is evidence of an assertion, not proof
of external settlement. Before implementation, Project Owner/Commander must
select what qualifies as authoritative completion, for example an authenticated
provider status/callback tied to a selected provider operation, or a separately
defined independently verified/manual evidence process. No provider or manual
evidence standard is selected by this document. Until decided, do not claim
external refund completion from the current endpoint/reference alone.

On a qualified completion, the external evidence establishes the money-return
fact; the internal purchase/ledger transaction records the local consequence.
The purchase snapshot remains the expected principal and currency. Any partial,
fee-adjusted, wrong-currency, duplicate-operation, or unmatched result requires
an explicit policy and reconciliation; do not infer an exact refund.

## 4. Permission matrix

| Action | Current repository | Contract boundary |
|---|---|---|
| Read purchases | `purchases.read` | Existing scope only |
| Record payment | `purchases.confirm_payment` | Does not authorize refund |
| Refund endpoint | `purchases.refund` | Currently conflates assertion and completion; not sufficient proof |
| Open/review/approve refund case | No dedicated capability found | Exact least-privilege split and maker-checker requirement remain undecided |
| Submit/query provider refund | No provider integration/capability found | Requires provider/evidence decision and explicit authorization |
| Apply verified completion | No separately gated capability found | Must be guarded, auditable, idempotent, and based on authoritative evidence |
| Withdrawals/commissions | Separate existing domains/permissions | Refund workflow must not broaden their authority |

No role grant, approval model, or provider permission is created by this
contract. Preserve least privilege; request Owner/Commander decision on the
open approval model before Wave 35 builds it.

## 5. Financial side-effect matrix

| Event | Purchase / entitlement | Referral, commission, wallet, withdrawal |
|---|---|---|
| Request/open/review | Remain PAID; no entitlement change | No ledger or reversal |
| Approve | Remain PAID until external completion is proven | No ledger or reversal |
| Provider submission accepted / pending | Remain PAID; case remains in-flight | No ledger or reversal |
| Timeout / UNKNOWN / unavailable | Remain PAID; freeze case for reconciliation | No retry or release inferred; no ledger/reversal |
| Rejected / definitive not-refunded | Remain PAID; close/reconcile case per policy | No refund reversal |
| Verified exact completed refund | One guarded PAID->REFUNDED transition; terminate applicable membership under decided policy | Reverse eligible linked rewards/commissions exactly once; any withdrawal reservation treatment must preserve ledger invariants and must not claim to undo an already-paid payout |
| Amount/currency/reference/identity mismatch or contradictory evidence | No transition; freeze and audit discrepancy | No side effects |

No customer principal refund posting mechanism exists in the wallet ledger;
Wave 35 must not invent one or represent the status mutation as the money
transfer. Existing eligible withdrawal releases are compensating reservation
events, not provider payout reversals. If prior/unknown payout makes a safe
reversal impossible, fail closed and escalate.

## 6. Idempotency, concurrency, and atomicity

- A refund operation needs a stable operation/idempotency identity distinct
  from an operator-entered reference. Uniqueness must bind provider operation
  identity to one purchase; replay with same identity and same immutable
  amount/currency returns the recorded outcome, while conflicting reuse freezes
  as a discrepancy.
- Concurrent approve/submit/callback/reconciliation claims must use guarded
  transitions and one transaction boundary for local completion effects. At
  most one completion claim and each linked compensating event may commit.
- Lock order must be documented and consistent with the wallet advisory lock
  used by existing reversal logic. Refund-vs-withdrawal races must serialize;
  no lost update, duplicate release/reversal, or negative available balance.
- Never automatically retry an UNKNOWN provider operation as a new refund.
  Resolve the original operation first using the Owner-approved authoritative
  source.
- A failed local atomic completion must leave a retryable/reconcilable case,
  without partial purchase/entitlement/commission/referral mutation.

## 7. Failure and reconciliation matrix

| Condition | Required disposition |
|---|---|
| Provider timeout / connection loss | UNKNOWN; retain PAID; reconcile original operation |
| Duplicate callback/replay | Idempotent read of committed result; no repeated side effects |
| Same key, changed purchase/amount/currency | Conflict; freeze and audit |
| Provider says success but exact amount/currency/reference cannot be matched | Discrepancy; no REFUNDED transition |
| Provider says definitive not-refunded | No financial mutation; close only under approved policy |
| Internal commit fails after external success | Preserve evidence, keep case for reconciliation; safely retry local completion only, never issue another external refund |
| Reward clawback conflicts with spent/paid-out funds | Atomic failure/freeze and escalation; do not fabricate wallet funds or reverse a paid payout |
| Late success after local terminal decision | Audited discrepancy; no silent mutation |
| Current endpoint receives only an operator reference | Treat as assertion; it cannot satisfy the authoritative completion gate |

## 8. Audit, privacy, and access contract

Record actor, action, purchase/case identity, prior/new workflow state,
reason-code, stable idempotency/operation identity, timestamps, decision
provenance, correlation/request ID, and outcome. Store only the minimum provider
evidence needed for verification; redact credentials, tokens, full payment
instrument data, and unnecessary personal data. References should be protected
and/or fingerprinted in audit logs; enforce scoped read access and immutable
decision history. Access/export and discrepancy resolution must be auditable.
These are target requirements, not a claim that a refund case/audit schema
already exists.

## 9. Schema/migration impact

No schema or migration is authorized or created in Wave 34. The current schema
has no refund case, provider refund operation, discrepancy record, or
principal-refund ledger event. Wave 35 may propose an additive model only after
the evidence source, state machine, authorization/approval policy, partial
refund policy, and treatment of already-paid referral/commission/withdrawal
funds are decided. No migration-history manipulation or financial backfill is
authorized.

## 10. Exact Wave 35 implementation boundary

After the open decisions below are resolved, Wave 35 may implement only the
approved refund/reconciliation workflow: additive persistence if approved,
least-privilege API/service transitions, idempotent provider/manual evidence
adapter contract, audit/privacy controls, and isolated LOCAL/TEST coverage for
duplicates, concurrency, crashes, UNKNOWN, mismatches, late evidence, and
wallet/withdrawal interactions. Provider selection/credentials, production
connectivity, real money movement, deployment, and production data are excluded.
Do not start Wave 35 from this contract alone while blocking source-of-truth
decisions remain unresolved.

## 11. Owner/Commander decisions required

1. **Authoritative completion source:** what exact authenticated provider result
   or independently verified evidence qualifies as completed refund, and who
   owns verification? This is the blocking decision; current repository cannot
   answer it.
2. **Refund policy:** full-only or partial refunds; exact treatment of fees,
   currency conversion, and mismatches.
3. **Authorization:** separate requester/reviewer/executor capabilities and
   whether maker-checker is mandatory; role mapping.
4. **Clawback policy:** how to handle already-paid commissions, referral reward
   spent or paid out, and in-flight/unknown withdrawals when safe reversal is
   impossible. Existing handler fails closed for insufficient wallet funds;
   this contract does not authorize debt or payout reversal.
5. **Evidence retention:** approved minimum evidence fields and retention/access
   period, excluding secrets and payment credentials.

## Verification and release boundary

Wave 34 is documentation-only. Required before close: `git diff --check`,
secret/sensitive-file review, commit and non-force push to `hami2test/main`,
then verify commit SHA, push result, clean working tree, and document presence.
No runtime test is represented as newly run by this contract. Production remains
LOCKED / NO-GO.
