'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { formatMonto, maskNumeroFactura, esNumeroFacturaValido, formatCurrency, formatDate, estadoBadgeClass, getErrorMessage, isSchemaCacheMissing, toDigitsOnly, sanitizeDecimalInput, parseDecimal, decimalToInput, decimalesMoneda, roundMoneda, formatMontoMoneda, DECIMALES_TIPO_CAMBIO, hoyISO } from '@/lib/utils';
import { ComprobanteInput } from '@/components/ComprobanteInput';
import { ProveedorRapidoModal } from '@/components/ProveedorRapidoModal';
import { subirComprobante, abrirComprobante } from '@/lib/comprobantes';
import { descargarExcel } from '@/lib/export';
import { Plus, Search, Receipt, X, Loader2, Edit2, Trash2, Eye, Download, Paperclip, UserPlus } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Gasto, Proveedor, TasaIva } from '@/lib/types';
import { usePagination, Pagination, useSort, SortableTh } from '@/components/TableUtils';

const CATEGORIAS_BASE = ['Servicios', 'Combustible', 'Reparaciones', 'Insumos de oficina', 'Alquiler', 'Transporte', 'Marketing', 'Personal', 'Impuestos', 'Otros'];
const MEDIOS_PAGO = ['efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro'];
const CREAR_CATEGORIA = '__INTERNAL_CREATE_CATEGORY__';
const GASTOS_SELECT_ADVANCED = 'id, titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia, created_by, created_at, condicion, fecha_vencimiento, numero_transaccion, banco_id, numero_cheque, fecha_cheque, tasa_iva_id, saldo_pendiente, estado, moneda, tipo_cambio, tipo_servicio, detalle_servicio, comprobante_url, comprobante_nombre, proveedores(nombre), tasa_iva_ref:tasas_iva(nombre, porcentaje)';
const GASTOS_SELECT_LEGACY = 'id, titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia, created_by, created_at, condicion, fecha_vencimiento, numero_transaccion, banco_id, numero_cheque, fecha_cheque, tasa_iva_id, saldo_pendiente, estado, moneda, tipo_cambio, proveedores(nombre), tasa_iva_ref:tasas_iva(nombre, porcentaje)';
const GASTOS_SELECT_BASE = 'id, titulo, descripcion, proveedor_id, monto, fecha, medio_pago, categoria, referencia, created_by, created_at, proveedores(nombre)';

interface Banco { id: string; nombre: string; }

