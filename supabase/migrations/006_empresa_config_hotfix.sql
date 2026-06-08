-- =====================================================
-- 006_empresa_config_hotfix.sql — Repara empresa_config
-- =====================================================

CREATE TABLE IF NOT EXISTS empresa_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nombre TEXT NOT NULL DEFAULT 'Teixeira S.A.',
  ruc TEXT NOT NULL DEFAULT '80046906-2',
  direccion TEXT,
  telefono TEXT,
  timbrado TEXT DEFAULT '18781301',
  punto_expedicion TEXT DEFAULT '001-001',
  timbrado_desde DATE,
  timbrado_hasta DATE,
  actividad_comercial TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE empresa_config ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'empresa_config'
      AND policyname = 'auth_all_empresa_config'
  ) THEN
    CREATE POLICY "auth_all_empresa_config"
      ON empresa_config
      FOR ALL
      TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

INSERT INTO empresa_config (
  id,
  nombre,
  ruc,
  timbrado,
  punto_expedicion,
  timbrado_desde,
  timbrado_hasta,
  actividad_comercial,
  direccion
)
VALUES (
  1,
  'Teixeira S.A.',
  '80046906-2',
  '18781301',
  '001-001',
  '2026-04-10',
  '2027-04-30',
  'Elaboración, importación y distribución de edulcorantes',
  'San Lorenzo, Paraguay'
)
ON CONFLICT (id) DO NOTHING;
