# FW-02-R — Backend Commission Summary Contract Design

## Status and Scope

`DESIGN/CONTRACT ONLY — IMPLEMENTATION NOT AUTHORIZED`

This document defines a proposed Representative Commission Summary read contract for architecture and security review. It does not create an endpoint, capability, schema, migration, read model, frontend change, or production behavior.

## 1. Decision Boundary

The contract exists to supply the already-authorized local/test frontend Commission Overview surface. It is a read-only, representative-scoped projection boundary.

The Commission Ledger remains the sole source of truth. The proposed response is a derived, non-authoritative read model and must never authorize, mutate, settle, calculate, reverse, claw back, or withdraw funds.

Out of scope:

- commission history or detail;
- `/entries/{id}` or any deep link;
- payout, withdrawal, reversal, clawback, adjustment, or other mutation;
- provider, executor, credential, production, or real-money activity;
- customer-level amounts or administrative views;
- schema or migration design in this package.

## 2. Endpoint Ownership

| Concern | Required owner | Current status |
|---|---|---|
| Financial semantics and approved fields | Financial Domain owner | Owner to be named |
| Ledger source of truth | `SalesCommission` is the current append-only commission-ledger record set in the Local/Test implementation; the representative summary is a read-only aggregate over those rows | `SalesCommission.amountSnapshot` and `currencySnapshot` are immutable snapshots for the commission entry; status transitions are the existing approval/reversal lifecycle |
| Projection/read model | Representative Read Model owner | Owner to be named |
| Capability registration and enforcement | Capability/Auth owner | Owner to be named |
| HTTP endpoint and service implementation | Backend Endpoint owner | Owner to be named |
| Contract/security decision | Architecture Decision owner | Commander/architecture owner decision required |
| Presentation consumer | Web surface | Existing frontend slot ready |

No owner is assigned by this document. Implementation cannot begin until the architecture decision owner confirms ownership and the implementation wave is separately authorized.

## 3. Proposed Contract Slot

**Method:** `GET`

**Path:** `/rep/commission/summary`

**Purpose:** Return the authenticated representative's Summary projection for the approved currency/context only.

**Capability:** `VIEW_COMMISSION_SUMMARY`

**Scope source:** authenticated session identity plus server-side representative ownership. No client-supplied `representativeId` or equivalent may widen scope.

**Authority:** read-only, derived projection; Ledger remains authoritative.

**Pagination:** not applicable to Summary.

**Caching:** any cache must preserve session/representative isolation and must not serve one representative's projection to another. Cache policy requires security review before implementation.

## 4. Authorization and State Contract

Authorization and field filtering must complete before response emission.

| Condition | Required response behavior |
|---|---|
| Valid session, ownership, capability, Summary available | `200` with approved DTO, or contracted zero/empty Summary |
| Missing/invalid capability or unauthorized scope | Generic `403` (`Generic403`), same rendering, no cause or existence disclosure |
| Non-authoritative read model/dependency unavailable | Contracted `Degraded` behavior; no stale or placeholder financial amount |
| Rate limiting | Distinct from `Degraded`; follow the platform's existing `429` behavior |
| Configuration/service error | Distinct error behavior; do not mislabel as `Degraded` |
| Malformed/unsupported request context | Existing platform error contract; no scope fallback |

The endpoint must not reveal whether another representative, customer, ledger entry, or hidden resource exists.

## 5. Proposed DTO and Allowlist

The exact wire envelope remains subject to architecture/security review. The data object may contain only these approved fields. Every monetary field carries its own server-provided `currency_code`; the consumer must never infer or hardcode currency.

```text
summary:
  pending_balance         // amount_minor + currency_code + frozen sign rule
  available_balance       // amount_minor + currency_code; server-clamped; frozen sign rule
  clawback_due            // amount_minor + currency_code + frozen sign rule
  lifetime_earned         // amount_minor + currency_code + frozen sign rule
  monthly/type aggregates // each aggregate amount carries currency_code and its frozen sign rule
  plan_label
```

### Currency identity and sign contract

- Summary identity is `(representative, currency_code)`; V1 returns one currency context per Summary response.
- Cross-currency summation, implicit conversion, and client-side aggregation are forbidden.
- `pending_balance`, `available_balance`, `clawback_due`, `lifetime_earned`, and every monthly/type aggregate must each carry `currency_code` and an explicit sign/interpretation rule in the stamped DTO. A consumer must not infer sign semantics.
- `available_balance` is server-clamped according to the approved ledger/hold rules. `clawback_due` has its own explicit “amount due” sign rule and is not silently netted into another field.
- In the current Local/Test implementation, `clawback_due` is derived from the signed sum of `SalesCommission.amountSnapshot` for `REVERSED` entries, exposed as a separate non-negative amount-due field. No other table, frontend calculation, payout, withdrawal, or provider balance participates in this derivation. Any future separate clawback ledger must replace this derivation only through a separately reviewed contract change.
- If a representative has more than one `currencySnapshot`, the endpoint fails closed with HTTP `409 COMMISSION_CURRENCY_CONTEXT_REQUIRED`; it never sums or converts across currencies. This is an approved response semantic for V1, not a financial mutation.
- Aggregate field names, granularity, minor-unit representation, currency binding, and sign convention must be referenced by the stamped aggregate-shape contract; an open-ended aggregate map is not approved.
- The frontend must display server-provided values and must not perform monetary arithmetic, conversion, rounding, reconciliation, netting, or aggregation.

