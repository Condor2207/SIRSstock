-- ============================================================
-- MIGRACIÓN 004: TABLAS DE CONFIGURACIÓN Y EXTENSIONES
-- ============================================================

-- ============================================================
-- TABLAS MAESTRAS DE CONFIGURACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS unidades_medida (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  abreviatura TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_unidades_nombre UNIQUE (nombre),
  CONSTRAINT uq_unidades_abrev UNIQUE (abreviatura)
);

CREATE TABLE IF NOT EXISTS clasificaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  aparece_en_factura BOOLEAN DEFAULT TRUE,
  tiene_stock BOOLEAN DEFAULT TRUE,
  usa_en_produccion BOOLEAN DEFAULT FALSE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasas_iva (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  porcentaje NUMERIC(5,2) NOT NULL DEFAULT 10,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listas_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  moneda TEXT NOT NULL DEFAULT 'PYG' CHECK (moneda IN ('PYG','USD')),
  aplica_iva BOOLEAN DEFAULT TRUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS marcas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS lineas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  marca_id UUID REFERENCES marcas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_linea_marca UNIQUE (marca_id, nombre)
);

CREATE TABLE IF NOT EXISTS grupos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linea_id UUID REFERENCES lineas(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT uq_grupo_linea UNIQUE (linea_id, nombre)
);

CREATE TABLE IF NOT EXISTS bancos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS condiciones_venta (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL UNIQUE,
  plazo_dias INTEGER DEFAULT 0,
  cantidad_cuotas INTEGER DEFAULT 1,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre TEXT NOT NULL,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS empresa_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  nombre TEXT NOT NULL DEFAULT 'Teixeira S.A.',
  ruc TEXT NOT NULL DEFAULT '80046906-2',
  direccion TEXT,
  telefono TEXT,
  timbrado TEXT DEFAULT '18781301',
  punto_expedicion TEXT DEFAULT '001-001',
  timbrado_desde DATE,
  timbrado_hasta DATE,
  actividad_comercial TEXT,
  email TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLAS DE PRECIOS Y COBROS
-- ============================================================

CREATE TABLE IF NOT EXISTS producto_precios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  producto_id UUID NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  lista_precios_id UUID NOT NULL REFERENCES listas_precios(id) ON DELETE CASCADE,
  precio NUMERIC(12,2) NOT NULL DEFAULT 0,
  CONSTRAINT uq_producto_lista UNIQUE (producto_id, lista_precios_id)
);

CREATE TABLE IF NOT EXISTS compra_cuotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL,
  cliente_id UUID REFERENCES clientes(id),
  concepto TEXT,
  total_facturas NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_retenciones NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_cobrado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'registrado' CHECK (estado IN ('registrado','anulado')),
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cobro_facturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cobro_retenciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  numero_retencion TEXT,
  concepto TEXT,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cobro_medios_pago (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo','transferencia','cheque_dia','cheque_diferido','tarjeta','otro')),
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  numero_cheque TEXT,
  banco_id UUID REFERENCES bancos(id),
  fecha_cheque DATE,
  numero_transaccion TEXT
);

CREATE TABLE IF NOT EXISTS comisiones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  venta_id UUID REFERENCES ventas(id),
  vendedor_id UUID REFERENCES vendedores(id),
  cliente_id UUID REFERENCES clientes(id),
  producto_id UUID REFERENCES productos(id),
  fecha DATE NOT NULL,
  precio_sin_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 0,
  porcentaje NUMERIC(5,2) NOT NULL DEFAULT 0,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada')),
  fecha_pago DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- EXTENSIONES A TABLAS EXISTENTES
-- ============================================================

-- Productos: campos nuevos
ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS clasificacion_id UUID REFERENCES clasificaciones(id),
  ADD COLUMN IF NOT EXISTS codigo_barras TEXT,
  ADD COLUMN IF NOT EXISTS marca_id UUID REFERENCES marcas(id),
  ADD COLUMN IF NOT EXISTS linea_id UUID REFERENCES lineas(id),
  ADD COLUMN IF NOT EXISTS grupo_id UUID REFERENCES grupos(id),
  ADD COLUMN IF NOT EXISTS tasa_iva_id UUID REFERENCES tasas_iva(id),
  ADD COLUMN IF NOT EXISTS es_exportacion BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS plazo_vencimiento_meses INTEGER DEFAULT 36,
  ADD COLUMN IF NOT EXISTS porcentaje_comision NUMERIC(5,2) DEFAULT 0;

-- Código interno auto-incremental
CREATE SEQUENCE IF NOT EXISTS productos_codigo_seq START 1001;
ALTER TABLE productos ADD COLUMN IF NOT EXISTS codigo_interno INTEGER;
UPDATE productos SET codigo_interno = nextval('productos_codigo_seq') WHERE codigo_interno IS NULL;
ALTER TABLE productos ALTER COLUMN codigo_interno SET DEFAULT nextval('productos_codigo_seq');
CREATE UNIQUE INDEX IF NOT EXISTS idx_productos_codigo_interno ON productos(codigo_interno) WHERE codigo_interno IS NOT NULL;

-- Clientes: campos nuevos
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS lista_precios_id UUID REFERENCES listas_precios(id),
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id),
  ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id),
  ADD COLUMN IF NOT EXISTS es_exterior BOOLEAN DEFAULT FALSE;

