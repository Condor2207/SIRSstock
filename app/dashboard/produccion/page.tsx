'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatDate, formatNumber, estadoBadgeClass } from '@/lib/utils';
import { Plus, Search, Eye, X, Loader2, Factory, Trash2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Produccion, Producto } from '@/lib/types';

interface ProduccionItemForm {
  producto_id: string;
  producto_nombre: string;
  numero_lote: string;
  fecha_vencimiento: string;
  cantidad: number;
  usa_lote_comun: boolean;
}

interface InsumoForm {
  producto_id: string;
  producto_nombre: string;
  cantidad: number;
}

export default function ProduccionPage() {
  const supabase = createClient();
  const [producciones, setProducciones] = useState<Produccion[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [detalle, setDetalle] = useState<Produccion | null>(null);
  const [saving, setSaving] = useState(false);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [form, setForm] = useState({
    fecha: new Date().toISOString().split('T')[0],
    descripcion: '',
    lote_comun: '',
    fecha_vencimiento_comun: '',
    usar_lote_comun: true,
  });
  const [items, setItems] = useState<ProduccionItemForm[]>([]);
  const [insumos, setInsumos] = useState<InsumoForm[]>([]);
  const [mostrarInsumos, setMostrarInsumos] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('producciones').select('*, produccion_items(*, productos(nombre, sku))').order('created_at', { ascending: false }).limit(50);
    setProducciones(data as Produccion[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase.from('productos').select('id, sku, nombre, control_lote, stock_actual').eq('activo', true).order('nombre').then(r => setProductos(r.data as Producto[] || []));
  }, [load]);

  function addItem() {
    setItems(prev => [...prev, { producto_id: '', producto_nombre: '', numero_lote: '', fecha_vencimiento: '', cantidad: 1, usa_lote_comun: form.usar_lote_comun }]);
  }

  function updateItem(idx: number, campo: string, valor: any) {
    setItems(prev => {
      const updated = [...prev];
      const item = { ...updated[idx], [campo]: valor };
      if (campo === 'producto_id') {
        const prod = productos.find(p => p.id === valor);
        item.producto_nombre = prod ? `${prod.sku} - ${prod.nombre}` : '';
        if (form.usar_lote_comun) {
          item.numero_lote = form.lote_comun;
          item.fecha_vencimiento = form.fecha_vencimiento_comun;
        }
      }
      updated[idx] = item;
      return updated;
    });
  }

  function addInsumo() {
    setInsumos(prev => [...prev, { producto_id: '', producto_nombre: '', cantidad: 1 }]);
  }

  function updateInsumo(idx: number, campo: string, valor: any) {
    setInsumos(prev => {
      const updated = [...prev];
      const ins = { ...updated[idx], [campo]: valor };
      if (campo === 'producto_id') {
        const prod = productos.find(p => p.id === valor);
        ins.producto_nombre = prod ? `${prod.sku} - ${prod.nombre}` : '';
      }
      updated[idx] = ins;
      return updated;
    });
  }

  // Sincronizar lote común con items cuando cambia
  function handleLoteComunChange(lote: string) {
    setForm(f => ({ ...f, lote_comun: lote }));
    if (form.usar_lote_comun) {
      setItems(prev => prev.map(i => i.usa_lote_comun ? { ...i, numero_lote: lote } : i));
    }
  }

  function handleFechaVencComunChange(fecha: string) {
    setForm(f => ({ ...f, fecha_vencimiento_comun: fecha }));
    if (form.usar_lote_comun) {
      setItems(prev => prev.map(i => i.usa_lote_comun ? { ...i, fecha_vencimiento: fecha } : i));
    }
  }

  async function handleSave(confirmar: boolean) {
    if (items.length === 0) { toast.error('Agregá al menos un producto producido'); return; }
    if (items.some(i => !i.producto_id || i.cantidad <= 0)) { toast.error('Completá todos los productos'); return; }
    setSaving(true);
    try {
      const { count } = await supabase.from('producciones').select('*', { count: 'exact', head: true });
      const numProd = `P-${String((count || 0) + 1).padStart(5, '0')}`;

      const { data: prod, error } = await supabase.from('producciones').insert({
        numero: numProd,
        fecha: form.fecha,
        descripcion: form.descripcion || null,
        lote_comun: form.usar_lote_comun ? (form.lote_comun || null) : null,
        fecha_vencimiento_comun: form.usar_lote_comun ? (form.fecha_vencimiento_comun || null) : null,
        estado: confirmar ? 'confirmado' : 'borrador',
      }).select().single();
      if (error) throw error;

      // Items producción
      const itemsData = items.map(i => ({
        produccion_id: prod.id,
        producto_id: i.producto_id,
        numero_lote: i.usa_lote_comun ? form.lote_comun : i.numero_lote,
        fecha_vencimiento: (i.usa_lote_comun ? form.fecha_vencimiento_comun : i.fecha_vencimiento) || null,
        cantidad: i.cantidad,
      }));
      await supabase.from('produccion_items').insert(itemsData);

      // Insumos
      if (insumos.length > 0 && insumos[0].producto_id) {
        const insumosData = insumos.filter(i => i.producto_id).map(i => ({
          produccion_id: prod.id,
          producto_id: i.producto_id,
          cantidad: i.cantidad,
        }));
        await supabase.from('produccion_insumos').insert(insumosData);
      }

      // Si se confirma, actualizar stock
      if (confirmar) {
        for (const item of items) {
          const prodData = productos.find(p => p.id === item.producto_id);
          if (prodData) {
            await supabase.from('productos').update({ stock_actual: prodData.stock_actual + item.cantidad }).eq('id', item.producto_id);
          }
          const loteNum = item.usa_lote_comun ? form.lote_comun : item.numero_lote;
          const loteVenc = item.usa_lote_comun ? form.fecha_vencimiento_comun : item.fecha_vencimiento;
          if (loteNum) {
            const { data: existing } = await supabase.from('lotes').select('id, stock_actual').eq('producto_id', item.producto_id).eq('numero_lote', loteNum).single();
            if (existing) {
              await supabase.from('lotes').update({ stock_actual: existing.stock_actual + item.cantidad }).eq('id', existing.id);
            } else {
              await supabase.from('lotes').insert({
                producto_id: item.producto_id, numero_lote: loteNum,
                fecha_vencimiento: loteVenc || null,
                stock_actual: item.cantidad, stock_inicial: item.cantidad,
              });
            }
          }
          await supabase.from('movimientos_stock').insert({
            producto_id: item.producto_id, tipo: 'produccion',
            cantidad: item.cantidad, referencia_tipo: 'produccion', referencia_id: prod.id,
          });
        }

        // Descontar insumos del stock
        for (const ins of insumos.filter(i => i.producto_id)) {
          const prodIns = productos.find(p => p.id === ins.producto_id);
          if (prodIns) {
            await supabase.from('productos').update({ stock_actual: Math.max(0, prodIns.stock_actual - ins.cantidad) }).eq('id', ins.producto_id);
          }
        }
      }

      toast.success(`Producción ${numProd} ${confirmar ? 'confirmada' : 'guardada como borrador'}`);
      setShowModal(false);
      setItems([]);
      setInsumos([]);
      setForm({ fecha: new Date().toISOString().split('T')[0], descripcion: '', lote_comun: '', fecha_vencimiento_comun: '', usar_lote_comun: true });
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function confirmarProd(id: string) {
    // Simplificado: cambiar estado a confirmado
    await supabase.from('producciones').update({ estado: 'confirmado' }).eq('id', id);
    toast.success('Producción confirmada');
    load();
  }

  async function openDetalle(p: Produccion) {
    const { data } = await supabase.from('producciones').select('*, produccion_items(*, productos(nombre, sku)), produccion_insumos(*, productos(nombre, sku))').eq('id', p.id).single();
    setDetalle(data as Produccion);
  }

  return (
    <>
      <Header title="Producción" subtitle="Control de lotes de producción y trazabilidad" />
      <div className="p-6 space-y-4">
        <div className="flex justify-end">
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nueva producción
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : producciones.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Factory className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin producciones registradas</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">N°</th>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Descripción</th>
                    <th className="table-header">Lote común</th>
                    <th className="table-header">Productos</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {producciones.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{p.numero}</td>
                      <td className="table-cell text-xs">{formatDate(p.fecha)}</td>
                      <td className="table-cell">{p.descripcion || '-'}</td>
                      <td className="table-cell font-mono text-xs">{p.lote_comun || 'Por presentación'}</td>
                      <td className="table-cell">
                        <div className="space-y-0.5">
                          {p.produccion_items?.slice(0, 3).map(i => (
                            <div key={i.id} className="text-xs text-gray-600 dark:text-gray-400">
                              {(i as any).productos?.sku} — {formatNumber(i.cantidad, 1)} uds. · Lote: {i.numero_lote}
                            </div>
                          ))}
                          {(p.produccion_items?.length || 0) > 3 && (
                            <div className="text-xs text-gray-400">+{(p.produccion_items?.length || 0) - 3} más</div>
                          )}
                        </div>
                      </td>
                      <td className="table-cell"><span className={`badge ${estadoBadgeClass(p.estado)}`}>{p.estado}</span></td>
                      <td className="table-cell">
                        <div className="flex gap-1">
                          <button onClick={() => openDetalle(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Ver detalle">
                            <Eye className="w-4 h-4" />
                          </button>
                          {p.estado === 'borrador' && (
                            <button onClick={() => confirmarProd(p.id)} className="p-1.5 rounded hover:bg-green-50 text-gray-500 hover:text-green-600" title="Confirmar">
                              <CheckCircle className="w-4 h-4" />
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

      {/* Modal nueva producción */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-3xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nueva Producción</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-5">
              {/* Datos generales */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Descripción</label>
                  <input className="input" value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} placeholder="Descripción de la producción" />
                </div>
              </div>

              {/* Lote */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/10 rounded-lg space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.usar_lote_comun} onChange={e => setForm(f => ({ ...f, usar_lote_comun: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Todos los productos comparten el mismo lote y vencimiento</span>
                </label>
                {form.usar_lote_comun && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="label text-xs">N° Lote común</label>
                      <input className="input" value={form.lote_comun} onChange={e => handleLoteComunChange(e.target.value)} placeholder="P2025-001" />
                    </div>
                    <div>
                      <label className="label text-xs">Fecha de vencimiento común</label>
                      <input type="date" className="input" value={form.fecha_vencimiento_comun} onChange={e => handleFechaVencComunChange(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Productos producidos */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Productos generados (output)</h3>
                  <button onClick={addItem} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                {items.length === 0 ? (
                  <div className="py-5 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                    Agregá los productos que genera esta producción
                  </div>
                ) : (
                  <div className="space-y-2">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end text-sm">
                          <div className="sm:col-span-2">
                            <label className="label text-xs">Producto</label>
                            <select className="input py-1.5" value={item.producto_id} onChange={e => updateItem(idx, 'producto_id', e.target.value)}>
                              <option value="">Seleccionar...</option>
                              {productos.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>)}
                            </select>
                          </div>
                          <div>
                            <label className="label text-xs">Cantidad</label>
                            <input type="number" min="0.001" step="0.001" className="input py-1.5" value={item.cantidad} onChange={e => updateItem(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                          </div>
                          {!form.usar_lote_comun && (
                            <>
                              <div>
                                <label className="label text-xs">Lote</label>
                                <input className="input py-1.5" value={item.numero_lote} onChange={e => updateItem(idx, 'numero_lote', e.target.value)} placeholder="Lote propio" />
                              </div>
                              <div>
                                <label className="label text-xs">Vencimiento</label>
                                <input type="date" className="input py-1.5" value={item.fecha_vencimiento} onChange={e => updateItem(idx, 'fecha_vencimiento', e.target.value)} />
                              </div>
                            </>
                          )}
                          {form.usar_lote_comun && (
                            <div className="text-xs text-blue-600 flex items-end pb-2">
                              Lote: {form.lote_comun || '—'} · Vence: {form.fecha_vencimiento_comun ? formatDate(form.fecha_vencimiento_comun) : '—'}
                            </div>
                          )}
                          <div className="flex items-end justify-end pb-0.5">
                            <button onClick={() => setItems(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Insumos (opcional) */}
              <div>
                <button onClick={() => setMostrarInsumos(!mostrarInsumos)} className="text-sm text-blue-600 hover:underline">
                  {mostrarInsumos ? '▼' : '▶'} Registrar insumos/materias primas utilizadas (opcional)
                </button>
                {mostrarInsumos && (
                  <div className="mt-3 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-gray-500">Los insumos se descontarán del stock al confirmar la producción</p>
                      <button onClick={addInsumo} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar insumo</button>
                    </div>
                    {insumos.map((ins, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2 items-end text-sm">
                        <div className="col-span-2">
                          <label className="label text-xs">Insumo/Materia prima</label>
                          <select className="input py-1.5" value={ins.producto_id} onChange={e => updateInsumo(idx, 'producto_id', e.target.value)}>
                            <option value="">Seleccionar...</option>
                            {productos.map(p => <option key={p.id} value={p.id}>{p.sku} - {p.nombre}</option>)}
                          </select>
                        </div>
                        <div className="flex gap-1 items-end">
                          <div className="flex-1">
                            <label className="label text-xs">Cantidad</label>
                            <input type="number" min="0.001" step="0.001" className="input py-1.5" value={ins.cantidad} onChange={e => updateInsumo(idx, 'cantidad', parseFloat(e.target.value) || 0)} />
                          </div>
                          <button onClick={() => setInsumos(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 mb-0.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar borrador
              </button>
              <button onClick={() => handleSave(true)} disabled={saving} className="btn-success flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                <CheckCircle className="w-4 h-4" /> Confirmar y actualizar stock
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detalle */}
      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <div>
                <h2 className="section-title">Producción {detalle.numero}</h2>
                <p className="text-sm text-gray-500">{formatDate(detalle.fecha)} · <span className={`badge ${estadoBadgeClass(detalle.estado)}`}>{detalle.estado}</span></p>
              </div>
              <button onClick={() => setDetalle(null)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              {detalle.descripcion && <p className="text-sm text-gray-600 dark:text-gray-400">{detalle.descripcion}</p>}
              {detalle.lote_comun && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm">
                  <span className="font-semibold">Lote común: </span>{detalle.lote_comun}
                  {detalle.fecha_vencimiento_comun && <span className="ml-2 text-gray-500">· Vence: {formatDate(detalle.fecha_vencimiento_comun)}</span>}
                </div>
              )}
              <div>
                <h3 className="font-semibold text-sm mb-2">Productos generados</h3>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="table-header">Producto</th>
                      <th className="table-header">Lote</th>
                      <th className="table-header">Vencimiento</th>
                      <th className="table-header">Cantidad</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                    {detalle.produccion_items?.map(i => (
                      <tr key={i.id}>
                        <td className="table-cell">{(i as any).productos?.nombre}</td>
                        <td className="table-cell font-mono text-xs">{i.numero_lote}</td>
                        <td className="table-cell text-xs">{i.fecha_vencimiento ? formatDate(i.fecha_vencimiento) : '-'}</td>
                        <td className="table-cell font-semibold">{formatNumber(i.cantidad, 1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(detalle as any).produccion_insumos?.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Insumos utilizados</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800">
                      <tr>
                        <th className="table-header">Insumo</th>
                        <th className="table-header">Cantidad</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {(detalle as any).produccion_insumos?.map((i: any) => (
                        <tr key={i.id}>
                          <td className="table-cell">{i.productos?.nombre}</td>
                          <td className="table-cell font-semibold">{formatNumber(i.cantidad, 3)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
