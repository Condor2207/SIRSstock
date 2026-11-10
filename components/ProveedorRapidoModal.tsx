'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { getErrorMessage, toDigitsOnly } from '@/lib/utils';
import type { Proveedor } from '@/lib/types';

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (proveedor: Proveedor) => void;
}

const normalizarDoc = (v: string) => toDigitsOnly(v);
const normalizarNombre = (v: string) => v.trim().replace(/\s+/g, ' ').toLowerCase();

// Alta rápida de proveedor desde compras / NC / gastos, con validación de duplicados (RUC o nombre)
export function ProveedorRapidoModal({ open, onClose, onCreated }: Props) {
  const supabase = createClient();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ nombre: '', tipo_documento: 'RUC', documento: '', telefono: '', direccion: '', email: '', datos_fiscales: '' });

  if (!open) return null;

  async function handleSave() {
    const nombre = form.nombre.trim().replace(/\s+/g, ' ');
    const documento = form.documento.trim();
    if (!nombre) { toast.error('El nombre o razón social es obligatorio'); return; }
    if (documento && form.tipo_documento === 'RUC' && !/^\d{3,8}-\d$/.test(documento)) {
      toast.error('Formato RUC inválido. Ej: 80046906-2'); return;
    }
    setSaving(true);
    try {
      const { data: existentes, error: listError } = await supabase.from('proveedores').select('id, nombre, documento, activo');
      if (listError) throw listError;
      const dupNombre = (existentes || []).find(p => normalizarNombre(p.nombre) === normalizarNombre(nombre));
      if (dupNombre) { toast.error(`Ya existe un proveedor con el nombre "${dupNombre.nombre}"${dupNombre.activo ? '' : ' (inactivo)'}`); return; }
      if (documento) {
        const dupDoc = (existentes || []).find(p => p.documento && normalizarDoc(p.documento) === normalizarDoc(documento));
        if (dupDoc) { toast.error(`El RUC/documento ya está registrado para "${dupDoc.nombre}"${dupDoc.activo ? '' : ' (inactivo)'}`); return; }
      }
      const payload: Record<string, any> = {
        nombre, documento: documento || null, tipo_documento: form.tipo_documento,
        telefono: form.telefono.trim() || null, direccion: form.direccion.trim() || null,
        email: form.email.trim() || null, datos_fiscales: form.datos_fiscales.trim() || null,
      };
      let res = await supabase.from('proveedores').insert(payload).select('*').single();
      if (res.error && /datos_fiscales/.test(getErrorMessage(res.error))) {
        delete payload.datos_fiscales;
        res = await supabase.from('proveedores').insert(payload).select('*').single();
      }
      if (res.error) throw res.error;
      await logAudit(supabase, { modulo: 'Proveedores', entidad: 'Proveedor', accion: 'crear', descripcion: `Creó el proveedor ${nombre} (alta rápida)`, registroId: res.data.id });
      toast.success('Proveedor creado');
      onCreated(res.data as Proveedor);
      setForm({ nombre: '', tipo_documento: 'RUC', documento: '', telefono: '', direccion: '', email: '', datos_fiscales: '' });
    } catch (e: any) {
      toast.error(getErrorMessage(e) || 'No se pudo crear el proveedor');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="card w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
          <h2 className="section-title">Nuevo proveedor</h2>
          <button onClick={onClose}><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="label">Nombre o razón social *</label>
            <input className="input" value={form.nombre} onChange={e => setForm(f => ({ ...f, nombre: e.target.value }))} autoFocus />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="label">Tipo doc.</label>
              <select className="input" value={form.tipo_documento} onChange={e => setForm(f => ({ ...f, tipo_documento: e.target.value }))}>
                <option value="RUC">RUC</option>
                <option value="DNI">CI / DNI</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="label">RUC / documento</label>
              <input className="input" value={form.documento} onChange={e => setForm(f => ({ ...f, documento: e.target.value }))} placeholder="80046906-2" />
            </div>
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
            <label className="label">Dirección</label>
            <input className="input" value={form.direccion} onChange={e => setForm(f => ({ ...f, direccion: e.target.value }))} />
          </div>
          <div>
            <label className="label">Datos fiscales (opcional)</label>
            <textarea className="input" rows={2} value={form.datos_fiscales} onChange={e => setForm(f => ({ ...f, datos_fiscales: e.target.value }))} placeholder="Timbrado, actividad económica, etc." />
          </div>
        </div>
        <div className="flex justify-end gap-3 p-5 border-t border-gray-100 dark:border-gray-700">
          <button onClick={onClose} className="btn-secondary">Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />} Guardar y seleccionar
          </button>
        </div>
      </div>
    </div>
  );
}
