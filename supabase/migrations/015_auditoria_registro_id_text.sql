-- Fix: change registro_id from UUID to TEXT so any string ID can be stored without cast errors.
-- This prevents silent insert failures when registro_id is a non-UUID string.
ALTER TABLE auditoria_logs
  ALTER COLUMN registro_id TYPE TEXT USING registro_id::TEXT;
