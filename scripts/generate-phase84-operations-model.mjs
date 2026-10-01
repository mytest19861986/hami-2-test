import { mkdir, writeFile } from 'node:fs/promises';
const out='temp/review'; await mkdir(out,{recursive:true});
const files={
'FW-02-R-phase84-operating-calendar.md':`# FW-02-R Phase 84-A — Governance Operating Calendar

| Review Type | Frequency | Owner Role | Required Evidence | Decision Point |
|---|---|---|---|---|
| Evidence freshness review | Periodic / on new evidence | Evidence Owner | Source, timestamp, integrity and scope | Current / stale / escalate |
| Finding review | Periodic / on status change | Project Owner | Finding record and supporting evidence | Remain open / remediate / escalate |
| Exception review | Before expiry and periodic | Project Owner | Exception rationale, scope and expiry | Maintain / revise / escalate |
| Change-impact review | On proposed change | Change Review Owner | Change classification and impact map | Review / revalidate / authority decision |
| Resume review | On resume trigger | Project Owner + required authority | Baseline and validation checklist | Resume review / remain blocked |
| Governance metrics review | Periodic | Governance Review Owner | Metric inputs and decision boundary | Informational / review / escalate |

Production remains LOCKED / NO-GO; calendar entries do not activate monitoring or authorize execution.
`,
'FW-02-R-phase84-ownership-model.md':`# FW-02-R Phase 84-B — Long-Term Ownership Model

| Ownership Area | Role | Boundary |
|---|---|---|
| Artifact Ownership | Artifact Owner / Project Owner | Maintain provenance and freshness; no historical reconstruction |
| Finding Ownership | Project Owner | Track status and remediation path; cannot silently close evidence gaps |
| Exception Ownership | Project Owner | Maintain scope, rationale and expiry; exception does not remediate Finding |
| Review Ownership | Governance Review Owner | Perform scheduled and event-driven reviews |
| Escalation Ownership | Required external authority | Decide authority-dependent, production or trust-root matters |

Current P52 Exception remains ACTIVE/ACCEPTED with Owner Role Project Owner. External authority ownership remains pending.
`,
'FW-02-R-phase84-maintenance-loop.md':`# FW-02-R Phase 84-C — Maintenance Operating Loop

Periodic Review
↓
Evidence Check
↓
Risk Evaluation
↓
Decision
↓
Update / Maintain / Escalate

The loop reopens review when new evidence, a finding/exception change, a material architecture or security change, an authority decision, a resume trigger, or exception expiry occurs. It never creates approval by inference.
`,
'FW-02-R-phase84-final-report.md':`# FW-02-R Phase 84 — Final Report

STATUS: COMPLETE / PASS

Completed:
- Governance operating calendar created with review type, frequency, owner, evidence and decision point.
- Long-term ownership model documented for artifacts, Finding, Exception, reviews and escalation.
- Maintenance operating loop defined from periodic review through evidence check, risk evaluation, decision and update/maintain/escalate.
- P52 Finding preserved: FW-02-R-P52-F001 = ACTIVE.
- P52 Exception preserved: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner.
- Production preserved: LOCKED / NO-GO.

Blocked:
- No new internal blocker; external authority ownership remains pending.

Next Recommended Task:
- Await Commander acceptance and request the next independent non-production task.

Commander Decision Required:
- ACCEPT/CLOSE Phase 84 and issue HOLD or the next explicit non-production task.
`
};
for(const [name,content] of Object.entries(files)) await writeFile(`${out}/${name}`,content,'utf8');
console.log(`Phase 84 operations model generated: outputs=${Object.keys(files).length}; production=LOCKED/NO-GO`);
