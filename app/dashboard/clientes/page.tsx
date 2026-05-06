'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, porcentajeCredito } from '@/lib/utils';
import { Plus, Search, Edit2, Users, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Cliente } from '@/lib/types';

const TIPOS_DOC = ['DNI', 'CUIT', 'RUC', 'OTRO'];

export default function ClientesPage() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', documento: '', tipo_documento: 'CUIT',
    direccion: '', telefono: '', email: '',
    limite_credito: '', activo: true,
  });

  const loadClientes = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('clientes').select('*').order('nombre');
    setClientes(data as Cliente[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadClientes(); }, [loadClientes]);

  function openNew() {
    setEditando(null);
    setForm({ nombre: '', documento: '', tipo_documento: 'CUIT', direccion: '', telefono: '', email: '', limite_credito: '', activo: true });
    setShowModal(true);
  }

  function openEdit(c: Cliente) {
    setEditando(c);
    setForm({
      nombre: c.nombre, documento: c.documento || '', tipo_documento: c.tipo_documento,
      direccion: c.direccion || '', telefono: c.telefono || '', email: c.email || '',
      limite_credito: String(c.limite_credito), activo: c.activo,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.nombre) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    const payload = {
      nombre: form.nombre, documento: form.documento || null,
      tipo_documento: form.tipo_documento, direccion: form.direccion || null,
      telefono: form.telefono || null, email: form.email || null,
      limite_credito: parseFloat(form.limite_credito) || 0, activo: form.activo,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('clientes').update(payload).eq('id', editando.id);
        if (error) throw error;
        toast.success('Cliente actualizado');
      } else {
        const { error } = await supabase.from('clientes').insert({ ...payload, saldo_pendiente: 0 });
        if (error) throw error;
        toast.success('Cliente creado');
      }
      setShowModal(false);
      loadClientes();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filtered = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.documento || '').includes(search)
  );

  return (
    <>
      <Header title="Clientes" subtitle="Gestión de clientes y límites de crédito" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar por nombre o documento..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo cliente
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>No se encontraron clientes</p>
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
                    <th className="table-header">Límite Crédito</th>
                    <th className="table-header">Saldo Pendiente</th>
                    <th className="table-header">Crédito Disp.</th>
                    <th className="table-header">Estado</th>
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => {
                    const disponible = c.limite_credito - c.saldo_pendiente;
                    const pct = porcentajeCredito(c.saldo_pendiente, c.limite_credito);
                    return (
                      <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                        <td className="table-cell font-semibold">{c.nombre}</td>
                        <td className="table-cell text-xs">
                          <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700">{c.tipo_documento}</span>
                          <span className="ml-1">{c.documento || '-'}</span>
                        </td>
                        <td className="table-cell">{c.telefono || '-'}</td>
                        <td className="table-cell text-xs">{c.email || '-'}</td>
                        <td className="table-cell font-semibold">{formatCurrency(c.limite_credito)}</td>
                        <td className="table-cell">
                          <span className={c.saldo_pendiente > 0 ? 'text-red-500 font-semibold' : 'text-emerald-500'}>
                            {formatCurrency(c.saldo_pendiente)}
                          </span>
                        </td>
                        <td className="table-cell">
                          <div>
                            <span className={`font-semibold ${disponible <= 0 ? 'text-red-500' : 'text-emerald-600'}`}>
                              {formatCurrency(disponible)}
                            </span>
                            {c.limite_credito > 0 && (
                              <div className="w-24 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                                  style={{ width: `${pct}%` }}
                                />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${c.activo ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : 'bg-gray-100 text-gray-500'}`}>
                            {c.activo ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>
                        <td className="table-cell">
                          <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600" title="Editar">
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre o razón social" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo documento</label>
                  <select className="input" value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))}>
                    {TIPOS_DOC.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Número</label>
                  <input className="input" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} placeholder="30-12345678-9" />
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
                <label className="label">Límite de crédito ($)</label>
                <input type="number" min="0" step="100" className="input" value={form.limite_credito} onChange={e => setForm(f => ({ ...f, limite_credito: e.target.value }))} />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.activo} onChange={e => setForm(f => ({ ...f, activo: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cliente activo</span>
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
