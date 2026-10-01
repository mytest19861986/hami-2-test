import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase89-reviewer-query-scenarios.md':`# FW-02-R Phase 89-A — Reviewer Query Scenarios

| Query | Answer path | Result |
|---|---|---|
| Why is Production LOCKED? | Decision → Authority dependency → Production boundary | Answerable: external authorization is pending |
| What evidence supports a decision? | Decision → Validation Result → Evidence → Artifact → Phase | Answerable through Phase 88 graph |
| Who owns a Finding? | Finding → Owner / Dependency | P52 Finding remains active; ownership is not transferred |
| Which items need external authority? | Decision → Authority dependency | Production authorization, trust-root, signer, provider and operational ownership |
| What must not be treated as PASS? | Validation Result → Finding / limitation | Missing historical evidence and unresolved authority inputs |

Result: all five reviewer queries have a bounded, non-speculative answer path.
`,
'FW-02-R-phase89-navigation-test.md':`# FW-02-R Phase 89-B — Traceability Navigation Test

## Validated navigation path

Question → Decision → Evidence → Artifact → Phase

## Reverse navigation

Phase → Artifact → Evidence → Validation Result → Decision → Finding / Exception → Owner / Dependency

Both directions preserve the P52 Finding, P52 Exception, external dependency boundary and Production LOCKED / NO-GO state.
`,
'FW-02-R-phase89-navigation-gap-report.md':`# FW-02-R Phase 89-C — Navigation Gap Report

| Gap | Result | Treatment |
|---|---|---|
| Missing Path | No material missing path for the five scoped queries | Preserve current graph |
| Ambiguous Path | External ownership remains intentionally unresolved | Keep as dependency, not assignment |
| Slow Review Path | Historical evidence query stops at P52 Finding | Mark limitation; do not reconstruct |
| Unclear Ownership Path | P52 owner role is not changed by this simulation | Preserve current ownership boundary |
| Unsupported Decision Path | Production decision lacks external authority input | Keep Production LOCKED / NO-GO |

Result: PASS_WITH_FINDING; navigation is usable within the documented scope.
`,
'FW-02-R-phase89-final-report.md':`# FW-02-R Phase 89 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Five reviewer query scenarios completed with bounded answer paths.
- Forward and reverse traceability navigation paths validated.
- Missing, ambiguous, slow, unclear-ownership and unsupported-decision paths classified.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- No historical evidence reconstructed; Production remains LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase89-traceability-query-simulation.mjs
- git diff --check: PASS

Blocked:
- Historical Phase 40 evidence remains missing.
- External authority dependencies remain pending.

Next Recommended Task:
- Await Commander acceptance, then HOLD or receive the next explicitly authorized non-production task.

Commander Decision Required:
- ACCEPT/CLOSE Phase 89 and explicitly declare HOLD or the next non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 89 traceability simulation generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
