-- ============================================================
-- SIRS - Script de datos demo (últimos 3 meses)
-- Genera: ~270 ventas, ~20 compras, ~30 gastos, ~7 producciones
-- Ejecutar DESPUÉS de 001_init.sql
-- ============================================================

DO $$
DECLARE
  v_fecha        DATE;
  v_dia          INTEGER;
  j              INTEGER;
  k              INTEGER;
  q              INTEGER;
  m              INTEGER;

  -- Arrays de referencia
  v_clientes     UUID[];
  v_prod_ids     UUID[];
  v_prod_precios NUMERIC[];
  v_prod_nombres TEXT[];
  v_proveedores  UUID[];
  v_lot_ids      UUID[];
  v_lot_prods    UUID[];
  v_lot_nums     TEXT[];
  v_lot_vencs    DATE[];

  -- Contadores
  v_cnt_venta    INTEGER := 0;
  v_cnt_compra   INTEGER := 0;
  v_cnt_gasto    INTEGER := 0;
  v_cnt_prod     INTEGER := 0;

  -- IDs de trabajo
  v_venta_id     UUID;
  v_compra_id    UUID;
  v_prod_id      UUID;
  v_cuota_id     UUID;

  -- Variables de cálculo
  v_total        NUMERIC;
  v_item_sub     NUMERIC;
  v_cant         NUMERIC;
  v_precio       NUMERIC;
  v_n_items      INTEGER;
  v_ci           INTEGER;
  v_pi           INTEGER;
  v_li           INTEGER;
  v_gi           INTEGER;
  v_cond         TEXT;
  v_cuotas       INTEGER;
  v_saldo        NUMERIC;
  v_estado       TEXT;
  v_cuota_monto  NUMERIC;

  -- Datos de gastos (12 tipos rotantes)
  v_gastos_titulos TEXT[]    := ARRAY[
    'Pago servicio eléctrico','Combustible reparto','Alquiler depósito',
    'Mantenimiento maquinaria','Material de oficina','Internet y teléfono',
    'Seguro vehículo','Honorarios contador','Publicidad digital',
    'Limpieza instalaciones','Agua y gas','Envases y packaging'
  ];
  v_gastos_cats   TEXT[]    := ARRAY[
    'Servicios','Combustible','Alquiler',
    'Reparaciones','Insumos de oficina','Servicios',
    'Servicios','Personal','Marketing',
    'Servicios','Servicios','Insumos de oficina'
  ];
  v_gastos_montos NUMERIC[] := ARRAY[
    450000,120000,1800000,
    250000,85000,150000,
    280000,350000,220000,
    90000,65000,380000
  ];
  v_medios TEXT[] := ARRAY['efectivo','transferencia','transferencia','efectivo','tarjeta'];

