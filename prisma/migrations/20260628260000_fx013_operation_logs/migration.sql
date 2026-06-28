-- FX-013: Operation Logs for observability

CREATE TABLE "operation_logs" (
    "id"          TEXT NOT NULL,
    "type"        TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'RUNNING',
    "started_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "summary"     JSONB,
    "error"       TEXT,
    "actor_id"    TEXT,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operation_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "operation_logs_type_created_at_idx"   ON "operation_logs"("type",   "created_at");
CREATE INDEX "operation_logs_status_created_at_idx" ON "operation_logs"("status", "created_at");
CREATE INDEX "operation_logs_actor_id_idx"          ON "operation_logs"("actor_id");
