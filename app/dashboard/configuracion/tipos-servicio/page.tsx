'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Loader2, Check, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';

interface TipoServicio { id: string; nombre: string; activo: boolean; }

export default function TiposServicioPage() {
  const supabase = createClient();
  const [items, setItems] = useState<TipoServicio[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<TipoServicio | null>(null);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('gasto_tipos_servicio').select('*').order('nombre');
    if (error) toast.error('No se pudo cargar. ¿Ejecutaste la migración 022?');
    setItems(error ? [] : (data as TipoServicio[] || []));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditando(null); setNombre(''); setShowModal(true); }
  function openEdit(t: TipoServicio) { setEditando(t); setNombre(t.nombre); setShowModal(true); }

  async function handleSave() {
    const limpio = nombre.trim().replace(/\s+/g, ' ');
    if (!limpio) { toast.error('El nombre es obligatorio'); return; }
    if (items.some(i => i.id !== editando?.id && i.nombre.toLowerCase() === limpio.toLowerCase())) {
      toast.error('Ya existe un tipo de servicio con ese nombre'); return;
    }
    setSaving(true);
    const { data, error } = editando
      ? await supabase.from('gasto_tipos_servicio').update({ nombre: limpio }).eq('id', editando.id).select('id').single()
      : await supabase.from('gasto_tipos_servicio').insert({ nombre: limpio }).select('id').single();
    setSaving(false);
    if (error) { toast.error(getErrorMessage(error)); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Tipo de servicio', accion: editando ? 'editar' : 'crear', descripcion: `${editando ? 'Editó' : 'Creó'} el tipo de servicio ${limpio}`, registroId: data?.id || editando?.id || null });
    toast.success(editando ? 'Actualizado' : 'Creado');
    setShowModal(false);
    load();
  }

  async function handleToggleActivo(item: TipoServicio) {
    const nuevo = !item.activo;
    if (!window.confirm(`¿${nuevo ? 'Restaurar' : 'Inactivar'} el tipo de servicio "${item.nombre}"?`)) return;
    const { error } = await supabase.from('gasto_tipos_servicio').update({ activo: nuevo }).eq('id', item.id);
    if (error) { toast.error(getErrorMessage(error)); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Tipo de servicio', accion: 'editar', descripcion: `${nuevo ? 'Restauró' : 'Inactivó'} el tipo de servicio ${item.nombre}`, registroId: item.id });
    load();
  }

  async function handleDelete(item: TipoServicio) {
    if (!window.confirm(`¿Eliminar el tipo de servicio "${item.nombre}"? Los gastos ya registrados conservan su valor.`)) return;
    const { error } = await supabase.from('gasto_tipos_servicio').delete().eq('id', item.id);
    if (error) { toast.error(getDeleteErrorMessage(error, 'el tipo de servicio')); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Tipo de servicio', accion: 'borrar', descripcion: `Eliminó el tipo de servicio ${item.nombre}`, registroId: item.id });
    toast.success('Eliminado');
    load();
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Tipos de servicio (gastos)" />
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} tipos de servicio</p>
          <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus className="w-4 h-4" />Nuevo tipo</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div> : (
            <table className="w-full text-sm">
              <thead><tr><th className="table-header">Tipo de servicio</th><th className="table-header text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(t => (
                  <tr key={t.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!t.activo ? 'opacity-60' : ''}`}>
                    <td className="table-cell font-medium">{t.nombre} {!t.activo && <span className="badge ml-2">Inactivo</span>}</td>
                    <td className="table-cell text-right">
                      <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(t)}><Edit2 className="w-4 h-4" /></button>
                      <button className={`${t.activo ? 'text-amber-500 hover:text-amber-700' : 'text-emerald-600 hover:text-emerald-700'} p-1`} onClick={() => handleToggleActivo(t)} title={t.activo ? 'Inactivar' : 'Restaurar'}>{t.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}</button>
                      <button className="text-red-500 hover:text-red-700 p-1" onClick={() => handleDelete(t)} title="Eliminar"><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="font-semibold text-gray-900 dark:text-white">{editando ? 'Editar tipo de servicio' : 'Nuevo tipo de servicio'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div><label className="label">Nombre *</label><input className="input" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Flete, Combustible, Internet..." /></div>
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
