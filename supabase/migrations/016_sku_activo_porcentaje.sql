-- ============================================================
-- SIRS - Migración 016: SKU auto-fill, activo en productos y
--        porcentaje_venta en vendedores
-- ============================================================

-- 1. Asegurar columna porcentaje_venta en vendedores
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS porcentaje_venta NUMERIC(5,2) NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vendedores_porcentaje_venta_chk'
  ) THEN
    ALTER TABLE vendedores
      ADD CONSTRAINT vendedores_porcentaje_venta_chk
      CHECK (porcentaje_venta >= 0 AND porcentaje_venta <= 100);
  END IF;
END $$;

-- 2. Asegurar columna activo en productos (ya existe en la mayoría,
--    pero lo dejamos idempotente)
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE;

-- 3. Trigger que auto-completa SKU a partir de codigo_interno cuando
--    el campo SKU llega vacío o NULL en un INSERT
CREATE OR REPLACE FUNCTION fn_productos_autofill_sku()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku IS NULL OR trim(NEW.sku) = '' THEN
    -- codigo_interno ya tiene valor porque su DEFAULT se aplica antes que el trigger BEFORE
    NEW.sku := CAST(NEW.codigo_interno AS TEXT);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_autofill_sku ON productos;
CREATE TRIGGER trg_productos_autofill_sku
  BEFORE INSERT ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_productos_autofill_sku();
