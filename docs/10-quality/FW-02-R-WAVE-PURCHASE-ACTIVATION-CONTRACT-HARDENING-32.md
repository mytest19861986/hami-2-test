# FW-02-R-WAVE-PURCHASE-ACTIVATION-CONTRACT-HARDENING-32

**Status:** Source inventory complete; target contract proposed/frozen for Wave 33 planning, subject to the explicit owner decision in §13.
**Type:** Product / business-critical decision gate
**Environment:** LOCAL / TEST ONLY
**Implementation in this wave:** None
**Production:** LOCKED / NO-GO

## 1. Scope and method

This is a source-grounded contract review, not an implementation. The review
inspected the current Prisma schema and migrations, benefit-domain transitions,
API handlers/routes, authorization seeding, purchase/membership/refund/commission
tests, and current Customer/Admin purchase pages. No API, UI, schema, migration,
financial behavior, or runtime data was changed in this wave.

Primary evidence:

- `packages/database/prisma/schema.prisma` — `PurchaseStatus`,
  `BenefitMembershipStatus`, `PlanPurchase`, `BenefitMembership`,
  `CommercialSettings`, `ReferralAttribution`, `WalletTransaction`, and
  `SalesCommission`.
- `apps/api/src/main.mjs` — `BenefitController.purchase/confirm/refund`,
  commercial settings handlers, commission handlers, route decorators, and
  RBAC seed list.
- `apps/api/src/benefit-domain.mjs` — current state transition map.
- `apps/api/test/benefit-flow.integration.test.mjs` — real HTTP flow, role
  guards, replay, concurrent confirmation, snapshots, membership creation.
- `apps/api/test/rewards-financial.integration.test.mjs` and
  `apps/api/test/commission-summary.integration.test.mjs` — payment-linked
  reward and commission evidence.
- `apps/web/pages/plans/[id].jsx`, `apps/web/pages/purchases/index.jsx`,
  `apps/web/pages/purchases/[id].jsx`, and `apps/web/pages/admin/purchases.jsx`
  — current UI behavior.
- Migrations `0012_benefit_plan`, `0014_purchase_membership`,
  `0015_purchase_validity_snapshot`, and `0016_referral_wallet_commission_core`.

## 2. Current lifecycle inventory — verified

### Purchase creation and payment

1. Customer `POST /api/v1/users/me/purchases` supplies a `planId`. The API
   requires an authenticated user and an `ACTIVE` plan, then snapshots
   `priceAmount`, `currency`, and `validityDays` into `PlanPurchase` with status
   `PENDING_PAYMENT`; it emits `PURCHASE_CREATED`.
2. Current purchase statuses are exactly `PENDING_PAYMENT`, `PAID`, `CANCELLED`,
   and `REFUNDED`. `paidAt` and optional globally-unique `paymentReference`
   exist. No provider event ID, approval timestamp, approval actor, activation
   mode, or payment-evidence source is stored.
3. `POST /api/v1/admin/purchases/:id/confirm-payment` requires
   `purchases.confirm_payment`. There is no payment-provider callback in this
   repository. The endpoint accepts an optional `paymentReference`; its
   successful call is therefore an authorized internal assertion that payment
   is confirmed, not evidence of provider settlement by itself.
4. In one database transaction, the handler conditionally changes
   `PENDING_PAYMENT` to `PAID`, sets `paidAt`, and creates a `BenefitMembership`
   already `ACTIVE`, with `startsAt=now` and `endsAt=now + validityDaysSnapshot`.
   The membership’s `purchaseId` is unique. Thus payment confirmation,
   administrative confirmation, and entitlement activation are currently
   coupled in one action.
5. On a replay where the purchase is already `PAID`, the handler returns its
   existing membership (or creates an `ACTIVE` membership if one is missing).
   The missing-membership repair branch does not replay the payment-linked
   reward/commission work. Every invocation writes `PAYMENT_CONFIRMED` after
   the transaction, including replay; the current generic `AuditLog` has no
   entity ID or idempotency key.
6. The compare-and-set update plus unique `BenefitMembership.purchaseId`
   protects normal concurrent confirmation. The integration test races two
   confirmation requests and verifies one membership and a `PAID` purchase.
   `paymentReference` uniqueness is a secondary guard; the handler does not
   compare a replay’s supplied reference to the stored reference.

### Membership and eligibility

- Membership statuses are `PENDING`, `ACTIVE`, `EXPIRED`, and `CANCELLED`; the
  model defaults to `PENDING`, but the current payment-confirmation flow writes
  `ACTIVE` directly. No approval/rejection endpoint or membership-write
  endpoint exists.
