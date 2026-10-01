# Authentication API

- `POST /api/v1/auth/register/request-otp`
- `POST /api/v1/auth/register/verify-otp`
- `POST /api/v1/auth/register/set-password`
- `POST /api/v1/auth/login/password`
- `POST /api/v1/auth/login/request-otp`
- `POST /api/v1/auth/login/verify-otp`
- `POST /api/v1/auth/refresh`
- `POST /api/v1/auth/logout`
- `GET /api/v1/auth/me`
- `GET /api/v1/auth/admin/users` (requires `users.read`)

Development OTP codes are returned only outside production. No plaintext password, OTP, or refresh token is persisted.
