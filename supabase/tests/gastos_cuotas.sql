-- Ejecutar únicamente en una base de pruebas migrada.
BEGIN;
DO $$
DECLARE
  prov uuid;
  gasto uuid;
  cuota uuid;
  pago uuid;
  cobro uuid;
  cabecera jsonb;
  plan jsonb;
BEGIN
  INSERT INTO proveedores(nombre) VALUES ('Proveedor cuotas de prueba') RETURNING id INTO prov;
  cabecera := jsonb_build_object('titulo','Servicio', 'categoria','Servicios',
    'proveedor_id',prov,'fecha',current_date,'condicion','credito','moneda','USD',
    'monto',100.05,'referencia','123');
  plan := jsonb_build_array(
    jsonb_build_object('fecha_vencimiento',current_date + 30,'monto',50.02),
    jsonb_build_object('fecha_vencimiento',current_date + 60,'monto',50.03));
  gasto := registrar_gasto_cuotas(cabecera, plan);
  SELECT id INTO cuota FROM gasto_cuotas WHERE gasto_id = gasto AND numero_cuota = 1;
  INSERT INTO cobros(numero,fecha,tipo_referencia,proveedor_id)
    VALUES ('C-TEST-' || gen_random_uuid(),current_date,'gastos',prov) RETURNING id INTO cobro;
  BEGIN
    INSERT INTO cobro_gastos(cobro_id,gasto_id,monto_aplicado) VALUES (cobro,gasto,1);
    RAISE EXCEPTION 'legacy payment accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'legacy payment accepted' THEN RAISE; END IF;
  END;
  pago := pagar_cuota_gasto(cuota, 20.01, current_date, 'transferencia', 'ABC');
  IF (SELECT saldo_pendiente FROM gastos WHERE id = gasto) <> 80.04
    OR (SELECT monto_pagado FROM gasto_cuotas WHERE id = cuota) <> 20.01
    OR (SELECT moneda FROM gasto_pagos WHERE id = pago) <> 'USD' THEN
    RAISE EXCEPTION 'No se aplicó correctamente el pago parcial';
  END IF;
  BEGIN
    PERFORM pagar_cuota_gasto(cuota, 31, current_date, 'efectivo', '');
    RAISE EXCEPTION 'overpayment accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'overpayment accepted' THEN RAISE; END IF;
  END;
  PERFORM anular_pago_gasto(pago);
  IF (SELECT saldo_pendiente FROM gastos WHERE id = gasto) <> 100.05
    OR (SELECT monto_pagado FROM gasto_cuotas WHERE id = cuota) <> 0 THEN
    RAISE EXCEPTION 'No se revirtió el pago';
  END IF;
  BEGIN
    PERFORM anular_pago_gasto(pago);
    RAISE EXCEPTION 'double cancellation accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'double cancellation accepted' THEN RAISE; END IF;
  END;
  PERFORM pagar_cuota_gasto(cuota, 50.02, current_date, 'efectivo', '');
  IF (SELECT fecha_vencimiento FROM gastos WHERE id = gasto) <> current_date + 60 THEN
    RAISE EXCEPTION 'No se actualizó el próximo vencimiento';
  END IF;
  SELECT id INTO cuota FROM gasto_cuotas WHERE gasto_id = gasto AND numero_cuota = 2;
  PERFORM pagar_cuota_gasto(cuota, 50.03, current_date, 'efectivo', '');
  IF (SELECT estado FROM gastos WHERE id = gasto) <> 'pagado'
    OR (SELECT saldo_pendiente FROM gastos WHERE id = gasto) <> 0 THEN
    RAISE EXCEPTION 'El gasto no quedó pagado';
  END IF;
  BEGIN
    UPDATE gastos SET monto = 1 WHERE id = gasto;
    RAISE EXCEPTION 'plan modification accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'plan modification accepted' THEN RAISE; END IF;
  END;
  BEGIN
    UPDATE gastos SET saldo_pendiente = 1 WHERE id = gasto;
    RAISE EXCEPTION 'direct balance change accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'direct balance change accepted' THEN RAISE; END IF;
  END;
  BEGIN
    PERFORM registrar_gasto_cuotas(cabecera, jsonb_build_array(
      jsonb_build_object('fecha_vencimiento',current_date,'monto',1)));
    RAISE EXCEPTION 'invalid sum accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'invalid sum accepted' THEN RAISE; END IF;
  END;
  IF (SELECT count(*) FROM gastos WHERE proveedor_id = prov) <> 1 THEN
    RAISE EXCEPTION 'Se creó un gasto con plan inválido';
  END IF;
END $$;
ROLLBACK;
