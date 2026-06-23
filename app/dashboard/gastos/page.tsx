'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate, estadoBadgeClass, getErrorMessage, isSchemaCacheMissing } from '@/lib/utils';
import { Plus, Search, Receipt, X, Loader2, Edit2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Gasto, Proveedor, TasaIva } from '@/lib/types';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';

const CATEGORIAS_BASE = ['Servicios', 'Combustible', 'Reparaciones', 'Insumos de oficina', 'Alquiler', 'Transporte', 'Marketing', 'Personal', 'Impuestos', 'Otros'];
const MEDIOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'];
const CREAR_CATEGORIA = '__INTERNAL_CREATE_CATEGORY__';

interface Banco { id: string; nombre: string; }

export default function GastosPage() {
  const supabase = createClient();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_BASE);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [schemaCompatMode, setSchemaCompatMode] = useState(false);
  const compatToastShown = useRef(false);
  const [form, setForm] = useState({
    descripcion: '', proveedor_id: '', monto: '',
    fecha: new Date().toISOString().split('T')[0],
    medio_pago: 'efectivo', categoria: '', referencia: '',
    condicion: 'debito' as 'debito' | 'credito', fecha_vencimiento: '',
    numero_transaccion: '', banco_id: '', numero_cheque: '', fecha_cheque: '',
    tasa_iva_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const advancedSelect = 'id, titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia, created_by, created_at, condicion, fecha_vencimiento, numero_transaccion, banco_id, numero_cheque, fecha_cheque, tasa_iva_id, saldo_pendiente, estado, proveedores(nombre), tasa_iva_ref:tasas_iva(nombre, porcentaje)';
    const baseSelect = 'id, titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia, created_by, created_at, proveedores(nombre)';
    const advancedRes = await supabase
      .from('gastos')
      .select(advancedSelect)
      .order('fecha', { ascending: false })
      .limit(100);
    let data: any[] | null = advancedRes.data;
    let error: any = advancedRes.error;
    if (error && isSchemaCacheMissing(error, ['gastos', 'estado', 'saldo_pendiente', 'condicion', 'tasas_iva'])) {
      setSchemaCompatMode(true);
      const baseRes = await supabase
        .from('gastos')
        .select(baseSelect)
        .order('fecha', { ascending: false })
        .limit(100);
      data = baseRes.data;
      error = baseRes.error;
      if (!compatToastShown.current) {
        toast.error('La base de datos no tiene aún todas las columnas de gastos. Se ha activado un modo compatible.');
        compatToastShown.current = true;
      }
    } else {
      setSchemaCompatMode(false);
    }
    if (error) {
      toast.error(getErrorMessage(error) || 'Error al cargar gastos');
      setGastos([]);
      setCategorias(CATEGORIAS_BASE);
      setLoading(false);
      return;
    }
    const rows = (data as Gasto[] || []);
    setGastos(rows);
    const categoriasDb = rows.map(g => (g.categoria || g.titulo || '').trim()).filter(Boolean);
    const unicas = Array.from(new Set([...CATEGORIAS_BASE, ...categoriasDb])).sort((a, b) => a.localeCompare(b, 'es'));
    setCategorias(unicas);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
    supabase.from('bancos').select('id, nombre').eq('activo', true).order('nombre').then(r => setBancos(r.error ? [] : (r.data as Banco[] || [])));
    supabase.from('tasas_iva').select('id, nombre, porcentaje').eq('activo', true).order('porcentaje').then(r => setTasasIva(r.error ? [] : (r.data as TasaIva[] || [])));
  }, [load, supabase]);

  function resetForm() {
    setEditando(null);
    setCreandoCategoria(false);
    setNuevaCategoria('');
    setForm({
      descripcion: '', proveedor_id: '', monto: '',
      fecha: new Date().toISOString().split('T')[0],
      medio_pago: 'efectivo', categoria: '', referencia: '',
      condicion: 'debito', fecha_vencimiento: '',
      numero_transaccion: '', banco_id: '', numero_cheque: '', fecha_cheque: '',
      tasa_iva_id: '',
    });
  }

  function openEdit(g: Gasto) {
    setEditando(g);
    const categoria = g.categoria || g.titulo || '';
    setCreandoCategoria(false);
    setNuevaCategoria('');
    setForm({
      descripcion: g.descripcion || '',
      proveedor_id: g.proveedor_id || '',
      monto: String(g.monto || ''),
      fecha: g.fecha || new Date().toISOString().split('T')[0],
      medio_pago: g.medio_pago || 'efectivo',
      categoria,
      referencia: g.referencia || '',
      condicion: (g.condicion as 'debito' | 'credito') || 'debito',
      fecha_vencimiento: g.fecha_vencimiento || '',
      numero_transaccion: (g as any).numero_transaccion || '',
      banco_id: (g as any).banco_id || '',
      numero_cheque: (g as any).numero_cheque || '',
      fecha_cheque: (g as any).fecha_cheque || '',
      tasa_iva_id: g.tasa_iva_id || '',
    });
    setShowModal(true);
  }

  function agregarCategoria() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    if (categorias.includes(nombre)) {
      toast('La categoría ya existe, se seleccionó automáticamente');
    } else {
      setCategorias(prev => [...prev, nombre].sort((a, b) => a.localeCompare(b, 'es')));
    }
    setForm(f => ({ ...f, categoria: nombre }));
    setCreandoCategoria(false);
    setNuevaCategoria('');
  }

  async function handleSave() {
    if (!form.categoria || !form.monto) { toast.error('Categoría y monto son obligatorios'); return; }
    if (!form.proveedor_id) { toast.error('Por favor seleccione un proveedor'); return; }
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (schemaCompatMode && form.condicion === 'credito') {
      toast.error('No se pueden registrar gastos a crédito porque faltan columnas en la base de datos. Por favor ejecute las migraciones 009, 010 y 011.');
      return;
    }

    let saldoPendiente = 0;
    let estado: 'pendiente' | 'pagado' | 'parcial' = 'pagado';
    if (form.condicion === 'credito') {
      if (editando) {
        const saldoAnterior = editando.saldo_pendiente ?? editando.monto;
        const pagado = Math.max(0, (editando.monto || 0) - saldoAnterior);
        if (monto < pagado) { toast.error(`El monto (${formatCurrency(monto)}) no puede ser menor al importe ya pagado (${formatCurrency(pagado)})`); return; }
        saldoPendiente = Math.max(0, monto - pagado);
      } else {
        saldoPendiente = monto;
      }
      estado = saldoPendiente === 0 ? 'pagado' : saldoPendiente < monto ? 'parcial' : 'pendiente';
    }

    setSaving(true);
    try {
      const payload: Record<string, any> = {
        titulo: form.categoria,
        descripcion: form.descripcion || null,
        proveedor_id: form.proveedor_id,
        monto,
        fecha: form.fecha,
        medio_pago: form.medio_pago,
        categoria: form.categoria,
        referencia: form.referencia || null,
      };
      if (!schemaCompatMode) {
        Object.assign(payload, {
          condicion: form.condicion,
          fecha_vencimiento: form.condicion === 'credito' ? (form.fecha_vencimiento || null) : null,
          numero_transaccion: form.medio_pago === 'transferencia' ? (form.numero_transaccion || null) : null,
          banco_id: form.medio_pago === 'cheque' ? (form.banco_id || null) : null,
          numero_cheque: form.medio_pago === 'cheque' ? (form.numero_cheque || null) : null,
          fecha_cheque: form.medio_pago === 'cheque' ? (form.fecha_cheque || null) : null,
          tasa_iva_id: form.tasa_iva_id || null,
          saldo_pendiente: saldoPendiente,
          estado,
        });
      }
      const { error } = editando
        ? await supabase.from('gastos').update(payload).eq('id', editando.id)
        : await supabase.from('gastos').insert(payload);
      if (error) throw error;
      toast.success(editando ? 'Gasto actualizado' : 'Gasto registrado');
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(getErrorMessage(e) || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filteredRaw = gastos.filter(g =>
    (g.categoria || g.titulo || '').toLowerCase().includes(search.toLowerCase())
  ).map(g => ({ ...g, proveedor_nombre: (g as any).proveedores?.nombre || '' }));
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  const totalFiltrado = filtered.reduce((s, g) => s + g.monto, 0);

  return (
    <>
      <Header title="Gastos" subtitle="Registro de gastos y egresos operativos" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Buscar por categoría..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {filtered.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: <span className="font-bold text-red-500">{formatCurrency(totalFiltrado)}</span>
              </div>
            )}
            <button onClick={() => { resetForm(); setShowModal(true); }} className="btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nuevo gasto
            </button>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Receipt className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin gastos registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Categoría" sortKey="categoria" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Proveedor" sortKey="proveedor_nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    {!schemaCompatMode && <SortableTh label="IVA" sortKey="tasa_iva_id" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    {!schemaCompatMode && <SortableTh label="Condición" sortKey="condicion" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    {!schemaCompatMode && <SortableTh label="Estado" sortKey="estado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    <SortableTh label="Monto" sortKey="monto" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell text-xs">{formatDate(g.fecha)}</td>
                      <td className="table-cell font-medium">
                        <div>{g.categoria || g.titulo}</div>
                        {g.descripcion && <div className="text-xs text-gray-400">{g.descripcion}</div>}
                      </td>
                      <td className="table-cell text-sm">{(g as any).proveedores?.nombre || '-'}</td>
                      {!schemaCompatMode && <td className="table-cell text-sm">{(g as any).tasa_iva_ref ? `${(g as any).tasa_iva_ref.nombre} (${(g as any).tasa_iva_ref.porcentaje}%)` : '-'}</td>}
                      {!schemaCompatMode && <td className="table-cell capitalize">{g.condicion || 'debito'}</td>}
                      {!schemaCompatMode && (
                        <td className="table-cell">
                          <span className={`badge ${estadoBadgeClass(g.estado || 'pagado')}`}>{g.estado || 'pagado'}</span>
                        </td>
                      )}
                      <td className="table-cell font-bold text-red-500">{formatCurrency(g.monto)}</td>
                      <td className="table-cell text-right">
                        <button onClick={() => openEdit(g)} className="p-1 text-blue-500 hover:text-blue-700" title="Editar gasto">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={schemaCompatMode ? 3 : 6} className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Total:</td>
                    <td className="px-4 py-3 font-bold text-red-500 text-base">{formatCurrency(totalFiltrado)}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Categoría *</label>
                {!creandoCategoria ? (
                  <select
                    className="input"
                    value={form.categoria}
                    onChange={e => {
                      if (e.target.value === CREAR_CATEGORIA) {
                        setCreandoCategoria(true);
                        return;
                      }
                      setForm(f => ({ ...f, categoria: e.target.value }));
                    }}
                  >
                    <option value="">Seleccionar categoría</option>
                    <option value={CREAR_CATEGORIA}>+ Crear categoría</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input className="input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} placeholder="Nueva categoría" />
                    <button onClick={agregarCategoria} className="btn-secondary shrink-0">Agregar</button>
                    <button onClick={() => { setCreandoCategoria(false); setNuevaCategoria(''); }} className="btn-secondary shrink-0">Cancelar</button>
                  </div>
                )}
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Monto ($) *</label>
                  <input type="number" min="0.01" step="0.01" className="input" value={form.monto} onChange={e => setForm(f => ({ ...f, monto: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!schemaCompatMode && (
                  <div>
                    <label className="label">Condición</label>
                    <select className="input" value={form.condicion} onChange={e => setForm(f => ({ ...f, condicion: e.target.value as 'debito' | 'credito' }))}>
                      <option value="debito">Débito (pagado)</option>
                      <option value="credito">Crédito (a pagar)</option>
                    </select>
                  </div>
                )}
                {!schemaCompatMode && (
                  <div>
                    <label className="label">IVA</label>
                    <select className="input" value={form.tasa_iva_id} onChange={e => setForm(f => ({ ...f, tasa_iva_id: e.target.value }))}>
                      <option value="">Sin IVA</option>
                      {tasasIva.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.porcentaje}%)</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="label">Medio de pago</label>
                  <select className="input" value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value }))}>
                    {MEDIOS_PAGO.map(m => <option key={m} className="capitalize">{m}</option>)}
                  </select>
                </div>
                {!schemaCompatMode && form.medio_pago === 'transferencia' && (
                  <div>
                    <label className="label">N° Transacción</label>
                    <input className="input" placeholder="TRF-00001" value={form.numero_transaccion} onChange={e => setForm(f => ({ ...f, numero_transaccion: e.target.value }))} />
                  </div>
                )}
                {!schemaCompatMode && form.medio_pago === 'cheque' && (
                  <>
                    <div>
                      <label className="label">N° Cheque</label>
                      <input className="input" placeholder="CHE-00001" value={form.numero_cheque} onChange={e => setForm(f => ({ ...f, numero_cheque: e.target.value }))} />
                    </div>
                    <div>
                      <label className="label">Banco</label>
                      <select className="input" value={form.banco_id} onChange={e => setForm(f => ({ ...f, banco_id: e.target.value }))}>
                        <option value="">Seleccionar banco</option>
                        {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Fecha cobro cheque</label>
                      <input type="date" className="input" value={form.fecha_cheque} onChange={e => setForm(f => ({ ...f, fecha_cheque: e.target.value }))} />
                    </div>
                  </>
                )}
                {!schemaCompatMode && form.condicion === 'credito' && (
                  <div>
                    <label className="label">Fecha vencimiento</label>
                    <input type="date" className="input" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
                  </div>
                )}
              </div>
              <div>
                <label className="label">Proveedor *</label>
                <select className="input" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">Seleccionar proveedor</option>
                  {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Referencia / Comprobante</label>
                <input className="input" value={form.referencia} onChange={e => setForm(f => ({ ...f, referencia: e.target.value }))} placeholder="N° factura, recibo..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? 'Guardar cambios' : 'Registrar gasto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
