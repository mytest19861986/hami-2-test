# FW-02-R-WAVE-PSP-REFUND-VERIFICATION-GATE-36

**Status:** `BLOCKED_BY_PROVIDER_SELECTION`
**Mode:** LOCAL / TEST ONLY
**Production:** LOCKED / NO-GO
**Runtime/schema changes:** None

## Current provider inventory

| Check | Repository evidence | Result |
|---|---|---|
| Payment provider / gateway | No provider adapter, SDK, API client, provider name, or payment-gateway configuration found in API source, web source, Prisma schema, Compose, Nginx, or `.env.example` | **No PSP identified** |
| Existing payment flow | `POST /api/v1/admin/purchases/:id/confirm-payment` accepts a caller-supplied `paymentReference`; the API itself changes `PENDING_PAYMENT` to `PAID` and creates the membership (`apps/api/src/main.mjs`, payment handler and route registration) | Internal/manual confirmation only; not provider verification |
| Merchant/provider identifiers | No merchant ID, terminal ID, provider account identifier, or provider-specific secret/config key in the checked source/config | None found |
| Authoritative payment reference | `PlanPurchase.paymentReference` is unique, but no provider operation/entity binds it to an external PSP response | Local reference field only; external authority unproven |
| Refund initiation / status inquiry | No PSP refund client, server-to-server inquiry, or refund endpoint integration found | None found |
| Callback / webhook | No PSP callback route or provider event handler found | None found |
| Authentication / signature verification | No PSP signature/MAC verification code or provider authentication contract found | None found |
| Sandbox/test endpoint | No provider sandbox URL or named PSP test configuration found | None found |
| Real provider candidates in source/config | No named candidates found | **No candidates to select from repository evidence** |

The test fixtures use synthetic strings such as `HTTP-*`, `W33-*`, and
`REFUND-CASE-*`; these are test references, not evidence of a real provider or
provider integration. `.env.example` contains database and application-auth
settings only, with local placeholders; it has no PSP settings.

## Source-of-truth contract (provider protocol not yet selectable)

The Commander decision remains: authoritative completion must come from either
an authenticated backend-to-PSP status inquiry or a cryptographically verified
PSP completion event. Before any future `REFUNDED` transition, verification
must establish valid provider identity/authentication, authoritative
`SUCCESS`/`COMPLETED`, matching original payment and purchase, a present and
unique provider refund ID, exact amount and currency, eligible case state, and
replay-safe provider event/request identity.

Because no provider is identified, the provider-specific initiation method,
inquiry endpoint, webhook format, signature algorithm/key rotation, identifier
semantics, amount/currency encoding, completion statuses, replay headers, and
sandbox behavior **cannot be verified from official provider documentation**.
No provider protocol or adapter is inferred or fabricated in this Wave.

## Security and failure boundary

| Threat / condition | Required result |
|---|---|
| Forged, unauthenticated, or unverifiable event | Reject; audit safely; no `REFUNDED` transition or reversal |
| Replay / duplicate completion | Reject or idempotently absorb by provider event/request identity |
| Purchase or original payment reference mismatch | Freeze for reconciliation; no mutation |
| Refund ID absent/duplicate, wrong amount, or wrong currency | Freeze for reconciliation; no mutation |
| Timeout, temporary provider failure, ambiguous response, or success without verifiable identity | Keep unresolved; no speculative retry or completion claim |
| Late/contradictory event or conflict with operator-entered reference | Preserve evidence as discrepancy; no silent mutation |
| Secrets in repository, docs, or logs | Prohibited; no credentials were requested or introduced |

## Wave 37 entry conditions

Wave 36 is blocked pending explicit Project Owner/Commander identification of
the actual PSP (or authoritative repository/config evidence naming it) and
availability of its official integration documentation plus a sandbox/test
environment. After selection, verify the official contract before proposing
or implementing a provider adapter. A later implementation wave must remain
LOCAL/TEST, keep credentials in local environment/secret storage, and must not
perform wallet, commission, referral, or `Purchase -> REFUNDED` mutations under
this Wave 36 authorization.

## Evidence and disposition

- Inspected payment handler and route registration in `apps/api/src/main.mjs`.
- Inspected `PlanPurchase` fields and migrations, `.env.example`,
  `docker-compose.yml`, `infra/nginx/default.conf`, and refund contract Wave 34.
- Searched API/web/database/config sources for provider names, gateway clients,
  merchant identifiers, callback routes, and signature verification.
- Repository contains no selectable real PSP or sandbox evidence.
- No runtime, schema, migration, credentials, provider connection, or financial
  side effect was added by Wave 36.

**Disposition:** `BLOCKED_BY_PROVIDER_SELECTION` — report only; do not create a
mock/placeholder PSP adapter or claim refund verification readiness.
