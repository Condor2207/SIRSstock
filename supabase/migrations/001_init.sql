-- ============================================================
-- SIRS - Sistema Integral de Gestión para Edulcorantes
-- Migración inicial: schema + datos demo
-- ============================================================

-- Habilitar extensiones
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLAS
-- ============================================================

-- Perfiles de usuario (extiende auth.users de Supabase)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'operador' CHECK (role IN ('admin', 'vendedor', 'operador')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Categorías de productos
CREATE TABLE IF NOT EXISTS categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL UNIQUE,
  descripcion TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Catálogo de productos
CREATE TABLE IF NOT EXISTS productos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sku TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  descripcion TEXT,
  categoria_id UUID REFERENCES categorias(id),
  unidad_medida TEXT NOT NULL DEFAULT 'unidad',
  precio_venta NUMERIC(12,2) NOT NULL DEFAULT 0,
  precio_compra NUMERIC(12,2) DEFAULT 0,
  stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_minimo NUMERIC(12,3) DEFAULT 0,
  control_lote BOOLEAN NOT NULL DEFAULT FALSE,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Lotes (control por lote y vencimiento)
CREATE TABLE IF NOT EXISTS lotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id),
  numero_lote TEXT NOT NULL,
  fecha_vencimiento DATE,
  stock_actual NUMERIC(12,3) NOT NULL DEFAULT 0,
  stock_inicial NUMERIC(12,3) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(producto_id, numero_lote)
);

-- Clientes
CREATE TABLE IF NOT EXISTS clientes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  documento TEXT,
  tipo_documento TEXT DEFAULT 'CUIT' CHECK (tipo_documento IN ('DNI', 'CUIT', 'RUC', 'OTRO')),
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  limite_credito NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Proveedores
CREATE TABLE IF NOT EXISTS proveedores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nombre TEXT NOT NULL,
  documento TEXT,
  tipo_documento TEXT DEFAULT 'CUIT',
  direccion TEXT,
  telefono TEXT,
  email TEXT,
  condicion_pago TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Producciones
CREATE TABLE IF NOT EXISTS producciones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT,
  lote_comun TEXT,
  fecha_vencimiento_comun DATE,
  estado TEXT NOT NULL DEFAULT 'borrador' CHECK (estado IN ('borrador', 'confirmado', 'anulado')),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items de producción (productos generados)
CREATE TABLE IF NOT EXISTS produccion_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produccion_id UUID NOT NULL REFERENCES producciones(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  numero_lote TEXT NOT NULL,
  fecha_vencimiento DATE,
  cantidad NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insumos usados en producción
CREATE TABLE IF NOT EXISTS produccion_insumos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  produccion_id UUID NOT NULL REFERENCES producciones(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  lote_id UUID REFERENCES lotes(id),
  cantidad NUMERIC(12,3) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ventas (cabecera)
CREATE TABLE IF NOT EXISTS ventas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  cliente_id UUID NOT NULL REFERENCES clientes(id),
  condicion_pago TEXT NOT NULL DEFAULT 'contado' CHECK (condicion_pago IN ('contado', 'credito')),
  plazo_dias INTEGER,
  cantidad_cuotas INTEGER DEFAULT 1,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  descuento NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'anulado')),
  numero_factura TEXT,
  punto_venta TEXT,
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detalle de ventas
CREATE TABLE IF NOT EXISTS venta_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  lote_id UUID REFERENCES lotes(id),
  numero_lote TEXT,
  fecha_vencimiento DATE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Cuotas de ventas a crédito
CREATE TABLE IF NOT EXISTS venta_cuotas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  numero_cuota INTEGER NOT NULL,
  fecha_vencimiento DATE NOT NULL,
  monto NUMERIC(12,2) NOT NULL,
  monto_pagado NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'vencido')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pagos recibidos
