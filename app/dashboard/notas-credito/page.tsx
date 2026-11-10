'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { SearchSelect } from '@/components/SearchSelect';
import { ComprobanteInput } from '@/components/ComprobanteInput';
import { ProveedorRapidoModal } from '@/components/ProveedorRapidoModal';
import { subirComprobante, abrirComprobante } from '@/lib/comprobantes';
import { moverStock } from '@/lib/stock';
import { aplicarCreditoACompra, revertirCreditoCompra } from '@/lib/compras-saldos';
import { descargarExcel } from '@/lib/export';
import {
  formatDate, getErrorMessage, generarNumero, hoyISO, sanitizeDecimalInput, parseDecimal, roundTo, roundMoneda,
  formatCantidad, formatMontoMoneda, ivaIncluido, DECIMALES_CANTIDAD, DECIMALES_TIPO_CAMBIO,
  MOTIVOS_NC, requiereLote, tipoControlDeProducto, toDigitsOnly,
} from '@/lib/utils';
import { Plus, Search, X, Loader2, Eye, Ban, Link2, Download, Paperclip, UserPlus, Trash2, FileMinus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Proveedor } from '@/lib/types';
import { usePagination, Pagination } from '@/components/TableUtils';

interface ProductoOpt { id: string; nombre: string; sku?: string; precio_costo?: number; permite_decimales?: boolean; tipo_control?: string | null; control_lote?: boolean | null; }
interface LoteOpt { id: string; numero_lote: string; stock_actual: number; fecha_vencimiento?: string | null; }
interface CompraOpt { id: string; numero: string; numero_factura?: string | null; proveedor_id: string; moneda: 'GS' | 'USD'; saldo_pendiente: number; total: number; }
interface ItemForm { producto_id: string; descripcion: string; cantidad: string; precio: string; tasa: string; lote_id: string; }

const NC_SELECT = '*, proveedores(nombre), compras(numero, numero_factura)';
const itemVacio = (): ItemForm => ({ producto_id: '', descripcion: '', cantidad: '1', precio: '', tasa: '10', lote_id: '' });
const labelMotivo = (m: string) => MOTIVOS_NC.find(x => x.value === m)?.label || m;

