# FW-02-R Sprint 2C-B — Commission Contract Gap Closure Preparation

## Status

`BLOCKED — Representative Commission Summary Read Contract is not delivered.`

This is a documentation/discovery record only. No technical contract, API, schema, migration, UI, or backend implementation was created or modified by Sprint 2C-B.

## 1. Current Frontend Contract Slot

The authorized frontend surface is implemented as a read-only Commission Overview page:

- Route: `/commission-overview`
- Requested data slot: `GET /rep/commission/summary`
- Expected capability: `VIEW_COMMISSION_SUMMARY`
- Presentation boundary: server-provided summary payload, filtered to the frozen allowlist before rendering
- Failure behavior: missing/unavailable contract fails closed to `Degraded`, with no stale or placeholder financial value

The frontend does not calculate, reconcile, convert, round, mutate, or infer monetary values. It does not implement History, Detail, withdrawal, or any mutation surface.

## 2. Expected Capability and Data Boundary

The expected contract must derive representative scope from the authenticated session and server-side ownership. The client must not provide a trusted representative identifier.

The approved Summary allowlist is:

- `pending_balance`
- `available_balance` (server-clamped)
- `clawback_due`
- `lifetime_earned`
- contracted monthly/type aggregates
- `plan_label`

The emitted schema must exclude `customer_ref`, source-event internals, admin notes, rates, other representatives' data, provider data, and internal-ledger data. The ledger remains the sole source of truth; any read model is derived and non-authoritative.

## 3. Existing Endpoint Inventory and Non-Reuse Decision

Current backend inventory contains `GET /admin/commissions` and related admin decision/mutation routes. These are admin-scoped and are not a representative Summary contract.

They must not be reused because doing so would cross the authorized scope and could expose admin or non-representative data. Sprint 2C-B therefore records the gap rather than adapting those routes.

Runtime evidence from Local/Test:

- Docker services API, Web, Nginx, and DB are running.
- `GET http://127.0.0.1:8080/rep/commission/summary` returned HTTP `404`.
- No source declaration for `rep/commission/summary` or `VIEW_COMMISSION_SUMMARY` was found in `apps/api/src/main.mjs`.

## 4. Contract Ownership Map

| Concern | Required owner | Current Sprint 2C-B action |
|---|---|---|
| Financial semantics and approved Summary fields | Financial Domain | Record dependency; no implementation |
| Ledger source of truth | Commission Ledger owner | Record dependency; no ledger change |
| Derived representative read model | Read Model owner | Record missing delivery; no projection change |
| Capability definition and enforcement | Capability Registry/Auth owner | Record expected `VIEW_COMMISSION_SUMMARY`; no registry change |
| Frontend presentation | Web surface | Already implemented under Sprint 2C authorization |

Ownership is recorded for handoff only. This document does not assign ownership or alter any registry, contract, schema, or service.

## 5. Implementation Blocker Record

**Blocker:** Missing Representative Commission Summary Read Contract.

**Severity:** Implementation dependency; final acceptance blocker.

**Observed effect:** The frontend is ready under contract, but the Local/Test data path cannot produce a verified representative Summary response. The page correctly renders the fail-closed Degraded state. A populated screenshot would require inventing or substituting financial data and is therefore not valid evidence.

**Resolution required:** Delivery of the existing approved contract by its owning backend/Financial Domain path, including endpoint availability, capability enforcement, session-derived representative scope, and the frozen allowlist/state behavior.

**Acceptance impact:** Sprint 2C frontend remains `READY`; Sprint 2C backend data dependency remains `BLOCKED`; final acceptance remains pending. Lint/build evidence must also be rerun when the complete dependency environment is available.

## 6. Explicit Non-Actions

Sprint 2C-B does not:

- create or modify an API;
- change a schema or migration;
- reuse an admin endpoint;
- modify commission calculations or financial records;
- expand the UI beyond the Summary view;
- add mutation, withdrawal, provider, credential, or production behavior.

## 7. Decision After Completion

After this report is reviewed:

- **A — Contract delivered:** validate the existing contract, rerun lint/build, capture populated evidence, and request final acceptance.
- **B — Contract still missing:** obtain an explicit architecture/backend-owner decision before any technical contract work is authorized.

## Evidence References

- `docs/FW-02-R-sprint2c-results.md`
- `docs/FW-02-R-sprint2c-implementation-request.md`
- `apps/web/pages/commission-overview.jsx`
- `apps/api/src/main.mjs`
