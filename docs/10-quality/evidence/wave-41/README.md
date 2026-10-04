# Wave 41 — Support operator least-privilege evidence

Environment: local disposable Docker stack only (`http://localhost:8081/support`). The browser session uses a synthetic SUPPORT account and synthetic local records. No production service, database, payment provider, or real customer dataset was used.

## Implementation and security checks

- SUPPORT has a seven-permission `support.*.read` allowlist. The server-side permission guard rejects all other capabilities for SUPPORT-only users, even if unrelated permissions are accidentally linked to the role.
- The read-only routes return only fields rendered by the support UI. They omit user/provider/purchase identifiers, contact details, national identifiers, payment references, amounts, tokens, beneficiaries, and mutation controls.
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
- `git diff --check`: PASS before the final field-minimization patch; rerun before commit.
- Full API suite from the Windows host is not a valid result: DB-dependent tests target the Compose hostname `db:5432`, which is unavailable from the host. The full run therefore had environment-caused failures; API route authorization was separately exercised against the disposable in-network DB/API stack.

Production remains LOCKED / NO-GO.
