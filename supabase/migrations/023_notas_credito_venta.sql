-- NC emitidas a clientes. Los importes se expresan en GS, como las ventas actuales.
CREATE TABLE IF NOT EXISTS notas_credito_venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  numero_comprobante TEXT,
  comprobante_url TEXT,
  comprobante_nombre TEXT,
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  venta_id UUID REFERENCES ventas(id),
  fecha_emision DATE NOT NULL,
  fecha_registro DATE NOT NULL DEFAULT CURRENT_DATE,
  motivo TEXT NOT NULL DEFAULT 'devolucion'
    CHECK (motivo IN ('devolucion', 'descuento', 'error_facturacion', 'ajuste', 'otro')),
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
CREATE INDEX IF NOT EXISTS idx_nc_venta_cliente ON notas_credito_venta(cliente_id);
CREATE INDEX IF NOT EXISTS idx_nc_venta_venta ON notas_credito_venta(venta_id);

CREATE TABLE IF NOT EXISTS nota_credito_venta_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_credito_id UUID NOT NULL REFERENCES notas_credito_venta(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS nota_credito_venta_aplicaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nota_credito_id UUID NOT NULL REFERENCES notas_credito_venta(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto NUMERIC(14,2) NOT NULL CHECK (monto > 0),
  detalle_cuotas JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_nc_venta_aplicaciones_venta ON nota_credito_venta_aplicaciones(venta_id);

ALTER TABLE notas_credito_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_credito_venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE nota_credito_venta_aplicaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_notas_credito_venta" ON notas_credito_venta;
DROP POLICY IF EXISTS "auth_all_nc_venta_items" ON nota_credito_venta_items;
DROP POLICY IF EXISTS "auth_all_nc_venta_aplicaciones" ON nota_credito_venta_aplicaciones;
CREATE POLICY "auth_all_notas_credito_venta" ON notas_credito_venta FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_nc_venta_items" ON nota_credito_venta_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_nc_venta_aplicaciones" ON nota_credito_venta_aplicaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION exigir_comprobante_nc_venta() RETURNS TRIGGER AS $$
BEGIN
  IF COALESCE(btrim(NEW.numero_comprobante), '') = '' AND COALESCE(btrim(NEW.comprobante_url), '') = '' THEN
    RAISE EXCEPTION 'El comprobante (número o archivo) es obligatorio para registrar una nota de crédito emitida';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS trg_exigir_comprobante_nc_venta ON notas_credito_venta;
CREATE TRIGGER trg_exigir_comprobante_nc_venta BEFORE INSERT ON notas_credito_venta
  FOR EACH ROW EXECUTE FUNCTION exigir_comprobante_nc_venta();

NOTIFY pgrst, 'reload schema';
