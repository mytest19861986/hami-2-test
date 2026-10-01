# FW-02-R-WAVE-WALLET-REPORTING-CONTRACT-DESIGN-25

## Status and Boundary

این سند Design Gate برای Wallet Reporting است. هیچ تغییر در wallet logic، balance calculation، financial calculation، API، dashboard، schema، migration یا production انجام نمی‌دهد.

## Current Wallet Contracts

### Self-scoped read contracts

- `GET /api/v1/users/me/wallet` returns the current user's wallet projection: wallet id, wallet currency, signed balance and transaction rows.
- `GET /api/v1/users/me/wallet/transactions` returns the current user's transaction rows.
- `GET /api/v1/users/me/wallet/withdrawals` returns the current user's withdrawal requests.
- Customer dashboard and representative summary expose only their permitted self-scoped balance/readiness projections.

The current backend calculates wallet balance as the signed sum of wallet transaction amounts. Frontend must not recompute or reinterpret that value.

### Ledger fields observed in current projection

`id`, `type`, `amount`, `currency`, reference fields and `createdAt` are present in the current wallet transaction projection. Amounts are serialized integer minor units. The UI formats them only for display.

## Balance Semantics

| Concept | Current contract | Reporting decision |
|---|---|---|
| Ledger balance | signed sum of wallet transactions for wallet currency | authoritative backend value; do not recalculate in UI |
| Available balance | not separately named in wallet GET response | do not claim as a distinct KPI without explicit backend definition |
| Reserved/pending balance | represented through domain transaction/withdrawal behavior, not a separate read field | expose only if backend contract names it; never infer from rows in UI |
| Released amount | represented by release transaction types where applicable | event rows may be displayed; no derived total without contract |
| Currency | wallet has a currency; transactions carry currency | one currency context per balance; mixed currencies fail closed |
| Negative balance | possible as signed ledger result depending on domain state | display backend value; do not clamp or relabel |

### Required future contract rule

If a future report needs `available_balance`, `reserved_balance` or `released_amount`, the backend must define each from an authoritative transaction/state rule. Similar-sounding UI labels are not sufficient.

## Transaction Reporting Semantics

### Event vs current state

- A wallet transaction is an immutable ledger event, identified by its type, amount, currency, reference and creation time.
- A withdrawal request is a current/lifecycle state and must not be treated as a ledger credit/debit merely because it has an amount.
- Reservation and release transactions can correspond to a withdrawal lifecycle; a report must define whether it shows raw events, net ledger movement, or current open withdrawals.
- A single report must not sum both raw reservation events and withdrawal request amounts as if they were independent financial movements.

### Grouping proposal (design only)

For a future read-only transaction report, grouping may be by:

- `type` for operational event counts and signed sums;
- currency, always separated;
- bounded time window using transaction `createdAt`;
- optional reference type for traceability, only when safe projection allows it.

No grouping endpoint is implemented by this document.

### Pagination proposal

Future customer transaction reads should use stable cursor pagination ordered by `(createdAt DESC, id DESC)`. A fixed `take` without a continuation contract is suitable only for bounded dashboard snapshots, not full history. Admin aggregates must be bounded and rate-limited.

## Proposed Read-only API (Design Only)

### Customer history contract

Existing endpoint remains authoritative: `GET /users/me/wallet/transactions`.

Future pagination extension could return:

```text
{
  items: [{ id, type, amountMinor, currencyCode, reference, createdAt }],
  nextCursor: string | null,
  currencyCode: string
}
```

This is a proposal only; the current array contract must not be silently changed.

### Admin operational aggregate

Candidate endpoint: `GET /api/v1/reports/admin/wallet`.

Candidate query: explicit `currency`, bounded `from/to`, optional `groupBy=type`, and bounded pagination for event samples.

Candidate response:

