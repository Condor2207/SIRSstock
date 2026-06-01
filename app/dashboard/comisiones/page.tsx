'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Search, Loader2, BadgePercent, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';
import type { Vendedor } from '@/lib/types';

export default function ComisionesPage() {
  const supabase = createClient();
  const [comisiones, setComisiones] = useState<any[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroVendedor, setFiltroVendedor] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');
  const [fechaDesde, setFechaDesde] = useState(() => {
    const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0];
  });
  const [fechaHasta, setFechaHasta] = useState(() => new Date().toISOString().split('T')[0]);

  const load = useCallback(async () => {
    setLoading(true);
    const q = supabase.from('comisiones')
      .select('*, vendedores(nombre), clientes(nombre), productos(nombre, sku), ventas(numero)')
      .order('fecha', { ascending: false })
      .limit(500);
    const { data } = await q;
    setComisiones(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase.from('vendedores').select('*').eq('activo', true).order('nombre').then(r => setVendedores(r.data as Vendedor[] || []));
  }, [load]);

  async function marcarPagada(id: string) {
    await supabase.from('comisiones').update({ estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] }).eq('id', id);
    toast.success('Comisión marcada como pagada');
    load();
  }

  async function marcarSeleccionPagada() {
    const pendientes = filtered.filter(c => c.estado === 'pendiente').map(c => c.id);
    if (pendientes.length === 0) { toast.error('No hay comisiones pendientes en la selección actual'); return; }
    await supabase.from('comisiones').update({ estado: 'pagada', fecha_pago: new Date().toISOString().split('T')[0] }).in('id', pendientes);
    toast.success(`${pendientes.length} comisiones marcadas como pagadas`);
    load();
  }

  const filtered = comisiones.filter(c => {
    if (filtroVendedor && c.vendedor_id !== filtroVendedor) return false;
    if (filtroEstado && c.estado !== filtroEstado) return false;
    if (fechaDesde && c.fecha && c.fecha < fechaDesde) return false;
    if (fechaHasta && c.fecha && c.fecha > fechaHasta) return false;
    return true;
  });

  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filtered);
  const { paginated: filteredPage, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);
  const totalPagado = filtered.filter(c => c.estado === 'pagada').reduce((s, c) => s + c.monto, 0);

  // Agrupar totales por vendedor para el resumen
  const resumenVendedores = vendedores.map(v => {
    const mis = comisiones.filter(c => c.vendedor_id === v.id);
    return { nombre: v.nombre, pendiente: mis.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.monto, 0), pagado: mis.filter(c => c.estado === 'pagada').reduce((s, c) => s + c.monto, 0) };
  }).filter(v => v.pendiente + v.pagado > 0);

  return (
    <>
      <Header title="Comisiones" subtitle="Seguimiento de comisiones a vendedores" />
      <div className="p-4 md:p-6 space-y-4">

        {/* Resumen por vendedor */}
        {resumenVendedores.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {resumenVendedores.map(v => (
              <div key={v.nombre} className="card p-4 space-y-1">
                <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{v.nombre}</p>
                <p className="text-xs text-gray-500">Pendiente: <span className="text-yellow-600 font-bold">{formatCurrency(v.pendiente)}</span></p>
                <p className="text-xs text-gray-500">Pagado: <span className="text-emerald-600 font-bold">{formatCurrency(v.pagado)}</span></p>
              </div>
            ))}
          </div>
        )}

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="label text-xs">Vendedor</label>
            <select className="input" value={filtroVendedor} onChange={e => setFiltroVendedor(e.target.value)}>
              <option value="">Todos</option>
              {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
            </select>
          </div>
          <div>
            <label className="label text-xs">Estado</label>
            <select className="input" value={filtroEstado} onChange={e => setFiltroEstado(e.target.value)}>
              <option value="">Todos</option>
              <option value="pendiente">Pendiente</option>
              <option value="pagada">Pagada</option>
            </select>
          </div>
          <div>
            <label className="label text-xs">Fecha desde</label>
            <input type="date" className="input" value={fechaDesde} onChange={e => setFechaDesde(e.target.value)} />
          </div>
          <div>
            <label className="label text-xs">Fecha hasta</label>
            <input type="date" className="input" value={fechaHasta} onChange={e => setFechaHasta(e.target.value)} />
          </div>
          {filtered.some(c => c.estado === 'pendiente') && (
            <button onClick={marcarSeleccionPagada} className="btn-primary flex items-center gap-2">
              <CheckCircle className="w-4 h-4" /> Marcar filtro como pagado
            </button>
          )}
        </div>

        {/* Totales filtrados */}
        <div className="flex gap-4 text-sm">
          <span className="text-yellow-600 font-semibold">Pendiente: {formatCurrency(totalPendiente)}</span>
          <span className="text-emerald-600 font-semibold">Pagado: {formatCurrency(totalPagado)}</span>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <BadgePercent className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin comisiones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Venta" sortKey="ventas" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Vendedor" sortKey="vendedores" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Producto</th>
                    <SortableTh label="Cant." sortKey="cantidad" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="P. s/IVA" sortKey="precio_sin_iva" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header">%</th>
                    <SortableTh label="Monto" sortKey="monto" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Estado" sortKey="estado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filteredPage.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell text-xs">{formatDate(c.fecha)}</td>
                      <td className="table-cell font-mono text-xs text-blue-600">{c.ventas?.numero || '—'}</td>
                      <td className="table-cell">{c.vendedores?.nombre || '—'}</td>
                      <td className="table-cell text-xs">{c.clientes?.nombre || '—'}</td>
                      <td className="table-cell text-xs">{c.productos?.sku} {c.productos?.nombre}</td>
                      <td className="table-cell">{c.cantidad}</td>
                      <td className="table-cell">{formatCurrency(c.precio_sin_iva)}</td>
                      <td className="table-cell">{c.porcentaje}%</td>
                      <td className="table-cell font-semibold text-emerald-600">{formatCurrency(c.monto)}</td>
                      <td className="table-cell">
                        <span className={`badge ${c.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30' : 'bg-green-100 text-green-700 dark:bg-green-900/30'}`}>{c.estado}</span>
                      </td>
                      <td className="table-cell">
                        {c.estado === 'pendiente' && (
                          <button onClick={() => marcarPagada(c.id)} className="p-1.5 rounded hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-500 hover:text-green-600" title="Marcar pagada">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
