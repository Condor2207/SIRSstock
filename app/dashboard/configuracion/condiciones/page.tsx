'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { Plus, Edit2, X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { CondicionVenta } from '@/lib/types';

export default function CondicionesPage() {
  const supabase = createClient();
  const [items, setItems] = useState<CondicionVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<CondicionVenta | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', plazo_dias: 0, cantidad_cuotas: 1, activo: true });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('condiciones_venta').select('*').order('plazo_dias');
    setItems(data as CondicionVenta[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditando(null); setForm({ nombre: '', plazo_dias: 0, cantidad_cuotas: 1, activo: true }); setShowModal(true); }
  function openEdit(c: CondicionVenta) { setEditando(c); setForm({ nombre: c.nombre, plazo_dias: c.plazo_dias, cantidad_cuotas: c.cantidad_cuotas, activo: c.activo }); setShowModal(true); }

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = { nombre: form.nombre.trim(), plazo_dias: Number(form.plazo_dias), cantidad_cuotas: Number(form.cantidad_cuotas), activo: form.activo };
    const { error } = editando
      ? await supabase.from('condiciones_venta').update(payload).eq('id', editando.id)
      : await supabase.from('condiciones_venta').insert(payload);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editando ? 'Actualizado' : 'Creado');
    setShowModal(false);
    load();
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Condiciones de Venta" />
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} condiciones registradas</p>
          <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus className="w-4 h-4" />Nueva</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div> : (
            <table className="w-full text-sm">
              <thead><tr><th className="table-header">Nombre</th><th className="table-header">Plazo (días)</th><th className="table-header">N° Cuotas</th><th className="table-header">Estado</th><th className="table-header text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(c => (
                  <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{c.nombre}</td>
                    <td className="table-cell">{c.plazo_dias === 0 ? <span className="text-emerald-600 font-medium">Contado</span> : `${c.plazo_dias} días`}</td>
                    <td className="table-cell">{c.cantidad_cuotas}</td>
                    <td className="table-cell">
                      {c.activo ? <span className="badge bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">Activo</span> : <span className="badge bg-gray-100 text-gray-500">Inactivo</span>}
                    </td>
                    <td className="table-cell text-right"><button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(c)}><Edit2 className="w-4 h-4" /></button></td>
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
              <h3 className="font-semibold text-gray-900 dark:text-white">{editando ? 'Editar' : 'Nueva'} Condición</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre *</label><input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} placeholder="30 días" /></div>
              <div><label className="label">Plazo en días (0 = contado)</label><input className="input" type="number" min="0" value={form.plazo_dias} onChange={e => setForm(p => ({ ...p, plazo_dias: parseInt(e.target.value) || 0 }))} /></div>
              <div><label className="label">Cantidad de cuotas</label><input className="input" type="number" min="1" value={form.cantidad_cuotas} onChange={e => setForm(p => ({ ...p, cantidad_cuotas: parseInt(e.target.value) || 1 }))} /></div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="activo_c" checked={form.activo} onChange={e => setForm(p => ({ ...p, activo: e.target.checked }))} />
                <label htmlFor="activo_c" className="text-sm text-gray-700 dark:text-gray-300">Activo</label>
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
