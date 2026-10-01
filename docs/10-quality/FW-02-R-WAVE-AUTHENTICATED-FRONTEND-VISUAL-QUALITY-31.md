# FW-02-R Wave 31 — Authenticated Frontend Visual Quality Evidence

Status: VERIFIED WITH FINDINGS

## Build and authentication evidence

- Build under review: current local Docker build from the working tree.
- Authentication used the real local password login flow for the seeded SUPER_ADMIN/USER fixture `09120000001`; no fake client state or static HTML was injected.
- Root cause fixed during this Wave: login set HttpOnly/CSRF cookies but the frontend retained only an in-memory session. A full navigation therefore returned protected pages to `/login`. `UserShell` and `AdminShell` now hydrate a minimal, allow-listed session from the existing `/auth/me` cookie contract. Tokens, national ID and raw auth payloads are not stored in browser storage.
- Authenticated login was reverified after rebuild: URL reached `/dashboard`, cookie session remained active, and protected route navigation stayed authenticated.

## Screenshot ledger

The following authenticated customer/admin-accessible routes were captured at both `390x844` and `1440x900` using Brave executable with the current Docker build. Screenshots are viewport captures (not synthetic HTML):

`docs/10-quality/evidence/wave-31/`

- Customer: `/dashboard`, `/providers`, `/plans`, `/purchases`, `/memberships`, `/wallet` — 12 screenshots.
- Admin surface reached through the authenticated SUPER_ADMIN fixture: `/admin`, `/admin/users`, `/admin/providers`, `/admin/plans`, `/admin/commissions`, `/admin/settings`, `/admin/reporting`, `/admin/wallet-reporting`, `/admin/redemptions`, `/admin/withdrawals` — 20 screenshots.
- Total: 32 screenshots; all captured URLs matched the requested route and all measured viewports had no global horizontal overflow.

## Visual findings

- P0: 0 open.
- P1: 0 open after fixes. The authentication/navigation break was fixed as a P1/P0-class blocker for authenticated evidence.
- P2: no additional styling fix was justified from the captured surfaces.
- One real runtime defect was found and fixed: `/admin/commercial-settings` queried nonexistent `CommercialSettings.createdAt`, then returned raw BigInt values. The endpoint now orders by existing `updatedAt` and serializes monetary BigInts as strings. No schema or migration changed.
- Final endpoint verification: `/api/v1/admin/commercial-settings` returned 200 with string monetary fields; no 500 remained in the final visual run.
- One expected 404 console resource was observed; no unexpected runtime exception remained in the final run.

## Role coverage boundary

The local database contains seeded USER and SUPER_ADMIN fixtures and SALES_PARTNER fixtures, but no reproducible PROVIDER or REPRESENTATIVE login fixture with approved test credentials. Provider and representative authenticated screenshot coverage therefore remains blocked by fixture availability, not by a fabricated bypass. No role or credential was created merely to manufacture evidence.

## Regression evidence

- Web tests: 53/53 PASS.
- Web lint: PASS (existing Next ESLint plugin warning only).
- Web typecheck: PASS.
- Web build: PASS.
- Docker API canonical regression remains 106/106 PASS from Wave 30A; this Wave changed only frontend session hydration plus the narrow commercial-settings response defect.
- `git diff --check`: PASS.
- Production: NONE / LOCKED / NO-GO.

## Remaining finding

`FRONTEND-VISUAL-EVIDENCE-01` is resolved for the customer and admin surfaces evidenced here. Full Wave 31 closure still requires Commander decision on whether the missing reproducible provider/representative fixtures should be supplied or whether the documented role-coverage boundary is accepted.
