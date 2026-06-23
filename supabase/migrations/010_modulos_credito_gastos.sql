-- ============================================================
-- SIRS - Migración 010: ajustes de vendedores, gastos y cobros
-- ============================================================

-- Vendedores: porcentaje de venta
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS porcentaje_venta NUMERIC(5,2) NOT NULL DEFAULT 0;

-- Gastos: IVA y control de saldo/estado para crédito
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS tasa_iva_id UUID REFERENCES tasas_iva(id),
  ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'pagado' CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'anulado'));

CREATE INDEX IF NOT EXISTS gastos_estado_condicion_idx ON gastos(estado, condicion);
CREATE INDEX IF NOT EXISTS gastos_proveedor_saldo_idx ON gastos(proveedor_id, saldo_pendiente);

-- Cobros: permitir cobro relacionado a gastos/proveedores
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS tipo_referencia TEXT NOT NULL DEFAULT 'clientes' CHECK (tipo_referencia IN ('clientes', 'gastos')),
  ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id);

CREATE TABLE IF NOT EXISTS cobro_gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  gasto_id UUID NOT NULL REFERENCES gastos(id),
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS cobro_gastos_cobro_idx ON cobro_gastos(cobro_id);
CREATE INDEX IF NOT EXISTS cobro_gastos_gasto_idx ON cobro_gastos(gasto_id);

ALTER TABLE cobro_gastos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'cobro_gastos' AND policyname = 'auth_all_cobro_gastos'
  ) THEN
    CREATE POLICY "auth_all_cobro_gastos" ON cobro_gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
