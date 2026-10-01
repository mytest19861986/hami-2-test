import { mkdir, writeFile } from 'node:fs/promises';

const out = 'G:/project/TEST/hami/temp/review';
await mkdir(out, { recursive: true });

const docs = {
  'FW-02-R-phase66-dependency-inventory.md': `# FW-02-R Phase 66-A — External Dependency Inventory

| Dependency category | Purpose | Evidence available | Owner category | Risk | Review requirement |
|---|---|---|---|---|---|
| Production authorization | Authorize any future Production activity | No authorization recorded | External authority | Critical | Explicit approval before Production consideration |
| Trust-root ownership | Establish accountable trust-root authority | Ownership not supplied | External security/platform owner | Critical | Ownership and scope review |
| Signing authority | Control release/signing decisions | No signer authorization recorded | External security/release owner | Critical | Formal signer decision |
| Provider/platform ownership | Define responsibility for external services | Provider ownership pending | External platform owner | High | Dependency and provider review |
| Operational ownership | Define accountable operational operator | Operational owner pending | External operations owner | High | Runbook and escalation ownership review |
| Historical Phase 40 artifact | Resolve evidence gap | Artifact unavailable; Finding active | Internal governance tracking | Medium | Preserve Finding and review Exception; do not recreate artifact |

This inventory records governance facts and open ownership gaps. It does not establish ownership or imply approval.
`,
  'FW-02-R-phase66-trust-boundary-map.md': `# FW-02-R Phase 66-B — Third-Party Trust Boundary

| Boundary class | Interpretation | Current state | Required control |
|---|---|---|---|
| Internal control | Evidence, decisions, Findings, Exceptions and documentation maintained by the project | Controlled | Preserve traceability and review history |
| External dependency | Provider, platform, authority or operational owner outside the current evidence set | Pending / not authorized | Identify accountable owner before activation |
| Unknown / pending | Any dependency whose evidence or owner is not established | Must not be treated as fact | Escalate for explicit decision |
| Requires approval | Any action crossing Production, trust, signing or provider boundary | Not approved | Obtain formal authority before action |

The trust boundary is documentation-only. No provider connection, credential use, trust-root creation, signer activity or deployment occurred.
`,
  'FW-02-R-phase66-approval-matrix.md': `# FW-02-R Phase 66-C — Approval Requirement Matrix

| Decision area | Approval required from | Evidence required before approval | Current disposition |
|---|---|---|---|
| Production authorization | Production Owner | Readiness package and explicit authorization | Pending; Production LOCKED / NO-GO |
| Trust-root ownership | Security/Platform Authority | Ownership scope and trust model | Pending |
| Signing authority | Security/Release Authority | Signer scope, custody and review record | Pending |
| Provider/platform use | Platform/Procurement/Security owner | Vendor evidence, ownership and exit criteria | Pending |
| Operational ownership | Operations Owner | Runbook ownership and escalation path | Pending |
| Historical evidence gap | Governance reviewer / Project Owner | No fabricated artifact; traceable Finding and Exception | Controlled; Finding remains ACTIVE |

Approval requirements are separated from evidence already proven. Acceptance of an Exception is not approval for Production or external dependency activation.
`,
  'FW-02-R-phase66-final-report.md': `# FW-02-R Phase 66 — Final Report

Result: PASS — Third-Party & External Dependency Governance Review.

- External dependency inventory created: PASS
- Trust boundary map documented: PASS
- Ownership gaps identified: PASS
- Approval requirements separated from facts: PASS
- P52 Finding preserved: PASS
- P52 Exception preserved as ACTIVE/ACCEPTED with Owner Role = Project Owner: PASS
- Production impact: NONE
- Production: LOCKED / NO-GO

No Production activity, provider connection, credential use, vendor onboarding, trust-root, signer, deployment, infrastructure, CI, code or dependency change occurred.
`
};

for (const [name, content] of Object.entries(docs)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 66 external dependency governance generated: outputs=${Object.keys(docs).length}; production=LOCKED/NO-GO`);
