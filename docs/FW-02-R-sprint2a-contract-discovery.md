# FW-02-R Sprint 2A — Commission Read Contract Discovery

## Status

**BLOCKED — Contract Gap confirmed**

This document records a design/contract discovery only. No API, schema, migration,
financial UI, admin-endpoint reuse, or production action was added.

## Objective

Determine whether the current implementation contains an existing representative-
scoped read contract for commission summary/history.

## Current-state evidence

| Required contract element | Current result | Evidence |
| --- | --- | --- |
| Representative commission endpoint | **Missing** | `apps/api/src/main.mjs` exposes `GET /api/v1/sales-partner/customers` only for partner attribution; commission listing is `GET /api/v1/admin/commissions`. |
| Representative commission capability | **Missing** | Existing permissions include `commissions.read`, `commissions.approve`, and `commissions.reject`; no `VIEW_COMMISSION_SUMMARY` or `VIEW_COMMISSION_HISTORY` capability is implemented. |
| Representative-scoped service/read model | **Missing** | No user-facing commission service or DTO was found. The existing controller returns admin commission records. |
| Authorization boundary | **Admin-only for commission reads** | `SalesCommissionController.commissions()` uses `currentWithPermission(req, 'commissions.read')`; it is not representative-owned or attribution-scoped. |
| Allowed representative fields | **Contract-only, not implemented** | `FW-02-R-commission-ledger-contract.md` and `FW-02-R-data-visibility-matrix.md` permit only the representative's authorized integer-unit commission entries/history, while excluding customer financial amounts, raw identifiers, and other representatives' data. |
| Summary/history distinction | **Not implemented** | No existing representative read contract defines the response shape or boundary between summary and history. |

## Security conclusion

Reusing `GET /api/v1/admin/commissions` is rejected. It is admin-scoped and
returns records across representatives, which would violate the data-visibility
matrix and create cross-representative financial leakage.

Creating a representative endpoint, capability, DTO, or schema in Sprint 2A is
also rejected because the Commander explicitly prohibited API invention and
schema changes for this substage.

## Required contract decision (design only)

Before Sprint 2 implementation can resume, the contract must define:

1. **Data owner:** Commission Ledger → representative-scoped read model → frontend.
2. **Scope enforcement:** server derives the representative from the authenticated
   session; client-supplied representative IDs are not trusted.
3. **Authorization:** exact mapping for `VIEW_COMMISSION_SUMMARY` and
   `VIEW_COMMISSION_HISTORY`, with fail-closed behavior.
4. **Fields:** own authorized integer-unit amount/currency/status/timestamp and
   immutable historical snapshots only; no customer payment amounts, raw customer
   identifiers, other representatives' rows, internal rates, or platform costs.
5. **Shapes:** separate summary and history semantics, pagination/order rules,
   and loading/empty/error/degraded/unauthorized behavior.

## Prohibited actions preserved

- No endpoint or capability creation
- No schema change or migration
- No financial UI
- No real commission data exposure
- No use of the admin endpoint for representative views
- No calculation, mutation, withdrawal, payout, provider, credential, or production action

## Decision required

Commander must provide or approve the representative ledger-scoped read contract
before FW-02-R Sprint 2 can proceed. Until then, implementation remains stopped
and the financial boundary remains protected.

## Source references

- `temp/review/FW-02-R-capability-contract.md`
- `temp/review/FW-02-R-commission-ledger-contract.md`
- `temp/review/FW-02-R-data-visibility-matrix.md`
- `temp/review/HC-W6-01/b6-endpoint-map.md`
- `apps/api/src/main.mjs`
- `apps/web/pages/admin/commissions.jsx`
