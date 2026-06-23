'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Plus, Search, Eye, X, Loader2, Handshake, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { SearchSelect } from '@/components/SearchSelect';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';
import type { Cliente, Banco, Venta, Gasto, Proveedor } from '@/lib/types';

interface CobroFacturaRow { venta_id: string; numero: string; total: number; saldo_pendiente: number; fecha: string; monto_aplicado: number; }
interface CobroGastoRow { gasto_id: string; categoria: string; monto: number; saldo_pendiente: number; fecha: string; monto_aplicado: number; }
interface CobroRetencionRow { numero_retencion: string; concepto: string; monto: number; }
interface CobroMedioRow { tipo: string; monto: number; banco_id: string; numero_cheque: string; fecha_cheque: string; numero_transaccion: string; }

export default function CobrosPage() {
  const supabase = createClient();
  const [cobros, setCobros] = useState<any[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [detalle, setDetalle] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);

  const [formHeader, setFormHeader] = useState({
    tipo_referencia: 'clientes' as 'clientes' | 'gastos',
    cliente_id: '',
    proveedor_id: '',
    fecha: new Date().toISOString().split('T')[0],
    concepto: ''
  });
  const [facturasPendientes, setFacturasPendientes] = useState<Venta[]>([]);
  const [facturasSelec, setFacturasSelec] = useState<CobroFacturaRow[]>([]);
  const [gastosPendientes, setGastosPendientes] = useState<Gasto[]>([]);
  const [gastosSelec, setGastosSelec] = useState<CobroGastoRow[]>([]);
  const [retenciones, setRetenciones] = useState<CobroRetencionRow[]>([]);
  const [medios, setMedios] = useState<CobroMedioRow[]>([{ tipo: 'efectivo', monto: 0, banco_id: '', numero_cheque: '', fecha_cheque: '', numero_transaccion: '' }]);

  const load = useCallback(async () => {
    setLoading(true);
    const [cobRes, cliRes, provRes, banRes] = await Promise.all([
      supabase.from('cobros').select('*, clientes(nombre), proveedores(nombre)').order('created_at', { ascending: false }).limit(100),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
      supabase.from('bancos').select('*').eq('activo', true).order('nombre'),
    ]);
    setCobros(cobRes.data || []);
    setClientes(cliRes.data as Cliente[] || []);
    setProveedores(provRes.data as Proveedor[] || []);
    setBancos(banRes.data as Banco[] || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  async function handleClienteChange(clienteId: string) {
    setFormHeader(f => ({ ...f, cliente_id: clienteId }));
    setFacturasSelec([]);
    if (!clienteId) { setFacturasPendientes([]); return; }
    const { data } = await supabase.from('ventas')
      .select('id, numero, total, saldo_pendiente, fecha')
      .eq('cliente_id', clienteId)
      .in('estado', ['pendiente', 'parcial'])
      .gt('saldo_pendiente', 0)
      .order('fecha');
    setFacturasPendientes(data as Venta[] || []);
  }

  async function handleProveedorChange(proveedorId: string) {
    setFormHeader(f => ({ ...f, proveedor_id: proveedorId }));
    setGastosSelec([]);
    if (!proveedorId) { setGastosPendientes([]); return; }
    const { data } = await supabase.from('gastos')
      .select('id, categoria, titulo, monto, saldo_pendiente, fecha')
      .eq('proveedor_id', proveedorId)
      .eq('condicion', 'credito')
      .in('estado', ['pendiente', 'parcial'])
      .gt('saldo_pendiente', 0)
      .order('fecha');
    setGastosPendientes(data as Gasto[] || []);
  }

  function agregarFactura(venta: Venta) {
    if (facturasSelec.find(f => f.venta_id === venta.id)) return;
    setFacturasSelec(prev => [...prev, {
      venta_id: venta.id, numero: venta.numero, total: venta.total,
      saldo_pendiente: venta.saldo_pendiente, fecha: venta.fecha,
      monto_aplicado: venta.saldo_pendiente,
    }]);
  }

  function agregarGasto(gasto: Gasto) {
    if (gastosSelec.find(g => g.gasto_id === gasto.id)) return;
    setGastosSelec(prev => [...prev, {
      gasto_id: gasto.id,
      categoria: gasto.categoria || gasto.titulo,
      monto: gasto.monto,
      saldo_pendiente: gasto.saldo_pendiente || gasto.monto,
      fecha: gasto.fecha,
      monto_aplicado: gasto.saldo_pendiente || gasto.monto,
    }]);
  }

  function updateFacturaMonto(venta_id: string, monto: number) {
    setFacturasSelec(prev => prev.map(f => f.venta_id === venta_id ? { ...f, monto_aplicado: monto } : f));
  }

  function updateGastoMonto(gasto_id: string, monto: number) {
    setGastosSelec(prev => prev.map(g => g.gasto_id === gasto_id ? { ...g, monto_aplicado: monto } : g));
  }

  const totalDocumentos = formHeader.tipo_referencia === 'clientes'
    ? facturasSelec.reduce((s, f) => s + f.monto_aplicado, 0)
    : gastosSelec.reduce((s, g) => s + g.monto_aplicado, 0);
  const totalRetenciones = retenciones.reduce((s, r) => s + r.monto, 0);
  const totalCobrado = medios.reduce((s, m) => s + m.monto, 0);
  const diferencia = totalDocumentos - totalRetenciones - totalCobrado;

  function openNew() {
    setFormHeader({ tipo_referencia: 'clientes', cliente_id: '', proveedor_id: '', fecha: new Date().toISOString().split('T')[0], concepto: '' });
    setFacturasPendientes([]);
    setFacturasSelec([]);
    setGastosPendientes([]);
    setGastosSelec([]);
    setRetenciones([]);
    setMedios([{ tipo: 'efectivo', monto: 0, banco_id: '', numero_cheque: '', fecha_cheque: '', numero_transaccion: '' }]);
    setShowModal(true);
  }

  async function handleSave() {
    if (formHeader.tipo_referencia === 'clientes' && !formHeader.cliente_id) { toast.error('Seleccioná un cliente'); return; }
    if (formHeader.tipo_referencia === 'gastos' && !formHeader.proveedor_id) { toast.error('Seleccioná un proveedor'); return; }
    if (formHeader.tipo_referencia === 'clientes' && facturasSelec.length === 0) { toast.error('Agregá al menos una factura'); return; }
    if (formHeader.tipo_referencia === 'gastos' && gastosSelec.length === 0) { toast.error('Agregá al menos un gasto'); return; }
    if (medios.every(m => m.monto <= 0)) { toast.error('Registrá al menos un medio de pago'); return; }
    if (Math.abs(diferencia) > 1) { toast.error(`Diferencia sin cubrir: ${formatCurrency(Math.abs(diferencia))}`); return; }
    setSaving(true);
    try {
      const { count } = await supabase.from('cobros').select('*', { count: 'exact', head: true });
      const numCobro = `COB-${String((count || 0) + 1).padStart(5, '0')}`;
      const { data: cobro, error } = await supabase.from('cobros').insert({
        numero: numCobro,
        fecha: formHeader.fecha,
        tipo_referencia: formHeader.tipo_referencia,
        cliente_id: formHeader.tipo_referencia === 'clientes' ? formHeader.cliente_id : null,
        proveedor_id: formHeader.tipo_referencia === 'gastos' ? formHeader.proveedor_id : null,
        concepto: formHeader.concepto || null,
        total_facturas: totalDocumentos,
        total_retenciones: totalRetenciones,
        total_cobrado: totalCobrado,
        estado: 'registrado',
      }).select().single();
      if (error) throw error;

      if (formHeader.tipo_referencia === 'clientes' && facturasSelec.length > 0) {
        await supabase.from('cobro_facturas').insert(facturasSelec.map(f => ({ cobro_id: cobro.id, venta_id: f.venta_id, monto_aplicado: f.monto_aplicado })));
      }
      if (formHeader.tipo_referencia === 'gastos' && gastosSelec.length > 0) {
        await supabase.from('cobro_gastos').insert(gastosSelec.map(g => ({ cobro_id: cobro.id, gasto_id: g.gasto_id, monto_aplicado: g.monto_aplicado })));
      }
      if (retenciones.length > 0) await supabase.from('cobro_retenciones').insert(retenciones.map(r => ({ cobro_id: cobro.id, ...r })));

      const mediosData = medios.filter(m => m.monto > 0).map(m => ({
        cobro_id: cobro.id, tipo: m.tipo, monto: m.monto,
        banco_id: m.banco_id || null, numero_cheque: m.numero_cheque || null,
        fecha_cheque: m.fecha_cheque || null, numero_transaccion: m.numero_transaccion || null,
      }));
      if (mediosData.length > 0) await supabase.from('cobro_medios_pago').insert(mediosData);

      if (formHeader.tipo_referencia === 'clientes') {
        for (const f of facturasSelec) {
          const { data: vent } = await supabase.from('ventas').select('saldo_pendiente, total').eq('id', f.venta_id).single();
          if (vent) {
            const nuevoSaldo = Math.max(0, vent.saldo_pendiente - f.monto_aplicado);
            const nuevoEstado = nuevoSaldo === 0 ? 'pagado' : nuevoSaldo < vent.total ? 'parcial' : 'pendiente';
            await supabase.from('ventas').update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado }).eq('id', f.venta_id);
          }
        }
        const cli = clientes.find(c => c.id === formHeader.cliente_id);
        if (cli) {
          await supabase.from('clientes').update({ saldo_pendiente: Math.max(0, cli.saldo_pendiente - totalCobrado) }).eq('id', formHeader.cliente_id);
        }
      } else {
        for (const g of gastosSelec) {
          const { data: gasto } = await supabase.from('gastos').select('saldo_pendiente, monto').eq('id', g.gasto_id).single();
          if (gasto) {
            const nuevoSaldo = Math.max(0, (gasto.saldo_pendiente || 0) - g.monto_aplicado);
            const nuevoEstado = nuevoSaldo === 0 ? 'pagado' : nuevoSaldo < gasto.monto ? 'parcial' : 'pendiente';
            await supabase.from('gastos').update({ saldo_pendiente: nuevoSaldo, estado: nuevoEstado }).eq('id', g.gasto_id);
          }
        }
      }

      toast.success(`Cobro ${numCobro} registrado`);
      setShowModal(false);
      load();
    } catch (e: any) {
      toast.error(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  const filteredRaw = cobros.filter(c =>
    c.numero?.toLowerCase().includes(search.toLowerCase()) ||
    c.clientes?.nombre?.toLowerCase().includes(search.toLowerCase()) ||
    c.proveedores?.nombre?.toLowerCase().includes(search.toLowerCase())
  ).map(c => ({ ...c, referencia_nombre: c.tipo_referencia === 'gastos' ? (c.proveedores?.nombre || '') : (c.clientes?.nombre || '') }));
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  return (
    <>
      <Header title="Cobros" subtitle="Registro de cobros a clientes o gastos a crédito" />
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row gap-3 justify-between">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input className="input pl-9" placeholder="Buscar N° o referencia..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <button onClick={openNew} className="btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" /> Nuevo cobro
          </button>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex justify-center items-center h-48"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <Handshake className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin cobros registrados</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-800/50">
                  <tr>
                    <SortableTh label="N°" sortKey="numero" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Tipo" sortKey="tipo_referencia" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Referencia" sortKey="referencia_nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Total documentos" sortKey="total_facturas" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Total cobrado" sortKey="total_cobrado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Estado" sortKey="estado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(c => (
                    <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell font-mono text-xs font-bold text-blue-600">{c.numero}</td>
                      <td className="table-cell text-xs">{formatDate(c.fecha)}</td>
                      <td className="table-cell"><span className="badge bg-blue-100 text-blue-700 capitalize">{c.tipo_referencia || 'clientes'}</span></td>
                      <td className="table-cell">{c.tipo_referencia === 'gastos' ? (c.proveedores?.nombre || '—') : (c.clientes?.nombre || '—')}</td>
                      <td className="table-cell font-semibold">{formatCurrency(c.total_facturas)}</td>
                      <td className="table-cell text-emerald-600 font-semibold">{formatCurrency(c.total_cobrado)}</td>
                      <td className="table-cell">
                        <span className={`badge ${c.estado === 'anulado' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-700'}`}>{c.estado}</span>
                      </td>
                      <td className="table-cell">
                        <button onClick={() => setDetalle(c)} className="p-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 hover:text-blue-600">
                          <Eye className="w-4 h-4" />
                        </button>
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
          <div className="card w-full max-w-3xl max-h-[94vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700 shrink-0">
              <h2 className="section-title">Nuevo Cobro</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-5">

              <div className="grid sm:grid-cols-4 gap-4">
                <div>
                  <label className="label">Tipo de cobro *</label>
                  <select className="input" value={formHeader.tipo_referencia} onChange={e => {
                    const tipo = e.target.value as 'clientes' | 'gastos';
                    setFormHeader(f => ({ ...f, tipo_referencia: tipo, cliente_id: '', proveedor_id: '' }));
                    setFacturasPendientes([]); setFacturasSelec([]);
                    setGastosPendientes([]); setGastosSelec([]);
                  }}>
                    <option value="clientes">Cobro a clientes</option>
                    <option value="gastos">Cobro a gastos</option>
                  </select>
                </div>
                {formHeader.tipo_referencia === 'clientes' ? (
                  <div className="sm:col-span-2">
                    <label className="label">Cliente *</label>
                    <SearchSelect
                      options={clientes.map(c => ({ value: c.id, label: c.nombre, sublabel: c.documento || undefined }))}
                      value={formHeader.cliente_id}
                      onChange={handleClienteChange}
                      placeholder="Seleccionar..."
                    />
                  </div>
                ) : (
                  <div className="sm:col-span-2">
                    <label className="label">Proveedor *</label>
                    <SearchSelect
                      options={proveedores.map(p => ({ value: p.id, label: p.nombre, sublabel: p.documento || undefined }))}
                      value={formHeader.proveedor_id}
                      onChange={handleProveedorChange}
                      placeholder="Seleccionar..."
                    />
                  </div>
                )}
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={formHeader.fecha} onChange={e => setFormHeader(f => ({ ...f, fecha: e.target.value }))} />
                </div>
                <div className="sm:col-span-4">
                  <label className="label">Concepto</label>
                  <input className="input" value={formHeader.concepto} onChange={e => setFormHeader(f => ({ ...f, concepto: e.target.value }))} placeholder="Ej: Cobro facturas sept." />
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-sm mb-2">
                  {formHeader.tipo_referencia === 'clientes' ? 'Facturas a cobrar' : 'Gastos a cobrar'}
                </h3>
                {formHeader.tipo_referencia === 'clientes' && facturasPendientes.length > 0 && (
                  <div className="mb-3 border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="table-header">N° Factura</th>
                          <th className="table-header">Fecha</th>
                          <th className="table-header">Total</th>
                          <th className="table-header">Saldo</th>
                          <th className="table-header"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {facturasPendientes.map(v => (
                          <tr key={v.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer ${facturasSelec.find(f => f.venta_id === v.id) ? 'opacity-40' : ''}`}
                            onClick={() => agregarFactura(v)}>
                            <td className="table-cell font-mono font-bold">{v.numero}</td>
                            <td className="table-cell">{formatDate(v.fecha)}</td>
                            <td className="table-cell">{formatCurrency(v.total)}</td>
                            <td className="table-cell text-red-500 font-semibold">{formatCurrency(v.saldo_pendiente)}</td>
                            <td className="table-cell text-blue-500 text-xs">+ agregar</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {formHeader.tipo_referencia === 'gastos' && gastosPendientes.length > 0 && (
                  <div className="mb-3 border rounded-lg overflow-hidden">
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 dark:bg-gray-800">
                        <tr>
                          <th className="table-header">Categoría</th>
                          <th className="table-header">Fecha</th>
                          <th className="table-header">Monto</th>
                          <th className="table-header">Saldo</th>
                          <th className="table-header"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                        {gastosPendientes.map(g => (
                          <tr key={g.id} className={`hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer ${gastosSelec.find(x => x.gasto_id === g.id) ? 'opacity-40' : ''}`}
                            onClick={() => agregarGasto(g)}>
                            <td className="table-cell font-medium">{g.categoria || g.titulo}</td>
                            <td className="table-cell">{formatDate(g.fecha)}</td>
                            <td className="table-cell">{formatCurrency(g.monto)}</td>
                            <td className="table-cell text-red-500 font-semibold">{formatCurrency(g.saldo_pendiente || g.monto)}</td>
                            <td className="table-cell text-blue-500 text-xs">+ agregar</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {(formHeader.tipo_referencia === 'clientes' ? facturasSelec.length : gastosSelec.length) === 0 ? (
                  <div className="py-4 text-center text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-lg text-sm">
                    {formHeader.tipo_referencia === 'clientes'
                      ? (formHeader.cliente_id ? 'Hacé clic en una factura para agregarla' : 'Seleccioná un cliente para ver sus facturas pendientes')
                      : (formHeader.proveedor_id ? 'Hacé clic en un gasto para agregarlo' : 'Seleccioná un proveedor para ver sus gastos pendientes')}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {formHeader.tipo_referencia === 'clientes' && facturasSelec.map(f => (
                      <div key={f.venta_id} className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm">
                        <span className="font-mono font-bold text-blue-600 w-28 shrink-0">{f.numero}</span>
                        <span className="text-gray-500 text-xs w-20 shrink-0">Saldo: {formatCurrency(f.saldo_pendiente)}</span>
                        <div className="flex items-center gap-1 flex-1">
                          <label className="text-xs text-gray-500 shrink-0">Monto a aplicar:</label>
                          <input type="number" min="0" className="input py-1 text-sm max-w-[140px]" value={f.monto_aplicado}
                            onChange={e => updateFacturaMonto(f.venta_id, parseFloat(e.target.value) || 0)} />
                        </div>
                        <button onClick={() => setFacturasSelec(prev => prev.filter(x => x.venta_id !== f.venta_id))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                    {formHeader.tipo_referencia === 'gastos' && gastosSelec.map(g => (
                      <div key={g.gasto_id} className="flex items-center gap-3 p-2 bg-blue-50 dark:bg-blue-900/10 rounded-lg text-sm">
                        <span className="font-semibold text-blue-600 w-40 shrink-0 truncate">{g.categoria}</span>
                        <span className="text-gray-500 text-xs w-20 shrink-0">Saldo: {formatCurrency(g.saldo_pendiente)}</span>
                        <div className="flex items-center gap-1 flex-1">
                          <label className="text-xs text-gray-500 shrink-0">Monto a aplicar:</label>
                          <input type="number" min="0" className="input py-1 text-sm max-w-[140px]" value={g.monto_aplicado}
                            onChange={e => updateGastoMonto(g.gasto_id, parseFloat(e.target.value) || 0)} />
                        </div>
                        <button onClick={() => setGastosSelec(prev => prev.filter(x => x.gasto_id !== g.gasto_id))} className="text-red-400 hover:text-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Retenciones (opcional)</h3>
                  <button onClick={() => setRetenciones(prev => [...prev, { numero_retencion: '', concepto: '', monto: 0 }])} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                {retenciones.map((r, idx) => (
                  <div key={idx} className="grid grid-cols-3 gap-2 mb-2 text-sm">
                    <input className="input py-1.5" placeholder="N° Retención" value={r.numero_retencion} onChange={e => setRetenciones(prev => prev.map((x, i) => i === idx ? { ...x, numero_retencion: e.target.value } : x))} />
                    <input className="input py-1.5" placeholder="Concepto" value={r.concepto} onChange={e => setRetenciones(prev => prev.map((x, i) => i === idx ? { ...x, concepto: e.target.value } : x))} />
                    <div className="flex gap-1">
                      <input type="number" className="input py-1.5 flex-1" placeholder="Monto" value={r.monto} onChange={e => setRetenciones(prev => prev.map((x, i) => i === idx ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))} />
                      <button onClick={() => setRetenciones(prev => prev.filter((_, i) => i !== idx))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <h3 className="font-semibold text-sm">Medios de pago</h3>
                  <button onClick={() => setMedios(prev => [...prev, { tipo: 'efectivo', monto: 0, banco_id: '', numero_cheque: '', fecha_cheque: '', numero_transaccion: '' }])} className="btn-secondary flex items-center gap-1 text-xs py-1"><Plus className="w-3.5 h-3.5" /> Agregar</button>
                </div>
                {medios.map((m, idx) => (
                  <div key={idx} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg mb-2 space-y-2">
                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div>
                        <label className="label text-xs">Tipo</label>
                        <select className="input py-1.5" value={m.tipo} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, tipo: e.target.value } : x))}>
                          <option value="efectivo">Efectivo</option>
                          <option value="transferencia">Transferencia</option>
                          <option value="cheque_dia">Cheque al día</option>
                          <option value="cheque_diferido">Cheque diferido</option>
                          <option value="tarjeta">Tarjeta</option>
                          <option value="otro">Otro</option>
                        </select>
                      </div>
                      <div>
                        <label className="label text-xs">Monto</label>
                        <input type="number" min="0" className="input py-1.5" value={m.monto} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, monto: parseFloat(e.target.value) || 0 } : x))} />
                      </div>
                      {(m.tipo === 'cheque_dia' || m.tipo === 'cheque_diferido') && (
                        <>
                          <div>
                            <label className="label text-xs">N° Cheque</label>
                            <input className="input py-1.5" value={m.numero_cheque} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, numero_cheque: e.target.value } : x))} />
                          </div>
                          <div>
                            <label className="label text-xs">Banco</label>
                            <select className="input py-1.5" value={m.banco_id} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, banco_id: e.target.value } : x))}>
                              <option value="">Seleccionar</option>
                              {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                            </select>
                          </div>
                          {m.tipo === 'cheque_diferido' && (
                            <div>
                              <label className="label text-xs">Fecha cobro cheque</label>
                              <input type="date" className="input py-1.5" value={m.fecha_cheque} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, fecha_cheque: e.target.value } : x))} />
                            </div>
                          )}
                        </>
                      )}
                      {m.tipo === 'transferencia' && (
                        <div>
                          <label className="label text-xs">N° Transacción</label>
                          <input className="input py-1.5" value={m.numero_transaccion} onChange={e => setMedios(prev => prev.map((x, i) => i === idx ? { ...x, numero_transaccion: e.target.value } : x))} />
                        </div>
                      )}
                      {idx > 0 && (
                        <div className="flex items-end">
                          <button onClick={() => setMedios(prev => prev.filter((_, i) => i !== idx))} className="text-red-400 hover:text-red-600 p-1.5"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Total documentos:</span><span className="font-semibold">{formatCurrency(totalDocumentos)}</span></div>
                {totalRetenciones > 0 && <div className="flex justify-between"><span className="text-gray-500">Retenciones:</span><span className="text-red-500 font-semibold">- {formatCurrency(totalRetenciones)}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Total cobrado:</span><span className="text-emerald-600 font-semibold">{formatCurrency(totalCobrado)}</span></div>
                <div className={`flex justify-between font-bold text-base border-t border-gray-200 dark:border-gray-700 pt-1 ${Math.abs(diferencia) > 1 ? 'text-red-500' : 'text-emerald-600'}`}>
                  <span>Diferencia:</span><span>{formatCurrency(Math.abs(diferencia))} {diferencia > 1 ? '(falta)' : diferencia < -1 ? '(excedente)' : '✓'}</span>
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700 shrink-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                Registrar cobro
              </button>
            </div>
          </div>
        </div>
      )}

      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-md p-6 space-y-3">
            <div className="flex justify-between items-center">
              <h2 className="section-title">Cobro {detalle.numero}</h2>
              <button onClick={() => setDetalle(null)}><X className="w-4 h-4" /></button>
            </div>
            <div className="text-sm space-y-1">
              <p><span className="text-gray-500">Tipo:</span> <strong className="capitalize">{detalle.tipo_referencia || 'clientes'}</strong></p>
              {detalle.tipo_referencia === 'gastos'
                ? <p><span className="text-gray-500">Proveedor:</span> <strong>{detalle.proveedores?.nombre}</strong></p>
                : <p><span className="text-gray-500">Cliente:</span> <strong>{detalle.clientes?.nombre}</strong></p>}
              <p><span className="text-gray-500">Fecha:</span> {formatDate(detalle.fecha)}</p>
              {detalle.concepto && <p><span className="text-gray-500">Concepto:</span> {detalle.concepto}</p>}
              <p><span className="text-gray-500">Total documentos:</span> {formatCurrency(detalle.total_facturas)}</p>
              <p><span className="text-gray-500">Total cobrado:</span> <strong className="text-emerald-600">{formatCurrency(detalle.total_cobrado)}</strong></p>
            </div>
            <button onClick={() => setDetalle(null)} className="btn-secondary w-full">Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}
