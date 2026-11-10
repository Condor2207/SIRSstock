'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import {
  formatDate, estadoBadgeClass, getErrorMessage, isSchemaCacheMissing, toDigitsOnly,
  parseDecimal, sanitizeDecimalInput, decimalToInput, roundTo, roundMoneda, decimalesMoneda,
  formatCantidad, formatMontoMoneda, ivaIncluido, TIPOS_CONTROL, labelTipoControl, requiereLote,
  requiereVencimiento, tipoControlDeProducto, loteAutomaticoPorVencimiento, estadoEfectivoCuota,
  generarPlanCuotas, hoyISO, escapeHtml, DECIMALES_CANTIDAD, DECIMALES_TIPO_CAMBIO,
  type Moneda, type TipoControl,
} from '@/lib/utils';
import { Plus, Search, Eye, X, Loader2, Trash2, CreditCard, UserPlus, FileSpreadsheet, Printer, Paperclip, Wallet, Ban } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchSelect } from '@/components/SearchSelect';
import { ComprobanteInput } from '@/components/ComprobanteInput';
import { ProveedorRapidoModal } from '@/components/ProveedorRapidoModal';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';
import { subirComprobante, abrirComprobante } from '@/lib/comprobantes';
import { moverStock } from '@/lib/stock';
import { estadoCompraPorSaldo } from '@/lib/compras-saldos';
import { descargarExcel, imprimirDocumento } from '@/lib/export';
import type { Compra, Proveedor, Producto, CompraCuota, CompraPago } from '@/lib/types';

interface CompraItem {
  producto_id: string;
  producto_nombre: string;
  tipo_control: TipoControl;
  numero_lote: string;
  fecha_vencimiento: string;
  cantidad: string;
  precio_unitario: string;
  tasa_iva: number;
  permite_decimales: boolean;
  historial?: { fecha: string; precio: number }[];
}

interface CuotaForm { numero_cuota: number; fecha_vencimiento: string; monto: string }

const MEDIOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'];
const estadoLabel = (e: string) => e;

const nuevoForm = () => ({
  proveedor_id: '', condicion_pago: 'contado' as 'contado' | 'credito',
  moneda: 'GS' as Moneda, tipo_cambio: '', fecha: hoyISO(),
  numero_remito: '', numero_factura: '', notas: '', compra_servicios: '',
  plazo_dias: '30', cantidad_cuotas: '1', primera_cuota: '',
});

