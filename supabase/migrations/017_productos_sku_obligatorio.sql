-- Garantía de integridad para instalaciones existentes:
-- todo producto nuevo recibe un SKU aunque el cliente no lo envíe.
CREATE OR REPLACE FUNCTION fn_productos_autofill_sku()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku IS NULL OR btrim(NEW.sku) = '' THEN
    NEW.sku := 'AUTO-' || upper(substr(replace(uuid_generate_v4()::text, '-', ''), 1, 12));
  ELSE
    NEW.sku := upper(btrim(NEW.sku));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_productos_autofill_sku ON productos;
CREATE TRIGGER trg_productos_autofill_sku
  BEFORE INSERT OR UPDATE OF sku ON productos
  FOR EACH ROW
  EXECUTE FUNCTION fn_productos_autofill_sku();
