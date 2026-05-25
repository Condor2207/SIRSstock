'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2, Plus, Search, X } from 'lucide-react';
import toast from 'react-hot-toast';

type VentaPendiente = {
  id: string;
  numero: string;
  saldo_pendiente: number;
};

type Medio = {
  medio_pago: 'efectivo' | 'transferencia' | 'cheque_al_dia' | 'cheque_diferido' | 'tarjeta';
  monto: number;
  numero_cheque?: string;
  banco_emisor?: string;
  fecha_cheque?: string;
  numero_transaccion?: string;
};

export default function CobrosPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [clientes, setClientes] = useState<Array<{ id: string; nombre: string; documento: string | null; direccion: string | null; saldo_pendiente: number }>>([]);
  const [ventas, setVentas] = useState<VentaPendiente[]>([]);
  const [cobrosRaw, setCobrosRaw] = useState<any[]>([]);

  const [numeroRecibo, setNumeroRecibo] = useState('');
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [clienteId, setClienteId] = useState('');
  const [concepto, setConcepto] = useState('Cancelación de facturas');
  const [facturas, setFacturas] = useState<Array<{ venta_id: string; numero: string; saldo: number; aplicado: number }>>([]);
  const [medios, setMedios] = useState<Medio[]>([{ medio_pago: 'efectivo', monto: 0 }]);
  const [saving, setSaving] = useState(false);

  const loadCobros = useCallback(async () => {
    setLoading(true);
    const [cobrosRes, clientesRes] = await Promise.all([
      supabase
        .from('venta_pagos')
        .select('id, numero_recibo, fecha, monto, medio_pago, numero_cheque, banco_emisor, fecha_cheque, numero_transaccion, venta_id, ventas(numero, cliente_id, clientes(nombre))')
        .not('numero_recibo', 'is', null)
        .order('fecha', { ascending: false })
        .limit(1000),
      supabase.from('clientes').select('id, nombre, documento, direccion, saldo_pendiente').eq('activo', true).order('nombre'),
    ]);
    setCobrosRaw(cobrosRes.data || []);
    setClientes(clientesRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadCobros(); }, [loadCobros]);

  const cobros = useMemo(() => {
    const grouped: Record<string, any> = {};
    for (const r of cobrosRaw) {
      if (!r.numero_recibo) continue;
      if (!grouped[r.numero_recibo]) {
        grouped[r.numero_recibo] = {
          numero_recibo: r.numero_recibo,
          fecha: r.fecha,
          cliente: r.ventas?.clientes?.nombre || '-',
          total: 0,
          medios: new Set<string>(),
        };
      }
      grouped[r.numero_recibo].total += Number(r.monto || 0);
      grouped[r.numero_recibo].medios.add(r.medio_pago);
    }
    return Object.values(grouped)
      .filter((c: any) => c.numero_recibo.toLowerCase().includes(search.toLowerCase()) || c.cliente.toLowerCase().includes(search.toLowerCase()))
      .map((c: any) => ({ ...c, medios: Array.from(c.medios).join(', ') }));
  }, [cobrosRaw, search]);

  const totalFacturas = facturas.reduce((s, f) => s + (Number(f.aplicado) || 0), 0);
  const totalMedios = medios.reduce((s, m) => s + (Number(m.monto) || 0), 0);
  const diferencia = totalMedios - totalFacturas;

  async function openNuevoCobro() {
    const { count } = await supabase
      .from('venta_pagos')
      .select('*', { count: 'exact', head: true })
      .not('numero_recibo', 'is', null);
    setNumeroRecibo(String((count || 0) + 1).padStart(7, '0'));
    setFecha(new Date().toISOString().slice(0, 10));
    setClienteId('');
    setConcepto('Cancelación de facturas');
    setFacturas([]);
    setMedios([{ medio_pago: 'efectivo', monto: 0 }]);
    setShowModal(true);
  }

  async function handleClienteChange(id: string) {
    setClienteId(id);
    if (!id) { setFacturas([]); return; }
    const { data } = await supabase
      .from('ventas')
      .select('id, numero, saldo_pendiente')
      .eq('cliente_id', id)
      .gt('saldo_pendiente', 0)
      .neq('estado', 'anulado')
      .order('fecha');
    const rows = (data || []) as VentaPendiente[];
    setFacturas(rows.map((v) => ({ venta_id: v.id, numero: v.numero, saldo: Number(v.saldo_pendiente), aplicado: Number(v.saldo_pendiente) })));
  }

  function addMedio() {
    setMedios((prev) => [...prev, { medio_pago: 'efectivo', monto: 0 }]);
  }

  async function guardarCobro() {
    if (!numeroRecibo.trim()) return toast.error('Número de recibo obligatorio');
    if (!clienteId) return toast.error('Seleccioná un cliente');
    const facturasConMonto = facturas.filter((f) => Number(f.aplicado) > 0);
    const mediosConMonto = medios.filter((m) => Number(m.monto) > 0);
    if (facturasConMonto.length === 0) return toast.error('Indicá al menos una factura con monto aplicado');
    if (mediosConMonto.length === 0) return toast.error('Indicá al menos un medio de pago con monto');

    setSaving(true);
    try {
      const { data: existing } = await supabase.from('venta_pagos').select('id').eq('numero_recibo', numeroRecibo).limit(1);
      if (existing && existing.length > 0) {
        toast.error('El número de recibo ya existe');
        setSaving(false);
        return;
      }

      const invoiceQueue = facturasConMonto.map((f) => ({ ...f, restante: Number(f.aplicado) }));
      const inserts: any[] = [];

      for (const medio of mediosConMonto) {
        let restanteMedio = Number(medio.monto);
        for (const inv of invoiceQueue) {
          if (restanteMedio <= 0) break;
          if (inv.restante <= 0) continue;
          const asignado = Math.min(restanteMedio, inv.restante);
          inserts.push({
            venta_id: inv.venta_id,
            fecha,
            monto: asignado,
            medio_pago: medio.medio_pago,
            numero_recibo: numeroRecibo,
            numero_cheque: medio.numero_cheque || null,
            banco_emisor: medio.banco_emisor || null,
            fecha_cheque: medio.fecha_cheque || null,
            numero_transaccion: medio.numero_transaccion || null,
            notas: concepto || null,
          });
          inv.restante -= asignado;
          restanteMedio -= asignado;
        }
      }

      if (inserts.length === 0) {
        toast.error('No se pudo asignar montos entre facturas y medios');
        setSaving(false);
        return;
      }

      const totalAplicadoReal = inserts.reduce((s, i) => s + Number(i.monto), 0);
      if (Math.abs(diferencia) > 1) {
        toast('Aviso: hay diferencia entre facturas y medios; se registrará el monto distribuido.', { icon: '⚠️' });
      }

      const { error: insertError } = await supabase.from('venta_pagos').insert(inserts);
      if (insertError) throw insertError;

      const porVenta: Record<string, number> = {};
      inserts.forEach((i) => { porVenta[i.venta_id] = (porVenta[i.venta_id] || 0) + Number(i.monto); });

      for (const f of facturasConMonto) {
        const aplicado = porVenta[f.venta_id] || 0;
        if (aplicado <= 0) continue;
        const nuevoSaldo = Math.max(0, Number(f.saldo) - aplicado);
        await supabase.from('ventas').update({
          saldo_pendiente: nuevoSaldo,
          estado: nuevoSaldo === 0 ? 'pagado' : 'parcial',
        }).eq('id', f.venta_id);
      }

      const cliente = clientes.find((c) => c.id === clienteId);
      if (cliente) {
        await supabase
          .from('clientes')
          .update({ saldo_pendiente: Math.max(0, Number(cliente.saldo_pendiente || 0) - totalAplicadoReal) })
          .eq('id', clienteId);
      }

      toast.success('Cobro registrado');
      setShowModal(false);
      await loadCobros();
    } catch (e: any) {
      toast.error(e.message || 'Error al registrar cobro');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Header title="Cobros" subtitle="Registro de recibos de dinero y aplicación a facturas" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por recibo o cliente..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <button onClick={openNuevoCobro} className="btn-primary flex items-center gap-2"><Plus className="w-4 h-4" /> Nuevo cobro</button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : cobros.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No hay cobros registrados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">Recibo</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Total cobrado</th>
                    <th className="table-header">Medios</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {cobros.map((c: any) => (
                    <tr key={c.numero_recibo}>
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{c.numero_recibo}</td>
                      <td className="table-cell">{formatDate(c.fecha)}</td>
                      <td className="table-cell">{c.cliente}</td>
                      <td className="table-cell font-semibold">{formatCurrency(c.total)}</td>
                      <td className="table-cell text-xs">{c.medios}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nuevo cobro</h2>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div>
                  <label className="label">N° Recibo *</label>
                  <input className="input" value={numeroRecibo} onChange={(e) => setNumeroRecibo(e.target.value)} />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </div>
                <div className="md:col-span-2">
                  <label className="label">Cliente</label>
                  <select className="input" value={clienteId} onChange={(e) => handleClienteChange(e.target.value)}>
                    <option value="">Seleccionar cliente...</option>
                    {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre} — {c.documento || '-'}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="label">Concepto</label>
                <input className="input" value={concepto} onChange={(e) => setConcepto(e.target.value)} />
              </div>

              <div className="grid lg:grid-cols-2 gap-4">
                <div className="card p-4">
                  <h3 className="font-semibold mb-3">Facturas a cancelar</h3>
                  {facturas.length === 0 ? (
                    <p className="text-sm text-gray-500">Seleccioná un cliente para ver facturas pendientes.</p>
                  ) : (
                    <div className="space-y-2">
                      {facturas.map((f, idx) => (
                        <div key={f.venta_id} className="grid grid-cols-3 gap-2 items-center text-sm">
                          <div className="font-mono">{f.numero}</div>
                          <div className="text-gray-500">Saldo: {formatCurrency(f.saldo)}</div>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="input"
                            value={f.aplicado}
                            onChange={(e) => setFacturas((prev) => prev.map((x, i) => i === idx ? { ...x, aplicado: Number(e.target.value) || 0 } : x))}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Medios de pago</h3>
                    <button onClick={addMedio} className="btn-secondary text-xs py-1 px-2">+ Agregar</button>
                  </div>
                  {medios.map((m, idx) => (
                    <div key={idx} className="border rounded-lg p-3 space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <select className="input" value={m.medio_pago} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, medio_pago: e.target.value as Medio['medio_pago'] } : x))}>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="cheque_al_dia">Cheque al día</option>
                          <option value="cheque_diferido">Cheque diferido</option>
                          <option value="tarjeta">Tarjeta</option>
                        </select>
                        <input type="number" min="0" step="0.01" className="input" placeholder="Monto" value={m.monto} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, monto: Number(e.target.value) || 0 } : x))} />
                      </div>

                      {(m.medio_pago === 'cheque_al_dia' || m.medio_pago === 'cheque_diferido') && (
                        <div className="grid grid-cols-3 gap-2">
                          <input className="input" placeholder="N° cheque" value={m.numero_cheque || ''} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, numero_cheque: e.target.value } : x))} />
                          <input className="input" placeholder="Banco emisor" value={m.banco_emisor || ''} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, banco_emisor: e.target.value } : x))} />
                          <input type="date" className="input" value={m.fecha_cheque || ''} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, fecha_cheque: e.target.value } : x))} />
                        </div>
                      )}

                      {m.medio_pago === 'transferencia' && (
                        <input className="input" placeholder="N° transacción" value={m.numero_transaccion || ''} onChange={(e) => setMedios((prev) => prev.map((x, i) => i === idx ? { ...x, numero_transaccion: e.target.value } : x))} />
                      )}
                    </div>
                  ))}

                  <div className="text-sm border-t pt-3">
                    <div className="flex justify-between"><span>Total facturas</span><strong>{formatCurrency(totalFacturas)}</strong></div>
                    <div className="flex justify-between"><span>Total medios</span><strong>{formatCurrency(totalMedios)}</strong></div>
                    <div className={`flex justify-between ${Math.abs(diferencia) <= 1 ? 'text-emerald-600' : 'text-amber-600'}`}>
                      <span>Diferencia</span><strong>{formatCurrency(diferencia)}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={guardarCobro} disabled={saving} className="btn-primary">{saving ? 'Guardando...' : 'Guardar cobro'}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
