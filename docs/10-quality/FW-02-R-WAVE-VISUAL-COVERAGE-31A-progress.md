# Wave 31A — current verification progress

Status: FINAL VERIFICATION PASSED; ready for commit/push closure.

This is a chronological progress ledger. If dated checkpoints conflict, the
latest dated section is authoritative; closure remains open until privacy-safe
Gemini/Qwen review, remaining evidence classification, repository push, and a
clean working tree are complete. The final dated addendum below supersedes
earlier checkpoint statements about pending runtime, review, or push work.

## Authoritative follow-up — isolated visual evidence and reviews (2026-10-03)

Commander selected the isolated-DB path; persistent-DB Admin screenshots must
not be shared. A fresh `hami_visual_31a` database was created inside the
already-disposable `hami-wave31a-isolated-db` PostgreSQL test container (its
anonymous test-only volume is distinct from the persistent `hami-db-1` volume;
no new dedicated volume was created). Existing migrations 0001–0022 were
deployed. The persistent local database was not changed. Only synthetic local
fixtures were seeded: one SUPER_ADMIN at capture time (real `users.read`),
Customer USER, Provider USER with OWNER membership and APPROVED synthetic
provider, and SALES_PARTNER Representative. Passwords remain outside source,
docs, logs and screenshots.

The current Web image ran against this database on local port 18080 through a
separate visual API/Web/Nginx stack. Fresh real password login and protected
page rendering succeeded for Admin, Customer, Provider, and Representative.
Unauthenticated `/auth/me` returned 401; authenticated Representative session
rendered `/rep-dashboard`, and the previously captured local persistent-DB
evidence independently verified `SALES_PARTNER` + `commissions.summary_read`.
Provider showed only the synthetic approved clinic. No real SMS, payment,
vendor, or production service was used. Browser console logs were empty on all
four captured routes.

Privacy-reviewed, current-build screenshots from the isolated DB are the only
visual evidence approved for external review:

- Admin: `admin-dashboard-390x844-isolated.jpg`,
  `admin-dashboard-1440x900-isolated.jpg`, `admin-drawer-390x844-isolated.jpg`.
- Customer: `customer-dashboard-390x844-isolated.jpg`,
  `customer-dashboard-1440x900-isolated.jpg`.
- Provider: `provider-status-390x844-isolated.jpg`,
  `provider-status-1440x900-isolated.jpg`, `provider-drawer-390x844-isolated.jpg`.
- Representative: `representative-dashboard-390x844-isolated.jpg`,
  `representative-dashboard-1440x900-isolated.jpg`,
  `representative-drawer-390x844-isolated.jpg`.

Mobile captures use a 390x844 CSS viewport; desktop captures use 1440x900.
Every capture had equal document scroll/client widths (desktop has a 15px
vertical scrollbar, so 1425=1425); the mobile drawer settled at the right edge
and no horizontal overflow was observed. Admin screenshot values are solely
from synthetic isolated data; prior `*-current.jpg` Admin data from the
persistent DB remains local and is explicitly excluded from handoff.

Responsive overflow spot-check on the authenticated Representative route also
passed at widths 360, 390, 761, 820, 1024, 1280, and 1440; at desktop widths the
sidebar's right edge aligned with the page's client width. Captured page
console error/warning logs were empty. A direct local request confirmed
`/favicon.svg` = 200 and `/admin` = 200; `/favicon.ico` = 404, but current app
pages explicitly reference the SVG favicon and no console request/error for
the legacy ICO was observed. This classifies the historical favicon 404 as an
unreferenced legacy route, not a current unexpected app-console error.

Qwen review: initial context-only report said PASS_WITH_FIXES; after supplying
actual shared shell/wrapper/CSS facts and corrected responsive evidence, Qwen
retracted unsupported MATERIAL classifications and returned `VERDICT: PASS`.
Remaining notes are accessibility polish (focus movement/containment and skip
link) rather than confirmed functional/architecture blockers. Gemini review is
recorded in the final addendum below.

The disposable visual services use host port 18080. They are local/test only;
Production remains LOCKED / NO-GO.

## Final review and closure evidence — 2026-10-03

- Gemini received the complete independent-review prompt plus all 11 sanitized
  raw screenshots. The composer was empty after submission; the complete answer
  was observed in the conversation (not a one-line response): `VERDICT: PASS`.
- Gemini confirmed the desktop right-side sidebar and left-side content,
  right-origin mobile drawers/backdrop, responsive 390/1440 layouts, legibility,
  and no visible horizontal overflow across Customer/Admin/Provider/
  Representative. No BLOCKER or MATERIAL findings.
