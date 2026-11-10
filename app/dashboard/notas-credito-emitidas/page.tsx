'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { SearchSelect } from '@/components/SearchSelect';
import { ComprobanteInput } from '@/components/ComprobanteInput';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { subirComprobante, abrirComprobante } from '@/lib/comprobantes';
import { moverStock } from '@/lib/stock';
import { aplicarCreditoAVenta, revertirCreditoVenta, type VentaCuotaAplicada } from '@/lib/ventas-saldos';
import {
  DECIMALES_CANTIDAD, MOTIVOS_NC, formatCantidad, formatDate, formatMontoMoneda, generarNumero,
  getErrorMessage, hoyISO, ivaIncluido, parseDecimal, roundMoneda, roundTo, sanitizeDecimalInput, toDigitsOnly,
} from '@/lib/utils';
import { Ban, Download, Eye, FileMinus, Loader2, Plus, Search, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { descargarExcel } from '@/lib/export';
import { usePagination, Pagination } from '@/components/TableUtils';
import type { Cliente, Producto } from '@/lib/types';

interface VentaOpt { id: string; numero: string; cliente_id: string; saldo_pendiente: number; total: number; estado: string; }
interface ItemForm { producto_id: string; descripcion: string; cantidad: string; precio: string; tasa: string; lote_id: string; }
interface NotaEmitida {
  id: string; numero: string; numero_comprobante: string | null; comprobante_url: string | null; comprobante_nombre: string | null;
  cliente_id: string; venta_id: string | null; fecha_emision: string; fecha_registro: string; motivo: string; afecta_stock: boolean;
  subtotal: number; iva_total: number; total: number; monto_aplicado: number; estado: string; notas: string | null;
  clientes?: { nombre: string } | null; ventas?: { numero: string } | null;
}

const vacio = (): ItemForm => ({ producto_id: '', descripcion: '', cantidad: '1', precio: '', tasa: '10', lote_id: '' });
const motivoLabel = (m: string) => MOTIVOS_NC.find(x => x.value === m)?.label || m;

export default function NotasCreditoEmitidasPage() {
  const supabase = createClient();
  const [notas, setNotas] = useState<NotaEmitida[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [ventas, setVentas] = useState<VentaOpt[]>([]);
  const [lotes, setLotes] = useState<Record<string, { id: string; numero_lote: string; stock_actual: number }[]>>({});
  const [loading, setLoading] = useState(true);
  const [faltaMigracion, setFaltaMigracion] = useState(false);
  const [search, setSearch] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [items, setItems] = useState<ItemForm[]>([vacio()]);
  const [detalle, setDetalle] = useState<any>(null);
  const [form, setForm] = useState({
    cliente_id: '', venta_id: '', fecha_emision: hoyISO(), fecha_registro: hoyISO(),
    numero_comprobante: '', motivo: 'devolucion', afecta_stock: true, notas: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('notas_credito_venta')
      .select('*, clientes(nombre), ventas(numero)')
      .order('created_at', { ascending: false }).limit(500);
    setFaltaMigracion(!!error);
    setNotas((data || []) as NotaEmitida[]);
    setLoading(false);
  }, [supabase]);

  const loadVentas = useCallback(async () => {
    const { data } = await supabase.from('ventas')
      .select('id, numero, cliente_id, saldo_pendiente, total, estado')
      .neq('estado', 'anulado').order('created_at', { ascending: false }).limit(500);
    setVentas((data || []) as VentaOpt[]);
  }, [supabase]);

  useEffect(() => {
    load();
    loadVentas();
    supabase.from('clientes').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => setClientes((data || []) as Cliente[]));
    supabase.from('productos').select('*, lotes(id, numero_lote, stock_actual)')
      .eq('activo', true).order('nombre')
      .then(({ data }) => setProductos((data || []) as Producto[]));
  }, [load, loadVentas, supabase]);

  const clienteVentas = useMemo(
    () => ventas.filter(v => v.cliente_id === form.cliente_id),
    [ventas, form.cliente_id],
  );
  const productoMap = useMemo(() => new Map(productos.map(p => [p.id, p])), [productos]);
  const calculo = useMemo(() => {
    const lineas = items.map(i => {
      const importe = roundMoneda(parseDecimal(i.cantidad) * parseDecimal(i.precio), 'GS');
      return { importe, iva: ivaIncluido(importe, parseDecimal(i.tasa), 'GS') };
    });
    const total = roundMoneda(lineas.reduce((s, l) => s + l.importe, 0), 'GS');
    const iva = roundMoneda(lineas.reduce((s, l) => s + l.iva, 0), 'GS');
    return { lineas, total, iva, neto: roundMoneda(total - iva, 'GS') };
  }, [items]);

  async function cargarLotes(productoId: string) {
    if (lotes[productoId]) return;
    const { data } = await supabase.from('lotes').select('id, numero_lote, stock_actual')
      .eq('producto_id', productoId).order('numero_lote');
    setLotes(prev => ({ ...prev, [productoId]: (data || []) as any[] }));
  }

  function reset() {
    setFile(null);
    setItems([vacio()]);
    setForm({ cliente_id: '', venta_id: '', fecha_emision: hoyISO(), fecha_registro: hoyISO(), numero_comprobante: '', motivo: 'devolucion', afecta_stock: true, notas: '' });
  }

  async function siguienteNumero() {
    const { data, error } = await supabase.from('notas_credito_venta').select('numero')
      .order('created_at', { ascending: false }).limit(1);
    if (error) throw error;
    const ultimo = data?.[0]?.numero ? parseInt(String(data[0].numero).replace(/\D/g, ''), 10) || 0 : 0;
    return generarNumero('NCE', ultimo + 1);
  }

  async function guardar() {
    if (!form.cliente_id) { toast.error('Seleccioná un cliente'); return; }
    if (!form.numero_comprobante.trim() && !file) { toast.error('El comprobante es obligatorio: ingresá el número o adjuntá el archivo'); return; }
    if (!form.fecha_emision || (form.fecha_registro && form.fecha_emision > form.fecha_registro)) { toast.error('Revisá las fechas de emisión y registro'); return; }
    const validos = items.filter(i => i.producto_id || i.descripcion.trim());
    if (!validos.length) { toast.error('Agregá al menos un ítem'); return; }
    for (const i of validos) {
      if (parseDecimal(i.cantidad) <= 0 || parseDecimal(i.precio) <= 0) { toast.error('La cantidad y el precio de cada ítem deben ser mayores a 0'); return; }
      if (form.afecta_stock && !i.producto_id) { toast.error('Para devolver stock, cada ítem debe ser un producto'); return; }
    }

    setSaving(true);
    let ncId: string | null = null;
    const movidos: { productoId: string; cantidad: number; loteId: string | null }[] = [];
    let aplicadoVenta: { ventaId: string; monto: number; detalle: VentaCuotaAplicada[] } | null = null;
    try {
      const numero = await siguienteNumero();
      const comprobanteUrl = file ? await subirComprobante(supabase, file, 'notas-credito-emitidas') : null;
      const { data: nc, error } = await supabase.from('notas_credito_venta').insert({
        numero, numero_comprobante: toDigitsOnly(form.numero_comprobante) || form.numero_comprobante.trim() || null,
        comprobante_url: comprobanteUrl, comprobante_nombre: file?.name || null,
        cliente_id: form.cliente_id, venta_id: form.venta_id || null,
        fecha_emision: form.fecha_emision, fecha_registro: form.fecha_registro || hoyISO(),
        motivo: form.motivo, afecta_stock: form.afecta_stock,
        subtotal: calculo.neto, iva_total: calculo.iva, total: calculo.total, notas: form.notas.trim() || null,
      }).select('id').single();
      if (error) throw error;
      ncId = nc.id;

      const filas = validos.map(i => {
        const subtotal = roundMoneda(parseDecimal(i.cantidad) * parseDecimal(i.precio), 'GS');
        const prod = productoMap.get(i.producto_id);
        const lote = (lotes[i.producto_id] || []).find(l => l.id === i.lote_id);
        return {
          nota_credito_id: nc.id, producto_id: i.producto_id || null, lote_id: i.lote_id || null,
          numero_lote: lote?.numero_lote || null, descripcion: i.descripcion.trim() || prod?.nombre || 'Ítem',
          cantidad: roundTo(parseDecimal(i.cantidad), DECIMALES_CANTIDAD), precio_unitario: roundTo(parseDecimal(i.precio), 4),
          tasa_iva_porcentaje: parseDecimal(i.tasa), monto_iva: ivaIncluido(subtotal, parseDecimal(i.tasa), 'GS'), subtotal,
        };
      });
      const { error: itemsError } = await supabase.from('nota_credito_venta_items').insert(filas);
      if (itemsError) throw itemsError;

      if (form.afecta_stock) {
        for (const item of filas) {
          await moverStock(supabase, {
            productoId: item.producto_id!, delta: item.cantidad, tipo: 'devolucion',
            referenciaTipo: 'nota_credito_venta', referenciaId: nc.id,
            notas: `NC emitida ${numero}`, loteId: item.lote_id,
          });
          movidos.push({ productoId: item.producto_id!, cantidad: item.cantidad, loteId: item.lote_id });
        }
      }

      if (form.venta_id) {
        const r = await aplicarCreditoAVenta(supabase, form.venta_id, form.cliente_id, calculo.total);
        if (r.aplicado > 0) {
          aplicadoVenta = { ventaId: form.venta_id, monto: r.aplicado, detalle: r.detalle };
          const { error: appError } = await supabase.from('nota_credito_venta_aplicaciones').insert({
            nota_credito_id: nc.id, venta_id: form.venta_id, monto: r.aplicado, detalle_cuotas: r.detalle,
          });
          if (appError) throw appError;
          const { error: updateError } = await supabase.from('notas_credito_venta').update({ monto_aplicado: r.aplicado }).eq('id', nc.id);
          if (updateError) throw updateError;
        }
      }

      await logAudit(supabase, { modulo: 'Notas de crédito', entidad: 'NC venta', accion: 'crear', descripcion: `Registró la NC emitida ${numero} por ${formatMontoMoneda(calculo.total, 'GS')}`, registroId: nc.id });
      toast.success(`NC ${numero} registrada`);
      setShowForm(false);
      reset();
      load();
      loadVentas();
    } catch (e) {
      if (aplicadoVenta) await revertirCreditoVenta(supabase, aplicadoVenta.ventaId, aplicadoVenta.monto, aplicadoVenta.detalle).catch(() => undefined);
      for (const mov of movidos) {
        await moverStock(supabase, {
          productoId: mov.productoId, delta: -mov.cantidad, tipo: 'ajuste',
          referenciaTipo: 'nota_credito_venta_revertida', loteId: mov.loteId,
          notas: 'Reversión por error al guardar NC emitida',
        }).catch(() => undefined);
      }
      if (ncId) await supabase.from('notas_credito_venta').delete().eq('id', ncId);
      const message = getErrorMessage(e);
      toast.error(message.includes('notas_credito_venta') || message.includes('nota_credito_venta_items')
        ? 'Falta aplicar la migración 023 de NC emitidas en Supabase'
        : message || 'No se pudo registrar la NC emitida');
    } finally {
      setSaving(false);
    }
  }

  async function verDetalle(nc: NotaEmitida) {
    const [{ data: its }, { data: aps }] = await Promise.all([
      supabase.from('nota_credito_venta_items').select('*').eq('nota_credito_id', nc.id),
      supabase.from('nota_credito_venta_aplicaciones').select('monto, venta_id, detalle_cuotas, ventas(numero)').eq('nota_credito_id', nc.id),
    ]);
    setDetalle({ ...nc, items: its || [], aplicaciones: aps || [] });
  }

  async function anular(nc: NotaEmitida) {
    if (nc.estado === 'anulada' || !window.confirm(`¿Anular la NC ${nc.numero}? Se revertirán stock y saldos aplicados.`)) return;
    try {
      const [{ data: its, error: itemError }, { data: aps, error: appError }] = await Promise.all([
        supabase.from('nota_credito_venta_items').select('producto_id, lote_id, cantidad').eq('nota_credito_id', nc.id),
        supabase.from('nota_credito_venta_aplicaciones').select('id, venta_id, monto, detalle_cuotas').eq('nota_credito_id', nc.id),
      ]);
      if (itemError) throw itemError;
      if (appError) throw appError;
      if (nc.afecta_stock) for (const i of its || []) {
        if (i.producto_id) await moverStock(supabase, {
          productoId: i.producto_id, delta: -Number(i.cantidad), tipo: 'ajuste',
          referenciaTipo: 'nota_credito_venta_anulada', referenciaId: nc.id,
          notas: `Anulación NC ${nc.numero}`, loteId: i.lote_id,
        });
      }
      for (const a of aps || []) {
        await revertirCreditoVenta(supabase, a.venta_id, Number(a.monto), (a.detalle_cuotas || []) as VentaCuotaAplicada[]);
      }
      const { error: deleteError } = await supabase.from('nota_credito_venta_aplicaciones').delete().eq('nota_credito_id', nc.id);
      if (deleteError) throw deleteError;
      const { error } = await supabase.from('notas_credito_venta').update({ estado: 'anulada', monto_aplicado: 0 }).eq('id', nc.id);
      if (error) throw error;
      await logAudit(supabase, { modulo: 'Notas de crédito', entidad: 'NC venta', accion: 'anular', descripcion: `Anuló la NC emitida ${nc.numero}`, registroId: nc.id });
      toast.success('NC anulada');
      setDetalle(null);
      load();
      loadVentas();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'No se pudo anular la NC');
    }
  }

  const filtradas = notas.filter(n => [n.numero, n.numero_comprobante, n.clientes?.nombre, n.ventas?.numero]
    .some(v => String(v || '').toLowerCase().includes(search.toLowerCase())));
  const { paginated, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filtradas);

  async function exportar() {
    if (!filtradas.length) { toast.error('No hay notas de crédito para exportar'); return; }
    await descargarExcel(`notas_credito_emitidas_${hoyISO()}.xlsx`, 'NC emitidas', filtradas.map(n => ({
      Número: n.numero, Comprobante: n.numero_comprobante || '', Cliente: n.clientes?.nombre || '',
      Venta: n.ventas?.numero || '', 'Fecha emisión': n.fecha_emision, Motivo: motivoLabel(n.motivo),
      Moneda: 'GS', Subtotal: n.subtotal, IVA: n.iva_total, Total: n.total, 'Monto aplicado': n.monto_aplicado,
      'Saldo a favor': roundMoneda(Number(n.total) - Number(n.monto_aplicado), 'GS'), Estado: n.estado,
    })));
  }

  return (
    <>
      <Header title="Notas de crédito emitidas" subtitle="NC a clientes: devoluciones, descuentos y ajustes" />
      <div className="p-4 md:p-6 space-y-4">
        {faltaMigracion && <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Falta aplicar la migración 023 de NC emitidas en Supabase.
        </div>}
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar NC, comprobante o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={exportar} className="btn-secondary flex items-center gap-2"><Download className="w-4 h-4" /> Excel</button>
            <button onClick={() => { reset(); setShowForm(true); }} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nueva NC</button>
          </div>
        </div>
        <div className="card overflow-hidden">
          {loading ? <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
            : !paginated.length ? <div className="p-12 text-center text-gray-400"><FileMinus className="mx-auto mb-2 h-10 w-10 opacity-40" />Sin notas de crédito emitidas</div>
              : <div className="overflow-x-auto">
                <table className="w-full">
                  <thead><tr><th className="table-header">N° NC</th><th className="table-header">Comprobante</th><th className="table-header">Cliente</th><th className="table-header">Venta</th><th className="table-header">Emisión</th><th className="table-header">Motivo</th><th className="table-header text-right">Total</th><th className="table-header">Estado</th><th className="table-header text-right">Acciones</th></tr></thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {paginated.map(n => <tr key={n.id} className={n.estado === 'anulada' ? 'opacity-60' : ''}>
                      <td className="table-cell font-medium">{n.numero}</td><td className="table-cell">{n.numero_comprobante || (n.comprobante_url ? 'Archivo adjunto' : '-')}</td>
                      <td className="table-cell">{n.clientes?.nombre || '-'}</td><td className="table-cell">{n.ventas?.numero || '-'}</td>
                      <td className="table-cell">{formatDate(n.fecha_emision)}</td><td className="table-cell">{motivoLabel(n.motivo)}</td>
                      <td className="table-cell text-right font-semibold">{formatMontoMoneda(n.total, 'GS')}</td><td className="table-cell">{n.estado}</td>
                      <td className="table-cell text-right whitespace-nowrap">
                        <button onClick={() => verDetalle(n)} className="p-1 text-gray-500" title="Ver detalle"><Eye className="h-4 w-4" /></button>
                        {n.estado !== 'anulada' && <button onClick={() => anular(n)} className="p-1 text-red-500" title="Anular NC"><Ban className="h-4 w-4" /></button>}
                      </td>
                    </tr>)}
                  </tbody>
                </table>
                <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
              </div>}
        </div>
      </div>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="card max-h-[92vh] w-full max-w-4xl overflow-y-auto">
          <div className="flex items-center justify-between border-b p-5"><h2 className="section-title">Nueva nota de crédito emitida</h2><button onClick={() => setShowForm(false)}><X className="h-4 w-4" /></button></div>
          <div className="space-y-4 p-5">
            <div className="grid gap-3 md:grid-cols-2">
              <div><label className="label">Cliente *</label><SearchSelect options={clientes.map(c => ({ value: c.id, label: c.nombre }))} value={form.cliente_id} onChange={v => setForm(f => ({ ...f, cliente_id: v, venta_id: '' }))} placeholder="Seleccionar cliente" /></div>
              <div><label className="label">Venta asociada (opcional)</label><select className="input" value={form.venta_id} disabled={!form.cliente_id} onChange={e => setForm(f => ({ ...f, venta_id: e.target.value }))}>
                <option value="">Sin asociar (crédito a favor)</option>{clienteVentas.map(v => <option key={v.id} value={v.id}>{v.numero} · saldo {formatMontoMoneda(v.saldo_pendiente, 'GS')}</option>)}
              </select></div>
              <div><label className="label">Fecha de emisión *</label><input type="date" className="input" value={form.fecha_emision} onChange={e => setForm(f => ({ ...f, fecha_emision: e.target.value }))} /></div>
              <div><label className="label">Fecha de registro</label><input type="date" className="input" value={form.fecha_registro} onChange={e => setForm(f => ({ ...f, fecha_registro: e.target.value }))} /></div>
              <div><label className="label">Motivo</label><select className="input" value={form.motivo} onChange={e => setForm(f => ({ ...f, motivo: e.target.value, afecta_stock: e.target.value === 'devolucion' }))}>{MOTIVOS_NC.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}</select></div>
            </div>
            <ComprobanteInput label="Comprobante de la NC" numero={form.numero_comprobante} onNumero={v => setForm(f => ({ ...f, numero_comprobante: v }))} file={file} onFile={setFile} numeroPlaceholder="N° de nota de crédito" />
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.afecta_stock} onChange={e => setForm(f => ({ ...f, afecta_stock: e.target.checked }))} /> La NC devuelve mercadería (ingresa stock)</label>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><label className="label mb-0">Ítems</label><button onClick={() => setItems(prev => [...prev, vacio()])} className="btn-secondary flex items-center gap-1 text-xs"><Plus className="h-3 w-3" /> Agregar ítem</button></div>
              {items.map((it, i) => <div key={i} className="grid grid-cols-12 items-end gap-2 rounded-lg bg-gray-50 p-2 dark:bg-gray-800/40">
                <div className="col-span-12 md:col-span-4"><label className="label text-xs">Producto / descripción</label><SearchSelect options={productos.map(p => ({ value: p.id, label: p.nombre, sublabel: p.sku }))} value={it.producto_id} onChange={v => {
                  const p = productoMap.get(v);
                  setItems(prev => prev.map((x, idx) => idx === i ? { ...x, producto_id: v, descripcion: p?.nombre || '', precio: p?.precio_venta ? String(p.precio_venta) : '', lote_id: '' } : x));
                  if (v) cargarLotes(v);
                }} placeholder="Seleccionar producto" />
                {!it.producto_id && <input className="input mt-1" placeholder="Descripción libre (sin movimiento de stock)" value={it.descripcion} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, descripcion: e.target.value } : x))} />}
                </div>
                <div className="col-span-3 md:col-span-2"><label className="label text-xs">Cantidad</label><input className="input" inputMode="decimal" value={it.cantidad} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, cantidad: sanitizeDecimalInput(e.target.value, DECIMALES_CANTIDAD) } : x))} /></div>
                <div className="col-span-3 md:col-span-2"><label className="label text-xs">Precio GS</label><input className="input" inputMode="decimal" value={it.precio} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, precio: sanitizeDecimalInput(e.target.value, 0) } : x))} /></div>
                <div className="col-span-3 md:col-span-1"><label className="label text-xs">IVA %</label><select className="input" value={it.tasa} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, tasa: e.target.value } : x))}><option value="10">10</option><option value="5">5</option><option value="0">0</option></select></div>
                <div className="col-span-3 md:col-span-2 text-right text-sm font-semibold">{formatMontoMoneda(calculo.lineas[i]?.importe || 0, 'GS')}</div>
                <div className="col-span-12 md:col-span-1 text-right">{items.length > 1 && <button onClick={() => setItems(prev => prev.filter((_, idx) => idx !== i))} className="p-1 text-red-500"><Trash2 className="h-4 w-4" /></button>}</div>
                {form.afecta_stock && it.producto_id && (lotes[it.producto_id] || []).length > 0 && <div className="col-span-12"><label className="label text-xs">Lote a devolver (opcional)</label><select className="input" value={it.lote_id} onChange={e => setItems(prev => prev.map((x, idx) => idx === i ? { ...x, lote_id: e.target.value } : x))}><option value="">Sin lote / genérico</option>{lotes[it.producto_id].map(l => <option key={l.id} value={l.id}>{l.numero_lote} · stock {formatCantidad(l.stock_actual)}</option>)}</select></div>}
              </div>)}
            </div>
            <div className="space-y-1 text-right text-sm"><div>Subtotal sin IVA: <b>{formatMontoMoneda(calculo.neto, 'GS')}</b></div><div>IVA incluido: <b>{formatMontoMoneda(calculo.iva, 'GS')}</b></div><div className="text-base">Total NC: <b>{formatMontoMoneda(calculo.total, 'GS')}</b></div></div>
            <div><label className="label">Notas</label><textarea className="input" rows={2} value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} /></div>
          </div>
          <div className="flex justify-end gap-3 border-t p-5"><button onClick={() => setShowForm(false)} className="btn-secondary">Cancelar</button><button onClick={guardar} disabled={saving} className="btn-primary flex items-center gap-2">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Registrar NC</button></div>
        </div>
      </div>}

      {detalle && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"><div className="card max-h-[90vh] w-full max-w-2xl overflow-y-auto">
        <div className="flex items-center justify-between border-b p-5"><h2 className="section-title">NC {detalle.numero}</h2><button onClick={() => setDetalle(null)}><X className="h-4 w-4" /></button></div>
        <div className="space-y-4 p-5">
          <div className="grid gap-2 text-sm md:grid-cols-2"><p>Cliente: <b>{detalle.clientes?.nombre}</b></p><p>Venta: <b>{detalle.ventas?.numero || '-'}</b></p><p>Comprobante: <b>{detalle.numero_comprobante || detalle.comprobante_nombre || '-'}</b></p><p>Fecha: <b>{formatDate(detalle.fecha_emision)}</b></p><p>Motivo: <b>{motivoLabel(detalle.motivo)}</b></p><p>Estado: <b>{detalle.estado}</b></p></div>
          {detalle.comprobante_url && <button onClick={() => abrirComprobante(supabase, detalle.comprobante_url).catch(e => toast.error(getErrorMessage(e)))} className="btn-secondary flex items-center gap-2 text-xs">Ver comprobante</button>}
          <div className="space-y-2">{(detalle.items || []).map((i: any) => <div key={i.id} className="flex justify-between border-b pb-2 text-sm"><span>{i.descripcion} · {formatCantidad(i.cantidad)} × {formatMontoMoneda(i.precio_unitario, 'GS')}</span><b>{formatMontoMoneda(i.subtotal, 'GS')}</b></div>)}</div>
          <p className="text-right font-bold">Total: {formatMontoMoneda(detalle.total, 'GS')} · Aplicado: {formatMontoMoneda(detalle.monto_aplicado, 'GS')}</p>
        </div>
      </div></div>}
    </>
  );
}
