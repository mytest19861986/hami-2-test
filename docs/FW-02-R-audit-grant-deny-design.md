# FW-02-R Future Audit Grant/Deny Wave — Design Package

Status: Design only — Local/Test planning artifact. This document authorizes no implementation, migration, frontend, production, or audit-event write.

## Scope and objective

This wave closes the F1 evidence gap for the representative commission-summary read surface. It defines the minimum audit capability for the two outcomes of `GET /api/v1/rep/commission/summary`:

- `VIEW_COMMISSION_SUMMARY_GRANTED`
- `VIEW_COMMISSION_SUMMARY_DENIED`

The existing endpoint authorization, financial derivation, DTO, and response behavior remain unchanged in this phase.

## Event model

Each event is an append-only audit record. The canonical encoding is two endpoint-specific
actions plus an authoritative `result`; ingestion rejects an action/result mismatch. Exactly one
effective event is emitted for each authorization decision. These endpoint-specific events replace
the generic `AUTHZ_DENIED` event for this endpoint (no double emission); the generic family remains
for planes without a specific event.

| Field | Grant | Deny |
| --- | --- | --- |
| `actorUserId` | authenticated subject | authenticated subject |
| `action` | `VIEW_COMMISSION_SUMMARY_GRANTED` | `VIEW_COMMISSION_SUMMARY_DENIED` |
| `entity` | `COMMISSION_SUMMARY` | `COMMISSION_SUMMARY` |
| `result` | `GRANTED` | `DENIED` |
| `reason_code` | null | one of `PRINCIPAL_DISABLED`, `CAPABILITY_MISSING`, `OWNERSHIP_MISMATCH` |
| `createdAt` | server timestamp (UTC) | server timestamp (UTC) |

`reason_code` is for audit analysis only and must not be reflected in the HTTP response.

Unauthenticated or unresolvable principals are not emitted as `COMMISSION_SUMMARY_DENIED`; they
belong to the generic pre-auth security-event family. `429`, configuration failure, Degraded,
and `5xx` are not authorization decisions and emit neither event. A capability-present
zero-valued summary is still `GRANTED`.

### Frozen envelope mapping and schema determination

The later implementation must map the reviewed envelope as follows:

| Reviewed field | Existing `AuditLog` field or later requirement | Privacy rule |
| --- | --- | --- |
| `actor_id` / `actor_type` | `actorUserId`; actor type derived from the authenticated principal | authenticated representative only |
| `action` | existing `action` | fixed allowlist above |
| `entity` | existing `entity` | `COMMISSION_SUMMARY` only |
| `result` | later required result field | `GRANTED` or `DENIED` only |
| `reason_code` | later required metadata field | coarse internal enum; never response-visible |
| `request_id` | later required request-correlation field | opaque, no tokens/cookies |
| `endpoint` / `capability` | later required metadata fields | fixed endpoint and `VIEW_COMMISSION_SUMMARY` |
| `opaque resource id` | later required metadata field | representative's opaque id only; no customer id |
| `ts` | existing `createdAt` (server UTC) | no client timestamp |
| `hashed session fingerprint` | later required privacy-preserving metadata field | one-way hash only |

The current `AuditLog` envelope exposes `actorUserId`, `action`, `entity`, and `createdAt`, but
does not currently demonstrate storage for all required correlation/result metadata. Therefore
the design records outcome **(c): a schema delta is required for a complete implementation**.
No schema delta or migration is authorized in this Phase 1; implementation is blocked until a
separate schema/implementation authorization explicitly resolves it. A registry/enum extension
alone is insufficient if the required metadata fields are absent.

## Audit boundary

The intended decision boundary is:

`request → authentication → authorization/ownership decision → audit decision event → response`

Grant is recorded only after the request has passed the existing authentication, capability, and
representative-scope checks. Deny is recorded after the authorization decision. Audit is a
post-decision observer with zero authority: it runs outside the decision transaction,
asynchronously/non-blocking through a bounded queue, and has no callback or write access to
authorization, response, ledger, read-model, or session state. Audit persistence failure is
fail-open for the request outcome, with bounded retry, dead-letter handling, and an operational
alert; it cannot change permission, financial behavior, or response status/body. The decision
event remains due even if response delivery fails.

## Privacy rules

Allowed audit metadata:

- actor identifier, where available;
- action, entity, result, coarse reason code, and server timestamp.

Never record:

- commission amounts or currency values;
- the Summary DTO or monetary fields;
- customer identifiers or customer financial data;
- another representative's data;
- provider, payout, credential, or ledger internals;
- request cookies, tokens, or raw authorization headers.

## Security considerations

- The audit event is observational and cannot grant, deny, mutate, settle, calculate, reverse, claw back, or withdraw funds.
- Existing authorization remains the sole access decision; audit must never become a fallback authorization source.
- Response bodies remain the existing generic unauthorized/forbidden forms; `reason_code` is audit-only.
- Grant and deny events must not create an enumeration side channel through timing or response differences.
- The design must preserve session-derived representative scope and the existing schema-level field allowlist.
- Audit records must be protected by existing audit-read authorization and retention controls; detailed retention and access policy require review.
- Duplicate/retry behavior must be specified so a request cannot produce misleading repeated financial-view evidence without an auditable request identity or documented at-least-once semantics.
- Delivery is at-least-once but idempotent on `(request_id, action)`; duplicate deliveries collapse
  to one effective event. Audit ingestion must be bounded against denial-volume abuse.
