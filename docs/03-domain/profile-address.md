# User Profile and Address

HC-W2-01 keeps commercial identity separate from authentication. `UserProfile` is the one-to-one source of truth for first name, last name, optional birth date, and optional unique national ID. The nullable `User.nationalId` field is legacy-only and is not an eligibility source of truth.

National IDs are normalized by trimming and removing whitespace/hyphens, then requiring ten ASCII digits, rejecting repeated-digit values, and validating the Iranian checksum before persistence. `UserProfile.nationalId` is unique. The raw value is used only for authorized matching and persistence; profile and admin APIs expose only `maskedNationalId`, and `/auth/me` omits it. It must not appear in logs or generic audit metadata.

`Address` is a user-owned one-to-many entity. Each address has a recipient, normalized phone, `provinceId`, `cityId`, ten-digit postal code, address lines, and an optional default flag. `Province` and `City` are shared Geography entities, with deterministic local Tehran seed data and idempotent-safe unique keys. All profile and address routes require an active authenticated user and scope updates/deletes by `userId`; default-address changes are transactional.

Canonical API routes:

- `GET/PUT /api/v1/users/me/profile`
- `GET/POST/PUT/DELETE /api/v1/users/me/addresses`
- `PUT /api/v1/users/me/addresses/:id/default`
- `GET /api/v1/locations/provinces`
- `GET /api/v1/locations/provinces/:id/cities`

The current local implementation uses migrations `0005_profile_address` and `0006_geography`. Wallet, referral, commission, and provider domains remain outside this wave.