- Gemini's three POLISH-only suggestions: (F-01) add 4px vertical space between
  Customer mobile wallet and quick actions; (F-02) slightly increase Admin
  drawer profile-divider contrast; (F-03) add 4px between Representative zero
  amount and currency suffix. These are subjective pixel-level refinements,
  not acceptance blockers; no code change was warranted for this closure.
- Qwen final shared-shell review: `VERDICT: PASS`; remaining accessibility
  observations are non-blocking polish.
- Fresh screenshots are retained under `docs/10-quality/evidence/wave-31/`.
  The temporary public `TEMP/` review handoff is removed after review; unrelated
  pre-existing TEMP artifacts remain untouched.
- Verification: web 58/58 PASS; canonical isolated API 106/106 PASS, 0 FAIL,
  0 skipped; lint, typecheck, build, Docker image build, and `git diff --check`
  PASS. Next emitted its known nonfatal ESLint plugin warning. Current app
  console error/warning logs were empty; `/favicon.svg` is referenced and 200,
  while `/favicon.ico` 404 is an unreferenced legacy path.
- Role evidence includes anonymous `/auth/me` 401, real synthetic-role logins,
  Representative `SALES_PARTNER` + `commissions.summary_read`, authorized
  `/rep-dashboard`, and Admin `SUPER_ADMIN` + `users.read`; Admin logout was
  verified by subsequent `/auth/me` 401. No fake session or persistent DB reset.
- Final source/evidence commit and push are recorded in the transfer/closure
  report. Production remains LOCKED / NO-GO; no production services or data
  were used.

## Local origin RCA

Observed password login failure after switching roles: HTTP 403,
`CSRF_REJECTED`. The running API had no `FRONTEND_ORIGIN`, so its effective
expected origin was `http://localhost:3000`, while the Nginx UI was served at
`http://localhost:8080`. Compose now supplies
`${FRONTEND_ORIGIN:-http://localhost:8080}`. Origin and CSRF validation code
remain unchanged. Only the local API container was recreated, retaining its
existing local secret without logging it. Representative password login and
the authorized `/rep-dashboard` then succeeded.

Provider and Representative captures used sequential logins in the in-app
browser, not separate browser contexts. The first Provider logout reached the
login UI but subsequent login hit CSRF rejection; server logout success was
not proven for that transition. Do not claim isolated-context coverage from
these captures. After the origin correction, Representative logout reached
login and navigating to `/rep-dashboard` returned to login. The HTTP logout
event was not retained across navigation, so its status is not independently
recorded.

## Observed surfaces

- Provider `/providers/me`: real approved local test clinic, authenticated.
- Provider `/providers/redemptions`: confirmation form and real empty history;
  no successful code confirmation or populated-history evidence claimed.
- Representative `/rep-dashboard`: authenticated reporting and real empty
  commission data, no client-side role or data injection.
- Mobile viewport: 390x844; desktop viewport: 1440x900.
- Provider redemption and Representative reporting checks: no global horizontal
  overflow; captured warning/error console lists empty.
- The original console 404 resource has not yet been independently classified.
- Blank full-page capture artifacts were rejected, not counted as PASS.
- Images currently remain in the local visualization directory, not committed
  to the repository. Separate-context capture, full image ledger, 404 RCA,
  required final gates and Commander acceptance remain pending.

## Regression after local origin correction

- Canonical API: 106/106 PASS, 0 FAIL, 0 SKIPPED, exit 0;
  39,176.737 ms, serialized with `HEALTH_BASE_URL=http://nginx`.
- Web: 53/53 PASS, 0 FAIL, 0 SKIPPED, exit 0.
- No source, test, schema or migration change in this correction.
- No production action, real SMS, payment or vendor connection.

## App-owned icon resource verification

Direct local HTTP check observed `/favicon.ico` returning 404; the repository
had no favicon asset or explicit icon link. This is a reproducible app-owned
missing resource, but its identity with the historical console 404 is unproven.
The shared Next app now explicitly references `/favicon.svg`; the public SVG
is copied into the Web Docker image. No icon content is generated from user data.

After rebuilding/recreating only the local Web service:

- Build: exit 0; 38 pages generated (existing Next ESLint integration warning).
- `/favicon.svg`: HTTP 200 through local Nginx.
- Reloaded login DOM: icon href `/favicon.svg`, type `image/svg+xml`.
- Web tests: 53/53 PASS, 0 FAIL, 0 SKIPPED, exit 0.
- Web lint and typecheck: exit 0 each.

