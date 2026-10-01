# FW-02-R Audit Grant/Deny Schema Delta — Design Package

Status: Design only. This document authorizes no Prisma/schema edit, migration, event creation,
queue/outbox implementation, frontend change, production action, or real-money action.

## Objective and boundary

The stamped Audit Grant/Deny design selected outcome (c): the current `AuditLog` envelope cannot
be assumed to losslessly store the complete reviewed audit envelope. This package defines the
minimum future schema delta needed for:

- `VIEW_COMMISSION_SUMMARY_GRANTED`
- `VIEW_COMMISSION_SUMMARY_DENIED`

The existing endpoint authorization, response, financial behavior, and current audit records
remain unchanged until a later implementation authorization.

## Current compatibility baseline

The current `AuditLog` model is known to provide `actorUserId`, `action`, `entity`, and
`createdAt`, and the application audit helper writes only when explicitly invoked. The current
summary route does not emit these new events. No existing event may be renamed, reinterpreted,
deleted, or made dependent on the new fields.

## Proposed logical envelope

The later implementation must persist one immutable logical record per authorization decision:

| Field | Required property | Privacy / integrity rule |
| --- | --- | --- |
| `audit_id` | opaque unique id | server-generated; immutable |
| `request_id` | opaque server-generated correlation id | never accepted from client headers; lossless |
| `actor_id` / `actor_type` | authenticated actor; for this self-scoped endpoint `actor_id` is the opaque representative resource reference | no raw session/token; `customer_ref` forbidden |
| `action` | one of the two endpoint actions | fixed registry; immutable |
| `entity` | `COMMISSION_SUMMARY` | fixed entity; no customer entity |
| `result` | `GRANTED` or `DENIED` | lossless; immutable |
| `reason_code` | null for grant; closed deny enum | audit/compliance only |
| `endpoint` | fixed summary endpoint identifier | no client-supplied route |
| `capability` | `VIEW_COMMISSION_SUMMARY` | fixed capability |
| `opaque_resource_id` | representative opaque id only, if needed | never customer id |
| `createdAt` | server UTC timestamp | no client timestamp |
| `hashed_session_fingerprint` | one-way privacy-preserving hash | no raw cookie/token; no session recovery |
| `dedup_key` | unique `(request_id, action)` key | exactly-one effective event |
| `schema_version` | explicit envelope version | additive/versioned evolution only |

Closed deny enum for this design: `PRINCIPAL_DISABLED`, `CAPABILITY_MISSING`,
`OWNERSHIP_MISMATCH`. For this self-scoped endpoint, only `CAPABILITY_MISSING` is reachable;
`PRINCIPAL_DISABLED` is absorbed by generic pre-auth/401 handling and `OWNERSHIP_MISMATCH` is
reserved/unreachable with an internal inconsistency alert if it ever appears.

## Storage model options and decision

Option A, adding nullable columns to `AuditLog`, preserves the existing table but risks mixing
legacy heterogeneous events with the new exactly-once envelope. Option B, a separate immutable
`AuthorizationAuditEvent` table linked to the existing audit envelope, gives a strict allowlist,
unique dedup key, independent retention/access controls, and a clean migration boundary.

Design recommendation: choose Option B for implementation design, subject to GLM and Claude
review. Existing `AuditLog` rows remain untouched. A compatibility adapter may continue reading
legacy events, but the representative plane never reads either audit store.

The future mapping table must mark every field `mapped`, `mapped-with-loss`, or `requires-delta`.
`request_id` and `result`/decision must be lossless, and all `requires-delta` rows must be
resolved before implementation.

Activation is a config-coordinated cutover: enable new-table emission and disable legacy generic
`AUTHZ_DENIED` for this endpoint at the same activation point. There is no double-emission window.
Rollback is config-level only to the pre-wave generic baseline; no backfill or cross-store
reconciliation is permitted.

## Migration impact analysis

No migration is created in this phase. A later migration design must specify:

1. additive table/columns and indexes, including unique `(request_id, action)`;
2. no backfill of old events with invented grant/deny meanings;
3. no rewrite or deletion of existing `AuditLog` records;
4. rollout ordering: storage capability → durable outbox contract → producer enablement →
   evidence and rollback plan;
5. rollback that disables new emission without changing endpoint authorization or response;
6. dead-letter storage with the same immutability, access control, owner, and audit-of-access
   requirements;
7. retention binding to `AUDIT_RETENTION_V1`, with retain-longer fail-safe and no early deletion.

The consolidated future migration wave covers exactly three stores: `AuthorizationAuditEvent`,
outbox, and dead-letter. It is additive-only and forward-only. After activation, DDL rollback or
destructive removal of the audit store is forbidden; deactivation is the only rollback.

## Store mechanics and audit-of-access

The future audit and dead-letter stores are privilege-based append-only stores: no application
principal receives `UPDATE` or `DELETE`, and DDL/storage-level rejection prevents destructive
mutation. The outbox is transport only, not the audit record; processing markers or outbox-row
deletion do not delete audit history. Access to both audit stores is logged durably; the sink may
be the legacy append-only `AuditLog` to avoid circularity, subject to the same access controls.

