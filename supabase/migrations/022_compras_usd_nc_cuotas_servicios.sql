-- ============================================================
-- 022: Compras en USD, cantidades decimales, control genérico de lote/vencimiento,
--      comprobante obligatorio, cuotas/pagos de compras, notas de crédito recibidas,
--      tipo de servicio en gastos y datos fiscales de proveedores.
-- Migración aditiva: no elimina ni modifica datos existentes.
-- Moneda: 'GS' | 'USD' (mismo criterio que gastos y cheques).
-- ============================================================

-- ---------- Productos: tipo de control y decimales ----------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'productos' AND column_name = 'tipo_control') THEN
    ALTER TABLE productos ADD COLUMN tipo_control TEXT NOT NULL DEFAULT 'generico';
    UPDATE productos SET tipo_control = 'lote_vencimiento' WHERE control_lote = TRUE;
  END IF;
END $$;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS permite_decimales BOOLEAN NOT NULL DEFAULT TRUE;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'productos_tipo_control_check' AND conrelid = 'productos'::regclass) THEN
    ALTER TABLE productos ADD CONSTRAINT productos_tipo_control_check
      CHECK (tipo_control IN ('lote_vencimiento', 'solo_lote', 'solo_vencimiento', 'generico'));
  END IF;
END $$;
-- ---------- Compras: moneda, tipo de cambio, IVA, comprobante ----------
ALTER TABLE compras ADD COLUMN IF NOT EXISTS numero_factura TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'GS';
ALTER TABLE compras ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(14,4);
ALTER TABLE compras ADD COLUMN IF NOT EXISTS iva_total NUMERIC(14,2) NOT NULL DEFAULT 0;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS comprobante_nombre TEXT;
ALTER TABLE compras ADD COLUMN IF NOT EXISTS costo_flete NUMERIC(14,2) DEFAULT 0;
ALTER TABLE compras ALTER COLUMN subtotal TYPE NUMERIC(14,2);
ALTER TABLE compras ALTER COLUMN total TYPE NUMERIC(14,2);
ALTER TABLE compras ALTER COLUMN saldo_pendiente TYPE NUMERIC(14,2);
ALTER TABLE compras ALTER COLUMN costo_flete TYPE NUMERIC(14,2);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_moneda_check' AND conrelid = 'compras'::regclass) THEN
    ALTER TABLE compras ADD CONSTRAINT compras_moneda_check CHECK (moneda IN ('GS', 'USD'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compras_tipo_cambio_check' AND conrelid = 'compras'::regclass) THEN
    ALTER TABLE compras ADD CONSTRAINT compras_tipo_cambio_check CHECK (tipo_cambio IS NULL OR tipo_cambio > 0);
  END IF;
END $$;

ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS tipo_control TEXT NOT NULL DEFAULT 'generico';
ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10;
ALTER TABLE compra_items ADD COLUMN IF NOT EXISTS monto_iva NUMERIC(14,4) NOT NULL DEFAULT 0;
ALTER TABLE compra_items ALTER COLUMN precio_unitario TYPE NUMERIC(14,4);
ALTER TABLE compra_items ALTER COLUMN subtotal TYPE NUMERIC(14,2);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'compra_items_tipo_control_check' AND conrelid = 'compra_items'::regclass) THEN
    ALTER TABLE compra_items ADD CONSTRAINT compra_items_tipo_control_check
      CHECK (tipo_control IN ('lote_vencimiento', 'solo_lote', 'solo_vencimiento', 'generico'));
  END IF;
END $$;

-- ---------- Gastos: moneda, tipo de servicio y comprobante ----------
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'GS';
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_cambio NUMERIC(14,4);
ALTER TABLE gastos ALTER COLUMN monto TYPE NUMERIC(14,2);
ALTER TABLE gastos ALTER COLUMN tipo_cambio TYPE NUMERIC(14,4);
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS tipo_servicio TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS detalle_servicio TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS comprobante_url TEXT;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS comprobante_nombre TEXT;

CREATE TABLE IF NOT EXISTS gasto_tipos_servicio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gasto_tipos_servicio_nombre ON gasto_tipos_servicio (lower(nombre));
INSERT INTO gasto_tipos_servicio (nombre) VALUES
  ('Flete'), ('Combustible'), ('Mantenimiento'), ('Alquiler'), ('Honorarios'),
  ('Internet'), ('Energía eléctrica'), ('Agua'), ('Telefonía'), ('Publicidad'),
  ('Seguros'), ('Otros')
ON CONFLICT DO NOTHING;
ALTER TABLE gasto_tipos_servicio ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_gasto_tipos_servicio" ON gasto_tipos_servicio;
CREATE POLICY "auth_all_gasto_tipos_servicio" ON gasto_tipos_servicio FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Proveedores: datos fiscales y documento único ----------
ALTER TABLE proveedores ADD COLUMN IF NOT EXISTS datos_fiscales TEXT;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM proveedores WHERE documento IS NOT NULL AND documento <> ''
    GROUP BY lower(btrim(documento)) HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS idx_proveedores_documento_unico
      ON proveedores (lower(btrim(documento))) WHERE documento IS NOT NULL AND btrim(documento) <> '';
  ELSE
    RAISE NOTICE 'Existen proveedores con documento duplicado; no se creó índice único. Depurar y reintentar.';
  END IF;
END $$;

-- ---------- Cuotas y pagos de compras ----------
ALTER TABLE compra_cuotas ADD COLUMN IF NOT EXISTS fecha_pago DATE;
ALTER TABLE compra_cuotas ALTER COLUMN monto TYPE NUMERIC(14,2);
ALTER TABLE compra_cuotas ALTER COLUMN monto_pagado TYPE NUMERIC(14,2);
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'compra_cuotas'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%estado%'
  LOOP
    EXECUTE format('ALTER TABLE compra_cuotas DROP CONSTRAINT %I', c.conname);
  END LOOP;
  ALTER TABLE compra_cuotas ADD CONSTRAINT compra_cuotas_estado_check
    CHECK (estado IN ('pendiente', 'pagada', 'vencida', 'anulada'));
END $$;

CREATE TABLE IF NOT EXISTS compra_pagos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  cuota_id UUID REFERENCES compra_cuotas(id) ON DELETE SET NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  moneda TEXT NOT NULL DEFAULT 'GS' CHECK (moneda IN ('GS', 'USD')),
  medio_pago TEXT NOT NULL DEFAULT 'efectivo',
  referencia TEXT,
  notas TEXT,
  estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado', 'anulado')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_compra_pagos_compra ON compra_pagos(compra_id);
ALTER TABLE compra_pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_compra_pagos" ON compra_pagos;
CREATE POLICY "auth_all_compra_pagos" ON compra_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Notas de crédito recibidas (compras) ----------
CREATE TABLE IF NOT EXISTS notas_credito_compra (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  numero_comprobante TEXT,
  comprobante_url TEXT,
  comprobante_nombre TEXT,
  proveedor_id UUID NOT NULL REFERENCES proveedores(id),
  compra_id UUID REFERENCES compras(id),
  fecha_emision DATE NOT NULL,
  fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  moneda TEXT NOT NULL DEFAULT 'GS' CHECK (moneda IN ('GS', 'USD')),
  tipo_cambio NUMERIC(14,4) CHECK (tipo_cambio IS NULL OR tipo_cambio > 0),
  motivo TEXT NOT NULL DEFAULT 'devolucion' CHECK (motivo IN ('devolucion', 'descuento', 'error_facturacion', 'ajuste', 'otro')),
  afecta_stock BOOLEAN NOT NULL DEFAULT FALSE,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva_total NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0 CHECK (total >= 0),
  monto_aplicado NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'vigente' CHECK (estado IN ('vigente', 'anulada')),
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nc_compra_proveedor ON notas_credito_compra(proveedor_id);
CREATE INDEX IF NOT EXISTS idx_nc_compra_compra ON notas_credito_compra(compra_id);

CREATE TABLE IF NOT EXISTS nota_credito_compra_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_credito_id UUID NOT NULL REFERENCES notas_credito_compra(id) ON DELETE CASCADE,
  producto_id UUID REFERENCES productos(id),
  lote_id UUID REFERENCES lotes(id),
  numero_lote TEXT,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario NUMERIC(14,4) NOT NULL DEFAULT 0,
  tasa_iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 10,
  monto_iva NUMERIC(14,4) NOT NULL DEFAULT 0,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Aplicaciones de una NC contra el saldo de compras (permite revertir al anular)
CREATE TABLE IF NOT EXISTS nota_credito_compra_aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_credito_id UUID NOT NULL REFERENCES notas_credito_compra(id) ON DELETE CASCADE,
  compra_id UUID NOT NULL REFERENCES compras(id),
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  detalle_cuotas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nc_aplic_compra ON nota_credito_compra_aplicaciones(compra_id);

ALTER TABLE notas_credito_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_credito_compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_credito_compra_aplicaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_notas_credito_compra" ON notas_credito_compra;
DROP POLICY IF EXISTS "auth_all_nc_compra_items" ON nota_credito_compra_items;
DROP POLICY IF EXISTS "auth_all_nc_compra_aplicaciones" ON nota_credito_compra_aplicaciones;
CREATE POLICY "auth_all_notas_credito_compra" ON notas_credito_compra FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_nc_compra_items" ON nota_credito_compra_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_nc_compra_aplicaciones" ON nota_credito_compra_aplicaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- Comprobante obligatorio (validación en backend) ----------
-- Solo al INSERTAR: no bloquea actualizaciones de registros históricos sin comprobante.
CREATE OR REPLACE FUNCTION exigir_comprobante_compra() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(btrim(NEW.numero_factura), '') = '' AND COALESCE(btrim(NEW.comprobante_url), '') = '' THEN
    RAISE EXCEPTION 'El comprobante (número o archivo) es obligatorio para registrar una compra';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_exigir_comprobante_compra ON compras;
CREATE TRIGGER trg_exigir_comprobante_compra BEFORE INSERT ON compras
  FOR EACH ROW EXECUTE FUNCTION exigir_comprobante_compra();

CREATE OR REPLACE FUNCTION exigir_comprobante_gasto() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(btrim(NEW.referencia), '') = '' AND COALESCE(btrim(NEW.comprobante_url), '') = '' THEN
    RAISE EXCEPTION 'El comprobante (número o archivo) es obligatorio para registrar un gasto';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_exigir_comprobante_gasto ON gastos;
CREATE TRIGGER trg_exigir_comprobante_gasto BEFORE INSERT ON gastos
  FOR EACH ROW EXECUTE FUNCTION exigir_comprobante_gasto();

CREATE OR REPLACE FUNCTION exigir_comprobante_nc_compra() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(btrim(NEW.numero_comprobante), '') = '' AND COALESCE(btrim(NEW.comprobante_url), '') = '' THEN
    RAISE EXCEPTION 'El comprobante (número o archivo) es obligatorio para registrar una nota de crédito';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_exigir_comprobante_nc_compra ON notas_credito_compra;
CREATE TRIGGER trg_exigir_comprobante_nc_compra BEFORE INSERT ON notas_credito_compra
  FOR EACH ROW EXECUTE FUNCTION exigir_comprobante_nc_compra();

-- ---------- Almacenamiento de comprobantes (archivos/imágenes/PDF) ----------
DO $$
BEGIN
  INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  VALUES ('comprobantes', 'comprobantes', FALSE, 10485760,
          ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp'])
  ON CONFLICT (id) DO NOTHING;

  DROP POLICY IF EXISTS "comprobantes_auth_all" ON storage.objects;
  CREATE POLICY "comprobantes_auth_all" ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'comprobantes') WITH CHECK (bucket_id = 'comprobantes');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No se pudo configurar el bucket "comprobantes" (%). Crearlo manualmente en Supabase Storage.', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