-- Proveedores: condición de pago como FK
ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id);

-- Ventas: campos faltantes
ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS nota_remision TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_factura DATE,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

-- Venta items: IVA desglosado por ítem
ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS monto_exento NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_gravado_5 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_gravado_10 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_5 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_10 NUMERIC(12,2) DEFAULT 0;

-- Venta pagos: campos cheque y banco
ALTER TABLE venta_pagos
  ADD COLUMN IF NOT EXISTS numero_cheque TEXT,
  ADD COLUMN IF NOT EXISTS banco_id UUID REFERENCES bancos(id),
  ADD COLUMN IF NOT EXISTS fecha_cheque DATE,
  ADD COLUMN IF NOT EXISTS numero_transaccion TEXT;

-- Compras: cuotas y flete
ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS costo_flete NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plazo_dias INTEGER,
  ADD COLUMN IF NOT EXISTS cantidad_cuotas INTEGER DEFAULT 1;

-- Compra items: IVA
ALTER TABLE compra_items
  ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10;

-- Gastos: condición y vencimiento
ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'debito' CHECK (condicion IN ('debito','credito')),
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE unidades_medida ENABLE ROW LEVEL SECURITY;
ALTER TABLE clasificaciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasas_iva ENABLE ROW LEVEL SECURITY;
ALTER TABLE listas_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE marcas ENABLE ROW LEVEL SECURITY;
ALTER TABLE lineas ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos ENABLE ROW LEVEL SECURITY;
ALTER TABLE bancos ENABLE ROW LEVEL SECURITY;
ALTER TABLE condiciones_venta ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE empresa_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE producto_precios ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobros ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobro_facturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobro_retenciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE cobro_medios_pago ENABLE ROW LEVEL SECURITY;
ALTER TABLE comisiones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_unidades" ON unidades_medida FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_clasificaciones" ON clasificaciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_tasas_iva" ON tasas_iva FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_listas_precios" ON listas_precios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_marcas" ON marcas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_lineas" ON lineas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_grupos" ON grupos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_bancos" ON bancos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_condiciones" ON condiciones_venta FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_vendedores" ON vendedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_empresa_config" ON empresa_config FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_producto_precios" ON producto_precios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_compra_cuotas" ON compra_cuotas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cobros" ON cobros FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cobro_facturas" ON cobro_facturas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cobro_retenciones" ON cobro_retenciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_cobro_medios_pago" ON cobro_medios_pago FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_comisiones" ON comisiones FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- DATOS SEMILLA
-- ============================================================

INSERT INTO clasificaciones (nombre, aparece_en_factura, tiene_stock, usa_en_produccion) VALUES
  ('Mercadería', true, true, false),
  ('Materia Prima', false, true, true),
  ('Insumo', false, true, true),
  ('Producto Terminado', true, true, true),
  ('Servicio', true, false, false)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO tasas_iva (nombre, porcentaje) VALUES
  ('Exento', 0),
  ('IVA 5%', 5),
  ('IVA 10%', 10)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO condiciones_venta (nombre, plazo_dias, cantidad_cuotas) VALUES
  ('Contado', 0, 1),
  ('30 días', 30, 1),
  ('60 días', 60, 1),
  ('90 días', 90, 1),
  ('3 cuotas 30 días', 30, 3),
  ('6 cuotas 30 días', 30, 6)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO unidades_medida (nombre, abreviatura) VALUES
  ('Unidad', 'un'),
  ('Kilogramo', 'kg'),
  ('Gramo', 'g'),
  ('Litro', 'lts'),
  ('Mililitro', 'ml'),
  ('Caja', 'cjs'),
  ('Bolsa', 'bjs'),
  ('Bidón', 'bid'),
  ('Paquete', 'paq'),
  ('Rollo', 'rll')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO marcas (nombre) VALUES
  ('KADO'), ('ZITO'), ('BON GUSTO'), ('DEL BOSQUE'), ('SIN MARCA')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO listas_precios (nombre, moneda, aplica_iva) VALUES
  ('CONSUMO', 'PYG', true),
  ('DISTRIBUIDOR', 'PYG', true),
  ('GLORIA', 'PYG', true),
  ('PERSONAL TEIXEIRA', 'PYG', true),
  ('LICITACIÓN', 'PYG', true),
  ('BON GUSTO', 'PYG', true),
  ('DEL BOSQUE HORECA', 'PYG', true),
  ('DEL BOSQUE MINORISTA', 'PYG', true)
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO bancos (nombre) VALUES
  ('Banco Familiar'),
  ('Itaú'),
  ('Sudameris'),
  ('Continental'),
  ('GNB'),
  ('Regional'),
  ('BBVA'),
  ('Unimet'),
  ('Bancop'),
  ('Vision Banco')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO empresa_config (id, nombre, ruc, timbrado, punto_expedicion, timbrado_desde, timbrado_hasta, actividad_comercial, direccion)
VALUES (1, 'Teixeira S.A.', '80046906-2', '18781301', '001-001', '2026-04-10', '2027-04-30',
  'Elaboración, importación y distribución de edulcorantes', 'San Lorenzo, Paraguay')
ON CONFLICT (id) DO NOTHING;
