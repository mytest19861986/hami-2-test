# FW-02-R Phase 104 — Product Surface Inventory

## Web surfaces

- Public/auth: `/`, `/login`, `/register`.
- Customer: `/dashboard`, `/wallet`, `/profile`, `/addresses`, `/plans`, `/purchases`, `/memberships`, `/providers`, `/referrals`.
- Representative-related: `/sales`, `/attributed-customers`, `/commission-overview`.
- Admin: `/admin`, `/admin/users`, `/admin/providers`, `/admin/plans`, `/admin/commissions`, `/admin/settings`.

## API surfaces

- Auth/session, profile/address, providers, plans/purchases/memberships, eligibility.
- Wallet/withdrawal flows and payout reconciliation in `apps/api/src/main.mjs` and `apps/api/src/payout-core.mjs`.
- Representative attribution and commission summary: `/sales-partner/customers`, `/rep/commission/summary`.
- Admin permissions, commissions, withdrawals, compliance audit and commercial settings.

## Evidence boundary

The inventory proves source presence and route intent. It does not prove every route is deployed, connected to a live database, or production-ready.
