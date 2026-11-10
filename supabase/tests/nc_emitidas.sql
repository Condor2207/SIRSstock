-- Ejecutar con psql -v ON_ERROR_STOP=1 contra una base de pruebas migrada.
BEGIN;
DO $$
DECLARE
  c uuid;
  p uuid;
  v uuid;
  cuota uuid;
  n uuid;
  header jsonb;
  items jsonb;
BEGIN
  INSERT INTO clientes(nombre, saldo_pendiente) VALUES ('NC test', 1000) RETURNING id INTO c;
  INSERT INTO productos(sku,nombre,stock_actual,tipo_control,permite_decimales,codigo_interno)
    VALUES ('NC-TEST-' || gen_random_uuid(), 'NC test', 5, 'generico', true,
      (SELECT COALESCE(max(codigo_interno), 0) + 1 FROM productos)) RETURNING id INTO p;
  INSERT INTO ventas(numero,cliente_id,condicion_pago,total,saldo_pendiente,estado)
    VALUES ('V-NC-' || gen_random_uuid(),c,'credito',1000,1000,'pendiente') RETURNING id INTO v;
  INSERT INTO venta_cuotas(venta_id,numero_cuota,fecha_vencimiento,monto)
    VALUES (v,1,current_date,1000) RETURNING id INTO cuota;
  header := jsonb_build_object('cliente_id',c,'venta_id',v,'fecha_emision',current_date,
    'fecha_registro',current_date,'motivo','devolucion','afecta_stock',true,'numero_comprobante','001-002-0000123');
  items := jsonb_build_array(jsonb_build_object('producto_id',p,'descripcion','NC test',
    'cantidad',1.5,'precio_unitario',100,'tasa_iva_porcentaje',10));
  n := registrar_nc_emitida(header,items);
  IF (SELECT stock_actual FROM productos WHERE id=p) <> 6.5
    OR (SELECT saldo_pendiente FROM ventas WHERE id=v) <> 850
    OR (SELECT monto_pagado FROM venta_cuotas WHERE id=cuota) <> 150
    OR (SELECT numero_comprobante FROM notas_credito_venta WHERE id=n) <> '001-002-0000123' THEN
    RAISE EXCEPTION 'No se aplicaron correctamente stock, saldo, cuota o comprobante';
  END IF;
  PERFORM anular_nc_emitida(n);
  IF (SELECT stock_actual FROM productos WHERE id=p) <> 5
    OR (SELECT saldo_pendiente FROM ventas WHERE id=v) <> 1000
    OR (SELECT saldo_pendiente FROM clientes WHERE id=c) <> 1000
    OR (SELECT monto_pagado FROM venta_cuotas WHERE id=cuota) <> 0 THEN
    RAISE EXCEPTION 'No se revirtieron stock, saldos y cuota';
  END IF;
  BEGIN
    PERFORM registrar_nc_emitida(header, items || jsonb_build_array(
      jsonb_build_object('producto_id',p,'descripcion','bad','cantidad',-1,'precio_unitario',100,'tasa_iva_porcentaje',10)));
    RAISE EXCEPTION 'invalid item accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'invalid item accepted' THEN RAISE; END IF;
  END;
  IF (SELECT stock_actual FROM productos WHERE id=p) <> 5
    OR (SELECT count(*) FROM notas_credito_venta WHERE cliente_id=c) <> 1 THEN
    RAISE EXCEPTION 'La operación fallida no se revirtió';
  END IF;
  BEGIN
    PERFORM anular_nc_emitida(n);
    RAISE EXCEPTION 'double annulment accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'double annulment accepted' THEN RAISE; END IF;
  END;
  UPDATE productos SET tipo_control = 'solo_lote' WHERE id = p;
  BEGIN
    PERFORM registrar_nc_emitida(header, items);
    RAISE EXCEPTION 'missing lot accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'missing lot accepted' THEN RAISE; END IF;
  END;
  IF (SELECT stock_actual FROM productos WHERE id=p) <> 5
    OR (SELECT saldo_pendiente FROM ventas WHERE id=v) <> 1000 THEN
    RAISE EXCEPTION 'La operación sin lote modificó stock o saldo';
  END IF;
END $$;
ROLLBACK;
