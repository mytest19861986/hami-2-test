import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase85-handover-package-validation.md':`# FW-02-R Phase 85-A — Handover Package Validation

| Package Area | Validation Result | Handover Note |
|---|---|---|
| Current State | COMPLETE | FW-02-R status, completed domains, open Finding and Production boundary are explicit |
| Evidence Map | COMPLETE | Evidence sources, freshness and integrity boundaries are documented |
| Finding Register | COMPLETE | FW-02-R-P52-F001 remains ACTIVE |
| Exception Register | COMPLETE | FW-02-R-EXC-P52-001 remains ACTIVE/ACCEPTED; Owner Role Project Owner |
| Ownership Map | COMPLETE | Internal roles and pending external authority ownership are separated |
| Decision History | COMPLETE | Phase decisions and acceptance history are retained |

No production authorization, ownership assignment, credential, provider or trust-root transfer is implied.
`,
'FW-02-R-phase85-new-owner-simulation.md':`# FW-02-R Phase 85-B — New Owner Simulation

## Scenario

1. New Owner receives the governance package.
2. New Owner reviews current state, evidence map and decision history.
3. New Owner identifies the open P52 Finding and active Exception.
4. New Owner confirms Production is LOCKED / NO-GO.
5. New Owner understands documentation, review and authority boundaries.
6. New Owner requests missing external authority inputs rather than inferring them.

Simulation result: COMPLETE. The scenario identifies all open items and preserves the distinction between internal readiness and external authority.
`,
'FW-02-R-phase85-responsibility-transfer-matrix.md':`# FW-02-R Phase 85-C — Responsibility Transfer Matrix

| Area | Current Owner | Future Owner Role | Required Knowledge | Transfer Status |
|---|---|---|---|---|
| Governance artifacts | Project Owner / Artifact Owner | Governance Maintainer | Provenance, freshness, reference integrity | Ready for documented handover |
| Finding tracking | Project Owner | Risk/Governance Owner | Finding lifecycle and evidence gap rules | Ready for documented handover |
| Exception tracking | Project Owner | Governance Maintainer | Scope, rationale, expiry and non-remediation boundary | Ready for documented handover |
| Periodic review | Governance Review Owner | Review Owner | Operating calendar and maintenance loop | Ready for documented handover |
| External escalation | Pending external authority | Authorized Authority Role | Production, trust-root, signer and provider decisions | Pending authority assignment |

Actual ownership assignment is out of scope and was not performed.
`,
'FW-02-R-phase85-final-report.md':`# FW-02-R Phase 85 — Final Report

STATUS: COMPLETE / PASS

Completed:
- Handover package validated across Current State, Evidence Map, Finding Register, Exception Register, Ownership Map and Decision History.
- New Owner simulation completed, including open-item identification, boundary understanding and request for missing authority inputs.
- Responsibility Transfer Matrix created with current owner, future role, required knowledge and transfer status.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Blocked:
- No new internal blocker; actual external ownership assignment remains pending and out of scope.

Next Recommended Task:
- Await Commander acceptance and request the next independent non-production task.

Commander Decision Required:
- ACCEPT/CLOSE Phase 85 and issue HOLD or the next explicit non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 85 handover simulation generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