- Current domain transitions permit `PENDING -> ACTIVE` and
  `ACTIVE -> EXPIRED | CANCELLED`. There is no pending-denial transition.
- Eligibility requires an `ACTIVE` user, an `APPROVED` provider, an `ACTIVE`
  membership within its validity window, an `ACTIVE` plan, and an active
  provider benefit. Consequently a paid membership does not guarantee current
  redeemability if the plan is later disabled.
- Confirmation loads the plan but does not verify its current status or the
  customer’s current status before creating/activating the membership.

### Financial side effects — existing behavior to preserve

Within the payment-confirmation transaction:

- An eligible referral can produce one `REFERRAL_REWARD` wallet transaction,
  keyed by `REFERRAL_REWARD:<attributionId>`, and mark its attribution
  `REWARDED` with the qualifying purchase.
- A qualifying sales attribution/rule can produce one `SalesCommission` per
  purchase (unique `purchaseId`). It is created at payment confirmation, with
  status determined by `CommercialSettings.autoApproveCommissionAfterPayment`
  (`APPROVED` or `PENDING_APPROVAL`).
- Commission approval/rejection is a separate action protected by
  `commissions.approve` / `commissions.reject`; refund reverses eligible
  commissions and reverses an earned referral reward subject to wallet-funds
  safety checks.
- These financial rules are tied to confirmed payment, not membership approval.
  Wave 32 must not move, recalculate, duplicate, or otherwise alter them.
- `autoApproveCommissionAfterPayment` is not purchase auto-activation. It must
  not be renamed, repurposed, or used as the new activation switch.

### Refund and audit limits

- `POST /api/v1/admin/purchases/:id/refund` requires `purchases.refund`. It
  changes `PAID -> REFUNDED`; if an existing membership is `ACTIVE`, it changes
  it to `CANCELLED`. A `PENDING` membership is not currently cancelled by this
  handler.
- This repository has no payment-provider integration or provider refund
  evidence. The endpoint’s `REFUNDED` value is an internal state mutation and
  must not be represented as independently verified external money movement.
- Domain audit actions include `PURCHASE_CREATED`, `PAYMENT_CONFIRMED`,
  `PURCHASE_REFUNDED`, `MEMBERSHIP_CANCELLED`, and
  `COMMERCIAL_SETTINGS_UPDATED`. The current audit model records actor/action/
  entity/time, but not entity ID, before/after values, reason, request ID, or
  idempotency key. This is insufficient provenance for a high-stakes manual
  approval decision without a Wave 33 audit enhancement.

### Current authorization and UI

| Operation | Current permission / behavior |
|---|---|
| Customer plan purchase | authenticated user; no separate purchase-create capability |
| Read own purchases/memberships | authenticated user; scoped to self |
| Admin read purchases | `purchases.read` |
| Admin assert payment confirmed | `purchases.confirm_payment` |
| Admin refund | `purchases.refund` |
| Admin read memberships | `memberships.read` |
| Approve/reject membership | no capability or endpoint exists |
| Change commercial settings | `commercial_settings.manage`; read uses `commercial_settings.read` |

Customer plan details create the pending-payment record and navigate to a
read-only payment-result page. Customer purchase history/result pages are
read-only. The Admin purchases page is read-only; no Admin payment or membership
decision control exists in the current UI. Do not claim a manual approval UI is
already implemented.

## 3. Target lifecycle contract for Wave 33

Keep payment truth and benefit entitlement as separate concepts without
introducing a fictitious payment state:

```text
PlanPurchase (payment fact): PENDING_PAYMENT -> PAID -> REFUNDED
                                            \-> CANCELLED (only before PAID)

BenefitMembership (entitlement): [created only after PAID]
  Auto-activation OFF (default): PENDING -> ACTIVE (authorized approval)
                                        \-> REJECTED (authorized denial)
  Auto-activation ON:             ACTIVE only after all activation guards pass
  ACTIVE -> EXPIRED | CANCELLED remains unchanged
```

`PAID` means the configured authorized payment-confirmation process recorded
payment. It does not mean an administrator approved benefit access. A paid,
pending membership grants no eligibility. Rejection must never silently mark a
purchase unpaid or activate entitlement. `REJECTED` is justified because the
existing four membership states cannot distinguish a denied paid entitlement
from an expired or refunded/cancelled one. A later confirmed refund may move
the purchase to `REFUNDED` and the rejected/pending membership to
`CANCELLED`; until a supported refund is evidenced, preserve the payment fact
and surface the case for reconciliation.

### Manual activation (default)

