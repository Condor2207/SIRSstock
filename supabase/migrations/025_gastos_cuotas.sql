-- Cuotas y pagos de gastos. Los créditos históricos permanecen sin cambios.
DO $$
DECLARE
  faltantes text;
BEGIN
  SELECT string_agg(nombre, ', ' ORDER BY nombre) INTO faltantes
  FROM unnest(ARRAY[
    'titulo', 'descripcion', 'proveedor_id', 'monto', 'fecha', 'medio_pago',
    'categoria', 'referencia', 'condicion', 'fecha_vencimiento', 'tasa_iva_id',
    'saldo_pendiente', 'estado', 'moneda', 'tipo_cambio', 'tipo_servicio',
    'detalle_servicio', 'comprobante_url', 'comprobante_nombre'
  ]) AS campos(nombre)
  WHERE NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'gastos' AND column_name = campos.nombre
  );
  IF faltantes IS NOT NULL THEN
    RAISE EXCEPTION 'Faltan columnas de gastos: %. Aplicá primero las migraciones anteriores de gastos (011 y 022).', faltantes;
  END IF;
END $$;

ALTER TABLE gastos ADD COLUMN IF NOT EXISTS en_cuotas boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS gasto_cuotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id uuid NOT NULL REFERENCES gastos(id) ON DELETE CASCADE,
  numero_cuota integer NOT NULL CHECK (numero_cuota > 0),
  fecha_vencimiento date NOT NULL,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  monto_pagado numeric(14,2) NOT NULL DEFAULT 0 CHECK (monto_pagado >= 0 AND monto_pagado <= monto),
  UNIQUE (gasto_id, numero_cuota)
);