The operations document explicitly identifies root Compose as local/test only;
production requires separately reviewed deployment configuration and origin.
The historical 404 and final authenticated recaptures remain pending.

## Fresh Provider identity check after Web rebuild

Real password login reached the protected dashboard. Same-origin read-only
`/api/v1/auth/me` returned HTTP 200 with role `USER`; this application identifies
Provider access through membership, not a fabricated `PROVIDER` role.
`/api/v1/users/me/providers` returned HTTP 200, one provider, approved status.
Only status/role/count summaries were recorded; no raw identity response,
cookie or token was logged. Final captures and verified logout/reset transition
to Representative are still pending for this fresh session.

## Current-build Provider captures and verified logout

Four viewport JPEG captures were written under `evidence/wave-31/`:

- `provider-workspace-390x844-current.jpg`
- `provider-workspace-1440x900-current.jpg`
- `provider-redemptions-390x844-current.jpg`
- `provider-redemptions-1440x900-current.jpg`

Fresh accessibility state confirmed the approved membership workspace and the
actual empty redemption history before capture. Both mobile images were
visually inspected and contain rendered application content. Desktop images
still require visual inspection; capture alone is not acceptance evidence.

A real same-origin POST to `/api/v1/auth/logout`, using the application's CSRF
cookie internally without logging it, returned HTTP 201 and `revoked: true`.
A subsequent real `/api/v1/auth/me` request returned HTTP 401. Navigation to
`/providers/me` then redirected to `/login`, confirmed by fresh accessibility
state. No authentication state was injected or fabricated.

Localhost site-data clearing, closing the old tab, fresh Representative login,
Representative identity verification and its four captures remain pending.
This is partial sequential hard-reset evidence, not independent-context proof.

Both desktop JPEGs were subsequently visually inspected: approved workspace
and empty redemption form/history are rendered, not blank captures.
The browser capability rejected `Storage.clearDataForOrigin` with
`This method is not supported through raw CDP.` No clearing success is claimed,
and no alternate raw connection or browser-security workaround was attempted.
The required site-cookie reset remains unverified; successful logout/401 alone
does not satisfy the complete Commander-approved hard-reset sequence.

## Independent Chrome Representative run

Commander subsequently accepted independent Chrome rather than unsupported
site-data clearing. Fresh Chrome tab creation succeeded on retry. Before login,
real same-origin `/api/v1/auth/me` returned 401. Real local fixture password
login succeeded; `/auth/me` then returned 200 with `USER` and `SALES_PARTNER`,
and nested role permissions included `commissions.summary_read`. The initial
top-level permissions probe was structurally incorrect and is not evidence of
missing permission; the corrected probe uses the actual nested role contract.

Four viewport JPEGs were saved under `evidence/wave-31/`, named
`representative-dashboard-{390x844,1440x900}-current.jpg` and
`representative-reporting-{390x844,1440x900}-current.jpg`. Screenshot visual
inspection remains pending. Viewport override was reset after capture.

`/rep-dashboard` rendered authorized real empty reporting state.
`/commission-overview` rendered authorized content but displayed
`[object Object]` for all four amount cells in fresh accessibility state.
This is a newly observed display finding, not a passing reporting surface.
RCA, corrective decision, regression, console/network review and closure remain
pending. No fake data, role injection, cookie injection or production action.

## P1 shared authenticated RTL shell and commission display correction

Customer/Provider/Representative use `UserShell`; Admin uses `AdminShell`.
Both now delegate their authenticated frame to `AuthenticatedShell`, so the
layout direction and responsive drawer behavior are shared. The desktop grid
uses RTL inline order (sidebar first at inline-start/right, content after it to
the left). On mobile the navigation is a right-anchored drawer using logical
inline positioning, with backdrop, close-on-link, and Escape handling. Existing
navigation has no directional chevrons; the new menu glyph is direction-neutral.

Root cause of the commission overview display finding: its API values are
money objects (`amount_minor`, `currency_code`, `sign_rule`), but the page
coerced the whole object via `String(...)`. The page now uses the shared money
formatter and preserves integer precision via BigInt for integer strings. A
focused test checks a value above Number's safe integer range and rejects
`[object Object]`/`NaN` output.

