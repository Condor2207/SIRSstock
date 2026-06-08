-- ============================================================
-- SIRS - Cobros y Comisiones
-- ============================================================

-- =============================
-- Vendedores
-- =============================

CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id);

-- =============================
-- Comisiones
-- =============================

CREATE TABLE IF NOT EXISTS comisiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  venta_item_id UUID REFERENCES venta_items(id) ON DELETE SET NULL,
  vendedor_id UUID NOT NULL REFERENCES vendedores(id),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  producto_id UUID NOT NULL REFERENCES productos(id),
  numero_factura TEXT,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  precio_sin_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 0,
  porcentaje NUMERIC(6,2) NOT NULL DEFAULT 0,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  fecha_pago DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS comisiones_vendedor_fecha_idx ON comisiones(vendedor_id, fecha);
CREATE INDEX IF NOT EXISTS comisiones_estado_idx ON comisiones(estado);
CREATE INDEX IF NOT EXISTS comisiones_venta_idx ON comisiones(venta_id);

-- =============================
-- RLS
-- =============================

ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'vendedores' AND policyname = 'auth_all_vendedores'
  ) THEN
    CREATE POLICY "auth_all_vendedores" ON vendedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'comisiones' AND policyname = 'auth_all_comisiones'
  ) THEN
    CREATE POLICY "auth_all_comisiones" ON comisiones FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
