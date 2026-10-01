# FW-02-R Sprint 2B — Commission Read Contract Alignment

## Status

**DESIGN CONTRACT READY — implementation remains gated**

Documentation-only contract alignment. No endpoint, capability record, schema,
migration, UI, or financial behavior is created by this document.

## Scope and ownership

The normative read path is:

`Commission Ledger → representative-scoped read model → capability authorization → frontend read view`

The Commission Ledger is append-only and authoritative. The frontend is display-
only: it must not calculate, mutate, infer status, or derive financial values from
other views.

Endpoint ownership remains with the Financial Domain. These are contract slots,
not implemented endpoints:

| Capability | Contract endpoint slot | Scope |
| --- | --- | --- |
| `VIEW_COMMISSION_SUMMARY` | Existing Financial Domain summary endpoint | Authenticated representative's own authorized summary only |
| `VIEW_COMMISSION_HISTORY` | Existing Financial Domain history endpoint | Authenticated representative's own authorized history only |

If either endpoint is not provided by the Financial Domain, the capability is
`BLOCKED_FOR_G0`; no fallback to `GET /api/v1/admin/commissions` is allowed.

## Authorization rules

1. Authenticate the request and reject disabled/frozen subjects.
2. Resolve the capability server-side.
3. Derive representative ownership from the authenticated session identity.
4. Never accept a client-supplied `representativeId` as authority or scope.
5. Enforce representative ownership in the Financial Domain query/read model.
6. Apply capability-specific server-side field filtering before serialization.
7. Missing, expired, ambiguous, or absent capability fails closed with generic
   `403 {"code":"FORBIDDEN"}` and no resource-existence signal.
8. An authorized collection with no rows returns `200` with an empty collection.
9. Every allow/deny decision is auditable without raw sensitive identifiers.

## Capability binding

| Capability | Required authority | Allowed behavior | Fail-closed condition |
| --- | --- | --- | --- |
| `VIEW_COMMISSION_SUMMARY` | session + capability + representative ownership | Read own permitted aggregate/summary fields | missing capability, endpoint, ownership, or field authorization |
| `VIEW_COMMISSION_HISTORY` | session + capability + representative ownership | Read own permitted immutable commission snapshots | missing capability, endpoint, ownership, or field authorization |

No commission capability grants approval, rejection, reversal, clawback,
withdrawal, payout, provider, or credential access.

## DTO and field allowlist

The exact wire DTO is owned by the Financial Domain. The following allowlist is
the minimum display contract and must be enforced server-side. Fields not listed
are absent, not merely hidden in the UI.

### Summary

Allowed fields (and only these fields), when explicitly authorized:

- `pending_balance`;
- `available_balance` (server-clamped);
- `clawback_due`;
- `lifetime_earned`;
- monthly/type aggregates;
- `plan_label`.

### History

Allowed fields (and only these fields), for the authenticated representative's own authorized rows:

- opaque `entry_id`;
- `entry_type` (the exact frozen enum from the Financial Domain contract);
- signed integer `amount_minor`;
- `currency_code`;
- `vesting_status` (the exact frozen enum from the Financial Domain contract);
- `created_at`;
- `available_at`.

The schema-level response must not contain `customer_ref`, source-event internals,
admin notes, rates, per-customer fields, other representatives' data, or provider/
internal-ledger data. These are absent from the DTO, not conditionally hidden.

Never serialize customer payment amounts, customer balances, raw customer IDs,
phone/email/name/address, purchase identifiers, other representatives' rows,
internal commission rules/rates, platform fees/costs, reconciliation internals,
provider credentials, operator IDs, or execution details.

## Summary/history separation

- **Summary** is a server-provided authorized aggregate; the frontend does not sum history rows to create it.
- **History** is a server-provided list of immutable ledger-backed snapshots; the frontend does not calculate balances, eligibility, status, or reversals.
- A summary may not be inferred from an unauthorized history response, and history may not expose fields valid only for internal ledger use.

## State and wire-test contract

The frozen read-view states are Loading, Empty, Error, Degraded, and Unauthorized.
`Unauthorized` is always the same Generic403 response/rendering with no reason or
permission disclosure. `Degraded` means only that the non-authoritative read model
or dependency is unavailable; it must never emit stale or placeholder financial
values and is distinct from `429` and configuration Error.

Normative examples:

```json
{"items": [], "next": null}
```

```json
{"code": "FORBIDDEN"}
```

The error response must not disclose whether another representative's record exists.

The commission surface has exactly two contract slots: Commission Summary and
Commission History List. No commission detail endpoint or deep link is permitted,
including `/entries/{id}`.

## Test contract before implementation acceptance

The eventual Financial Domain endpoint implementation must prove:

1. Authorized representative receives only own permitted summary/history data.
2. Missing capability and direct unauthorized URL fail closed with generic 403.
3. A client-supplied other `representativeId` cannot widen scope.
4. Other representatives' rows are absent from the response.
5. Customer payment amounts, raw identifiers, rules/rates, and platform internals are absent at serialization.
6. Empty authorized result is `200` and empty, not an error.
7. Summary is server-provided; no frontend aggregation/calculation is used.
8. History preserves immutable snapshots and does not mutate ledger state.
9. Pagination/order and timestamp/currency semantics follow the existing endpoint contract once supplied.
10. Existing web/API regression, build, and Docker health remain green.

## Explicit exclusions

- endpoint/API implementation;
- schema change or migration;
- financial UI implementation;
- admin endpoint reuse;
- commission calculation or creation;
- approval/rejection, reversal, clawback, withdrawal, or payout;
- provider/vendor/credential/production action.

## Review gate

This contract is ready for architecture/security review. Commission Overview
implementation remains blocked until the Financial Domain supplies an existing
representative-scoped endpoint, or the Commander explicitly changes the scope.

## Source contracts

- `temp/review/FW-02-R-capability-contract.md`
- `temp/review/FW-02-R-data-visibility-matrix.md`
- `temp/review/FW-02-R-commission-ledger-contract.md`
- `docs/FW-02-R-sprint2a-contract-discovery.md`
