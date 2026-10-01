# Authentication Threat Model

Covered by the current foundation tests: OTP one-time semantics, password hashing, refresh rotation and replay rejection, normalized mobile uniqueness, status checks, and unauthenticated/insufficient-permission rejection. Remaining risks are expiry/lockout/concurrency test depth and replacing the single-instance limiter before horizontal scaling.