- Audit is immutable/append-only, restricted to audit/compliance roles, never client-queryable,
  never readable by the representative plane, and not consumed by admin approval/dispute planes.
  Retention is governed by a named policy reference; access to the audit store is itself audited.

## Integration point questions for the next gates

The following are intentionally unresolved design-review questions:

1. The design freezes asynchronous bounded delivery; the implementation wave must select the
   concrete queue/outbox mechanism without changing the endpoint contract.
2. Unauthenticated requests use the generic pre-auth family and never bind this financial entity.
3. The deny vocabulary is the closed enum above; additions require a design delta.
4. The implementation wave must bind the named retention policy and audit-reader capability.
5. The deduplication key is `(request_id, action)` with at-least-once delivery.
6. Persistence unavailability is fail-open for the request, with retry/dead-letter/alert and no
   financial-data or authorization change.

## Required evidence for later implementation closure

- grant event emitted only after a successful authorized summary decision;
- deny event emitted for missing capability, inactive account, and other approved denial causes;
- no event contains monetary DTO data or forbidden identifiers;
- response status/body remains unchanged and generic;
- no authorization bypass or financial side effect;
- audit persistence failure behavior is explicitly tested;
- duplicate/retry semantics are tested;
- full API regression, lint, typecheck, and health checks remain green.

## Design remediation freeze (F1–F7)

The following decisions are documentation-only and are binding for a later implementation
wave; they do not create events, queues, schema, migrations, or authorization behavior.

### F1 — Field-by-field envelope status and deduplication

| Field | Current status | Source / later requirement | Privacy classification |
| --- | --- | --- | --- |
| `actor_id` / `actor_type` | mapped-with-loss | `actorUserId`; actor type from authenticated principal | audit-only opaque actor |
| `action` | mapped | existing `AuditLog.action` | fixed allowlist |
| `entity` | mapped | existing `AuditLog.entity` | `COMMISSION_SUMMARY` only |
| `result` | requires-delta | later result metadata, `GRANTED`/`DENIED` | audit-only |
| `reason_code` | requires-delta | later coarse metadata, deny-only | audit/compliance only |
| `request_id` | requires-delta | server request correlation | opaque, no token/cookie |
| `endpoint` / `capability` | requires-delta | fixed endpoint and `VIEW_COMMISSION_SUMMARY` | non-sensitive contract metadata |
| `opaque_resource_id` | requires-delta | representative opaque id only | no customer id |
| `ts` | mapped | existing `AuditLog.createdAt`, server UTC | no client timestamp |
| `hashed_session_fingerprint` | requires-delta | one-way privacy-preserving hash | no raw session data |

The logical per-decision deduplication key is `(request_id, action)`, generated by the server
for one authorization decision and carried through retries/replay. The current envelope has no
demonstrated home for all required fields, so outcome (c) remains frozen: a later schema delta
is required; no schema delta or migration is authorized here.

### F2 — Durability and non-interference

The later implementation must choose a durable outbox. An in-memory queue alone is not accepted.
The outbox delivery is asynchronous, bounded, and a post-decision observer with zero authority.
It has no callback or write access to authorization, response, ledger, read model, or session.
Audit persistence failure is fail-open for this read-only request outcome and cannot alter status,
body, permission, or financial behavior. Retry, dead-letter, and operational alerting are required.
The durable outbox is the crash-survival mechanism; no unbounded or silent loss window is allowed.

### F3 — Reachability and event scope

`OWNERSHIP_MISMATCH` is a reserved enum value for future resource-scoped reuse and is unreachable
on this self-scoped summary endpoint, which accepts no client representative id. It must not cause
an invented path in this wave. `PRINCIPAL_DISABLED` is emitted only if the observer sees the
authenticated-but-disabled decision before the existing disabled-user 401 response; if the
session layer rejects the principal before an actor exists, the request uses the generic pre-auth
family and no commission-summary event. The implementation must preserve the existing 401/403
wire behavior.

### F4 — Exactly-once effective event

One authorization decision produces one effective audit event. The dedup key is `(request_id,
action)`; replay with the same key is an idempotent no-op, including dead-letter replay. The
endpoint-specific event supersedes generic `AUTHZ_DENIED` for this decision, so double emission
is forbidden.

### F5/F7 — Dead-letter controls and privacy boundary

The dead-letter store is immutable/append-only, has the same role-restricted access controls as
the primary audit store, is never client-queryable or readable by the representative plane or
normal admin approval/dispute flows, and has a named operational owner. `reason_code` is visible
only to audit/compliance roles; no representative-facing route, response, timing distinction,
or error body exposes it. Dead-letter depth and replay failures are alerted to its owner.

### F6 — Retention registry

Retention must be sourced from a named registry parameter `AUDIT_RETENTION_V1`, with an owning
security/compliance authority, a policy reference, and an invariant bound. It is not an inline
implementation constant and cannot weaken immutability, access restriction, or auditability of
audit-store access.

### Post-grant response failure

If authorization has succeeded, `VIEW_COMMISSION_SUMMARY_GRANTED` records the authorization
decision even if response delivery later produces a 5xx. The 5xx is not a second authorization
event and does not rewrite the grant. No event is emitted for a 5xx that occurs before an
authorization decision. Unauthenticated attempts remain in generic pre-auth telemetry, with
rate limiting and generic denial telemetry serving abuse detection.

## Gate sequence

`Audit Design → GLM Architecture Review → Claude Security Review → Implementation Authorization → Local/Test Implementation → Evidence → Claude Re-review`

This package stops at design. It does not authorize implementation.
