# FW-02-R Sprint 0 — Recovery & Evidence Results

## Scope

Local/Test recovery only. This work repaired the Sprint 0 validation environment and test harness. No Sprint 1, customer attribution, commission UI, withdrawal UI, financial implementation, provider, executor, credentials, production, or real-money work was started.

## Root cause

The first clean Local/Test database was created by the PostgreSQL init script, but the Prisma schema migrations were not applied automatically. The API then failed during startup because `CommercialSettings` and other schema tables were absent. The resulting connection failures caused cascading `undefined` fixture values and Prisma validation errors.

After the schema was synchronized with the existing Prisma schema using `prisma db push` in the disposable Local/Test database, the API started normally. The one remaining test failure was a fixture assumption: the auth test expected a fixed user (`09120000003`) that is not seeded in a clean database. The test now creates a fresh ordinary user through the public registration flow before asserting the forbidden admin response. No production code or authorization behavior was changed.

## Files changed

- `apps/api/test/auth.test.mjs`
  - Replaced the fixed unseeded no-permission login fixture with a dynamic registration fixture.
- `docs/FW-02-R-sprint0-results.md`
  - This validation and evidence report.

## Environment recovery

- Recreated disposable Local/Test Docker services.
- Synchronized the Prisma schema in the Local/Test database.
- Rebuilt the API image after the test-harness correction.
- Verified `api`, `web`, `nginx`, and `db` are healthy.

## Tests and validation

Command:

```text
docker compose exec -T api npm test
```

Result:

```text
71 tests
71 pass
0 fail
0 cancelled
0 skipped
```

The web suite previously passed `33/33` in its Docker container. The local host npm limitation remains; validation is performed inside Docker as required by the repository setup.

## Security checks

- No production credentials or vendor connections used.
- No real SMS, payment, provider, executor, or real-money action used.
- The dynamic test fixture still uses the ordinary USER role and verifies that admin access is denied (`403`).
- Existing cookie/session, capability, authorization, idempotency, payout, withdrawal, and financial invariant tests are included in the `71/71` API regression result.

## Screenshot evidence

Four persistent Local/Test screenshots were generated with a clean headless Chromium profile. They contain no PII, customer data, financial data, commission data, withdrawal data, credentials, or production content:

- `docs/evidence/fw02r-sprint0/fw02r-shell-local.png` — representative shell
- `docs/evidence/fw02r-sprint0/fw02r-session-login.png` — session/login state
- `docs/evidence/fw02r-sprint0/fw02r-capability-denied.png` — unauthorised capability boundary
- `docs/evidence/fw02r-sprint0/fw02r-empty-disabled.png` — empty/disabled state

The screenshots were captured against `http://127.0.0.1:8080` while Docker services were healthy.

## Known limitations

- The Docker compose setup does not automatically apply Prisma migrations to a newly initialized database; recovery currently requires an explicit Local/Test schema synchronization step.
- Host npm is unavailable, so host-side test commands cannot be used.
- Sprint 0 acceptance remains subject to Commander review of this report and the missing persistent screenshot artifact.

## Validation status

**API regression: PASS (71/71).**

**Sprint 0 acceptance: ready for Commander final acceptance review.**
