# FW-02-R Sprint 2C-C — Backend Contract Decision Package

## Decision Status

`DECISION REQUIRED — Frontend Ready / Backend Blocked`

This package is documentation-only. It does not create or modify a backend/frontend contract, endpoint, capability, schema, migration, or read model.

## 1. Current State

The authorized frontend Commission Overview surface is complete under the frozen read contract boundary:

- Route: `/commission-overview`
- Expected data slot: `GET /rep/commission/summary`
- Expected capability: `VIEW_COMMISSION_SUMMARY`
- Scope: authenticated representative session and server-side ownership
- Rendering: approved Summary allowlist only, with fail-closed behavior

The backend delivery required to populate that surface is not available:

- No representative Summary endpoint is declared in `apps/api/src/main.mjs`.
- No `VIEW_COMMISSION_SUMMARY` declaration is present in that backend source.
- No representative commission read model delivery was identified.
- Local/Test request to `/rep/commission/summary` returned HTTP `404`.
- The existing `/admin/commissions` surface is admin-scoped and is not a substitute.

## 2. Missing Contract Components

The following components require an owner decision and later delivery:

1. Representative-scoped Summary read contract and endpoint ownership.
2. Capability registration/enforcement for `VIEW_COMMISSION_SUMMARY`.
3. Representative ownership and session-derived scope enforcement.
4. Non-authoritative read-model projection sourced from the Commission Ledger.
5. Schema-level exclusion of customer, internal-ledger, provider, rate, admin, and other-representative fields.
6. Frozen state behavior: Generic403 Unauthorized, empty/zero, dependency Degraded, and distinct error/rate-limit behavior.

These are listed for decision and ownership only; this package does not implement them.

## 3. Architecture Options

### Option A — Deliver the Existing Approved Contract

The current Backend/Financial Domain owner delivers the already-approved Representative Summary contract and its existing ownership path.

Expected consequences:

- Lowest scope and migration risk.
- Preserves the current frontend contract slot without frontend architecture changes.
- Enables validation, lint/build, populated screenshot evidence, and final acceptance after delivery.
- Requires confirmation of endpoint, capability, read-model, scope, and allowlist behavior.

### Option B — Create a New Backend Contract in a Separate Wave

Authorize a new, separately governed backend wave to design and deliver the Representative Summary contract.

Expected consequences:

- Requires a new explicit authorization and backend implementation scope.
- Requires contract, security, ownership, schema/read-model, regression, and migration-impact review as applicable.
- Keeps Sprint 2C frontend unchanged but leaves its acceptance blocked until the new wave is complete.
- Must not reuse `/admin/commissions` as an interim path.

## 4. Comparative Impact

| Decision area | Option A: existing delivery | Option B: separate backend wave |
|---|---|---|
| Frontend readiness | Unchanged; can validate immediately after delivery | Unchanged; waits for new wave |
| Security boundary | Validate already-approved boundary | New security/contract review required |
| Testing | Data-path, lint/build, screenshot, final acceptance | Backend and frontend regression plus all Option A evidence |
| Migration impact | Expected to be limited to existing delivery | Must be assessed and explicitly authorized if applicable |
| Current Sprint 2C scope | Preserved | Preserved, with dependency on new wave |
| Decision owner | Existing Backend/Financial Domain owner | Architecture/Backend owner with separate authorization |

## 5. Required Decision and Ownership

The architecture/Backend owner must select exactly one path:

- **A — Existing Contract Delivery:** identify the owner, branch/revision or delivery location, endpoint, capability registration, and readiness date/status.
- **B — New Backend Wave:** authorize a separate wave, name its owner, and define its contract/security/schema/read-model gates before implementation.

The following ownership roles must be named or confirmed:

- Financial Domain semantics owner
- Commission Ledger owner
- Representative read-model owner
- Capability/Auth registry owner
- Backend endpoint owner
- Architecture decision owner

## 6. Acceptance Consequences

Until the decision and delivery path are resolved:

- Frontend: `READY`
- Backend Representative Summary Contract: `NOT AVAILABLE`
- Sprint 2C validation: `BLOCKED`
- Populated screenshot evidence: not valid yet
- Final acceptance: `PENDING`

After a valid contract is delivered, the authorized next checks are:

1. Verify the representative data path and session-derived scope.
2. Verify capability-denied Generic403 and forbidden-field absence.
3. Run lint/build when dependencies are available.
4. Capture populated screenshot evidence using approved synthetic/local data only.
5. Submit final acceptance request.

## 7. Explicit Non-Actions

This package does not:

- create or modify an endpoint or API;
- add or modify a capability;
- change schema or migration;
- create or modify a read model;
- reuse an admin route;
- change frontend architecture or UI;
- calculate, mutate, withdraw, reverse, or otherwise alter commission data;
- connect providers, use credentials, or touch production.

## Decision Record

Current recommendation: **Option A if an existing approved contract can be delivered; otherwise Option B requires a separate explicit backend authorization.**

No technical implementation should begin until the architecture/Backend owner records the selected option and ownership.

## Evidence References

- `docs/FW-02-R-sprint2c-contract-gap-final.md`
- `docs/FW-02-R-sprint2c-results.md`
- `apps/web/pages/commission-overview.jsx`
- `apps/api/src/main.mjs`
