# FW-02-R Phase 104 — Next Development Wave

## Wave ID

`FW-02-R-WAVE-DASHBOARD-FOUNDATION-01`

## Objective

Deliver a non-production dashboard foundation that turns existing domain APIs into explicit, testable customer, representative and admin operational views.

## Exact scope

Define and implement locally only: KPI/data contract, read-only aggregation endpoints, dashboard information architecture, representative/admin navigation gaps, and browser tests using fixtures. No provider connection, production deployment, credential use, migration, or real-money flow.

## Likely modules

- `apps/web/pages/dashboard.jsx`, `apps/web/pages/commission-overview.jsx`, `apps/web/pages/admin/index.jsx`.
- New read-only dashboard/API modules under `apps/api/src` only after contract review.
- `apps/web/test` and `apps/web/e2e` for acceptance coverage.
- `docs/05-api` and dashboard architecture documentation.

## Dependencies

Existing auth/RBAC contracts, wallet/commission read models, seeded local fixtures, and the retained Finding/Exception governance state.

## Acceptance criteria

One explicit KPI contract; distinct customer/representative/admin views; no fabricated metrics; permission checks documented and tested; fixture-backed local browser flow; `git diff --check` and existing checks pass; production remains locked.

## Risks and test plan

Risk: confusing design-only surfaces with verified runtime behavior. Test route rendering, authorization denial, empty/degraded states, fixture data, and cross-role visibility. Keep all external dependencies mocked or local.
