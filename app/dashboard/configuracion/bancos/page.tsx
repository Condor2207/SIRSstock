'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { getDeleteErrorMessage } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Loader2, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Banco } from '@/lib/types';

export default function BancosPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Banco | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('bancos').select('*').order('nombre');
    setItems(data as Banco[] || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditando(null); setForm({ nombre: '' }); setShowModal(true); }
  function openEdit(b: Banco) { setEditando(b); setForm({ nombre: b.nombre }); setShowModal(true); }

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: form.nombre.trim() };
    const { data, error } = editando
      ? await supabase.from('bancos').update(payload).eq('id', editando.id).select('id').single()
      : await supabase.from('bancos').insert(payload).select('id').single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Banco', accion: editando ? 'editar' : 'crear', descripcion: `${editando ? 'Editó' : 'Creó'} el banco ${payload.nombre}`, registroId: data?.id || editando?.id || null });
    toast.success(editando ? 'Actualizado' : 'Creado');
    setShowModal(false);
    load();
  }

  async function handleToggleActivo(item: Banco) {
    const nuevoEstado = !item.activo;
    if (!window.confirm(`¿${nuevoEstado ? 'Restaurar' : 'Inactivar'} el banco "${item.nombre}"?`)) return;
    const { error } = await supabase.from('bancos').update({ activo: nuevoEstado }).eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Banco', accion: 'editar', descripcion: `${nuevoEstado ? 'Restauró' : 'Inactivó'} el banco ${item.nombre}`, registroId: item.id });
    toast.success(nuevoEstado ? 'Banco restaurado' : 'Banco inactivado');
    load();
  }

  async function handleDelete(item: Banco) {
    if (!window.confirm(`¿Eliminar el banco "${item.nombre}"? Esta acción no se puede deshacer.`)) return;
    const { error } = await supabase.from('bancos').delete().eq('id', item.id);
    if (error) { toast.error(getDeleteErrorMessage(error, 'el banco')); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Banco', accion: 'borrar', descripcion: `Eliminó el banco ${item.nombre}`, registroId: item.id });
    toast.success('Banco eliminado');
    load();
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Bancos" />
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} bancos registrados</p>
          <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus className="w-4 h-4" />Nuevo Banco</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div> : (
            <table className="w-full text-sm">
              <thead><tr><th className="table-header">Banco</th><th className="table-header text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(b => (
                  <tr key={b.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!b.activo ? 'opacity-60' : ''}`}>
                    <td className="table-cell font-medium">{b.nombre} {!b.activo && <span className="badge ml-2">Inactivo</span>}</td>
                    <td className="table-cell text-right">
                      <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(b)}><Edit2 className="w-4 h-4" /></button>
                      <button className={`${b.activo ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'} p-1`} onClick={() => handleToggleActivo(b)} title={b.activo ? 'Inactivar banco' : 'Restaurar banco'}>{b.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                      <button className="text-red-500 hover:text-red-700 p-1" onClick={() => handleDelete(b)} title="Eliminar banco"><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-gray-900 dark:text-white">{editando ? 'Editar Banco' : 'Nuevo Banco'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre del banco *</label><input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="Banco Familiar" /></div>
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setShowModal(false)}>Cancelar</button>
              <button className="btn-primary flex-1 flex items-center justify-center gap-2" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
