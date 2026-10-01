# HC-W2-01 Review Closure — C2

## Original reviewer finding → evidence/fix → test → status

| Finding | Evidence/fix | Test/validation | Status |
|---|---|---|---|
| Address IDOR and ownership scope | `apps/api/src/main.mjs` scopes list/update/delete/default queries by authenticated `user.id`; update/delete use `updateMany`/`deleteMany` with both `id` and `userId`. | User B cross-user update/delete tests return 404; list is empty. | Closed for current routes |
| National ID uniqueness and conflict mapping | `UserProfile.nationalId @unique`; `P2002` maps to HTTP 409 in the global filter. | Schema/index inspection; existing profile validation suite; concurrent regression remains a follow-up test. | Evidence closed; concurrency test follow-up |
| Default-address integrity | Migration 0007 creates partial unique index `Address_one_default_per_user`; set-default unsets then sets inside one transaction. | Default switch test leaves exactly one default; main precheck found zero duplicate users. | Closed for current scope |
| Geography rerun safety | Seed is transactional and keyed by global `sourceCode`; existing addresses are remapped before stale rows are considered. Stale geography rows referenced by addresses now fail explicitly instead of being silently deleted. | API rebuild/restart passed; counts remain 31/1481; migration and integration gates pass. | Closed for current snapshot; upgrade policy remains explicit |
| Province/city mismatch | Address create/update verifies `cityId` with the supplied `provinceId`. | Invalid province/location coverage passes. | Closed |
| Admin privacy and audit redaction | Admin summary masks national ID; detail excludes auth/session secrets; audit calls use event/entity metadata only. | Admin response assertions and 5/5 suite pass. | Closed |
| Index adequacy | Verified `UserProfile_nationalId_key`, `UserProfile_userId_key`, `Address_userId_idx`, `City_provinceId_idx`, and default partial index in PostgreSQL. | `pg_indexes` inspection on main DB. | Closed for current query patterns |

## Quality gates

- Docker API, database, web, and Nginx: healthy/running
- Lint: PASS
- Typecheck: PASS
- Build: PASS
- Integration tests: 5/5 PASS
- Prisma migrations 0001..0009: up to date
- Main database: preserved

No GitHub push or commit was performed. This closure pack contains no secrets.
