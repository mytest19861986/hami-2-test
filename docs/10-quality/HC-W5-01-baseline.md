# HC-W5-01 Baseline

Date: 2026-09-27
Phase: BASELINE / SCHEMA DESIGN

## Verified Wave 4 baseline

- Prisma schema currently contains the identity/RBAC, provider, benefit plan, purchase, membership and eligibility domains.
- Latest migration directory is `0015_purchase_validity_snapshot`.
- Payment confirmation uses a transaction, conditional pending-to-paid claim, and the unique purchase-to-membership relation.
- Refund uses a transaction, changes the purchase to `REFUNDED`, and cancels the active membership without deleting history.
- Audit infrastructure is centralized through the existing `audit` helper and stores actor/action/entity only.
- RBAC is seeded idempotently through `seedRbac`; permission checks require an active authenticated user and an exact resource/action permission.
- Current tests cover auth, providers, benefits, eligibility, and the Wave 4 HTTP payment-race evidence.
- Docker API, Prisma validation, lint, typecheck, and tests were green before Wave 5 schema work.

## Locked architecture boundaries

1. Referral Reward != Sales Commission.
2. Wallet Ledger != mutable balance.
3. Refund/Reversal != deletion of historical financial records.

## Financial invariants

- Duplicate payment confirmation must never duplicate a referral reward.
- Duplicate payment confirmation must never duplicate a commission.
- Concurrent withdrawals must never overspend the ledger balance.
- Refunds append compensating reversal entries while preserving historical transactions.

## Current Wave 5 status

Wave 5: ACTIVE  
Task: HC-W5-01  
Phase: BASELINE / SCHEMA DESIGN  
Blockers: NONE