## Backward compatibility

`request_id` is the platform correlation id, generated server-side at the beginning of the
pipeline. It is never accepted from a client header and never regenerated at audit time. The
storage-level unique constraint on `(request_id, action)` is the authoritative deduplication
mechanism; insert conflict is an idempotent no-op. Replay and dead-letter replay carry the same
key and are no-ops. A separate `dedup_key` is optional only when its derivation from that pair is
frozen and cannot drift.

- Existing audit readers and event actions remain valid.
- New fields are additive and versioned; no existing consumer may be forced to parse them.
- The endpoint response is byte-identical before and after a future audit activation.
- Audit persistence failure is fail-open for the read request, counted as a completeness gap, and
  alerted; it cannot alter authorization, financial behavior, status, or response body.
- The durable outbox is required; an in-memory queue alone is not compatible with the crash-loss
  and exactly-one requirements.

## Privacy and security boundaries

Never store amount, currency, Summary DTO contents, customer identifiers/data, other
representatives, provider/payout data, credentials, tokens, raw cookies, ledger internals, or
free-text denial explanations. `reason_code` is never client-visible and is limited to
audit/compliance roles. The audit/dead-letter stores are never client-queryable, never readable
by the representative plane, and excluded from normal admin approval/dispute flows.

The observer is post-decision and zero-authority. It has no callback or write access to
authorization, response, ledger, read model, or session state. `429`, configuration failure,
Degraded, and pre-decision `5xx` do not create these authorization events. A post-grant `5xx`
does not erase or duplicate the `GRANTED` decision event.

## Required future evidence

- schema-level allowlist and forbidden-field absence;
- unique dedup under concurrent retry and dead-letter replay no-op;
- server-generated request id cannot be client-overridden;
- legacy AuditLog events remain readable and unchanged;
- outbox failure leaves response/authorization byte-identical and raises completeness alert;
- retention/access controls and dead-letter access logging;
- no event on non-authorization paths and no double `AUTHZ_DENIED` emission.

## Security remediation freeze (F1–F7)

These additions are design-only and do not create schema, migrations, stores, events, queues, or
outbox code.

### F1 — Divergent dedup conflicts

On a storage insert conflict, the existing stored event remains authoritative, but the incoming
payload is compared. A difference in `GRANTED`/`DENIED`, decision/result, or any critical field
raises an inconsistency/security alert and never overwrites the stored event. An identical replay
is an idempotent no-op.

### F2 — Single cutover switch

Emitter selection uses one config value, `AUDIT_AUTHORIZATION_EVENT_MODE`, rather than independent
enable/disable flags. The value atomically selects either the legacy baseline or the new
AuthorizationAuditEvent path. Multi-instance propagation must have a bounded, documented window
and defined behavior; no uncoordinated two-flag state is permitted. Config-only rollback returns
to baseline deny auditing; previously written grant events remain immutable.

### F3 — Retention purge

Retention is executed by a separate privileged retention job or partition-drop mechanism, never by
the application role. Purge access is restricted and itself recorded through the audit-of-access
sink. Broad `DELETE` grants are forbidden; the mechanism must preserve the `AUDIT_RETENTION_V1`
retain-longer fail-safe.

### F4 — Compliance-only audit access

Audit-read permission is excluded from default roles and `SUPER_ADMIN` seed grants. Only an
explicit compliance role may resolve `actor_id`, read `reason_code`, or query the authorization
audit store. The representative plane, client routes, and normal admin approval/dispute flows
cannot read it.

### F5 — Identity privacy

`actor_id` resolution is compliance-only and governed by an owned pseudonym-key lifecycle with
rotation policy. `hashed_session_fingerprint` is derived from server-side session/family identity
using a keyed hash; access-token and refresh-token material are never hash inputs.

### F6 — Request provenance

At the edge, every inbound `X-Request-ID` is overwritten. The platform creates a
collision-resistant request id before application processing; the application trusts only this
platform-stamped value. Client-provided correlation ids cannot influence deduplication or audit
joinability.

### F7 — Outbox and dead-letter lifecycle

Outbox and dead-letter stores inherit the audit store's access controls and privacy exclusions.
The outbox is transport only, not audit-of-record. After successful relay, the outbox row is
purged under the controlled retention/privilege model; the immutable AuthorizationAuditEvent is
the source of audit history. Dead-letter replay retains the same key and follows the divergence
alert rule above.

F8 tamper evidence remains optional and non-blocking for this design wave.

## GLM RF-1–RF-4 scoped remediation

This section is a documentation-only closure of the latest GLM Architecture Review findings.
It does not authorize schema creation, migration execution, table/event/outbox/queue creation,
backend/frontend changes, production activity, or real-money activity.

### RF-1 — Envelope completion and lossless mapping

