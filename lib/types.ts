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
  // Nuevos campos 004
  clasificacion_id?: string;
  clasificacion?: Clasificacion;
  codigo_barras?: string;
  codigo_interno?: number;
  marca_id?: string;
  marca?: Marca;
  linea_id?: string;
  linea?: Linea;
  grupo_id?: string;
  grupo?: Grupo;
  tasa_iva_id?: string;
  tasa_iva_ref?: TasaIva;
  es_exportacion?: boolean;
  plazo_vencimiento_meses?: number;
  porcentaje_comision?: number;
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
  // Nuevos campos 004
  lista_precios_id?: string;
  lista_precios?: ListaPrecios;
  vendedor_id?: string;
  vendedor?: Vendedor;
  condicion_venta_id?: string;
  condicion_venta?: CondicionVenta;
  es_exterior?: boolean;
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
  condicion_venta_id?: string;
  condicion_venta?: CondicionVenta;
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
  timbrado?: string;
  tasa_iva: number;
  nota_remision?: string;
  fecha_vencimiento_factura?: string;
  motivo_anulacion?: string;
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
  tasa_iva_porcentaje?: number;
  monto_exento?: number;
  monto_gravado_5?: number;
  monto_gravado_10?: number;
  iva_5?: number;
  iva_10?: number;
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
  costo_flete?: number;
  plazo_dias?: number;
  cantidad_cuotas?: number;
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
  condicion?: 'debito' | 'credito';
  fecha_vencimiento?: string;
  saldo_pendiente?: number;
  estado?: 'pendiente' | 'pagado' | 'parcial' | 'anulado';
  categoria?: string;
  tasa_iva_id?: string;
  tasa_iva_ref?: TasaIva;
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
  tasa_iva_porcentaje?: number;
}

// ============================================================
// NUEVAS INTERFACES - MÓDULO CONFIGURACIÓN (004)
// ============================================================

export interface UnidadMedida {
  id: string;
  nombre: string;
  abreviatura: string;
  activo: boolean;
  created_at: string;
}

export interface Clasificacion {
  id: string;
  nombre: string;
  aparece_en_factura: boolean;
  tiene_stock: boolean;
  usa_en_produccion: boolean;
  activo: boolean;
  created_at: string;
}

export interface TasaIva {
  id: string;
  nombre: string;
  porcentaje: number;
  activo: boolean;
  created_at: string;
}

export interface ListaPrecios {
  id: string;
  nombre: string;
  moneda: 'PYG' | 'USD';
  aplica_iva: boolean;
  activo: boolean;
  created_at: string;
}

export interface Marca {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
  lineas?: Linea[];
}

export interface Linea {
  id: string;
  marca_id: string;
  marca?: Marca;
  nombre: string;
  activo: boolean;
  created_at: string;
  grupos?: Grupo[];
}

export interface Grupo {
  id: string;
  linea_id: string;
  linea?: Linea;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface Banco {
  id: string;
  nombre: string;
  activo: boolean;
  created_at: string;
}

export interface CondicionVenta {
  id: string;
  nombre: string;
  plazo_dias: number;
  cantidad_cuotas: number;
  activo: boolean;
  created_at: string;
}

export interface Vendedor {
  id: string;
  nombre: string;
  telefono?: string;
  email?: string;
  porcentaje_venta?: number;
  activo: boolean;
  created_at: string;
}

export interface EmpresaConfig {
  id: number;
  nombre: string;
  ruc: string;
  direccion?: string;
  telefono?: string;
  timbrado?: string;
  punto_expedicion?: string;
  timbrado_desde?: string;
  timbrado_hasta?: string;
  actividad_comercial?: string;
  email?: string;
  updated_at: string;
}

export interface ProductoPrecio {
  id: string;
  producto_id: string;
  lista_precios_id: string;
  lista_precios?: ListaPrecios;
  precio: number;
}

export interface CompraCuota {
  id: string;
  compra_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto: number;
  monto_pagado: number;
  estado: 'pendiente' | 'pagada' | 'vencida';
  created_at: string;
}

export interface Cobro {
  id: string;
  numero: string;
  fecha: string;
  tipo_referencia?: 'clientes' | 'gastos';
  cliente_id?: string;
  cliente?: Cliente;
  proveedor_id?: string;
  proveedor?: Proveedor;
  concepto?: string;
  total_facturas: number;
  total_retenciones: number;
  total_cobrado: number;
  estado: 'registrado' | 'anulado';
  notas?: string;
  created_by?: string;
  created_at: string;
  cobro_facturas?: CobroFactura[];
  cobro_gastos?: CobroGasto[];
  cobro_retenciones?: CobroRetencion[];
  cobro_medios_pago?: CobroMedioPago[];
}

export interface CobroFactura {
  id: string;
  cobro_id: string;
  venta_id: string;
  venta?: Venta;
  monto_aplicado: number;
}

export interface CobroGasto {
  id: string;
  cobro_id: string;
  gasto_id: string;
  gasto?: Gasto;
  monto_aplicado: number;
}

export interface CobroRetencion {
  id: string;
  cobro_id: string;
  numero_retencion?: string;
  concepto?: string;
  monto: number;
}

export interface CobroMedioPago {
  id: string;
  cobro_id: string;
  tipo: 'efectivo' | 'transferencia' | 'cheque_dia' | 'cheque_diferido' | 'tarjeta' | 'otro';
  monto: number;
  numero_cheque?: string;
  banco_id?: string;
  banco?: Banco;
  fecha_cheque?: string;
  numero_transaccion?: string;
}

export interface Comision {
  id: string;
  venta_id?: string;
  venta?: Venta;
  vendedor_id?: string;
  vendedor?: Vendedor;
  cliente_id?: string;
  cliente?: Cliente;
  producto_id?: string;
  producto?: Producto;
  fecha: string;
  precio_sin_iva: number;
  cantidad: number;
  porcentaje: number;
  monto: number;
  estado: 'pendiente' | 'pagada';
  fecha_pago?: string;
  created_at: string;
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
