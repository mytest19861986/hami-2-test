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
