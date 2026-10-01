import { mkdir, writeFile } from 'node:fs/promises';

const out = 'G:/project/TEST/hami/temp/review';
await mkdir(out, { recursive: true });

const docs = {
  'FW-02-R-phase64-retention-model.md': `# FW-02-R Phase 64-A — Evidence Retention Model

| Artifact type | Retention need | Version strategy | Archive state | Review trigger | Deletion boundary |
|---|---|---|---|---|---|
| Decision record | Preserve rationale and authority | Immutable revision history | ACTIVE or ARCHIVED | Decision superseded or authority changes | Never delete while referenced |
| Test/evaluation evidence | Preserve reproducible result | Content-addressed or immutable snapshot | ACTIVE, SUPERSEDED or ARCHIVED | Test contract or environment changes | Delete only by approved retention policy |
| Finding/Exception record | Preserve audit trail | Append-only status history | ACTIVE, EXCEPTION or EXPIRED | Finding disposition or exception expiry | Never silently delete |
| Review report | Preserve reviewer conclusion | Versioned report with context | ACTIVE or ARCHIVED | New review wave | Delete only after governed retention expiry |

FW-02-R-P52-F001 remains ACTIVE. FW-02-R-EXC-P52-001 remains ACTIVE/ACCEPTED with Owner Role = Project Owner. Historical evidence is not recreated.
`,
  'FW-02-R-phase64-lifecycle-state-model.md': `# FW-02-R Phase 64-B — Evidence Lifecycle State Model

| State | Meaning | Allowed transition | Required evidence |
|---|---|---|---|
| ACTIVE | Current evidence used for review | REVIEW_REQUIRED or ARCHIVED | Source, context and owner |
| REVIEW_REQUIRED | Evidence needs revalidation | ACTIVE, SUPERSEDED or EXCEPTION | Trigger and reviewer decision |
| ARCHIVED | Retained but not current | REVIEW_REQUIRED or EXPIRED | Archive location and integrity reference |
| SUPERSEDED | Replaced by a newer version | ARCHIVED | Successor reference and reason |
| EXPIRED | Retention or exception window ended | REVIEW_REQUIRED only by governed reactivation | Expiry reason and authority |
| EXCEPTION | Governed evidence gap or deviation | ACTIVE, REVIEW_REQUIRED or EXPIRED | Exception ID, scope and owner |

Transitions are documentation controls; they do not authorize Production access, deployment or deletion.
`,
  'FW-02-R-phase64-archive-recovery-simulation.md': `# FW-02-R Phase 64-C — Recovery from Archive Simulation

## Simulation

1. Select a required decision, finding or review artifact by stable identifier.
2. Locate the archived version and verify its integrity reference and context.
3. Follow successor/superseded links to identify the current applicable record.
4. Confirm the reviewer can distinguish archived evidence from current evidence.
5. Confirm FW-02-R-P52-F001 and FW-02-R-EXC-P52-001 remain traceable.

Result: PASS (documentation-only simulation). No historical artifact was reconstructed and no archive was modified.
`,
  'FW-02-R-phase64-final-report.md': `# FW-02-R Phase 64 — Final Report

Result: PASS — Evidence Retention & Archive Lifecycle Governance Review.

- Retention model documented: PASS
- Lifecycle states defined: PASS
- Archive recovery simulation completed: PASS
- Exception P52 preserved: PASS
- No historical evidence recreated: PASS
- Production impact: NONE
- Production: LOCKED / NO-GO

No Production, credential, provider, trust-root, signer, deployment, CI, dependency, infrastructure or application changes occurred.
`
};

for (const [name, content] of Object.entries(docs)) await writeFile(`${out}/${name}`, content, 'utf8');
console.log(`Phase 64 retention governance generated: outputs=${Object.keys(docs).length}; production=LOCKED/NO-GO`);
