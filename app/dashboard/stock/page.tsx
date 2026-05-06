'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatDate, estadoVencimiento, formatNumber } from '@/lib/utils';
import { Search, Plus, Boxes, AlertTriangle, X, Loader2, Filter } from 'lucide-react';
import toast from 'react-hot-toast';

interface StockRow {
  productoId: string;
  sku: string;
  nombre: string;
  categoria: string;
  unidad: string;
  stockTotal: number;
  stockMinimo: number;
  controlLote: boolean;
  lotes: Array<{
    id: string;
    numero_lote: string;
    fecha_vencimiento?: string;
    stock_actual: number;
  }>;
}

type Filtro = 'todos' | 'bajo' | 'vencimiento' | 'sin-lote';

export default function StockPage() {
  const supabase = createClient();
  const [rows, setRows] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [showAjuste, setShowAjuste] = useState(false);
  const [ajusteForm, setAjusteForm] = useState({ producto_id: '', lote_id: '', cantidad: '', tipo: 'entrada', notas: '' });
  const [productos, setProductos] = useState<Array<{ id: string; nombre: string; sku: string; control_lote: boolean }>>([]);
  const [lotesDelProducto, setLotesDelProducto] = useState<Array<{ id: string; numero_lote: string }>>([]);
  const [saving, setSaving] = useState(false);

  const loadStock = useCallback(async () => {
    setLoading(true);
    const { data: prods } = await supabase
      .from('productos')
      .select('id, sku, nombre, unidad_medida, stock_actual, stock_minimo, control_lote, activo, categoria:categorias(nombre)')
      .eq('activo', true)
      .order('nombre');

    const { data: lotes } = await supabase
      .from('lotes')
      .select('id, producto_id, numero_lote, fecha_vencimiento, stock_actual')
      .eq('activo', true)
      .gt('stock_actual', 0)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false });

    const rowsMap: Record<string, StockRow> = {};
    (prods || []).forEach((p: any) => {
      rowsMap[p.id] = {
        productoId: p.id,
        sku: p.sku,
        nombre: p.nombre,
        categoria: p.categoria?.nombre || '-',
        unidad: p.unidad_medida,
        stockTotal: p.stock_actual,
        stockMinimo: p.stock_minimo,
        controlLote: p.control_lote,
        lotes: [],
      };
    });
    (lotes || []).forEach((l: any) => {
      if (rowsMap[l.producto_id]) {
        rowsMap[l.producto_id].lotes.push(l);
      }
    });
    setRows(Object.values(rowsMap));
    setProductos((prods || []).map((p: any) => ({ id: p.id, nombre: p.nombre, sku: p.sku, control_lote: p.control_lote })));
    setLoading(false);
  }, []);

  useEffect(() => { loadStock(); }, [loadStock]);

  async function loadLotesProducto(productoId: string) {
    const { data } = await supabase.from('lotes').select('id, numero_lote').eq('producto_id', productoId).eq('activo', true);
    setLotesDelProducto(data || []);
  }

  async function handleAjuste() {
    if (!ajusteForm.producto_id || !ajusteForm.cantidad) { toast.error('Completá los campos requeridos'); return; }
    const cant = parseFloat(ajusteForm.cantidad);
    if (isNaN(cant) || cant <= 0) { toast.error('La cantidad debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      // Registrar movimiento
      await supabase.from('movimientos_stock').insert({
        producto_id: ajusteForm.producto_id,
        lote_id: ajusteForm.lote_id || null,
        tipo: ajusteForm.tipo,
        cantidad: ajusteForm.tipo === 'salida' ? -cant : cant,
        referencia_tipo: 'ajuste',
        notas: ajusteForm.notas || null,
      });

      // Actualizar stock del producto
      const prod = rows.find(r => r.productoId === ajusteForm.producto_id);
      if (prod) {
        const nuevoStock = ajusteForm.tipo === 'salida' ? prod.stockTotal - cant : prod.stockTotal + cant;
        await supabase.from('productos').update({ stock_actual: nuevoStock }).eq('id', ajusteForm.producto_id);
      }

      // Actualizar stock del lote si aplica
      if (ajusteForm.lote_id) {
        const lote = prod?.lotes.find(l => l.id === ajusteForm.lote_id);
        if (lote) {
          const nuevoLote = ajusteForm.tipo === 'salida' ? lote.stock_actual - cant : lote.stock_actual + cant;
          await supabase.from('lotes').update({ stock_actual: nuevoLote }).eq('id', ajusteForm.lote_id);
        }
      }

      toast.success('Ajuste de stock registrado');
      setShowAjuste(false);
      setAjusteForm({ producto_id: '', lote_id: '', cantidad: '', tipo: 'entrada', notas: '' });
      loadStock();
    } catch (e: any) {
      toast.error(e.message || 'Error al ajustar stock');
    } finally {
      setSaving(false);
    }
  }

  const in30 = new Date(Date.now() + 30 * 864e5).toISOString().split('T')[0];

  const filtered = rows.filter(r => {
    const matchSearch = r.nombre.toLowerCase().includes(search.toLowerCase()) || r.sku.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filtro === 'bajo') return r.stockTotal <= r.stockMinimo;
    if (filtro === 'vencimiento') return r.lotes.some(l => l.fecha_vencimiento && l.fecha_vencimiento <= in30);
    if (filtro === 'sin-lote') return r.controlLote && r.lotes.length === 0;
    return true;
  });

  return (
    <>
      <Header title="Stock & Lotes" subtitle="Control de inventario con trazabilidad por lote y vencimiento" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="flex gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9 w-56" placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select className="input w-auto" value={filtro} onChange={e => setFiltro(e.target.value as Filtro)}>
              <option value="todos">Todos</option>
              <option value="bajo">Stock bajo</option>
              <option value="vencimiento">Próx. a vencer (30d)</option>
              <option value="sin-lote">Sin lote</option>
            </select>
          </div>
          <button onClick={() => setShowAjuste(true)} className="btn-secondary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Ajuste de stock
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center h-48 items-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Producto</th>
                    <th className="table-header">Categoría</th>
                    <th className="table-header">Stock Total</th>
                    <th className="table-header">Lotes activos</th>
                    <th className="table-header">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-gray-400">No se encontraron productos</td></tr>
                  ) : filtered.map(r => {
                    const stockBajo = r.stockTotal <= r.stockMinimo && r.stockMinimo > 0;
                    const tieneVencProx = r.lotes.some(l => l.fecha_vencimiento && l.fecha_vencimiento <= in30);
                    return (
                      <>
                        <tr key={r.productoId} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                          <td className="table-cell font-mono text-xs font-semibold text-blue-600">{r.sku}</td>
                          <td className="table-cell font-medium">{r.nombre}</td>
                          <td className="table-cell text-gray-500 text-xs">{r.categoria}</td>
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <span className={`font-bold text-base ${stockBajo ? 'text-red-500' : 'text-emerald-600'}`}>{formatNumber(r.stockTotal, 1)}</span>
                              <span className="text-xs text-gray-400">{r.unidad}</span>
                              {stockBajo && <AlertTriangle className="w-4 h-4 text-yellow-500" title="Stock bajo mínimo" />}
                            </div>
                            <div className="text-xs text-gray-400">mín: {r.stockMinimo}</div>
                          </td>
                          <td className="table-cell">
                            {r.controlLote ? (
                              r.lotes.length === 0 ? (
                                <span className="text-gray-400 text-xs">Sin lotes</span>
                              ) : (
                                <div className="space-y-1">
                                  {r.lotes.map(l => {
                                    const ev = estadoVencimiento(l.fecha_vencimiento);
                                    return (
                                      <div key={l.id} className="flex items-center gap-2 text-xs">
                                        <span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{l.numero_lote}</span>
                                        <span className="text-gray-500">{formatNumber(l.stock_actual, 1)}</span>
                                        <span className={ev.color + ' font-medium'}>{ev.label}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )
                            ) : (
                              <span className="text-xs text-gray-400">Sin control de lote</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-1 flex-wrap">
                              {stockBajo && <span className="badge bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">Stock bajo</span>}
                              {tieneVencProx && <span className="badge bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Vence pronto</span>}
                              {!stockBajo && !tieneVencProx && <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">OK</span>}
                            </div>
                          </td>
                        </tr>
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal Ajuste */}
      {showAjuste && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Ajuste de Stock</h2>
              <button onClick={() => setShowAjuste(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Tipo de ajuste</label>
                <select className="input" value={ajusteForm.tipo} onChange={e => setAjusteForm(f => ({ ...f, tipo: e.target.value }))}>
                  <option value="entrada">Entrada (suma)</option>
                  <option value="salida">Salida (resta)</option>
                  <option value="ajuste">Ajuste</option>
                </select>
              </div>
              <div>
                <label className="label">Producto *</label>
                <select className="input" value={ajusteForm.producto_id} onChange={e => {
                  setAjusteForm(f => ({ ...f, producto_id: e.target.value, lote_id: '' }));
                  if (e.target.value) loadLotesProducto(e.target.value);
                }}>
                  <option value="">Seleccionar producto...</option>
                  {productos.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>)}
                </select>
              </div>
              {lotesDelProducto.length > 0 && (
                <div>
                  <label className="label">Lote (opcional)</label>
                  <select className="input" value={ajusteForm.lote_id} onChange={e => setAjusteForm(f => ({ ...f, lote_id: e.target.value }))}>
                    <option value="">Sin especificar lote</option>
                    {lotesDelProducto.map(l => <option key={l.id} value={l.id}>{l.numero_lote}</option>)}
                  </select>
                </div>
              )}
              <div>
                <label className="label">Cantidad *</label>
                <input type="number" min="0.001" step="0.001" className="input" value={ajusteForm.cantidad} onChange={e => setAjusteForm(f => ({ ...f, cantidad: e.target.value }))} />
              </div>
              <div>
                <label className="label">Observaciones</label>
                <textarea className="input" rows={2} value={ajusteForm.notas} onChange={e => setAjusteForm(f => ({ ...f, notas: e.target.value }))} placeholder="Motivo del ajuste..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowAjuste(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleAjuste} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar ajuste
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
