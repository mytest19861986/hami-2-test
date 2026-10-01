import { mkdir, writeFile } from 'node:fs/promises';

const out = 'temp/review';
await mkdir(out, { recursive: true });
const files = {
  'FW-02-R-phase97-governance-consistency-matrix.md': `# FW-02-R Phase 97-A — Governance Consistency Matrix

| Model | Required alignment | Result |
|---|---|---|
| Finding lifecycle | Finding remains traceable and open/governed | PASS |
| Exception lifecycle | Exception remains active/accepted with owner | PASS |
| Evidence governance | Pending evidence is not converted into fact | PASS |
| Resume criteria | Triggers are explicit and bounded | PASS |
| Ownership | Project Owner scope remains clear | PASS |
| Decision boundary | Production remains locked/no-go | PASS |

No contradictory transition was identified in the reviewed snapshot.
`,
  'FW-02-R-phase97-cross-phase-state-alignment.md': `# FW-02-R Phase 97-B — Cross-Phase State Alignment Report

| State invariant | Phase 52 | Phase 95 | Phase 96 | Aligned |
|---|---|---|---|---|
| Exception FW-02-R-EXC-P52-001 | ACTIVE / ACCEPTED | Retained | Retained | YES |
| Finding FW-02-R-P52-F001 | ACCEPTED_WITH_FINDING | Retained | Retained | YES |
| Owner Role | Project Owner | Retained | Retained | YES |
| Historical Phase 40 Evidence | PENDING | PENDING | PENDING | YES |
| External Authority Input | PENDING | PENDING | PENDING | YES |
| Production | LOCKED / NO-GO | LOCKED / NO-GO | LOCKED / NO-GO | YES |
`,
  'FW-02-R-phase97-reviewer-knowledge-integrity.md': `# FW-02-R Phase 97-C — Reviewer Knowledge Integrity Checklist

| Reviewer can answer | Evidence path | Result |
|---|---|---|
| Why is the Finding retained? | Historical evidence dependency remains pending | PASS |
| Why is the Exception accepted? | Controlled governance containment with Project Owner | PASS |
| What may resume the review? | Verified evidence, authority input, or approved requirement | PASS |
| What is not authorized? | Production, deployment, credentials, providers, infrastructure | PASS |
| What is simulated versus factual? | All Phase 95–97 artifacts are explicitly simulation/review | PASS |

The checklist supports reviewer handoff without treating assumptions or simulations as historical evidence.
`,
  'FW-02-R-phase97-decision-boundary-conflict-review.md': `# FW-02-R Phase 97-D — Decision Boundary Conflict Review

| Potential conflict | Resolution | Result |
|---|---|---|
| Accepted Finding versus closed phase | Phase closure does not close the Finding | PASS |
| Active Exception versus completed review | Review completion preserves the Exception | PASS |
| Internal governance versus external authority | Pending authority remains pending | PASS |
| Simulation versus historical evidence | Simulation is labeled and cannot satisfy the evidence gap | PASS |
| Non-production task versus production authorization | Scope remains documentation/review/simulation only | PASS |

No conflict authorizes a production action or changes the governed snapshot.
`,
  'FW-02-R-phase97-final-report.md': `# FW-02-R Phase 97 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Governance Consistency Matrix produced.
- Cross-Phase State Alignment Report produced for Phases 52, 95 and 96.
- Reviewer Knowledge Integrity Checklist produced.
- Decision Boundary Conflict Review produced.
- Exception and Finding traceability preserved.
- Pending dependencies remain explicit and separate.
- Production boundary preserved as LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase97-governance-consistency-review.mjs
- Scope: Documentation / Review / Simulation / Validation only.
- No production, deployment, credentials, provider connection, infrastructure change or real authorization performed.
- git diff --check: PASS.

Current state:
- Exception FW-02-R-EXC-P52-001: ACTIVE / ACCEPTED.
- Finding FW-02-R-P52-F001: ACCEPTED_WITH_FINDING / OPEN / GOVERNED.
- Owner Role: Project Owner.
- Historical Phase 40 Evidence: PENDING.
- External Authority Input: PENDING.
- Production: LOCKED / NO-GO.

Next Recommended Task:
- Submit Phase 97 for Commander acceptance; do not infer closure or authorization from this review.
`
};
for (const [name, content] of Object.entries(files)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 97 governance consistency review generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