BEGIN

  -- ============================================================
  -- Cargar datos de referencia
  -- ============================================================
  SELECT ARRAY_AGG(id ORDER BY nombre) INTO v_clientes FROM clientes;
  IF v_clientes IS NULL THEN
    RAISE EXCEPTION 'No hay clientes. Ejecutá primero 001_init.sql';
  END IF;

  SELECT ARRAY_AGG(id ORDER BY sku),
         ARRAY_AGG(precio_venta ORDER BY sku),
         ARRAY_AGG(nombre ORDER BY sku)
  INTO v_prod_ids, v_prod_precios, v_prod_nombres
  FROM productos WHERE sku NOT LIKE 'INS-%' AND activo = true;

  IF v_prod_ids IS NULL THEN
    RAISE EXCEPTION 'No hay productos vendibles. Ejecutá primero 001_init.sql';
  END IF;

  SELECT ARRAY_AGG(id ORDER BY nombre) INTO v_proveedores FROM proveedores;

  SELECT
    ARRAY_AGG(id ORDER BY created_at),
    ARRAY_AGG(producto_id ORDER BY created_at),
    ARRAY_AGG(numero_lote ORDER BY created_at),
    ARRAY_AGG(COALESCE(fecha_vencimiento, CURRENT_DATE + 365) ORDER BY created_at)
  INTO v_lot_ids, v_lot_prods, v_lot_nums, v_lot_vencs
  FROM lotes;

  -- ============================================================
  -- LOOP PRINCIPAL: 90 días hacia atrás
  -- ============================================================
  FOR v_dia IN 0..89 LOOP
    v_fecha := CURRENT_DATE - (89 - v_dia);

    -- --------------------------------------------------------
    -- VENTAS: 2-4 por día
    -- --------------------------------------------------------
    FOR j IN 1..(2 + (v_dia % 3)) LOOP
      v_cnt_venta := v_cnt_venta + 1;
      v_venta_id  := uuid_generate_v4();
      v_ci        := 1 + ((v_cnt_venta + j - 1) % array_length(v_clientes, 1));
      v_n_items   := 1 + (j % 3);
      v_total     := 0;

      -- 1 de cada 3 ventas es crédito
      IF v_cnt_venta % 3 = 0 THEN
        v_cond   := 'credito';
        v_cuotas := 1 + (v_cnt_venta % 3);
      ELSE
        v_cond   := 'contado';
        v_cuotas := 1;
      END IF;

      INSERT INTO ventas (id, numero, fecha, cliente_id, condicion_pago, plazo_dias,
                          cantidad_cuotas, subtotal, descuento, total, saldo_pendiente, estado)
      VALUES (
        v_venta_id,
        'V-' || LPAD(v_cnt_venta::TEXT, 5, '0'),
        v_fecha::TIMESTAMPTZ + j * INTERVAL '1 hour',
        v_clientes[v_ci],
        v_cond,
        CASE WHEN v_cond = 'credito' THEN 30 * v_cuotas ELSE NULL END,
        v_cuotas,
        0, 0, 0, 0, 'pendiente'
      );

      -- Items de la venta
      FOR k IN 1..v_n_items LOOP
        v_pi      := 1 + ((v_cnt_venta + j + k) % array_length(v_prod_ids, 1));
        v_cant    := (1 + (k + j) % 10)::NUMERIC;
        v_precio  := ROUND(v_prod_precios[v_pi] * (1.0 + (v_cnt_venta % 10 - 5) * 0.01), 2);
        v_item_sub := ROUND(v_cant * v_precio, 2);
        v_total   := v_total + v_item_sub;

        -- Buscar lote del producto
        v_li := NULL;
        IF v_lot_prods IS NOT NULL AND array_length(v_lot_prods, 1) > 0 THEN
          FOR m IN 1..array_length(v_lot_prods, 1) LOOP
            IF v_lot_prods[m] = v_prod_ids[v_pi] THEN
              v_li := m;
              EXIT;
            END IF;
          END LOOP;
        END IF;

        INSERT INTO venta_items (venta_id, producto_id, lote_id, numero_lote,
                                  fecha_vencimiento, descripcion, cantidad, precio_unitario, subtotal)
        VALUES (
          v_venta_id,
          v_prod_ids[v_pi],
          CASE WHEN v_li IS NOT NULL THEN v_lot_ids[v_li] ELSE NULL END,
          CASE WHEN v_li IS NOT NULL THEN v_lot_nums[v_li] ELSE NULL END,
          CASE WHEN v_li IS NOT NULL THEN v_lot_vencs[v_li] ELSE NULL END,
          v_prod_nombres[v_pi],
          v_cant, v_precio, v_item_sub
        );

        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, referencia_tipo, referencia_id)
        VALUES (v_prod_ids[v_pi], 'salida', v_cant, 'venta', v_venta_id);
      END LOOP;

      -- Estado y saldo de la venta
      IF v_cond = 'contado' THEN
        v_saldo  := 0;
        v_estado := 'pagado';
      ELSIF v_fecha < CURRENT_DATE - 50 THEN
        v_saldo  := 0;
        v_estado := 'pagado';
      ELSIF v_cnt_venta % 5 = 0 THEN
        v_saldo  := ROUND(v_total * 0.5, 2);
        v_estado := 'parcial';
      ELSE
        v_saldo  := ROUND(v_total, 2);
        v_estado := 'pendiente';
      END IF;

      UPDATE ventas
      SET subtotal = ROUND(v_total, 2), total = ROUND(v_total, 2),
          saldo_pendiente = v_saldo, estado = v_estado
      WHERE id = v_venta_id;

      -- Cuotas para ventas a crédito
      IF v_cond = 'credito' THEN
        v_cuota_monto := ROUND(v_total / v_cuotas, 2);
        FOR q IN 1..v_cuotas LOOP
          v_cuota_id := uuid_generate_v4();

          INSERT INTO venta_cuotas (id, venta_id, numero_cuota, fecha_vencimiento,
                                     monto, monto_pagado, estado)
          VALUES (
            v_cuota_id, v_venta_id, q,
            v_fecha + q * INTERVAL '30 days',
            v_cuota_monto,
            CASE WHEN v_estado = 'pagado' THEN v_cuota_monto
                 WHEN v_estado = 'parcial' AND q = 1 THEN v_cuota_monto
                 ELSE 0 END,
            CASE WHEN v_estado = 'pagado' THEN 'pagado'
                 WHEN v_estado = 'parcial' AND q = 1 THEN 'pagado'
                 WHEN v_fecha + q * INTERVAL '30 days' < CURRENT_DATE THEN 'vencido'
                 ELSE 'pendiente' END
          );

          -- Pago registrado para cuotas cobradas
          IF v_estado = 'pagado' OR (v_estado = 'parcial' AND q = 1) THEN
            INSERT INTO venta_pagos (venta_id, cuota_id, fecha, monto, medio_pago)
            VALUES (
              v_venta_id, v_cuota_id,
              v_fecha + (q - 1) * INTERVAL '30 days' + INTERVAL '5 days',
              v_cuota_monto,
              v_medios[1 + ((v_cnt_venta - 1) % array_length(v_medios, 1))]
            );
          END IF;
        END LOOP;
      END IF;

    END LOOP; -- fin ventas

    -- --------------------------------------------------------
    -- COMPRAS: cada ~7 u 11 días
    -- --------------------------------------------------------
    IF v_dia % 7 = 0 OR v_dia % 11 = 0 THEN
      v_cnt_compra := v_cnt_compra + 1;
      v_compra_id  := uuid_generate_v4();
      v_total      := 0;

      INSERT INTO compras (id, numero, fecha, proveedor_id, condicion_pago,
                           numero_remito, subtotal, total, saldo_pendiente, estado)
      VALUES (
        v_compra_id,
        'C-' || LPAD(v_cnt_compra::TEXT, 5, '0'),
        v_fecha,
        v_proveedores[1 + ((v_cnt_compra - 1) % array_length(v_proveedores, 1))],
        CASE WHEN v_cnt_compra % 2 = 0 THEN 'credito' ELSE 'contado' END,
        'R-0001-' || LPAD(v_cnt_compra::TEXT, 8, '0'),
        0, 0, 0, 'pendiente'
      );

      FOR k IN 1..(2 + v_cnt_compra % 3) LOOP
        v_pi      := 1 + ((v_cnt_compra + k) % array_length(v_prod_ids, 1));
        v_cant    := (50 + k * 30)::NUMERIC;
        v_precio  := ROUND(v_prod_precios[v_pi] * 0.52, 2);
        v_item_sub := ROUND(v_cant * v_precio, 2);
        v_total   := v_total + v_item_sub;

        INSERT INTO compra_items (compra_id, producto_id, numero_lote, fecha_vencimiento,
                                   descripcion, cantidad, precio_unitario, subtotal)
        VALUES (
          v_compra_id, v_prod_ids[v_pi],
          'LC' || TO_CHAR(v_fecha, 'YYYYMM') || LPAD((v_cnt_compra * 3 + k)::TEXT, 3, '0'),
          v_fecha + INTERVAL '18 months',
          v_prod_nombres[v_pi], v_cant, v_precio, v_item_sub
        );

        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, referencia_tipo, referencia_id)
        VALUES (v_prod_ids[v_pi], 'entrada', v_cant, 'compra', v_compra_id);
      END LOOP;

      UPDATE compras SET
        subtotal       = ROUND(v_total, 2),
        total          = ROUND(v_total, 2),
        saldo_pendiente = CASE
          WHEN condicion_pago = 'credito' AND v_fecha > CURRENT_DATE - 30 THEN ROUND(v_total, 2)
          ELSE 0 END,
        estado = CASE
          WHEN condicion_pago = 'contado' THEN 'pagado'
          WHEN v_fecha <= CURRENT_DATE - 30 THEN 'pagado'
          ELSE 'pendiente' END
      WHERE id = v_compra_id;
    END IF;

    -- --------------------------------------------------------
    -- GASTOS: cada 3 días
    -- --------------------------------------------------------
    IF v_dia % 3 = 0 THEN
      v_cnt_gasto := v_cnt_gasto + 1;
      v_gi        := 1 + ((v_cnt_gasto - 1) % array_length(v_gastos_titulos, 1));

      INSERT INTO gastos (titulo, monto, fecha, medio_pago, categoria)
      VALUES (
        v_gastos_titulos[v_gi],
        ROUND(v_gastos_montos[v_gi] * (0.85 + (v_cnt_gasto % 5) * 0.07), 2),
        v_fecha,
        v_medios[1 + ((v_cnt_gasto - 1) % array_length(v_medios, 1))],
        v_gastos_cats[v_gi]
      );
    END IF;

    -- --------------------------------------------------------
    -- PRODUCCION: cada 2 semanas
    -- --------------------------------------------------------
    IF v_dia % 14 = 0 THEN
      v_cnt_prod := v_cnt_prod + 1;
      v_prod_id  := uuid_generate_v4();

      INSERT INTO producciones (id, numero, fecha, descripcion,
                                lote_comun, fecha_vencimiento_comun, estado)
      VALUES (
        v_prod_id,
        'P-' || LPAD(v_cnt_prod::TEXT, 5, '0'),
        v_fecha,
        'Producción lote ' || v_cnt_prod || ' - Edulcorantes línea ' || (1 + v_cnt_prod % 3)::TEXT,
        'LP-' || TO_CHAR(v_fecha, 'YYYY') || '-' || LPAD(v_cnt_prod::TEXT, 3, '0'),
        v_fecha + INTERVAL '18 months',
        'confirmado'
      );

      FOR k IN 1..(2 + v_cnt_prod % 2) LOOP
        v_pi   := 1 + ((v_cnt_prod + k - 1) % array_length(v_prod_ids, 1));
        v_cant := (100 + k * 50)::NUMERIC;

        INSERT INTO produccion_items (produccion_id, producto_id, numero_lote,
                                       fecha_vencimiento, cantidad)
        VALUES (
          v_prod_id, v_prod_ids[v_pi],
          'LP-' || TO_CHAR(v_fecha, 'YYYY') || '-' || LPAD(v_cnt_prod::TEXT, 3, '0'),
          v_fecha + INTERVAL '18 months',
          v_cant
        );

        INSERT INTO movimientos_stock (producto_id, tipo, cantidad, referencia_tipo, referencia_id)
        VALUES (v_prod_ids[v_pi], 'produccion', v_cant, 'produccion', v_prod_id);
      END LOOP;
    END IF;

  END LOOP; -- fin loop días

  -- ============================================================
  -- Actualizar saldo_pendiente de clientes según ventas reales
  -- ============================================================
  UPDATE clientes c SET saldo_pendiente = (
    SELECT COALESCE(SUM(v.saldo_pendiente), 0)
    FROM ventas v WHERE v.cliente_id = c.id AND v.saldo_pendiente > 0
  );

  RAISE NOTICE '✓ Datos generados: % ventas | % compras | % gastos | % producciones',
    v_cnt_venta, v_cnt_compra, v_cnt_gasto, v_cnt_prod;

END;
$$;