Verification on this revision: Web 55/55 passed, 0 failures/skips; lint PASS;
typecheck PASS; local Next build PASS, 38 static pages; `git diff --check` PASS.
Docker image build had succeeded just before the shared shell's final small
markup/test adjustments. Docker service was started successfully afterward,
but the daemon still reports `Docker Desktop is unable to start`. Docker logs
show repeated internal `http://ipc/ping` context-deadline failures. `wsl --list
--verbose` reports both `docker-desktop` and the default Ubuntu distribution
stopped. No WSL shutdown, distribution mutation, Docker data reset or broad
restart was run. Consequently, this exact final revision has not been
recaptured in the authenticated app at 390x844 and 1440x900; menu open direction
and runtime overflow remain unverified. No screenshot claim is made for the
RTL correction yet. Fresh captures, runtime overflow checks and commission
amount rendering confirmation remain pending engine recovery.

Production remains NONE / LOCKED / NO-GO.

## Commander resume order — current verification pass

The shared authenticated-shell change is in the current workspace revision.
The mobile menu control now changes its accessible name and glyph between open
and closed states; the B8 source-level regression asserts the stateful label.
This is not a substitute for runtime visual verification.

Current local checks:

- Web tests: 55/55 PASS, 0 failed, 0 skipped.
- Workspace lint: PASS.
- Workspace typecheck: PASS.
- Web production build: PASS; 38 static pages generated. Next reports its
  existing nonfatal ESLint-plugin configuration warning.
- `git diff --check`: PASS (line-ending conversion warnings only).
- `docker compose config --services`: PASS after creating an ignored local
  `.env` from `.env.example` with a cryptographically random local-only
  `AUTH_SECRET`. The secret value is not recorded here and `.env` is ignored.
- Docker engine: BLOCKED. `docker info` and `docker ps` still return
  `Docker Desktop is unable to start`; `docker-desktop` and the Ubuntu WSL
  distributions are stopped. Compose cannot start containers, so the app,
  fresh authenticated screenshots, viewport overflow checks, current console
  review, and current `/auth/me` / Representative route evidence are not
  verified on this revision. No WSL distribution mutation or Docker data reset
  was attempted.
- Browser bridge: BLOCKED after fresh runtime initialization. It reported
  `Unable to load browser request-header policy` for Brave and returned no
  Brave tabs. No Commander, Gemini, or Qwen message was sent; no screenshots
  were submitted for agent review. The mandatory Gemini review of actual
  current-build screenshots and the requested Qwen shared-shell review remain
  open.
- Existing JPEGs under `evidence/wave-31/` were captured before this RTL shell
  revision and are explicitly stale for final acceptance.
- Target remote `hami2test` is configured for this `main` branch. No commit or
  push was made: final visual/auth evidence and Gemini review are mandatory
  acceptance gates, and the running app is currently unavailable.

Next safe action: recover the local Docker/WSL engine without deleting data or
resetting distributions, then rebuild/start the local stack and complete
fresh-session role verification, affected-page captures at 390x844 and
1440x900, browser-console/404 classification, Gemini visual review, and Qwen
shared-shell review. Only after those gates pass should the exact verified
snapshot be committed and pushed to `hami2test/main`.

Production remains LOCKED / NO-GO.

## Role coverage and logout security closure evidence — 2026-10-03

Commander explicitly authorized temporary LOCAL/TEST-only Customer, Admin,
and Provider fixtures. They were created using existing schema/RBAC only:
Customer=`USER`; Admin=`SUPER_ADMIN` with its seeded `users.read`; Provider
is `USER` plus an actual `ProviderMembership OWNER` and `APPROVED` provider.
No `PROVIDER` role, wildcard permission, OTP/SMS, schema change, fake session,
or credential storage was introduced. Test phones were stored in the API's
existing canonical `+98…` format after the first UI attempt exposed the
normalization contract; no external messaging occurred.

Each role used a separate sequential real password login after a fresh
anonymous check, with the previous server session revoked before the next:

- Customer: pre-login `/auth/me` 401; login `/auth/me` 200 with `USER`; the
  actual dashboard rendered; logout returned to login and `/auth/me` became
  401.
- Admin: pre-login 401; login 200 with `SUPER_ADMIN` and `users.read`; `/admin`
  rendered; after the Admin logout fix, UI logout redirected to login and
  `/auth/me` became 401.
- Provider: pre-login 401; login 200 with actual `USER`; `/users/me/providers`
  returned 200 for one approved owner membership; `/providers/me` rendered the
  corresponding provider; logout returned `/auth/me` to 401.
