# User Domain

User-domain APIs own the authenticated user's Profile and Addresses under `/api/v1/users/me/*`. Authentication and sessions remain under `/api/v1/auth/*`; no profile or address route is exposed through the Auth controller prefix.

Admin user management is exposed under `/api/v1/admin/users` and is permission-backed (`users.read`, `users.update`, `users.disable`). Responses contain no password, OTP, refresh-token, session secrets, or raw National IDs; National IDs are returned only as a masked projection.
