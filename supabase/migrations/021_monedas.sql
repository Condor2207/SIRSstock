-- Monedas con tipo de cambio manual (valor de 1 unidad expresado en Gs.)
CREATE TABLE IF NOT EXISTS monedas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  simbolo TEXT NOT NULL DEFAULT '',
  tipo_cambio NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (tipo_cambio > 0),
  activo BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO monedas (codigo, nombre, simbolo, tipo_cambio) VALUES
  ('PYG', 'Guaraní', 'Gs.', 1),
  ('USD', 'Dólar estadounidense', 'US$', 6500)
ON CONFLICT (codigo) DO NOTHING;

ALTER TABLE monedas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "monedas_all" ON monedas;
CREATE POLICY "monedas_all" ON monedas FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Moneda en la que está cotizado el precio de venta de cada producto
ALTER TABLE productos ADD COLUMN IF NOT EXISTS moneda_venta TEXT NOT NULL DEFAULT 'PYG';
