# FW-02-R Product Quality Audit 12

Date: 2026-10-01
Environment: LOCAL / TEST ONLY
Scope: cross-domain consistency, frontend/API alignment, security regression, and documentation sync.

## Executive result

| Area | Result | Evidence | Priority |
|---|---|---|---|
| Identity → profile/address ownership | COMPLETE | `apps/api/test/auth.test.mjs`, `apps/web/pages/profile.jsx`, `apps/web/pages/addresses.jsx`, full API regression | — |
| Provider → plan benefit → eligibility → Redemption | COMPLETE | `apps/api/src/eligibility.mjs`, `apps/api/src/redemption-domain.mjs`, `apps/api/test/redemption-http.matrix.test.mjs`, customer/provider/admin pages | — |
| Wallet/commission/withdrawal boundaries | COMPLETE for current regression scope | financial integration tests and 106/106 canonical API regression; Redemption matrix asserts no count mutation | — |
| Frontend surface consistency | PARTIAL | shared shell/foundation exists; legacy pages still use older `card`/`stack` primitives alongside `ui-card`/`ui-stack` | P2 |
| API consumer inventory | PARTIAL | all critical customer/provider/admin Redemption routes have consumers; several admin purchase/membership endpoints have no dedicated current page action | P2 |
| Security regression | COMPLETE | AUTH/CSRF tests, provider/customer isolation, HTTP Redemption matrix; 106/106 PASS | — |
| Documentation sync | OUTDATED | `docs/09-project-status/CURRENT_STATUS.md` still reports Phase-1, 16 migrations, and no active work; current repository is migration 0022 with Waves 08B–11 accepted | P1 |
| Frontend API contract document | OUTDATED / MISSING | `docs/05-api/frontend-api-contract.md` stops at B3 auth/profile/address and omits providers, plans, wallets, commissions, withdrawals, and Redemption | P1 |
| Visual evidence | PARTIAL | browser runtime is available, but authenticated current local session/build was not established; no screenshot is claimed | P2 |

## Cross-domain findings

### COMPLETE — Redemption authority boundaries

Eligibility returns safe `membershipId`, `planId`, and `providerId` references; initiation remains server-authoritative. Raw verification tokens are returned only by the initiation response, are not persisted in raw form, and are absent from history/admin projections. Provider confirmation is scoped through provider membership and approved provider state. Admin reversal requires the `redemptions.reverse` permission and a reason.

Evidence: `apps/api/src/eligibility.mjs`, `apps/api/src/redemption-domain.mjs`, `apps/api/src/main.mjs`, `apps/api/test/redemption-http.matrix.test.mjs`.

### PARTIAL — repeated presentation/status logic

`apps/web/lib/presentation.js` is the shared status source, but multiple older pages retain local label maps and older layout class names. This is a consistency debt, not a security boundary. Recommendation: consolidate during the next UI maintenance pass; do not mix into production/payment work.

### PARTIAL — route/consumer parity

The current frontend consumes the core customer, provider, representative, and admin dashboard routes plus the Redemption routes. The API also exposes admin purchase/membership detail and several operational mutation routes whose current dedicated UI coverage is limited or absent. These routes are protected and covered by API tests; absence of a UI consumer is a product-surface gap, not an authorization bypass.

### OUTDATED — project status and roadmap

`docs/09-project-status/CURRENT_STATUS.md` and `docs/09-project-status/next-steps.md` describe an earlier Phase-1 state, 16 migrations, and host-npm remediation as the next task. They do not reflect migration 0022, Security Reconciliation closure, Runtime 09, Frontend 10B, or Polish 11. Recommendation: update status/roadmap with the accepted Waves and retain screenshot evidence as the only open non-blocking finding.

### OUTDATED — API contract documentation

`docs/05-api/frontend-api-contract.md` documents only B3 routes. It should be extended with the current provider/benefit/eligibility, wallet/withdrawal, commission/representative, and Redemption contracts, including safe response fields and authorization scope. No code change is required for this finding.

## Regression evidence

- Web tests: 51/51 PASS.
- Web lint/typecheck/build: PASS; 32 routes generated.
- API typecheck/lint: PASS.
- Canonical API regression: 106/106 PASS.
- HTTP Redemption matrix: PASS.
- Nginx health: PASS.
- `git diff --check`: PASS.
- Production actions: NONE.

## Recommended next actions

1. Update `CURRENT_STATUS.md`, `next-steps.md`, and `frontend-api-contract.md` to the actual accepted Wave state (P1 documentation debt).
2. Keep visual screenshot evidence open as non-blocking until an authenticated current local session is available.
3. Schedule a separate low-risk frontend consistency cleanup for duplicated labels/layout classes (P2).

No migration, payment integration, wallet redesign, commission redesign, withdrawal redesign, or production action is authorized by this audit.
