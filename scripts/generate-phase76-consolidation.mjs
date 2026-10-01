import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review';
const files={
'FW-02-R-phase76-complete-state-matrix.md':`# FW-02-R Phase 76-A — Complete State Matrix

| Area | Current Status | Evidence Reference | Risk Category | Next Required Action |
|---|---|---|---|---|
| Internal Governance | COMPLETE | Phases 39–75 reports | Low / maintained | Periodic review |
| P52 Finding | OPEN / ACTIVE | FW-02-R-P52-F001 | Historical evidence gap | Resolve with valid source |
| P52 Exception | ACTIVE / ACCEPTED | FW-02-R-EXC-P52-001 | Accepted governance risk | Lifecycle review |
| External Authority | PENDING | Authority dependency records | High / external | Obtain authorized decisions |
| Production Boundary | LOCKED / NO-GO | Baseline and review reports | Critical | No Production action |
`,
'FW-02-R-phase76-decision-history-summary.md':`# FW-02-R Phase 76-B — Decision History Summary

| Decision | Reason | Evidence | Boundary | Current Status |
|---|---|---|---|---|
| P52 Finding opened | Historical Phase 40 artifact unavailable | Finding record | No reconstruction | ACTIVE |
| P52 Exception accepted | Governance acceptance without erasing Finding | Exception record | Not Production authorization | ACTIVE / ACCEPTED |
| Phases 39–75 accepted | Internal evidence and documentation completed | Phase reports | Non-production only | CLOSED |
| Production locked | External authority and ownership unresolved | Baseline/review records | No credentials/provider/deployment | LOCKED / NO-GO |
`,
'FW-02-R-phase76-final-knowledge-snapshot.md':`# FW-02-R Phase 76-C — Final Knowledge Snapshot

## Completed work

Security baseline, supply-chain governance, evidence management, operational readiness, exception management, audit communication, governance operating model, review simulation, continuous improvement, baseline freeze, artifact QA, knowledge transfer and independent review simulation.

## Open findings

FW-02-R-P52-F001 — Missing Historical Phase 40 Artifact (ACTIVE).

## Active exceptions

FW-02-R-EXC-P52-001 — ACTIVE / ACCEPTED; Owner Role: Project Owner.

## External dependencies

Production authorization, trust-root ownership, signing authority, provider/platform ownership and operational ownership remain pending.

## Production restrictions

Production is LOCKED / NO-GO. No credentials, provider, signer, trust root, deployment, code or dependency change is authorized by this snapshot.

## Resume conditions

Valid historical evidence, assigned ownership, required authority decisions and a new review for any drift beyond the frozen baseline.
`,
'FW-02-R-phase76-final-report.md':`# FW-02-R Phase 76 — Final Report

Status: COMPLETE / PASS
Scope: Documentation / Consolidation only

Completed:
- Complete State Matrix created.
- Decision History Summary created.
- Final Knowledge Snapshot created.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.

Verification: git diff --check PASS.
Production: LOCKED / NO-GO.
No production, credential, provider, trust-root, signer, deployment, code or dependency change.
`
};
await mkdir(out,{recursive:true}); for(const [n,b] of Object.entries(files)) await writeFile(`${out}/${n}`,b,'utf8'); console.log(`Phase 76 consolidation generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
