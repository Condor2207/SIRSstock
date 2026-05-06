// ============================================================
// Tipos TypeScript para SIRS - Sistema de Gestión Edulcorantes
// ============================================================

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'vendedor' | 'operador';
  active: boolean;
  created_at: string;
}

export interface Categoria {
  id: string;
  nombre: string;
  descripcion?: string;
  created_at: string;
}

export interface Producto {
  id: string;
  sku: string;
  nombre: string;
  descripcion?: string;
  categoria_id?: string;
  categoria?: Categoria;
  unidad_medida: string;
  precio_venta: number;
  precio_compra: number;
  stock_actual: number;
  stock_minimo: number;
  control_lote: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  lotes?: Lote[];
}

export interface Lote {
  id: string;
  producto_id: string;
  producto?: Producto;
  numero_lote: string;
  fecha_vencimiento?: string;
  stock_actual: number;
  stock_inicial: number;
  activo: boolean;
  created_at: string;
}

export interface Cliente {
  id: string;
  nombre: string;
  documento?: string;
  tipo_documento: 'DNI' | 'CUIT' | 'RUC' | 'OTRO';
  direccion?: string;
  telefono?: string;
  email?: string;
  limite_credito: number;
  saldo_pendiente: number;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Proveedor {
  id: string;
  nombre: string;
  documento?: string;
  tipo_documento?: string;
  direccion?: string;
  telefono?: string;
  email?: string;
  condicion_pago?: string;
  activo: boolean;
  created_at: string;
}

export interface Produccion {
  id: string;
  numero: string;
  fecha: string;
  descripcion?: string;
  lote_comun?: string;
  fecha_vencimiento_comun?: string;
  estado: 'borrador' | 'confirmado' | 'anulado';
  created_by?: string;
  created_at: string;
  produccion_items?: ProduccionItem[];
  produccion_insumos?: ProduccionInsumo[];
}

export interface ProduccionItem {
  id: string;
  produccion_id: string;
  producto_id: string;
  producto?: Producto;
  numero_lote: string;
  fecha_vencimiento?: string;
  cantidad: number;
  created_at: string;
}

export interface ProduccionInsumo {
  id: string;
  produccion_id: string;
  producto_id: string;
  producto?: Producto;
  lote_id?: string;
  lote?: Lote;
  cantidad: number;
  created_at: string;
}

export interface Venta {
  id: string;
  numero: string;
  fecha: string;
  cliente_id: string;
  cliente?: Cliente;
  condicion_pago: 'contado' | 'credito';
  plazo_dias?: number;
  cantidad_cuotas?: number;
  subtotal: number;
  descuento: number;
  total: number;
  saldo_pendiente: number;
  estado: 'pendiente' | 'pagado' | 'parcial' | 'anulado';
  numero_factura?: string;
  punto_venta?: string;
  notas?: string;
  created_by?: string;
  created_at: string;
  venta_items?: VentaItem[];
  venta_cuotas?: VentaCuota[];
  venta_pagos?: VentaPago[];
}

export interface VentaItem {
  id: string;
  venta_id: string;
  producto_id: string;
  producto?: Producto;
  lote_id?: string;
  lote?: Lote;
  numero_lote?: string;
  fecha_vencimiento?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
}

export interface VentaCuota {
  id: string;
  venta_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto: number;
  monto_pagado: number;
  estado: 'pendiente' | 'pagado' | 'parcial' | 'vencido';
  created_at: string;
}

export interface VentaPago {
  id: string;
  venta_id: string;
  cuota_id?: string;
  fecha: string;
  monto: number;
  medio_pago: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro';
  referencia?: string;
  notas?: string;
  created_by?: string;
  created_at: string;
}

export interface Compra {
  id: string;
  numero: string;
  fecha: string;
  proveedor_id?: string;
  proveedor?: Proveedor;
  condicion_pago: 'contado' | 'credito';
  numero_remito?: string;
  subtotal: number;
  total: number;
  saldo_pendiente: number;
  estado: 'pendiente' | 'pagado' | 'parcial' | 'anulado';
  notas?: string;
  created_by?: string;
  created_at: string;
  compra_items?: CompraItem[];
}

export interface CompraItem {
  id: string;
  compra_id: string;
  producto_id: string;
  producto?: Producto;
  lote_id?: string;
  numero_lote?: string;
  fecha_vencimiento?: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  created_at: string;
}

export interface Gasto {
  id: string;
  titulo: string;
  descripcion?: string;
  proveedor_id?: string;
  proveedor?: Proveedor;
  monto: number;
  fecha: string;
  medio_pago: 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'otro';
  categoria?: string;
  referencia?: string;
  created_by?: string;
  created_at: string;
}

export interface MovimientoStock {
  id: string;
  producto_id: string;
  producto?: Producto;
  lote_id?: string;
  lote?: Lote;
  tipo: 'entrada' | 'salida' | 'ajuste' | 'produccion' | 'devolucion';
  cantidad: number;
  referencia_tipo?: string;
  referencia_id?: string;
  saldo_anterior?: number;
  saldo_posterior?: number;
  notas?: string;
  created_by?: string;
  created_at: string;
}

// Tipos para formularios
export interface NuevaVentaItem {
  producto_id: string;
  producto_nombre: string;
  lote_id?: string;
  numero_lote?: string;
  fecha_vencimiento?: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
  lotes_disponibles?: Lote[];
}

export interface DashboardStats {
  ventas_hoy: number;
  ventas_mes: number;
  clientes_activos: number;
  productos_bajo_stock: number;
  lotes_por_vencer: number;
  cuentas_por_cobrar: number;
  total_ventas_contado: number;
  total_ventas_credito: number;
}
