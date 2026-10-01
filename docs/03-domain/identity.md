# Identity and Authentication

Mobile numbers are normalized to the `+989...` form before uniqueness checks. Registration uses a separate `OtpChallenge`; OTP values are hashed, expire after five minutes, and are consumed once with a five-attempt limit. Passwords use Node.js `scrypt` with a random salt.

`AuthSession` stores only a hash of the refresh token. Access tokens are short-lived signed tokens; refresh rotates the session and revokes the previous session. `PENDING`, `SUSPENDED`, and `DISABLED` users cannot log in.
