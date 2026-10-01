# FW-02-R-WAVE-ELIGIBILITY-WALLET-REPORTING-DESIGN-23

## Status and Boundary

این سند فقط Design Gate برای دو gap گزارش‌دهی است: Eligibility Aggregate و Wallet Aggregate. هیچ API، dashboard، schema، migration، wallet logic یا financial calculation در این Wave تغییر نکرده است.

## Current Contract Inventory

### Eligibility

Existing read contracts:

- `GET /api/v1/providers/:providerId/eligibility` — self-scoped eligibility check for the authenticated user.
- `POST /api/v1/providers/:providerId/eligibility/check` — provider/customer operational check with normalized national-id proof; not an aggregate report.

The eligibility service evaluates active user/provider status, active membership validity (`startsAt <= now < endsAt`), paid purchase state and active provider benefits. A positive result contains `eligible` and safe benefit projections including membership/plan/provider references, plan name, discount fields and validity. A negative result does not expose private explanation details.

There is no current Admin aggregate endpoint for counts such as eligible customers by provider, eligibility checks over time, or benefit utilization. Such metrics must not be inferred by the Frontend from individual checks.

### Wallet

Existing read contracts:

- `GET /api/v1/users/me/wallet` — current user's wallet projection: wallet id, currency, signed ledger balance and transaction rows.
- `GET /api/v1/users/me/wallet/transactions` — current user's transaction rows.
- `GET /api/v1/users/me/wallet/withdrawals` — current user's withdrawal requests.
- Dashboard summaries expose self-scoped wallet balance/readiness where applicable.

The wallet balance is the signed sum of `WalletTransaction.amount` for the wallet currency. Transactions carry type, amount, currency, reference fields and created time. Withdrawal reservation/release behavior is owned by backend transaction logic. There is no current Admin wallet aggregate contract.

## Eligibility Reporting Contract Design

### Candidate use cases

| Use case | Consumer | Decision |
|---|---|---|
| Customer/provider point-in-time check | current user/provider workflow | Already covered by existing contracts; not a new report |
| Admin eligible-customer count by provider | authorized Admin | Candidate aggregate; needs explicit privacy and capability approval |
| Eligibility check audit volume | Compliance/Admin | Candidate operational report; must use audit/event source, not infer from current eligibility |
| Benefit utilization | Product/operations | Not defined by current contract; defer until redemption/eligibility relationship is specified |

### Proposed aggregate (design only)

Candidate endpoint: `GET /api/v1/reports/admin/eligibility`.

Possible query dimensions: approved `providerId`, bounded period and pagination for a bounded event list. A response could contain:

```text
{
  surface: "admin",
  generatedAt: ISO-8601,
  period: { from, to },
  byProvider: [{ providerId, eligibleCheckCount, positiveCount }],
  totals: { eligibleCheckCount, positiveCount }
}
```

This is only a proposal. `positiveCount` must be defined as positive check events, not unique eligible customers, unless the data model and privacy review explicitly support deduplication. No member names, national IDs, phone numbers, membership IDs or benefit details should be returned in an Admin aggregate.

### Ownership and semantics

- Source owner: backend eligibility service plus an approved event/audit source.
- Calculation owner: backend only.
- Allowed consumer: explicitly authorized Admin/Compliance; never public discovery.
- Refresh: request-time snapshot with `generatedAt`.
- Period: event `createdAt` for check volume; current-state eligibility is not a historical event metric.
- Privacy: aggregate by default; provider-level breakdown only where operationally necessary.
- Failure mode: if event source or period semantics are unavailable, return no metric rather than estimate.

## Wallet Reporting Contract Design

### Candidate use cases

| Use case | Consumer | Decision |
|---|---|---|
| Customer balance and transaction history | current customer | Already covered by existing self-scoped wallet contracts |
| Representative withdrawal readiness | current representative | Existing summary covers self-scoped readiness; preserve it |
| Admin wallet operational overview | authorized Admin | Candidate, but must not expose customer-level ledger data by default |
| Wallet transaction trend | Admin/Product | Requires explicit period, currency and retention semantics; defer |

### Proposed admin aggregate (design only)

Candidate endpoint: `GET /api/v1/reports/admin/wallet`.

Possible response shape:

