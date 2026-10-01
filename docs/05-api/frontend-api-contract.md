# Frontend API Contract — HC-W6-01 B3

Verified routes used by B3:

| UI flow | Method | Route | Auth |
|---|---|---|---|
| Password login | POST | `/api/v1/auth/login/password` | No |
| OTP login request/verify | POST | `/api/v1/auth/login/request-otp`, `/api/v1/auth/login/verify-otp` | No |
| Registration OTP/verify/password | POST | `/api/v1/auth/register/request-otp`, `/api/v1/auth/register/verify-otp`, `/api/v1/auth/register/set-password` | No |
| Refresh/logout/me | POST/GET | `/api/v1/auth/refresh`, `/api/v1/auth/logout`, `/api/v1/auth/me` | Session/bearer as applicable |
| Profile | GET/PUT | `/api/v1/users/me/profile` | Bearer |
| Addresses | GET/POST/PUT/DELETE/PUT | `/api/v1/users/me/addresses`, `/api/v1/users/me/addresses/:id`, `/api/v1/users/me/addresses/:id/default` | Bearer |
| Geography | GET | `/api/v1/locations/provinces`, `/api/v1/locations/provinces/:id/cities` | No |

No new endpoint is introduced by the frontend. Errors are mapped centrally to friendly status categories.

## Current post-B3 surfaces

| UI flow | Method | Route | Scope |
|---|---|---|---|
| Provider discovery/detail | GET | `/api/v1/providers`, `/api/v1/providers/:id` | Public approved providers only |
| Eligibility | GET | `/api/v1/providers/:providerId/eligibility` | Authenticated customer; server-authoritative |
| Customer Redemption | POST/GET | `/api/v1/redemptions`, `/api/v1/users/me/redemptions`, `/api/v1/redemptions/:id`, `/api/v1/redemptions/:id/cancel` | Customer-owned scope; cancel only INITIATED |
| Provider Redemption | GET/POST | `/api/v1/providers/me/redemptions`, `/api/v1/providers/me/redemptions/confirm` | Current provider membership scope |
| Admin Redemption | GET/POST | `/api/v1/admin/redemptions`, `/api/v1/admin/redemptions/:id/reverse` | `redemptions.reverse`; reversal reason required |
| Customer wallet/withdrawal | GET/POST | `/api/v1/users/me/wallet`, `/api/v1/users/me/wallet/transactions`, `/api/v1/users/me/wallet/withdrawals` | Self-scoped; financial authority remains backend |
| Representative commission | GET | `/api/v1/rep/commission/summary` | Capability-gated read-only projection |

Redemption raw verification tokens appear only in the successful initiation response. They are not recoverable through history/GET routes and are never a frontend persistence source. Backend enums remain unchanged; UI uses the shared Persian presentation mapping.
