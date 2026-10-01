import { mkdir, writeFile } from 'node:fs/promises';

const out = 'temp/review';
await mkdir(out, { recursive: true });
const files = {
  'FW-02-R-phase94-decision-replay-scenarios.md': `# FW-02-R Phase 94-A — Decision Replay Scenarios

| Scenario | Replay question | Expected boundary |
|---|---|---|
| Finding created and Exception registered | Why was the control gap retained? | Finding and Exception remain recorded; no automatic closure |
| Production request raised | Why was the request blocked? | Production remains LOCKED / NO-GO pending authority |
| Dependency change proposed | What impact review is required? | Revalidate baseline and traceability before any change |
| External authority pending | What decision is still unavailable? | External dependency remains PENDING; do not infer approval |

Scenarios are simulated only; no project state is changed.
`,
  'FW-02-R-phase94-decision-reconstruction-path.md': `# FW-02-R Phase 94-B — Decision Reconstruction Path

Original Question → Available Evidence → Risk Context → Decision Boundary → Recorded Decision → Reviewer Replay Result

| Replay result | Meaning |
|---|---|
| Fully Reconstructable | Existing records support the recorded decision without inference |
| Partially Reconstructable | Core path exists but a non-critical context element is missing |
| Requires Missing Evidence | Replay cannot be completed without unavailable evidence |
| Requires External Authority | Replay reaches an authority boundary that is still pending |
`,
  'FW-02-R-phase94-replay-gap-classification.md': `# FW-02-R Phase 94-C — Replay Gap Classification

| Gap class | Treatment |
|---|---|
| Fully Reconstructable | Record replay as verified; preserve the original decision |
| Partially Reconstructable | Record the missing context; preserve the original decision |
| Requires Missing Evidence | Keep the gap explicit; do not reconstruct history |
| Requires External Authority | Escalate or remain pending; do not infer authorization |

Forbidden: Production, decision change, Finding closure, Exception modification, credential, provider, trust-root, signer, code, dependency or ownership transfer.
`,
  'FW-02-R-phase94-final-report.md': `# FW-02-R Phase 94 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Four decision replay scenarios simulated.
- Historical decision reconstruction path validated from question through reviewer result.
- Replay gaps classified as fully/partially reconstructable, missing evidence, or external authority required.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase94-decision-replay-simulation.mjs
- Scope: Documentation / Simulation / Verification only.
- No production, decision change, Finding closure, Exception modification, credential, provider, trust-root, signer, code, dependency or ownership transfer performed.
- git diff --check: PASS.

Blocked:
- Historical evidence and external authority inputs remain pending.

Next Recommended Task:
- Await Commander acceptance; remain in controlled dormancy unless a new bounded non-production GO is issued.
`
};
for (const [name, content] of Object.entries(files)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 94 decision replay simulation generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