```text
{
  surface: "admin",
  generatedAt: ISO-8601,
  period: { from, to },
  currency: "IRR",
  totals: {
    walletCount,
    transactionCount,
    creditsMinor,
    debitsMinor,
    openWithdrawalCount
  },
  byType: [{ type, count, amountMinor }]
}
```

This is only a proposal and must not be implemented without a capability and privacy decision. `creditsMinor`/`debitsMinor` must be defined from signed ledger rows and never mixed across currencies. Withdrawal reservation/release rows require explicit inclusion rules to avoid double counting.

### Customer contract rules

- Customer may see only their own wallet and transaction rows.
- Balance is backend authoritative and must remain integer minor units plus currency.
- Frontend must not sum, convert, net, or reinterpret financial rows.
- Transaction type labels are presentation only; they do not change ledger meaning.
- References may be shown only if the existing safe projection allows them; no beneficiary snapshot or private audit data.

### Admin contract rules

- Default response is aggregate-only; no user IDs, phone numbers, national IDs, beneficiary data or raw ledger references.
- A currency filter or separate per-currency buckets is mandatory.
- Period semantics must identify whether `createdAt`, settlement time or current state is used.
- Open withdrawal counts must use explicit status membership and must not imply payout completion.
- No report read may trigger payout, withdrawal, commission or wallet mutation.

## KPI Matrix

| KPI | Current source | Current consumer | Proposed owner | Contract state | Privacy |
|---|---|---|---|---|---|
| Point-in-time eligibility | eligibility service | provider detail/customer flow | eligibility backend | EXISTING, not aggregate | self-scoped |
| Positive eligibility checks | no aggregate event report | none | eligibility/compliance backend | PROPOSED | Admin aggregate only |
| Eligible unique customers | no safe dedup contract | none | product/data decision required | UNDEFINED | do not infer |
| Customer wallet balance | wallet ledger | dashboard/wallet | wallet backend | EXISTING self-scoped | owner only |
| Customer transaction count | wallet transaction rows | wallet history | wallet backend | EXISTING rows; aggregate semantics absent | owner only |
| Admin wallet credits/debits | wallet ledger | none | wallet backend | PROPOSED | aggregate only, currency scoped |
| Open withdrawals | withdrawal requests | customer/rep/admin operations | withdrawal backend | EXISTING operational lists | scoped/aggregate |
| Benefit utilization | no single authoritative report contract | none | product/domain decision | UNDEFINED | do not infer from eligibility |

## Permission Impact

- Existing self-scoped contracts retain current session ownership checks.
- Future Admin eligibility/wallet reports require explicit capability selection and least-privilege review.
- Reusing broad `users.read` is not automatically approved for financial or eligibility aggregates.
- No new permission is created in this Wave.

## Risks

| Risk | Why it matters | Required control |
|---|---|---|
| Eligibility check vs eligible customer confusion | event volume can be mistaken for unique users | name KPI precisely and define dedup source |
| Wallet double counting | reservation/release rows can look like independent economic movement | define ledger event inclusion and sign semantics |
| Mixed currencies | sums become meaningless | per-currency buckets or fail closed |
| Sensitive eligibility data | health/provider relationship is sensitive | aggregate, minimize fields and authorize explicitly |
| Current-state period misuse | current eligibility/balance is not historical event data | use event timestamps or label snapshot clearly |
| Admin overexposure | raw ledger/identity data leaks | aggregate-only default and allow-list |
| Client-side inference | UI can fabricate authority | backend calculates all financial/eligibility metrics |

## Recommendation

Keep current self-scoped Eligibility and Wallet contracts unchanged. If reporting is still required, approve one narrow Admin contract first—recommended order: wallet operational aggregate only after currency and reservation semantics are ratified; eligibility event aggregate only after privacy and deduplication semantics are ratified. Do not implement either proposal from this design document alone.

## Verification

- Existing contracts: inventoried from API source and current consumers.
- Missing aggregate boundaries: documented without assumptions presented as facts.
- Read-only boundary: defined.
- Privacy and permission impact: reviewed.
- Implementation: NONE.
- API/dashboard/schema/migration/wallet/financial logic: UNCHANGED.
- `git diff --check`: required after this documentation-only change.
- Production: NONE / LOCKED / NO-GO.
