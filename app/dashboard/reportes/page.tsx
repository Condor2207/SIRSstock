'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, formatNumber, diasHastaVencimiento, estadoVencimiento, getErrorMessage, isSchemaCacheMissing } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from 'recharts';
import { Download, BarChart2, Package, Users, AlertTriangle, Loader2, CreditCard, BadgePercent, Receipt, FileText, Layers } from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';

type TabType = 'ventas' | 'stock' | 'cobrar' | 'vencimientos' | 'pagar' | 'comisiones' | 'gastos_credito' | 'gastos_unificados' | 'rg90';

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
  const [pagarData, setPagarData] = useState<any[]>([]);
  const [comisionesData, setComisionesData] = useState<any[]>([]);
  const [gastosCreditoData, setGastosCreditoData] = useState<any[]>([]);
  const [gastosUnificadosData, setGastosUnificadosData] = useState<any[]>([]);

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
      } else if (tab === 'pagar') {
        const { data } = await supabase
          .from('compras')
          .select('numero, fecha, total, condicion_pago, proveedor_id, proveedores(nombre), compra_cuotas(numero_cuota, fecha_vencimiento, monto, estado)')
          .gt('saldo_pendiente', 0)
          .order('fecha', { ascending: false });
        setPagarData(data || []);
      } else if (tab === 'comisiones') {
        const { data } = await supabase
          .from('comisiones')
          .select('vendedor_id, monto, estado, vendedores(nombre)')
          .eq('estado', 'pendiente');
        // Agrupar por vendedor
        const byVendedor: Record<string, { nombre: string; total: number; cantidad: number }> = {};
        for (const c of data || []) {
          const vid = c.vendedor_id;
          if (!byVendedor[vid]) byVendedor[vid] = { nombre: c.vendedores?.[0]?.nombre || vid, total: 0, cantidad: 0 };
          byVendedor[vid].total += c.monto;
          byVendedor[vid].cantidad += 1;
        }
        setComisionesData(Object.values(byVendedor));
      } else if (tab === 'gastos_credito') {
        const { data, error } = await supabase
          .from('gastos')
          .select('titulo, fecha, monto, fecha_vencimiento, categoria, proveedores(nombre)')
          .eq('condicion', 'credito')
          .order('fecha_vencimiento', { ascending: true });
        if (error) {
          if (isSchemaCacheMissing(error, ['gastos', 'condicion', 'fecha_vencimiento'])) {
            setGastosCreditoData([]);
            toast.error('La base aún no tiene habilitado el reporte de gastos a crédito. Por favor ejecute las migraciones pendientes para usar esta función.');
            return;
          }
          throw error;
        }
        setGastosCreditoData(data || []);
      } else if (tab === 'gastos_unificados') {
        // Compras pendientes de pago
        const { data: comprasData } = await supabase
          .from('compras')
          .select('numero, fecha, total, saldo_pendiente, proveedores(nombre), compra_cuotas(numero_cuota, fecha_vencimiento, monto, estado)')
          .gt('saldo_pendiente', 0)
          .order('fecha', { ascending: false });
        const comprasRows = (comprasData || []).map((c: any) => {
          const cuotasPend = (c.compra_cuotas || []).filter((x: any) => x.estado === 'pendiente');
          const proxVenc = cuotasPend.sort((a: any, b: any) => a.fecha_vencimiento?.localeCompare(b.fecha_vencimiento))[0];
          return {
            origen: 'Compra' as const,
            titulo: `Compra ${c.numero}`,
            proveedor: c.proveedores?.nombre || '—',
            fecha: c.fecha,
            monto: c.total,
            saldo_pendiente: c.saldo_pendiente,
            fecha_vencimiento: proxVenc?.fecha_vencimiento || null,
            categoria: 'Compra a crédito',
          };
        });
        // Gastos a crédito pendientes
        let gastosRows: any[] = [];
        try {
          const { data: gastosData, error: gastosError } = await supabase
            .from('gastos')
            .select('titulo, fecha, monto, saldo_pendiente, fecha_vencimiento, categoria, proveedores(nombre)')
            .eq('condicion', 'credito')
            .order('fecha_vencimiento', { ascending: true });
          if (!gastosError) {
            gastosRows = (gastosData || []).map((g: any) => ({
              origen: 'Gasto' as const,
              titulo: g.titulo,
              proveedor: g.proveedores?.nombre || '—',
              fecha: g.fecha,
              monto: g.monto,
              saldo_pendiente: g.saldo_pendiente ?? g.monto,
              fecha_vencimiento: g.fecha_vencimiento || null,
              categoria: g.categoria || 'Gasto',
            }));
          }
        } catch {
          // gastos_credito might not be available yet
        }
        const unified = [...comprasRows, ...gastosRows].sort((a, b) =>
          (a.fecha_vencimiento || '9999').localeCompare(b.fecha_vencimiento || '9999')
        );
        setGastosUnificadosData(unified);
      }
    } catch (e) {
      console.error(e);
      toast.error(getErrorMessage(e) || 'Error al cargar reportes');
    } finally {
      setLoading(false);
    }
  }

  async function exportXLSX() {
    let data: Record<string, any>[] = [];
    let sheetName = 'Reporte';
    let filename = 'reporte';

    if (tab === 'ventas') {
      filename = `ventas_${desde}_${hasta}`;
      sheetName = 'Ventas';
      data = ventasData.map(v => ({ Fecha: v.fecha, 'Total ($)': v.total, 'Cantidad ventas': v.qty }));
    } else if (tab === 'stock') {
      filename = 'stock_actual';
      sheetName = 'Stock';
      data = stockData.map(p => ({ SKU: p.sku, Producto: p.nombre, 'Stock actual': p.stock_actual, 'Stock mínimo': p.stock_minimo, Unidad: p.unidad }));
    } else if (tab === 'cobrar') {
      filename = 'cuentas_cobrar';
      sheetName = 'Cuentas a cobrar';
      data = cobrarData.map(c => ({ Cliente: c.nombre, Documento: c.documento || '', Teléfono: c.telefono || '', 'Límite crédito': c.limite_credito, 'Saldo pendiente': c.saldo_pendiente }));
    } else if (tab === 'pagar') {
      filename = 'cuentas_pagar';
      sheetName = 'Cuentas a pagar';
      data = pagarData.map(p => ({ Compra: p.numero, Proveedor: p.proveedores?.nombre || '', Fecha: p.fecha, Total: p.total }));
    } else if (tab === 'comisiones') {
      filename = 'comisiones_pendientes';
      sheetName = 'Comisiones';
      data = comisionesData.map(c => ({ Vendedor: c.nombre, Cantidad: c.cantidad, 'Total pendiente': c.total }));
    } else if (tab === 'gastos_credito') {
      filename = 'gastos_credito';
      sheetName = 'Gastos a pagar';
      data = gastosCreditoData.map(g => ({ Gasto: g.titulo, Proveedor: g.proveedores?.nombre || '', Fecha: g.fecha, Monto: g.monto, Vencimiento: g.fecha_vencimiento || '' }));
    } else if (tab === 'vencimientos') {
      filename = 'lotes_vencimiento';
      sheetName = 'Vencimientos';
      data = vencimientosData.map(l => ({ Producto: (l as any).productos?.nombre, SKU: (l as any).productos?.sku, Lote: l.numero_lote, Vencimiento: l.fecha_vencimiento, Stock: l.stock_actual, 'Días restantes': diasHastaVencimiento(l.fecha_vencimiento) }));
    } else if (tab === 'gastos_unificados') {
      filename = 'gastos_unificados';
      sheetName = 'Gastos Unificados';
      data = gastosUnificadosData.map(r => ({ Origen: r.origen, Concepto: r.titulo, Proveedor: r.proveedor, Categoría: r.categoria, Fecha: r.fecha, Monto: r.monto, 'Saldo pendiente': r.saldo_pendiente, Vencimiento: r.fecha_vencimiento || '' }));
    }

    if (data.length === 0) { toast.error('Sin datos para exportar'); return; }

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet(sheetName);
    ws.columns = Object.keys(data[0]).map(key => ({ header: key, key, width: 20 }));
    data.forEach(row => ws.addRow(row));
    // Bold header row
    ws.getRow(1).font = { bold: true };
    const buffer = await wb.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${filename}.xlsx`; a.click();
    URL.revokeObjectURL(url);
    toast.success('Excel exportado');
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
    { id: 'ventas', label: 'Ventas', icon: BarChart2 },
    { id: 'stock', label: 'Stock', icon: Package },
    { id: 'cobrar', label: 'Cuentas a cobrar', icon: Users },
    { id: 'pagar', label: 'Cuentas a pagar', icon: CreditCard },
    { id: 'comisiones', label: 'Comisiones pend.', icon: BadgePercent },
    { id: 'gastos_credito', label: 'Gastos a pagar', icon: Receipt },
    { id: 'gastos_unificados', label: 'Gastos unificados', icon: Layers },
    { id: 'vencimientos', label: 'Lotes por vencer', icon: AlertTriangle },
    { id: 'rg90', label: 'RG90', icon: FileText },
  ];

  return (
    <>
      <Header title="Reportes" subtitle="Reportes y análisis del sistema" />
      <div className="p-4 md:p-6 space-y-4">
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
          <button onClick={exportXLSX} className="btn-secondary flex items-center gap-2 text-sm ml-auto">
            <Download className="w-4 h-4" /> Exportar Excel
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
                          <td className="table-cell font-bold text-lg">{formatNumber(p.stock_actual, 0)}</td>
                          <td className="table-cell text-gray-500">{formatNumber(p.stock_minimo, 0)}</td>
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

            {/* CUENTAS A PAGAR */}
            {tab === 'pagar' && (
              <div className="space-y-4">
                {pagarData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">No hay compras con saldo pendiente</div>
                ) : (
                  <div className="card overflow-hidden">
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="table-header">Compra</th>
                          <th className="table-header">Proveedor</th>
                          <th className="table-header">Fecha</th>
                          <th className="table-header">Total</th>
                          <th className="table-header">Cuotas pendientes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {pagarData.map((p, i) => {
                          const cuotasPend = (p.compra_cuotas || []).filter((c: any) => c.estado === 'pendiente');
                          const totalPend = cuotasPend.reduce((s: number, c: any) => s + c.monto, 0);
                          const proxVenc = cuotasPend.sort((a: any, b: any) => a.fecha_vencimiento?.localeCompare(b.fecha_vencimiento))[0];
                          const dias = proxVenc ? diasHastaVencimiento(proxVenc.fecha_vencimiento) : null;
                          return (
                            <tr key={i} className={typeof dias === 'number' && dias <= 7 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                              <td className="table-cell font-mono text-xs font-bold">{p.numero}</td>
                              <td className="table-cell">{p.proveedores?.nombre || '—'}</td>
                              <td className="table-cell text-xs">{formatDate(p.fecha)}</td>
                              <td className="table-cell font-semibold">{formatCurrency(p.total)}</td>
                              <td className="table-cell">
                                <div className="text-xs space-y-0.5">
                                  <span className="font-bold text-red-600">{formatCurrency(totalPend)}</span>
                                  {proxVenc && <span className="block text-gray-400">Próx. vto: {formatDate(proxVenc.fecha_vencimiento)} {typeof dias === 'number' ? `(${dias}d)` : ''}</span>}
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

            {/* COMISIONES PENDIENTES */}
            {tab === 'comisiones' && (
              <div className="space-y-4">
                {comisionesData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">No hay comisiones pendientes</div>
                ) : (
                  <>
                    <div className="card p-4">
                      <p className="text-sm text-gray-500">Total comisiones pendientes</p>
                      <p className="text-2xl font-bold text-yellow-600">{formatCurrency(comisionesData.reduce((s, c) => s + c.total, 0))}</p>
                    </div>
                    <div className="card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="table-header">Vendedor</th>
                            <th className="table-header">Cantidad facturas</th>
                            <th className="table-header">Total pendiente</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {comisionesData.map((c, i) => (
                            <tr key={i}>
                              <td className="table-cell font-medium">{c.nombre}</td>
                              <td className="table-cell">{c.cantidad}</td>
                              <td className="table-cell font-bold text-yellow-600">{formatCurrency(c.total)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* GASTOS CRÉDITO (a pagar) */}
            {tab === 'gastos_credito' && (
              <div className="space-y-4">
                {gastosCreditoData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">No hay gastos pendientes de pago</div>
                ) : (
                  <>
                    <div className="card p-4">
                      <p className="text-sm text-gray-500">Total gastos a pagar</p>
                      <p className="text-2xl font-bold text-red-500">{formatCurrency(gastosCreditoData.reduce((s, g) => s + g.monto, 0))}</p>
                    </div>
                    <div className="card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="table-header">Gasto</th>
                            <th className="table-header">Proveedor</th>
                            <th className="table-header">Fecha</th>
                            <th className="table-header">Monto</th>
                            <th className="table-header">Vencimiento</th>
                            <th className="table-header">Días</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {gastosCreditoData.map((g, i) => {
                            const dias = g.fecha_vencimiento ? diasHastaVencimiento(g.fecha_vencimiento) : null;
                            return (
                              <tr key={i} className={typeof dias === 'number' && dias <= 7 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                <td className="table-cell font-medium">{g.titulo}</td>
                                <td className="table-cell text-sm">{g.proveedores?.nombre || '—'}</td>
                                <td className="table-cell text-xs">{formatDate(g.fecha)}</td>
                                <td className="table-cell font-bold text-red-500">{formatCurrency(g.monto)}</td>
                                <td className="table-cell text-xs">{g.fecha_vencimiento ? formatDate(g.fecha_vencimiento) : '—'}</td>
                                <td className="table-cell">
                                  {typeof dias === 'number' ? (
                                    <span className={`badge ${dias <= 0 ? 'bg-red-100 text-red-700' : dias <= 7 ? 'bg-orange-100 text-orange-700' : dias <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {dias <= 0 ? 'Vencido' : `${dias}d`}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
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
                              <td className="table-cell font-semibold">{formatNumber(l.stock_actual, 0)}</td>
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
            {/* GASTOS UNIFICADOS */}
            {tab === 'gastos_unificados' && (
              <div className="space-y-4">
                {gastosUnificadosData.length === 0 ? (
                  <div className="card p-12 text-center text-gray-400">No hay gastos ni compras pendientes de pago</div>
                ) : (
                  <>
                    <div className="flex gap-3 flex-wrap">
                      <div className="card p-4 flex-1 min-w-[160px]">
                        <p className="text-xs text-gray-500">Total a pagar</p>
                        <p className="text-2xl font-bold text-red-500">{formatCurrency(gastosUnificadosData.reduce((s, r) => s + (r.saldo_pendiente || r.monto || 0), 0))}</p>
                      </div>
                      <div className="card p-4 flex-1 min-w-[160px]">
                        <p className="text-xs text-gray-500">Compras</p>
                        <p className="text-xl font-bold text-orange-500">{formatCurrency(gastosUnificadosData.filter(r => r.origen === 'Compra').reduce((s, r) => s + (r.saldo_pendiente || 0), 0))}</p>
                      </div>
                      <div className="card p-4 flex-1 min-w-[160px]">
                        <p className="text-xs text-gray-500">Gastos</p>
                        <p className="text-xl font-bold text-purple-500">{formatCurrency(gastosUnificadosData.filter(r => r.origen === 'Gasto').reduce((s, r) => s + (r.saldo_pendiente || r.monto || 0), 0))}</p>
                      </div>
                    </div>
                    <div className="card overflow-hidden">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-800/50">
                          <tr>
                            <th className="table-header">Origen</th>
                            <th className="table-header">Concepto</th>
                            <th className="table-header">Proveedor</th>
                            <th className="table-header">Categoría</th>
                            <th className="table-header">Fecha</th>
                            <th className="table-header">Monto</th>
                            <th className="table-header">Saldo pend.</th>
                            <th className="table-header">Vencimiento</th>
                            <th className="table-header">Días</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                          {gastosUnificadosData.map((r, i) => {
                            const dias = r.fecha_vencimiento ? diasHastaVencimiento(r.fecha_vencimiento) : null;
                            return (
                              <tr key={i} className={typeof dias === 'number' && dias <= 7 ? 'bg-red-50/50 dark:bg-red-900/10' : ''}>
                                <td className="table-cell">
                                  <span className={`badge text-xs ${r.origen === 'Compra' ? 'bg-orange-100 text-orange-700' : 'bg-purple-100 text-purple-700'}`}>{r.origen}</span>
                                </td>
                                <td className="table-cell font-medium text-sm">{r.titulo}</td>
                                <td className="table-cell text-sm text-gray-500">{r.proveedor}</td>
                                <td className="table-cell text-xs text-gray-400">{r.categoria}</td>
                                <td className="table-cell text-xs">{formatDate(r.fecha)}</td>
                                <td className="table-cell font-semibold">{formatCurrency(r.monto)}</td>
                                <td className="table-cell font-bold text-red-500">{formatCurrency(r.saldo_pendiente ?? r.monto)}</td>
                                <td className="table-cell text-xs">{r.fecha_vencimiento ? formatDate(r.fecha_vencimiento) : '—'}</td>
                                <td className="table-cell">
                                  {typeof dias === 'number' ? (
                                    <span className={`badge ${dias <= 0 ? 'bg-red-100 text-red-700' : dias <= 7 ? 'bg-orange-100 text-orange-700' : dias <= 30 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                                      {dias <= 0 ? 'Vencido' : `${dias}d`}
                                    </span>
                                  ) : '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}
            {/* RG90 */}
            {tab === 'rg90' && (
              <div className="card p-8 text-center space-y-4">
                <FileText className="w-12 h-12 mx-auto text-blue-400" />
                <h3 className="text-lg font-semibold">Reporte RG90</h3>
                <p className="text-sm text-gray-500">Generación del libro de compras y ventas para la SET (RG-90)</p>
                <a href="/dashboard/reportes/rg90" className="btn-primary inline-flex items-center gap-2 mx-auto">
                  <FileText className="w-4 h-4" /> Abrir RG90
                </a>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