The following must be absent at schema/serialization level, not merely hidden by the UI:

- `customer_ref`;
- source-event or ledger internals;
- admin notes or internal review metadata;
- rates or pricing rules;
- other representatives' data;
- provider data or provider identifiers;
- credential or execution data;
- arbitrary account identifiers not required by the approved Summary contract.

Monthly/type aggregates must be explicitly enumerated in the final stamped contract. An open-ended map is not approved unless its keys and value semantics are frozen and reviewed.

## 6. Representative Scope Rule

The server must derive the representative subject from the authenticated session and an authoritative ownership relation. The request cannot select another representative by query parameter, path parameter, body, header, or client-side state.

Required invariants for implementation review:

1. Session identity is the initial subject input.
2. Ownership is checked server-side before read-model access or emission.
3. Capability evaluation is bound to the same subject and request context.
4. The read model query is constrained to that subject and approved currency/context.
5. Response serialization applies the allowlist before emission.
6. Logs and errors do not disclose forbidden financial or cross-representative data.

## 7. Read Model Boundary

The proposed read model is a projection for presentation only:

```text
Commission Ledger (authoritative)
        ↓ approved projection/update path
Representative Summary Read Model (non-authoritative)
        ↓ authorization + schema filtering
GET /rep/commission/summary
        ↓
Commission Overview (read-only frontend)
```

No frontend behavior may compensate for missing, stale, or unavailable projection data by calculating from raw ledger events or by displaying a placeholder amount. Degraded is the safe state when the projection/dependency is unavailable.

## 8. Security Constraints

- Capability enforcement is server-side and fail-closed.
- Generic403 has identical rendering for missing capability, invalid ownership, and equivalent unauthorized cases.
- No reason disclosure or resource-existence disclosure is permitted.
- Field filtering occurs before serialization/emission.
- Admin routes are not a fallback or data source.
- Cross-representative reads must be denied and covered by tests.
- Observability must avoid sensitive payloads and credentials.
- This contract grants no mutation or financial authority.

## 9. Test Contract Required Before Implementation Authorization

The future implementation wave must provide evidence for at least:

1. Authorized representative receives only the approved Summary DTO.
2. Missing capability returns Generic403 with no reason/existence leak.
3. Wrong or absent ownership cannot select another representative.
4. Forbidden fields are absent from serialized output and rendered output.
5. Empty/zero Summary is valid and contains no fabricated values.
6. Read-model/dependency outage produces Degraded with no stale/placeholder amount.
7. `429` and configuration errors remain distinct from Degraded.
8. Concurrent/session-isolation checks prevent cross-representative leakage.
9. Frontend performs no monetary calculation and no mutation.
10. Admin endpoint is never called or reused.
11. No History, Detail, `/entries/{id}`, withdrawal, provider, or production behavior is reachable.
12. Docker/local health, lint, build, regression, and populated screenshot evidence are captured after a valid contract is delivered.

Fixtures must be synthetic/local only and must contain no credentials, tokens, provider data, or real customer/financial data.

## 10. Implementation Gate and Explicit Non-Authorization

This design is ready for architecture and security review only. It does not authorize:

- backend implementation;
- endpoint registration;
- capability registration;
- read-model creation or migration;
- schema changes;
- frontend changes;
- admin endpoint reuse;
- financial calculation or mutation;
- production or real-money activity.

After architecture/security review, a separate implementation authorization must identify the approved owner, exact contract revision, environment, test gates, and rollback plan.

## Decision Required

Architecture/Backend owner must confirm:

1. endpoint ownership;
2. Financial Domain and Ledger ownership;
3. read-model ownership;
4. capability/auth ownership;
5. exact DTO/envelope and aggregate key semantics;
6. whether the proposed contract is approved for a separate implementation wave.

## References

- `docs/FW-02-R-sprint2c-backend-contract-decision.md`
- `docs/FW-02-R-sprint2c-contract-gap-final.md`
- `docs/FW-02-R-sprint2c-results.md`
- `apps/web/pages/commission-overview.jsx`
- `apps/api/src/main.mjs`
