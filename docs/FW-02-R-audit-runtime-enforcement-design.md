# FW-02-R — Audit Runtime Enforcement Wave

## Phase 1 — Runtime Design Package

Status: design-only package. This document does not authorize backend code, event emission, schema or migration changes, relay execution, credentials, production deployment, or real-money activity.

## 1. Scope and invariants

This wave defines the runtime boundary around the already-certified Local/Test schema/store slice in migrations 0020 and 0021. The runtime layer is an observer of an authorization decision; it has no authority to alter the decision, response, payout, ledger, or beneficiary.

Required invariants:

1. The authorization decision is committed before an audit event is emitted.
2. The emitter receives a server-generated `request_id`; inbound client identifiers are ignored or replaced.
3. An identical `(request_id, action)` replay is idempotent.
4. A divergent replay for the same key preserves the stored event and creates a bounded, alertable divergence record.
5. Audit failure never changes the authorization result; the completeness gap is observable and alertable.
6. Audit data is not readable by representative, client, default admin, or `SUPER_ADMIN` paths.
7. Production remains out of scope until separate gates authorize roles, secrets, migration history, and deployment.

## 2. Emitter architecture

### Decision path

```text
request -> authorization decision -> transaction commit
                                      |
                                      +-> post-decision emitter (zero authority)
                                            |
                                            +-> audit event insert (dedup key)
                                            +-> outbox enqueue (relay payload reference)
                                            +-> divergence comparison/alert
```

The emitter is invoked only after the business decision is durable. It receives a minimal decision envelope: server request id, action, actor type, result, reason code when denied, and event timestamp/correlation metadata permitted by the certified schema. It must not receive amount, currency, customer reference, token, session, provider, or ledger material.

### Divergence handling

- If the key is absent, insert the event and enqueue the relay reference.
- If the key exists and the canonical fields match, treat the call as an idempotent replay; do not emit a second event or outbox row.
- If the key exists and canonical fields differ, retain the stored event, do not mutate it, record a closed-code divergence signal, and alert the configured compliance destination.
- The HTTP/business response remains the original authorization result in all three cases.

## 3. Cutover model

Use one configuration switch, `AUDIT_AUTHORIZATION_EVENT_MODE`, with explicitly bounded values:

| Mode | Behavior | Safety condition |
|---|---|---|
| `LEGACY` | Existing `AUTHZ_DENIED` path only | No new emitter call |
| `SHADOW` | New emitter observes and records; legacy path remains | Compare counts and divergence without changing response |
| `CANONICAL` | New emitter is the sole audit event path | Legacy event path disabled for the same decision |
| `OFF` | No new emission; alert/metric records disabled state | Local/Test emergency rollback only |

Transitions must be configuration-only and auditable. The implementation must prove no double emission in `SHADOW` and `CANONICAL`, no gap during a valid transition, and a single effective mode per process/request. A rollback from `CANONICAL` to `SHADOW` must not replay already-committed events.

## 4. Outbox relay and dead-letter model

The request path writes an outbox reference after the event decision is committed. A separate relay worker, using the least-privilege application role, claims bounded batches with a lease and retries with capped exponential backoff.

- Each relay attempt is idempotent by the event id and destination key.
- Retryable failures use a closed failure class and retain the outbox row.
- Exhausted failures create one dead-letter record with a closed failure class; raw exceptions, SQL, URLs, credentials, and connection strings are prohibited.
- Relay failure does not alter the authorization result and increments a completeness-gap metric.
- Successful relay permits dependent-row retention cleanup only after the configured retention rule.
- Dead-letter replay is a no-op for an already delivered event and remains auditable.
- Purge ordering is dependents first, then the event; if ordering cannot be proven, purge fails closed and alerts.

## 5. Access-control model

Define a dedicated compliance reader capability separate from `SUPER_ADMIN` and default roles. The compliance path must:

- use a dedicated role and endpoint/service boundary;
- deny audit reads to representative, client, default admin, and `SUPER_ADMIN` roles;
- expose only allowlisted audit fields and closed vocabularies;
- record audit-of-access without recursively emitting an unbounded audit chain;
- enforce tenant/request scope at the service boundary and database role boundary;
- keep retention/purge credentials non-interactive and unavailable to request handlers.

No existing role is granted this capability by this design document.

## 6. Evidence matrix

