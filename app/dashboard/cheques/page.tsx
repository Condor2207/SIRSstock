'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatDate, formatMonto, getErrorMessage, estadoBadgeClass, formatNumeroFactura } from '@/lib/utils';
import { Loader2, Landmark } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchSelect } from '@/components/SearchSelect';
import type { Cliente } from '@/lib/types';

const ESTADOS = ['pendiente', 'depositado', 'cobrado', 'rechazado', 'anulado'] as const;
type Estado = typeof ESTADOS[number];
// Transiciones permitidas; rechazado/anulado son finales y devuelven la deuda a las facturas
const TRANSICIONES: Record<Estado, Estado[]> = {
  pendiente: ['depositado', 'cobrado', 'rechazado', 'anulado'],
  depositado: ['cobrado', 'rechazado', 'anulado'],
  cobrado: [],
  rechazado: [],
  anulado: [],
};

interface Cheque {
  id: string; cliente_id: string; banco_emisor: string; numero_cheque: string; monto: number; moneda: 'GS' | 'USD';
  fecha_emision: string; fecha_cobro: string; estado: Estado; observaciones?: string;
  clientes?: { nombre: string } | null;
  cheque_diferido_ventas?: { venta_id: string; monto_aplicado: number; ventas?: { numero: string; numero_factura?: string } | null }[];
}

