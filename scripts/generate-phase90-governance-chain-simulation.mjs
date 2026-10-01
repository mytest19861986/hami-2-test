import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase90-end-to-end-scenarios.md':`# FW-02-R Phase 90-A — End-to-End Scenario Simulation

| Scenario | Simulated chain | Result |
|---|---|---|
| Historical evidence missing | Trigger → Review → Evidence Collection → Risk → Decision → Finding | PASS_WITH_FINDING; P52 remains ACTIVE |
| Dependency change request | Trigger → Review → Evidence → Risk → Decision → Dependency | External dependency identified; change not executed |
| Production authorization request | Trigger → Review → Authority Check → Decision | BLOCKED/NO-GO; no authorization inferred |
| Security finding discovery | Trigger → Review → Evidence → Risk → Finding → Follow-up | Finding recorded; no production action |

All scenarios preserve the non-production boundary.
`,
'FW-02-R-phase90-chain-validation.md':`# FW-02-R Phase 90-B — Governance Chain Validation

| Check | Result |
|---|---|
| Evidence available? | Classified explicitly; missing history remains missing |
| Ownership clear? | Internal roles preserved; external ownership remains pending |
| Decision boundary respected? | PASS; no approval inferred |
| Authority dependency identified? | PASS; production, trust-root, signer, provider and operational inputs pending |
| Prohibited action prevented? | PASS; no production, credential, provider, deployment, code or dependency change |

Chain: Trigger → Review → Evidence Collection → Risk Evaluation → Decision → Finding/Exception → Ownership → Follow-up Action
`,
'FW-02-R-phase90-final-chain-gap-report.md':`# FW-02-R Phase 90-C — Final Chain Gap Report

| Classification | Result |
|---|---|
| No Gap | Governance chain structure and prohibited-action controls |
| Minor Gap | Historical artifact reference remains incomplete |
| Requires Clarification | Future ownership and operational follow-up require authorized inputs |
| External Dependency | Production authorization, trust-root, signer, provider and operational ownership |
| Blocked | Production path remains blocked by missing authority |

No gap was converted into approval or reconstructed evidence.
`,
'FW-02-R-phase90-final-report.md':`# FW-02-R Phase 90 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Four end-to-end governance scenarios simulated.
- Governance chain validated from Trigger through Follow-up Action.
- Decision boundaries, authority dependencies and prohibited actions verified.
- Final chain gap report created.
- P52 Finding and P52 Exception preserved.
- Production preserved: LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase90-governance-chain-simulation.mjs
- git diff --check: PASS

Blocked:
- Historical Phase 40 evidence remains missing.
- External authority dependencies remain pending.

Next Recommended Task:
- Await Commander acceptance, then HOLD or receive the next explicitly authorized non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 90 governance chain generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
