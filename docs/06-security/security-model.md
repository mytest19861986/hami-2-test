# Security Model

Wave 1 uses normalized mobile identity, scrypt password hashes, one-time expiring OTP challenges, short-lived access tokens, and hash-only refresh sessions. Refresh rotation revokes the previous session to prevent replay, records replay detection, and sessions have both idle and absolute expiry. The current deployment is explicitly single-instance for rate-limit correctness; the in-process guard must be replaced with shared storage before multi-instance production deployment.