| ID | Scenario | Required evidence | Pass condition |
|---|---|---|---|
| RT-01 | Post-decision emission | trace + event row | response is decided before emitter; emitter cannot alter it |
| RT-02 | Identical replay | concurrent/retry test | one event and one effective outbox record |
| RT-03 | Divergent replay | stored GRANTED, arriving DENIED | stored event unchanged; closed alert emitted; response unchanged |
| RT-04 | Request id authority | inbound forged id test | server id is used; inbound id cannot select/overwrite event |
| RT-05 | `LEGACY` mode | mode matrix test | legacy behavior only |
| RT-06 | `SHADOW` mode | dual-path count test | no duplicate effective event; comparison metric recorded |
| RT-07 | `CANONICAL` mode | cutover test | new path sole emitter; no legacy duplicate |
| RT-08 | Relay retry | injected transient failures | bounded retries; authorization result unaffected |
| RT-09 | Dead-letter | exhausted failure | one closed-code dead-letter; no raw exception data |
| RT-10 | Dead-letter replay | replay after delivery | no duplicate side effect; audit trail retained |
| RT-11 | Purge ordering | dependency retention test | dependents expire before event, or purge fails closed and alerts |
| RT-12 | Access denial | role matrix | representative/client/default admin/`SUPER_ADMIN` denied |
| RT-13 | Audit-of-access | compliance read trace | access is durably recorded without recursion runaway |
| RT-14 | Runtime privacy | emitted rows/log scan | no amount, currency, customer, token, session, provider, or ledger data |
| RT-15 | Failure semantics | outbox unavailable test | fail-open business response plus completeness alert |

## 7. Closure gates

This design wave is complete only when the implementation wave has named tests and artifacts for RT-01 through RT-15, records the exact mode and role wiring, and obtains a separate security review. `SECURITY_PASS` for migrations 0020/0021 does not certify any item in this runtime matrix.

## 8. Explicit prohibitions

No code, schema, migration, dependency, production configuration, provider connection, credential, real data, or real-money movement is authorized by this document.

## 9. RF-1 — Full stamped emitter envelope

The emitter records the complete stamped envelope at the same post-decision boundary. “Minimal” means exclusion of forbidden material, not omission of mandated fields. The durable envelope includes `request_id`, `actor_id`, `actor_type`, entity/resource reference, endpoint, capability, result, deny `reason_code` when applicable, server timestamp, `hashed_session_fingerprint`, `schema_version`, and allowlisted trace/correlation identifiers. Raw session identifiers and tokens are forbidden; the non-reversible hashed session fingerprint is a distinct, required field. No later enrichment may turn an incomplete event into the audit-of-record.

## 10. RF-2 — Mode supersession and provenance

`AUDIT_AUTHORIZATION_EVENT_MODE` supersedes the prior single-switch/boolean wording and is the sole mode selector. Missing or invalid configuration resolves to the LEGACY baseline and raises an operational alert. `OFF` is Local/Test emergency-only; production configuration rejects it and resolves to LEGACY plus alert. Every event carries immutable emission-mode and provenance tags. Effective-stream membership is read atomically at decision time and is never retroactively reclassified: LEGACY uses the generic legacy stream; SHADOW records tagged shadow rows excluded from canonical accounting while the legacy event remains effective; CANONICAL makes the new event effective. Mode transitions are configuration-only and audited.

## 11. RF-3 — Outbox mutable-state boundary

Relay leases, attempt counters, retry state, and failure classification are mutable only in outbox/relay storage. The immutable audit store is INSERT-only from the relay; lease or marker updates never touch audit rows. The outbox remains transport, not audit-of-record. Purge dependents are the outbox references and dead-letter copies; they must expire before the event, otherwise purge fails closed and alerts.

## 12. RF-4 — Compliance boundary reconciliation

The compliance reader is an explicit superseding clarification of the schema-delta “no endpoint” clause: it is an internal-plane, deny-by-default, read-only service boundary and is outside the mutation plane; it creates no public or representative/admin endpoint and grants no role by this design. Its capability remains a later registry/grant process. Audit-of-access is written to the designated non-recursive sink, and access-audit events have terminal generation/depth 1: they are never themselves re-audited as access events. Denied SUPER_ADMIN access attempts are auditable.

## 13. RF-5 — Expanded evidence matrix

The implementation evidence must additionally prove:

