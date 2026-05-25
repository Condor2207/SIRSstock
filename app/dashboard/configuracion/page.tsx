'use client';

import { useCallback, useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { Loader2, Plus, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface Unidad {
  id: string;
  nombre: string;
  abreviatura: string;
  activo: boolean;
}

interface Clasificacion {
  id: string;
  codigo: string;
  nombre: string;
  aparece_en_factura: boolean;
  tiene_stock: boolean;
  usa_en_produccion: boolean;
  requiere_lote: boolean;
  requiere_vencimiento: boolean;
  activo: boolean;
}

interface CondicionVenta {
  id: string;
  nombre: string;
  plazo_dias: number;
  cantidad_cuotas: number;
  activo: boolean;
}

interface Vendedor {
  id: string;
  nombre: string;
  telefono: string | null;
  email: string | null;
  activo: boolean;
}

export default function ConfiguracionPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unidades, setUnidades] = useState<Unidad[]>([]);
  const [clasificaciones, setClasificaciones] = useState<Clasificacion[]>([]);
  const [condiciones, setCondiciones] = useState<CondicionVenta[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [nuevaUnidad, setNuevaUnidad] = useState({ nombre: '', abreviatura: '' });
  const [nuevaCondicion, setNuevaCondicion] = useState({ nombre: '', plazo_dias: 0, cantidad_cuotas: 1 });
  const [nuevoVendedor, setNuevoVendedor] = useState({ nombre: '', telefono: '', email: '' });

  const loadData = useCallback(async () => {
    setLoading(true);
    const [u, c, cv, vs] = await Promise.all([
      supabase.from('unidades_medida').select('*').order('nombre'),
      supabase.from('clasificaciones_producto').select('*').order('nombre'),
      supabase.from('condiciones_venta').select('*').order('plazo_dias'),
      supabase.from('vendedores').select('*').order('nombre'),
    ]);
    setUnidades((u.data || []) as Unidad[]);
    setClasificaciones((c.data || []) as Clasificacion[]);
    setCondiciones((cv.data || []) as CondicionVenta[]);
    setVendedores((vs.data || []) as Vendedor[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { loadData(); }, [loadData]);

  async function addUnidad() {
    if (!nuevaUnidad.nombre || !nuevaUnidad.abreviatura) return;
    setSaving(true);
    const { error } = await supabase.from('unidades_medida').insert({
      nombre: nuevaUnidad.nombre,
      abreviatura: nuevaUnidad.abreviatura.toLowerCase(),
      activo: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNuevaUnidad({ nombre: '', abreviatura: '' });
    toast.success('Unidad creada');
    loadData();
  }

  async function saveClasificacion(row: Clasificacion) {
    const { error } = await supabase.from('clasificaciones_producto').update({
      aparece_en_factura: row.aparece_en_factura,
      tiene_stock: row.tiene_stock,
      usa_en_produccion: row.usa_en_produccion,
      requiere_lote: row.requiere_lote,
      requiere_vencimiento: row.requiere_vencimiento,
      activo: row.activo,
    }).eq('id', row.id);
    if (error) return toast.error(error.message);
    toast.success(`Clasificación ${row.nombre} actualizada`);
  }

  async function addCondicion() {
    if (!nuevaCondicion.nombre) return;
    setSaving(true);
    const { error } = await supabase.from('condiciones_venta').insert({
      nombre: nuevaCondicion.nombre,
      plazo_dias: nuevaCondicion.plazo_dias || 0,
      cantidad_cuotas: nuevaCondicion.cantidad_cuotas || 1,
      activo: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNuevaCondicion({ nombre: '', plazo_dias: 0, cantidad_cuotas: 1 });
    toast.success('Condición creada');
    loadData();
  }

  async function addVendedor() {
    if (!nuevoVendedor.nombre) return;
    setSaving(true);
    const { error } = await supabase.from('vendedores').insert({
      nombre: nuevoVendedor.nombre,
      telefono: nuevoVendedor.telefono || null,
      email: nuevoVendedor.email || null,
      activo: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    setNuevoVendedor({ nombre: '', telefono: '', email: '' });
    toast.success('Vendedor creado');
    loadData();
  }

  if (loading) {
    return (
      <>
        <Header title="Configuración" subtitle="Maestros administrables del sistema" />
        <div className="p-10 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-500" /></div>
      </>
    );
  }

  return (
    <>
      <Header title="Configuración" subtitle="Maestros administrables del sistema" />
      <div className="p-6 space-y-6">
        <div className="card p-5 space-y-3">
          <h2 className="section-title">Unidades de medida</h2>
          <div className="grid grid-cols-3 gap-2">
            <input className="input" placeholder="Nombre" value={nuevaUnidad.nombre} onChange={(e) => setNuevaUnidad((s) => ({ ...s, nombre: e.target.value }))} />
            <input className="input" placeholder="Abreviatura" value={nuevaUnidad.abreviatura} onChange={(e) => setNuevaUnidad((s) => ({ ...s, abreviatura: e.target.value }))} />
            <button onClick={addUnidad} disabled={saving} className="btn-primary flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Agregar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {unidades.map((u) => <div key={u.id} className="text-sm border rounded-lg px-3 py-2">{u.nombre} <span className="text-gray-500">({u.abreviatura})</span></div>)}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="section-title">Clasificación de productos</h2>
          <div className="space-y-2">
            {clasificaciones.map((row) => (
              <div key={row.id} className="border rounded-lg p-3">
                <div className="font-semibold mb-2">{row.nombre}</div>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                  {([
                    ['aparece_en_factura', 'Aparece en factura'],
                    ['tiene_stock', 'Tiene stock'],
                    ['usa_en_produccion', 'Se usa en producción'],
                    ['requiere_lote', 'Requiere lote'],
                    ['requiere_vencimiento', 'Requiere vencimiento'],
                    ['activo', 'Activo'],
                  ] as const).map(([field, label]) => (
                    <label key={field} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={Boolean(row[field])}
                        onChange={(e) => setClasificaciones((prev) => prev.map((c) => c.id === row.id ? { ...c, [field]: e.target.checked } : c))}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <button onClick={() => saveClasificacion(row)} className="btn-secondary mt-3 text-xs py-1 px-3 flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Guardar cambios
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="section-title">Condiciones de venta</h2>
          <div className="grid grid-cols-4 gap-2">
            <input className="input" placeholder="Nombre" value={nuevaCondicion.nombre} onChange={(e) => setNuevaCondicion((s) => ({ ...s, nombre: e.target.value }))} />
            <input type="number" className="input" placeholder="Plazo días" value={nuevaCondicion.plazo_dias} onChange={(e) => setNuevaCondicion((s) => ({ ...s, plazo_dias: parseInt(e.target.value, 10) || 0 }))} />
            <input type="number" className="input" placeholder="Cuotas" value={nuevaCondicion.cantidad_cuotas} onChange={(e) => setNuevaCondicion((s) => ({ ...s, cantidad_cuotas: parseInt(e.target.value, 10) || 1 }))} />
            <button onClick={addCondicion} disabled={saving} className="btn-primary flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Agregar</button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {condiciones.map((c) => <div key={c.id} className="text-sm border rounded-lg px-3 py-2">{c.nombre} <span className="text-gray-500">({c.plazo_dias} días / {c.cantidad_cuotas} cuota/s)</span></div>)}
          </div>
        </div>

        <div className="card p-5 space-y-3">
          <h2 className="section-title">Vendedores</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <input className="input" placeholder="Nombre" value={nuevoVendedor.nombre} onChange={(e) => setNuevoVendedor((s) => ({ ...s, nombre: e.target.value }))} />
            <input className="input" placeholder="Teléfono" value={nuevoVendedor.telefono} onChange={(e) => setNuevoVendedor((s) => ({ ...s, telefono: e.target.value }))} />
            <input className="input" placeholder="Email" value={nuevoVendedor.email} onChange={(e) => setNuevoVendedor((s) => ({ ...s, email: e.target.value }))} />
            <button onClick={addVendedor} disabled={saving} className="btn-primary flex items-center justify-center gap-2"><Plus className="w-4 h-4" /> Agregar</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {vendedores.map((v) => (
              <div key={v.id} className="text-sm border rounded-lg px-3 py-2">
                <div className="font-semibold">{v.nombre}</div>
                <div className="text-gray-500">{v.telefono || '-'} · {v.email || '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
