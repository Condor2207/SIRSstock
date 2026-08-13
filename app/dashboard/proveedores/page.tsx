'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Plus, Search, Edit2, Trash2, Truck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Proveedor, CondicionVenta } from '@/lib/types';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';

export default function ProveedoresPage() {
  const supabase = createClient();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', documento: '', tipo_documento: 'RUC',
    direccion: '', telefono: '', email: '', condicion_pago: '',
    condicion_venta_id: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const [provRes, condRes] = await Promise.all([
      supabase.from('proveedores').select('*').order('nombre'),
      supabase.from('condiciones_venta').select('*').eq('activo', true).order('nombre'),
    ]);
    setProveedores(provRes.data as Proveedor[] || []);
    setCondiciones(condRes.data as CondicionVenta[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditando(null);
    setForm({ nombre: '', documento: '', tipo_documento: 'RUC', direccion: '', telefono: '', email: '', condicion_pago: '', condicion_venta_id: '' });
    setShowModal(true);
  }

  function openEdit(p: Proveedor) {
    setEditando(p);
    setForm({
      nombre: p.nombre, documento: p.documento || '', tipo_documento: p.tipo_documento || 'RUC',
      direccion: p.direccion || '', telefono: p.telefono || '', email: p.email || '',
      condicion_pago: p.condicion_pago || '',
      condicion_venta_id: (p as any).condicion_venta_id || '',
    });
    setShowModal(true);
  }

  function validateRUC(ruc: string): boolean {
    if (!ruc) return true;
    return /^\d{3,8}-\d$/.test(ruc.trim());
  }

  async function handleSave() {
    const nombre = form.nombre.trim();
    const documento = form.documento.trim();
    const telefono = form.telefono.trim();
    const email = form.email.trim();

    if (!nombre) { toast.error('El nombre es obligatorio'); return; }
    if (!documento) { toast.error('El RUC/documento es obligatorio'); return; }
    if (form.tipo_documento === 'RUC' && !validateRUC(documento)) {
      toast.error('Formato RUC inválido. Ej: 80046906-2'); return;
    }
    if (!telefono && !email) { toast.error('Debés cargar teléfono o email'); return; }

    setSaving(true);
    const payload = {
      nombre, documento, tipo_documento: form.tipo_documento,
      direccion: form.direccion.trim() || null, telefono: telefono || null, email: email || null,
      condicion_pago: form.condicion_pago.trim() || null,
      condicion_venta_id: form.condicion_venta_id || null,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('proveedores').update(payload).eq('id', editando.id);
        if (error) throw error;
        await logAudit(supabase, { modulo: 'Proveedores', entidad: 'Proveedor', accion: 'editar', descripcion: `Editó el proveedor ${nombre}`, registroId: editando.id });
        toast.success('Proveedor actualizado');
      } else {
        const { data, error } = await supabase.from('proveedores').insert(payload).select('id').single();
        if (error) throw error;
        await logAudit(supabase, { modulo: 'Proveedores', entidad: 'Proveedor', accion: 'crear', descripcion: `Creó el proveedor ${nombre}`, registroId: data?.id || null });
        toast.success('Proveedor creado');
      }
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(proveedor: Proveedor) {
    if (!window.confirm(`¿Eliminar el proveedor "${proveedor.nombre}"?`)) return;
    const { error } = await supabase.from('proveedores').delete().eq('id', proveedor.id);
    if (error) { toast.error(error.message || 'Error al eliminar'); return; }
    await logAudit(supabase, { modulo: 'Proveedores', entidad: 'Proveedor', accion: 'borrar', descripcion: `Eliminó el proveedor ${proveedor.nombre}`, registroId: proveedor.id });
    toast.success('Proveedor eliminado');
    load();
  }

  const filteredRaw = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.documento || '').includes(search)
  );
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  return (
    <>
      <Header title="Proveedores" subtitle="Gestión de proveedores y condiciones de pago" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo proveedor
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Truck className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No se encontraron proveedores</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <SortableTh label="Nombre" sortKey="nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Documento" sortKey="documento" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Teléfono" sortKey="telefono" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Email" sortKey="email" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Condición pago" sortKey="condicion_pago" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-semibold">{p.nombre}</td>
                      <td className="table-cell text-xs">
                        {p.tipo_documento && <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700 mr-1">{p.tipo_documento}</span>}
                        {p.documento || '-'}
                      </td>
                      <td className="table-cell">{p.telefono || '-'}</td>
                      <td className="table-cell text-xs">{p.email || '-'}</td>
                      <td className="table-cell">{p.condicion_pago || '-'}</td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar proveedor' : 'Nuevo proveedor'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre / Razón social *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo</label>
                  <select className="input" value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))}>
                    {['CUIT', 'RUC', 'DNI', 'OTRO'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Número doc. *</label>
                  <input className="input" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono * (o Email)</label>
                  <input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email * (o Teléfono)</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Condición de pago</label>
                  <select className="input" value={form.condicion_venta_id} onChange={e => setForm(f => ({ ...f, condicion_venta_id: e.target.value }))}>
                    <option value="">Sin asignar</option>
                    {condiciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Nota condición libre</label>
                  <input className="input" value={form.condicion_pago} onChange={e => setForm(f => ({ ...f, condicion_pago: e.target.value }))} placeholder="Observaciones" />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
