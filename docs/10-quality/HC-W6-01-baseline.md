# HC-W6-01 Frontend Baseline

Date: 2026-09-27

## Frontend

- Framework: Next.js 15.1.6, React 19, Pages Router.
- Current route tree: `/` only (`apps/web/pages/index.jsx`). No middleware or layouts.
- Auth/session handling: none in the web app. API supports bearer access tokens and refresh sessions.
- API client/state: none; the page is static.
- UI dependencies: React/Next only; no component library or Tailwind setup.
- RTL: root page uses `dir="rtl"`; no document-level `lang`, global styles, or RTL guidelines yet.
- Existing test: one source smoke test for the RTL foundation shell.

## Validation before changes

| Check | Result | Evidence |
|---|---|---|
| Web lint/typecheck/test/build on host | BLOCKED | `npm` is unavailable on host |
| Docker Compose services | PASS | db, api, web, nginx healthy |
| API health | PASS | API container healthcheck |

## Real API inventory

Confirmed in `apps/api/src/main.mjs` and API docs: auth register/login/OTP/refresh/logout/me, profile, addresses, locations, providers, benefit plans/purchases/memberships/eligibility, rewards/referrals/wallet, sales attribution/commission, and admin routes. Backend is the authority for permissions; frontend must use permission-aware visibility only.

## Missing/partial frontend contracts

- No frontend route map, central client, session store, error mapper, or permission model exists.
- API contract is partial in docs and implemented routes; UI must use only verified paths from `main.mjs`.
- Production endpoint discovery and UI flows remain implementation work for HC-W6-01.

## Known debt

Host-side Node tooling is unavailable; Docker is the validation path. The existing API is a single local process and should not be redesigned as part of this task.