CREATE TABLE IF NOT EXISTS gasto_pagos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gasto_id uuid NOT NULL REFERENCES gastos(id),
  cuota_id uuid NOT NULL REFERENCES gasto_cuotas(id),
  fecha date NOT NULL DEFAULT CURRENT_DATE,
  monto numeric(14,2) NOT NULL CHECK (monto > 0),
  moneda text NOT NULL CHECK (moneda IN ('GS', 'USD')),
  medio_pago text NOT NULL CHECK (medio_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')),
  referencia text,
  estado text NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado', 'anulado')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gasto_cuotas_gasto ON gasto_cuotas(gasto_id);
CREATE INDEX IF NOT EXISTS idx_gasto_pagos_gasto ON gasto_pagos(gasto_id);
ALTER TABLE gasto_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE gasto_pagos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS auth_all_gasto_cuotas ON gasto_cuotas;
DROP POLICY IF EXISTS auth_all_gasto_pagos ON gasto_pagos;
CREATE POLICY auth_all_gasto_cuotas ON gasto_cuotas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY auth_all_gasto_pagos ON gasto_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION registrar_gasto_cuotas(p_gasto jsonb, p_cuotas jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  g gastos%ROWTYPE := jsonb_populate_record(NULL::gastos, p_gasto);
  cuota jsonb;
  gasto_id uuid;
  n integer := 0;
  suma numeric := 0;
  valor numeric;
  decimales integer;
BEGIN
  IF g.condicion IS DISTINCT FROM 'credito' OR g.moneda IS NULL OR g.moneda NOT IN ('GS', 'USD')
    OR g.monto IS NULL OR g.monto <= 0 OR g.proveedor_id IS NULL THEN
    RAISE EXCEPTION 'Verificá la condición, moneda, monto y proveedor del gasto';
  END IF;
  IF jsonb_typeof(p_cuotas) IS DISTINCT FROM 'array'
    OR jsonb_array_length(p_cuotas) NOT BETWEEN 1 AND 48 THEN
    RAISE EXCEPTION 'Indicá entre 1 y 48 cuotas';
  END IF;
  decimales := CASE WHEN g.moneda = 'USD' THEN 2 ELSE 0 END;
  IF g.monto <> round(g.monto, decimales) THEN RAISE EXCEPTION 'Monto inválido para la moneda'; END IF;
  FOR cuota IN SELECT value FROM jsonb_array_elements(p_cuotas) LOOP
    n := n + 1;
    valor := (cuota->>'monto')::numeric;
    IF valor IS NULL OR valor <= 0 OR valor <> round(valor, decimales)
      OR NULLIF(cuota->>'fecha_vencimiento', '') IS NULL THEN
      RAISE EXCEPTION 'Cada cuota necesita un importe válido y una fecha de vencimiento';
    END IF;
    suma := suma + valor;
  END LOOP;
  IF suma <> g.monto THEN RAISE EXCEPTION 'La suma de las cuotas debe ser igual al monto del gasto'; END IF;
  INSERT INTO gastos (
    titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia,
    condicion, fecha_vencimiento, tasa_iva_id, moneda, tipo_cambio, tipo_servicio,
    detalle_servicio, comprobante_url, comprobante_nombre, saldo_pendiente, estado, en_cuotas
  ) VALUES (
    g.titulo, g.descripcion, g.proveedor_id, g.monto, g.fecha, 'otro', g.categoria, g.referencia,
    'credito', (SELECT min((value->>'fecha_vencimiento')::date) FROM jsonb_array_elements(p_cuotas)),
    g.tasa_iva_id, g.moneda, g.tipo_cambio, g.tipo_servicio,
    g.detalle_servicio, g.comprobante_url, g.comprobante_nombre, g.monto, 'pendiente', true
  ) RETURNING id INTO gasto_id;
  n := 0;
  FOR cuota IN SELECT value FROM jsonb_array_elements(p_cuotas) LOOP
    n := n + 1;
    INSERT INTO gasto_cuotas(gasto_id, numero_cuota, fecha_vencimiento, monto)
      VALUES (gasto_id, n, (cuota->>'fecha_vencimiento')::date, (cuota->>'monto')::numeric);
  END LOOP;
  RETURN gasto_id;
END $$;

CREATE OR REPLACE FUNCTION pagar_cuota_gasto(p_cuota_id uuid, p_monto numeric, p_fecha date, p_medio text, p_referencia text)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  c gasto_cuotas%ROWTYPE;
  g gastos%ROWTYPE;
  pago_id uuid;
BEGIN
  SELECT * INTO c FROM gasto_cuotas WHERE id = p_cuota_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Cuota inexistente'; END IF;
  SELECT * INTO g FROM gastos WHERE id = c.gasto_id FOR UPDATE;
  SELECT * INTO c FROM gasto_cuotas WHERE id = p_cuota_id FOR UPDATE;
  IF NOT g.en_cuotas OR g.estado = 'anulado' OR p_fecha IS NULL OR p_monto IS NULL
    OR p_monto <= 0 OR p_monto > c.monto - c.monto_pagado OR p_monto > g.saldo_pendiente
    OR p_monto <> round(p_monto, CASE WHEN g.moneda = 'USD' THEN 2 ELSE 0 END) THEN
    RAISE EXCEPTION 'Pago inválido o mayor que el saldo de la cuota';
  END IF;
  INSERT INTO gasto_pagos (gasto_id, cuota_id, fecha, monto, moneda, medio_pago, referencia)
    VALUES (g.id, c.id, p_fecha, p_monto, g.moneda, p_medio, NULLIF(btrim(p_referencia), ''))
    RETURNING id INTO pago_id;
  UPDATE gasto_cuotas SET monto_pagado = monto_pagado + p_monto WHERE id = c.id;
  PERFORM set_config('sirs.actualizar_cuotas_gasto', '1', true);
  UPDATE gastos SET saldo_pendiente = saldo_pendiente - p_monto,
    estado = CASE WHEN saldo_pendiente - p_monto = 0 THEN 'pagado' ELSE 'parcial' END,
    fecha_vencimiento = (SELECT min(fecha_vencimiento) FROM gasto_cuotas WHERE gasto_id = g.id AND monto_pagado < monto)
    WHERE id = g.id;
  PERFORM set_config('sirs.actualizar_cuotas_gasto', '', true);
  RETURN pago_id;
END $$;

CREATE OR REPLACE FUNCTION anular_pago_gasto(p_pago_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  p gasto_pagos%ROWTYPE;
  g gastos%ROWTYPE;
  c gasto_cuotas%ROWTYPE;
BEGIN
  SELECT * INTO p FROM gasto_pagos WHERE id = p_pago_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago inexistente'; END IF;
  SELECT * INTO g FROM gastos WHERE id = p.gasto_id FOR UPDATE;
  SELECT * INTO c FROM gasto_cuotas WHERE id = p.cuota_id FOR UPDATE;
  SELECT * INTO p FROM gasto_pagos WHERE id = p_pago_id FOR UPDATE;
  IF p.estado <> 'registrado' OR g.estado = 'anulado' OR c.monto_pagado < p.monto
    OR g.saldo_pendiente + p.monto > g.monto THEN
    RAISE EXCEPTION 'No se puede anular este pago';
  END IF;
  UPDATE gasto_pagos SET estado = 'anulado' WHERE id = p.id;
  UPDATE gasto_cuotas SET monto_pagado = monto_pagado - p.monto WHERE id = c.id;
  PERFORM set_config('sirs.actualizar_cuotas_gasto', '1', true);
  UPDATE gastos SET saldo_pendiente = saldo_pendiente + p.monto,
    estado = CASE WHEN saldo_pendiente + p.monto = monto THEN 'pendiente' ELSE 'parcial' END,
    fecha_vencimiento = (SELECT min(fecha_vencimiento) FROM gasto_cuotas WHERE gasto_id = g.id AND monto_pagado < monto)
    WHERE id = g.id;
  PERFORM set_config('sirs.actualizar_cuotas_gasto', '', true);
END $$;

-- Evitar que el flujo histórico de Cobros modifique saldos sin actualizar cuotas.
CREATE OR REPLACE FUNCTION impedir_cobro_gasto_cuotas() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM gastos WHERE id = NEW.gasto_id AND en_cuotas) THEN
    RAISE EXCEPTION 'Los gastos en cuotas se pagan desde la ficha del gasto';
  END IF;
  RETURN NEW;
END $$;
DO $$
BEGIN
  IF to_regclass('public.cobro_gastos') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS trg_impedir_cobro_gasto_cuotas ON public.cobro_gastos;
    CREATE TRIGGER trg_impedir_cobro_gasto_cuotas BEFORE INSERT OR UPDATE ON public.cobro_gastos
      FOR EACH ROW EXECUTE FUNCTION impedir_cobro_gasto_cuotas();
  ELSE
    RAISE NOTICE 'La tabla cobro_gastos no existe. Si la creás más adelante, volvé a ejecutar esta migración para instalar su protección.';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION proteger_plan_gasto() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.en_cuotas AND (NEW.en_cuotas IS DISTINCT FROM OLD.en_cuotas
    OR NEW.condicion IS DISTINCT FROM OLD.condicion OR NEW.moneda IS DISTINCT FROM OLD.moneda
    OR NEW.monto IS DISTINCT FROM OLD.monto OR NEW.proveedor_id IS DISTINCT FROM OLD.proveedor_id) THEN
    RAISE EXCEPTION 'No se puede cambiar el monto, moneda, proveedor o condición de un gasto en cuotas';
  END IF;
  IF OLD.en_cuotas AND COALESCE(current_setting('sirs.actualizar_cuotas_gasto', true), '') <> '1'
    AND (NEW.saldo_pendiente IS DISTINCT FROM OLD.saldo_pendiente
      OR NEW.estado IS DISTINCT FROM OLD.estado OR NEW.fecha_vencimiento IS DISTINCT FROM OLD.fecha_vencimiento) THEN
    RAISE EXCEPTION 'El saldo de un gasto en cuotas se actualiza al registrar o anular pagos';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_proteger_plan_gasto ON gastos;
CREATE TRIGGER trg_proteger_plan_gasto BEFORE UPDATE ON gastos FOR EACH ROW EXECUTE FUNCTION proteger_plan_gasto();

REVOKE ALL ON FUNCTION registrar_gasto_cuotas(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION pagar_cuota_gasto(uuid, numeric, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION anular_pago_gasto(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_gasto_cuotas(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION pagar_cuota_gasto(uuid, numeric, date, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_pago_gasto(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