```text
{
  surface: "admin",
  generatedAt: ISO-8601,
  currencyCode: "IRR",
  period: { from, to },
  ledger: {
    transactionCount,
    signedAmountMinor,
    byType: [{ type, count, signedAmountMinor }]
  },
  withdrawals: {
    openCount,
    byStatus: [{ status, count }]
  }
}
```

This proposal intentionally does not call the signed ledger sum “available balance” unless the backend contract proves that equivalence. `openCount` is a state count, not a monetary total.

## Admin vs Customer Boundary

| Data | Customer | Representative | Admin |
|---|---|---|---|
| Own balance | allowed, current endpoint | own readiness only where existing summary allows | future aggregate only, explicit permission |
| Own transaction rows | allowed | not a general cross-customer view | no raw rows by default |
| Own withdrawal states | allowed | own pending readiness | operational list under existing permission |
| Other users' wallet IDs | forbidden | forbidden | not needed for aggregate |
| Beneficiary/destination snapshot | forbidden in report | forbidden | forbidden by default |
| National ID/phone | forbidden in wallet report | forbidden | not part of aggregate |
| Cross-currency sum | forbidden | forbidden | forbidden; partition or reject |

## KPI Matrix

| KPI | Source authority | Consumer | Calculation owner | Current state | Contract rule |
|---|---|---|---|---|---|
| Customer ledger balance | wallet transaction ledger | current customer | backend wallet | EXISTING | use backend value and wallet currency |
| Customer transaction count | transaction rows | current customer | backend/read projection | EXISTING rows | count only returned/paginated set unless named total |
| Signed amount by type | wallet ledger | future Admin | backend wallet/reporting | PROPOSED | signed minor units, one currency |
| Open withdrawal count | withdrawal requests | Admin/representative scoped | withdrawal backend | EXISTING operational data | status set must be explicit |
| Available balance | no distinct field | none | undefined | UNDEFINED | do not infer |
| Reserved balance | no distinct report field | none | undefined | UNDEFINED | do not infer |
| Released amount | event types exist, aggregate semantics absent | none | undefined | UNDEFINED | do not infer |
| Wallet utilization | no approved formula | none | undefined | MISSING CONTRACT | do not create |

## Financial Safety Rules

1. Backend ledger remains the sole financial authority.
2. Frontend cannot sum, convert, net, clamp or forecast monetary values.
3. Reservation/release events must be modeled separately from withdrawal current state.
4. Currency is mandatory on every monetary result; mixed currencies are partitioned or rejected.
5. A read-only report cannot trigger withdrawal, payout, commission, refund or wallet mutation.
6. Idempotency and payout semantics remain in existing domain code and are outside reporting.

## Risks and Open Decisions

| Risk | Failure mode | Required gate |
|---|---|---|
| Calling ledger sum “available” | user/admin misreads spendable funds | define availability with backend state contract |
| Double counting reservation/release | inflated debit/credit totals | explicit event inclusion and netting rule |
| Currency mixing | invalid financial KPI | currency filter/buckets and fail-closed behavior |
| Raw ledger exposure | privacy and operational leakage | aggregate default, allow-list fields |
| Unbounded history | performance and data leakage | cursor pagination and bounded limits |
| Status/event conflation | current withdrawal state treated as money | separate state and ledger sections |
| Reusing broad Admin permission | excessive access | explicit capability decision |

## Recommendation

Keep current customer wallet history unchanged. Before any Admin wallet reporting implementation, approve a narrow read-only contract that defines currency, period, event inclusion, reservation/release treatment and permission. Do not expose `available_balance` or any utilization KPI until the backend defines it.

## Verification

- Current wallet source and consumers: inventoried.
- Ledger/source authority: defined.
- Balance, transaction, Admin and privacy boundaries: defined.
- API proposal: design only.
- Implementation: NONE.
- Wallet/financial/API/schema/migration/dashboard: UNCHANGED.
- `git diff --check`: required after this documentation-only change.
- Production: NONE / LOCKED / NO-GO.