export default function NotasCreditoPage() {
  const supabase = createClient();
  const [ncs, setNcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [search, setSearch] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fMotivo, setFMotivo] = useState('');
  const [fMoneda, setFMoneda] = useState('');
  const [fProveedor, setFProveedor] = useState('');
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<ProductoOpt[]>([]);
  const [compras, setCompras] = useState<CompraOpt[]>([]);
  const [lotesPorProducto, setLotesPorProducto] = useState<Record<string, LoteOpt[]>>({});

  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showProvRapido, setShowProvRapido] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ItemForm[]>([itemVacio()]);
  const [form, setForm] = useState({
    proveedor_id: '', compra_id: '', moneda: 'GS' as 'GS' | 'USD', tipo_cambio: '', motivo: 'devolucion',
    fecha_emision: hoyISO(), fecha_registro: hoyISO(), numero_comprobante: '', afecta_stock: true, notas: '',
  });

  const [detalle, setDetalle] = useState<any | null>(null);
  const [asociar, setAsociar] = useState<{ nc: any; compraId: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('notas_credito_compra').select(NC_SELECT).order('created_at', { ascending: false }).limit(500);
    if (error) {
      setFaltaMigracion(true);
      setNcs([]);
    } else {
      setFaltaMigracion(false);
      setNcs(data || []);
    }
    setLoading(false);
  }, [supabase]);

  const loadCompras = useCallback(async () => {
    const { data } = await supabase.from('compras').select('id, numero, numero_factura, proveedor_id, moneda, saldo_pendiente, total').gt('saldo_pendiente', 0).order('created_at', { ascending: false });
    setCompras(((data || []) as any[]).map(c => ({ ...c, moneda: c.moneda || 'GS' })));
  }, [supabase]);

  useEffect(() => {
    load();
    loadCompras();
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
    (async () => {
      const full = await supabase.from('productos').select('id, nombre, sku, precio_costo, permite_decimales, tipo_control, control_lote').eq('activo', true).order('nombre');
      if (!full.error) { setProductos(full.data as ProductoOpt[] || []); return; }
      const legacy = await supabase.from('productos').select('id, nombre, sku, precio_costo, control_lote').eq('activo', true).order('nombre');
      setProductos(legacy.data as ProductoOpt[] || []);
    })();
  }, [load, loadCompras, supabase]);

  const prodMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const comprasProveedor = useMemo(
    () => compras.filter(c => c.proveedor_id === form.proveedor_id && c.moneda === form.moneda),
    [compras, form.proveedor_id, form.moneda],
  );

  function resetForm() {
    setFile(null);
    setItems([itemVacio()]);
    setForm({ proveedor_id: '', compra_id: '', moneda: 'GS', tipo_cambio: '', motivo: 'devolucion', fecha_emision: hoyISO(), fecha_registro: hoyISO(), numero_comprobante: '', afecta_stock: true, notas: '' });
  }

  async function cargarLotes(productoId: string) {
    if (lotesPorProducto[productoId]) return;
    const { data } = await supabase.from('lotes').select('id, numero_lote, stock_actual, fecha_vencimiento').eq('producto_id', productoId).gt('stock_actual', 0).order('fecha_vencimiento', { ascending: true, nullsFirst: false });
    setLotesPorProducto(prev => ({ ...prev, [productoId]: (data || []) as LoteOpt[] }));
  }

  function setItem(i: number, patch: Partial<ItemForm>) {
    setItems(prev => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));
  }

  function elegirProducto(i: number, id: string) {
    const p = prodMap.get(id);
    setItem(i, { producto_id: id, descripcion: p?.nombre || '', precio: p?.precio_costo ? String(p.precio_costo) : '', lote_id: '' });
    if (id) cargarLotes(id);
  }

  function cantidadDecimales(i: number) {
    const p = prodMap.get(items[i].producto_id);
    return p && p.permite_decimales === false ? 0 : DECIMALES_CANTIDAD;
  }

  const calculo = useMemo(() => {
    const lineas = items.map(it => {
      const subtotal = roundMoneda(parseDecimal(it.cantidad) * parseDecimal(it.precio), form.moneda);
      const iva = ivaIncluido(subtotal, parseDecimal(it.tasa), form.moneda);
      return { subtotal, iva };
    });
    const total = roundMoneda(lineas.reduce((s, l) => s + l.subtotal, 0), form.moneda);
    const iva = roundMoneda(lineas.reduce((s, l) => s + l.iva, 0), form.moneda);
    return { lineas, total, iva, neto: roundMoneda(total - iva, form.moneda) };
  }, [items, form.moneda]);

  async function siguienteNumero() {
    const { data } = await supabase.from('notas_credito_compra').select('numero').order('created_at', { ascending: false }).limit(1);
    const ultimo = data?.[0]?.numero ? parseInt(String(data[0].numero).replace(/\D/g, ''), 10) || 0 : 0;
    return generarNumero('NCC', ultimo + 1);
  }

  async function handleSave() {
    if (!form.proveedor_id) { toast.error('Seleccioná un proveedor'); return; }
    if (!form.numero_comprobante.trim() && !file) { toast.error('El comprobante es obligatorio: ingresá el número o adjuntá el archivo'); return; }
    if (!form.fecha_emision) { toast.error('La fecha de emisión es obligatoria'); return; }
    if (form.fecha_registro && form.fecha_emision > form.fecha_registro) { toast.error('La fecha de emisión no puede ser posterior a la de registro'); return; }
    if (form.tipo_cambio && parseDecimal(form.tipo_cambio) <= 0) { toast.error('El tipo de cambio debe ser mayor a 0'); return; }
    const validos = items.filter(it => it.producto_id || it.descripcion.trim() || it.precio);
    if (validos.length === 0) { toast.error('Agregá al menos un ítem'); return; }
    const compraSel = form.compra_id ? compras.find(c => c.id === form.compra_id) : undefined;

    for (const it of validos) {
      const nombre = it.descripcion.trim() || 'ítem';
      if (!it.descripcion.trim() && !it.producto_id) { toast.error('Cada ítem necesita producto o descripción'); return; }
      if (parseDecimal(it.cantidad) <= 0) { toast.error(`La cantidad de "${nombre}" debe ser mayor a 0`); return; }
      if (parseDecimal(it.precio) <= 0) { toast.error(`El precio de "${nombre}" debe ser mayor a 0`); return; }
      if (form.afecta_stock) {
        if (!it.producto_id) { toast.error(`Para devolver stock, "${nombre}" debe ser un producto`); return; }
        const p = prodMap.get(it.producto_id);
        const lotes = lotesPorProducto[it.producto_id] || [];
        if (p && lotes.length > 0 && (requiereLote(tipoControlDeProducto(p)) || tipoControlDeProducto(p) === 'solo_vencimiento') && !it.lote_id) {
          toast.error(`Seleccioná el lote a devolver de "${nombre}"`); return;
        }
        if (it.lote_id) {
          const lote = lotes.find(l => l.id === it.lote_id);
          if (lote && parseDecimal(it.cantidad) > Number(lote.stock_actual)) { toast.error(`El lote ${lote.numero_lote} solo tiene ${formatCantidad(lote.stock_actual)} unidades`); return; }
        }
      }
    }
    if (compraSel && calculo.total > compraSel.saldo_pendiente) {
      if (!window.confirm(`El total de la NC (${formatMontoMoneda(calculo.total, form.moneda)}) supera el saldo de la compra (${formatMontoMoneda(compraSel.saldo_pendiente, form.moneda)}). Se aplicará solo el saldo y el resto quedará como crédito a favor. ¿Continuar?`)) return;
    }

    setSaving(true);
    let ncId: string | null = null;
    const movidos: { producto_id: string; cantidad: number; lote_id: string | null }[] = [];
    try {
      const numero = await siguienteNumero();
      let comprobanteUrl: string | null = null;
      if (file) comprobanteUrl = await subirComprobante(supabase, file, 'notas-credito');
      const { data: nc, error } = await supabase.from('notas_credito_compra').insert({
        numero,
        numero_comprobante: toDigitsOnly(form.numero_comprobante) || form.numero_comprobante.trim() || null,
        comprobante_url: comprobanteUrl,
        comprobante_nombre: file?.name || null,
        proveedor_id: form.proveedor_id,
        compra_id: form.compra_id || null,
        fecha_emision: form.fecha_emision,
        fecha_registro: form.fecha_registro || hoyISO(),
        moneda: form.moneda,
        tipo_cambio: form.moneda === 'USD' && form.tipo_cambio ? parseDecimal(form.tipo_cambio) : null,
        motivo: form.motivo,
        afecta_stock: form.afecta_stock,
        subtotal: calculo.neto,
        iva_total: calculo.iva,
        total: calculo.total,
        notas: form.notas.trim() || null,
      }).select('id').single();
      if (error) throw error;
      ncId = nc.id;

      const filas = validos.map(it => {
        const sub = roundMoneda(parseDecimal(it.cantidad) * parseDecimal(it.precio), form.moneda);
        const lote = it.lote_id ? (lotesPorProducto[it.producto_id] || []).find(l => l.id === it.lote_id) : undefined;
        return {
          nota_credito_id: nc.id,
          producto_id: it.producto_id || null,
          lote_id: it.lote_id || null,
          numero_lote: lote?.numero_lote || null,
          descripcion: it.descripcion.trim() || prodMap.get(it.producto_id)?.nombre || 'Ítem',
          cantidad: roundTo(parseDecimal(it.cantidad), DECIMALES_CANTIDAD),
          precio_unitario: roundTo(parseDecimal(it.precio), 4),
          tasa_iva_porcentaje: parseDecimal(it.tasa),
          monto_iva: ivaIncluido(sub, parseDecimal(it.tasa), form.moneda),
          subtotal: sub,
        };
      });
      const { error: itErr } = await supabase.from('nota_credito_compra_items').insert(filas);
      if (itErr) throw itErr;

      if (form.afecta_stock) {
        for (const f of filas) {
          if (!f.producto_id) continue;
          await moverStock(supabase, {
            productoId: f.producto_id, delta: -f.cantidad, tipo: 'devolucion', referenciaTipo: 'nota_credito_compra',
            referenciaId: nc.id, notas: `NC recibida ${numero}`, loteId: f.lote_id,
          });
          movidos.push({ producto_id: f.producto_id, cantidad: f.cantidad, lote_id: f.lote_id });
        }
      }

      if (form.compra_id) {
        const r = await aplicarCreditoACompra(supabase, form.compra_id, calculo.total);
        if (r.aplicado > 0) {
          await supabase.from('nota_credito_compra_aplicaciones').insert({ nota_credito_id: nc.id, compra_id: form.compra_id, monto: r.aplicado, detalle_cuotas: r.detalle });
          await supabase.from('notas_credito_compra').update({ monto_aplicado: r.aplicado }).eq('id', nc.id);
        }
      }

      await logAudit(supabase, { modulo: 'Notas de crédito', entidad: 'NC compra', accion: 'crear', descripcion: `Registró la NC recibida ${numero} por ${formatMontoMoneda(calculo.total, form.moneda)}`, registroId: nc.id });
      toast.success(`NC ${numero} registrada`);
      setShowModal(false);
      resetForm();
      load();
      loadCompras();
    } catch (e) {
      if (ncId) {
        // Compensación: devuelve el stock ya movido y elimina la NC incompleta
        for (const m of movidos) {
          await moverStock(supabase, { productoId: m.producto_id, delta: m.cantidad, tipo: 'ajuste', referenciaTipo: 'nota_credito_revertida', notas: 'Reversión por error al guardar NC', loteId: m.lote_id }).catch(() => undefined);
        }
        await supabase.from('notas_credito_compra').delete().eq('id', ncId);
        load();
      }
      toast.error(getErrorMessage(e) || 'Error al guardar la nota de crédito');
    } finally {
      setSaving(false);
    }
  }

  async function verDetalle(nc: any) {
    const [{ data: its }, { data: aps }] = await Promise.all([
      supabase.from('nota_credito_compra_items').select('*').eq('nota_credito_id', nc.id),
      supabase.from('nota_credito_compra_aplicaciones').select('id, monto, compra_id, detalle_cuotas, compras(numero, numero_factura)').eq('nota_credito_id', nc.id),
    ]);
    setDetalle({ ...nc, items: its || [], aplicaciones: aps || [] });
  }

  async function anular(nc: any) {
    if (nc.estado === 'anulada') return;
    if (!window.confirm(`¿Anular la NC ${nc.numero}? Se revertirá el stock devuelto y los saldos aplicados.`)) return;
    try {
      const [{ data: its }, { data: aps }] = await Promise.all([
        supabase.from('nota_credito_compra_items').select('producto_id, lote_id, cantidad').eq('nota_credito_id', nc.id),
        supabase.from('nota_credito_compra_aplicaciones').select('id, compra_id, monto, detalle_cuotas').eq('nota_credito_id', nc.id),
      ]);
      if (nc.afecta_stock) {
        for (const it of (its || []) as any[]) {
          if (!it.producto_id) continue;
          await moverStock(supabase, { productoId: it.producto_id, delta: Number(it.cantidad), tipo: 'ajuste', referenciaTipo: 'nota_credito_anulada', referenciaId: nc.id, notas: `Anulación NC ${nc.numero}`, loteId: it.lote_id });
        }
      }
      for (const a of (aps || []) as any[]) {
        await revertirCreditoCompra(supabase, a.compra_id, Number(a.monto), a.detalle_cuotas || []);
      }
      await supabase.from('nota_credito_compra_aplicaciones').delete().eq('nota_credito_id', nc.id);
      const { error } = await supabase.from('notas_credito_compra').update({ estado: 'anulada', monto_aplicado: 0 }).eq('id', nc.id);
      if (error) throw error;
      await logAudit(supabase, { modulo: 'Notas de crédito', entidad: 'NC compra', accion: 'anular', descripcion: `Anuló la NC recibida ${nc.numero}`, registroId: nc.id });
      toast.success('NC anulada');
      setDetalle(null);
      load();
      loadCompras();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'No se pudo anular la NC');
    }
  }

  async function confirmarAsociar() {
    if (!asociar || !asociar.compraId) { toast.error('Seleccioná una compra'); return; }
    const { nc, compraId } = asociar;
    const pendiente = roundMoneda(Number(nc.total) - Number(nc.monto_aplicado), nc.moneda);
    try {
      const r = await aplicarCreditoACompra(supabase, compraId, pendiente);
      if (r.aplicado <= 0) { toast.error('La compra no tiene saldo pendiente para aplicar'); return; }
      await supabase.from('nota_credito_compra_aplicaciones').insert({ nota_credito_id: nc.id, compra_id: compraId, monto: r.aplicado, detalle_cuotas: r.detalle });
      await supabase.from('notas_credito_compra').update({ monto_aplicado: roundMoneda(Number(nc.monto_aplicado) + r.aplicado, nc.moneda), compra_id: nc.compra_id || compraId }).eq('id', nc.id);
      await logAudit(supabase, { modulo: 'Notas de crédito', entidad: 'NC compra', accion: 'editar', descripcion: `Aplicó ${formatMontoMoneda(r.aplicado, nc.moneda)} de la NC ${nc.numero} a una compra`, registroId: nc.id });
      toast.success(`Aplicado ${formatMontoMoneda(r.aplicado, nc.moneda)}`);
      setAsociar(null);
      load();
      loadCompras();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'No se pudo asociar la NC');
    }
  }

  const filtradas = ncs.filter(n => {
    const q = search.toLowerCase();
    return (!q || [n.numero, n.numero_comprobante, n.proveedores?.nombre, n.compras?.numero].some((v: any) => String(v || '').toLowerCase().includes(q)))
      && (!fEstado || n.estado === fEstado) && (!fMotivo || n.motivo === fMotivo) && (!fMoneda || n.moneda === fMoneda) && (!fProveedor || n.proveedor_id === fProveedor);
  });
  const { paginated, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filtradas);
  const vigentes = filtradas.filter(n => n.estado !== 'anulada');
  const totalGs = vigentes.filter(n => n.moneda !== 'USD').reduce((s, n) => s + Number(n.total), 0);
  const totalUsd = vigentes.filter(n => n.moneda === 'USD').reduce((s, n) => s + Number(n.total), 0);

  async function exportar() {
    if (filtradas.length === 0) { toast.error('No hay notas de crédito para exportar'); return; }
    await descargarExcel(`notas_credito_compra_${hoyISO()}.xlsx`, 'NC recibidas', filtradas.map(n => ({
      Número: n.numero,
      Comprobante: n.numero_comprobante || '',
      Proveedor: n.proveedores?.nombre || '',
      'Compra asociada': n.compras?.numero || '',
      'Fecha emisión': n.fecha_emision,
      'Fecha registro': n.fecha_registro,
      Motivo: labelMotivo(n.motivo),
      Moneda: n.moneda,
      'Tipo de cambio': n.tipo_cambio ?? '',
      Subtotal: n.subtotal,
      IVA: n.iva_total,
      Total: n.total,
      'Monto aplicado': n.monto_aplicado,
      'Saldo a favor': roundMoneda(Number(n.total) - Number(n.monto_aplicado), n.moneda),
      'Afecta stock': n.afecta_stock ? 'Sí' : 'No',
      Estado: n.estado,
    })));
  }

  return (
    <>
      <Header title="Notas de crédito recibidas" subtitle="NC de proveedores: devoluciones, descuentos y ajustes" />
      <div className="p-4 md:p-6 space-y-4">
        {faltaMigracion && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Faltan las tablas de notas de crédito. Ejecutá la migración 022 en Supabase para habilitar este módulo.
          </div>
        )}
        <div className="flex flex-col lg:flex-row gap-3 justify-between">
          <div className="flex flex-wrap gap-2 flex-1">
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Buscar NC, comprobante, proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto" value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos los estados</option><option value="vigente">Vigente</option><option value="anulada">Anulada</option>
            </select>
            <select className="input w-auto" value={fMotivo} onChange={e => setFMotivo(e.target.value)}>
              <option value="">Todos los motivos</option>
              {MOTIVOS_NC.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select className="input w-auto" value={fMoneda} onChange={e => setFMoneda(e.target.value)}>
              <option value="">GS y USD</option><option value="GS">GS</option><option value="USD">USD</option>
            </select>
            <select className="input w-auto" value={fProveedor} onChange={e => setFProveedor(e.target.value)}>
              <option value="">Todos los proveedores</option>
              {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportar} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> Excel</button>
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva NC</button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : paginated.length === 0 ? (
            <div className="p-12 text-center text-gray-400"><FileMinus className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>Sin notas de crédito</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">N° NC</th><th className="table-header">Comprobante</th><th className="table-header">Proveedor</th>
                    <th className="table-header">Compra</th><th className="table-header">Emisión</th><th className="table-header">Motivo</th>
                    <th className="table-header">Moneda</th><th className="table-header text-right">Total</th><th className="table-header text-right">Saldo a favor</th>
                    <th className="table-header">Estado</th><th className="table-header text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.map(n => {
                    const libre = roundMoneda(Number(n.total) - Number(n.monto_aplicado), n.moneda);
                    return (
                      <tr key={n.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${n.estado === 'anulada' ? 'opacity-60' : ''}`}>
                        <td className="table-cell font-medium">{n.numero}</td>
                        <td className="table-cell text-sm">{n.numero_comprobante || (n.comprobante_url ? 'Archivo adjunto' : '-')}</td>
                        <td className="table-cell text-sm">{n.proveedores?.nombre || '-'}</td>
                        <td className="table-cell text-sm">{n.compras?.numero || '-'}</td>
                        <td className="table-cell text-xs">{formatDate(n.fecha_emision)}</td>
                        <td className="table-cell text-sm">{labelMotivo(n.motivo)}</td>
                        <td className="table-cell text-sm">{n.moneda}</td>
                        <td className="table-cell text-right font-bold text-emerald-600">{formatMontoMoneda(n.total, n.moneda)}</td>
                        <td className="table-cell text-right">{n.estado === 'anulada' ? '-' : formatMontoMoneda(libre, n.moneda)}</td>
                        <td className="table-cell"><span className={`badge ${n.estado === 'anulada' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>{n.estado}</span></td>
                        <td className="table-cell text-right whitespace-nowrap">
                          <button onClick={() => verDetalle(n)} className="p-1 text-gray-500 hover:text-gray-700" title="Ver detalle"><Eye className="w-4 h-4" /></button>
                          {n.estado !== 'anulada' && libre > 0 && (
                            <button onClick={() => setAsociar({ nc: n, compraId: '' })} className="p-1 text-blue-500 hover:text-blue-700" title="Asociar a compra"><Link2 className="w-4 h-4" /></button>
                          )}
                          {n.estado !== 'anulada' && (
                            <button onClick={() => anular(n)} className="p-1 text-red-500 hover:text-red-700" title="Anular NC"><Ban className="w-4 h-4" /></button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={7} className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Total vigentes:</td>
                    <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatMontoMoneda(totalGs, 'GS')}{totalUsd > 0 && <div>{formatMontoMoneda(totalUsd, 'USD')}</div>}</td>
                    <td colSpan={3}></td>
                  </tr>
                </tfoot>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-4xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nueva nota de crédito recibida</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="label">Proveedor *</label>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <SearchSelect options={proveedores.map(p => ({ value: p.id, label: p.nombre }))} value={form.proveedor_id} onChange={v => setForm(f => ({ ...f, proveedor_id: v, compra_id: '' }))} placeholder="Seleccionar proveedor" />
                    </div>
                    <button type="button" onClick={() => setShowProvRapido(true)} className="btn-secondary flex items-center gap-1 shrink-0 text-xs"><UserPlus className="w-4 h-4" /> Nuevo</button>
                  </div>
                </div>
                <div>
                  <label className="label">Factura de compra original (opcional)</label>
                  <select className="input" value={form.compra_id} disabled={!form.proveedor_id} onChange={e => setForm(f => ({ ...f, compra_id: e.target.value }))}>
                    <option value="">Sin asociar (queda como crédito a favor)</option>
                    {comprasProveedor.map(c => <option key={c.id} value={c.id}>{c.numero}{c.numero_factura ? ` · ${c.numero_factura}` : ''} · saldo {formatMontoMoneda(c.saldo_pendiente, c.moneda)}</option>)}
                  </select>
                  {form.proveedor_id && comprasProveedor.length === 0 && <p className="text-xs text-gray-400 mt-1">No hay compras con saldo en {form.moneda} para este proveedor.</p>}
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={form.moneda} onChange={e => { const m = e.target.value as 'GS' | 'USD'; setForm(f => ({ ...f, moneda: m, compra_id: '' })); setItems(prev => prev.map(it => ({ ...it, precio: sanitizeDecimalInput(it.precio, m === 'USD' ? 4 : 0) }))); }}>
                    <option value="GS">Guaraníes (GS)</option><option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                {form.moneda === 'USD' && (
                  <div>
                    <label className="label">Tipo de cambio (opcional)</label>
                    <input className="input" inputMode="decimal" placeholder="Gs. por USD" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: sanitizeDecimalInput(e.target.value, DECIMALES_TIPO_CAMBIO) }))} />
                  </div>
                )}
                <div>
                  <label className="label">Motivo</label>
                  <select className="input" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value, afecta_stock: e.target.value === 'devolucion' }))}>
                    {MOTIVOS_NC.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Fecha de emisión *</label>
                  <input type="date" className="input" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Fecha de registro</label>
                  <input type="date" className="input" value={form.fecha_registro} onChange={e => setForm(f => ({ ...f, fecha_registro: e.target.value }))} />
                </div>
              </div>

              <ComprobanteInput label="Comprobante de la NC" numero={form.numero_comprobante} onNumero={v => setForm(f => ({ ...f, numero_comprobante: v }))} file={file} onFile={setFile} numeroPlaceholder="N° de nota de crédito" />

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.afecta_stock} onChange={e => setForm(f => ({ ...f, afecta_stock: e.target.checked }))} />
                La NC devuelve mercadería (descuenta stock)
              </label>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="label mb-0">Ítems afectados</label>
                  <button type="button" onClick={() => setItems(p => [...p, itemVacio()])} className="btn-secondary text-xs flex items-center gap-1"><Plus className="w-3 h-3" /> Agregar ítem</button>
                </div>
                {items.map((it, i) => {
                  const p = prodMap.get(it.producto_id);
                  const lotes = lotesPorProducto[it.producto_id] || [];
                  const necesitaLote = form.afecta_stock && p && lotes.length > 0 && (requiereLote(tipoControlDeProducto(p)) || tipoControlDeProducto(p) === 'solo_vencimiento');
                  return (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end p-2 rounded-lg bg-gray-50 dark:bg-gray-800/40">
                      <div className="col-span-12 md:col-span-4">
                        <label className="label text-xs">Producto / descripción</label>
                        <SearchSelect options={productos.map(x => ({ value: x.id, label: x.nombre, sublabel: x.sku }))} value={it.producto_id} onChange={v => elegirProducto(i, v)} placeholder="Producto (opcional si no devuelve stock)" />
                        {!it.producto_id && <input className="input mt-1" placeholder="Descripción libre" value={it.descripcion} onChange={e => setItem(i, { descripcion: e.target.value })} />}
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className="label text-xs">Cantidad</label>
                        <input className="input" inputMode="decimal" value={it.cantidad} onChange={e => setItem(i, { cantidad: sanitizeDecimalInput(e.target.value, cantidadDecimales(i)) })} />
                      </div>
                      <div className="col-span-4 md:col-span-2">
                        <label className="label text-xs">Precio ({form.moneda})</label>
                        <input className="input" inputMode="decimal" value={it.precio} onChange={e => setItem(i, { precio: sanitizeDecimalInput(e.target.value, form.moneda === 'USD' ? 4 : 0) })} />
                      </div>
                      <div className="col-span-4 md:col-span-1">
                        <label className="label text-xs">IVA %</label>
                        <select className="input" value={it.tasa} onChange={e => setItem(i, { tasa: e.target.value })}>
                          <option value="10">10</option><option value="5">5</option><option value="0">0</option>
                        </select>
                      </div>
                      <div className="col-span-8 md:col-span-2 text-right text-sm font-semibold">{formatMontoMoneda(calculo.lineas[i]?.subtotal, form.moneda)}</div>
                      <div className="col-span-4 md:col-span-1 text-right">
                        {items.length > 1 && <button type="button" onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-500"><Trash2 className="w-4 h-4" /></button>}
                      </div>
                      {necesitaLote && (
                        <div className="col-span-12">
                          <label className="label text-xs">Lote a devolver *</label>
                          <select className="input" value={it.lote_id} onChange={e => setItem(i, { lote_id: e.target.value })}>
                            <option value="">Seleccionar lote</option>
                            {lotes.map(l => <option key={l.id} value={l.id}>{l.numero_lote}{l.fecha_vencimiento ? ` · vto ${formatDate(l.fecha_vencimiento)}` : ''} · stock {formatCantidad(l.stock_actual)}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col items-end text-sm gap-1">
                <div>Subtotal (sin IVA): <strong>{formatMontoMoneda(calculo.neto, form.moneda)}</strong></div>
                <div>IVA incluido: <strong>{formatMontoMoneda(calculo.iva, form.moneda)}</strong></div>
                <div className="text-base">Total NC: <strong className="text-emerald-600">{formatMontoMoneda(calculo.total, form.moneda)}</strong></div>
              </div>
              <div>
                <label className="label">Notas</label>
                <textarea className="input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />} Registrar NC
              </button>
            </div>
          </div>
        </div>
      )}

      <ProveedorRapidoModal
        open={showProvRapido}
        onClose={() => setShowProvRapido(false)}
        onCreated={p => {
          setProveedores(prev => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
          setForm(f => ({ ...f, proveedor_id: p.id, compra_id: '' }));
          setShowProvRapido(false);
        }}
      />

      {asociar && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Asociar NC {asociar.nc.numero} a una compra</h2>
              <button onClick={() => setAsociar(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-3">
              <p className="text-sm text-gray-500">Saldo a favor: <strong>{formatMontoMoneda(roundMoneda(Number(asociar.nc.total) - Number(asociar.nc.monto_aplicado), asociar.nc.moneda), asociar.nc.moneda)}</strong>. Solo compras del mismo proveedor y moneda.</p>
              <select className="input" value={asociar.compraId} onChange={e => setAsociar(a => a && ({ ...a, compraId: e.target.value }))}>
                <option value="">Seleccionar compra</option>
                {compras.filter(c => c.proveedor_id === asociar.nc.proveedor_id && c.moneda === asociar.nc.moneda).map(c => (
                  <option key={c.id} value={c.id}>{c.numero}{c.numero_factura ? ` · ${c.numero_factura}` : ''} · saldo {formatMontoMoneda(c.saldo_pendiente, c.moneda)}</option>
                ))}
              </select>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setAsociar(null)} className="btn-secondary">Cancelar</button>
              <button onClick={confirmarAsociar} className="btn-primary">Aplicar</button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">NC {detalle.numero} <span className="text-xs text-gray-400 ml-2">{detalle.estado}</span></h2>
              <button onClick={() => setDetalle(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                {([
                  ['Proveedor', detalle.proveedores?.nombre || '-'],
                  ['Comprobante', detalle.numero_comprobante || detalle.comprobante_nombre || '-'],
                  ['Compra asociada', detalle.compras?.numero || '-'],
                  ['Motivo', labelMotivo(detalle.motivo)],
                  ['Emisión', formatDate(detalle.fecha_emision)],
                  ['Registro', formatDate(detalle.fecha_registro)],
                  ['Moneda', detalle.moneda + (detalle.tipo_cambio ? ` (TC ${detalle.tipo_cambio})` : '')],
                  ['Afecta stock', detalle.afecta_stock ? 'Sí' : 'No'],
                  ['Subtotal', formatMontoMoneda(detalle.subtotal, detalle.moneda)],
                  ['IVA', formatMontoMoneda(detalle.iva_total, detalle.moneda)],
                  ['Total', formatMontoMoneda(detalle.total, detalle.moneda)],
                  ['Aplicado', formatMontoMoneda(detalle.monto_aplicado, detalle.moneda)],
                ] as [string, string][]).map(([k, v]) => <div key={k}><div className="text-xs text-gray-400">{k}</div><div className="font-medium">{v}</div></div>)}
              </div>
              {detalle.comprobante_url && (
                <button onClick={() => abrirComprobante(supabase, detalle.comprobante_url)} className="btn-secondary flex items-center gap-2 text-xs"><Paperclip className="w-4 h-4" /> Ver archivo adjunto</button>
              )}
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50"><tr><th className="table-header">Ítem</th><th className="table-header text-right">Cant.</th><th className="table-header text-right">Precio</th><th className="table-header text-right">IVA</th><th className="table-header text-right">Subtotal</th></tr></thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {detalle.items.map((it: any) => (
                    <tr key={it.id}>
                      <td className="table-cell">{it.descripcion}{it.numero_lote && <div className="text-xs text-gray-400">Lote {it.numero_lote}</div>}</td>
                      <td className="table-cell text-right">{formatCantidad(it.cantidad)}</td>
                      <td className="table-cell text-right">{formatMontoMoneda(it.precio_unitario, detalle.moneda)}</td>
                      <td className="table-cell text-right">{it.tasa_iva_porcentaje}%</td>
                      <td className="table-cell text-right">{formatMontoMoneda(it.subtotal, detalle.moneda)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {detalle.aplicaciones.length > 0 && (
                <div>
                  <div className="font-semibold mb-1">Aplicada a compras</div>
                  {detalle.aplicaciones.map((a: any) => <div key={a.id} className="text-xs">{a.compras?.numero || a.compra_id}: {formatMontoMoneda(a.monto, detalle.moneda)}</div>)}
                </div>
              )}
              {detalle.notas && <p className="text-gray-500">{detalle.notas}</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
