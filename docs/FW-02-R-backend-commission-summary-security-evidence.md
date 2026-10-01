# FW-02-R Backend Commission Summary — Security Evidence Completion

Status: Local/Test evidence completion only. No financial behavior, frontend, schema, migration, payout, provider, credential, or production change.

## F6 — authoritative lineage and `clawback_due`

The current Local/Test data model has no separate commission-balance table. `SalesCommission` is the commission-ledger record set introduced by migration `0016_referral_wallet_commission_core`; it stores the immutable amount/currency snapshots and the existing lifecycle status. The summary is a read-only projection over rows constrained by the authenticated `salesPartnerUserId`.

The implementation derives `clawback_due` as the absolute value of the signed sum of `SalesCommission.amountSnapshot` for `REVERSED` rows. It does not read, calculate from, or mutate wallet, payout, withdrawal, provider, or frontend state. `clawback_due` remains a separate non-negative amount-due field and is never netted into `available_balance`.

This is the authoritative Local/Test lineage:

`SalesCommission` commission-ledger rows → session-scoped summary aggregate → DTO

If production later introduces a separate clawback ledger, that replacement requires a new reviewed contract; this evidence does not authorize such a change.

## F5 — mixed-currency response

The approved V1 response has one currency context. When the scoped rows contain more than one `currencySnapshot`, the endpoint fails closed with HTTP `409 COMMISSION_CURRENCY_CONTEXT_REQUIRED`. No cross-currency sum, conversion, rounding, or client fallback occurs. This is response/error semantics only and does not mutate financial state.

## Evidence matrix

| Item | Local/Test evidence | Result |
| --- | --- | --- |
| Session scope | Query predicate uses authenticated actor id as `salesPartnerUserId`; no client representative id | PASS |
| Capability | `currentWithPermission(req, 'commissions.summary_read')`; SALES_PARTNER seed grant | PASS |
| Field allowlist | DTO emits only the approved summary fields; no customer, ledger-internal, admin, provider, or credential fields | PASS by code inspection and DTO integration assertion |
| Currency/sign | Every monetary field carries `amount_minor`, `currency_code`, and `sign_rule`; available is server-clamped; clawback is separate | PASS |
| Mixed currency | Multiple scoped currencies produce `409 COMMISSION_CURRENCY_CONTEXT_REQUIRED` | PASS by implementation; contract recorded above |
| Regression | Dedicated integration test 7/7; full API regression 72/72; lint/typecheck/health pass | PASS |
| Anonymous boundary | Runtime request returns 401 `UNAUTHORIZED` | PASS |
| Audit grant/deny | Existing authorization audit behavior is not asserted by the summary test | OPEN evidence gap; no behavior change authorized |
| Two-representative isolation | Database-only fixture with commission for A and same endpoint query for B; A sees 25 and B sees 0 | PASS |
| Unauthorized/disabled/revocation | No-capability=403, disabled-user=401/no-fallback, and capability removal followed by 403 within the bound are tested | PASS |
| Generic403/schema absence | Schema absence and equality across missing-capability and revoked-capability 403 responses are tested | PASS |
| Degraded/429/config error | No new summary behavior is introduced; dedicated evidence remains pending | OPEN, non-blocking for this evidence-only pass |

## Boundary

This document records the implementation lineage and the approved 409 semantic. It does not claim that the remaining audit, cross-representative, revocation, Generic403, or degraded-state scenarios have been executed. No implementation behavior was changed to manufacture those results.

## F7 existing-path assessment

The current endpoint has no separate dependency/read-model adapter, stale-cache branch, or summary-specific 429/config-error mode. It performs a direct scoped `SalesCommission` read and uses the existing application exception mapping. Therefore there is no existing degraded/error-path behavior that can be tested without adding a new failure-injection contract or changing endpoint behavior. F7 remains a deferred contract/testability gap, not a claimed PASS.