- `AUTO_ACTIVATION` is OFF unless an authorized operator explicitly changes
  the persisted global setting.
- After payment confirmation, create exactly one `PENDING` membership. Do not
  grant eligibility or start the validity clock while it is pending.
- An authorized membership approver may transition only `PENDING -> ACTIVE`.
  Set `startsAt` to the activation decision time and `endsAt` from the
  purchase’s immutable `validityDaysSnapshot`; do not recalculate the price,
  currency, or validity from a mutable plan.
- A denial transitions `PENDING -> REJECTED`, grants no entitlement, records a
  fixed reason code, and raises/retains a refund/reconciliation work item.
  Do not automatically call an unconfigured provider or claim an external
  refund. Final money-return semantics require the owner decision in §13.

### Auto-activation

- Store `autoActivatePaidPurchases` as a distinct, global
  `CommercialSettings` setting. Global scope is the recommended fit for the
  existing commercial-settings domain; plan-level overrides are not evidenced
  and are out of scope unless the owner chooses otherwise.
- Persist the setting with database default `false`. `commercial_settings.manage`
  controls changes; `commercial_settings.read` controls visibility. Record
  actor, old/new value, timestamp, and request/correlation reference on change.
- Evaluate the flag exactly once in the same transaction that claims payment;
  persist the selected mode on the purchase/membership for replay and audit.
  Changes apply only to payment confirmations whose decision transaction
  observes the committed new setting. A setting change does not retroactively
  activate an old pending membership or deactivate an existing membership.
- Automatic activation is permitted only when payment is authoritatively
  confirmed, purchase is still actionable, the user is `ACTIVE`, and the plan
  remains `ACTIVE`. If any guard fails, preserve the `PAID` fact, do not grant
  access, and send the case to a manual/reconciliation queue. Do not invent a
  refund or mutate commission/referral outcomes.

## 4. Configuration ownership and permissions

Recommended ownership is the existing global `CommercialSettings` record,
managed through the commercial-settings domain. The schema has no explicit
singleton constraint, though current code reads the oldest `findFirst()` row;
Wave 33 must make configuration selection deterministic and prevent divergent
rows before relying on a global safety switch.

| Capability | Wave 33 contract |
|---|---|
| Confirm payment | Existing `purchases.confirm_payment`; does not imply membership approval |
| Approve membership | New least-privilege `memberships.approve` capability |
| Reject membership | New least-privilege `memberships.reject` capability |
| Read membership queue | Existing `memberships.read` |
| Change auto-activation | Existing `commercial_settings.manage` |
| Read auto-activation | Existing `commercial_settings.read` |
| Refund/reconcile | Existing `purchases.refund` only for its documented internal transition; external refund proof remains absent |

No wildcard grant or implicit role assignment is authorized by this contract.
Wave 33 must document explicit role-to-capability grants and verify that
non-admin/support/compliance roles remain least-privileged. The current seed
grants all seeded permissions to `SUPER_ADMIN`; this does not establish a
dedicated approver role or maker-checker separation. Whether the payment
confirmer and membership approver must be different people is an owner decision,
not a current system guarantee.

## 5. Concurrency, idempotency, and transaction boundary

1. Payment claim, purchase state, the one membership decision record, and
   payment-triggered referral/commission side effects remain atomic.
2. Duplicate provider events must be deduplicated by a stable provider event
   identity (or a contractually equivalent payment idempotency key), and a
   repeated reference must be compared with the first accepted purchase and
   amount/currency. A mismatched replay is a conflict/discrepancy, never silent
   success. No provider is selected in this wave.
3. Approval/rejection uses a conditional update from `PENDING`; exactly one
   concurrent decision wins. A replay of the same decision returns the stable
   recorded result without extending dates, repeating side effects, or adding a
   second decision audit event. A contradictory second decision is rejected.
4. The unique membership-per-purchase, commission-per-purchase,
   referral-qualification, and wallet idempotency-key constraints remain
   backstops. No duplicate membership, reward, commission, or wallet mutation
   may be created by callback retries or approval replay.
5. Configuration observation and the saved activation-mode snapshot must be
   part of the payment-claim transaction. Lock/serialization behavior must make
   concurrent setting changes deterministic; do not make activation decisions
   from a client cache.
6. Domain decision audit should be written transactionally with the state
   transition (or through a transactional outbox with an idempotent consumer).
   It must identify purchase/membership, actor, decision, old/new state,
   reason code, applied mode, timestamp, and request/correlation ID, while
   excluding credentials and payment secrets.

## 6. Financial boundary — frozen

