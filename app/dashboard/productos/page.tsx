'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency } from '@/lib/utils';
import { Plus, Search, Edit2, Trash2, X, Loader2, Package } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Producto, Categoria, Clasificacion, TasaIva, Marca, Linea, Grupo, UnidadMedida, ListaPrecios } from '@/lib/types';

export default function ProductosPage() {
  const supabase = createClient();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([]);
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [tabModal, setTabModal] = useState<'general' | 'precios'>('general');
  const [preciosPorLista, setPreciosPorLista] = useState<Record<string, string>>({});

  const [form, setForm] = useState({
    sku: '', nombre: '', descripcion: '', categoria_id: '',
    unidad_medida: '', precio_venta: '', precio_compra: '',
    stock_minimo: '', control_lote: false, activo: true,
    clasificacion_id: '', codigo_barras: '',
    marca_id: '', linea_id: '', grupo_id: '',
    tasa_iva_id: '', es_exportacion: false,
    plazo_vencimiento_meses: '36', porcentaje_comision: '0',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes, clasRes, tivaRes, marcaRes, lineaRes, grupoRes, unidRes, listaRes] = await Promise.all([
      supabase.from('productos').select('*, categoria:categorias(nombre), clasificacion:clasificaciones(nombre), tasa_iva_ref:tasas_iva(nombre,porcentaje)').order('nombre'),
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('clasificaciones').select('*').eq('activo', true).order('nombre'),
      supabase.from('tasas_iva').select('*').eq('activo', true).order('porcentaje'),
      supabase.from('marcas').select('*').eq('activo', true).order('nombre'),
      supabase.from('lineas').select('*').eq('activo', true).order('nombre'),
      supabase.from('grupos').select('*').eq('activo', true).order('nombre'),
      supabase.from('unidades_medida').select('*').eq('activo', true).order('nombre'),
      supabase.from('listas_precios').select('*').eq('activo', true).order('nombre'),
    ]);
    setProductos(prodRes.data as any[] || []);
    setCategorias(catRes.data as Categoria[] || []);
    setClasificaciones(clasRes.data as Clasificacion[] || []);
    setTasasIva(tivaRes.data as TasaIva[] || []);
    setMarcas(marcaRes.data as Marca[] || []);
    setLineas(lineaRes.data as Linea[] || []);
    setGrupos(grupoRes.data as Grupo[] || []);
    setUnidades(unidRes.data as UnidadMedida[] || []);
    setListas(listaRes.data as ListaPrecios[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function openEdit(p: Producto) {
    setEditando(p);
    setForm({
      sku: p.sku, nombre: p.nombre, descripcion: p.descripcion || '',
      categoria_id: p.categoria_id || '', unidad_medida: p.unidad_medida,
      precio_venta: String(p.precio_venta), precio_compra: String(p.precio_compra || 0),
      stock_minimo: String(p.stock_minimo || 0), control_lote: p.control_lote, activo: p.activo,
      clasificacion_id: (p as any).clasificacion_id || '', codigo_barras: (p as any).codigo_barras || '',
      marca_id: (p as any).marca_id || '', linea_id: (p as any).linea_id || '', grupo_id: (p as any).grupo_id || '',
      tasa_iva_id: (p as any).tasa_iva_id || '', es_exportacion: (p as any).es_exportacion || false,
      plazo_vencimiento_meses: String((p as any).plazo_vencimiento_meses ?? 36),
      porcentaje_comision: String((p as any).porcentaje_comision ?? 0),
    });
    const { data: precios } = await supabase.from('producto_precios').select('lista_precios_id, precio').eq('producto_id', p.id);
    const map: Record<string, string> = {};
    (precios || []).forEach((pp: any) => { map[pp.lista_precios_id] = String(pp.precio); });
    setPreciosPorLista(map);
    setTabModal('general');
    setShowModal(true);
  }

  function openNew() {
    setEditando(null);
    setForm({ sku: '', nombre: '', descripcion: '', categoria_id: '', unidad_medida: unidades[0]?.nombre || 'Unidad', precio_venta: '', precio_compra: '', stock_minimo: '0', control_lote: false, activo: true, clasificacion_id: '', codigo_barras: '', marca_id: '', linea_id: '', grupo_id: '', tasa_iva_id: '', es_exportacion: false, plazo_vencimiento_meses: '36', porcentaje_comision: '0' });
    setPreciosPorLista({});
    setTabModal('general');
    setShowModal(true);
  }

  const lineasFiltradas = lineas.filter(l => l.marca_id === form.marca_id);
  const gruposFiltrados = grupos.filter(g => g.linea_id === form.linea_id);

  async function handleSave() {
    if (!form.sku || !form.nombre) { toast.error('SKU y nombre son obligatorios'); return; }
    setSaving(true);
    const payload: any = {
      sku: form.sku.toUpperCase(), nombre: form.nombre,
      descripcion: form.descripcion || null,
      categoria_id: form.categoria_id || null,
      unidad_medida: form.unidad_medida || 'Unidad',
      precio_venta: parseFloat(form.precio_venta) || 0,
      precio_compra: parseFloat(form.precio_compra) || 0,
      stock_minimo: parseFloat(form.stock_minimo) || 0,
      control_lote: form.control_lote, activo: form.activo,
      clasificacion_id: form.clasificacion_id || null,
      codigo_barras: form.codigo_barras || null,
      marca_id: form.marca_id || null,
      linea_id: form.linea_id || null,
      grupo_id: form.grupo_id || null,
      tasa_iva_id: form.tasa_iva_id || null,
      es_exportacion: form.es_exportacion,
      plazo_vencimiento_meses: parseInt(form.plazo_vencimiento_meses) || 36,
      porcentaje_comision: parseFloat(form.porcentaje_comision) || 0,
    };
    try {
      let productoId = editando?.id;
      if (editando) {
        const { error } = await supabase.from('productos').update(payload).eq('id', editando.id);
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        const { data, error } = await supabase.from('productos').insert({ ...payload, stock_actual: 0 }).select('id').single();
        if (error) throw error;
        productoId = data.id;
        toast.success('Producto creado');
      }
      for (const [lista_precios_id, precioStr] of Object.entries(preciosPorLista)) {
        const precio = parseFloat(precioStr) || 0;
        await supabase.from('producto_precios').upsert({ producto_id: productoId, lista_precios_id, precio }, { onConflict: 'producto_id,lista_precios_id' });
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
                    <th className="table-header">Cód.</th>
                    <th className="table-header">SKU</th>
                    <th className="table-header">Nombre</th>
                    <th className="table-header">Clasificación</th>
                    <th className="table-header">Unidad</th>
                    <th className="table-header">Precio Venta</th>
                    <th className="table-header">Stock</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell text-xs text-gray-400 font-mono">{(p as any).codigo_interno || '—'}</td>
                      <td className="table-cell font-mono text-xs font-semibold text-blue-600">{p.sku}</td>
                      <td className="table-cell font-medium">{p.nombre}</td>
                      <td className="table-cell text-gray-500 text-xs">{(p as any).clasificacion?.nombre || '—'}</td>
                      <td className="table-cell text-xs">{p.unidad_medida}</td>
                      <td className="table-cell font-semibold">{formatCurrency(p.precio_venta)}</td>
                      <td className="table-cell">
                        <span className={p.stock_actual <= p.stock_minimo ? 'text-red-500 font-bold' : 'text-emerald-600 font-semibold'}>
                          {p.stock_actual}
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
                          <button onClick={() => toggleActivo(p)} className={`p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-xs ${p.activo ? 'text-red-500' : 'text-green-500'}`}>
                            <Trash2 className="w-3.5 h-3.5" />
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
          <div className="card w-full max-w-2xl max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h2 className="section-title">{editando ? 'Editar producto' : 'Nuevo producto'}</h2>
              <button onClick={() => setShowModal(false)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-100 dark:border-gray-700 shrink-0">
              {(['general', 'precios'] as const).map(tab => (
                <button key={tab} onClick={() => setTabModal(tab)}
                  className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tabModal === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {tab === 'general' ? 'Datos generales' : 'Precios por lista'}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {tabModal === 'general' && (
                <>
                  {editando && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>Código interno:</span>
                      <span className="font-mono font-bold text-blue-500">{(editando as any).codigo_interno || 'auto'}</span>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">SKU *</label>
                      <input className="input uppercase" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="EDU-001" />
                    </div>
                    <div>
                      <label className="label">Código de barras</label>
                      <input className="input" value={form.codigo_barras} onChange={e => setForm(f => ({ ...f, codigo_barras: e.target.value }))} placeholder="7890000000000" />
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Clasificación</label>
                      <select className="input" value={form.clasificacion_id} onChange={e => setForm(f => ({ ...f, clasificacion_id: e.target.value }))}>
                        <option value="">Sin clasificación</option>
                        {clasificaciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Categoría</label>
                      <select className="input" value={form.categoria_id} onChange={e => setForm(f => ({ ...f, categoria_id: e.target.value }))}>
                        <option value="">Sin categoría</option>
                        {categorias.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Unidad de medida</label>
                      <select className="input" value={form.unidad_medida} onChange={e => setForm(f => ({ ...f, unidad_medida: e.target.value }))}>
                        <option value="">Seleccionar</option>
                        {unidades.map(u => <option key={u.id} value={u.nombre}>{u.nombre} ({u.abreviatura})</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Tasa IVA</label>
                      <select className="input" value={form.tasa_iva_id} onChange={e => setForm(f => ({ ...f, tasa_iva_id: e.target.value }))}>
                        <option value="">Sin asignar</option>
                        {tasasIva.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.porcentaje}%)</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Marca</label>
                      <select className="input" value={form.marca_id} onChange={e => setForm(f => ({ ...f, marca_id: e.target.value, linea_id: '', grupo_id: '' }))}>
                        <option value="">—</option>
                        {marcas.map(m => <option key={m.id} value={m.id}>{m.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Línea</label>
                      <select className="input" value={form.linea_id} onChange={e => setForm(f => ({ ...f, linea_id: e.target.value, grupo_id: '' }))} disabled={!form.marca_id}>
                        <option value="">—</option>
                        {lineasFiltradas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Grupo</label>
                      <select className="input" value={form.grupo_id} onChange={e => setForm(f => ({ ...f, grupo_id: e.target.value }))} disabled={!form.linea_id}>
                        <option value="">—</option>
                        {gruposFiltrados.map(g => <option key={g.id} value={g.id}>{g.nombre}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Precio Venta (Gs.)</label>
                      <input type="number" min="0" className="input" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Precio Compra (Gs.)</label>
                      <input type="number" min="0" className="input" value={form.precio_compra} onChange={e => setForm(f => ({ ...f, precio_compra: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Stock mínimo</label>
                      <input type="number" min="0" className="input" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Plazo venc. (meses)</label>
                      <input type="number" min="0" className="input" value={form.plazo_vencimiento_meses} onChange={e => setForm(f => ({ ...f, plazo_vencimiento_meses: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">% Comisión</label>
                      <input type="number" min="0" max="100" step="0.01" className="input" value={form.porcentaje_comision} onChange={e => setForm(f => ({ ...f, porcentaje_comision: e.target.value }))} />
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.control_lote} onChange={e => setForm(f => ({ ...f, control_lote: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Control por lote/vencimiento</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.es_exportacion} onChange={e => setForm(f => ({ ...f, es_exportacion: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Es exportación</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                      <span className="text-sm text-gray-700 dark:text-gray-300">Activo</span>
                    </label>
                  </div>
                </>
              )}

              {tabModal === 'precios' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ingresá el precio por lista. Si está vacío, se usa el precio de venta general.</p>
                  <div className="space-y-2">
                    {listas.map(lista => (
                      <div key={lista.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-52 shrink-0">{lista.nombre}</span>
                        <input
                          type="number" min="0" placeholder={form.precio_venta || '0'}
                          className="input max-w-[180px]"
                          value={preciosPorLista[lista.id] || ''}
                          onChange={e => setPreciosPorLista(prev => ({ ...prev, [lista.id]: e.target.value }))}
                        />
                        <span className="text-xs text-gray-400">Gs.</span>
                      </div>
                    ))}
                    {listas.length === 0 && <p className="text-sm text-gray-400">No hay listas configuradas. Ir a Configuración → Listas de Precios.</p>}
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700 shrink-0">
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
