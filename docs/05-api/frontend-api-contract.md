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
