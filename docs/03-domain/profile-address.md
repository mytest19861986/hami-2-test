# User Profile and Address

HC-W2-01 keeps commercial identity separate from authentication. `UserProfile` is a one-to-one extension of `User` and contains only first name, last name, optional birth date, and an optional unique national ID.

National IDs are normalized to ten digits and validated with the Iranian checksum before persistence. The value is nullable until profile completion and must not be exposed in logs or generic audit metadata.

`Address` is a user-owned one-to-many entity. Each address has a recipient, normalized phone, `provinceId`, `cityId`, ten-digit postal code, address lines, and an optional default flag. `Province` and `City` are shared Geography entities, with deterministic local Tehran seed data and idempotent-safe unique keys. All profile and address routes require an active authenticated user and scope updates/deletes by `userId`; default-address changes are transactional.

Canonical API routes:

- `GET/PUT /api/v1/users/me/profile`
- `GET/POST/PUT/DELETE /api/v1/users/me/addresses`
- `PUT /api/v1/users/me/addresses/:id/default`
- `GET /api/v1/locations/provinces`
- `GET /api/v1/locations/provinces/:id/cities`

The current local implementation uses migrations `0005_profile_address` and `0006_geography`. Wallet, referral, commission, and provider domains remain outside this wave.
