'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Plus, Edit2, Trash2, X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { ListaPrecios } from '@/lib/types';

export default function ListasPreciosPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ListaPrecios[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<ListaPrecios | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', moneda: 'PYG' as 'PYG' | 'USD', aplica_iva: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('listas_precios').select('*').order('nombre');
    setItems(data as ListaPrecios[] || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditando(null); setForm({ nombre: '', moneda: 'PYG', aplica_iva: true }); setShowModal(true); }
  function openEdit(l: ListaPrecios) { setEditando(l); setForm({ nombre: l.nombre, moneda: l.moneda, aplica_iva: l.aplica_iva }); setShowModal(true); }

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: form.nombre.trim().toUpperCase(), moneda: form.moneda, aplica_iva: form.aplica_iva };
    const { data, error } = editando
      ? await supabase.from('listas_precios').update(payload).eq('id', editando.id).select('id').single()
      : await supabase.from('listas_precios').insert(payload).select('id').single();
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Lista de precios', accion: editando ? 'editar' : 'crear', descripcion: `${editando ? 'Editó' : 'Creó'} la lista ${payload.nombre}`, registroId: data?.id || editando?.id || null });
    toast.success(editando ? 'Actualizado' : 'Creado');
    setShowModal(false);
    load();
  }

  async function handleDelete(item: ListaPrecios) {
    if (!window.confirm(`¿Eliminar la lista "${item.nombre}"?`)) return;
    const { error } = await supabase.from('listas_precios').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Lista de precios', accion: 'borrar', descripcion: `Eliminó la lista ${item.nombre}`, registroId: item.id });
    toast.success('Lista eliminada');
    load();
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Listas de Precios" />
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} listas registradas</p>
          <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus className="w-4 h-4" />Nueva Lista</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr><th className="table-header">Nombre</th><th className="table-header">Moneda</th><th className="table-header text-center">IVA Incluido</th><th className="table-header text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(l => (
                  <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{l.nombre}</td>
                    <td className="table-cell"><span className="badge">{l.moneda}</span></td>
                    <td className="table-cell text-center">{l.aplica_iva ? '✅' : '—'}</td>
                    <td className="table-cell text-right">
                      <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(l)}><Edit2 className="w-4 h-4" /></button>
                      <button className="text-red-500 hover:text-red-700 p-1" onClick={() => handleDelete(l)}><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="font-semibold text-gray-900 dark:text-white">{editando ? 'Editar Lista' : 'Nueva Lista de Precios'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre *</label><input className="input uppercase" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value.toUpperCase() }))} placeholder="CONSUMO" /></div>
              <div>
                <label className="label">Moneda</label>
                <select className="input" value={form.moneda} onChange={e => setForm(p => ({ ...p, moneda: e.target.value as 'PYG' | 'USD' }))}>
                  <option value="PYG">PYG - Guaraní</option>
                  <option value="USD">USD - Dólar</option>
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="aplica_iva" checked={form.aplica_iva} onChange={e => setForm(p => ({ ...p, aplica_iva: e.target.checked }))} />
                <label htmlFor="aplica_iva" className="text-sm text-gray-700 dark:text-gray-300">IVA incluido en precio</label>
              </div>
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
