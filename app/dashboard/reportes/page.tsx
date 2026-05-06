'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, formatNumber, diasHastaVencimiento, estadoVencimiento } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { Download, BarChart2, Package, Users, AlertTriangle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

type TabType = 'ventas' | 'stock' | 'cobrar' | 'vencimientos';

export default function ReportesPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<TabType>('ventas');
  const [loading, setLoading] = useState(false);
  const [desde, setDesde] = useState(() => {
    const d = new Date(); d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [hasta, setHasta] = useState(() => new Date().toISOString().split('T')[0]);
  const [ventasData, setVentasData] = useState<any[]>([]);
  const [stockData, setStockData] = useState<any[]>([]);
  const [cobrarData, setCobrarData] = useState<any[]>([]);
  const [vencimientosData, setVencimientosData] = useState<any[]>([]);

  useEffect(() => { loadData(); }, [tab, desde, hasta]);

  async function loadData() {
    setLoading(true);
    try {
      if (tab === 'ventas') {
        const { data } = await supabase
          .from('ventas')
          .select('fecha, total, estado')
          .gte('fecha', desde)
          .lte('fecha', hasta)
          .order('fecha');
        // Agrupar por día
        const byDay: Record<string, { fecha: string; total: number; qty: number }> = {};
        for (const v of data || []) {
          const d = v.fecha.slice(0, 10);
          if (!byDay[d]) byDay[d] = { fecha: d, total: 0, qty: 0 };
          byDay[d].total += v.total;
          byDay[d].qty += 1;
        }
        setVentasData(Object.values(byDay));
      } else if (tab === 'stock') {
        const { data } = await supabase
          .from('productos')
          .select('sku, nombre, stock_actual, stock_minimo, unidad')
          .eq('activo', true)
          .order('stock_actual');
        setStockData(data || []);
      } else if (tab === 'cobrar') {
        const { data } = await supabase
          .from('clientes')
          .select('nombre, documento, telefono, limite_credito, saldo_pendiente')
          .gt('saldo_pendiente', 0)
          .order('saldo_pendiente', { ascending: false });
        setCobrarData(data || []);
      } else if (tab === 'vencimientos') {
        const { data } = await supabase
          .from('lotes')
          .select('numero_lote, fecha_vencimiento, stock_actual, productos(nombre, sku)')
          .gt('stock_actual', 0)
          .not('fecha_vencimiento', 'is', null)
          .order('fecha_vencimiento');
        setVencimientosData(data || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }

  function exportCSV() {
    let rows: string[][] = [];
    let filename = 'reporte';

    if (tab === 'ventas') {
      filename = `ventas_${desde}_${hasta}`;
      rows = [['Fecha', 'Total ($)', 'Cantidad ventas'], ...ventasData.map(v => [v.fecha, v.total.toFixed(2), v.qty])];
    } else if (tab === 'stock') {
      filename = 'stock_actual';
      rows = [['SKU', 'Producto', 'Stock actual', 'Stock mínimo', 'Unidad'], ...stockData.map(p => [p.sku, p.nombre, p.stock_actual, p.stock_minimo, p.unidad])];
    } else if (tab === 'cobrar') {
      filename = 'cuentas_cobrar';
      rows = [['Cliente', 'Documento', 'Teléfono', 'Límite crédito', 'Saldo pendiente'], ...cobrarData.map(c => [c.nombre, c.documento || '', c.telefono || '', c.limite_credito, c.saldo_pendiente])];
    } else if (tab === 'vencimientos') {
      filename = 'lotes_vencimiento';
      rows = [['Producto', 'SKU', 'Lote', 'Vencimiento', 'Stock', 'Días restantes'],
        ...vencimientosData.map(l => [(l as any).productos?.nombre, (l as any).productos?.sku, l.numero_lote, l.fecha_vencimiento, l.stock_actual, diasHastaVencimiento(l.fecha_vencimiento)])];
    }

    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exportado');
  }

  const totalVentas = ventasData.reduce((s, v) => s + v.total, 0);
  const totalCantVentas = ventasData.reduce((s, v) => s + v.qty, 0);
  const totalCobrar = cobrarData.reduce((s, c) => s + c.saldo_pendiente, 0);
  const stockBajo = stockData.filter(p => p.stock_actual <= p.stock_minimo);
  const lotesUrgentes = vencimientosData.filter(l => {
    const dias = diasHastaVencimiento(l.fecha_vencimiento);
    return typeof dias === 'number' && dias <= 30;
  });

  const tabs: { id: TabType; label: string; icon: any }[] = [
    { id: 'ventas', label: 'Ventas por período', icon: BarChart2 },
    { id: 'stock', label: 'Stock actual', icon: Package },
    { id: 'cobrar', label: 'Cuentas a cobrar', icon: Users },
    { id: 'vencimientos', label: 'Lotes por vencer', icon: AlertTriangle },
  ];

  return (
    <>
      <Header title="Reportes" subtitle="Reportes y análisis del sistema" />
      <div className="p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-xl w-full overflow-x-auto">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${tab === t.id ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Filtros de fecha */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          {(tab === 'ventas') && (
            <div className="flex items-center gap-2 text-sm">
              <label className="text-gray-500">Desde</label>
              <input type="date" className="input py-1.5 w-36" value={desde} onChange={e => setDesde(e.target.value)} />
              <label className="text-gray-500">Hasta</label>
              <input type="date" className="input py-1.5 w-36" value={hasta} onChange={e => setHasta(e.target.value)} />
            </div>
          )}
          <button onClick={exportCSV} className="btn-secondary flex items-center gap-2 text-sm ml-auto">
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
        ) : (
          <>
            {/* VENTAS */}
            {tab === 'ventas' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Total facturado</p>
                    <p className="text-2xl font-bold text-emerald-600">{formatCurrency(totalVentas)}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Cantidad de ventas</p>
                    <p className="text-2xl font-bold">{totalCantVentas}</p>
                  </div>
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Ticket promedio</p>
                    <p className="text-2xl font-bold">{totalCantVentas > 0 ? formatCurrency(totalVentas / totalCantVentas) : '$0'}</p>
                  </div>
                </div>
                {ventasData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">Sin ventas en el período seleccionado</div>
                ) : (
                  <div className="card p-5">
                    <h3 className="font-semibold mb-4">Ventas diarias — {formatDate(desde)} al {formatDate(hasta)}</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={ventasData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${(v / 1000).toFixed(0)}k`} />
                        <Tooltip formatter={(val: number) => formatCurrency(val)} labelFormatter={d => formatDate(d)} />
                        <Bar dataKey="total" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Total ventas" />
                      </BarChart>
                    </ResponsiveContainer>
                    <ResponsiveContainer width="100%" height={180} className="mt-4">
                      <LineChart data={ventasData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="fecha" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip labelFormatter={d => formatDate(d)} />
                        <Line dataKey="qty" stroke="#10b981" strokeWidth={2} dot={false} name="Cantidad ventas" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
            )}

            {/* STOCK */}
            {tab === 'stock' && (
              <div className="space-y-4">
                {stockBajo.length > 0 && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800 rounded-lg text-sm text-amber-700 dark:text-amber-300">
                    ⚠ {stockBajo.length} producto(s) con stock por debajo del mínimo
                  </div>
                )}
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-800/50">
                      <tr>
                        <th className="table-header">SKU</th>
                        <th className="table-header">Producto</th>
                        <th className="table-header">Stock actual</th>
                        <th className="table-header">Stock mínimo</th>
                        <th className="table-header">Unidad</th>
                        <th className="table-header">Estado</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {stockData.map((p, i) => (
                        <tr key={i} className={p.stock_actual <= p.stock_minimo ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                          <td className="table-cell font-mono text-xs font-bold">{p.sku}</td>
                          <td className="table-cell font-medium">{p.nombre}</td>
                          <td className="table-cell font-bold text-lg">{formatNumber(p.stock_actual, 1)}</td>
                          <td className="table-cell text-gray-500">{formatNumber(p.stock_minimo, 1)}</td>
                          <td className="table-cell text-xs text-gray-500">{p.unidad}</td>
                          <td className="table-cell">
                            {p.stock_actual <= 0
                              ? <span className="badge bg-red-100 text-red-700">Sin stock</span>
                              : p.stock_actual <= p.stock_minimo
                              ? <span className="badge bg-amber-100 text-amber-700">Stock bajo</span>
                              : <span className="badge bg-emerald-100 text-emerald-700">Normal</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* CUENTAS A COBRAR */}
            {tab === 'cobrar' && (
              <div className="space-y-4">
                {cobrarData.length > 0 && (
                  <div className="card p-4">
                    <p className="text-sm text-gray-500">Total cuentas a cobrar</p>
                    <p className="text-2xl font-bold text-red-500">{formatCurrency(totalCobrar)}</p>
                  </div>
                )}
                {cobrarData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">No hay saldos pendientes</div>
                ) : (
                  <div className="card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="table-header">Cliente</th>
                          <th className="table-header">Documento</th>
                          <th className="table-header">Teléfono</th>
                          <th className="table-header">Límite crédito</th>
                          <th className="table-header">Saldo pendiente</th>
                          <th className="table-header">% usado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {cobrarData.map((c, i) => {
                          const pct = c.limite_credito > 0 ? (c.saldo_pendiente / c.limite_credito) * 100 : 100;
                          return (
                            <tr key={i}>
                              <td className="table-cell font-medium">{c.nombre}</td>
                              <td className="table-cell text-xs text-gray-500">{c.documento || '-'}</td>
                              <td className="table-cell text-sm">{c.telefono || '-'}</td>
                              <td className="table-cell">{formatCurrency(c.limite_credito)}</td>
                              <td className="table-cell font-bold text-red-500">{formatCurrency(c.saldo_pendiente)}</td>
                              <td className="table-cell">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-2 bg-gray-200 rounded-full">
                                    <div className={`h-2 rounded-full ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(100, pct)}%` }} />
                                  </div>
                                  <span className="text-xs font-semibold w-12 text-right">{pct.toFixed(0)}%</span>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* VENCIMIENTOS */}
            {tab === 'vencimientos' && (
              <div className="space-y-4">
                {lotesUrgentes.length > 0 && (
                  <div className="p-3 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
                    🔴 {lotesUrgentes.length} lote(s) vencen en los próximos 30 días
                  </div>
                )}
                {vencimientosData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">Sin lotes activos con fecha de vencimiento</div>
                ) : (
                  <div className="card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="table-header">Producto</th>
                          <th className="table-header">SKU</th>
                          <th className="table-header">N° Lote</th>
                          <th className="table-header">Vencimiento</th>
                          <th className="table-header">Stock</th>
                          <th className="table-header">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {vencimientosData.map((l, i) => {
                          const info = estadoVencimiento(l.fecha_vencimiento);
                          return (
                            <tr key={i} className={info.urgent ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                              <td className="table-cell font-medium">{(l as any).productos?.nombre}</td>
                              <td className="table-cell font-mono text-xs">{(l as any).productos?.sku}</td>
                              <td className="table-cell font-mono text-xs font-bold">{l.numero_lote}</td>
                              <td className="table-cell">{formatDate(l.fecha_vencimiento)}</td>
                              <td className="table-cell font-semibold">{formatNumber(l.stock_actual, 1)}</td>
                              <td className="table-cell">
                                <span className={`badge ${info.color.replace('text-', 'text-').replace('bg-', 'bg-')}`}>{info.label}</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
