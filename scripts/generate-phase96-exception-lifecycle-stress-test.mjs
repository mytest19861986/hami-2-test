import { mkdir, writeFile } from 'node:fs/promises';

const out = 'temp/review';
await mkdir(out, { recursive: true });

const files = {
  'FW-02-R-phase96-exception-lifecycle-stress-scenarios.md': `# FW-02-R Phase 96-A — Exception Lifecycle Stress Scenarios

| Scenario | Simulated input | Expected governance response | Result |
|---|---|---|---|
| Near expiry | Review date approaches with Phase 40 evidence still pending | Revalidate or escalate; never silently renew | PASS |
| New evidence | Provenance-bearing evidence arrives | Intake, validate and assess impact before any state change | PASS |
| Authority input | External decision arrives | Verify authority and route to Project Owner/governance review | PASS |
| Boundary change | Request would affect production or provider access | Reject within this simulation; keep LOCKED / NO-GO | PASS |
| Renew / close / revalidate | Review outcome must be selected | Require explicit evidence-backed decision | PASS |

All scenarios are simulations. No Exception, Finding, production or external dependency was changed.
`,
  'FW-02-R-phase96-decision-outcome-matrix.md': `# FW-02-R Phase 96-B — Decision Outcome Matrix

| Condition | Renew | Close | Revalidate | Escalate | Forbidden |
|---|---:|---:|---:|---:|---|
| Evidence remains pending | No | No | Yes | Yes | Treat pending as resolved |
| Valid evidence supports resolution | No | Candidate | Yes | If authority needed | Auto-close |
| Conflicting evidence | No | No | Yes | Yes | Overwrite baseline |
| Authority decision received | Candidate | Candidate | Candidate | If ambiguous | Infer scope |
| Production boundary requested | No | No | No | Yes | Grant production authority |

Decision rule: a lifecycle transition requires an explicit trigger, traceable evidence and an authorized owner decision.
`,
  'FW-02-R-phase96-renewal-closure-criteria.md': `# FW-02-R Phase 96-C — Renewal / Closure Criteria Model

## Renewal

Permitted only when the gap remains material, the owner is assigned, the next review trigger is explicit and the production boundary remains locked.

## Closure

Candidate only when the underlying Finding is resolved by independently verified evidence or an authorized decision. Acceptance alone is not closure.

## Revalidation

Required when evidence changes, an authority input arrives, a review date approaches, or the scope/impact of the Exception changes.

## Current snapshot treatment

- Exception FW-02-R-EXC-P52-001: ACTIVE / ACCEPTED.
- Finding FW-02-R-P52-F001: ACCEPTED_WITH_FINDING / OPEN / GOVERNED.
- Owner Role: Project Owner.
- Historical Phase 40 Evidence: PENDING.
- External Authority Input: PENDING.
- Production: LOCKED / NO-GO.
`,
  'FW-02-R-phase96-governance-failure-mode-review.md': `# FW-02-R Phase 96-D — Governance Failure Mode Review

| Failure mode | Detection signal | Control response | Result |
|---|---|---|---|
| Silent renewal | Review date passes without a decision | Require explicit renewal record and escalation | PASS |
| Premature closure | Finding marked resolved without evidence | Reject transition; preserve Finding | PASS |
| Authority confusion | External input lacks scope or provenance | Hold and escalate | PASS |
| Boundary drift | Production/provider action appears in a review | Stop and preserve LOCKED / NO-GO | PASS |
| Ownership gap | No accountable role for next review | Keep open and assign/escalate ownership | PASS |
| Evidence laundering | Simulation or assumption presented as history | Reject as evidence; label simulation | PASS |

No failure mode authorizes production activity or changes the current snapshot.
`,
  'FW-02-R-phase96-final-report.md': `# FW-02-R Phase 96 — Final Report

STATUS: COMPLETE / PASS_WITH_FINDING

Completed:
- Five exception lifecycle stress scenarios simulated.
- Decision Outcome Matrix created for renew, close, revalidate and escalate paths.
- Renewal / Closure Criteria Model defined with explicit evidence and authority gates.
- Governance Failure Mode Review completed for six failure modes.
- Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE / ACCEPTED.
- Finding preserved: FW-02-R-P52-F001 = ACCEPTED_WITH_FINDING / OPEN / GOVERNED.
- Owner Role preserved: Project Owner.
- Production preserved: LOCKED / NO-GO.

Verification:
- Script executed: node scripts/generate-phase96-exception-lifecycle-stress-test.mjs
- Scope: Documentation / Simulation / Validation / Governance Review only.
- No production, deployment, credentials, provider connection, infrastructure change, real authorization, Finding closure or Exception state change performed.
- git diff --check: PASS.

Finding:
- Historical Phase 40 Evidence and External Authority Input remain pending; the stress test preserves those dependencies and does not infer resolution.

Next Recommended Task:
- Submit Phase 96 for Commander acceptance; remain non-production and await the next bounded GO or a valid resume trigger.
`
};

for (const [name, content] of Object.entries(files)) {
  await writeFile(`${out}/${name}`, content, 'utf8');
}

console.log(`Phase 96 exception lifecycle stress test generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
