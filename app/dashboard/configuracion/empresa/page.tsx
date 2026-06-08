'use client';

import { useEffect, useState } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { Save, Loader2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import type { EmpresaConfig } from '@/lib/types';

function getEmpresaConfigErrorMessage(error?: { message?: string } | null) {
  if (error?.message?.includes("Could not find the table 'public.empresa_config'")) {
    return 'Falta la tabla de configuración de empresa en Supabase. Ejecuta la migración 006_empresa_config_hotfix.sql.';
  }

  return error?.message || 'No se pudo guardar la configuración de empresa';
}

export default function EmpresaConfigPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<Partial<EmpresaConfig>>({
    nombre: '', ruc: '', direccion: '', telefono: '',
    timbrado: '', punto_expedicion: '', timbrado_desde: '', timbrado_hasta: '',
    actividad_comercial: '', email: '',
  });

  useEffect(() => {
    supabase.from('empresa_config').select('*').eq('id', 1).single().then(({ data, error }) => {
      if (data) setForm(data);
      else if (error) toast.error(getEmpresaConfigErrorMessage(error));
      setLoading(false);
    });
  }, []);

  function set(field: string, val: string) {
    setForm(prev => ({ ...prev, [field]: val }));
  }

  async function handleSave() {
    if (!form.nombre || !form.ruc) { toast.error('Nombre y RUC son obligatorios'); return; }
    setSaving(true);
    const { error } = await supabase.from('empresa_config').upsert({
      id: 1, ...form, updated_at: new Date().toISOString(),
    });
    setSaving(false);
    if (error) toast.error(getEmpresaConfigErrorMessage(error));
    else toast.success('Configuración guardada');
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Datos de Empresa" />
      <div className="p-4 md:p-6 max-w-2xl">
        <div className="card p-6 space-y-5">
          <div className="flex items-center gap-3 mb-2">
            <Building2 className="w-5 h-5 text-blue-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white">Información Fiscal</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="label">Razón Social *</label>
              <input className="input" value={form.nombre || ''} onChange={e => set('nombre', e.target.value)} placeholder="Teixeira S.A." />
            </div>
            <div>
              <label className="label">RUC *</label>
              <input className="input" value={form.ruc || ''} onChange={e => set('ruc', e.target.value)} placeholder="80046906-2" />
            </div>
            <div>
              <label className="label">Actividad Comercial</label>
              <input className="input" value={form.actividad_comercial || ''} onChange={e => set('actividad_comercial', e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <label className="label">Dirección</label>
              <input className="input" value={form.direccion || ''} onChange={e => set('direccion', e.target.value)} />
            </div>
            <div>
              <label className="label">Teléfono</label>
              <input className="input" value={form.telefono || ''} onChange={e => set('telefono', e.target.value)} />
            </div>
            <div>
              <label className="label">Email</label>
              <input className="input" type="email" value={form.email || ''} onChange={e => set('email', e.target.value)} />
            </div>
          </div>

          <div className="border-t border-gray-100 dark:border-gray-800 pt-5">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-4">Datos de Facturación</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="label">N° Timbrado DNIT</label>
                <input className="input" value={form.timbrado || ''} onChange={e => set('timbrado', e.target.value)} placeholder="18781301" />
              </div>
              <div>
                <label className="label">Punto de Expedición</label>
                <input className="input" value={form.punto_expedicion || ''} onChange={e => set('punto_expedicion', e.target.value)} placeholder="001-001" />
              </div>
              <div>
                <label className="label">Timbrado Desde</label>
                <input className="input" type="date" value={form.timbrado_desde || ''} onChange={e => set('timbrado_desde', e.target.value)} />
              </div>
              <div>
                <label className="label">Timbrado Hasta</label>
                <input className="input" type="date" value={form.timbrado_hasta || ''} onChange={e => set('timbrado_hasta', e.target.value)} />
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button className="btn-primary flex items-center gap-2" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Guardar cambios
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
