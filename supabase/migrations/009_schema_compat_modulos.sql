-- ============================================================
-- SIRS - Migración 009: Compatibilidad de esquema por módulos
-- Corrige columnas/tablas faltantes para evitar errores de schema cache
-- en ventas, cobros, clientes, proveedores, compras, gastos,
-- producción y comisiones.
-- ============================================================

-- =============================
-- Tablas de configuración usadas por módulos
-- =============================

CREATE TABLE IF NOT EXISTS clasificaciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  aparece_en_factura BOOLEAN NOT NULL DEFAULT FALSE,
  usa_en_produccion BOOLEAN NOT NULL DEFAULT TRUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS listas_precios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  porcentaje NUMERIC(6,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS condiciones_venta (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  plazo_dias INTEGER NOT NULL DEFAULT 0,
  cantidad_cuotas INTEGER NOT NULL DEFAULT 1,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  telefono TEXT,
  email TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bancos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================
-- Ventas
-- =============================

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS timbrado TEXT,
  ADD COLUMN IF NOT EXISTS tasa_iva NUMERIC(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS nota_remision TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_factura DATE,
  ADD COLUMN IF NOT EXISTS motivo_anulacion TEXT;

ALTER TABLE venta_items
  ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS monto_exento NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_gravado_5 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monto_gravado_10 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_5 NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS iva_10 NUMERIC(12,2) DEFAULT 0;

-- =============================
-- Clientes y proveedores
-- =============================

ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS lista_precios_id UUID REFERENCES listas_precios(id),
  ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id),
  ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id),
  ADD COLUMN IF NOT EXISTS es_exterior BOOLEAN DEFAULT FALSE;

ALTER TABLE proveedores
  ADD COLUMN IF NOT EXISTS condicion_venta_id UUID REFERENCES condiciones_venta(id);

-- =============================
-- Compras
-- =============================

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS costo_flete NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS plazo_dias INTEGER,
  ADD COLUMN IF NOT EXISTS cantidad_cuotas INTEGER DEFAULT 1;

ALTER TABLE compra_items
  ADD COLUMN IF NOT EXISTS tasa_iva_porcentaje NUMERIC(5,2) DEFAULT 10;

CREATE TABLE IF NOT EXISTS compra_cuotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','pagada','vencida')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================
-- Gastos
-- =============================

ALTER TABLE gastos
  ADD COLUMN IF NOT EXISTS condicion TEXT DEFAULT 'debito',
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS numero_transaccion TEXT,
  ADD COLUMN IF NOT EXISTS banco_id UUID REFERENCES bancos(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS numero_cheque TEXT,
  ADD COLUMN IF NOT EXISTS fecha_cheque DATE;

-- =============================
-- Producción
-- =============================

ALTER TABLE productos
  ADD COLUMN IF NOT EXISTS clasificacion_id UUID REFERENCES clasificaciones(id),
  ADD COLUMN IF NOT EXISTS plazo_vencimiento_meses INTEGER DEFAULT 36,
  ADD COLUMN IF NOT EXISTS porcentaje_comision NUMERIC(5,2) DEFAULT 0;

-- =============================
-- Cobros
-- =============================

CREATE TABLE IF NOT EXISTS cobros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  venta_id UUID NOT NULL REFERENCES ventas(id),
  monto_aplicado NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cobro_retenciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  numero_retencion TEXT,
  concepto TEXT,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cobro_medios_pago (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cobro_id UUID NOT NULL REFERENCES cobros(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('efectivo','transferencia','cheque_dia','cheque_diferido','tarjeta','otro')),
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  numero_cheque TEXT,
  banco_id UUID REFERENCES bancos(id),
  fecha_cheque DATE,
  numero_transaccion TEXT
);

-- =============================
-- Comisiones
-- =============================

CREATE TABLE IF NOT EXISTS comisiones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID REFERENCES ventas(id),
  vendedor_id UUID REFERENCES vendedores(id),
  cliente_id UUID REFERENCES clientes(id),
  producto_id UUID REFERENCES productos(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  precio_sin_iva NUMERIC(12,2) NOT NULL DEFAULT 0,
  cantidad NUMERIC(12,3) NOT NULL DEFAULT 0,
  porcentaje NUMERIC(6,2) NOT NULL DEFAULT 0,
  monto NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagada')),
  fecha_pago DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