CREATE TABLE IF NOT EXISTS venta_pagos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  venta_id UUID NOT NULL REFERENCES ventas(id),
  cuota_id UUID REFERENCES venta_cuotas(id),
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  monto NUMERIC(12,2) NOT NULL,
  medio_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (medio_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')),
  referencia TEXT,
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compras (cabecera)
CREATE TABLE IF NOT EXISTS compras (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  numero TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  proveedor_id UUID REFERENCES proveedores(id),
  condicion_pago TEXT NOT NULL DEFAULT 'contado' CHECK (condicion_pago IN ('contado', 'credito')),
  numero_remito TEXT,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  saldo_pendiente NUMERIC(12,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'pagado', 'parcial', 'anulado')),
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Detalle de compras
CREATE TABLE IF NOT EXISTS compra_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  compra_id UUID NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id UUID NOT NULL REFERENCES productos(id),
  lote_id UUID REFERENCES lotes(id),
  numero_lote TEXT,
  fecha_vencimiento DATE,
  descripcion TEXT NOT NULL,
  cantidad NUMERIC(12,3) NOT NULL,
  precio_unitario NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Gastos generales
CREATE TABLE IF NOT EXISTS gastos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  titulo TEXT NOT NULL,
  descripcion TEXT,
  proveedor_id UUID REFERENCES proveedores(id),
  monto NUMERIC(12,2) NOT NULL,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  medio_pago TEXT NOT NULL DEFAULT 'efectivo' CHECK (medio_pago IN ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')),
  categoria TEXT,
  referencia TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Movimientos de stock
CREATE TABLE IF NOT EXISTS movimientos_stock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  producto_id UUID NOT NULL REFERENCES productos(id),
  lote_id UUID REFERENCES lotes(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'salida', 'ajuste', 'produccion', 'devolucion')),
  cantidad NUMERIC(12,3) NOT NULL,
  referencia_tipo TEXT,
  referencia_id UUID,
  saldo_anterior NUMERIC(12,3),
  saldo_posterior NUMERIC(12,3),
  notas TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE lotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE proveedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE producciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE produccion_insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_cuotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE venta_pagos ENABLE ROW LEVEL SECURITY;
ALTER TABLE compras ENABLE ROW LEVEL SECURITY;
ALTER TABLE compra_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE gastos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movimientos_stock ENABLE ROW LEVEL SECURITY;

-- Políticas: usuarios autenticados tienen acceso completo
CREATE POLICY "auth_all_profiles" ON profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_categorias" ON categorias FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_productos" ON productos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_lotes" ON lotes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_clientes" ON clientes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_proveedores" ON proveedores FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_producciones" ON producciones FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_produccion_items" ON produccion_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_produccion_insumos" ON produccion_insumos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_ventas" ON ventas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_venta_items" ON venta_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_venta_cuotas" ON venta_cuotas FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_venta_pagos" ON venta_pagos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_compras" ON compras FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_compra_items" ON compra_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_gastos" ON gastos FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "auth_all_movimientos" ON movimientos_stock FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- FUNCIONES Y TRIGGERS
-- ============================================================

-- Auto-crear perfil al registrar usuario
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    'admin'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS productos_updated_at ON productos;
CREATE TRIGGER productos_updated_at
  BEFORE UPDATE ON productos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS clientes_updated_at ON clientes;
CREATE TRIGGER clientes_updated_at
  BEFORE UPDATE ON clientes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DATOS DEMO
-- ============================================================

-- Categorías
INSERT INTO categorias (nombre, descripcion) VALUES
  ('Edulcorante en Polvo', 'Productos edulcorantes en presentación sólida'),
  ('Edulcorante Líquido', 'Productos edulcorantes en presentación líquida'),
  ('Mezclas', 'Mezclas especiales de edulcorantes'),
  ('Insumos', 'Materias primas y materiales de producción')
ON CONFLICT (nombre) DO NOTHING;

-- Productos de demo
INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'EDU-001', 'Stevia en Polvo 50g', 'Edulcorante natural de stevia - bolsa 50g', 'unidad', 35000, 18000, 150, 20, true,
  (SELECT id FROM categorias WHERE nombre = 'Edulcorante en Polvo')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'EDU-001');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'EDU-002', 'Stevia en Polvo 250g', 'Edulcorante natural de stevia - bolsa 250g', 'unidad', 140000, 75000, 80, 10, true,
  (SELECT id FROM categorias WHERE nombre = 'Edulcorante en Polvo')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'EDU-002');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'EDU-003', 'Stevia en Polvo 1kg', 'Edulcorante natural de stevia - bolsa 1kg', 'unidad', 480000, 250000, 35, 5, true,
  (SELECT id FROM categorias WHERE nombre = 'Edulcorante en Polvo')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'EDU-003');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'EDU-004', 'Stevia Líquida 500ml', 'Edulcorante líquido de stevia - botella 500ml', 'unidad', 120000, 60000, 60, 10, true,
  (SELECT id FROM categorias WHERE nombre = 'Edulcorante Líquido')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'EDU-004');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'EDU-005', 'Stevia Líquida 1L', 'Edulcorante líquido de stevia - botella 1 litro', 'unidad', 220000, 110000, 25, 5, true,
  (SELECT id FROM categorias WHERE nombre = 'Edulcorante Líquido')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'EDU-005');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'MIX-001', 'Stevia + Eritritol 1kg', 'Mezcla stevia y eritritol - bolsa 1kg', 'unidad', 350000, 180000, 40, 5, true,
  (SELECT id FROM categorias WHERE nombre = 'Mezclas')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'MIX-001');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'INS-001', 'Extracto de Stevia a Granel', 'Materia prima - extracto de stevia', 'kg', 0, 120000, 25, 5, false,
  (SELECT id FROM categorias WHERE nombre = 'Insumos')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'INS-001');

