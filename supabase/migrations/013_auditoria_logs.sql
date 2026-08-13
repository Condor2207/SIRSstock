CREATE TABLE IF NOT EXISTS auditoria_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  session_id TEXT NOT NULL,
  modulo TEXT NOT NULL,
  entidad TEXT NOT NULL,
  accion TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  registro_id UUID,
  detalles JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS auditoria_logs_created_at_idx ON auditoria_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS auditoria_logs_session_id_idx ON auditoria_logs(session_id);
CREATE INDEX IF NOT EXISTS auditoria_logs_modulo_idx ON auditoria_logs(modulo);

ALTER TABLE auditoria_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'auditoria_logs' AND policyname = 'auth_all_auditoria_logs'
  ) THEN
    CREATE POLICY "auth_all_auditoria_logs"
      ON auditoria_logs
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;
