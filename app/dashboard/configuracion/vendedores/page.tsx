'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { getErrorMessage, isSchemaCacheMissing, toInteger, toIntegerInput } from '@/lib/utils';
import { Plus, Edit2, Trash2, X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Vendedor } from '@/lib/types';

export default function VendedoresPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Vendedor[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Vendedor | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', telefono: '', email: '', porcentaje_venta: '0' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('vendedores').select('*').order('nombre');
    setItems(data as Vendedor[] || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  function openNew() { setEditando(null); setForm({ nombre: '', telefono: '', email: '', porcentaje_venta: '0' }); setShowModal(true); }
  function openEdit(v: Vendedor) { setEditando(v); setForm({ nombre: v.nombre, telefono: v.telefono || '', email: v.email || '', porcentaje_venta: String(toInteger(v.porcentaje_venta ?? 0, 0)) }); setShowModal(true); }

  async function handleSave() {
    const nombre = form.nombre.trim();
    const telefono = form.telefono.trim();
    const email = form.email.trim();

    if (!nombre) { toast.error('El nombre es obligatorio'); return; }
    if (!telefono && !email) { toast.error('Debés cargar teléfono o email'); return; }

    setSaving(true);
    const porcentaje_venta = Math.min(100, Math.max(0, toInteger(form.porcentaje_venta, 0)));
    const payload = {
      nombre,
      telefono: telefono || null,
      email: email || null,
      porcentaje_venta,
    };
    const payloadBase = { nombre, telefono: telefono || null, email: email || null };
    let data: { id: string } | null = null;
    let error: any = null;
    if (editando) {
      const res = await supabase.from('vendedores').update(payload).eq('id', editando.id).select('id').single();
      data = res.data; error = res.error;
      if (error && isSchemaCacheMissing(error, ['porcentaje_venta'])) {
        const fb = await supabase.from('vendedores').update(payloadBase).eq('id', editando.id).select('id').single();
        data = fb.data; error = fb.error;
      }
    } else {
      const res = await supabase.from('vendedores').insert(payload).select('id').single();
      data = res.data; error = res.error;
      if (error && isSchemaCacheMissing(error, ['porcentaje_venta'])) {
        const fb = await supabase.from('vendedores').insert(payloadBase).select('id').single();
        data = fb.data; error = fb.error;
      }
    }
    setSaving(false);
    if (error) { toast.error(getErrorMessage(error)); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Vendedor', accion: editando ? 'editar' : 'crear', descripcion: `${editando ? 'Editó' : 'Creó'} el vendedor ${payload.nombre}`, registroId: data?.id || editando?.id || null });
    toast.success(editando ? 'Actualizado' : 'Creado');
    setShowModal(false);
    load();
  }

  async function handleDelete(item: Vendedor) {
    if (!window.confirm(`¿Eliminar el vendedor "${item.nombre}"?`)) return;
    const { error } = await supabase.from('vendedores').delete().eq('id', item.id);
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Vendedor', accion: 'borrar', descripcion: `Eliminó el vendedor ${item.nombre}`, registroId: item.id });
    toast.success('Vendedor eliminado');
    load();
  }

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Vendedores" />
      <div className="p-4 md:p-6">
        <div className="flex flex-wrap justify-between items-center mb-4 gap-2">
          <p className="text-sm text-gray-500 dark:text-gray-400">{items.length} vendedores registrados</p>
          <button className="btn-primary flex items-center gap-2" onClick={openNew}><Plus className="w-4 h-4" />Nuevo Vendedor</button>
        </div>
        <div className="card overflow-x-auto">
          {loading ? <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div> : (
            <table className="w-full text-sm">
              <thead><tr><th className="table-header">Nombre</th><th className="table-header">Teléfono</th><th className="table-header">Email</th><th className="table-header">% Venta</th><th className="table-header text-right">Acciones</th></tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                    <td className="table-cell font-medium">{v.nombre}</td>
                    <td className="table-cell text-gray-500">{v.telefono || '—'}</td>
                    <td className="table-cell text-gray-500">{v.email || '—'}</td>
                    <td className="table-cell"><span className="font-semibold text-cyan-600">{v.porcentaje_venta ?? 0}%</span></td>
                    <td className="table-cell text-right">
                      <button className="text-blue-500 hover:text-blue-700 p-1" onClick={() => openEdit(v)}><Edit2 className="w-4 h-4" /></button>
                      <button className="text-red-500 hover:text-red-700 p-1" onClick={() => handleDelete(v)}><Trash2 className="w-4 h-4" /></button>
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
              <h3 className="font-semibold text-gray-900 dark:text-white">{editando ? 'Editar Vendedor' : 'Nuevo Vendedor'}</h3>
              <button onClick={() => setShowModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="space-y-4">
              <div><label className="label">Nombre completo *</label><input className="input" value={form.nombre} onChange={e => setForm(p => ({ ...p, nombre: e.target.value }))} /></div>
              <div><label className="label">Teléfono * (o Email)</label><input className="input" value={form.telefono} onChange={e => setForm(p => ({ ...p, telefono: e.target.value }))} /></div>
              <div><label className="label">Email * (o Teléfono)</label><input className="input" type="email" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="label">Porcentaje de venta (%)</label><input className="input" type="number" min="0" max="100" step="1" inputMode="numeric" value={form.porcentaje_venta} onChange={e => setForm(p => ({ ...p, porcentaje_venta: toIntegerInput(e.target.value) }))} /></div>
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
