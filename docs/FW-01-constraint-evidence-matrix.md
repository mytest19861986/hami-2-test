# FW-01 Constraint → Evidence Matrix

Date: 2026-09-27

Documentation-only closure record for the frozen FW-01 frontend validation snapshot. No implementation, API, schema, dependency, migration, provider, credential, release, or production changes are authorized by this record.

| Frozen constraint | Evidence | Status |
|---|---|---|
| Single-flight token refresh | `apps/web/test/auth-layer.test.mjs`; PRW-03 session-family semantics | CLOSED |
| Neutral `PAYOUT_UNKNOWN` | `apps/web/test/financial-views.test.mjs`; `apps/web/test/phase7-frontend-coverage.test.mjs` | CLOSED |
| Fee exclusion from user transaction view | `apps/web/test/financial-views.test.mjs`; PRW-05 settlement closure manifest | CLOSED |
| No optimistic financial mutation | `apps/web/test/dashboard.test.mjs`; frozen withdrawal-flow validation | CLOSED |
| `429` / `retryAfterMs` handling | `apps/web/test/error-loading-degraded.test.mjs` | CLOSED |
| Session-derived ownership and data minimization | frontend API contract and FW-01 design closure manifest | CLOSED |
| Loading/error/degraded states | `apps/web/test/error-loading-degraded.test.mjs` | CLOSED |
| RTL, responsive, Jalali/Tehran display requirements | `apps/web/test/phase7-frontend-coverage.test.mjs` | CLOSED |

Aggregate validation evidence remains 30/30 frontend tests PASS, ESLint PASS, TypeScript PASS, Next production build PASS with 24/24 static pages, and Docker Compose config validation PASS.
