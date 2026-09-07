'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatCurrency, porcentajeCredito, toInteger, toIntegerInput } from '@/lib/utils';
import { Plus, Search, Edit2, Trash2, Users, X, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Cliente, ListaPrecios, Vendedor, CondicionVenta } from '@/lib/types';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';

export default function ClientesPage() {
  const supabase = createClient();
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [listas, setListas] = useState<ListaPrecios[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionVenta[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editando, setEditando] = useState<Cliente | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    nombre: '', documento: '', tipo_documento: 'RUC',
    direccion: '', telefono: '', email: '',
    limite_credito: '',
    lista_precios_id: '', vendedor_id: '',
    condicion_venta_id: '', es_exterior: false,
  });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [cliRes, listaRes, vendRes, condRes] = await Promise.all([
      supabase.from('clientes').select('*').order('nombre'),
      supabase.from('listas_precios').select('*').eq('activo', true).order('nombre'),
      supabase.from('vendedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('condiciones_venta').select('*').eq('activo', true).order('nombre'),
    ]);
    setClientes(cliRes.data as Cliente[] || []);
    setListas(listaRes.data as ListaPrecios[] || []);
    setVendedores(vendRes.data as Vendedor[] || []);
    setCondiciones(condRes.data as CondicionVenta[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  function openNew() {
    setEditando(null);
    setForm({ nombre: '', documento: '', tipo_documento: 'RUC', direccion: '', telefono: '', email: '', limite_credito: '', lista_precios_id: '', vendedor_id: '', condicion_venta_id: '', es_exterior: false });
    setShowModal(true);
  }

  function openEdit(c: Cliente) {
    setEditando(c);
    setForm({
      nombre: c.nombre, documento: c.documento || '', tipo_documento: c.tipo_documento,
      direccion: c.direccion || '', telefono: c.telefono || '', email: c.email || '',
      limite_credito: String(toInteger(c.limite_credito, 0)),
      lista_precios_id: (c as any).lista_precios_id || '',
      vendedor_id: (c as any).vendedor_id || '',
      condicion_venta_id: (c as any).condicion_venta_id || '',
      es_exterior: (c as any).es_exterior || false,
    });
    setShowModal(true);
  }

  function validateRUC(ruc: string): boolean {
    if (!ruc) return true; // opcional
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
      toast.error('Formato RUC inválido. Ej: 80046906-2');
      return;
    }
    if (!telefono && !email) { toast.error('Debés cargar teléfono o email'); return; }

    setSaving(true);
    const payload = {
      nombre, documento,
      tipo_documento: form.tipo_documento, direccion: form.direccion.trim() || null,
      telefono: telefono || null, email: email || null,
      limite_credito: toInteger(form.limite_credito, 0),
      lista_precios_id: form.lista_precios_id || null,
      vendedor_id: form.vendedor_id || null,
      condicion_venta_id: form.condicion_venta_id || null,
      es_exterior: form.es_exterior,
    };
    try {
      if (editando) {
        const { error } = await supabase.from('clientes').update(payload).eq('id', editando.id);
        if (error) throw error;
        await logAudit(supabase, { modulo: 'Clientes', entidad: 'Cliente', accion: 'editar', descripcion: `Editó el cliente ${nombre}`, registroId: editando.id });
        toast.success('Cliente actualizado');
      } else {
        const { data, error } = await supabase.from('clientes').insert({ ...payload, saldo_pendiente: 0 }).select('id').single();
        if (error) throw error;
        await logAudit(supabase, { modulo: 'Clientes', entidad: 'Cliente', accion: 'crear', descripcion: `Creó el cliente ${nombre}`, registroId: data?.id || null });
        toast.success('Cliente creado');
      }
      setShowModal(false);
      loadData();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(cliente: Cliente) {
    if (!window.confirm(`¿Eliminar el cliente "${cliente.nombre}"?`)) return;
    const { error } = await supabase.from('clientes').delete().eq('id', cliente.id);
    if (error) { toast.error(error.message || 'Error al eliminar'); return; }
    await logAudit(supabase, { modulo: 'Clientes', entidad: 'Cliente', accion: 'borrar', descripcion: `Eliminó el cliente ${cliente.nombre}`, registroId: cliente.id });
    toast.success('Cliente eliminado');
    loadData();
  }

  const filteredRaw = clientes.filter(c =>
    c.nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.documento || '').includes(search)
  ).map(c => ({ ...c, credito_disponible: c.limite_credito - c.saldo_pendiente }));
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  return (
    <>
      <Header title="Clientes" subtitle="Gestión de clientes y límites de crédito" />
      <div className="p-4 md:p-6 space-y-4">
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
                    <SortableTh label="Nombre" sortKey="nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Documento" sortKey="documento" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Teléfono" sortKey="telefono" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Límite Crédito" sortKey="limite_credito" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Saldo" sortKey="saldo_pendiente" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Crédito Disp." sortKey="credito_disponible" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => {
                    const disponible = c.limite_credito - c.saldo_pendiente;
                    const pct = porcentajeCredito(c.saldo_pendiente, c.limite_credito);
                    const sobreLimite = c.saldo_pendiente > c.limite_credito && c.limite_credito > 0;
                    return (
                      <tr key={c.id} className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 ${sobreLimite ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}>
                        <td className="table-cell font-semibold">
                          <div className="flex items-center gap-1.5">
                            {sobreLimite && <AlertTriangle className="w-3.5 h-3.5 text-yellow-500 shrink-0" aria-label="Sobre límite de crédito" />}
                            {c.nombre}
                          </div>
                        </td>
                        <td className="table-cell text-xs">
                          <span className="badge bg-gray-100 text-gray-600 dark:bg-gray-700">{c.tipo_documento}</span>
                          <span className="ml-1">{c.documento || '—'}</span>
                        </td>
                        <td className="table-cell">{c.telefono || '—'}</td>
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
                              <div className="w-20 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full mt-1 overflow-hidden">
                                <div className={`h-full rounded-full ${pct > 90 ? 'bg-red-500' : pct > 70 ? 'bg-yellow-500' : 'bg-emerald-500'}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEdit(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600">
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar cliente' : 'Nuevo cliente'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Nombre / Razón Social *</label>
                <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} placeholder="Nombre o razón social" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo documento</label>
                  <select className="input" value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))}>
                    {['RUC', 'CI', 'DNI', 'CUIT', 'OTRO'].map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">
                    N° * {form.tipo_documento === 'RUC' && <span className="text-gray-400 font-normal">(ej: 80046906-2)</span>}
                  </label>
                  <input className="input" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} placeholder={form.tipo_documento === 'RUC' ? 'XXXXXXXX-D' : ''} />
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

              <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Condiciones comerciales</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label">Lista de precios</label>
                    <select className="input" value={form.lista_precios_id} onChange={e => setForm(f => ({ ...f, lista_precios_id: e.target.value }))}>
                      <option value="">General</option>
                      {listas.map(l => <option key={l.id} value={l.id}>{l.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Condición de venta</label>
                    <select className="input" value={form.condicion_venta_id} onChange={e => setForm(f => ({ ...f, condicion_venta_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {condiciones.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Vendedor asignado</label>
                    <select className="input" value={form.vendedor_id} onChange={e => setForm(f => ({ ...f, vendedor_id: e.target.value }))}>
                      <option value="">Sin asignar</option>
                      {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="label">Límite de crédito (Gs.)</label>
                    <input type="number" min="0" step="1" inputMode="numeric" className="input" value={form.limite_credito} onChange={e => setForm(f => ({ ...f, limite_credito: toIntegerInput(e.target.value) }))} />
                    <p className="text-xs text-gray-400 mt-1">El límite es informativo. No bloquea ventas.</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.es_exterior} onChange={e => setForm(f => ({ ...f, es_exterior: e.target.checked }))} className="w-4 h-4 accent-blue-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Cliente exterior</span>
                </label>
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
