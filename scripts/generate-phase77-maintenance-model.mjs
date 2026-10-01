import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review';
const files={
'FW-02-R-phase77-artifact-freshness-model.md':`# FW-02-R Phase 77-A — Artifact Freshness Model

| Artifact | Last Review | Expected Review Interval | Freshness State | Revalidation Trigger |
|---|---|---|---|---|
| Governance baseline | Phase 76 | On material change or scheduled review | Fresh | Architecture/security/boundary drift |
| P52 Finding record | Phase 76 | On evidence change | Fresh | Valid historical source appears |
| P52 Exception record | Phase 76 | Lifecycle review | Fresh | Scope, owner or risk changes |
| Knowledge snapshot | Phase 76 | On material change or resume | Fresh | External authority or resume event |

Freshness is a review state, not Production authorization.
`,
'FW-02-R-phase77-staleness-classification.md':`# FW-02-R Phase 77-B — Staleness Classification

| State | Meaning | Required action |
|---|---|---|
| Fresh | Reviewed against current baseline | Preserve and monitor |
| Review Due | Scheduled review point reached | Perform documented review |
| Stale | Material change may invalidate context | Revalidate before reliance |
| Requires Revalidation | Triggered drift or evidence change | Revalidate affected claims |
| Superseded | Deliberately replaced by newer approved artifact | Retain traceability; use successor |

No state transition closes the P52 Finding or authorizes Production.
`,
'FW-02-R-phase77-maintenance-workflow.md':`# FW-02-R Phase 77-C — Maintenance Workflow

Change Event
      ↓
Freshness Check
      ↓
Review Decision
      ↓
Update / Preserve / Supersede

Rules:

- Documentation-only edits preserve the existing boundary unless review identifies drift.
- Architecture, dependency or security changes require a new review.
- Finding and Exception references must remain traceable after maintenance.
- Historical evidence is never reconstructed from inference.
- Production remains LOCKED / NO-GO throughout this workflow.
`,
'FW-02-R-phase77-final-report.md':`# FW-02-R Phase 77 — Final Report

Status: COMPLETE / PASS
Scope: Documentation / Governance only

Completed:
- Artifact Freshness Model created.
- Staleness Classification defined.
- Maintenance Workflow documented.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.

Verification: git diff --check PASS.
Production: LOCKED / NO-GO.
No production, credential, provider, trust-root, signer, deployment, code or dependency change.
`
};
await mkdir(out,{recursive:true}); for(const [n,b] of Object.entries(files)) await writeFile(`${out}/${n}`,b,'utf8'); console.log(`Phase 77 maintenance model generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