INSERT INTO productos (sku, nombre, descripcion, unidad_medida, precio_venta, precio_compra, stock_actual, stock_minimo, control_lote, categoria_id)
SELECT 'INS-002', 'Eritritol a Granel', 'Materia prima - eritritol', 'kg', 0, 80000, 15, 3, false,
  (SELECT id FROM categorias WHERE nombre = 'Insumos')
WHERE NOT EXISTS (SELECT 1 FROM productos WHERE sku = 'INS-002');

-- Lotes demo (varios lotes con diferentes vencimientos para FEFO)
INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2026-06-30', 50, 100
FROM productos p WHERE p.sku = 'EDU-001'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-002', '2027-03-31', 100, 100
FROM productos p WHERE p.sku = 'EDU-001'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-002');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2027-01-15', 80, 80
FROM productos p WHERE p.sku = 'EDU-002'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2026-09-20', 35, 50
FROM productos p WHERE p.sku = 'EDU-003'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2026-10-20', 60, 60
FROM productos p WHERE p.sku = 'EDU-004'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2027-02-28', 25, 25
FROM productos p WHERE p.sku = 'EDU-005'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

INSERT INTO lotes (producto_id, numero_lote, fecha_vencimiento, stock_actual, stock_inicial)
SELECT p.id, 'L2024-001', '2027-06-30', 40, 40
FROM productos p WHERE p.sku = 'MIX-001'
AND NOT EXISTS (SELECT 1 FROM lotes l WHERE l.producto_id = p.id AND l.numero_lote = 'L2024-001');

-- Clientes demo
INSERT INTO clientes (nombre, documento, tipo_documento, direccion, telefono, email, limite_credito, saldo_pendiente)
VALUES
  ('Juan García', '80-12345678-9', 'CUIT', 'Av. Mcal. López 1234, Asunción', '0981-555-001', 'juan@ejemplo.com', 5000000, 1500000),
  ('María López', '80-98765432-1', 'CUIT', 'Av. España 456, Asunción', '0982-555-002', 'maria@ejemplo.com', 3000000, 0),
  ('Distribuidora Norte SRL', '80-55555555-5', 'CUIT', 'Ruta 7 km 45, CDE', '0983-555-003', 'norte@ejemplo.com', 20000000, 8500000),
  ('Almacén El Paraíso', '80-44444444-4', 'CUIT', 'San Martín 789, Encarnación', '0984-555-004', 'paraiso@ejemplo.com', 7500000, 2000000),
  ('Supermercado Los Andes', '80-66666666-6', 'CUIT', 'Av. Eusebio Ayala 321, Asunción', '0985-555-005', 'losandes@ejemplo.com', 15000000, 0)
ON CONFLICT DO NOTHING;

-- Proveedores demo
INSERT INTO proveedores (nombre, documento, tipo_documento, telefono, email, condicion_pago)
VALUES
  ('Stevia Natural SA', '30-11111111-1', 'CUIT', '11-5555-0001', 'ventas@stevianatural.com', '30 días'),
  ('Insumos Bio SRL', '30-22222222-2', 'CUIT', '11-5555-0002', 'compras@insumosbio.com', 'Contado'),
  ('Envases y Packaging SA', '30-33333333-3', 'CUIT', '11-5555-0003', 'info@envases.com', '15 días'),
  ('Eritritol Import SRL', '30-44444444-4', 'CUIT', '11-5555-0004', 'import@eritritol.com', '30 días')
ON CONFLICT DO NOTHING;
