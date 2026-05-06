'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { Plus, Search, Edit2, Truck, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Proveedor } from '@/lib/types';

export default function ProveedoresPage() {
  const supabase = createClient();
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Proveedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', documento: '', tipo_documento: 'CUIT',
    direccion: '', telefono: '', email: '', condicion_pago: '', activo: true,
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('proveedores').select('*').order('nombre');
    setProveedores(data as Proveedor[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() {
    setEditando(null);
    setForm({ nombre: '', documento: '', tipo_documento: 'CUIT', direccion: '', telefono: '', email: '', condicion_pago: '', activo: true });
    setShowModal(true);
  }

  function openEdit(p: Proveedor) {
    setEditando(p);
    setForm({
      nombre: p.nombre, documento: p.documento || '', tipo_documento: p.tipo_documento || 'CUIT',
      direccion: p.direccion || '', telefono: p.telefono || '', email: p.email || '',
      condicion_pago: p.condicion_pago || '', activo: p.activo,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = {
      nombre: form.nombre, documento: form.documento || null, tipo_documento: form.tipo_documento,
      direccion: form.direccion || null, telefono: form.telefono || null, email: form.email || null,
      condicion_pago: form.condicion_pago || null, activo: form.activo,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('proveedores').update(payload).eq('id', editando.id);
        if (error) throw error;
        toast.success('Proveedor actualizado');
      } else {
        const { error } = await supabase.from('proveedores').insert(payload);
        if (error) throw error;
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

  const filtered = proveedores.filter(p =>
    p.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (p.documento || '').includes(search)
  );

  return (
    <>
      <Header title="Proveedores" subtitle="Gestión de proveedores y condiciones de pago" />
      <div className="p-6 space-y-4">
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
                    <th className="table-header">Nombre</th>
                    <th className="table-header">Documento</th>
                    <th className="table-header">Teléfono</th>
                    <th className="table-header">Email</th>
                    <th className="table-header">Condición pago</th>
                    <th className="table-header">Estado</th>
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
                        <span className={`badge ${p.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                          {p.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => openEdit(p)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600">
                          <Edit2 className="w-3.5 h-3.5" />
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
                  <label className="label">Número doc.</label>
                  <input className="input" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Dirección</label>
                <input className="input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Teléfono</label>
                  <input className="input" value={form.telefono} onChange={e => setForm(f => ({ ...f, telefono: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Email</label>
                  <input type="email" className="input" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Condición de pago</label>
                <input className="input" value={form.condicion_pago} onChange={e => setForm(f => ({ ...f, condicion_pago: e.target.value }))} placeholder="Ej: 30 días, Contado, 15 días" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm">Proveedor activo</span>
              </label>
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
