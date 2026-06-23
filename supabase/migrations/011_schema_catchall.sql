-- ============================================================
-- SIRS - Migración 011: catchall de columnas faltantes
-- Agrega todas las columnas/tablas que pueden faltar en la DB
-- si las migraciones 007, 009 y 010 no fueron ejecutadas.
-- Es idempotente: usa ADD COLUMN IF NOT EXISTS y CREATE TABLE IF NOT EXISTS.
-- ============================================================

-- =============================
-- Tablas de configuración
-- =============================

CREATE TABLE IF NOT EXISTS bancos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bancos' AND policyname = 'auth_all_bancos'
  ) THEN
    CREATE POLICY "auth_all_bancos" ON bancos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS tasas_iva (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  porcentaje NUMERIC(5,2) NOT NULL DEFAULT 10,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE tasas_iva ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'tasas_iva' AND policyname = 'auth_all_tasas_iva'
  ) THEN
    CREATE POLICY "auth_all_tasas_iva" ON tasas_iva FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS condiciones_venta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  plazo_dias INTEGER NOT NULL DEFAULT 0,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE condiciones_venta ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'condiciones_venta' AND policyname = 'condiciones_venta_auth_read'
  ) THEN
    CREATE POLICY "condiciones_venta_auth_read" ON condiciones_venta FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'condiciones_venta' AND policyname = 'condiciones_venta_auth_write'
  ) THEN
    CREATE POLICY "condiciones_venta_auth_write" ON condiciones_venta FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================
-- Gastos: columnas faltantes
-- =============================

-- De migración 007
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_transaccion TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_cheque TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_cheque DATE;

-- De migración 009
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'debito';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- De migración 010
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tasa_iva_id UUID REFERENCES tasas_iva(id);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS saldo_pendiente NUMERIC(12,2) DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = 'estado'
  ) THEN
    ALTER TABLE gastos
      ADD COLUMN estado TEXT DEFAULT 'pagado'
      CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'anulado'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS gastos_estado_condicion_idx ON gastos(estado, condicion);
CREATE INDEX IF NOT EXISTS gastos_proveedor_saldo_idx ON gastos(proveedor_id, saldo_pendiente);

-- =============================
-- Compras: columnas faltantes
-- =============================

-- De migración 009
ALTER TABLE compras ADD COLUMN IF NOT EXISTS costo_flete NUMERIC(12,2) DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS plazo_dias INTEGER;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS cantidad_cuotas INTEGER DEFAULT 1;

ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10;

CREATE TABLE IF NOT EXISTS compra_cuotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE compra_cuotas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'compra_cuotas' AND policyname = 'auth_all_compra_cuotas'
  ) THEN
    CREATE POLICY "auth_all_compra_cuotas" ON compra_cuotas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================
-- Proveedores: columnas faltantes
-- =============================

-- De migración 009
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id);

-- =============================
-- Cobros: tabla y columnas faltantes
-- =============================

-- De migración 009: tabla cobros y tablas relacionadas
CREATE TABLE IF NOT EXISTS cobros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  concepto TEXT,
  total_facturas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_retenciones NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cobrado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado','anulado')),
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cobros' AND policyname = 'auth_all_cobros'
  ) THEN
    CREATE POLICY "auth_all_cobros" ON cobros FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cobro_facturas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE cobro_facturas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cobro_facturas' AND policyname = 'auth_all_cobro_facturas'
  ) THEN
    CREATE POLICY "auth_all_cobro_facturas" ON cobro_facturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cobro_retenciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  numero_retencion TEXT,
  concepto TEXT,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0
);

ALTER TABLE cobro_retenciones ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cobro_retenciones' AND policyname = 'auth_all_cobro_retenciones'
  ) THEN
    CREATE POLICY "auth_all_cobro_retenciones" ON cobro_retenciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS cobro_medios_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo','transferencia','cheque_dia','cheque_diferido','tarjeta','otro')),
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  numero_cheque TEXT,
  banco_id UUID REFERENCES bancos(id),
  fecha_cheque DATE,
  numero_transaccion TEXT
);

ALTER TABLE cobro_medios_pago ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'cobro_medios_pago' AND policyname = 'auth_all_cobro_medios_pago'
  ) THEN
    CREATE POLICY "auth_all_cobro_medios_pago" ON cobro_medios_pago FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- De migración 010: columnas adicionales en cobros
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS tipo_referencia TEXT DEFAULT 'clientes';
ALTER TABLE cobros ADD COLUMN IF NOT EXISTS proveedor_id UUID REFERENCES proveedores(id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cobros_tipo_referencia_chk'
  ) THEN
    ALTER TABLE cobros
      ADD CONSTRAINT cobros_tipo_referencia_chk
      CHECK (tipo_referencia IN ('clientes', 'gastos'));
  END IF;
END $$;

-- De migración 010: tabla cobro_gastos
CREATE TABLE IF NOT EXISTS cobro_gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  gasto_id UUID NOT NULL REFERENCES gastos(id),
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0
);

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

CREATE INDEX IF NOT EXISTS cobro_gastos_cobro_idx ON cobro_gastos(cobro_id);
CREATE INDEX IF NOT EXISTS cobro_gastos_gasto_idx ON cobro_gastos(gasto_id);