export default function ComprasPage() {
  const supabase = createClient();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [filtroMoneda, setFiltroMoneda] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detalle, setDetalle] = useState<Compra | null>(null);
  const [saving, setSaving] = useState(false);
  const [schemaCompatNumeroFactura, setSchemaCompatNumeroFactura] = useState(false);
  const [schemaCompatMoneda, setSchemaCompatMoneda] = useState(false);
  const compatToastShown = useRef(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [showProveedorModal, setShowProveedorModal] = useState(false);
  const [form, setForm] = useState(nuevoForm());
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [items, setItems] = useState<CompraItem[]>([]);
  const [cuotas, setCuotas] = useState<CuotaForm[]>([]);
  const [pagoForm, setPagoForm] = useState<{ cuota: CompraCuota | null; monto: string; fecha: string; medio_pago: string; referencia: string } | null>(null);
  const [savingPago, setSavingPago] = useState(false);
  const [tipoCambioConfig, setTipoCambioConfig] = useState<number | null>(null);

  const moneda = form.moneda;
  const decMoneda = decimalesMoneda(moneda);
  const decPrecio = moneda === 'USD' ? 4 : 0;

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('compras').select('*, proveedores(nombre)').order('created_at', { ascending: false }).limit(200);
    setCompras(data as Compra[] || []);
    const compatProbe = await supabase.from('compras').select('id, numero_factura, moneda, tipo_cambio, iva_total, comprobante_url, comprobante_nombre').limit(1);
    if (compatProbe.error && isSchemaCacheMissing(compatProbe.error, ['compras', 'numero_factura', 'moneda', 'tipo_cambio', 'iva_total', 'comprobante_url', 'comprobante_nombre'])) {
      setSchemaCompatNumeroFactura(true);
      setSchemaCompatMoneda(true);
      if (!compatToastShown.current) {
        toast('La base de datos no tiene aún la migración 022 (moneda / comprobante). Ejecutala para registrar nuevas compras.');
        compatToastShown.current = true;
      }
    } else if (!compatProbe.error) {
      setSchemaCompatNumeroFactura(false);
      setSchemaCompatMoneda(false);
    } else {
      setSchemaCompatMoneda(true);
      toast.error(getErrorMessage(compatProbe.error) || 'No se pudo verificar el esquema de compras');
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('proveedores').select('*').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
    supabase.from('productos').select('id, sku, nombre, precio_compra, control_lote, tipo_control, permite_decimales').eq('activo', true).order('nombre').then(async r => {
      if (r.error) {
        const legacy = await supabase.from('productos').select('id, sku, nombre, precio_compra, control_lote').eq('activo', true).order('nombre');
        setProductos(legacy.data as Producto[] || []);
      } else setProductos(r.data as Producto[] || []);
    });
    supabase.from('monedas').select('tipo_cambio').eq('codigo', 'USD').eq('activo', true).maybeSingle().then(r => {
      if (r.data?.tipo_cambio) setTipoCambioConfig(Number(r.data.tipo_cambio));
    });
  }, [load, supabase]);

  function abrirNueva() {
    setForm(nuevoForm());
    setItems([]); setCuotas([]); setComprobanteFile(null);
    setShowModal(true);
  }

  function cambiarMoneda(nueva: Moneda) {
    setForm(f => ({
      ...f, moneda: nueva,
      tipo_cambio: nueva === 'USD' ? (f.tipo_cambio || (tipoCambioConfig ? decimalToInput(tipoCambioConfig, DECIMALES_TIPO_CAMBIO) : '')) : '',
      compra_servicios: sanitizeDecimalInput(f.compra_servicios, decimalesMoneda(nueva)),
    }));
    const dp = nueva === 'USD' ? 4 : 0;
    setItems(prev => prev.map(i => ({ ...i, precio_unitario: sanitizeDecimalInput(i.precio_unitario, dp) })));
    setCuotas([]);
  }

  function addItem() {
    setItems(prev => [...prev, {
      producto_id: '', producto_nombre: '', tipo_control: 'generico', numero_lote: '', fecha_vencimiento: '',
      cantidad: '1', precio_unitario: '', tasa_iva: 10, permite_decimales: true, historial: [],
    }]);
  }

  async function updateItem(idx: number, campo: keyof CompraItem, valor: string | number | boolean) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [campo]: valor } as CompraItem;
      if (campo === 'producto_id') {
        const prod = productos.find(p => p.id === valor);
        item.producto_nombre = prod ? `${prod.sku} - ${prod.nombre}` : '';
        item.tipo_control = prod ? tipoControlDeProducto(prod) : 'generico';
        item.permite_decimales = prod?.permite_decimales !== false;
        item.precio_unitario = prod?.precio_compra && moneda === 'GS' ? decimalToInput(Math.round(prod.precio_compra), 0) : '';
        if (!item.permite_decimales) item.cantidad = sanitizeDecimalInput(item.cantidad, 0);
      }
      if (campo === 'cantidad') item.cantidad = sanitizeDecimalInput(String(valor), item.permite_decimales ? DECIMALES_CANTIDAD : 0);
      if (campo === 'precio_unitario') item.precio_unitario = sanitizeDecimalInput(String(valor), decPrecio);
      if (campo === 'tipo_control') {
        const t = valor as TipoControl;
        if (!requiereLote(t)) item.numero_lote = '';
        if (!requiereVencimiento(t)) item.fecha_vencimiento = '';
      }
      updated[idx] = item;
      return updated;
    });
    if (campo === 'producto_id' && valor) {
      const { data } = await supabase
        .from('compra_items')
        .select('precio_unitario, compras(fecha, moneda)')
        .eq('producto_id', valor)
        .order('created_at', { ascending: false })
        .limit(5);
      const historial = (data || [])
        .filter((d: any) => (d.compras?.moneda || 'GS') === moneda)
        .map((d: any) => ({ fecha: d.compras?.fecha, precio: Number(d.precio_unitario) || 0 }));
      setItems(prev => {
        const updated = [...prev];
        if (!updated[idx]) return prev;
        const item = { ...updated[idx], historial };
        if (historial.length > 0) item.precio_unitario = decimalToInput(historial[0].precio, decPrecio);
        updated[idx] = item;
        return updated;
      });
    }
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const calc = useMemo(() => {
    const lineas = items.map(i => {
      const cant = parseDecimal(i.cantidad);
      const precio = parseDecimal(i.precio_unitario);
      const subtotal = roundMoneda(cant * precio, moneda);
      return { cant, precio, subtotal, iva: ivaIncluido(subtotal, i.tasa_iva, moneda) };
    });
    const subtotalItems = roundMoneda(lineas.reduce((s, l) => s + l.subtotal, 0), moneda);
    const servicios = roundMoneda(parseDecimal(form.compra_servicios), moneda);
    const total = roundMoneda(subtotalItems + servicios, moneda);
    const iva = roundMoneda(lineas.reduce((s, l) => s + l.iva, 0), moneda);
    return { lineas, subtotalItems, servicios, total, iva };
  }, [items, form.compra_servicios, moneda]);

  const tipoCambioNum = parseDecimal(form.tipo_cambio);
  const sumaCuotas = roundMoneda(cuotas.reduce((s, c) => s + parseDecimal(c.monto), 0), moneda);

  function generarCuotas() {
    if (calc.total <= 0) { toast.error('Cargá los productos antes de generar el plan de cuotas'); return null; }
    const n = parseInt(form.cantidad_cuotas) || 0;
    if (n < 1 || n > 48) { toast.error('La cantidad de cuotas debe estar entre 1 y 48'); return null; }
    const intervalo = parseInt(form.plazo_dias) || 0;
    if (intervalo < 1) { toast.error('Indicá el intervalo entre cuotas en días (mínimo 1)'); return null; }
    if (!form.primera_cuota) { toast.error('Indicá la fecha de la primera cuota'); return null; }
    const plan = generarPlanCuotas(calc.total, n, form.primera_cuota, intervalo, moneda)
      .map(c => ({ numero_cuota: c.numero_cuota, fecha_vencimiento: c.fecha_vencimiento, monto: decimalToInput(c.monto, decMoneda) || '0' }));
    setCuotas(plan);
    return plan;
  }

  function editarCuota(idx: number, campo: 'fecha_vencimiento' | 'monto', valor: string) {
    setCuotas(prev => prev.map((c, i) => i === idx ? { ...c, [campo]: campo === 'monto' ? sanitizeDecimalInput(valor, decMoneda) : valor } : c));
  }

  async function handleSave() {
    const numeroRemito = toDigitsOnly(form.numero_remito);
    const numeroFactura = toDigitsOnly(form.numero_factura);
    if (schemaCompatNumeroFactura || schemaCompatMoneda) { toast.error('Falta ejecutar la migración 022 en la base de datos para registrar compras'); return; }
    if (items.length === 0) { toast.error('Agregá al menos un producto a la compra'); return; }
    if (!form.fecha) { toast.error('La fecha de la compra es obligatoria'); return; }
    if (form.condicion_pago === 'credito' && !form.proveedor_id) { toast.error('En compras a crédito el proveedor es obligatorio'); return; }
    if (items.some(i => !i.producto_id)) { toast.error('Todas las líneas deben tener un producto seleccionado'); return; }
    for (const [idx, i] of items.entries()) {
      const l = calc.lineas[idx];
      if (l.cant <= 0) { toast.error(`La cantidad debe ser mayor a 0: ${i.producto_nombre}`); return; }
      if (l.precio <= 0) { toast.error(`El precio unitario debe ser mayor a 0: ${i.producto_nombre}`); return; }
      if (requiereLote(i.tipo_control) && !i.numero_lote.trim()) { toast.error(`Debés completar el número de lote: ${i.producto_nombre}`); return; }
      if (requiereVencimiento(i.tipo_control) && !i.fecha_vencimiento) { toast.error(`Debés completar la fecha de vencimiento: ${i.producto_nombre}`); return; }
    }
    if (calc.total <= 0) { toast.error('El total de la compra debe ser mayor a 0'); return; }
    if (moneda === 'USD' && form.tipo_cambio && tipoCambioNum <= 0) { toast.error('El tipo de cambio debe ser mayor a 0'); return; }
    if (!numeroFactura && !comprobanteFile) { toast.error('El comprobante es obligatorio: ingresá el número de factura o adjuntá el archivo'); return; }

    let plan: CuotaForm[] = cuotas;
    if (form.condicion_pago === 'credito') {
      if (plan.length === 0) {
        const generado = generarCuotas();
        if (!generado) return;
        plan = generado;
      }
      if (plan.some(c => !c.fecha_vencimiento)) { toast.error('Todas las cuotas deben tener fecha de vencimiento'); return; }
      if (plan.some(c => parseDecimal(c.monto) <= 0)) { toast.error('El monto de cada cuota debe ser mayor a 0'); return; }
      const suma = roundMoneda(plan.reduce((s, c) => s + parseDecimal(c.monto), 0), moneda);
      if (suma !== calc.total) { toast.error(`La suma de las cuotas (${formatMontoMoneda(suma, moneda)}) debe ser igual al total (${formatMontoMoneda(calc.total, moneda)})`); return; }
    }

    setSaving(true);
    let compraCreadaId: string | null = null;
    const movidos: { producto_id: string; cantidad: number; numero_lote: string | null }[] = [];
    try {
      const comprobantePath = comprobanteFile ? await subirComprobante(supabase, comprobanteFile, 'compras') : null;
      const { count } = await supabase.from('compras').select('*', { count: 'exact', head: true });
      const numCompra = `C-${String((count || 0) + 1).padStart(5, '0')}`;
      const esCredito = form.condicion_pago === 'credito';
      const compraPayload: Record<string, any> = {
        numero: numCompra,
        fecha: form.fecha,
        proveedor_id: form.proveedor_id || null,
        condicion_pago: form.condicion_pago,
        moneda,
        tipo_cambio: moneda === 'USD' && tipoCambioNum > 0 ? roundTo(tipoCambioNum, DECIMALES_TIPO_CAMBIO) : null,
        numero_remito: numeroRemito || null,
        numero_factura: numeroFactura || null,
        comprobante_url: comprobantePath,
        comprobante_nombre: comprobanteFile?.name || null,
        subtotal: calc.subtotalItems, total: calc.total, iva_total: calc.iva,
        costo_flete: calc.servicios,
        plazo_dias: esCredito ? parseInt(form.plazo_dias) || 0 : 0,
        cantidad_cuotas: esCredito ? plan.length : 1,
        saldo_pendiente: esCredito ? calc.total : 0,
        estado: esCredito ? 'pendiente' : 'pagado',
        notas: form.notas || null,
      };
      const { data: compra, error } = await supabase.from('compras').insert(compraPayload as any).select().single();
      if (error) throw error;
      compraCreadaId = compra.id;

      const itemsData = items.map((i, idx) => ({
        compra_id: compra.id,
        producto_id: i.producto_id,
        tipo_control: i.tipo_control,
        numero_lote: requiereLote(i.tipo_control) ? i.numero_lote.trim() : (i.tipo_control === 'solo_vencimiento' ? loteAutomaticoPorVencimiento(i.fecha_vencimiento) : null),
        fecha_vencimiento: requiereVencimiento(i.tipo_control) ? i.fecha_vencimiento : null,
        descripcion: i.producto_nombre,
        cantidad: roundTo(calc.lineas[idx].cant, DECIMALES_CANTIDAD),
        precio_unitario: calc.lineas[idx].precio,
        tasa_iva_porcentaje: i.tasa_iva,
        monto_iva: calc.lineas[idx].iva,
        subtotal: calc.lineas[idx].subtotal,
      }));
      const { error: itemsError } = await supabase.from('compra_items').insert(itemsData);
      if (itemsError) throw itemsError;

      if (esCredito) {
        const { error: cuotasError } = await supabase.from('compra_cuotas').insert(plan.map(c => ({
          compra_id: compra.id, numero_cuota: c.numero_cuota, fecha_vencimiento: c.fecha_vencimiento,
          monto: roundMoneda(parseDecimal(c.monto), moneda), monto_pagado: 0, estado: 'pendiente',
        })));
        if (cuotasError) throw cuotasError;
      }

      for (const d of itemsData) {
        await moverStock(supabase, {
          productoId: d.producto_id, delta: d.cantidad, tipo: 'entrada',
          referenciaTipo: 'compra', referenciaId: compra.id, notas: `Compra ${numCompra}`,
          numeroLote: d.numero_lote, fechaVencimiento: d.fecha_vencimiento,
        });
        movidos.push(d);
      }

      toast.success(`Compra ${numCompra} registrada exitosamente`);
      await logAudit(supabase, { modulo: 'Compras', entidad: 'Compra', accion: 'crear', descripcion: `Registró la compra ${numCompra} (${moneda} ${calc.total})`, registroId: compra.id });
      setShowModal(false);
      setItems([]); setCuotas([]); setComprobanteFile(null);
      setForm(nuevoForm());
      load();
    } catch (e: any) {
      if (compraCreadaId) {
        // Compensación: revierte stock ya cargado y elimina la compra incompleta
        for (const d of movidos) {
          await moverStock(supabase, { productoId: d.producto_id, delta: -d.cantidad, tipo: 'ajuste', referenciaTipo: 'compra_revertida', notas: 'Reversión por error al guardar', numeroLote: d.numero_lote }).catch(() => undefined);
        }
        await supabase.from('compras').delete().eq('id', compraCreadaId);
        load();
      }
      toast.error(getErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function cargarDetalle(id: string) {
    const { data } = await supabase.from('compras')
      .select('*, proveedores(*), compra_items(*, productos(nombre, sku)), compra_cuotas(*), compra_pagos(*)')
      .eq('id', id).single();
    const { data: ncs } = await supabase.from('nota_credito_compra_aplicaciones').select('monto, notas_credito_compra(numero, estado)').eq('compra_id', id);
    if (data) (data as any).nc_aplicadas = (ncs || []).filter((n: any) => n.notas_credito_compra?.estado !== 'anulada');
    setDetalle(data as Compra);
  }

  async function openDetalle(c: Compra) { await cargarDetalle(c.id); }

  async function handleDelete(compraId: string) {
    const { data: compra, error } = await supabase.from('compras')
      .select('id, numero, compra_items(producto_id, numero_lote, cantidad), compra_pagos(id, estado)').eq('id', compraId).single();
    if (error || !compra) { toast.error(error?.message || 'No se pudo cargar la compra'); return; }
    if (((compra as any).compra_pagos || []).some((p: any) => p.estado === 'registrado')) {
      toast.error('La compra tiene pagos registrados. Anulá los pagos antes de eliminarla.'); return;
    }
    if (!window.confirm('¿Eliminar esta compra? Se revertirá el stock cargado por la compra.')) return;
    const itemsCompra = ((compra as any).compra_items || []) as { producto_id: string; numero_lote: string | null; cantidad: number }[];
    const productQty = itemsCompra.reduce((acc: Record<string, number>, item) => {
      acc[item.producto_id] = roundTo((acc[item.producto_id] || 0) + Number(item.cantidad), DECIMALES_CANTIDAD);
      return acc;
    }, {});
    for (const [productoId, cantidad] of Object.entries(productQty)) {
      const { data: producto } = await supabase.from('productos').select('stock_actual').eq('id', productoId).single();
      if ((Number(producto?.stock_actual) || 0) < cantidad) {
        toast.error('No se puede eliminar la compra porque el stock actual ya fue consumido');
        return;
      }
    }
    try {
      for (const item of itemsCompra) {
        await moverStock(supabase, {
          productoId: item.producto_id, delta: -Number(item.cantidad), tipo: 'ajuste',
          referenciaTipo: 'compra_eliminada', referenciaId: null, notas: `Eliminación de compra ${(compra as any).numero}`,
          numeroLote: item.numero_lote,
        });
      }
    } catch (e) { toast.error(getErrorMessage(e) || 'No se pudo revertir el stock'); return; }
    const { error: deleteError } = await supabase.from('compras').delete().eq('id', compraId);
    if (deleteError) { toast.error(deleteError.message || 'No se pudo eliminar la compra'); load(); return; }
    await logAudit(supabase, { modulo: 'Compras', entidad: 'Compra', accion: 'borrar', descripcion: `Eliminó la compra ${(compra as any).numero}`, registroId: compraId });
    toast.success('Compra eliminada');
    load();
  }

  // ---------- Pagos de cuotas ----------
  function abrirPago(cuota: CompraCuota | null) {
    if (!detalle) return;
    const m = detalle.moneda || 'GS';
    const pendiente = cuota ? roundMoneda(Number(cuota.monto) - Number(cuota.monto_pagado), m) : Number(detalle.saldo_pendiente);
    setPagoForm({ cuota, monto: decimalToInput(pendiente, decimalesMoneda(m)), fecha: hoyISO(), medio_pago: 'efectivo', referencia: '' });
  }

  async function registrarPago() {
    if (!detalle || !pagoForm) return;
    const m = detalle.moneda || 'GS';
    const monto = roundMoneda(parseDecimal(pagoForm.monto), m);
    const saldo = Number(detalle.saldo_pendiente);
    const pendienteCuota = pagoForm.cuota ? roundMoneda(Number(pagoForm.cuota.monto) - Number(pagoForm.cuota.monto_pagado), m) : saldo;
    if (monto <= 0) { toast.error('El monto del pago debe ser mayor a 0'); return; }
    if (monto > pendienteCuota) { toast.error(`El pago no puede superar el saldo de la cuota (${formatMontoMoneda(pendienteCuota, m)})`); return; }
    if (monto > saldo) { toast.error(`El pago no puede superar el saldo de la compra (${formatMontoMoneda(saldo, m)})`); return; }
    if (!pagoForm.fecha) { toast.error('La fecha del pago es obligatoria'); return; }
    setSavingPago(true);
    try {
      const { error } = await supabase.from('compra_pagos').insert({
        compra_id: detalle.id, cuota_id: pagoForm.cuota?.id || null, fecha: pagoForm.fecha, monto, moneda: m,
        medio_pago: pagoForm.medio_pago, referencia: pagoForm.referencia.trim() || null,
      });
      if (error) throw error;
      if (pagoForm.cuota) {
        const pagado = roundMoneda(Number(pagoForm.cuota.monto_pagado) + monto, m);
        const { error: e2 } = await supabase.from('compra_cuotas').update({
          monto_pagado: pagado,
          estado: pagado >= Number(pagoForm.cuota.monto) ? 'pagada' : pagoForm.cuota.estado,
          fecha_pago: pagado >= Number(pagoForm.cuota.monto) ? pagoForm.fecha : null,
        }).eq('id', pagoForm.cuota.id);
        if (e2) throw e2;
      }
      const nuevoSaldo = roundMoneda(saldo - monto, m);
      const { error: e3 } = await supabase.from('compras').update({ saldo_pendiente: nuevoSaldo, estado: estadoCompraPorSaldo(Number(detalle.total), nuevoSaldo, m) }).eq('id', detalle.id);
      if (e3) throw e3;
      await logAudit(supabase, { modulo: 'Compras', entidad: 'Pago de compra', accion: 'crear', descripcion: `Registró pago ${formatMontoMoneda(monto, m)} de la compra ${detalle.numero}`, registroId: detalle.id });
      toast.success('Pago registrado');
      setPagoForm(null);
      await cargarDetalle(detalle.id);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'No se pudo registrar el pago');
    } finally {
      setSavingPago(false);
    }
  }

  async function anularPago(pago: CompraPago) {
    if (!detalle || !window.confirm('¿Anular este pago? El saldo de la compra y de la cuota se restituirán.')) return;
    const m = detalle.moneda || 'GS';
    try {
      const { error } = await supabase.from('compra_pagos').update({ estado: 'anulado' }).eq('id', pago.id);
      if (error) throw error;
      if (pago.cuota_id) {
        const cuota = detalle.compra_cuotas?.find(c => c.id === pago.cuota_id);
        if (cuota) {
          await supabase.from('compra_cuotas').update({
            monto_pagado: Math.max(0, roundMoneda(Number(cuota.monto_pagado) - Number(pago.monto), m)),
            estado: cuota.estado === 'anulada' ? 'anulada' : 'pendiente', fecha_pago: null,
          }).eq('id', cuota.id);
        }
      }
      const nuevoSaldo = Math.min(Number(detalle.total), roundMoneda(Number(detalle.saldo_pendiente) + Number(pago.monto), m));
      await supabase.from('compras').update({ saldo_pendiente: nuevoSaldo, estado: estadoCompraPorSaldo(Number(detalle.total), nuevoSaldo, m) }).eq('id', detalle.id);
      await logAudit(supabase, { modulo: 'Compras', entidad: 'Pago de compra', accion: 'anular', descripcion: `Anuló un pago de la compra ${detalle.numero}`, registroId: detalle.id });
      toast.success('Pago anulado');
      await cargarDetalle(detalle.id);
      load();
    } catch (e) { toast.error(getErrorMessage(e) || 'No se pudo anular el pago'); }
  }

  async function anularCuota(cuota: CompraCuota) {
    if (!detalle) return;
    if (Number(cuota.monto_pagado) > 0) { toast.error('La cuota tiene pagos aplicados. Anulá primero los pagos.'); return; }
    if (!window.confirm(`¿Anular la cuota ${cuota.numero_cuota}? El saldo de la compra se reducirá en ${formatMontoMoneda(cuota.monto, detalle.moneda)}.`)) return;
    const m = detalle.moneda || 'GS';
    try {
      const { error } = await supabase.from('compra_cuotas').update({ estado: 'anulada' }).eq('id', cuota.id);
      if (error) throw error;
      const nuevoSaldo = Math.max(0, roundMoneda(Number(detalle.saldo_pendiente) - Number(cuota.monto), m));
      await supabase.from('compras').update({ saldo_pendiente: nuevoSaldo, estado: estadoCompraPorSaldo(Number(detalle.total), nuevoSaldo, m) }).eq('id', detalle.id);
      await logAudit(supabase, { modulo: 'Compras', entidad: 'Cuota de compra', accion: 'anular', descripcion: `Anuló la cuota ${cuota.numero_cuota} de la compra ${detalle.numero}`, registroId: detalle.id });
      toast.success('Cuota anulada');
      await cargarDetalle(detalle.id);
      load();
    } catch (e) { toast.error(getErrorMessage(e) || 'No se pudo anular la cuota'); }
  }

  const filteredRaw = compras.filter(c => {
    const q = search.toLowerCase();
    const okText = c.numero.toLowerCase().includes(q) ||
      (c as any).proveedores?.nombre?.toLowerCase().includes(q) ||
      (c.numero_factura || '').toLowerCase().includes(q);
    return okText && (!filtroEstado || c.estado === filtroEstado) && (!filtroMoneda || (c.moneda || 'GS') === filtroMoneda);
  }).map(c => ({ ...c, proveedor_nombre: (c as any).proveedores?.nombre || '' }));
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total: totalReg } = usePagination(filteredSorted);

  async function exportarExcel() {
    if (filteredRaw.length === 0) { toast.error('Sin datos para exportar'); return; }
    await descargarExcel('compras', 'Compras', filteredRaw.map(c => ({
      'N° compra': c.numero, Fecha: c.fecha, Proveedor: c.proveedor_nombre || '', 'N° comprobante': c.numero_factura || '',
      Condición: c.condicion_pago, Moneda: c.moneda || 'GS', 'Tipo de cambio': c.tipo_cambio ?? '',
      Subtotal: Number(c.subtotal), 'IVA incluido': Number(c.iva_total || 0), Total: Number(c.total),
      Pagado: roundMoneda(Number(c.total) - Number(c.saldo_pendiente), c.moneda || 'GS'), Saldo: Number(c.saldo_pendiente),
      'Cuotas': c.cantidad_cuotas || 1, Estado: c.estado,
    })));
  }

  function imprimirCompra(c: Compra) {
    const m = c.moneda || 'GS';
    const filas = (c.compra_items || []).map(i => `<tr><td>${escapeHtml(i.descripcion)}</td><td>${escapeHtml(labelTipoControl(i.tipo_control))}</td><td>${escapeHtml(i.numero_lote || '-')}</td><td>${i.fecha_vencimiento ? escapeHtml(formatDate(i.fecha_vencimiento)) : '-'}</td><td class="r">${formatCantidad(i.cantidad)}</td><td class="r">${formatMontoMoneda(i.precio_unitario, m)}</td><td class="r">${formatMontoMoneda(i.subtotal, m)}</td></tr>`).join('');
    const cuotasHtml = (c.compra_cuotas || []).length
      ? `<h3>Cuotas</h3><table><tr><th>#</th><th>Vencimiento</th><th>Monto</th><th>Pagado</th><th>Estado</th></tr>${(c.compra_cuotas || []).sort((a, b) => a.numero_cuota - b.numero_cuota).map(q => `<tr><td>${q.numero_cuota}</td><td>${formatDate(q.fecha_vencimiento)}</td><td class="r">${formatMontoMoneda(q.monto, m)}</td><td class="r">${formatMontoMoneda(q.monto_pagado, m)}</td><td>${estadoEfectivoCuota(q)}</td></tr>`).join('')}</table>` : '';
    const ok = imprimirDocumento(`Compra ${c.numero}`, `<h1>Compra ${escapeHtml(c.numero)} (${m})</h1>
<div class="meta"><div>Proveedor: <b>${escapeHtml((c as any).proveedores?.nombre || '-')}</b></div><div>Fecha: <b>${formatDate(c.fecha)}</b></div>
<div>Comprobante: <b>${escapeHtml(c.numero_factura || c.comprobante_nombre || '-')}</b></div><div>Condición: <b>${escapeHtml(c.condicion_pago)}</b></div>
<div>Moneda: <b>${m}</b></div><div>Tipo de cambio: <b>${c.tipo_cambio ? c.tipo_cambio : '-'}</b></div></div>
<table><tr><th>Producto</th><th>Control</th><th>Lote</th><th>Vence</th><th>Cant.</th><th>P. unit.</th><th>Subtotal</th></tr>${filas}</table>
<p class="r">IVA incluido: <b>${formatMontoMoneda(c.iva_total || 0, m)}</b><br/>Total: <b>${formatMontoMoneda(c.total, m)}</b><br/>Saldo: <b>${formatMontoMoneda(c.saldo_pendiente, m)}</b></p>${cuotasHtml}`);
    if (!ok) toast.error('El navegador bloqueó la ventana de impresión');
  }

  const detalleMoneda = detalle?.moneda || 'GS';
  const ncAplicadas: number = ((detalle as any)?.nc_aplicadas || []).reduce((s: number, n: any) => s + Number(n.monto), 0);
  const pagosVigentes = (detalle?.compra_pagos || []).filter(p => p.estado === 'registrado');
  const totalPagado = roundMoneda(pagosVigentes.reduce((s, p) => s + Number(p.monto), 0), detalleMoneda);

  return (
    <>
      <Header title="Compras" subtitle="Registro de compras a proveedores (GS / USD)" />
      <div className="p-4 md:p-6 space-y-4">
        {(schemaCompatNumeroFactura || schemaCompatMoneda) && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Falta ejecutar la migración 022 (moneda, comprobante, cuotas y notas de crédito). Podés consultar compras, pero no registrar nuevas hasta aplicarla.
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-3 justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Buscar N°, comprobante o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="parcial">Parcial</option>
              <option value="pagado">Pagado</option>
              <option value="anulado">Anulado</option>
            </select>
            <select className="input w-auto" value={filtroMoneda} onChange={e => setFiltroMoneda(e.target.value)}>
              <option value="">GS y USD</option>
              <option value="GS">Solo GS</option>
              <option value="USD">Solo USD</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button onClick={exportarExcel} className="btn-secondary flex items-center gap-2"><FileSpreadsheet className="w-4 h-4" /> Excel</button>
            <button onClick={abrirNueva} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva compra
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin compras registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <SortableTh label="N°" sortKey="numero" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Proveedor" sortKey="proveedor_nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Comprobante" sortKey="numero_factura" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Condición" sortKey="condicion_pago" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Moneda" sortKey="moneda" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Total" sortKey="total" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Saldo" sortKey="saldo_pendiente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Estado" sortKey="estado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{c.numero}</td>
                      <td className="table-cell text-xs">{formatDate(c.fecha)}</td>
                      <td className="table-cell">{(c as any).proveedores?.nombre || 'Sin proveedor'}</td>
                      <td className="table-cell text-xs font-mono">{c.numero_factura || (c.comprobante_url ? 'Archivo adjunto' : '-')}</td>
                      <td className="table-cell"><span className={`badge ${estadoBadgeClass(c.condicion_pago)}`}>{c.condicion_pago}</span></td>
                      <td className="table-cell text-xs font-semibold">{c.moneda || 'GS'}</td>
                      <td className="table-cell font-semibold">{formatMontoMoneda(c.total, c.moneda)}</td>
                      <td className="table-cell">{c.saldo_pendiente > 0 ? <span className="text-red-500 font-semibold">{formatMontoMoneda(c.saldo_pendiente, c.moneda)}</span> : <span className="text-emerald-500">{formatMontoMoneda(0, c.moneda)}</span>}</td>
                      <td className="table-cell"><span className={`badge ${estadoBadgeClass(c.estado)}`}>{estadoLabel(c.estado)}</span></td>
                      <td className="table-cell">
                        <button onClick={() => openDetalle(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Ver detalle">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500" title="Eliminar">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={totalReg} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>

      <ProveedorRapidoModal
        open={showProveedorModal}
        onClose={() => setShowProveedorModal(false)}
        onCreated={p => {
          setProveedores(prev => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
          setForm(f => ({ ...f, proveedor_id: p.id }));
          setShowProveedorModal(false);
        }}
      />

      {/* Modal nueva compra */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nueva Compra</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="col-span-2 md:col-span-1">
                  <div className="flex items-center justify-between">
                    <label className="label">Proveedor {form.condicion_pago === 'credito' ? '*' : ''}</label>
                    <button type="button" onClick={() => setShowProveedorModal(true)} className="text-xs text-blue-600 hover:underline flex items-center gap-1 mb-1"><UserPlus className="w-3 h-3" /> Nuevo proveedor</button>
                  </div>
                  <SearchSelect
                    options={proveedores.map(p => ({ value: p.id, label: p.nombre, sublabel: p.documento || undefined }))}
                    value={form.proveedor_id}
                    onChange={v => setForm(f => ({ ...f, proveedor_id: v }))}
                    placeholder={form.condicion_pago === 'credito' ? 'Seleccionar proveedor' : 'Sin proveedor'}
                  />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={form.moneda} onChange={e => cambiarMoneda(e.target.value as Moneda)}>
                    <option value="GS">Guaraníes (GS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                {moneda === 'USD' && (
                  <div>
                    <label className="label">Tipo de cambio (Gs. por USD)</label>
                    <input inputMode="decimal" className="input" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: sanitizeDecimalInput(e.target.value, DECIMALES_TIPO_CAMBIO) }))} placeholder="Ingresá el tipo de cambio" />
                  </div>
                )}
                <div>
                  <label className="label">Condición pago</label>
                  <select className="input" value={form.condicion_pago} onChange={e => { setForm(f => ({ ...f, condicion_pago: e.target.value as 'contado' | 'credito' })); setCuotas([]); }}>
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito / en cuotas</option>
                  </select>
                </div>
                <div>
                  <label className="label">N° Remito</label>
                  <input className="input" value={form.numero_remito} onChange={e => setForm(f => ({ ...f, numero_remito: toDigitsOnly(e.target.value) }))} placeholder="000100000123" />
                </div>
                <div>
                  <label className="label">Compra de servicios ({moneda === 'USD' ? 'USD' : 'Gs.'})</label>
                  <input inputMode="decimal" className="input" value={form.compra_servicios} onChange={e => { setForm(f => ({ ...f, compra_servicios: sanitizeDecimalInput(e.target.value, decMoneda) })); setCuotas([]); }} placeholder="0" />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <ComprobanteInput
                    label="Comprobante (factura)"
                    numero={form.numero_factura}
                    onNumero={v => setForm(f => ({ ...f, numero_factura: toDigitsOnly(v) }))}
                    file={comprobanteFile}
                    onFile={setComprobanteFile}
                    numeroPlaceholder="N° de factura (0010000001)"
                  />
                </div>
                <div className="col-span-2 md:col-span-3">
                  <label className="label">Notas</label>
                  <input className="input" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Productos</h3>
                  <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                {items.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                    Agregá productos a la compra
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-sm items-end">
                          <div className="sm:col-span-3">
                            <label className="label text-xs">Producto</label>
                            <SearchSelect
                              options={productos.map(p => ({ value: p.id, label: p.nombre, sublabel: p.sku }))}
                              value={item.producto_id}
                              onChange={v => updateItem(idx, 'producto_id', v)}
                              placeholder="Seleccionar..."
                            />
                            {item.historial && item.historial.length > 0 && (
                              <div className="mt-1 text-xs text-gray-400">
                                Últ. precios ({moneda}): {item.historial.slice(0, 3).map((h, i) => <span key={i} className="mr-2">{formatMontoMoneda(h.precio, moneda)}</span>)}
                              </div>
                            )}
                          </div>
                          <div className="sm:col-span-3">
                            <label className="label text-xs">Tipo de control</label>
                            <select className="input py-1.5" value={item.tipo_control} onChange={e => updateItem(idx, 'tipo_control', e.target.value)}>
                              {TIPOS_CONTROL.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          {requiereLote(item.tipo_control) && (
                            <div className="sm:col-span-2">
                              <label className="label text-xs">N° Lote <span className="text-red-500">*</span></label>
                              <input className="input py-1.5" value={item.numero_lote} onChange={e => updateItem(idx, 'numero_lote', e.target.value)} placeholder="L2024-001" />
                            </div>
                          )}
                          {requiereVencimiento(item.tipo_control) && (
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Vencimiento <span className="text-red-500">*</span></label>
                              <input type="date" className="input py-1.5" value={item.fecha_vencimiento} onChange={e => updateItem(idx, 'fecha_vencimiento', e.target.value)} />
                            </div>
                          )}
                          <div>
                            <label className="label text-xs">Cantidad</label>
                            <input inputMode="decimal" className="input py-1.5" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', e.target.value)} placeholder="0" />
                          </div>
                          <div>
                            <label className="label text-xs">Precio unit. c/IVA ({moneda})</label>
                            <input inputMode="decimal" className="input py-1.5" value={item.precio_unitario} onChange={e => updateItem(idx, 'precio_unitario', e.target.value)} placeholder={moneda === 'USD' ? '12.50' : '0'} />
                          </div>
                          <div>
                            <label className="label text-xs">IVA %</label>
                            <select className="input py-1.5" value={item.tasa_iva} onChange={e => updateItem(idx, 'tasa_iva', Number(e.target.value))}>
                              <option value={10}>10%</option>
                              <option value={5}>5%</option>
                              <option value={0}>Exento</option>
                            </select>
                          </div>
                          <div className="flex items-end gap-1">
                            <div className="flex-1">
                              <label className="label text-xs">Subtotal</label>
                              <div className="input py-1.5 bg-gray-100 dark:bg-gray-700 font-semibold text-xs">{formatMontoMoneda(calc.lineas[idx]?.subtotal, moneda)}</div>
                            </div>
                            <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <div className="text-right space-y-1 text-sm">
                    <p>Subtotal productos: <span className="font-semibold">{formatMontoMoneda(calc.subtotalItems, moneda)}</span></p>
                    {calc.servicios > 0 && <p>Compra de servicios: <span className="font-semibold">{formatMontoMoneda(calc.servicios, moneda)}</span></p>}
                    <p className="text-gray-500">IVA incluido: {formatMontoMoneda(calc.iva, moneda)}</p>
                    <p className="text-lg font-bold">Total ({moneda}): <span className="text-emerald-600">{formatMontoMoneda(calc.total, moneda)}</span></p>
                    {moneda === 'USD' && tipoCambioNum > 0 && <p className="text-xs text-gray-500">Equivalente: {formatMontoMoneda(Math.round(calc.total * tipoCambioNum), 'GS')}</p>}
                  </div>
                </div>
              </div>

              {form.condicion_pago === 'credito' && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-3 space-y-3">
                  <h3 className="font-semibold text-sm">Plan de cuotas</h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 items-end">
                    <div>
                      <label className="label text-xs">Cantidad de cuotas</label>
                      <input inputMode="numeric" className="input py-1.5" value={form.cantidad_cuotas} onChange={e => { setForm(f => ({ ...f, cantidad_cuotas: toDigitsOnly(e.target.value) })); setCuotas([]); }} />
                    </div>
                    <div>
                      <label className="label text-xs">Primer vencimiento</label>
                      <input type="date" className="input py-1.5" value={form.primera_cuota} onChange={e => { setForm(f => ({ ...f, primera_cuota: e.target.value })); setCuotas([]); }} />
                    </div>
                    <div>
                      <label className="label text-xs">Intervalo (días)</label>
                      <input inputMode="numeric" className="input py-1.5" value={form.plazo_dias} onChange={e => { setForm(f => ({ ...f, plazo_dias: toDigitsOnly(e.target.value) })); setCuotas([]); }} />
                    </div>
                    <button type="button" onClick={generarCuotas} className="btn-secondary text-xs py-2">Generar plan</button>
                  </div>
                  {cuotas.length > 0 && (
                    <>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="table-header">#</th><th className="table-header">Vencimiento</th><th className="table-header">Monto ({moneda})</th></tr></thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {cuotas.map((c, i) => (
                            <tr key={i}>
                              <td className="table-cell">{c.numero_cuota}</td>
                              <td className="table-cell"><input type="date" className="input py-1" value={c.fecha_vencimiento} onChange={e => editarCuota(i, 'fecha_vencimiento', e.target.value)} /></td>
                              <td className="table-cell"><input inputMode="decimal" className="input py-1" value={c.monto} onChange={e => editarCuota(i, 'monto', e.target.value)} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p className={`text-xs text-right ${sumaCuotas === calc.total ? 'text-emerald-600' : 'text-red-500'}`}>
                        Suma de cuotas: {formatMontoMoneda(sumaCuotas, moneda)} / Total: {formatMontoMoneda(calc.total, moneda)}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Compra {detalle.numero} <span className="text-xs text-gray-500">({detalleMoneda})</span></h2>
              <div className="flex items-center gap-3">
                <button onClick={() => imprimirCompra(detalle)} title="Imprimir / PDF"><Printer className="w-4 h-4" /></button>
                <button onClick={() => { setDetalle(null); setPagoForm(null); }}><X className="w-5 h-5" /></button>
              </div>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Proveedor:</span> <strong>{(detalle as any).proveedores?.nombre || '-'}</strong></div>
                <div><span className="text-gray-500">Fecha:</span> <strong>{formatDate(detalle.fecha)}</strong></div>
                <div><span className="text-gray-500">Condición:</span> <span className={`badge ml-1 ${estadoBadgeClass(detalle.condicion_pago)}`}>{detalle.condicion_pago}</span></div>
                <div><span className="text-gray-500">Estado:</span> <span className={`badge ml-1 ${estadoBadgeClass(detalle.estado)}`}>{detalle.estado}</span></div>
                <div><span className="text-gray-500">Moneda:</span> <strong>{detalleMoneda}</strong>{detalle.tipo_cambio ? <span className="text-gray-500"> · TC {detalle.tipo_cambio}</span> : null}</div>
                {detalle.numero_remito && <div><span className="text-gray-500">Remito:</span> <strong>{detalle.numero_remito}</strong></div>}
                {detalle.numero_factura && <div><span className="text-gray-500">Comprobante:</span> <strong>{detalle.numero_factura}</strong></div>}
                {detalle.comprobante_url && (
                  <div>
                    <button className="text-blue-600 hover:underline flex items-center gap-1" onClick={() => abrirComprobante(supabase, detalle.comprobante_url as string).catch(e => toast.error(getErrorMessage(e)))}>
                      <Paperclip className="w-3.5 h-3.5" /> {detalle.comprobante_nombre || 'Ver comprobante'}
                    </button>
                  </div>
                )}
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="table-header">Producto</th>
                      <th className="table-header">Control</th>
                      <th className="table-header">Lote</th>
                      <th className="table-header">Vence</th>
                      <th className="table-header">Cant.</th>
                      <th className="table-header">P.Unit.</th>
                      <th className="table-header">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {detalle.compra_items?.map(item => (
                      <tr key={item.id}>
                        <td className="table-cell">{item.descripcion}</td>
                        <td className="table-cell text-xs">{labelTipoControl(item.tipo_control)}</td>
                        <td className="table-cell font-mono text-xs">{item.numero_lote || '-'}</td>
                        <td className="table-cell text-xs">{item.fecha_vencimiento ? formatDate(item.fecha_vencimiento) : '-'}</td>
                        <td className="table-cell">{formatCantidad(item.cantidad)}</td>
                        <td className="table-cell">{formatMontoMoneda(item.precio_unitario, detalleMoneda)}</td>
                        <td className="table-cell font-semibold">{formatMontoMoneda(item.subtotal, detalleMoneda)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-right text-sm space-y-0.5">
                <p className="text-gray-500">IVA incluido: {formatMontoMoneda(detalle.iva_total || 0, detalleMoneda)}</p>
                <p className="font-bold text-lg">Total: {formatMontoMoneda(detalle.total, detalleMoneda)}</p>
                {detalle.condicion_pago === 'credito' && (
                  <>
                    <p>Pagado: <strong>{formatMontoMoneda(totalPagado, detalleMoneda)}</strong></p>
                    {ncAplicadas > 0 && <p>Notas de crédito aplicadas: <strong>{formatMontoMoneda(ncAplicadas, detalleMoneda)}</strong></p>}
                    <p>Saldo pendiente: <strong className="text-red-500">{formatMontoMoneda(detalle.saldo_pendiente, detalleMoneda)}</strong></p>
                  </>
                )}
              </div>

              {(detalle.compra_cuotas?.length || 0) > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Cuotas</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr><th className="table-header">#</th><th className="table-header">Vencimiento</th><th className="table-header">Monto</th><th className="table-header">Pagado</th><th className="table-header">Estado</th><th className="table-header"></th></tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {[...(detalle.compra_cuotas || [])].sort((a, b) => a.numero_cuota - b.numero_cuota).map(c => {
                        const est = estadoEfectivoCuota(c);
                        return (
                          <tr key={c.id}>
                            <td className="table-cell">{c.numero_cuota}</td>
                            <td className="table-cell text-xs">{formatDate(c.fecha_vencimiento)}</td>
                            <td className="table-cell">{formatMontoMoneda(c.monto, detalleMoneda)}</td>
                            <td className="table-cell">{formatMontoMoneda(c.monto_pagado, detalleMoneda)}</td>
                            <td className="table-cell"><span className={`badge ${est === 'pagada' ? estadoBadgeClass('pagado') : est === 'vencida' ? estadoBadgeClass('vencido') : est === 'anulada' ? estadoBadgeClass('anulado') : estadoBadgeClass('pendiente')}`}>{est}</span></td>
                            <td className="table-cell text-right whitespace-nowrap">
                              {(c.estado === 'pendiente') && (
                                <>
                                  <button className="text-xs text-blue-600 hover:underline mr-2 inline-flex items-center gap-1" onClick={() => abrirPago(c)}><Wallet className="w-3.5 h-3.5" /> Pagar</button>
                                  <button className="text-xs text-red-500 hover:underline inline-flex items-center gap-1" onClick={() => anularCuota(c)}><Ban className="w-3.5 h-3.5" /> Anular</button>
                                </>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
              {detalle.condicion_pago === 'credito' && (detalle.compra_cuotas?.length || 0) === 0 && Number(detalle.saldo_pendiente) > 0 && (
                <button className="btn-secondary text-xs" onClick={() => abrirPago(null)}>Registrar pago</button>
              )}

              {pagoForm && (
                <div className="border border-blue-200 dark:border-blue-900 rounded-lg p-3 space-y-3 bg-blue-50/40 dark:bg-blue-950/20">
                  <h4 className="font-semibold text-sm">Registrar pago {pagoForm.cuota ? `de la cuota ${pagoForm.cuota.numero_cuota}` : ''}</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div>
                      <label className="label text-xs">Monto ({detalleMoneda})</label>
                      <input inputMode="decimal" className="input py-1.5" value={pagoForm.monto} onChange={e => setPagoForm(f => f && ({ ...f, monto: sanitizeDecimalInput(e.target.value, decimalesMoneda(detalleMoneda)) }))} />
                    </div>
                    <div>
                      <label className="label text-xs">Fecha</label>
                      <input type="date" className="input py-1.5" value={pagoForm.fecha} onChange={e => setPagoForm(f => f && ({ ...f, fecha: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label text-xs">Medio</label>
                      <select className="input py-1.5" value={pagoForm.medio_pago} onChange={e => setPagoForm(f => f && ({ ...f, medio_pago: e.target.value }))}>
                        {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label text-xs">Referencia</label>
                      <input className="input py-1.5" value={pagoForm.referencia} onChange={e => setPagoForm(f => f && ({ ...f, referencia: e.target.value }))} />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button className="btn-secondary text-xs" onClick={() => setPagoForm(null)}>Cancelar</button>
                    <button className="btn-primary text-xs flex items-center gap-1" disabled={savingPago} onClick={registrarPago}>{savingPago && <Loader2 className="w-3 h-3 animate-spin" />} Confirmar pago</button>
                  </div>
                </div>
              )}

              {(detalle.compra_pagos?.length || 0) > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Pagos</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800"><tr><th className="table-header">Fecha</th><th className="table-header">Monto</th><th className="table-header">Medio</th><th className="table-header">Estado</th><th className="table-header"></th></tr></thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {detalle.compra_pagos?.map(p => (
                        <tr key={p.id} className={p.estado === 'anulado' ? 'opacity-50' : ''}>
                          <td className="table-cell text-xs">{formatDate(p.fecha)}</td>
                          <td className="table-cell">{formatMontoMoneda(p.monto, p.moneda)}</td>
                          <td className="table-cell text-xs">{p.medio_pago}{p.referencia ? ` · ${p.referencia}` : ''}</td>
                          <td className="table-cell text-xs">{p.estado}</td>
                          <td className="table-cell text-right">{p.estado === 'registrado' && <button className="text-xs text-red-500 hover:underline" onClick={() => anularPago(p)}>Anular</button>}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