- Payment-confirmed remains the existing trigger for referral reward
  qualification and sales-commission creation. Membership approval is not a
  new earning trigger.
- `autoApproveCommissionAfterPayment` continues to control only commission
  status. Commission approve/reject remains separate from membership decision.
- On a later internal refund, preserve existing referral-reversal safety and
  commission-reversal semantics, while ensuring every non-active entitlement
  is also closed consistently. A failed/unknown refund must not claim reversal
  or release/erase the original payment fact.
- No new balance arithmetic, fee, payout, commission formula, or money-moving
  action is authorized. Values remain server-owned integer minor units and
  immutable snapshots.

## 7. Failure matrix

HTTP outcomes below are target Wave 33 behavior, not claims about the current
endpoint response in every case.

| Scenario | Target HTTP/domain result | Audit | Financial/access effect |
|---|---|---|---|
| Payment confirmed; manual approval pending | `200/201`, purchase `PAID`, membership `PENDING` | payment confirmed + mode recorded | Existing payment-triggered effects once; no eligibility |
| Payment confirmed; auto mode and guards pass | `200`, purchase `PAID`, membership `ACTIVE` | payment + auto-activation decision | Existing payment effects once; entitlement starts at decision time |
| Approval rejected | `200` decision accepted, membership `REJECTED` | actor, fixed reason, purchase/membership IDs | No access; retain paid fact; reconciliation/refund path required; no speculative reversal |
| Approval still pending | read returns `PENDING`; duplicate reads are harmless | no repeated decision event | No access; no repeated payment side effects |
| Duplicate/replayed payment event, same identity and semantics | stable success/replay response | one logical payment/decision event | No duplicate membership, reward, commission, or wallet mutation |
| Duplicate key/reference with different purchase, amount, currency, or semantics | `409` conflict/discrepancy | discrepancy event with safe references | Freeze; no second mutation/access grant |
| Duplicate approval with same decision | stable success or explicit `409 ALREADY_DECIDED` (choose one API convention) | no second decision event | No date extension or duplicate effect |
| Contradictory approval after a terminal decision / already active | `409` non-actionable | rejected attempt may be security-audited | Existing membership unchanged |
| Plan becomes inactive before approval/auto check | payment remains `PAID`; activation held for review | guard failure reason | No eligibility; no automatic refund/reversal |
| Customer becomes disabled before approval/auto check | payment remains `PAID`; activation held | guard failure reason | No access; no automatic refund |
| Auto setting toggled during payment processing | transaction’s persisted applied-mode snapshot wins | config change and decision events linked | No retroactive status switch; no duplicate side effects |
| Refund with pending/rejected/active membership | require authorized supported refund result; close entitlement atomically | refund evidence and membership closure | Reverse existing linked effects once; no external refund claim without evidence |
| Missing/invalid permission or unauthenticated actor | existing 401/403 boundary | denied access event per existing policy | No state or financial mutation |

## 8. Migration impact — known, not performed

Schema work is required before the proposed contract can be implemented safely;
Wave 32 creates no migration. Wave 33 planning should include:

- Add `CommercialSettings.autoActivatePaidPurchases BOOLEAN NOT NULL DEFAULT
  false`; deterministically enforce the intended global settings record.
- Add an activation-mode snapshot (`MANUAL` / `AUTO`) to the purchase decision
  record so retries and later setting changes cannot reinterpret history.
- Add membership decision provenance (`approvedAt/by`, `rejectedAt/by`, and a
  constrained reason code) and a `REJECTED` membership status/transition.
- Extend refund handling so `PENDING`/`REJECTED` memberships cannot remain open
  after a confirmed refund; keep this atomic with the purchase refund transition.
- Add an auditable target reference and idempotency/correlation metadata to
  domain decision events (or implement a transactional outbox) without storing
  secrets.
- Add stable provider-event/idempotency identity and semantic mismatch checks
  only when an approved payment evidence source is specified. Do not connect a
  vendor or add credentials in Wave 32.
- Backfill existing rows as legacy decisions without changing their status,
  dates, financial side effects, or entitlement. New global setting defaults
  OFF. Verify upgrade and fresh-install paths; no retroactive activation.

Before any migration, Wave 33 must inspect existing production-free LOCAL/TEST
data for duplicate `CommercialSettings` rows and malformed paid purchases; no
data cleanup is authorized by this document.

## 9. Wave 33 implementation plan (not executed)

1. **Sprint 0 / owner gate:** settle §13 refund/rejection and separation-of-duty
   decisions; identify the authorized payment-confirmation evidence source;
   freeze API response/error semantics and role grants. Production remains
   prohibited.