- Representative: the earlier fresh SALES_PARTNER evidence remains valid:
  pre-login 401, authenticated 200 with `SALES_PARTNER` and
  `commissions.summary_read`, and authorized reporting page rendered.

Admin logout finding `ADMIN-LOGOUT-SERVER-SESSION-REVOCATION` was confirmed:
the old Admin shell only cleared client memory while leaving the cookie-backed
server session active. With Commander authorization, Admin and User shells
now share `revokeCurrentSession()` using the existing cookie/CSRF logout
contract. They clear local session and redirect only after success; on failure
the page retains the current state and shows an accessible error rather than
claiming logout succeeded. Tests cover shared helper invocation, cookie-auth
POST, propagated network failure, and UI failure feedback. Provider and
Customer end-to-end logout regressions passed on the rebuilt Docker web image;
Admin end-to-end logout passed on that same image.

Current authenticated screenshot evidence (actual local build, 390x844 and
1440x900):

- Customer: `evidence/wave-31/customer-dashboard-390x844-current.jpg`,
  `evidence/wave-31/customer-dashboard-1440x900-current.jpg`.
- Admin: `evidence/wave-31/admin-dashboard-390x844-current.jpg`,
  `evidence/wave-31/admin-dashboard-1440x900-current.jpg`, and
  `evidence/wave-31/admin-drawer-390x844-current.jpg`.
- Provider: `evidence/wave-31/provider-status-390x844-current.jpg`,
  `evidence/wave-31/provider-status-1440x900-current.jpg`, and
  `evidence/wave-31/provider-drawer-390x844-current.jpg`.
- Representative: the seven accepted `representative-*-current.jpg` captures
  listed above.

Viewport evidence: Customer mobile `documentWidth=clientWidth=390`; Admin
mobile `375=375` (390 CSS viewport with a 15px vertical scrollbar), desktop
`1425=1425` (1440 CSS viewport with scrollbar); Provider mobile `390=390`,
desktop `1425=1425`. Desktop sidebar right edge is 1425 and content is to its
left. Admin/Provider right-side drawers settle at `left=70`, `right=390` with
no document overflow. Capture waits for the drawer transition to settle;
mid-transition images are not accepted. Captured browser console warning/error
logs were empty; same-origin resource timing found no 404/0 responses on the
current Provider page.

Latest web gates after the logout fix: 58/58 tests PASS, lint PASS, typecheck
PASS, build PASS (38 routes), Docker web image build PASS, container restarted
without touching API/DB, and `git diff --check` PASS. The canonical isolated
API suite was rerun after the fix: 106/106 PASS, 0 failures, 0 skipped.
Persistent local DB was not reset.

Privacy hold: the live Admin overview screenshot contains aggregate operational
values from the existing local DB (including active-user, paid-purchase and
pending-withdrawal counts). Although it contains no credential or direct user
identifier, it is non-public business/financial data. The screenshot remains
local and has not been uploaded or sent to Gemini. Commander was asked to
authorize sharing as-is or choose redaction/isolated visual data; wait for a
complete decision before Gemini handoff. Gemini and Qwen review therefore
remain open, as do final 404 classification, secret scan, final commit/push,
and clean-tree verification.

Production remains LOCKED / NO-GO.

## Resume verification — 2026-10-03 (Docker restored; initial checkpoint)

This records initial observations only; later role-coverage and authoritative
follow-up entries supersede the pending-status statements below.

Docker Desktop recovered after the authorized restart. Existing local `db`,
`api`, `web`, and `nginx` containers are healthy; no volume reset, database
recreation, migration, SMS, payment, or production action occurred. The web
image was rebuilt from this workspace and only the web service was recreated.

The independently launched Chrome session performed real local password login
with the single Commander-authorized temporary SALES_PARTNER fixture. The
representative summary route rendered its authorized empty state and the
commission overview rendered the authenticated read-only summary. Previously
recorded anonymous `/auth/me = 401` and authenticated `/auth/me = 200` role and
`commissions.summary_read` claims remain in the verification log; no credential
or session material is stored here.

Fresh current-build visual evidence captured before the temporary session
expired:

- `evidence/wave-31/representative-dashboard-390x844-current.jpg`
- `evidence/wave-31/representative-dashboard-1440x900-current.jpg`
- `evidence/wave-31/representative-drawer-390x844-current.jpg`
- `evidence/wave-31/representative-commission-overview-1440x900-current.jpg`

