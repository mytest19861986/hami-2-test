# Wave 31C — Payout / withdrawal regression evidence

Status: source repair verified; Wave 31A visual closure remains pending.

Verified source commit: `57b9cf9a4f7effde616de66171514c6da7fee664`.
Remote `hami2test`, branch `main`, independently verified by `git ls-remote`.

## Root cause

The withdrawal transition transaction attempted to serialize
`referralRewardAmount` and `minimumWithdrawalAmount` from a
`WithdrawalRequest`. These CommercialSettings fields do not exist on that
model. The observed exception was `TypeError: Cannot read properties of
undefined (reading 'toString')` at `main.mjs:820`, inside
`WithdrawalAdminController.transition`. The exception occurred inside the
transaction callback, causing rollback. No Prisma error code was involved.

The repair returns the updated withdrawal from the transaction; the existing
outer response serializes its `amount`. Guards, locks, payout identity,
constraints and economic transitions remain unchanged. Temporary diagnostic
logging was removed.

An independent rerun configuration failure was also identified: recreating
the local API without `ALLOW_DEV_OTP_CODE=true` left registration tests without
a development OTP, resulting in unauthorized login and undefined `me.id`.
Restoring the existing local/test setting resolved that setup failure without
changing auth or test expectations.

## Verification — 2026-10-02

Single canonical execution inside the running local API container:

`HEALTH_BASE_URL=http://nginx node --test --test-concurrency=1 test/*.test.mjs`

- API: 106 tests, 106 PASS, 0 FAIL, 0 SKIPPED; exit code 0.
- Focused payout: 15/15 PASS, including concurrency, crash windows,
  UNKNOWN, discrepancy, release and fee invariants.
- Web: 53 tests, 53 PASS, 0 FAIL, 0 SKIPPED; exit code 0.
- Lint: PASS, exit code 0. Web production build: PASS, exit code 0,
  all 38 pages generated. Non-fatal existing ESLint integration warning and
  interrupted-cache restore warnings were observed.
- API and Web typecheck: PASS, exit code 0.
- Source working tree was clean before adding this evidence document.
- No schema or migration change; no production action.

Pending for Wave 31A: authenticated Provider/Representative screenshots at
both required viewports, console-resource RCA and Commander acceptance.
Commander browser access on this run was rejected because saved browser
permissions could not be verified. No alternate path was used to bypass
that security check; the new report has not been sent.

## Current-HEAD re-verification — 2026-10-02

Commander subsequently received the report through the official Brave extension
and accepted the RCA, requesting a new regression run before final closure.
The previously unavailable browser permission check was not reproduced after
official runtime initialization; its underlying cause remains unconfirmed.

Verified HEAD: `a2dd6983bb5c96a74ccd93e1924aee53ca8f7ae9`.
Docker Desktop was stopped and was started through `docker desktop start`.
Existing Hami containers were started without deleting data. The initial API
container source differed from the workspace, so the API image was rebuilt
from this HEAD and only the API service recreated, retaining its existing local
secret without printing it and the existing development OTP configuration.

Workspace and rebuilt container `apps/api/src/main.mjs` SHA-256 both equal:
`a8830b056fcd9e89cf0242461e94cecf93e88d3523b299cae2598a88f15cfa92`.

- API health through local Nginx: `{"status":"ok"}`.
- All four Hami containers: healthy.
- Focused payout/withdrawal: 28/28 PASS, 0 FAIL, 0 SKIPPED, exit 0.
  Files: `payout-core.test.mjs`, `payout-core.integration.test.mjs`, and
  `rewards-financial.integration.test.mjs`; serialized execution.
- Canonical API: 106/106 PASS, 0 FAIL, 0 SKIPPED, exit 0; duration 35,635.988 ms.
  Command: `HEALTH_BASE_URL=http://nginx node --test --test-concurrency=1 test/*.test.mjs`
  inside the rebuilt local API container.
- `git diff --check`: PASS; working tree clean before this documentation update.
- No new source, schema, migration, auth, or test change; no production action.

Current-HEAD test evidence is now available for Commander acceptance. Wave 31A
authenticated captures and console RCA remain pending; no visual closure is claimed.
