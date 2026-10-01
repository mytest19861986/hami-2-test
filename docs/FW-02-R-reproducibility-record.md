# FW-02-R — Reproducibility Record

Documentation-only record for reproducing the accepted Local/Test evidence. It does not change test behavior or implementation.

## Environment snapshot

- Docker Engine server: `29.5.3`
- Node.js: `v24.19.0`
- pnpm: `11.19.0`
- Prisma schema: `packages/database/prisma/schema.prisma`
- Test execution mode: serialized, `test-concurrency=1`
- Scope: Local/Test only; no production, provider, credential, or real-money activity

## Regression evidence

The API suite was run inside the Docker API environment with serialized execution:

- Total: 78
- Passed: 78
- Failed: 0
- Cancelled: 0

The serialized mode is material: earlier parallel execution shared Local/Test state and produced seed collisions. The accepted evidence therefore records `test-concurrency=1` rather than claiming an unqualified parallel run.

## Supporting checks

- Docker/Nginx health endpoint: `status: ok`
- Prisma Client generation and import: PASS
- `apps/api` TypeScript no-emit check: PASS
- Migration 0020 and 0021 local assertions: PASS
- Append-only app-role UPDATE/DELETE mutation checks: denied as expected

## Integrity references

- Migration 0020 SHA-256: `078CAFD76DD554AB338FF4F46CEA68433E818CB1501244B87826C5D54B0F1696`
- Migration 0021 SHA-256: `7344DBEF4307290D8DCE16505B6DB13422C6AB3FCD640EFAD84464117B00452B`

## Reproduction boundary

This record is evidence for Local/Test reproducibility only. It is not authorization for deployment, provider selection, credentials, production data, or real-money movement. Runtime gaps listed in `FW-02-R-runtime-evidence-inventory.md` remain pending.
