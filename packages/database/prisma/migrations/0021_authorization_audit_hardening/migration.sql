-- FW-02-R Local/Test hardening. Additive constraints and least-privilege roles only.
ALTER TABLE "authorization_audit_event"
  ALTER COLUMN "request_id" TYPE VARCHAR(128),
  ALTER COLUMN "result" TYPE VARCHAR(7);
ALTER TABLE "authorization_audit_event"
  ADD CONSTRAINT "authorization_audit_event_reason_ck"
  CHECK ("reason_code" IS NULL OR "reason_code" IN ('CAPABILITY_MISSING','OWNERSHIP_MISMATCH','PRINCIPAL_DISABLED')),
  ADD CONSTRAINT "authorization_audit_event_result_reason_ck"
  CHECK (("result" = 'GRANTED' AND "reason_code" IS NULL) OR ("result" = 'DENIED' AND "reason_code" IS NOT NULL));
ALTER TABLE "authorization_audit_dead_letter"
  ADD CONSTRAINT "authorization_audit_dead_letter_failure_class_ck"
  CHECK ("failure_class" IN ('DELIVERY_RETRY_EXHAUSTED','SERIALIZATION_FAILURE','DIVERGENT_REPLAY','POLICY_REJECTED'));
ALTER TABLE "authorization_audit_outbox"
  ADD CONSTRAINT "authorization_audit_outbox_payload_allowlist_ck"
  CHECK ("payload" <@ '{"audit_id":null,"request_id":null,"action":null,"result":null,"schema_version":null}'::jsonb);
ALTER TABLE "authorization_audit_dead_letter"
  ADD CONSTRAINT "authorization_audit_dead_letter_payload_allowlist_ck"
  CHECK ("payload" <@ '{"audit_id":null,"request_id":null,"action":null,"result":null,"schema_version":null}'::jsonb);

DO $$ BEGIN CREATE ROLE hami_audit_app NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE ROLE hami_audit_retention NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
REVOKE UPDATE, DELETE ON "authorization_audit_event", "authorization_audit_outbox", "authorization_audit_dead_letter" FROM hami_audit_app;
REVOKE ALL ON "authorization_audit_event", "authorization_audit_outbox", "authorization_audit_dead_letter" FROM hami_audit_retention;
GRANT SELECT, INSERT ON "authorization_audit_event" TO hami_audit_app;
GRANT INSERT, SELECT ON "authorization_audit_outbox", "authorization_audit_dead_letter" TO hami_audit_app;
