export function assertComplianceActor(actor) {
  if (!actor?.id || actor.status !== 'ACTIVE') throw new Error('UNAUTHORIZED');
  const roleNames = actor.roles?.map((link) => link.role.name) ?? [];
  if (roleNames.includes('SUPER_ADMIN') || !roleNames.includes('COMPLIANCE_AUDITOR')) throw new Error('FORBIDDEN');
  return actor;
}

export function complianceProjection(row) {
  return {
    audit_id: row.auditId,
    request_id: row.requestId,
    actor_type: row.actorType,
    action: row.action,
    entity: row.entity,
    result: row.result,
    reason_code: row.reasonCode,
    endpoint: row.endpoint,
    capability: row.capability,
    schema_version: row.schemaVersion,
    created_at: row.createdAt,
  };
}
