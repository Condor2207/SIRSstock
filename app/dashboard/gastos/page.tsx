'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, Receipt, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Gasto, Proveedor } from '@/lib/types';

const CATEGORIAS = ['Servicios', 'Combustible', 'Reparaciones', 'Insumos de oficina', 'Alquiler', 'Transporte', 'Marketing', 'Personal', 'Impuestos', 'Otros'];
const MEDIOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'];

export default function GastosPage() {
  const supabase = createClient();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [form, setForm] = useState({
    titulo: '', descripcion: '', proveedor_id: '', monto: '',
    fecha: new Date().toISOString().split('T')[0],
    medio_pago: 'efectivo', categoria: '', referencia: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('gastos').select('*, proveedores(nombre)').order('fecha', { ascending: false }).limit(100);
    setGastos(data as Gasto[] || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
  }, [load]);

  function resetForm() {
    setForm({ titulo: '', descripcion: '', proveedor_id: '', monto: '', fecha: new Date().toISOString().split('T')[0], medio_pago: 'efectivo', categoria: '', referencia: '' });
  }

  async function handleSave() {
    if (!form.titulo || !form.monto) { toast.error('Título y monto son obligatorios'); return; }
    const monto = parseFloat(form.monto);
    if (isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('gastos').insert({
        titulo: form.titulo, descripcion: form.descripcion || null,
        proveedor_id: form.proveedor_id || null, monto,
        fecha: form.fecha, medio_pago: form.medio_pago,
        categoria: form.categoria || null, referencia: form.referencia || null,
      });
      if (error) throw error;
      toast.success('Gasto registrado');
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filtered = gastos.filter(g =>
    g.titulo.toLowerCase().includes(search.toLowerCase()) ||
    (g.categoria || '').toLowerCase().includes(search.toLowerCase())
  );

  const totalFiltrado = filtered.reduce((s, g) => s + g.monto, 0);

  return (
    <>
      <Header title="Gastos" subtitle="Registro de gastos y egresos operativos" />
      <div className="p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Buscar por título o categoría..." value={search} onChange={e => setSearch(e.target.value)} />
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
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Título</th>
                    <th className="table-header">Categoría</th>
                    <th className="table-header">Proveedor</th>
                    <th className="table-header">Medio pago</th>
                    <th className="table-header">Monto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell text-xs">{formatDate(g.fecha)}</td>
                      <td className="table-cell font-medium">
                        <div>{g.titulo}</div>
                        {g.descripcion && <div className="text-xs text-gray-400">{g.descripcion}</div>}
                      </td>
                      <td className="table-cell">
                        {g.categoria ? (
                          <span className="badge bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">{g.categoria}</span>
                        ) : '-'}
                      </td>
                      <td className="table-cell text-sm">{(g as any).proveedores?.nombre || '-'}</td>
                      <td className="table-cell capitalize">{g.medio_pago}</td>
                      <td className="table-cell font-bold text-red-500">{formatCurrency(g.monto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Total:</td>
                    <td className="px-4 py-3 font-bold text-red-500 text-base">{formatCurrency(totalFiltrado)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Nuevo Gasto</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Título *</label>
                <input className="input" value={form.titulo} onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))} placeholder="Ej: Pago servicio eléctrico" />
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
                <div>
                  <label className="label">Categoría</label>
                  <select className="input" value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>
                    <option value="">Sin categoría</option>
                    {CATEGORIAS.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Medio de pago</label>
                  <select className="input" value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value }))}>
                    {MEDIOS_PAGO.map(m => <option key={m} className="capitalize">{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="label">Proveedor (opcional)</label>
                <select className="input" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                  <option value="">Sin proveedor</option>
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
                Registrar gasto
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
