# Wave 41 — Support operator least-privilege evidence

Environment: local disposable Docker stack only (`http://localhost:8081/support`). The browser session uses a synthetic SUPPORT account and synthetic local records. No production service, database, payment provider, or real customer dataset was used.

## Implementation and security checks

- SUPPORT has a seven-permission `support.*.read` allowlist. The server-side permission guard rejects all other capabilities for SUPPORT-only users, even if unrelated permissions are accidentally linked to the role.
- Runtime audit initially found 13 grants on the local SUPPORT role, including unrelated mutation grants. The startup seed now removes every grant outside the seven-item allowlist; after API restart, the database role contained exactly the seven expected read permissions. No migration was needed. The Support API guard continues to enforce this allowlist independently of grants.
- The read-only routes return only fields rendered by the support UI. They omit user/provider/purchase identifiers, contact details, national identifiers, payment references, amounts, tokens, beneficiaries, and mutation controls.
- Live local projection spot-check on `/api/v1/support/users`: 100 returned records; observed object keys were exactly `status`, `createdAt`, and `displayName`; no `phone`, national-ID, credential, or token key was present. The test login was logged out immediately afterward.
- Local disposable-DB HTTP matrix: unauthenticated and Customer/Sales Partner requests to Support routes denied; SUPPORT allowed only on its seven read routes; an intentionally over-privileged SUPPORT role denied attempted user-status, commercial-settings, withdrawal-approval, refund, and redemption-reversal operations; SUPER_ADMIN behavior remains available.
- No schema or migration changes.

## UI evidence

- `support-desktop-1440x900.png`: authenticated dashboard at 1440×900, RTL, sidebar bounds x=1177..1425 and content bounds x=0..1177, no horizontal overflow (scroll/client width 1425px).
- `support-mobile-390x844.png`: authenticated dashboard at 390×844, collapsed sidebar, responsive single-column cards, no horizontal overflow (390/390px).
- `support-mobile-drawer-390x844.jpg`: mobile navigation open from the right; drawer bounds x=70..390 are inside the viewport and document width remains 390px.
- Brave console inspection returned no warning or error entries for the Support page.

## Build/test status at capture

- Web lint and typecheck: PASS.
- Web tests: 61/61 PASS.
- Web production build: PASS.
- API lint and typecheck: PASS.
- API Support permission/projection unit tests: 2/2 PASS.
- API TypeScript build: PASS.
- Fresh API and Web Docker image builds: PASS.
- `git diff --check`: PASS on the current Wave 41 HEAD (`53d9f482d12870b3916765cafdd8801431f12e80`).
- Full API suite, run inside the disposable API container with `HEALTH_BASE_URL=http://127.0.0.1:4000` and `--test-concurrency=1`: **117/117 PASS, 0 FAIL, 0 SKIP**.
- Diagnostic parallel API run: 115/117 passed. The health test's default URL (`127.0.0.1:8080`) is not the API container's port, and the redemption HTTP matrix's shared-database aggregate-count assertion races other DB-mutating test files when Node runs them concurrently. Running those two tests alone with the correct health URL passed 2/2. This is test-harness isolation/configuration debt; no production-code regression was observed. The passing canonical result is the sequential in-container run above.
- Running DB-dependent API tests from the Windows host is not a valid setup because they use Compose-only service names; run them inside the disposable in-network API container instead.

Production remains LOCKED / NO-GO.