The viewport override was verified at 390x844 and 1440x900. Document width
matched available client width at both sizes. Desktop geometry placed the
sidebar at the right edge with content to its left; the mobile drawer occupied
the right edge (`left=70`, `right=390` at 390px) and opened with no horizontal
overflow. Representative route had no browser console warn/error entries.
Other authenticated role screenshots were not recaptured because only one
temporary role fixture was authorized.

At the time of this initial resume note, ordinary `/dashboard` appeared stuck
loading; see the authoritative RCA/fix addendum below. The representative page
also visibly renders the API's literal timestamp contract markers `createdAt`
and `paidAt`; this remains a product/API contract finding and must not be
described as a timestamp value. No unexpected 404 was seen in the captured
page console; the remaining app-console 404 gate has not been independently
classified on all required roles.

Current gates on this workspace snapshot: Web 55/55 PASS; workspace lint PASS;
typecheck PASS; Web production build PASS (38 routes; existing nonfatal Next
ESLint-plugin warning); `git diff --check` PASS. A serialized full API suite
run against the currently running local service environment produced 62/106
pass and 44 failures. The failures include missing OTP development fixtures
and Prisma integration test helper failures against the persistent local
database; this execution is NOT acceptance evidence and the database was not
reset or altered to make the suite pass. Isolated canonical API regression
remains required.

This initial resume note was superseded by the evidence below. Remote
`hami2test/main` was at `d0fc82950588696e9deec77f6c06998150ec8caf`, matching
local `main`; nothing was committed or pushed in this pass.

## Authoritative follow-up — 2026-10-03

### Dashboard RCA and verification

Root cause: `Dashboard` ran its effect before `UserShell` finished asynchronous
`/auth/me` session hydration. The effect returned early when `readSession()`
was empty and depended only on a retry counter, so hydration did not trigger a
second fetch and the page could remain loading indefinitely. Removed that
premature session guard; API requests continue using the existing cookie-auth
client and normal error/degraded states. No forced loading completion or auth
bypass was added. On the running local build, `/auth/me`, wallet, withdrawals,
and customer-summary requests returned HTTP 200 and the dashboard rendered.
Browser console warning/error count was zero. A source regression assertion
covers the pre-hydration request behavior.

### Current authenticated representative evidence

The Commander-authorized temporary SALES_PARTNER fixture was used for a real
password login; no password/session value is recorded here. Anonymous
`/auth/me` returned 401; authenticated `/auth/me` returned 200 with
`SALES_PARTNER`, `commissions.summary_read`, and active status. The authorized
`/rep-dashboard` and read-only commission overview rendered. Current captures
were overwritten after the fresh login and are accepted only for the named
screens/routes:

- `evidence/wave-31/representative-dashboard-390x844-current.jpg`
- `evidence/wave-31/representative-dashboard-1440x900-current.jpg`
- `evidence/wave-31/representative-drawer-390x844-current.jpg`
- `evidence/wave-31/representative-reporting-390x844-current.jpg`
- `evidence/wave-31/representative-reporting-1440x900-current.jpg`
- `evidence/wave-31/representative-commission-overview-390x844-current.jpg`
- `evidence/wave-31/representative-commission-overview-1440x900-current.jpg`

Screenshots were clipped to exact 390x844 and 1440x900 viewport dimensions.
At mobile width, document width equaled client width; the drawer opened from
the right (`left=70`, `right=390`). Old `*-rtl.jpg`, `*-full-test.jpg`,
`*-mobile-clip-test.jpg`, and `representative-rep-dashboard-*` captures are not
included as acceptance evidence. The older `provider-workspace-*` and
`provider-redemptions-*` JPEGs depict a different UI/build and are not evidence
for this wave. Current accepted Provider captures are named `provider-status-*`
and `provider-drawer-*`.

### Isolated API regression

The earlier 62/106 run against the persistent local DB is contaminated
environmental evidence, not a product acceptance result; the shared DB was not
reset. A network-isolated disposable PostgreSQL container with a separate
anonymous disposable volume and no host port was created, and only the existing
migrations were applied. The existing shared database volume was untouched. After
adding the deterministic provider fixture only to that disposable DB, the
canonical serialized API command completed 106/106 PASS, 0 FAIL, 0 SKIPPED.
No migration/schema was created and no shared database was dropped/reset.

### Current gates and remaining decisions

Initial checkpoint: web tests 56/56 PASS, lint/typecheck PASS, and build
completed; role fixtures and reviews were then pending. The later role-coverage
section supersedes that status.

Production remains LOCKED / NO-GO.

Production remains LOCKED / NO-GO.