The G0 envelope mapping for `AuthorizationAuditEvent` is re-issued field by field. The mapping
must classify every field as `mapped`, `mapped-with-loss`, or `requires-delta`; at stamp time,
no `requires-delta` row may remain unresolved. `request_id` and `result`/decision are lossless
and must remain joinable to the platform response/error correlation.

The required envelope includes `hashed_session_fingerprint` and separates `actor_id` from
`actor_type`. For this self-scoped commission-summary pair, `actor_id` is also the opaque
representative resource reference (`opaque_resource_id`); this equivalence is design-specific
and is not a generic future endpoint rule. `actor_type` is explicit and uses the frozen
`REP | ADMIN | SYSTEM` registry, with `REP` applying to this pair. `customer_ref` and any raw
session/token material remain forbidden.

### RF-2 — Provenance and authoritative deduplication

`request_id` is the platform-generated correlation id created before application processing.
It is never accepted from an inbound client header and is never regenerated at audit time.
The storage-level unique constraint on `(request_id, action)` is the authoritative deduplication
mechanism; application-level existence checks are advisory only.

`dedup_key` is either omitted or deterministically derived from `(request_id, action)` and may
not be an independently generated identifier. Insert conflict is an idempotent no-op when the
incoming payload is identical. Divergent `result`, decision, or other critical fields follow
the F1 inconsistency/security-alert rule and never overwrite the stored event. Replay and
dead-letter replay carry the same key and are no-ops.

### RF-3 — Coordinated cutover and rollback

The single `AUDIT_AUTHORIZATION_EVENT_MODE` switch atomically selects the legacy baseline or the
new `AuthorizationAuditEvent` path. Enabling new-table emission and disabling the endpoint's
generic `AUTHZ_DENIED` emission occur at the same coordinated activation point, with no
multi-instance double-emission window. The propagation window and behavior during propagation
must be bounded and documented; an uncoordinated pair of enable/disable flags is forbidden.

Rollback is config-level only and returns to the pre-wave generic deny-auditing baseline.
Previously written grant events remain immutable. No backfill and no cross-store reconciliation
are permitted, and DDL rollback or destructive removal after activation is forbidden.

### RF-4 — Store mechanics and consolidated migration boundary

The future audit and dead-letter stores are privilege-based append-only stores: application
principals receive no `UPDATE` or `DELETE` grants, and DDL-level rejection or an equivalent
storage control prevents destructive mutation. Retention is executed only by the separate
privileged retention/partition mechanism described above; missing or invalid retention
configuration retains data longer and never deletes early.

The outbox is transport-only, not audit-of-record, and is inserted in its own post-decision
transaction so audit persistence cannot alter authorization, financial behavior, status, or
response. Relay success may purge the outbox row only through the controlled retention/privilege
boundary; the immutable `AuthorizationAuditEvent` remains the audit source.

The later additive, forward-only migration is one consolidated wave covering exactly
`AuthorizationAuditEvent`, outbox storage, and dead-letter storage, including their indexes and
access/privacy controls. It has no legacy `AuditLog` rewrite, no backfill, no destructive-DDL
rollback, and no fork into separate ungoverned migrations. This is a future implementation
boundary only; no migration is created or run by this design update.
## Gate sequence

`Schema Delta Design → GLM Architecture Review → Claude Security Review → Implementation Authorization`

This package stops at design. No schema, migration, event, queue, or outbox exists as a result
of this document.

## Stamp Preconditions SP-1–SP-5

These stamp controls are documentation-only and do not authorize schema creation, migration
execution, table/event/outbox/queue implementation, backend/frontend change, production, or
real-money activity.

### SP-1 — Mapping completeness

The final G0 mapping has `requires-delta = 0` rows. `request_id` and `result`/decision remain
lossless and joinable to the platform correlation; any future residual requires-delta row
reopens the design delta before implementation.

### SP-2 — Retention carve-out

`AUDIT_RETENTION_V1` governs retention, access, and purge policy. The normal application write
path has no purge authority; the policy-expiry retention process is the explicit elevated-
privilege carve-out, retains longer on missing/invalid configuration, and records access.

### SP-3 — Privacy column inventory

The final column inventory asserts the absence of `amount`, `currency`, `customer_ref`, raw
token/session material, provider/payout data, credentials, and ledger internals. The audit and
dead-letter stores remain non-client-queryable, non-representative-readable, and outside normal
admin approval/dispute flows.

### SP-4 — Audit-of-access sink

Access to the audit store and dead-letter store is itself durably audited through the permitted
append-only audit-of-access sink, with the same access-control boundary and no circular dependency
on the store being accessed.

### SP-5 — Actor type enum

`actor_type` is frozen to `{REP, ADMIN, SYSTEM}`. `REP` is the sole reachable value for this
self-scoped commission-summary endpoint; no client-supplied actor or resource identifier can
widen that scope.

With SP-1–SP-5 stamped, the design remains documentation-only and is ready for the authorized
Claude Security Review. No implementation authorization is implied.