export default function ChequesPage() {
  const supabase = createClient();
  const [cheques, setCheques] = useState<Cheque[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [fCliente, setFCliente] = useState('');
  const [fEstado, setFEstado] = useState('');
  const [fDesde, setFDesde] = useState('');
  const [fHasta, setFHasta] = useState('');
  const [fMontoMin, setFMontoMin] = useState('');
  const [fMontoMax, setFMontoMax] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [chRes, cliRes] = await Promise.all([
      supabase.from('cheques_diferidos')
        .select('*, clientes(nombre), cheque_diferido_ventas(venta_id, monto_aplicado, ventas(numero, numero_factura))')
        .order('fecha_cobro', { ascending: true }),
      supabase.from('clientes').select('id, nombre, documento').order('nombre'),
    ]);
    if (chRes.error) toast.error(getErrorMessage(chRes.error) || 'No se pudieron cargar los cheques (¿migración 019 aplicada?)');
    setCheques((chRes.data || []) as unknown as Cheque[]);
    setClientes((cliRes.data || []) as Cliente[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtrados = useMemo(() => cheques.filter(c => {
    if (fCliente && c.cliente_id !== fCliente) return false;
    if (fEstado && c.estado !== fEstado) return false;
    if (fDesde && c.fecha_cobro < fDesde) return false;
    if (fHasta && c.fecha_cobro > fHasta) return false;
    if (fMontoMin && Number(c.monto) < Number(fMontoMin)) return false;
    if (fMontoMax && Number(c.monto) > Number(fMontoMax)) return false;
    return true;
  }), [cheques, fCliente, fEstado, fDesde, fHasta, fMontoMin, fMontoMax]);

  async function cambiarEstado(c: Cheque, nuevo: Estado) {
    if (!TRANSICIONES[c.estado].includes(nuevo)) return;
    const devuelveDeuda = nuevo === 'rechazado' || nuevo === 'anulado';
    const msg = devuelveDeuda
      ? `¿Marcar el cheque ${c.numero_cheque} como ${nuevo}? Se restituirá la deuda en las facturas asociadas. Esta acción no se puede revertir.`
      : `¿Marcar el cheque ${c.numero_cheque} como ${nuevo}?`;
    if (!window.confirm(msg)) return;
    try {
      const { error } = await supabase.from('cheques_diferidos')
        .update({ estado: nuevo, updated_at: new Date().toISOString() })
        .eq('id', c.id).eq('estado', c.estado);
      if (error) throw error;
      if (devuelveDeuda) {
        let total = 0;
        for (const a of c.cheque_diferido_ventas || []) {
          const { data: v } = await supabase.from('ventas').select('saldo_pendiente, total').eq('id', a.venta_id).single();
          if (!v) continue;
          const saldo = Math.min(Number(v.total), Number(v.saldo_pendiente || 0) + Number(a.monto_aplicado));
          const estado = saldo <= 0 ? 'pagado' : saldo < Number(v.total) ? 'parcial' : 'pendiente';
          await supabase.from('ventas').update({ saldo_pendiente: saldo, estado }).eq('id', a.venta_id);
          total += Number(a.monto_aplicado);
        }
        if (total > 0 && c.moneda === 'GS') {
          const { data: cli } = await supabase.from('clientes').select('saldo_pendiente').eq('id', c.cliente_id).single();
          if (cli) await supabase.from('clientes').update({ saldo_pendiente: Number(cli.saldo_pendiente || 0) + total }).eq('id', c.cliente_id);
        }
      }
      await logAudit(supabase, { modulo: 'Cheques', entidad: 'Cheque diferido', accion: 'editar', descripcion: `Cheque ${c.numero_cheque}: ${c.estado} → ${nuevo}`, registroId: c.id });
      toast.success(`Cheque ${nuevo}`);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e) || 'No se pudo actualizar el cheque');
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <>
      <Header title="Cheques diferidos" subtitle="Seguimiento de cheques recibidos de clientes" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="card p-4 grid sm:grid-cols-2 lg:grid-cols-6 gap-3">
          <div className="lg:col-span-2">
            <label className="label text-xs">Cliente</label>
            <SearchSelect
              options={[{ value: '', label: 'Todos' }, ...clientes.map(c => ({ value: c.id, label: c.nombre }))]}
              value={fCliente} onChange={setFCliente} placeholder="Todos los clientes"
            />
          </div>
          <div>
            <label className="label text-xs">Estado</label>
            <select className="input py-1.5" value={fEstado} onChange={e => setFEstado(e.target.value)}>
              <option value="">Todos</option>
              {ESTADOS.map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Cobro desde</label>
            <input type="date" className="input py-1.5" value={fDesde} onChange={e => setFDesde(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Cobro hasta</label>
            <input type="date" className="input py-1.5" value={fHasta} onChange={e => setFHasta(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="label text-xs">Monto mín.</label>
              <input type="number" min="0" className="input py-1.5" value={fMontoMin} onChange={e => setFMontoMin(e.target.value)} />
            </div>
            <div>
              <label className="label text-xs">Monto máx.</label>
              <input type="number" min="0" className="input py-1.5" value={fMontoMax} onChange={e => setFMontoMax(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center text-gray-400"><Landmark className="w-10 h-10 mx-auto mb-2 opacity-40" /><p>No hay cheques diferidos</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Banco</th>
                    <th className="table-header">N° cheque</th>
                    <th className="table-header">Monto</th>
                    <th className="table-header">Emisión</th>
                    <th className="table-header">Cobro</th>
                    <th className="table-header">Facturas</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtrados.map(c => {
                    const vencido = ['pendiente', 'depositado'].includes(c.estado) && c.fecha_cobro < hoy;
                    return (
                      <tr key={c.id} title={c.observaciones || undefined}>
                        <td className="table-cell font-medium">{c.clientes?.nombre || '—'}</td>
                        <td className="table-cell">{c.banco_emisor}</td>
                        <td className="table-cell font-mono text-xs">{c.numero_cheque}</td>
                        <td className="table-cell font-semibold">{formatMonto(Number(c.monto), c.moneda)} <span className="text-[10px] text-gray-400">{c.moneda}</span></td>
                        <td className="table-cell text-sm">{formatDate(c.fecha_emision)}</td>
                        <td className={`table-cell text-sm ${vencido ? 'text-red-600 font-semibold' : ''}`}>{formatDate(c.fecha_cobro)}{vencido && ' (vencido)'}</td>
                        <td className="table-cell text-xs">
                          {(c.cheque_diferido_ventas || []).map(a => (
                            <div key={a.venta_id}>{a.ventas?.numero_factura ? formatNumeroFactura(a.ventas.numero_factura) : a.ventas?.numero}</div>
                          ))}
                        </td>
                        <td className="table-cell"><span className={`badge ${estadoBadgeClass(c.estado === 'cobrado' ? 'pagado' : c.estado === 'rechazado' ? 'anulado' : c.estado)} capitalize`}>{c.estado}</span></td>
                        <td className="table-cell">
                          {TRANSICIONES[c.estado].length > 0 && (
                            <select className="input py-1 text-xs w-32" value="" onChange={e => e.target.value && cambiarEstado(c, e.target.value as Estado)}>
                              <option value="">Cambiar estado…</option>
                              {TRANSICIONES[c.estado].map(e => <option key={e} value={e} className="capitalize">{e}</option>)}
                            </select>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
