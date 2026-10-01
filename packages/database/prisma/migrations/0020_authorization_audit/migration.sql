-- FW-02-R implementation wave. Local/Test only; additive and forward-only.
CREATE TABLE "authorization_audit_event" (
  "audit_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "actor_type" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "entity" TEXT NOT NULL,
  "result" TEXT NOT NULL,
  "reason_code" TEXT,
  "endpoint" TEXT NOT NULL,
  "capability" TEXT NOT NULL,
  "opaque_resource_id" TEXT,
  "hashed_session_fingerprint" TEXT NOT NULL,
  "dedup_key" TEXT,
  "schema_version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authorization_audit_event_pkey" PRIMARY KEY ("audit_id"),
  CONSTRAINT "authorization_audit_event_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "authorization_audit_event_actor_type_ck" CHECK ("actor_type" IN ('REP','ADMIN','SYSTEM')),
  CONSTRAINT "authorization_audit_event_action_ck" CHECK ("action" IN ('VIEW_COMMISSION_SUMMARY_GRANTED','VIEW_COMMISSION_SUMMARY_DENIED')),
  CONSTRAINT "authorization_audit_event_result_ck" CHECK ("result" IN ('GRANTED','DENIED'))
);
CREATE UNIQUE INDEX "authorization_audit_event_request_id_action_key" ON "authorization_audit_event"("request_id","action");
CREATE INDEX "authorization_audit_event_created_at_idx" ON "authorization_audit_event"("created_at");
CREATE INDEX "authorization_audit_event_actor_id_created_at_idx" ON "authorization_audit_event"("actor_id","created_at");

CREATE TABLE "authorization_audit_outbox" (
  "id" TEXT NOT NULL,
  "audit_id" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "delivered_at" TIMESTAMP(3),
  CONSTRAINT "authorization_audit_outbox_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_audit_outbox_audit_id_key" UNIQUE ("audit_id"),
  CONSTRAINT "authorization_audit_outbox_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "authorization_audit_event"("audit_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "authorization_audit_outbox_delivery_idx" ON "authorization_audit_outbox"("delivered_at","created_at");

CREATE TABLE "authorization_audit_dead_letter" (
  "id" TEXT NOT NULL,
  "audit_id" TEXT NOT NULL,
  "request_id" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "payload" JSONB NOT NULL,
  "failure_class" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "authorization_audit_dead_letter_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "authorization_audit_dead_letter_audit_id_fkey" FOREIGN KEY ("audit_id") REFERENCES "authorization_audit_event"("audit_id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "authorization_audit_dead_letter_request_action_idx" ON "authorization_audit_dead_letter"("request_id","action");
CREATE INDEX "authorization_audit_dead_letter_created_at_idx" ON "authorization_audit_dead_letter"("created_at");
