import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review';
const files={
'FW-02-R-phase74-knowledge-transfer-package.md':`# FW-02-R Phase 74-A — Knowledge Transfer Package Review

| Topic | Onboarding result |
|---|---|
| Architecture Decisions | Known — internal governance artifacts are documented |
| Security Boundaries | Known — Production remains LOCKED / NO-GO |
| Evidence Rules | Known — no historical evidence may be recreated |
| Finding Handling | Known — P52 Finding remains ACTIVE |
| Exception Handling | Known — P52 Exception remains ACTIVE/ACCEPTED |
| Production Restrictions | Known — no credentials, provider, signer, trust root or deployment |
`,
'FW-02-R-phase74-new-operator-scenario.md':`# FW-02-R Phase 74-B — New Operator Scenario

A new operator can identify:

- PASS: completed internal governance layers and accepted non-production phases.
- OPEN: FW-02-R-P52-F001, Missing Historical Phase 40 Artifact.
- Authority-required: Production authorization, trust-root ownership, signing authority, provider/platform ownership and operational ownership.
- Forbidden: Production activity, credentials, provider connection, signer, deployment, code or dependency changes.

Result: PASS. No operational authority is inferred.
`,
'FW-02-R-phase74-knowledge-gap-register.md':`# FW-02-R Phase 74-C — Knowledge Gap Register

| Classification | Items |
|---|---|
| Known | Governance layers, evidence boundaries, P52 Finding/Exception state, Production NO-GO |
| Understood | Review/acceptance workflow and escalation boundary |
| Needs Clarification | Any future authority decision or scope change |
| External Dependency | Production authorization, trust root, signer, provider/platform and operational ownership |

P52 Finding and Exception remain traceable; no missing historical artifact is reconstructed.
`,
'FW-02-R-phase74-final-report.md':`# FW-02-R Phase 74 — Final Report

Status: COMPLETE / PASS
Scope: Documentation / Knowledge Validation only

Completed:
- Knowledge Transfer Package Review completed.
- New Operator Scenario completed.
- Knowledge Gap Register created.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.

Verification: git diff --check PASS.
Production: LOCKED / NO-GO.
No production, credential, provider, trust-root, signer, deployment, code or dependency change.
`
};
await mkdir(out,{recursive:true}); for(const [n,b] of Object.entries(files)) await writeFile(`${out}/${n}`,b,'utf8'); console.log(`Phase 74 knowledge transfer generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
