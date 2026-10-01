# FW-02-R Implementation Evidence

Scope: Local/Test only. Production, real data, provider activity, credential changes,
frontend expansion, and authorization redesign are forbidden.

## Migration records

- `0020_authorization_audit`: applied by controlled SQL because the init-based local database
  has no `_prisma_migrations` table. No legacy rows were backfilled.
- `0021_authorization_audit_hardening`: additive hardening for least privilege, closed reason
  codes, result/reason consistency, bounded identifiers, and structured payload keys.
- Baseline deviation: the two migration files and the direct SQL execution are recorded as a
  Local/Test-only deviation; production migration history is untouched.
- SHA-256 evidence at apply: `0020_authorization_audit` =
  `078CAFD76DD554AB338FF4F46CEA68433E818CB1501244B87826C5D54B0F1696`;
  `0021_authorization_audit_hardening` =
  `7344DBEF4307290D8DCE16505B6DB13422C6AB3FCD640EFAD84464117B00452B`.
- Rollback record: no DDL rollback is planned after activation. Before any data exists, local
  teardown is `DROP TABLE` only as a disposable-environment recovery; configuration rollback is
  the production design boundary.

## Required runtime follow-up

Application emitter, divergence alerting, cutover, no-double-emission, outbox relay,
dead-letter runtime, compliance-only access, and SUPER_ADMIN exclusion remain separate review
gates and are not claimed by this schema evidence.

## Hardening and regression evidence

- Dedicated `hami_audit_app` has SELECT/INSERT only; UPDATE and DELETE privileges are false.
- `hami_audit_retention` has no table privileges and is separate from the application role.
- Role-based mutation tests confirmed UPDATE and DELETE fail for `hami_audit_app`.
- The full API test command was attempted after apply: 29 passed, 9 failed. The failures are
  environment/setup failures (missing workspace `@prisma/client` links and one API health port
  not listening), not assertion failures attributable to migration 0021. A clean full regression
  remains required after dependency wiring and API startup are repaired.
- After standard workspace recovery and Docker API startup, the authoritative serialized command
  `node --test --test-concurrency=1 test/*.test.mjs` completed with **78/78 PASS**. The earlier
  four failures were parallel shared-state/seed collisions; serial execution is the required
  Local/Test evidence mode for this suite.
