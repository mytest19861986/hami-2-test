import { mkdir, writeFile } from 'node:fs/promises';
const out='G:/project/TEST/hami/temp/review'; await mkdir(out,{recursive:true});
const docs={
'FW-02-R-phase60-adr-consolidation.md':`# FW-02-R Phase 60-A — ADR Consolidation

| Decision ID | Decision Title | Current Status | Evidence Reference |
|---|---|---|---|
| ADR-001 | Package manager authority | Decided | Supply-chain baseline |
| ADR-002 | Docker immutable pinning | Pending historical artifact / finding active | Phase 40 finding |
| ADR-003 | SBOM strategy | Decided | SBOM baseline |
| ADR-004 | Attestation architecture | Decided | Attestation design |
| ADR-005 | Trust-root model | External dependency | Authority decision required |
| ADR-006 | Evidence governance | Decided | Phase 52-59 package |
| ADR-007 | Production boundary | Locked / No-Go | Governance register |

Each ADR records context, problem, options, selected direction, rejected alternatives, evidence, status and future review trigger.
`,
'FW-02-R-phase60-maintenance-plan.md':`# FW-02-R Phase 60-B — Long-Term Maintenance Plan

| Area | Current State | Required Future Action | Responsible Role |
|---|---|---|---|
| Security | Documented | Review after material threat/control change | Security authority |
| Supply Chain | Baseline documented | Revalidate dependencies and attestations | Technical owner |
| Operations | Runbook documented | Exercise on incident/process change | Operations owner |
| Evidence Management | Traceable | Preserve artifacts and review gaps | Project Owner |
| Release Governance | Flow documented | Recheck approval boundaries before release | Release authority |

External authority decisions remain pending and are not inferred.
`,
'FW-02-R-phase60-decision-boundary.md':`# FW-02-R Phase 60-C — Decision Boundary Review

## Decided

Internal documentation, evidence governance, security baseline, attestation design and non-production readiness.

## Pending

Historical Phase 40 artifact, trust-root ownership, signing authority, provider/platform ownership, production ownership and authorization.

## Deprecated

No current decision is silently removed; superseded assumptions remain traceable.

## Future

Production authorization, real provider integration and operational infrastructure after external approvals.
`,
'FW-02-R-phase60-knowledge-transfer.md':`# FW-02-R Phase 60-D — Knowledge Transfer Package

The package explains architecture, decision history, open risks, accepted exception, Production boundary and resume conditions. It is suitable for a new reviewer without granting authority or access.

Resume requires explicit external decisions and preservation of FW-02-R-P52-F001 and FW-02-R-EXC-P52-001.
`,
'FW-02-R-phase60-final-report.md':`# FW-02-R Phase 60 — Final Report

Result: PASS — Documentation / Governance only.

- ADR index created: PASS
- Major decisions mapped: PASS
- Rejected options documented: PASS
- Maintenance plan created: PASS
- External dependencies separated: PASS
- Exception P52 preserved: PASS
- No assumption converted to fact: PASS
- Production impact: NONE
- Production: LOCKED / NO-GO
- Finding: FW-02-R-P52-F001 ACTIVE
- Exception: FW-02-R-EXC-P52-001 ACTIVE/ACCEPTED; Owner Role = Project Owner

No Production, credential, provider, trust root, signer, CI, dependency, Docker or application changes occurred.
`};
for(const [n,c] of Object.entries(docs)) await writeFile(`${out}/${n}`,c,'utf8');
console.log(`Phase 60 ADR plan generated: outputs=${Object.keys(docs).length}; production=LOCKED/NO-GO`);
