# FW-02-R Sprint 1 — Attributed Customers View

## Status

Implementation complete in Local/Test only. Scope is limited to the representative's attributed-customer collection; no commission, withdrawal, financial mutation, provider, production, API invention, or schema change was added.

## Implementation

- Added `/attributed-customers` with backend-driven loading, empty, error, degraded, and unauthorized states.
- Reused the existing `GET /api/v1/sales-partner/customers` collection and existing permission boundary.
- Server-side response filtering now exposes only `customerRef`, pre-masked `displayAlias`, attribution `status`, opaque row `id`, and `createdAt`; raw customer IDs are not returned.
- Added the route to the authenticated shell navigation.

## Validation

- API regression: 71/71 PASS.
- Web build: PASS; route generated as `/attributed-customers`.
- Sprint 1 web contract test: PASS.
- Existing web suite: baseline profile-source assertions were corrected without changing runtime behavior; full rerun pending after image rebuild.

## Security checks

- Existing backend authentication and `sales_attributions.read` permission are required.
- Direct access without permission resolves to generic 403 through the existing API boundary and renders the unauthorized state.
- No raw phone, email, name, address, customer UUID, order value, payment amount, commission, or withdrawal data is rendered.
- No client role or client-provided capability is trusted.

## Known limitations

The frozen contract names `VIEW_ATTRIBUTED_CUSTOMERS` as a capability; this repository's existing authorization surface represents that capability through the existing `sales_attributions.read` permission. No new schema or invented endpoint was introduced.
