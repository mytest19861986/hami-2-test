# Frontend Architecture — HC-W6-01

Next.js Pages Router with a shared API client in `apps/web/lib/api-client.js`, session helpers, and a protected user shell. Backend permissions remain authoritative; `can(permission)` is visibility UX only. Current B3 routes are `/login`, `/register`, `/dashboard`, `/profile`, and `/addresses`.

All data pages use real API responses and expose loading, empty, error, and success states. RTL is established with `lang="fa"` and `dir="rtl"` on each shell. Docker is the validation authority because host npm is unavailable.
