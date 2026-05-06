'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDateTime, estadoBadgeClass } from '@/lib/utils';
import { Plus, Search, Eye, X, Loader2, ShoppingCart } from 'lucide-react';
import Link from 'next/link';
import type { Venta } from '@/lib/types';

export default function VentasPage() {
  const supabase = createClient();
  const [ventas, setVentas] = useState<Venta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [detalle, setDetalle] = useState<Venta | null>(null);
  const [filtroEstado, setFiltroEstado] = useState('');

  const loadVentas = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('ventas')
      .select('*, clientes(nombre, documento)')
      .order('created_at', { ascending: false })
      .limit(200);
    setVentas(data as Venta[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadVentas(); }, [loadVentas]);

  async function openDetalle(venta: Venta) {
    const { data } = await supabase
      .from('ventas')
      .select('*, clientes(*), venta_items(*, productos(nombre, sku)), venta_cuotas(*), venta_pagos(*)')
      .eq('id', venta.id)
      .single();
    setDetalle(data as Venta);
  }

  async function anularVenta(id: string) {
    if (!confirm('¿Anular esta venta?')) return;
    await supabase.from('ventas').update({ estado: 'anulado' }).eq('id', id);
    loadVentas();
  }

  async function registrarPago(ventaId: string, monto: number, medioPago: string) {
    await supabase.from('venta_pagos').insert({ venta_id: ventaId, monto, medio_pago: medioPago, fecha: new Date().toISOString().split('T')[0] });
    // actualizar saldo pendiente
    const venta = ventas.find(v => v.id === ventaId);
    if (venta) {
      const nuevoSaldo = Math.max(0, venta.saldo_pendiente - monto);
      const nuevoEstado = nuevoSaldo === 0 ? 'pagado' : 'parcial';
      await supabase.from('ventas').update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado }).eq('id', ventaId);
      // actualizar saldo del cliente
      try { await supabase.rpc('update_cliente_saldo' as any, { p_cliente_id: venta.cliente_id, p_monto: -monto }); } catch { /* ignorar */ }
    }
    loadVentas();
    setDetalle(null);
  }

  const filtered = ventas.filter(v => {
    const term = search.toLowerCase();
    const matchSearch = v.numero?.toLowerCase().includes(term) || (v as any).clientes?.nombre?.toLowerCase().includes(term);
    const matchEstado = filtroEstado ? v.estado === filtroEstado : true;
    return matchSearch && matchEstado;
  });

  return (
    <>
      <Header title="Ventas" subtitle="Registro de ventas al contado y a crédito" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9 w-56" placeholder="Buscar N° o cliente..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos los estados</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagado">Pagado</option>
              <option value="parcial">Parcial</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
          <Link href="/dashboard/ventas/nueva" className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva venta
          </Link>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ShoppingCart className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No hay ventas registradas</p>
              <Link href="/dashboard/ventas/nueva" className="btn-primary mt-4 inline-flex items-center gap-2">
                <Plus className="w-4 h-4" /> Registrar primera venta
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">N° Venta</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Condición</th>
                    <th className="table-header">Total</th>
                    <th className="table-header">Saldo</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(v => (
                    <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{v.numero}</td>
                      <td className="table-cell text-xs">{formatDateTime(v.fecha)}</td>
                      <td className="table-cell font-medium">{(v as any).clientes?.nombre || '-'}</td>
                      <td className="table-cell">
                        <span className={`badge ${estadoBadgeClass(v.condicion_pago)}`}>{v.condicion_pago}</span>
                      </td>
                      <td className="table-cell font-semibold">{formatCurrency(v.total)}</td>
                      <td className="table-cell">
                        {v.saldo_pendiente > 0 ? (
                          <span className="text-red-500 font-semibold">{formatCurrency(v.saldo_pendiente)}</span>
                        ) : (
                          <span className="text-emerald-500">$0</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${estadoBadgeClass(v.estado)}`}>{v.estado}</span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openDetalle(v)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
                          {v.estado !== 'anulado' && (
                            <button onClick={() => anularVenta(v.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-gray-500 hover:text-red-600 text-xs" title="Anular">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="section-title">Venta {detalle.numero}</h2>
                <p className="text-sm text-gray-500">{formatDateTime(detalle.fecha)}</p>
              </div>
              <button onClick={() => setDetalle(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">Cliente:</span> <strong>{(detalle as any).clientes?.nombre}</strong></div>
                <div><span className="text-gray-500">Condición:</span> <span className={`badge ml-1 ${estadoBadgeClass(detalle.condicion_pago)}`}>{detalle.condicion_pago}</span></div>
                {detalle.numero_factura && <div><span className="text-gray-500">Factura:</span> <strong>{detalle.numero_factura}</strong></div>}
                {detalle.condicion_pago === 'credito' && <div><span className="text-gray-500">Cuotas:</span> <strong>{detalle.cantidad_cuotas}</strong></div>}
              </div>

              <div>
                <h3 className="text-sm font-semibold mb-2">Productos</h3>
                <table className="w-full text-sm border rounded-lg overflow-hidden">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="table-header">Producto</th>
                      <th className="table-header">Lote</th>
                      <th className="table-header">Cant.</th>
                      <th className="table-header">P.Unit.</th>
                      <th className="table-header">Subtotal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {detalle.venta_items?.map(item => (
                      <tr key={item.id}>
                        <td className="table-cell">{item.descripcion}</td>
                        <td className="table-cell font-mono text-xs">{item.numero_lote || '-'}</td>
                        <td className="table-cell">{item.cantidad}</td>
                        <td className="table-cell">{formatCurrency(item.precio_unitario)}</td>
                        <td className="table-cell font-semibold">{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex justify-end">
                <div className="text-right space-y-1">
                  {detalle.descuento > 0 && <div className="text-sm text-gray-500">Descuento: -{formatCurrency(detalle.descuento)}</div>}
                  <div className="text-lg font-bold">Total: {formatCurrency(detalle.total)}</div>
                  {detalle.saldo_pendiente > 0 && <div className="text-red-500 font-semibold">Saldo: {formatCurrency(detalle.saldo_pendiente)}</div>}
                </div>
              </div>

              {/* Cuotas */}
              {detalle.venta_cuotas && detalle.venta_cuotas.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold mb-2">Cuotas</h3>
                  <div className="space-y-1">
                    {detalle.venta_cuotas.map(c => (
                      <div key={c.id} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-gray-800 rounded text-sm">
                        <span>Cuota {c.numero_cuota} - Vence {formatDateTime(c.fecha_vencimiento)}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{formatCurrency(c.monto)}</span>
                          <span className={`badge ${estadoBadgeClass(c.estado)}`}>{c.estado}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Registrar pago rápido */}
              {detalle.saldo_pendiente > 0 && detalle.estado !== 'anulado' && (
                <div className="border-t border-gray-100 dark:border-gray-700 pt-4">
                  <h3 className="text-sm font-semibold mb-2">Registrar pago</h3>
                  <div className="flex gap-2 flex-wrap">
                    {(['efectivo', 'transferencia', 'cheque', 'tarjeta'] as const).map(medio => (
                      <button
                        key={medio}
                        onClick={() => registrarPago(detalle.id, detalle.saldo_pendiente, medio)}
                        className="btn-success text-xs py-1.5 px-3 capitalize"
                      >
                        Pago total ({medio})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
