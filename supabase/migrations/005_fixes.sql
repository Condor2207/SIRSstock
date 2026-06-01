-- =====================================================
-- 005_fixes.sql — Correcciones y nuevas tablas
-- =====================================================

-- 1. Columna faltante en compras
ALTER TABLE compras ADD COLUMN IF NOT EXISTS cantidad_cuotas integer DEFAULT 1;

-- 2. RLS para condiciones_venta
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

-- 3. Tabla producto_exportacion
CREATE TABLE IF NOT EXISTS producto_exportacion (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  producto_id uuid REFERENCES productos(id) ON DELETE CASCADE NOT NULL,
  nombre_en text,
  descripcion_en text,
  unidad_medida_en text,
  precio_usd numeric(15,2),
  codigo_barras_en text,
  notas_en text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT producto_exportacion_producto_id_unique UNIQUE (producto_id)
);

ALTER TABLE producto_exportacion ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'producto_exportacion' AND policyname = 'producto_exportacion_auth_all'
  ) THEN
    CREATE POLICY "producto_exportacion_auth_all" ON producto_exportacion FOR ALL TO authenticated USING (true) WITH CHECK (true);
  END IF;
END $$;

-- 4. Columnas de pago en gastos (para transferencia y cheque)
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_transaccion text;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS banco_id uuid REFERENCES bancos(id) ON DELETE SET NULL;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS numero_cheque text;
ALTER TABLE gastos ADD COLUMN IF NOT EXISTS fecha_cheque date;
