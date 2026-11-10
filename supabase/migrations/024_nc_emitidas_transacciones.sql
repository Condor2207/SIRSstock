-- Registrar y anular una NC emitida de forma atómica.
CREATE OR REPLACE FUNCTION registrar_nc_emitida(p_nc jsonb, p_items jsonb)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  nc_id uuid := gen_random_uuid();
  cliente uuid := (p_nc->>'cliente_id')::uuid;
  v_venta_id uuid := NULLIF(p_nc->>'venta_id', '')::uuid;
  venta ventas%ROWTYPE;
  producto productos%ROWTYPE;
  lote lotes%ROWTYPE;
  cuota venta_cuotas%ROWTYPE;
  item jsonb;
  cantidad numeric;
  precio numeric;
  tasa numeric;
  linea numeric;
  iva numeric;
  v_total numeric := 0;
  total_iva numeric := 0;
  aplicado numeric := 0;
  restante numeric;
  pago numeric;
  detalle jsonb := '[]'::jsonb;
  afecta boolean := COALESCE((p_nc->>'afecta_stock')::boolean, false);
  saldo_anterior numeric;
  numero text := 'NCE-' || upper(replace(nc_id::text, '-', ''));
BEGIN
  IF cliente IS NULL OR NOT EXISTS (SELECT 1 FROM clientes WHERE id = cliente AND activo) THEN
    RAISE EXCEPTION 'Seleccioná un cliente activo';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Agregá al menos un ítem';
  END IF;
  IF (p_nc->>'fecha_emision')::date > (p_nc->>'fecha_registro')::date THEN
    RAISE EXCEPTION 'La fecha de emisión no puede ser posterior a la de registro';
  END IF;
  IF v_venta_id IS NOT NULL THEN
    SELECT * INTO venta FROM ventas WHERE id = v_venta_id FOR UPDATE;
    IF NOT FOUND OR venta.cliente_id <> cliente OR venta.estado = 'anulado' THEN
      RAISE EXCEPTION 'La venta no existe, está anulada o pertenece a otro cliente';
    END IF;
  END IF;

  INSERT INTO notas_credito_venta (
    id, numero, numero_comprobante, comprobante_url, comprobante_nombre, cliente_id, venta_id,
    fecha_emision, fecha_registro, motivo, afecta_stock, notas
  ) VALUES (
    nc_id, numero, NULLIF(btrim(p_nc->>'numero_comprobante'), ''),
    NULLIF(p_nc->>'comprobante_url', ''), NULLIF(p_nc->>'comprobante_nombre', ''),
    cliente, v_venta_id, (p_nc->>'fecha_emision')::date, (p_nc->>'fecha_registro')::date,
    p_nc->>'motivo', afecta, NULLIF(btrim(p_nc->>'notas'), '')
  );

  FOR item IN SELECT value FROM jsonb_array_elements(p_items) LOOP
    cantidad := (item->>'cantidad')::numeric;
    precio := (item->>'precio_unitario')::numeric;
    tasa := (item->>'tasa_iva_porcentaje')::numeric;
    IF cantidad IS NULL OR cantidad <= 0 OR cantidad <> round(cantidad, 3)
      OR precio IS NULL OR precio <= 0 OR precio <> round(precio, 4)
      OR tasa IS NULL OR tasa NOT IN (0, 5, 10)
      OR COALESCE(btrim(item->>'descripcion'), '') = '' THEN
      RAISE EXCEPTION 'Ítem inválido: verificá descripción, cantidad, precio e IVA';
    END IF;
    producto.id := NULL;
    IF NULLIF(item->>'producto_id', '') IS NOT NULL THEN
      SELECT * INTO producto FROM productos WHERE id = (item->>'producto_id')::uuid FOR UPDATE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Producto inexistente'; END IF;
      IF NOT producto.permite_decimales AND cantidad <> trunc(cantidad) THEN
        RAISE EXCEPTION 'El producto % no permite cantidades decimales', producto.nombre;
      END IF;
    END IF;
    lote.id := NULL;
    IF NULLIF(item->>'lote_id', '') IS NOT NULL THEN
      SELECT * INTO lote FROM lotes WHERE id = (item->>'lote_id')::uuid FOR UPDATE;
      IF NOT FOUND OR lote.producto_id IS DISTINCT FROM producto.id THEN
        RAISE EXCEPTION 'El lote seleccionado no corresponde al producto';
      END IF;
    END IF;
    IF afecta AND producto.id IS NULL THEN RAISE EXCEPTION 'La devolución de stock requiere un producto'; END IF;
    IF afecta AND producto.es_servicio THEN RAISE EXCEPTION 'Un servicio no puede devolver stock'; END IF;
    IF afecta AND producto.tipo_control <> 'generico' AND lote.id IS NULL THEN
      RAISE EXCEPTION 'Seleccioná el lote correspondiente al producto %', producto.nombre;
    END IF;
    linea := round(cantidad * precio, 0);
    iva := CASE WHEN tasa = 0 THEN 0 ELSE round(linea * tasa / (100 + tasa), 0) END;
    v_total := v_total + linea;
    total_iva := total_iva + iva;
    INSERT INTO nota_credito_venta_items (
      nota_credito_id, producto_id, lote_id, numero_lote, descripcion, cantidad,
      precio_unitario, tasa_iva_porcentaje, monto_iva, subtotal
    ) VALUES (
      nc_id, producto.id, lote.id, lote.numero_lote, btrim(item->>'descripcion'),
      cantidad, precio, tasa, iva, linea
    );
    IF afecta THEN
      saldo_anterior := producto.stock_actual;
      UPDATE productos SET stock_actual = stock_actual + cantidad WHERE id = producto.id;
      IF lote.id IS NOT NULL THEN
        UPDATE lotes SET stock_actual = stock_actual + cantidad WHERE id = lote.id;
      END IF;
      INSERT INTO movimientos_stock (producto_id, lote_id, tipo, cantidad, referencia_tipo, referencia_id, saldo_anterior, saldo_posterior, notas)
      VALUES (producto.id, lote.id, 'devolucion', cantidad, 'nota_credito_venta', nc_id,
        saldo_anterior, saldo_anterior + cantidad, 'NC emitida ' || numero);
    END IF;
  END LOOP;
  IF v_total <= 0 THEN RAISE EXCEPTION 'El total de la NC debe ser mayor a cero'; END IF;

  IF v_venta_id IS NOT NULL THEN
    aplicado := LEAST(v_total, GREATEST(venta.saldo_pendiente, 0));
    restante := aplicado;
    FOR cuota IN SELECT * FROM venta_cuotas WHERE venta_cuotas.venta_id = v_venta_id ORDER BY numero_cuota FOR UPDATE LOOP
      EXIT WHEN restante <= 0;
      pago := LEAST(restante, GREATEST(cuota.monto - cuota.monto_pagado, 0));
      IF pago > 0 THEN
        UPDATE venta_cuotas SET monto_pagado = monto_pagado + pago,
          estado = CASE WHEN monto_pagado + pago >= monto THEN 'pagado' ELSE 'parcial' END
          WHERE id = cuota.id;
        detalle := detalle || jsonb_build_array(jsonb_build_object('cuota_id', cuota.id, 'monto', pago));
        restante := restante - pago;
      END IF;
    END LOOP;
    IF aplicado > 0 THEN
      UPDATE ventas SET saldo_pendiente = saldo_pendiente - aplicado,
        estado = CASE WHEN saldo_pendiente - aplicado = 0 THEN 'pagado' ELSE 'parcial' END WHERE id = v_venta_id;
      UPDATE clientes SET saldo_pendiente = GREATEST(0, saldo_pendiente - aplicado) WHERE id = cliente;
      INSERT INTO nota_credito_venta_aplicaciones (nota_credito_id, venta_id, monto, detalle_cuotas)
      VALUES (nc_id, v_venta_id, aplicado, detalle);
    END IF;
  END IF;
  UPDATE notas_credito_venta SET subtotal = v_total - total_iva, iva_total = total_iva,
    total = v_total, monto_aplicado = aplicado WHERE id = nc_id;
  RETURN nc_id;
