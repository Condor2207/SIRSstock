'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatCurrency, getErrorMessage, isSchemaCacheMissing, toInteger, toIntegerInput } from '@/lib/utils';
import { Plus, Search, Edit2, Trash2, X, Loader2, Package, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchSelect } from '@/components/SearchSelect';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';
import type { Producto, Categoria, Clasificacion, TasaIva, Marca, Linea, Grupo, UnidadMedida, ListaPrecios, MarcaLinea, MarcaGrupo } from '@/lib/types';

export default function ProductosPage() {
  const supabase = createClient();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([]);
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([]);
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcaLineas, setMarcaLineas] = useState<MarcaLinea[]>([]);
  const [marcaGrupos, setMarcaGrupos] = useState<MarcaGrupo[]>([]);
  const [unidades, setUnidades] = useState<UnidadMedida[]>([]);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filtroActivo, setFiltroActivo] = useState<'activo' | 'inactivo' | 'todos'>('activo');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Producto | null>(null);
  const [saving, setSaving] = useState(false);
  const [tabModal, setTabModal] = useState<'general' | 'precios' | 'exportacion'>('general');
  const [preciosPorLista, setPreciosPorLista] = useState<Record<string, string>>({});
  const [formExport, setFormExport] = useState({
    nombre_en: '', descripcion_en: '', unidad_medida_en: '', precio_usd: '',
    codigo_barras_en: '', notas_en: '',
  });

  const [form, setForm] = useState({
    sku: '', nombre: '', descripcion: '', categoria_id: '',
    unidad_medida: '', precio_venta: '', precio_compra: '',
    stock_minimo: '', control_lote: false,
    clasificacion_id: '', codigo_barras: '',
    marca_id: '', linea_id: '', grupo_id: '',
    tasa_iva_id: '', es_exportacion: false,
    plazo_vencimiento_meses: '36', porcentaje_comision: '0',
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [prodRes, catRes, clasRes, tivaRes, marcaRes, lineaRes, grupoRes, unidRes, listaRes, marcaLineasRes, marcaGruposRes] = await Promise.all([
      supabase.from('productos').select('*, categoria:categorias(nombre), clasificacion:clasificaciones(nombre), tasa_iva_ref:tasas_iva(nombre,porcentaje)').order('nombre'),
      supabase.from('categorias').select('*').order('nombre'),
      supabase.from('clasificaciones').select('*').eq('activo', true).order('nombre'),
      supabase.from('tasas_iva').select('*').eq('activo', true).order('porcentaje'),
      supabase.from('marcas').select('*').eq('activo', true).order('nombre'),
      supabase.from('lineas').select('*').eq('activo', true).order('nombre'),
      supabase.from('grupos').select('*').eq('activo', true).order('nombre'),
      supabase.from('unidades_medida').select('*').eq('activo', true).order('nombre'),
      supabase.from('listas_precios').select('*').eq('activo', true).order('nombre'),
      supabase.from('marca_lineas').select('marca_id,linea_id'),
      supabase.from('marca_grupos').select('marca_id,grupo_id'),
    ]);
    setProductos(prodRes.data as any[] || []);
    setCategorias(catRes.data as Categoria[] || []);
    setClasificaciones(clasRes.data as Clasificacion[] || []);
    setTasasIva(tivaRes.data as TasaIva[] || []);
    setMarcas(marcaRes.data as Marca[] || []);
    setLineas(lineaRes.data as Linea[] || []);
    setGrupos(grupoRes.data as Grupo[] || []);
    setMarcaLineas(marcaLineasRes.data as MarcaLinea[] || []);
    setMarcaGrupos(marcaGruposRes.data as MarcaGrupo[] || []);
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
      precio_venta: String(toInteger(p.precio_venta, 0)), precio_compra: String(toInteger(p.precio_compra || 0, 0)),
      stock_minimo: String(toInteger(p.stock_minimo || 0, 0)), control_lote: p.control_lote,
      clasificacion_id: (p as any).clasificacion_id || '', codigo_barras: (p as any).codigo_barras || '',
      marca_id: (p as any).marca_id || '', linea_id: (p as any).linea_id || '', grupo_id: (p as any).grupo_id || '',
      tasa_iva_id: (p as any).tasa_iva_id || '', es_exportacion: (p as any).es_exportacion || false,
      plazo_vencimiento_meses: String(toInteger((p as any).plazo_vencimiento_meses ?? 36, 36)),
      porcentaje_comision: String(toInteger((p as any).porcentaje_comision ?? 0, 0)),
    });
    const { data: precios } = await supabase.from('producto_precios').select('lista_precios_id, precio').eq('producto_id', p.id);
    const map: Record<string, string> = {};
    (precios || []).forEach((pp: any) => { map[pp.lista_precios_id] = String(toInteger(pp.precio, 0)); });
    setPreciosPorLista(map);
    // Cargar datos de exportación si existen
    const { data: expData } = await supabase.from('producto_exportacion').select('*').eq('producto_id', p.id).maybeSingle();
    setFormExport({
      nombre_en: expData?.nombre_en || '',
      descripcion_en: expData?.descripcion_en || '',
      unidad_medida_en: expData?.unidad_medida_en || '',
      precio_usd: expData?.precio_usd ? String(toInteger(expData.precio_usd, 0)) : '',
      codigo_barras_en: expData?.codigo_barras_en || '',
      notas_en: expData?.notas_en || '',
    });
    setTabModal('general');
    setShowModal(true);
  }

  function openNew() {
    setEditando(null);
    setForm({ sku: '', nombre: '', descripcion: '', categoria_id: '', unidad_medida: unidades[0]?.nombre || 'Unidad', precio_venta: '', precio_compra: '', stock_minimo: '0', control_lote: false, clasificacion_id: '', codigo_barras: '', marca_id: '', linea_id: '', grupo_id: '', tasa_iva_id: '', es_exportacion: false, plazo_vencimiento_meses: '36', porcentaje_comision: '0' });
    setPreciosPorLista({});
    setFormExport({ nombre_en: '', descripcion_en: '', unidad_medida_en: '', precio_usd: '', codigo_barras_en: '', notas_en: '' });
    setTabModal('general');
    setShowModal(true);
  }

  function calcFechaVencimiento(): string {
    const meses = parseInt(form.plazo_vencimiento_meses);
    if (!meses || meses <= 0) return '';
    const d = new Date();
    d.setMonth(d.getMonth() + meses);
    return d.toLocaleDateString('es-PY');
  }

  const lineasFiltradas = lineas.filter(l => marcaLineas.some(x => x.marca_id === form.marca_id && x.linea_id === l.id));
  const gruposFiltrados = grupos.filter(g => marcaGrupos.some(x => x.marca_id === form.marca_id && x.grupo_id === g.id));

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    // Validate SKU uniqueness (excluding current product when editing)
    // El SKU es obligatorio en la base. Si el usuario no lo ingresa,
    // generamos uno aquí para no depender exclusivamente de un trigger
    // que podría no estar instalado aún en una base existente.
    const skuIngresado = form.sku.trim().toUpperCase();
    const skuVal = skuIngresado || `AUTO-${crypto.randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase()}`;
    if (skuVal) {
      let skuQuery = supabase.from('productos').select('id').eq('sku', skuVal);
      if (editando) skuQuery = skuQuery.neq('id', editando.id);
      const { data: skuCheck } = await skuQuery.maybeSingle();
      if (skuCheck) { toast.error(`Ya existe otro producto con el SKU "${skuVal}"`); return; }
    }
    setSaving(true);
    const payloadBase: any = {
      sku: skuVal, nombre: form.nombre,
      descripcion: form.descripcion || null,
      categoria_id: form.categoria_id || null,
      unidad_medida: form.unidad_medida || 'Unidad',
      precio_venta: toInteger(form.precio_venta, 0),
      precio_compra: toInteger(form.precio_compra, 0),
      stock_minimo: toInteger(form.stock_minimo, 0),
      control_lote: form.control_lote,
    };
    const payloadExtra: any = {
      clasificacion_id: form.clasificacion_id || null,
      codigo_barras: form.codigo_barras || null,
      marca_id: form.marca_id || null,
      linea_id: form.linea_id || null,
      grupo_id: form.grupo_id || null,
      tasa_iva_id: form.tasa_iva_id || null,
      es_exportacion: form.es_exportacion,
      plazo_vencimiento_meses: toInteger(form.plazo_vencimiento_meses, 36) || 36,
      porcentaje_comision: toInteger(form.porcentaje_comision, 0),
    };
    try {
      const payload = { ...payloadBase, ...payloadExtra };
      const retryRefs = ['clasificacion_id', 'codigo_barras', 'marca_id', 'linea_id', 'grupo_id', 'tasa_iva_id', 'es_exportacion', 'plazo_vencimiento_meses', 'porcentaje_comision'];
      let productoId = editando?.id;
      let auditAction: 'crear' | 'editar' = editando ? 'editar' : 'crear';
      if (editando) {
        let { error } = await supabase.from('productos').update(payload).eq('id', editando.id);
        if (error && isSchemaCacheMissing(error, retryRefs)) {
          const fallback = await supabase.from('productos').update(payloadBase).eq('id', editando.id);
          error = fallback.error;
        }
        if (error) throw error;
        toast.success('Producto actualizado');
      } else {
        let { data, error } = await supabase.from('productos').insert({ ...payload, stock_actual: 0 }).select('id').single();
        if (error && isSchemaCacheMissing(error, retryRefs)) {
          const fallback = await supabase.from('productos').insert({ ...payloadBase, stock_actual: 0 }).select('id').single();
          data = fallback.data;
          error = fallback.error;
        }
        if (error) throw error;
        if (!data?.id) throw new Error('No se pudo obtener el ID del producto creado');
        productoId = data.id;
        toast.success('Producto creado');
      }
      for (const [lista_precios_id, precioStr] of Object.entries(preciosPorLista)) {
        const precio = toInteger(precioStr, 0);
        await supabase.from('producto_precios').upsert({ producto_id: productoId, lista_precios_id, precio }, { onConflict: 'producto_id,lista_precios_id' });
      }
      // Guardar datos de exportación si aplica
      if (payload.es_exportacion && productoId) {
        const expPayload = {
          producto_id: productoId,
          nombre_en: formExport.nombre_en || null,
          descripcion_en: formExport.descripcion_en || null,
          unidad_medida_en: formExport.unidad_medida_en || null,
          precio_usd: formExport.precio_usd ? toInteger(formExport.precio_usd, 0) : null,
          codigo_barras_en: formExport.codigo_barras_en || null,
          notas_en: formExport.notas_en || null,
        };
        await supabase.from('producto_exportacion').upsert(expPayload, { onConflict: 'producto_id' });
      }
      await logAudit(supabase, { modulo: 'Productos', entidad: 'Producto', accion: auditAction, descripcion: `${auditAction === 'crear' ? 'Creó' : 'Editó'} el producto ${payloadBase.nombre}`, registroId: productoId });
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(getErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(p: Producto) {
    if (!window.confirm(`¿Inactivar el producto "${p.nombre}"? Podrás reactivarlo luego.`)) return;
    const { error } = await supabase.from('productos').update({ activo: false }).eq('id', p.id);
    if (error) { toast.error(getErrorMessage(error)); return; }
    await logAudit(supabase, { modulo: 'Productos', entidad: 'Producto', accion: 'borrar', descripcion: `Inactivó el producto ${p.nombre}`, registroId: p.id });
    toast.success('Producto inactivado');
    loadData();
  }

  async function handleToggleActivo(p: Producto) {
    const nuevoEstado = !p.activo;
    const { error } = await supabase.from('productos').update({ activo: nuevoEstado }).eq('id', p.id);
    if (error) { toast.error(getErrorMessage(error)); return; }
    await logAudit(supabase, { modulo: 'Productos', entidad: 'Producto', accion: 'editar', descripcion: `${nuevoEstado ? 'Activó' : 'Inactivó'} el producto ${p.nombre}`, registroId: p.id });
    toast.success(nuevoEstado ? 'Producto activado' : 'Producto inactivado');
    loadData();
  }

  const filteredRaw = productos.filter(p => {
    if (filtroActivo === 'activo' && !p.activo) return false;
    if (filtroActivo === 'inactivo' && p.activo) return false;
    return (
      p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.sku.toLowerCase().includes(search.toLowerCase())
    );
  });
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  return (
    <>
      <Header title="Productos" subtitle="Catálogo de productos y precios" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o SKU..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 text-sm">
              {(['activo', 'inactivo', 'todos'] as const).map(f => (
                <button key={f} onClick={() => setFiltroActivo(f)}
                  className={`px-3 py-1.5 capitalize transition-colors ${filtroActivo === f ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'}`}>
                  {f === 'activo' ? 'Activos' : f === 'inactivo' ? 'Inactivos' : 'Todos'}
                </button>
              ))}
            </div>
            <button onClick={openNew} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nuevo producto
            </button>
          </div>
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
                    <SortableTh label="Cód." sortKey="codigo_interno" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="SKU" sortKey="sku" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Nombre" sortKey="nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Clasificación" sortKey="clasificacion" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Unidad" sortKey="unidad_medida" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Precio Venta" sortKey="precio_venta" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Stock" sortKey="stock_actual" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(p => (
                    <tr key={p.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!p.activo ? 'opacity-60' : ''}`}>
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
                        <button onClick={() => handleToggleActivo(p)} title={p.activo ? 'Inactivar' : 'Activar'}
                          className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full transition-colors ${p.activo ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {p.activo ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </button>
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500" title="Inactivar">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
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
              {(['general', 'precios', ...(form.es_exportacion ? ['exportacion'] : [])] as const).map((tab: any) => (
                <button key={tab} onClick={() => setTabModal(tab)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${tabModal === tab ? 'border-blue-500 text-blue-600 dark:text-blue-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
                  {tab === 'general' ? 'Datos generales' : tab === 'precios' ? 'Precios por lista' : '🌐 Export Prices'}
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
                      <label className="label">SKU <span className="text-gray-400 font-normal">(opcional — se auto-genera si está vacío)</span></label>
                      <input className="input uppercase" value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value.toUpperCase() }))} placeholder="Ej: EDU-001 (o dejar vacío)" />
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
                      <SearchSelect
                        options={clasificaciones.map(c => ({ value: c.id, label: c.nombre }))}
                        value={form.clasificacion_id}
                        onChange={v => setForm(f => ({ ...f, clasificacion_id: v }))}
                        placeholder="Sin clasificación"
                      />
                    </div>
                    <div>
                      <label className="label">Categoría</label>
                      <SearchSelect
                        options={categorias.map(c => ({ value: c.id, label: c.nombre }))}
                        value={form.categoria_id}
                        onChange={v => setForm(f => ({ ...f, categoria_id: v }))}
                        placeholder="Sin categoría"
                      />
                    </div>
                    <div>
                      <label className="label">Unidad de medida</label>
                      <SearchSelect
                        options={unidades.map(u => ({ value: u.nombre, label: `${u.nombre} (${u.abreviatura})` }))}
                        value={form.unidad_medida}
                        onChange={v => setForm(f => ({ ...f, unidad_medida: v }))}
                        placeholder="Seleccionar"
                      />
                    </div>
                    <div>
                      <label className="label">Tasa IVA</label>
                      <SearchSelect
                        options={tasasIva.map(t => ({ value: t.id, label: `${t.nombre} (${t.porcentaje}%)` }))}
                        value={form.tasa_iva_id}
                        onChange={v => setForm(f => ({ ...f, tasa_iva_id: v }))}
                        placeholder="Sin asignar"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Marca</label>
                      <SearchSelect
                        options={marcas.map(m => ({ value: m.id, label: m.nombre }))}
                        value={form.marca_id}
                        onChange={v => setForm(f => ({ ...f, marca_id: v, linea_id: '', grupo_id: '' }))}
                        placeholder="—"
                      />
                    </div>
                    <div>
                      <label className="label">Línea</label>
                      <SearchSelect
                        options={lineasFiltradas.map(l => ({ value: l.id, label: l.nombre }))}
                        value={form.linea_id}
                        onChange={v => setForm(f => ({ ...f, linea_id: v }))}
                        placeholder="—"
                        disabled={!form.marca_id}
                      />
                    </div>
                    <div>
                      <label className="label">Grupo</label>
                      <SearchSelect
                        options={gruposFiltrados.map(g => ({ value: g.id, label: g.nombre }))}
                        value={form.grupo_id}
                        onChange={v => setForm(f => ({ ...f, grupo_id: v }))}
                        placeholder="—"
                        disabled={!form.marca_id}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="label">Precio Venta (Gs.)</label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="input" value={form.precio_venta} onChange={e => setForm(f => ({ ...f, precio_venta: toIntegerInput(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Precio Compra (Gs.)</label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="input" value={form.precio_compra} onChange={e => setForm(f => ({ ...f, precio_compra: toIntegerInput(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Stock mínimo</label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="input" value={form.stock_minimo} onChange={e => setForm(f => ({ ...f, stock_minimo: toIntegerInput(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Plazo venc. (meses)</label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="input" value={form.plazo_vencimiento_meses} onChange={e => setForm(f => ({ ...f, plazo_vencimiento_meses: toIntegerInput(e.target.value) }))} />
                      {calcFechaVencimiento() && (
                        <p className="text-xs text-gray-400 mt-1">Vence aprox.: <span className="text-orange-500 font-medium">{calcFechaVencimiento()}</span></p>
                      )}
                    </div>
                    <div>
                      <label className="label">% Comisión</label>
                      <input type="number" min="0" max="100" step="1" inputMode="numeric" className="input" value={form.porcentaje_comision} onChange={e => setForm(f => ({ ...f, porcentaje_comision: toIntegerInput(e.target.value) }))} />
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
                  </div>
                </>
              )}

              {tabModal === 'exportacion' && (
                <div className="space-y-4">
                  <p className="text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                    Export fields — data used for international invoices. Stored separately in English.
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">Product Name (EN)</label>
                      <input className="input" placeholder="e.g. Stevia Powder 50g" value={formExport.nombre_en} onChange={e => setFormExport(f => ({ ...f, nombre_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Unit of Measure (EN)</label>
                      <input className="input" placeholder="e.g. Unit / Box / Kg" value={formExport.unidad_medida_en} onChange={e => setFormExport(f => ({ ...f, unidad_medida_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Barcode (Export)</label>
                      <input className="input" placeholder="International barcode" value={formExport.codigo_barras_en} onChange={e => setFormExport(f => ({ ...f, codigo_barras_en: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Export Price (USD)</label>
                      <input type="number" min="0" step="1" inputMode="numeric" className="input" placeholder="0" value={formExport.precio_usd} onChange={e => setFormExport(f => ({ ...f, precio_usd: toIntegerInput(e.target.value) }))} />
                    </div>
                  </div>
                  <div>
                    <label className="label">Description (EN)</label>
                    <textarea className="input" rows={2} placeholder="Product description in English..." value={formExport.descripcion_en} onChange={e => setFormExport(f => ({ ...f, descripcion_en: e.target.value }))} />
                  </div>
                  <div>
                    <label className="label">Export Notes</label>
                    <textarea className="input" rows={2} placeholder="Additional notes for export..." value={formExport.notas_en} onChange={e => setFormExport(f => ({ ...f, notas_en: e.target.value }))} />
                  </div>
                </div>
              )}

              {tabModal === 'precios' && (
                <div className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400">Ingresá el precio por lista. Si está vacío, se usa el precio de venta general.</p>
                  <div className="space-y-2">
                    {listas.map(lista => (
                      <div key={lista.id} className="flex items-center gap-3">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300 w-52 shrink-0">{lista.nombre}</span>
                        <input
                          type="number" min="0" step="1" inputMode="numeric" placeholder={form.precio_venta || '0'}
                          className="input max-w-[180px]"
                          value={preciosPorLista[lista.id] || ''}
                          onChange={e => setPreciosPorLista(prev => ({ ...prev, [lista.id]: toIntegerInput(e.target.value) }))}
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