export default function GastosPage() {
  const supabase = createClient();
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editando, setEditando] = useState<Gasto | null>(null);
  const [proveedores, setProveedores] = useState<Proveedor[]>([]);
  const [bancos, setBancos] = useState<Banco[]>([]);
  const [tasasIva, setTasasIva] = useState<TasaIva[]>([]);
  const [categorias, setCategorias] = useState<string[]>(CATEGORIAS_BASE);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [nuevaCategoria, setNuevaCategoria] = useState('');
  const [schemaCompatMode, setSchemaCompatMode] = useState(false);
  const compatToastShown = useRef(false);
  const [tiposServicio, setTiposServicio] = useState<string[]>([]);
  const [faltaMigracion022, setFaltaMigracion022] = useState(false);
  const [comprobanteFile, setComprobanteFile] = useState<File | null>(null);
  const [showProvRapido, setShowProvRapido] = useState(false);
  const [detalle, setDetalle] = useState<Gasto | null>(null);
  const [form, setForm] = useState({
    descripcion: '', proveedor_id: '', monto: '',
    fecha: new Date().toISOString().split('T')[0],
    medio_pago: 'efectivo', categoria: '', referencia: '',
    condicion: 'debito' as 'debito' | 'credito', fecha_vencimiento: '',
    numero_transaccion: '', banco_id: '', numero_cheque: '', fecha_cheque: '',
    tasa_iva_id: '', moneda: 'GS' as 'GS' | 'USD', tipo_cambio: '',
    tipo_servicio: '', detalle_servicio: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    const advancedRes = await supabase
      .from('gastos')
      .select(GASTOS_SELECT_ADVANCED)
      .order('fecha', { ascending: false })
      .limit(100);
    let data: any[] | null = advancedRes.data;
    let error: any = advancedRes.error;
    if (error && isSchemaCacheMissing(error, ['tipo_servicio', 'detalle_servicio', 'comprobante_url', 'comprobante_nombre'])) {
      setFaltaMigracion022(true);
      const legacyRes = await supabase
        .from('gastos')
        .select(GASTOS_SELECT_LEGACY)
        .order('fecha', { ascending: false })
        .limit(100);
      data = legacyRes.data;
      error = legacyRes.error;
      if (error && isSchemaCacheMissing(error, ['moneda', 'tipo_cambio'])) {
        setSchemaCompatMode(true);
        const baseRes = await supabase
          .from('gastos')
          .select(GASTOS_SELECT_BASE)
          .order('fecha', { ascending: false })
          .limit(100);
        data = baseRes.data;
        error = baseRes.error;
      }
    } else if (!error) {
      setFaltaMigracion022(false);
    }
    if (error && isSchemaCacheMissing(error, ['gastos', 'estado', 'saldo_pendiente', 'condicion', 'tasas_iva'])) {
      setSchemaCompatMode(true);
      const baseRes = await supabase
        .from('gastos')
        .select(GASTOS_SELECT_BASE)
        .order('fecha', { ascending: false })
        .limit(100);
      data = baseRes.data;
      error = baseRes.error;
      if (!compatToastShown.current) {
        toast('La base de datos no tiene aún todas las columnas de gastos. Se activó el modo compatible.');
        compatToastShown.current = true;
      }
    } else {
      setSchemaCompatMode(false);
    }
    if (error) {
      toast.error(getErrorMessage(error) || 'Error al cargar gastos');
      setGastos([]);
      setCategorias(CATEGORIAS_BASE);
      setLoading(false);
      return;
    }
    const rows = (data as Gasto[] || []);
    setGastos(rows);
    const categoriasDb = rows.map(g => (g.categoria || g.titulo || '').trim()).filter(Boolean);
    const unicas = Array.from(new Set([...CATEGORIAS_BASE, ...categoriasDb])).sort((a, b) => a.localeCompare(b, 'es'));
    setCategorias(unicas);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    load();
    supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre').then(r => setProveedores(r.data as Proveedor[] || []));
    supabase.from('bancos').select('id, nombre').eq('activo', true).order('nombre').then(r => setBancos(r.error ? [] : (r.data as Banco[] || [])));
    supabase.from('gasto_tipos_servicio').select('nombre').eq('activo', true).order('nombre').then(r => setTiposServicio(r.error ? [] : (r.data || []).map((t: any) => t.nombre)));
    supabase.from('tasas_iva').select('id, nombre, porcentaje').eq('activo', true).order('porcentaje').then(r => setTasasIva(r.error ? [] : (r.data as TasaIva[] || [])));
  }, [load, supabase]);

  function resetForm() {
    setEditando(null);
    setComprobanteFile(null);
    setCreandoCategoria(false);
    setNuevaCategoria('');
    setForm({
      descripcion: '', proveedor_id: '', monto: '',
      fecha: new Date().toISOString().split('T')[0],
      medio_pago: 'efectivo', categoria: '', referencia: '',
      condicion: 'debito', fecha_vencimiento: '',
      numero_transaccion: '', banco_id: '', numero_cheque: '', fecha_cheque: '',
      tasa_iva_id: '', moneda: 'GS', tipo_cambio: '',
      tipo_servicio: '', detalle_servicio: '',
    });
  }

  function openEdit(g: Gasto) {
    setEditando(g);
    const categoria = g.categoria || g.titulo || '';
    setCreandoCategoria(false);
    setNuevaCategoria('');
    setForm({
      descripcion: g.descripcion || '',
      proveedor_id: g.proveedor_id || '',
      monto: g.monto ? decimalToInput(g.monto, decimalesMoneda((g as any).moneda)) : '',
      fecha: g.fecha || new Date().toISOString().split('T')[0],
      medio_pago: g.medio_pago || 'efectivo',
      categoria,
      referencia: g.referencia || '',
      condicion: (g.condicion as 'debito' | 'credito') || 'debito',
      fecha_vencimiento: g.fecha_vencimiento || '',
      numero_transaccion: (g as any).numero_transaccion || '',
      banco_id: (g as any).banco_id || '',
      numero_cheque: (g as any).numero_cheque || '',
      fecha_cheque: (g as any).fecha_cheque || '',
      tasa_iva_id: g.tasa_iva_id || '',
      moneda: ((g as any).moneda === 'USD' ? 'USD' : 'GS') as 'GS' | 'USD',
      tipo_cambio: (g as any).tipo_cambio ? decimalToInput((g as any).tipo_cambio, DECIMALES_TIPO_CAMBIO) : '',
      tipo_servicio: g.tipo_servicio || '',
      detalle_servicio: g.detalle_servicio || '',
    });
    setComprobanteFile(null);
    setShowModal(true);
  }

  function agregarCategoria() {
    const nombre = nuevaCategoria.trim();
    if (!nombre) return;
    if (categorias.includes(nombre)) {
      toast('La categoría ya existe, se seleccionó automáticamente');
    } else {
      setCategorias(prev => [...prev, nombre].sort((a, b) => a.localeCompare(b, 'es')));
    }
    setForm(f => ({ ...f, categoria: nombre }));
    setCreandoCategoria(false);
    setNuevaCategoria('');
  }

  async function handleSave() {
    if (!form.categoria || !form.monto) { toast.error('Categoría y monto son obligatorios'); return; }
    const proveedorId = form.proveedor_id.trim();
    if (!proveedorId) { toast.error('Por favor seleccione un proveedor'); return; }
    const monto = roundMoneda(parseDecimal(form.monto), form.moneda);
    const comprobanteExistente = editando?.comprobante_url || null;
    if (!form.referencia.trim() && !comprobanteFile && !comprobanteExistente) { toast.error('El comprobante es obligatorio: ingresá el número o adjuntá el archivo'); return; }
    const refTrim = form.referencia.trim();
    if (/^[\d-]+$/.test(refTrim) && refTrim.replace(/\D/g, '').length === 13 && !esNumeroFacturaValido(maskNumeroFactura(refTrim))) {
      toast.error('El número de factura debe tener el formato 001-001-1234567'); return;
    }
    if (form.moneda === 'USD' && form.tipo_cambio && parseDecimal(form.tipo_cambio) <= 0) { toast.error('El tipo de cambio debe ser mayor a 0'); return; }
    if (isNaN(monto) || monto <= 0) { toast.error('El monto debe ser mayor a 0'); return; }
    if (schemaCompatMode && form.condicion === 'credito') {
      toast.error('No se pueden registrar gastos a crédito porque faltan columnas en la base de datos. Por favor ejecute las migraciones 009, 010 y 011.');
      return;
    }

    let saldoPendiente = 0;
    let estado: 'pendiente' | 'pagado' | 'parcial' = 'pagado';
    if (form.condicion === 'credito') {
      if (editando) {
        const saldoAnterior = editando.saldo_pendiente ?? editando.monto;
        const pagado = Math.max(0, (editando.monto || 0) - saldoAnterior);
        if (monto < pagado) { toast.error(`El monto (${formatMontoMoneda(monto, form.moneda)}) no puede ser menor al importe ya pagado (${formatMontoMoneda(pagado, form.moneda)})`); return; }
        saldoPendiente = roundMoneda(Math.max(0, monto - pagado), form.moneda);
      } else {
        saldoPendiente = monto;
      }
      estado = saldoPendiente === 0 ? 'pagado' : saldoPendiente < monto ? 'parcial' : 'pendiente';
    }

    setSaving(true);
    try {
      let comprobanteUrl: string | null = comprobanteExistente;
      let comprobanteNombre: string | null = editando?.comprobante_nombre || null;
      if (comprobanteFile) {
        comprobanteUrl = await subirComprobante(supabase, comprobanteFile, 'gastos');
        comprobanteNombre = comprobanteFile.name;
      }
      const payload: Record<string, any> = {
        titulo: form.categoria,
        descripcion: form.descripcion || null,
        proveedor_id: proveedorId,
        monto,
        fecha: form.fecha,
        medio_pago: form.condicion === 'credito' ? 'otro' : form.medio_pago,
        categoria: form.categoria,
        referencia: (/^[\d-]+$/.test(refTrim) && refTrim.replace(/\D/g, '').length === 13 ? maskNumeroFactura(refTrim) : refTrim) || null,
      };
      if (!schemaCompatMode) {
        Object.assign(payload, {
          condicion: form.condicion,
          fecha_vencimiento: form.condicion === 'credito' ? (form.fecha_vencimiento || null) : null,
          numero_transaccion: form.medio_pago === 'transferencia' ? (toDigitsOnly(form.numero_transaccion) || null) : null,
          banco_id: form.medio_pago === 'cheque' ? (form.banco_id || null) : null,
          numero_cheque: form.medio_pago === 'cheque' ? (toDigitsOnly(form.numero_cheque) || null) : null,
          fecha_cheque: form.medio_pago === 'cheque' ? (form.fecha_cheque || null) : null,
          tasa_iva_id: form.tasa_iva_id || null,
          moneda: form.moneda,
          tipo_cambio: form.moneda === 'USD' && form.tipo_cambio ? parseDecimal(form.tipo_cambio) : null,
          tipo_servicio: form.tipo_servicio || null,
          detalle_servicio: form.detalle_servicio.trim() || null,
          comprobante_url: comprobanteUrl,
          comprobante_nombre: comprobanteNombre,
          saldo_pendiente: saldoPendiente,
          estado,
        });
      }
      const { data, error } = editando
        ? await supabase.from('gastos').update(payload).eq('id', editando.id).select('id').single()
        : await supabase.from('gastos').insert(payload).select('id').single();
      if (error) throw error;
      await logAudit(supabase, {
        modulo: 'Gastos',
        entidad: 'Gasto',
        accion: editando ? 'editar' : 'crear',
        descripcion: `${editando ? 'Editó' : 'Registró'} el gasto ${form.categoria}`,
        registroId: data?.id || editando?.id || null,
      });
      toast.success(editando ? 'Gasto actualizado' : 'Gasto registrado');
      setShowModal(false);
      resetForm();
      load();
    } catch (e: any) {
      const message = getErrorMessage(e) || 'Error al guardar';
      if (/gastos\.(tipo_servicio|detalle_servicio|comprobante_url|comprobante_nombre)|column .* does not exist/i.test(message)) {
        setFaltaMigracion022(true);
        toast.error('Faltan columnas de la migración 022 en Supabase. Aplicala y recargá el esquema antes de guardar gastos.');
      } else {
        toast.error(message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(gasto: Gasto) {
    if (!window.confirm(`¿Eliminar el gasto "${gasto.categoria || gasto.titulo}"?`)) return;
    const { error } = await supabase.from('gastos').delete().eq('id', gasto.id);
    if (error) { toast.error(getErrorMessage(error) || 'Error al eliminar'); return; }
    await logAudit(supabase, { modulo: 'Gastos', entidad: 'Gasto', accion: 'borrar', descripcion: `Eliminó el gasto ${gasto.categoria || gasto.titulo}`, registroId: gasto.id });
    toast.success('Gasto eliminado');
    load();
  }

  const filteredRaw = gastos.filter(g =>
    (g.categoria || g.titulo || '').toLowerCase().includes(search.toLowerCase())
  ).map(g => ({ ...g, proveedor_nombre: (g as any).proveedores?.nombre || '' }));
  const { sorted: filteredSorted, sortKey, sortDir, handleSort } = useSort(filteredRaw as any[]);
  const { paginated: filtered, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(filteredSorted);

  async function exportarExcel() {
    const rows = filteredRaw.map((g: any) => ({
      Fecha: g.fecha,
      Categoría: g.categoria || g.titulo,
      'Tipo de servicio': g.tipo_servicio || '',
      'Detalle del servicio': g.detalle_servicio || '',
      Proveedor: g.proveedor_nombre,
      Comprobante: g.referencia || g.comprobante_nombre || '',
      Condición: g.condicion || 'debito',
      Estado: g.estado || 'pagado',
      Moneda: g.moneda || 'GS',
      'Tipo de cambio': g.tipo_cambio ?? '',
      Monto: g.monto,
      'Saldo pendiente': g.saldo_pendiente ?? '',
    }));
    if (rows.length === 0) { toast.error('No hay gastos para exportar'); return; }
    await descargarExcel(`gastos_${hoyISO()}.xlsx`, 'Gastos', rows);
  }

  const totalFiltrado = filtered.reduce((s, g) => ((g as any).moneda === 'USD' ? s : s + g.monto), 0);
  const totalFiltradoUsd = filtered.reduce((s, g) => ((g as any).moneda === 'USD' ? s + g.monto : s), 0);

  return (
    <>
      <Header title="Gastos" subtitle="Registro de gastos y egresos operativos" />
      <div className="p-4 md:p-6 space-y-4">
        {schemaCompatMode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Modo compatible activo: faltan columnas avanzadas de gastos en la base de datos. Podés seguir usando el módulo con funciones reducidas hasta ejecutar las migraciones pendientes.
          </div>
        )}
        {faltaMigracion022 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
            Faltan columnas de la migración 022 (tipo de servicio, moneda o comprobante). Aplicá la migración en Supabase y recargá el esquema de la API.
          </div>
        )}
        <div className="flex flex-col sm:flex-row gap-3 justify-between items-start">
          <div className="flex gap-2 flex-1">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input className="input pl-9" placeholder="Buscar por categoría..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            {filtered.length > 0 && (
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total: <span className="font-bold text-red-500">{formatCurrency(totalFiltrado)}{totalFiltradoUsd > 0 && <> + {formatMonto(totalFiltradoUsd, 'USD')}</>}</span>
              </div>
            )}
            <button onClick={exportarExcel} className="btn-secondary flex items-center gap-2" title="Exportar a Excel">
              <Download className="w-4 h-4" /> Excel
            </button>
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
                    <SortableTh label="Fecha" sortKey="fecha" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Categoría" sortKey="categoria" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Servicio" sortKey="tipo_servicio" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <SortableTh label="Proveedor" sortKey="proveedor_nombre" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    {!schemaCompatMode && <SortableTh label="IVA" sortKey="tasa_iva_id" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    {!schemaCompatMode && <SortableTh label="Condición" sortKey="condicion" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    {!schemaCompatMode && <SortableTh label="Estado" sortKey="estado" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />}
                    <SortableTh label="Monto" sortKey="monto" currentKey={sortKey} currentDir={sortDir} onSort={handleSort} />
                    <th className="table-header text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {filtered.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell text-xs">{formatDate(g.fecha)}</td>
                      <td className="table-cell font-medium">
                        <div>{g.categoria || g.titulo}</div>
                        {g.descripcion && <div className="text-xs text-gray-400">{g.descripcion}</div>}
                      </td>
                      <td className="table-cell text-sm">
                        <div>{g.tipo_servicio || '-'}</div>
                        {g.detalle_servicio && <div className="text-xs text-gray-400">{g.detalle_servicio}</div>}
                      </td>
                      <td className="table-cell text-sm">{(g as any).proveedores?.nombre || '-'}</td>
                      {!schemaCompatMode && <td className="table-cell text-sm">{(g as any).tasa_iva_ref ? `${(g as any).tasa_iva_ref.nombre} (${(g as any).tasa_iva_ref.porcentaje}%)` : '-'}</td>}
                      {!schemaCompatMode && <td className="table-cell capitalize">{g.condicion || 'debito'}</td>}
                      {!schemaCompatMode && (
                        <td className="table-cell">
                          <span className={`badge ${estadoBadgeClass(g.estado || 'pagado')}`}>{g.estado || 'pagado'}</span>
                        </td>
                      )}
                      <td className="table-cell font-bold text-red-500">{formatMonto(g.monto, (g as any).moneda || 'GS')} <span className="text-[10px] text-gray-400 font-normal">{(g as any).moneda || 'GS'}</span></td>
                      <td className="table-cell text-right">
                        <button onClick={() => setDetalle(g)} className="p-1 text-gray-500 hover:text-gray-700" title="Ver ficha">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => openEdit(g)} className="p-1 text-blue-500 hover:text-blue-700" title="Editar gasto">
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(g)} className="p-1 text-red-500 hover:text-red-700" title="Eliminar gasto">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td colSpan={schemaCompatMode ? 4 : 7} className="px-4 py-3 text-right text-sm font-semibold text-gray-600 dark:text-gray-400">Total:</td>
                    <td className="px-4 py-3 font-bold text-red-500 text-base">{formatCurrency(totalFiltrado)}{totalFiltradoUsd > 0 && <div>{formatMonto(totalFiltradoUsd, 'USD')}</div>}</td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">{editando ? 'Editar Gasto' : 'Nuevo Gasto'}</h2>
              <button onClick={() => setShowModal(false)}><X className="w-4 h-4" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="label">Categoría *</label>
                {!creandoCategoria ? (
                  <select
                    className="input"
                    value={form.categoria}
                    onChange={e => {
                      if (e.target.value === CREAR_CATEGORIA) {
                        setCreandoCategoria(true);
                        return;
                      }
                      setForm(f => ({ ...f, categoria: e.target.value }));
                    }}
                  >
                    <option value="">Seleccionar categoría</option>
                    <option value={CREAR_CATEGORIA}>+ Crear categoría</option>
                    {categorias.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                ) : (
                  <div className="flex gap-2">
                    <input className="input" value={nuevaCategoria} onChange={e => setNuevaCategoria(e.target.value)} placeholder="Nueva categoría" />
                    <button onClick={agregarCategoria} className="btn-secondary shrink-0">Agregar</button>
                    <button onClick={() => { setCreandoCategoria(false); setNuevaCategoria(''); }} className="btn-secondary shrink-0">Cancelar</button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Tipo de servicio</label>
                  <select className="input" value={form.tipo_servicio} onChange={e => setForm(f => ({ ...f, tipo_servicio: e.target.value }))}>
                    <option value="">Sin especificar</option>
                    {form.tipo_servicio && !tiposServicio.includes(form.tipo_servicio) && <option value={form.tipo_servicio}>{form.tipo_servicio}</option>}
                    {tiposServicio.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Detalle del servicio</label>
                  <input className="input" value={form.detalle_servicio} onChange={e => setForm(f => ({ ...f, detalle_servicio: e.target.value }))} placeholder="Ej: flete Asunción - CDE" />
                </div>
              </div>
              <div>
                <label className="label">Descripción</label>
                <textarea className="input" rows={2} value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Monto ({form.moneda === 'USD' ? 'USD' : 'Gs.'}) *</label>
                  <input type="text" inputMode="decimal" className="input" placeholder={form.moneda === 'USD' ? '0.00' : '0'} value={form.monto} onChange={e => setForm(f => ({ ...f, monto: sanitizeDecimalInput(e.target.value, decimalesMoneda(form.moneda)) }))} />
                </div>
                <div>
                  <label className="label">Moneda</label>
                  <select className="input" value={form.moneda} disabled={schemaCompatMode} onChange={e => { const m = e.target.value as 'GS' | 'USD'; setForm(f => ({ ...f, moneda: m, monto: sanitizeDecimalInput(f.monto, decimalesMoneda(m)) })); }}>
                    <option value="GS">Guaraníes (GS)</option>
                    <option value="USD">Dólares (USD)</option>
                  </select>
                </div>
                {form.moneda === 'USD' && (
                  <div>
                    <label className="label">Tipo de cambio (opcional)</label>
                    <input type="text" inputMode="decimal" className="input" placeholder="Gs. por USD" value={form.tipo_cambio} onChange={e => setForm(f => ({ ...f, tipo_cambio: sanitizeDecimalInput(e.target.value, DECIMALES_TIPO_CAMBIO) }))} />
                  </div>
                )}
                <div>
                  <label className="label">Fecha</label>
                  <input type="date" className="input" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {!schemaCompatMode && (
                  <div>
                    <label className="label">Condición</label>
                    <select className="input" value={form.condicion} onChange={e => setForm(f => ({ ...f, condicion: e.target.value as 'debito' | 'credito' }))}>
                      <option value="debito">Débito (pagado)</option>
                      <option value="credito">Crédito (a pagar)</option>
                    </select>
                  </div>
                )}
                {!schemaCompatMode && (
                  <div>
                    <label className="label">IVA</label>
                    <select className="input" value={form.tasa_iva_id} onChange={e => setForm(f => ({ ...f, tasa_iva_id: e.target.value }))}>
                      <option value="">Sin IVA</option>
                      {tasasIva.map(t => <option key={t.id} value={t.id}>{t.nombre} ({t.porcentaje}%)</option>)}
                    </select>
                  </div>
                )}
                {!schemaCompatMode && form.condicion === 'credito' ? (
                  <div>
                    <label className="label">Medio de pago</label>
                    <input className="input bg-gray-100 dark:bg-gray-800" value="A crédito (sin pago inmediato)" readOnly />
                  </div>
                ) : (
                  <div>
                    <label className="label">Medio de pago</label>
                    <select className="input" value={form.medio_pago} onChange={e => setForm(f => ({ ...f, medio_pago: e.target.value }))}>
                      {MEDIOS_PAGO.map(m => <option key={m} className="capitalize">{m}</option>)}
                    </select>
                  </div>
                )}
                {!schemaCompatMode && form.condicion !== 'credito' && form.medio_pago === 'transferencia' && (
                  <div>
                    <label className="label">N° Transacción</label>
                    <input className="input" placeholder="00001" value={form.numero_transaccion} onChange={e => setForm(f => ({ ...f, numero_transaccion: toDigitsOnly(e.target.value) }))} />
                  </div>
                )}
                {!schemaCompatMode && form.condicion !== 'credito' && form.medio_pago === 'cheque' && (
                  <>
                    <div>
                      <label className="label">N° Cheque</label>
                      <input className="input" placeholder="00001" value={form.numero_cheque} onChange={e => setForm(f => ({ ...f, numero_cheque: toDigitsOnly(e.target.value) }))} />
                    </div>
                    <div>
                      <label className="label">Banco</label>
                      <select className="input" value={form.banco_id} onChange={e => setForm(f => ({ ...f, banco_id: e.target.value }))}>
                        <option value="">Seleccionar banco</option>
                        {bancos.map(b => <option key={b.id} value={b.id}>{b.nombre}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label">Fecha cobro cheque</label>
                      <input type="date" className="input" value={form.fecha_cheque} onChange={e => setForm(f => ({ ...f, fecha_cheque: e.target.value }))} />
                    </div>
                  </>
                )}
                {!schemaCompatMode && form.condicion === 'credito' && (
                  <div>
                    <label className="label">Fecha vencimiento</label>
                    <input type="date" className="input" value={form.fecha_vencimiento} onChange={e => setForm(f => ({ ...f, fecha_vencimiento: e.target.value }))} />
                  </div>
                )}
              </div>
              <div>
                <label className="label">Proveedor *</label>
                <div className="flex gap-2">
                  <select className="input flex-1" value={form.proveedor_id} onChange={e => setForm(f => ({ ...f, proveedor_id: e.target.value }))}>
                    <option value="">Seleccionar proveedor</option>
                    {proveedores.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  <button type="button" onClick={() => setShowProvRapido(true)} className="btn-secondary flex items-center gap-1 shrink-0 text-xs"><UserPlus className="w-4 h-4" /> Nuevo</button>
                </div>
              </div>
              <ComprobanteInput
                label="Comprobante"
                numero={form.referencia}
                onNumero={v => setForm(f => ({ ...f, referencia: v }))}
                file={comprobanteFile}
                onFile={setComprobanteFile}
                numeroPlaceholder="N° factura, recibo..."
                existente={editando?.comprobante_url}
              />
            </div>
            <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
              <button onClick={() => setShowModal(false)} className="btn-secondary">Cancelar</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
                {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                {editando ? 'Guardar cambios' : 'Registrar gasto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ProveedorRapidoModal
        open={showProvRapido}
        onClose={() => setShowProvRapido(false)}
        onCreated={p => {
          setProveedores(prev => [...prev, p].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
          setForm(f => ({ ...f, proveedor_id: p.id }));
          setShowProvRapido(false);
        }}
      />

      {detalle && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="card w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
              <h2 className="section-title">Ficha del gasto</h2>
              <button onClick={() => setDetalle(null)}><X className="w-4 h-4" /></button>
            </div>
            <dl className="p-5 grid grid-cols-2 gap-3 text-sm">
              {([
                ['Fecha', formatDate(detalle.fecha)],
                ['Categoría', detalle.categoria || detalle.titulo],
                ['Tipo de servicio', detalle.tipo_servicio || '-'],
                ['Detalle del servicio', detalle.detalle_servicio || '-'],
                ['Proveedor', (detalle as any).proveedores?.nombre || '-'],
                ['Moneda', (detalle as any).moneda || 'GS'],
                ['Monto', formatMontoMoneda(detalle.monto, (detalle as any).moneda)],
                ['Tipo de cambio', (detalle as any).tipo_cambio ? String((detalle as any).tipo_cambio) : '-'],
                ['Condición', detalle.condicion || 'debito'],
                ['Estado', detalle.estado || 'pagado'],
                ['Saldo pendiente', detalle.saldo_pendiente != null ? formatMontoMoneda(detalle.saldo_pendiente, (detalle as any).moneda) : '-'],
                ['Comprobante', detalle.referencia || detalle.comprobante_nombre || '-'],
                ['Descripción', detalle.descripcion || '-'],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k}><dt className="text-xs text-gray-400">{k}</dt><dd className="font-medium ">{v}</dd></div>
              ))}
              {detalle.comprobante_url && (
                <div className="col-span-2">
                  <button onClick={() => abrirComprobante(supabase, detalle.comprobante_url!)} className="btn-secondary flex items-center gap-2 text-xs"><Paperclip className="w-4 h-4" /> Ver archivo adjunto</button>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </>
  );
}
