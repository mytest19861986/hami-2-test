# FW-02-R Sprint 2C — Commission Overview Read-Only Implementation Authorization Request

## Status and decision requested

This document requests a separate, explicit authorization to implement the read-only Commission Overview surface. It is an authorization request only; no implementation, route/API/schema change, migration, financial mutation, withdrawal, provider, credential, production, or real-money activity is included in this document.

Requested decision: authorize only the scoped read-only implementation described below, subject to the frozen contracts and evidence gates.

## Scope

### Included

- The existing capability-driven representative shell integration required to reach Commission Overview.
- Commission Overview presentation from the existing-or-approved contract slot `GET /rep/commission/summary`.
- Server-provided summary values displayed verbatim through the approved presentation boundary.
- Loading, empty/zero, Generic403 Unauthorized, Error, and Degraded states defined by the frozen contract.
- Automated tests and evidence capture for authorization, scope, field absence, rendering, and failure states.

### Explicitly excluded

- Commission History implementation in this milestone unless separately authorized.
- Any commission detail page or `/entries/{id}` endpoint.
- New route/API/schema/table creation, migration, or reuse of admin-scoped commission endpoints.
- Client-side commission calculation, reconciliation, conversion, rounding, or netting.
- Commission creation, adjustment, reversal, clawback, withdrawal, payout, or other financial mutation.
- Provider/executor integration, credentials, production deployment, and real-money movement.
- Account/Profile or Notifications surfaces without an existing approved contract.

## Contract references and frozen invariants

- `docs/FW-02-R-sprint2a-contract-discovery.md`
- `docs/FW-02-R-sprint2b-commission-read-contract.md`
- FW-02-R G0 freeze and approved Phase 1A Blueprint as recorded by Commander.
- GLM Architecture Review: `PASS`.
- Claude Security Review: `SECURITY_PASS`.
- GLM Delta Review: `PASS`.
- Qwen Blueprint: `READY`.

The ledger remains the sole source of truth. The representative read model is a derived, non-authoritative projection. Scope is derived from the authenticated session and representative ownership; the client must not supply a trusted `representativeId`. Authorization and field filtering must complete before any data emission.

## Capability mapping and data boundary

Commission Overview requires `VIEW_COMMISSION_SUMMARY`. A missing or revoked capability disables the feature with no fallback and produces the uniform Generic403 behavior at the endpoint boundary. The read endpoint is owned by the Financial Domain and remains existing-or-blocked; this request does not invent or implement an endpoint.

The summary allowlist is limited to server-provided:

- `pending_balance`
- `available_balance` (server-clamped)
- `clawback_due`
- `lifetime_earned`
- contracted monthly/type aggregates
- `plan_label`

The payload must be schema-level absent of `customer_ref`, source-event internals, admin notes, rates, other representatives' data, provider data, and internal-ledger data. No customer-level financial amounts may appear.

## Validation plan

Before requesting implementation closure, verify:

1. The page calls only the approved summary contract and never the admin commission endpoint.
2. Session-derived identity and representative ownership are enforced server-side; client-supplied scope is ignored.
3. Capability present with no data renders the contracted zero/empty state; capability absent renders the uniform Generic403 state without reason or existence disclosure.
4. Degraded is used only for unavailable non-authoritative read-model/dependency data and renders no stale or placeholder financial values; it is distinct from 429 and configuration Error.
5. Every emitted field matches the allowlist; forbidden fields are absent from serialized responses and rendered output.
6. The frontend performs no monetary arithmetic, conversion, rounding, reconciliation, or derived aggregation.
7. Loading, success, zero/empty, Unauthorized, Error, and Degraded states are covered by tests and evidence.
8. Existing regression, lint, typecheck, and build checks remain green, with no unrelated surface added.

## Evidence requirements

Attach reviewable evidence for:

- URL/route and endpoint ownership mapping.
- Network or contract traces showing session-derived scope and no admin endpoint reuse.
- Capability-denied Generic403 behavior with identical rendering and no existence leak.
- Empty/zero summary behavior.
- Degraded behavior with no monetary value.
- Schema-level absence assertions for all forbidden fields.
- Representative fixture isolation and no real customer data.
- Screenshot or equivalent visual evidence for each authorized state.
- Test output covering the validation plan and a regression summary.

Evidence must use synthetic fixtures only and must not contain credentials, tokens, provider data, or real financial/customer information.

## Rollback approach

Rollback must be additive and reversible: disable the Commission Overview feature flag or remove only the authorized read-only presentation wiring, leaving the ledger, source records, authorization policy, and existing admin surfaces unchanged. No rollback may mutate financial records or broaden access. If an endpoint, contract, or security invariant is missing, stop the surface in a fail-closed state and return to the prior non-feature state.

## Known limitations and later gates

- Financial Domain delivery and ownership-register confirmation for the summary slot remain later-gate dependencies.
- Capability-discovery ownership and any endpoint delivery remain existing-or-blocked items.
- Withdrawal, payout executor reachability, reconciliation/clawback runbook, KYC ownership, admin tooling, and legal/compliance approval are outside this request.
- This authorization request does not itself authorize implementation; Commander must issue a separate explicit decision.

## Commander decision

`PENDING — explicit Implementation Authorization required.`

