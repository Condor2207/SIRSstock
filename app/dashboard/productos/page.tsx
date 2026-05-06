'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, estadoBadgeClass } from '@/lib/utils';
import { Plus, Search, Edit2, Trash2, X, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Producto, Categoria } from '@/lib/types';

const UNIDADES = ['unidad', 'kg', 'g', 'litro', 'ml', 'caja', 'bolsa'];

export default function ProductosPage() {
  const supabase = createClient();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    sku: '', nombre: '', descripcion: '', categoria_id: '',
    unidad_medida: 'unidad', precio_venta: '', precio_compra: '',
    stock_minimo: '', control_lote: false, activo: true,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes] = await Promise.all([
      supabase.from('productos').select('*, categoria:categorias(nombre)').order('nombre'),
      supabase.from('categorias').select('*').order('nombre'),
    ]);
    setProductos(prodRes.data as Producto[] || []);
    setCategorias(catRes.data as Categoria[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openNew() {
    setEditando(null);
    setForm({ sku: '', nombre: '', descripcion: '', categoria_id: '', unidad_medida: 'unidad', precio_venta: '', precio_compra: '', stock_minimo: '', control_lote: false, activo: true });
    setShowModal(true);
  }

  function openEdit(p: Producto) {
    setEditando(p);
    setForm({
      sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || '', unidad_medida: p.unidad_medida,
      precio_venta: String(p.precio_venta), precio_compra: String(p.precio_compra || 0),
      stock_minimo: String(p.stock_minimo || 0), control_lote: p.control_lote, activo: p.activo,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.sku || !form.nombre) { toast.error('SKU y nombre son obligatorios'); return; }
    setSaving(true);
    const payload = {
      sku: form.sku.toUpperCase(),
      nombre: form.nombre,
      descripcion: form.descripcion || null,
      categoria_id: form.categoria_id || null,
      unidad_medida: form.unidad_medida,
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_compra: parseFloat(form.precio_compra) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      control_lote: form.control_lote,
      activo: form.activo,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('productos').update(payload).eq('id', editando.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        const { error } = await supabase.from('productos').insert({ ...payload, stock_actual: 0 });
        if (error) throw error;
        toast.success('Producto creado');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(p: Producto) {
    await supabase.from('productos').update({ activo: !p.activo }).eq('id', p.id);
    toast.success(p.activo ? 'Producto desactivado' : 'Producto activado');
    loadData();
  }

  const filtered = productos.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Productos" subtitle="Catálogo de productos y precios" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo producto
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No se encontraron productos</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Nombre</th>
                    <th className="table-header">Categoría</th>
                    <th className="table-header">Unidad</th>
                    <th className="table-header">Precio Venta</th>
                    <th className="table-header">Stock</th>
                    <th className="table-header">Lote</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-semibold text-blue-600">{p.sku}</td>
                      <td className="table-cell font-medium">{p.nombre}</td>
                      <td className="table-cell text-gray-500">{(p as any).categoria?.nombre || '-'}</td>
                      <td className="table-cell">{p.unidad_medida}</td>
                      <td className="table-cell font-semibold">{formatCurrency(p.precio_venta)}</td>
                      <td className="table-cell">
                        <span className={p.stock_actual <= p.stock_minimo ? 'text-red-500 font-bold' : 'text-emerald-600 font-semibold'}>
                          {p.stock_actual}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${p.control_lote ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-gray-100 text-gray-500'}`}>
                          {p.control_lote ? 'Sí' : 'No'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${p.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => toggleActivo(p)} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs ${p.activo ? 'text-red-500' : 'text-green-500'}`} title={p.activo ? 'Desactivar' : 'Activar'}>
                            {p.activo ? <Trash2 className="w-3.5 h-3.5" /> : '✓'}
                          </button>
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

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">SKU *</label>
                  <input className="input" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} placeholder="EDU-001" />
                </div>
                <div>
                  <label className="label">Unidad de medida</label>
                  <select className="input" value={form.unidad_medida} onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}>
                    {UNIDADES.map(u => <option key={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Stevia en Polvo 50g" />
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div>
                <label className="label">Categoría</label>
                <select className="input" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                  <option value="">Sin categoría</option>
                  {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="label">Precio Venta ($)</label>
                  <input type="number" min="0" step="0.01" className="input" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Precio Compra ($)</label>
                  <input type="number" min="0" step="0.01" className="input" value={form.precio_compra} onChange={e => setForm(f => ({ ...f, precio_compra: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Stock mínimo</label>
                  <input type="number" min="0" className="input" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} />
                </div>
              </div>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.control_lote} onChange={e => setForm(f => ({ ...f, control_lote: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Control por lote/vencimiento</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Activo</span>
                </label>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
