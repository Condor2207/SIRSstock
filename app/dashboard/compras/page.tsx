'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, estadoBadgeClass } from '@/lib/utils';
import { Plus, Search, Eye, X, Loader2, Trash2, CreditCard } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Compra, Proveedor, Producto } from '@/lib/types';

interface CompraItem {
  producto_id: string;
  producto_nombre: string;
  numero_lote: string;
  fecha_vencimiento: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export default function ComprasPage() {
  const supabase = createClient();
  const [compras, setCompras] = useState<Compra[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detalle, setDetalle] = useState<Compra | null>(null);
  const [saving, setSaving] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({
    proveedor_id: '', condicion_pago: 'contado' as 'contado' | 'credito',
    numero_remito: '', notas: '',
  });
  const [items, setItems] = useState<CompraItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('compras').select('*, proveedores(nombre)').order('created_at', { ascending: false }).limit(100);
    setCompras(data as Compra[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase.from('proveedores').select('*').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
    supabase.from('productos').select('id, sku, nombre, precio_compra, control_lote').eq('activo', true).order('nombre').then(r => setProductos(r.data as Producto[] || []));
  }, [load]);

  function addItem() {
    setItems(prev => [...prev, { producto_id: '', producto_nombre: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, precio_unitario: 0, subtotal: 0 }]);
  }

  function updateItem(idx: number, campo: string, valor: string | number) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [campo]: valor };
      if (campo === 'producto_id') {
        const prod = productos.find(p => p.id === valor);
        item.producto_nombre = prod ? `${prod.sku} - ${prod.nombre}` : '';
        item.precio_unitario = prod?.precio_compra || 0;
      }
      if (campo === 'cantidad' || campo === 'precio_unitario') {
        item.subtotal = (parseFloat(String(item.cantidad)) || 0) * (parseFloat(String(item.precio_unitario)) || 0);
      }
      updated[idx] = item;
      return updated;
    });
  }

  function removeItem(idx: number) { setItems(prev => prev.filter((_, i) => i !== idx)); }

  const total = items.reduce((s, i) => s + i.subtotal, 0);

  async function handleSave() {
    if (items.length === 0) { toast.error('Agregá al menos un producto'); return; }
    if (items.some(i => !i.producto_id || i.cantidad <= 0)) { toast.error('Completá todos los productos'); return; }
    setSaving(true);
    try {
      const { count } = await supabase.from('compras').select('*', { count: 'exact', head: true });
      const numCompra = `C-${String((count || 0) + 1).padStart(5, '0')}`;

      const { data: compra, error } = await supabase.from('compras').insert({
        numero: numCompra,
        fecha: new Date().toISOString().split('T')[0],
        proveedor_id: form.proveedor_id || null,
        condicion_pago: form.condicion_pago,
        numero_remito: form.numero_remito || null,
        subtotal: total, total,
        saldo_pendiente: form.condicion_pago === 'credito' ? total : 0,
        estado: form.condicion_pago === 'contado' ? 'pagado' : 'pendiente',
        notas: form.notas || null,
      }).select().single();
      if (error) throw error;

      // Items
      const itemsData = items.map(i => ({
        compra_id: compra.id,
        producto_id: i.producto_id,
        numero_lote: i.numero_lote || null,
        fecha_vencimiento: i.fecha_vencimiento || null,
        descripcion: i.producto_nombre,
        cantidad: i.cantidad,
        precio_unitario: i.precio_unitario,
        subtotal: i.subtotal,
      }));
      await supabase.from('compra_items').insert(itemsData);

      // Actualizar stock y lotes
      for (const item of items) {
        // Producto
        const { data: prod } = await supabase.from('productos').select('stock_actual').eq('id', item.producto_id).single();
        if (prod) await supabase.from('productos').update({ stock_actual: prod.stock_actual + item.cantidad }).eq('id', item.producto_id);

        // Lote si corresponde
        if (item.numero_lote) {
          const { data: existing } = await supabase.from('lotes').select('id, stock_actual').eq('producto_id', item.producto_id).eq('numero_lote', item.numero_lote).single();
          if (existing) {
            await supabase.from('lotes').update({ stock_actual: existing.stock_actual + item.cantidad }).eq('id', existing.id);
          } else {
            await supabase.from('lotes').insert({
              producto_id: item.producto_id, numero_lote: item.numero_lote,
              fecha_vencimiento: item.fecha_vencimiento || null,
              stock_actual: item.cantidad, stock_inicial: item.cantidad,
            });
          }
        }

        // Movimiento
        await supabase.from('movimientos_stock').insert({
          producto_id: item.producto_id, tipo: 'entrada',
          cantidad: item.cantidad, referencia_tipo: 'compra', referencia_id: compra.id,
        });
      }

      toast.success(`Compra ${numCompra} registrada`);
      setShowModal(false);
      setItems([]);
      setForm({ proveedor_id: '', condicion_pago: 'contado', numero_remito: '', notas: '' });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function openDetalle(c: Compra) {
    const { data } = await supabase.from('compras').select('*, proveedores(*), compra_items(*, productos(nombre, sku))').eq('id', c.id).single();
    setDetalle(data as Compra);
  }

  const filtered = compras.filter(c =>
    c.numero.toLowerCase().includes(search.toLowerCase()) ||
    (c as any).proveedores?.nombre?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Compras" subtitle="Registro de compras a proveedores" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar N° o proveedor..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva compra
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <CreditCard className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin compras registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">N°</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Proveedor</th>
                    <th className="table-header">Condición</th>
                    <th className="table-header">Total</th>
                    <th className="table-header">Saldo</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{c.numero}</td>
                      <td className="table-cell text-xs">{formatDate(c.fecha)}</td>
                      <td className="table-cell">{(c as any).proveedores?.nombre || 'Sin proveedor'}</td>
                      <td className="table-cell"><span className={`badge ${estadoBadgeClass(c.condicion_pago)}`}>{c.condicion_pago}</span></td>
                      <td className="table-cell font-semibold">{formatCurrency(c.total)}</td>
                      <td className="table-cell">{c.saldo_pendiente > 0 ? <span className="text-red-500 font-semibold">{formatCurrency(c.saldo_pendiente)}</span> : <span className="text-emerald-500">$0</span>}</td>
                      <td className="table-cell"><span className={`badge ${estadoBadgeClass(c.estado)}`}>{c.estado}</span></td>
                      <td className="table-cell">
                        <button onClick={() => openDetalle(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600">
                          <Eye className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal nueva compra */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nueva Compra</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Proveedor</label>
                  <select className="input" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Sin proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Condición pago</label>
                  <select className="input" value={form.condicion_pago} onChange={e => setForm(f => ({ ...f, condicion_pago: e.target.value as 'contado' | 'credito' }))}>
                    <option value="contado">Contado</option>
                    <option value="credito">Crédito</option>
                  </select>
                </div>
                <div>
                  <label className="label">N° Remito</label>
                  <input className="input" value={form.numero_remito} onChange={e => setForm(f => ({ ...f, numero_remito: e.target.value }))} placeholder="R-0001-00000123" />
                </div>
                <div>
                  <label className="label">Notas</label>
                  <input className="input" value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Productos</h3>
                  <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                {items.length === 0 ? (
                  <div className="py-6 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                    Agregá productos a la compra
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => {
                      const prodSelec = productos.find(p => p.id === item.producto_id);
                      return (
                        <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-sm items-end">
                            <div className="sm:col-span-2">
                              <label className="label text-xs">Producto</label>
                              <select className="input py-1.5" value={item.producto_id} onChange={e => updateItem(idx, 'producto_id', e.target.value)}>
                                <option value="">Seleccionar...</option>
                                {productos.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>)}
                              </select>
                            </div>
                            {prodSelec?.control_lote && (
                              <div>
                                <label className="label text-xs">N° Lote</label>
                                <input className="input py-1.5" value={item.numero_lote} onChange={e => updateItem(idx, 'numero_lote', e.target.value)} placeholder="L2024-001" />
                              </div>
                            )}
                            {prodSelec?.control_lote && (
                              <div>
                                <label className="label text-xs">Vencimiento</label>
                                <input type="date" className="input py-1.5" value={item.fecha_vencimiento} onChange={e => updateItem(idx, 'fecha_vencimiento', e.target.value)} />
                              </div>
                            )}
                            <div>
                              <label className="label text-xs">Cantidad</label>
                              <input type="number" min="0.001" step="0.001" className="input py-1.5" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div>
                              <label className="label text-xs">Precio unit.</label>
                              <input type="number" min="0" step="0.01" className="input py-1.5" value={item.precio_unitario} onChange={e => updateItem(idx, 'precio_unitario', parseFloat(e.target.value) || 0)} />
                            </div>
                            <div className="flex items-end gap-1">
                              <div className="flex-1">
                                <label className="label text-xs">Subtotal</label>
                                <div className="input py-1.5 bg-gray-100 dark:bg-gray-700 font-semibold text-xs">{formatCurrency(item.subtotal)}</div>
                              </div>
                              <button onClick={() => removeItem(idx)} className="p-1.5 text-red-400 hover:text-red-600 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div className="flex justify-end mt-3">
                  <div className="text-right">
                    <p className="text-lg font-bold">Total: <span className="text-emerald-600">{formatCurrency(total)}</span></p>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirmar compra
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Compra {detalle.numero}</h2>
              <button onClick={() => setDetalle(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-gray-500">Proveedor:</span> <strong>{(detalle as any).proveedores?.nombre || '-'}</strong></div>
                <div><span className="text-gray-500">Fecha:</span> <strong>{formatDate(detalle.fecha)}</strong></div>
                <div><span className="text-gray-500">Condición:</span> <span className={`badge ml-1 ${estadoBadgeClass(detalle.condicion_pago)}`}>{detalle.condicion_pago}</span></div>
                {detalle.numero_remito && <div><span className="text-gray-500">Remito:</span> <strong>{detalle.numero_remito}</strong></div>}
              </div>
              <table className="w-full text-sm">
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
                  {detalle.compra_items?.map(item => (
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
              <div className="text-right font-bold text-lg">Total: {formatCurrency(detalle.total)}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