2. **Data-contract migration:** additive migration for settings default OFF,
   decision snapshot/provenance/status, audit reference/idempotency; preserve
   existing rows. Test fresh and upgrade paths, constraints, and rollback plan.
3. **Domain/API:** conditional and idempotent payment claim; pending manual
   membership; separately authorized approve/reject; guarded auto activation;
   deterministic setting snapshot; safe refund reconciliation; domain audit.
4. **Admin UI:** permission-gated pending-review queue and decision detail with
   immutable amount/currency/validity snapshots, safe payment evidence
   reference, fixed rejection reasons, explicit confirmation, and accessible
   RTL states. Customer UI shows paid/pending-approval/active/rejected/refund
   status from server only.
5. **Verification:** replay, contradictory-reference, double-approval,
   concurrent setting toggle, plan/user disable, refund, duplicate side-effect,
   role/permission, audit, migration, and no-client-financial-math tests. Only
   local/test fixtures; no vendor, SMS, real payment, or production.

## 10. Acceptance criteria for Wave 32 / handoff readiness

- Current lifecycle and all claims above are traced to current source/tests.
- Payment and approval are explicitly distinguished; any current conflation is
  named, not disguised as existing manual approval.
- Manual default is OFF for auto-activation; the commission auto-approval flag
  remains separate.
- Activation configuration owner, scope, source of truth, default, permission,
  and audit are defined as recommendations; lack of current implementation is
  explicit.
- Permission gaps, races/replays, financial timing, refund limitations,
  failure states, and migration requirements are explicit.
- Wave 33 scope is constrained to implementing the frozen contract after owner
  decisions, with no production/vendor/real-money authorization.
- No code, UI, API, schema, migration, or runtime data changed in Wave 32.

## 11. Source-backed gaps / risks

1. **Material lifecycle conflation:** the current admin payment-confirmation
   action simultaneously marks `PAID` and creates an `ACTIVE` membership.
2. **No independent activation policy:** no auto-activation setting or
   membership decision permission/endpoint exists. The existing commission
   auto-approval setting is semantically unrelated.
3. **Refund ambiguity:** internal `REFUNDED` does not prove external money
   returned; pending membership is not closed by current refund handler.
4. **Replay mismatch:** already-PAID replay does not compare a newly submitted
   payment reference with the stored reference; an absent membership can be
   repaired as ACTIVE without replaying payment-linked side effects.
5. **Insufficient decision provenance:** current generic audit entries cannot
   identify a purchase/membership target or record the decision mode/reason.
6. **Operational guards:** current confirm logic does not re-check user/plan
   status at activation time; a disabled plan can also make an active membership
   ineligible later.
7. **No purchase idempotency at creation:** retrying customer purchase creation
   can create multiple distinct pending purchases; Wave 33 should decide whether
   client intent needs an idempotency key without merging separate intentional
   purchases.

## 12. Open contract decisions

The recommendations in this document are safe planning defaults, not evidence
that the current product or code already implements them:

- Global auto-activation setting in `CommercialSettings`, default OFF; no
  plan-specific override.
- Payment-triggered commission/referral semantics remain unchanged, regardless
  of whether access is pending.
- Disabled customer/plan means no activation and a review queue; never silently
  rewrite `PAID` or automatically refund.
- Rejection must deny access and retain the payment fact until an authorized
  refund/reconciliation result is recorded.
- Automatic mode applies only at the atomic payment-confirmation decision;
  toggles do not retroactively activate or deactivate existing memberships.

## 13. Commander decision required before Wave 33

The current repository cannot establish the business outcome for a paid
purchase whose membership approval is rejected, and it has no verified external
refund mechanism. Please choose/authorize one policy before implementation:

**Recommended:** keep the purchase `PAID`, mark membership `REJECTED`, deny all
benefits, and open a refund/reconciliation case; only transition to `REFUNDED`
and reverse linked financial effects after an authorized refund result is
recorded. If no external provider is integrated, the permitted local/test
operator attestation and evidence required for that result must be specified.

Also decide whether the same Admin may both confirm payment and approve the
membership, or whether maker-checker separation is required. Current code does
not enforce separation.

## 14. Wave 32 closure record

- Source inventory and contract analysis: complete.
- Implementation/schema/API/UI changes: none (hard lock honored).
- Tests: existing tests inspected as evidence; no test suite altered or claimed
  as newly run for this documentation-only wave.
- `git diff --check`, commit, push, and final working-tree evidence: record at
  closure after review.
- Production: NONE / LOCKED / NO-GO.