END;
$$;

CREATE OR REPLACE FUNCTION anular_nc_emitida(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  nc notas_credito_venta%ROWTYPE;
  item nota_credito_venta_items%ROWTYPE;
  aplicacion nota_credito_venta_aplicaciones%ROWTYPE;
  cuota venta_cuotas%ROWTYPE;
  detalle jsonb;
  venta ventas%ROWTYPE;
  anterior numeric;
  cantidad numeric;
BEGIN
  SELECT * INTO nc FROM notas_credito_venta WHERE id = p_id FOR UPDATE;
  IF NOT FOUND OR nc.estado <> 'vigente' THEN RAISE EXCEPTION 'La NC no existe o ya fue anulada'; END IF;
  IF nc.afecta_stock THEN
    FOR item IN SELECT * FROM nota_credito_venta_items WHERE nota_credito_id = nc.id ORDER BY producto_id, lote_id LOOP
      SELECT stock_actual INTO anterior FROM productos WHERE id = item.producto_id FOR UPDATE;
      IF NOT FOUND OR anterior < item.cantidad THEN RAISE EXCEPTION 'Stock insuficiente para anular la devolución'; END IF;
      IF item.lote_id IS NOT NULL THEN
        UPDATE lotes SET stock_actual = stock_actual - item.cantidad
          WHERE id = item.lote_id AND producto_id = item.producto_id AND stock_actual >= item.cantidad;
        IF NOT FOUND THEN RAISE EXCEPTION 'Stock insuficiente en el lote para anular la devolución'; END IF;
      END IF;
      UPDATE productos SET stock_actual = stock_actual - item.cantidad WHERE id = item.producto_id;
      INSERT INTO movimientos_stock (producto_id, lote_id, tipo, cantidad, referencia_tipo, referencia_id, saldo_anterior, saldo_posterior, notas)
      VALUES (item.producto_id, item.lote_id, 'ajuste', -item.cantidad, 'nota_credito_venta_anulada', nc.id,
        anterior, anterior - item.cantidad, 'Anulación NC ' || nc.numero);
    END LOOP;
  END IF;
  FOR aplicacion IN SELECT * FROM nota_credito_venta_aplicaciones WHERE nota_credito_id = nc.id LOOP
    SELECT * INTO venta FROM ventas WHERE id = aplicacion.venta_id FOR UPDATE;
    IF NOT FOUND OR venta.estado = 'anulado' OR venta.saldo_pendiente + aplicacion.monto > venta.total THEN
      RAISE EXCEPTION 'No se puede revertir el saldo de la venta asociada';
    END IF;
    FOR detalle IN SELECT value FROM jsonb_array_elements(aplicacion.detalle_cuotas) LOOP
      SELECT * INTO cuota FROM venta_cuotas WHERE id = (detalle->>'cuota_id')::uuid AND venta_cuotas.venta_id = venta.id FOR UPDATE;
      cantidad := (detalle->>'monto')::numeric;
      IF NOT FOUND OR cuota.monto_pagado < cantidad THEN RAISE EXCEPTION 'No se puede revertir la cuota asociada'; END IF;
      UPDATE venta_cuotas SET monto_pagado = monto_pagado - cantidad,
        estado = CASE WHEN monto_pagado - cantidad >= monto THEN 'pagado'
                      WHEN monto_pagado - cantidad > 0 THEN 'parcial' ELSE 'pendiente' END
        WHERE id = cuota.id;
    END LOOP;
    UPDATE ventas SET saldo_pendiente = saldo_pendiente + aplicacion.monto,
      estado = CASE WHEN saldo_pendiente + aplicacion.monto >= total THEN 'pendiente' ELSE 'parcial' END
      WHERE id = venta.id;
    UPDATE clientes SET saldo_pendiente = saldo_pendiente + aplicacion.monto WHERE id = nc.cliente_id;
  END LOOP;
  DELETE FROM nota_credito_venta_aplicaciones WHERE nota_credito_id = nc.id;
  UPDATE notas_credito_venta SET estado = 'anulada', monto_aplicado = 0 WHERE id = nc.id;
END;
$$;

REVOKE ALL ON FUNCTION registrar_nc_emitida(jsonb, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION anular_nc_emitida(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION registrar_nc_emitida(jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION anular_nc_emitida(uuid) TO authenticated;
NOTIFY pgrst, 'reload schema';