| ID | Scenario | Pass condition |
|---|---|---|
| RT-16 | Mode transition byte identity | Business response bytes are identical across LEGACY → SHADOW → CANONICAL. |
| RT-17 | Exactly one effective event | One effective event per decision in each mode; SHADOW rows are explicitly excluded from canonical accounting. |
| RT-18 | Production OFF rejection | Production rejects OFF and resolves to LEGACY with an alert. |
| RT-19 | Canonical completeness metric | Completeness-gap metric counts canonical stream gaps only; shadow rows are excluded. |

The matrix also records atomic per-decision mode reads, transition audit events, bounded divergence alerts, closed relay registry parameters, and the no-raw-session/no-raw-token distinction for the hashed fingerprint.

## 14. Final stamp preconditions SP-A through SP-E

The following documentation-only preconditions are stamped as satisfied for this design wave. They do not authorize implementation, schema change, migration, event creation, relay creation, endpoint exposure, credential use, production action, or real-money movement.

- **SP-A — Cross-document supersession pointer:** This runtime design is the authoritative source for the four-value `AUDIT_AUTHORIZATION_EVENT_MODE` enum and its per-decision effective-stream semantics. It supersedes any earlier boolean/single-switch wording in the audit grant/deny schema-delta document; the schema-delta document remains authoritative for storage columns and constraints. No reader may apply the superseded boolean independently.
- **SP-B — Downstream access-API deferral:** The compliance reader boundary specified here is internal-plane, deny-by-default, read-only, and outside the mutation plane. This wave does not define paging, error semantics, field shapes beyond the allowlist, or a public access API. Those details require a separate downstream review and authorization.
- **SP-C — Audit-of-access sink:** The designated sink is the existing append-only legacy `AuditLog` access-audit plane, with terminal depth-1 semantics. Access-audit events are not recursively emitted as further access-audit events. No new sink, table, endpoint, or role is created by this stamp.
- **SP-D — Retention carve-out:** Retention and purge execute only through the policy-expiry process under `AUDIT_RETENTION_V1`, with elevated non-interactive credentials outside request handlers and normal write paths. Missing or invalid retention configuration retains data and never permits early deletion. The dependent-first ordering in RF-3 remains mandatory.
- **SP-E — Resource-reference and shadow-row privacy:** For the self-scoped endpoint, the entity/resource reference is the opaque `actor_id` equivalence defined by the stamped schema-delta mapping; it is not an independently populated customer identifier. Runtime privacy absence assertions apply to canonical and shadow-tagged rows alike, including explicit exclusion of raw session/token material while requiring only the hashed fingerprint.

### Final documentation stamp

SP-A through SP-E are recorded as documentation-complete. The design is ready for the separately authorized Claude Security Review. Implementation remains locked until that review, the behavior-unchanged gate, and an explicit implementation authorization are complete.

## 15. Claude follow-up documentation fixes

### RT-20 — Constrained emitter role wiring

The future emitter implementation must connect to the dedicated least-privilege `hami_audit_app` role for audit-store writes. It must not use the general API application role, a superuser, or any role with unrelated mutation authority. Evidence must identify the runtime connection role and demonstrate that the general API role cannot write to the immutable audit store; this is an implementation-wave entry criterion, not an implementation performed by this document.

### RT-01 through RT-20 coverage mapping

| Evidence IDs | Covered design commitments |
|---|---|
| RT-01–RT-04 | G0 invariants, post-decision zero-authority, server-generated request identity, replay/divergence integrity; RF-1 and RF-2 |
| RT-05–RT-07 | `AUDIT_AUTHORIZATION_EVENT_MODE`, effective-stream membership, cutover and no-double-emission/no-gap; RF-2 |
| RT-08–RT-11 | Outbox transport boundary, relay retry, dead-letter, replay, purge ordering; RF-3 and SP-D |
| RT-12–RT-13 | Compliance boundary, role exclusions, audit-of-access and recursion termination; RF-4 and SP-B/SP-C |
| RT-14–RT-15 | Runtime privacy and fail-open/completeness semantics; RF-1, RF-3, RF-5 and SP-E |
| RT-16–RT-19 | Mode-transition byte identity, exactly-one-effective-event/shadow exclusion, production OFF rejection, canonical completeness metric; RF-2 and RF-5 |
| RT-20 | Constrained `hami_audit_app` role wiring and separation from the general API role; implementation least-privilege gate |

This mapping is explicit and is not a claim that any runtime test has already been executed.
