-- ============================================================
-- SIRS - Ajustes funcionales base según Ajustes.md
-- ============================================================

-- =============================
-- Configuración maestra
-- =============================

CREATE TABLE IF NOT EXISTS unidades_medida (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  abreviatura TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS clasificaciones_producto (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL UNIQUE,
  aparece_en_factura BOOLEAN NOT NULL DEFAULT FALSE,
  tiene_stock BOOLEAN NOT NULL DEFAULT TRUE,
  usa_en_produccion BOOLEAN NOT NULL DEFAULT TRUE,
  requiere_lote BOOLEAN NOT NULL DEFAULT FALSE,
  requiere_vencimiento BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS condiciones_venta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  plazo_dias INTEGER NOT NULL DEFAULT 0,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================
-- Productos
-- =============================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS clasificacion TEXT NOT NULL DEFAULT 'MERCADERIA',
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS codigo_interno BIGINT,
  ADD COLUMN IF NOT EXISTS iva_porcentaje NUMERIC(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS es_exportacion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plazo_vencimiento_meses INTEGER NOT NULL DEFAULT 36,
  ADD COLUMN IF NOT EXISTS porcentaje_comision NUMERIC(6,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'productos_clasificacion_check'
      AND conrelid = 'productos'::regclass
  ) THEN
    ALTER TABLE productos
      ADD CONSTRAINT productos_clasificacion_check
      CHECK (clasificacion IN ('MERCADERIA', 'MATERIA_PRIMA', 'INSUMO', 'SERVICIO'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_barras_unique
  ON productos (codigo_barras)
  WHERE codigo_barras IS NOT NULL;

CREATE SEQUENCE IF NOT EXISTS productos_codigo_interno_seq START 1000;

ALTER TABLE productos
  ALTER COLUMN codigo_interno SET DEFAULT nextval('productos_codigo_interno_seq');

UPDATE productos
SET codigo_interno = nextval('productos_codigo_interno_seq')
WHERE codigo_interno IS NULL;

ALTER TABLE productos
  ALTER COLUMN codigo_interno SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS productos_codigo_interno_unique
  ON productos (codigo_interno);

-- =============================
-- Clientes y proveedores
-- =============================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS es_exterior BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id);

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS condicion_pago_id UUID REFERENCES condiciones_venta(id);

-- =============================
-- Cobros
-- =============================

DO $$
DECLARE
  c_name TEXT;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'venta_pagos'::regclass
    AND conname LIKE '%medio_pago%';

  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE venta_pagos DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE venta_pagos
  ALTER COLUMN medio_pago TYPE TEXT;

ALTER TABLE venta_pagos
  ADD CONSTRAINT venta_pagos_medio_pago_check
  CHECK (medio_pago IN ('efectivo', 'transferencia', 'cheque_al_dia', 'cheque_diferido', 'tarjeta'));

ALTER TABLE venta_pagos
  ADD COLUMN IF NOT EXISTS numero_recibo TEXT,
  ADD COLUMN IF NOT EXISTS numero_cheque TEXT,
  ADD COLUMN IF NOT EXISTS banco_emisor TEXT,
  ADD COLUMN IF NOT EXISTS fecha_cheque DATE,
  ADD COLUMN IF NOT EXISTS numero_transaccion TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS venta_pagos_numero_recibo_unique
  ON venta_pagos (numero_recibo)
  WHERE numero_recibo IS NOT NULL;

-- =============================
-- Seeds de configuración
-- =============================

INSERT INTO unidades_medida (nombre, abreviatura) VALUES
  ('Unidad', 'und'),
  ('Kilogramo', 'kg'),
  ('Gramo', 'g'),
  ('Litro', 'lts'),
  ('Mililitro', 'ml'),
  ('Caja', 'cjs'),
  ('Bolsa', 'bjs'),
  ('Bidón', 'bid')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO clasificaciones_producto (
  codigo, nombre, aparece_en_factura, tiene_stock, usa_en_produccion, requiere_lote, requiere_vencimiento
) VALUES
  ('MERCADERIA', 'Mercadería', TRUE, TRUE, FALSE, TRUE, FALSE),
  ('MATERIA_PRIMA', 'Materia Prima', FALSE, TRUE, TRUE, TRUE, TRUE),
  ('INSUMO', 'Insumo', FALSE, TRUE, TRUE, TRUE, FALSE),
  ('SERVICIO', 'Servicio', TRUE, FALSE, FALSE, FALSE, FALSE)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO condiciones_venta (nombre, plazo_dias, cantidad_cuotas) VALUES
  ('Contado', 0, 1),
  ('30 días', 30, 1),
  ('60 días', 60, 1),
  ('3 cuotas cada 30 días', 30, 3)
ON CONFLICT (nombre) DO NOTHING;
