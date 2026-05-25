'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type ComisionRow = {
  id: string;
  fecha: string;
  numero_factura: string | null;
  precio_sin_iva: number;
  cantidad: number;
  porcentaje: number;
  monto: number;
  estado: 'pendiente' | 'pagada';
  vendedor_id: string;
  vendedor: { nombre: string } | null;
  cliente: { nombre: string } | null;
  producto: { nombre: string } | null;
};

export default function ComisionesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<ComisionRow[]>([]);
  const [vendedorId, setVendedorId] = useState('');
  const [estado, setEstado] = useState('');
  const [desde, setDesde] = useState('');
  const [hasta, setHasta] = useState('');
  const [selected, setSelected] = useState<string[]>([]);

  const loadData = useCallback(async () => {
    setLoading(true);
    let query = supabase
      .from('comisiones')
      .select('id, fecha, numero_factura, precio_sin_iva, cantidad, porcentaje, monto, estado, vendedor_id, vendedor:vendedores(nombre), cliente:clientes(nombre), producto:productos(nombre)')
      .order('fecha', { ascending: false })
      .limit(500);

    if (vendedorId) query = query.eq('vendedor_id', vendedorId);
    if (estado) query = query.eq('estado', estado);
    if (desde) query = query.gte('fecha', desde);
    if (hasta) query = query.lte('fecha', hasta);

    const { data } = await query;
    setRows((data || []) as unknown as ComisionRow[]);
    setSelected([]);
    setLoading(false);
  }, [supabase, vendedorId, estado, desde, hasta]);

  useEffect(() => { loadData(); }, [loadData]);

  const vendedores = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(r.vendedor_id, r.vendedor?.nombre || 'Sin nombre'));
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [rows]);

  const resumen = useMemo(() => {
    const acc: Record<string, { vendedor: string; facturas: Set<string>; productos: number; pendiente: number; pagada: number }> = {};
    rows.forEach((r) => {
      const key = r.vendedor_id;
      if (!acc[key]) acc[key] = { vendedor: r.vendedor?.nombre || 'Sin vendedor', facturas: new Set(), productos: 0, pendiente: 0, pagada: 0 };
      acc[key].productos += 1;
      if (r.numero_factura) acc[key].facturas.add(r.numero_factura);
      if (r.estado === 'pendiente') acc[key].pendiente += Number(r.monto);
      if (r.estado === 'pagada') acc[key].pagada += Number(r.monto);
    });
    return Object.values(acc).map((r) => ({ ...r, facturas: r.facturas.size }));
  }, [rows]);

  async function marcarPagadas() {
    if (selected.length === 0) return;
    await supabase.from('comisiones').update({ estado: 'pagada', fecha_pago: new Date().toISOString().slice(0, 10) }).in('id', selected);
    await loadData();
  }

  return (
    <>
      <Header title="Comisiones" subtitle="Comisiones por vendedor y estado de liquidación" />
      <div className="p-6 space-y-4">
        <div className="card p-4 grid grid-cols-1 md:grid-cols-5 gap-2">
          <select className="input" value={vendedorId} onChange={(e) => setVendedorId(e.target.value)}>
            <option value="">Todos los vendedores</option>
            {vendedores.map((v) => <option key={v.id} value={v.id}>{v.nombre}</option>)}
          </select>
          <input type="date" className="input" value={desde} onChange={(e) => setDesde(e.target.value)} />
          <input type="date" className="input" value={hasta} onChange={(e) => setHasta(e.target.value)} />
          <select className="input" value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="pagada">Pagada</option>
          </select>
          <button onClick={marcarPagadas} disabled={selected.length === 0} className="btn-primary">Marcar pagadas ({selected.length})</button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-40"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : rows.length === 0 ? (
            <div className="p-10 text-center text-gray-400">No hay comisiones para los filtros seleccionados.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">Sel.</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Vendedor</th>
                    <th className="table-header">Cliente</th>
                    <th className="table-header">Factura</th>
                    <th className="table-header">Producto</th>
                    <th className="table-header">Precio s/IVA</th>
                    <th className="table-header">Cant.</th>
                    <th className="table-header">% Comisión</th>
                    <th className="table-header">Monto</th>
                    <th className="table-header">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td className="table-cell"><input type="checkbox" checked={selected.includes(r.id)} onChange={(e) => setSelected((prev) => e.target.checked ? [...prev, r.id] : prev.filter((id) => id !== r.id))} /></td>
                      <td className="table-cell">{formatDate(r.fecha)}</td>
                      <td className="table-cell">{r.vendedor?.nombre || '-'}</td>
                      <td className="table-cell">{r.cliente?.nombre || '-'}</td>
                      <td className="table-cell font-mono text-xs">{r.numero_factura || '-'}</td>
                      <td className="table-cell">{r.producto?.nombre || '-'}</td>
                      <td className="table-cell">{formatCurrency(r.precio_sin_iva)}</td>
                      <td className="table-cell">{r.cantidad}</td>
                      <td className="table-cell">{r.porcentaje}%</td>
                      <td className="table-cell font-semibold">{formatCurrency(r.monto)}</td>
                      <td className="table-cell">
                        <span className={`badge ${r.estado === 'pendiente' ? 'bg-yellow-100 text-yellow-700' : 'bg-emerald-100 text-emerald-700'}`}>{r.estado}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3">Resumen por vendedor</h3>
          <div className="grid md:grid-cols-2 gap-3">
            {resumen.length === 0 ? (
              <p className="text-sm text-gray-500">Sin datos.</p>
            ) : resumen.map((r) => (
              <div key={r.vendedor} className="border rounded-lg p-3 text-sm">
                <div className="font-semibold">{r.vendedor}</div>
                <div>Facturas: <strong>{r.facturas}</strong></div>
                <div>Productos: <strong>{r.productos}</strong></div>
                <div>Pendiente: <strong className="text-yellow-700">{formatCurrency(r.pendiente)}</strong></div>
                <div>Liquidado: <strong className="text-emerald-700">{formatCurrency(r.pagada)}</strong></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
