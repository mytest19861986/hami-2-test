# Public Provider API

- `GET /api/v1/providers`
- `GET /api/v1/providers/:id`

Only `APPROVED` providers are returned. Filters include `type`, `provinceId`, `cityId`, and `specialtyId`.

Authenticated users can submit `POST /api/v1/providers/doctor-registration`, which always creates `PENDING_REVIEW`. Doctor registration requires the individual doctor's Iranian National ID; only a versioned HMAC-SHA-256 digest is stored on `DoctorProfile`. The dedicated `DOCTOR_NATIONAL_ID_HMAC_KEY` must be configured with at least 32 bytes of secret material; if absent or weak, identity-dependent operations fail closed with 503. Never reuse the customer `UserProfile.nationalId` or put this identity on generic `Provider`.

Approval of a Doctor requires its DoctorProfile identity digest. An authenticated owner can read their own provider submissions; the endpoint returns an empty array when there are none. It never returns the digest/key version.

Admin identity operations are separately permission-gated:

- `GET /api/v1/admin/providers/:id/doctor-national-id` requires `providers.doctor_national_id.read` and returns only `{ configured }`.
- `PUT /api/v1/admin/providers/:id/doctor-national-id` requires `providers.doctor_national_id.manage`; it sets/changes the digest and emits an audit event without identifier metadata.

Ordinary provider/admin projections omit digest and key-version fields. No raw or masked Doctor National ID is returned by provider APIs. HMAC key rotation requires a controlled re-key/enrollment procedure; a production rollout also requires a shared distributed rate limiter for the public lookup and an approved key backup/recovery process.
