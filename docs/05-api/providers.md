# Public Provider API

- `GET /api/v1/providers`
- `GET /api/v1/providers/:id`

Only `APPROVED` providers are returned. Filters include `type`, `provinceId`, `cityId`, and `specialtyId`.

Authenticated users can submit `POST /api/v1/providers/doctor-registration`, which always creates `PENDING_REVIEW`.
