-- ============================================================
-- 019: Servicios, código de barras único, leyenda de factura,
--      IVA por ítem, gastos en GS/USD y cheques diferidos.
-- Migración aditiva: no elimina ni modifica datos existentes.
-- ============================================================

-- Productos: flag de servicio (no descuenta stock)
ALTER TABLE productos ADD COLUMN IF NOT EXISTS es_servicio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_barras TEXT;
-- Código de barras único (parcial: ignora vacíos y duplicados heredados no se tocan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM productos WHERE codigo_barras IS NOT NULL AND codigo_barras <> ''
    GROUP BY codigo_barras HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_codigo_barras
      ON productos(codigo_barras) WHERE codigo_barras IS NOT NULL AND codigo_barras <> '';
  ELSE
    RAISE NOTICE 'Existen códigos de barras duplicados; no se creó índice único. Depurar y reintentar.';
  END IF;
END $$;

-- Ventas: leyenda de la factura y número en formato 001-001-1234567 (texto libre, compatible)
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS leyenda TEXT;
ALTER TABLE ventas ADD COLUMN IF NOT EXISTS fecha_vencimiento_factura DATE;

-- Ítems: IVA aplicado, servicio y descripción del producto al momento de la venta
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10;
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS es_servicio BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE venta_items ADD COLUMN IF NOT EXISTS descripcion_producto TEXT;

-- Gastos: moneda y tipo de cambio opcional (sin tasa fija)
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'GS';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(12,2);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gastos_moneda_check' AND conrelid = 'gastos'::regclass) THEN
    ALTER TABLE gastos ADD CONSTRAINT gastos_moneda_check CHECK (moneda IN ('GS', 'USD'));
  END IF;
END $$;

-- Cheques diferidos de clientes
CREATE TABLE IF NOT EXISTS cheques_diferidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  banco_emisor TEXT NOT NULL,
  numero_cheque TEXT NOT NULL,
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  moneda TEXT NOT NULL DEFAULT 'GS' CHECK (moneda IN ('GS', 'USD')),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_cobro DATE NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'depositado', 'cobrado', 'rechazado', 'anulado')),
  observaciones TEXT,
  cobro_id UUID,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cheque_diferido_ventas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cheque_id UUID NOT NULL REFERENCES cheques_diferidos(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto_aplicado NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_cheques_cliente ON cheques_diferidos(cliente_id);
CREATE INDEX IF NOT EXISTS idx_cheques_estado ON cheques_diferidos(estado);
CREATE INDEX IF NOT EXISTS idx_cheques_fecha_cobro ON cheques_diferidos(fecha_cobro);

ALTER TABLE cheques_diferidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE cheque_diferido_ventas ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cheques_diferidos' AND policyname = 'auth_all_cheques_diferidos') THEN
    CREATE POLICY "auth_all_cheques_diferidos" ON cheques_diferidos FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'cheque_diferido_ventas' AND policyname = 'auth_all_cheque_diferido_ventas') THEN
    CREATE POLICY "auth_all_cheque_diferido_ventas" ON cheque_diferido_ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;
