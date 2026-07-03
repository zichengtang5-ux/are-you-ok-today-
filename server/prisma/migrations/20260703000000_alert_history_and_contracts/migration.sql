-- Allow multiple historical alert events for the same guard status.
DROP INDEX IF EXISTS "AlertEvent_guardStatusId_key";

CREATE INDEX IF NOT EXISTS "AlertEvent_guardStatusId_idx" ON "AlertEvent"("guardStatusId");
