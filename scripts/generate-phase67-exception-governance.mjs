import { mkdir, writeFile } from 'node:fs/promises';

const out = 'G:/project/TEST/hami/temp/review';
await mkdir(out, { recursive: true });

const docs = {
  'FW-02-R-phase67-exception-lifecycle.md': `# FW-02-R Phase 67-A — Security Exception Lifecycle Model

| State | Entry condition | Required record | Exit states |
|---|---|---|---|
| Created | A bounded gap or risk is identified | Impact, rationale, scope and proposed owner | Reviewed |
| Reviewed | Reviewer validates the record and boundaries | Review decision and evidence references | Accepted, Closed |
| Accepted | Authorized owner accepts the bounded risk | Owner, acceptance date and review/expiry date | Monitored, Renewed, Closed, Expired |
| Monitored | Accepted Exception is tracked at its cadence | Current status, mitigation and trigger review | Renewed, Closed, Expired |
| Expired | Review or expiry date passes without valid renewal | Expiry reason and escalation record | Renewed, Closed |
| Renewed | Review confirms continued bounded need | New review evidence and next expiry date | Monitored, Closed, Expired |
| Closed | Risk is removed, evidence is restored or authority withdraws it | Closure rationale and final reviewer | Terminal |

Current P52 state: FW-02-R-EXC-P52-001 = ACTIVE/ACCEPTED; Owner Role = Project Owner. The related Finding FW-02-R-P52-F001 remains ACTIVE.
`,
  'FW-02-R-phase67-review-cadence.md': `# FW-02-R Phase 67-B — Exception Review Cadence

| Review item | Interval / trigger | Required evidence | Closure condition |
|---|---|---|---|
| Exception validity | At each governance review wave and before expiry | Current scope, owner, impact and rationale | Exception no longer required or is formally renewed |
| Historical evidence gap | On receipt of authoritative artifact or evidence decision | Original artifact reference; never a fabricated replacement | Finding closed only with valid evidence and review |
| Mitigation status | Each scheduled review and on material change | Mitigation progress and residual risk | Mitigation complete or risk re-accepted explicitly |
| Ownership | On owner change or organizational change | Named accountable role and acceptance record | Owner confirmed or Exception escalated |
| External authority dependency | When authority status changes | Authorization, trust, signer, provider or operations evidence | Dependency resolved or Production remains blocked |
| Expiry | At expiry date | Renewal decision or closure record | No silent continuation after expiry |

Review cadence is governance-only. It does not activate monitoring, Production, providers, credentials, signing, deployment or CI enforcement.
`,
  'FW-02-R-phase67-exception-quality-checklist.md': `# FW-02-R Phase 67-C — Exception Quality Checklist

| Quality question | Required result | P52 status |
|---|---|---|
| Is the impact explicit? | Scope and consequence are bounded | PASS — missing historical Phase 40 artifact |
| Is the rationale recorded? | Reason for Exception is traceable | PASS — historical evidence unavailable; no reconstruction permitted |
| Is mitigation recorded? | Mitigation or containment is explicit | PASS — Finding remains visible and Production remains locked |
| Is the owner explicit? | Accountable role is named | PASS — Project Owner |
| Is review/expiry defined? | Date or trigger prevents silent continuation | PASS — governed by review cadence |
| Is evidence separated from assumption? | Unknowns remain pending | PASS |
| Is Production authorization excluded? | Exception cannot authorize Production | PASS — Production LOCKED / NO-GO |

No risk is hidden by this checklist. Acceptance of FW-02-R-EXC-P52-001 does not convert FW-02-R-P52-F001 to PASS and does not replace the missing historical artifact.
`,
  'FW-02-R-phase67-final-report.md': `# FW-02-R Phase 67 — Final Report

Result: PASS — Security Exception Management & Review Cadence Governance.

- Exception lifecycle documented: PASS
- Review cadence and revalidation triggers defined: PASS
- Exception quality checklist created: PASS
- P52 Finding preserved as ACTIVE: PASS
- P52 Exception preserved as ACTIVE/ACCEPTED with Owner Role = Project Owner: PASS
- No risk hidden or converted to fact: PASS
- Production impact: NONE
- Production: LOCKED / NO-GO

No Production, credential, provider, trust-root, signer, deployment, CI, code or dependency change occurred.
`
};

for (const [name, content] of Object.entries(docs)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 67 exception governance generated: outputs=${Object.keys(docs).length}; production=LOCKED/NO-GO`);
