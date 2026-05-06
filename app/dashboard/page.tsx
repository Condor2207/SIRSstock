'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { StatsCard } from '@/components/StatsCard';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, estadoBadgeClass, estadoVencimiento } from '@/lib/utils';
import {
  ShoppingCart, Users, Package, AlertTriangle,
  TrendingUp, DollarSign, Clock, Factory
} from 'lucide-react';
import Link from 'next/link';

interface DashboardData {
  ventasHoy: number;
  ventasMes: number;
  clientesActivos: number;
  productosStockBajo: number;
  lotesXVencer: number;
  cuentasPorCobrar: number;
  ultimasVentas: Array<{
    id: string; numero: string; fecha: string;
    cliente: string; total: number; estado: string; condicion_pago: string;
  }>;
  alertasStock: Array<{ nombre: string; sku: string; stock_actual: number; stock_minimo: number }>;
  alertasVencimiento: Array<{ producto: string; lote: string; fecha: string; stock: number }>;
}

export default function DashboardPage() {
  const supabase = createClient();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    try {
      const today = new Date();
      const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      const in30Days = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      const [ventasHoyRes, ventasMesRes, clientesRes, stockBajoRes, lotesVencRes, cuentasRes, ultimasVentasRes] = await Promise.all([
        supabase.from('ventas').select('total').gte('created_at', startOfDay).neq('estado', 'anulado'),
        supabase.from('ventas').select('total').gte('created_at', startOfMonth).neq('estado', 'anulado'),
        supabase.from('clientes').select('id', { count: 'exact' }).eq('activo', true),
        supabase.from('productos').select('nombre, sku, stock_actual, stock_minimo').eq('activo', true).filter('stock_actual', 'lte', 'stock_minimo'),
        supabase.from('lotes').select('numero_lote, fecha_vencimiento, stock_actual, productos(nombre)').eq('activo', true).lte('fecha_vencimiento', in30Days).gt('stock_actual', 0),
        supabase.from('clientes').select('saldo_pendiente').gt('saldo_pendiente', 0),
        supabase.from('ventas').select('id, numero, fecha, total, estado, condicion_pago, clientes(nombre)').order('created_at', { ascending: false }).limit(5).neq('estado', 'anulado'),
      ]);

      const ventasHoyTotal = (ventasHoyRes.data || []).reduce((s, v) => s + (v.total || 0), 0);
      const ventasMesTotal = (ventasMesRes.data || []).reduce((s, v) => s + (v.total || 0), 0);
      const cuentasTotal = (cuentasRes.data || []).reduce((s, c) => s + (c.saldo_pendiente || 0), 0);

      setData({
        ventasHoy: ventasHoyTotal,
        ventasMes: ventasMesTotal,
        clientesActivos: clientesRes.count || 0,
        productosStockBajo: (stockBajoRes.data || []).length,
        lotesXVencer: (lotesVencRes.data || []).length,
        cuentasPorCobrar: cuentasTotal,
        ultimasVentas: (ultimasVentasRes.data || []).map((v: any) => ({
          id: v.id, numero: v.numero, fecha: v.fecha,
          cliente: v.clientes?.nombre || '-', total: v.total,
          estado: v.estado, condicion_pago: v.condicion_pago,
        })),
        alertasStock: (stockBajoRes.data || []).slice(0, 5) as any,
        alertasVencimiento: (lotesVencRes.data || []).slice(0, 5).map((l: any) => ({
          producto: l.productos?.nombre || '-',
          lote: l.numero_lote,
          fecha: l.fecha_vencimiento,
          stock: l.stock_actual,
        })),
      });
    } catch (err) {
      console.error('Error cargando dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header title="Dashboard" subtitle="Resumen general del negocio" />
      <div className="p-6 space-y-6">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              <StatsCard
                title="Ventas de hoy"
                value={formatCurrency(data?.ventasHoy || 0)}
                icon={ShoppingCart}
                color="blue"
              />
              <StatsCard
                title="Ventas del mes"
                value={formatCurrency(data?.ventasMes || 0)}
                icon={TrendingUp}
                color="green"
              />
              <StatsCard
                title="Cuentas por cobrar"
                value={formatCurrency(data?.cuentasPorCobrar || 0)}
                subtitle="Créditos pendientes"
                icon={DollarSign}
                color="purple"
              />
              <StatsCard
                title="Clientes activos"
                value={data?.clientesActivos || 0}
                icon={Users}
                color="blue"
              />
              <StatsCard
                title="Stock bajo"
                value={data?.productosStockBajo || 0}
                subtitle="Productos bajo mínimo"
                icon={Package}
                color={data?.productosStockBajo ? 'yellow' : 'green'}
              />
              <StatsCard
                title="Lotes por vencer"
                value={data?.lotesXVencer || 0}
                subtitle="En los próximos 30 días"
                icon={Clock}
                color={data?.lotesXVencer ? 'red' : 'green'}
              />
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
              {/* Últimas ventas */}
              <div className="card">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                  <h2 className="section-title">Últimas ventas</h2>
                  <Link href="/dashboard/ventas" className="text-sm text-blue-600 hover:underline">Ver todas →</Link>
                </div>
                <div className="overflow-x-auto">
                  {(data?.ultimasVentas.length ?? 0) === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                      <ShoppingCart className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p>Sin ventas registradas</p>
                    </div>
                  ) : (
                    <table className="w-full">
                      <thead className="bg-gray-50 dark:bg-gray-800/50">
                        <tr>
                          <th className="table-header">N°</th>
                          <th className="table-header">Cliente</th>
                          <th className="table-header">Total</th>
                          <th className="table-header">Estado</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {data?.ultimasVentas.map(v => (
                          <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                            <td className="table-cell font-mono text-xs">{v.numero}</td>
                            <td className="table-cell">{v.cliente}</td>
                            <td className="table-cell font-semibold">{formatCurrency(v.total)}</td>
                            <td className="table-cell">
                              <span className={`badge ${estadoBadgeClass(v.estado)}`}>{v.estado}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Alertas */}
              <div className="space-y-4">
                {/* Stock bajo */}
                {(data?.alertasStock.length ?? 0) > 0 && (
                  <div className="card border-l-4 border-l-yellow-500">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                      <AlertTriangle className="w-4 h-4 text-yellow-500" />
                      <h2 className="section-title text-sm">Stock bajo mínimo</h2>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data?.alertasStock.map((p, i) => (
                        <li key={i} className="px-5 py-3 flex justify-between items-center">
                          <div>
                            <p className="text-sm font-medium">{p.nombre}</p>
                            <p className="text-xs text-gray-400">{p.sku}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-bold text-red-500">{p.stock_actual}</p>
                            <p className="text-xs text-gray-400">mín: {p.stock_minimo}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="px-5 py-2">
                      <Link href="/dashboard/stock" className="text-xs text-blue-600 hover:underline">Ver stock completo →</Link>
                    </div>
                  </div>
                )}

                {/* Lotes por vencer */}
                {(data?.alertasVencimiento.length ?? 0) > 0 && (
                  <div className="card border-l-4 border-l-red-500">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100 dark:border-gray-700">
                      <Clock className="w-4 h-4 text-red-500" />
                      <h2 className="section-title text-sm">Lotes próximos a vencer</h2>
                    </div>
                    <ul className="divide-y divide-gray-100 dark:divide-gray-700">
                      {data?.alertasVencimiento.map((l, i) => {
                        const ev = estadoVencimiento(l.fecha);
                        return (
                          <li key={i} className="px-5 py-3 flex justify-between items-center">
                            <div>
                              <p className="text-sm font-medium">{l.producto}</p>
                              <p className="text-xs text-gray-400">Lote: {l.lote}</p>
                            </div>
                            <div className="text-right">
                              <p className={`text-xs font-semibold ${ev.color}`}>{ev.label}</p>
                              <p className="text-xs text-gray-400">Stock: {l.stock}</p>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                    <div className="px-5 py-2">
                      <Link href="/dashboard/stock" className="text-xs text-blue-600 hover:underline">Ver todos los lotes →</Link>
                    </div>
                  </div>
                )}

                {/* Acciones rápidas */}
                <div className="card p-5">
                  <h2 className="section-title text-sm mb-3">Acciones rápidas</h2>
                  <div className="grid grid-cols-2 gap-2">
                    <Link href="/dashboard/ventas/nueva" className="btn-primary text-center py-2.5 rounded-lg text-sm">
                      + Nueva Venta
                    </Link>
                    <Link href="/dashboard/compras" className="btn-secondary text-center py-2.5 rounded-lg text-sm">
                      + Nueva Compra
                    </Link>
                    <Link href="/dashboard/produccion" className="btn-secondary text-center py-2.5 rounded-lg text-sm flex items-center justify-center gap-1">
                      <Factory className="w-4 h-4" /> Producción
                    </Link>
                    <Link href="/dashboard/reportes" className="btn-secondary text-center py-2.5 rounded-lg text-sm">
                      Reportes
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
