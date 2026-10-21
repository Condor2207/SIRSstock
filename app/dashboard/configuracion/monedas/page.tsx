'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Plus, Loader2, Save, ToggleLeft, ToggleRight, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Moneda } from '@/lib/types';

export default function MonedasPage() {
  const supabase = createClient();
  const [items, setItems] = useState<Moneda[]>([]);
  const [tasas, setTasas] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [nueva, setNueva] = useState({ codigo: '', nombre: '', simbolo: '', tipo_cambio: '' });
  const [conv, setConv] = useState({ monto: '1', desde: 'USD', hacia: 'PYG' });

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from('monedas').select('*').order('codigo');
    const list = (data as Moneda[]) || [];
    setItems(list);
    setTasas(Object.fromEntries(list.map(m => [m.id, String(Number(m.tipo_cambio))])));
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const cambio = (codigo: string) => Number(items.find(m => m.codigo === codigo)?.tipo_cambio) || 0;
  const resultado = (() => {
    const monto = Number(conv.monto.replace(',', '.'));
    if (!isFinite(monto) || !cambio(conv.desde) || !cambio(conv.hacia)) return 0;
    return (monto * cambio(conv.desde)) / cambio(conv.hacia);
  })();

  async function handleGuardar() {
    const cambios: { m: Moneda; tc: number }[] = [];
    for (const m of items) {
      if (m.codigo === 'PYG') continue;
      const tc = Number((tasas[m.id] || '').replace(',', '.'));
      if (!isFinite(tc) || tc <= 0) { toast.error(`Tipo de cambio inválido para ${m.codigo}`); return; }
      if (tc !== Number(m.tipo_cambio)) cambios.push({ m, tc });
    }
    if (cambios.length === 0) { toast('No hay cambios para guardar'); return; }
    setSaving(true);
    for (const { m, tc } of cambios) {
      const { error } = await supabase.from('monedas').update({ tipo_cambio: tc, updated_at: new Date().toISOString() }).eq('id', m.id);
      if (error) { setSaving(false); toast.error(error.message); return; }
      await logAudit(supabase, { modulo: 'Configuración', entidad: 'Moneda', accion: 'editar', descripcion: `Tipo de cambio ${m.codigo}: 1 ${m.codigo} = ${tc} Gs.`, registroId: m.id });
    }
    setSaving(false);
    toast.success('Tipos de cambio guardados');
    load();
  }

  async function handleNueva() {
    const codigo = nueva.codigo.trim().toUpperCase();
    const tc = Number(nueva.tipo_cambio.replace(',', '.'));
    if (!codigo || !nueva.nombre.trim()) { toast.error('Código y nombre son obligatorios'); return; }
    if (!isFinite(tc) || tc <= 0) { toast.error('Tipo de cambio inválido'); return; }
    const { data, error } = await supabase.from('monedas')
      .insert({ codigo, nombre: nueva.nombre.trim(), simbolo: nueva.simbolo.trim() || codigo, tipo_cambio: tc })
      .select('id').single();
    if (error) { toast.error(error.message); return; }
    await logAudit(supabase, { modulo: 'Configuración', entidad: 'Moneda', accion: 'crear', descripcion: `Creó la moneda ${codigo} (1 ${codigo} = ${tc} Gs.)`, registroId: data?.id || null });
    toast.success('Moneda creada');
    setNueva({ codigo: '', nombre: '', simbolo: '', tipo_cambio: '' });
    load();
  }

  async function handleToggle(m: Moneda) {
    const { error } = await supabase.from('monedas').update({ activo: !m.activo }).eq('id', m.id);
    if (error) { toast.error(error.message); return; }
    load();
  }

  const fmt = (n: number) => new Intl.NumberFormat('es-PY', { maximumFractionDigits: 4 }).format(n);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Monedas y Tipo de Cambio" />
      <div className="p-4 md:p-6 space-y-6">
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>
          ) : (
            <table className="w-full text-sm">
              <thead><tr>
                <th className="table-header">Código</th><th className="table-header">Nombre</th>
                <th className="table-header">Equivale a (Gs.)</th><th className="table-header text-right">Activa</th>
              </tr></thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {items.map(m => (
                  <tr key={m.id} className={!m.activo ? 'opacity-60' : ''}>
                    <td className="table-cell"><span className="badge">{m.codigo}</span></td>
                    <td className="table-cell">{m.nombre}</td>
                    <td className="table-cell">
                      {m.codigo === 'PYG' ? <span>1</span> : (
                        <div className="flex items-center gap-2">
                          <span>1 {m.codigo} =</span>
                          <input type="number" min="0" step="any" inputMode="decimal" className="input w-32" value={tasas[m.id] ?? ''} onChange={e => setTasas(p => ({ ...p, [m.id]: e.target.value }))} />
                          <span>Gs.</span>
                        </div>
                      )}
                    </td>
                    <td className="table-cell text-right">
                      {m.codigo !== 'PYG' && (
                        <button className={`${m.activo ? 'text-amber-500' : 'text-emerald-600'} p-1`} onClick={() => handleToggle(m)} title={m.activo ? 'Inactivar' : 'Activar'}>
                          {m.activo ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="p-4 flex justify-end">
            <button className="btn-primary flex items-center gap-2" onClick={handleGuardar} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}Guardar tipos de cambio
            </button>
          </div>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white"><ArrowRightLeft className="w-4 h-4" />Conversor</h3>
          <div className="flex flex-wrap items-center gap-2">
            <input className="input w-32" value={conv.monto} onChange={e => setConv(p => ({ ...p, monto: e.target.value }))} inputMode="decimal" />
            <select className="input w-28" value={conv.desde} onChange={e => setConv(p => ({ ...p, desde: e.target.value }))}>
              {items.map(m => <option key={m.id} value={m.codigo}>{m.codigo}</option>)}
            </select>
            <span>=</span>
            <strong>{fmt(resultado)}</strong>
            <select className="input w-28" value={conv.hacia} onChange={e => setConv(p => ({ ...p, hacia: e.target.value }))}>
              {items.map(m => <option key={m.id} value={m.codigo}>{m.codigo}</option>)}
            </select>
          </div>
          <p className="text-xs text-gray-500 mt-2">Los precios de productos cotizados en otra moneda se convierten a Gs. con estos valores al vender.</p>
        </div>

        <div className="card p-4">
          <h3 className="font-semibold mb-3 text-gray-900 dark:text-white">Agregar moneda</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
            <div><label className="label">Código *</label><input className="input" maxLength={5} placeholder="BRL" value={nueva.codigo} onChange={e => setNueva(p => ({ ...p, codigo: e.target.value }))} /></div>
            <div><label className="label">Nombre *</label><input className="input" placeholder="Real" value={nueva.nombre} onChange={e => setNueva(p => ({ ...p, nombre: e.target.value }))} /></div>
            <div><label className="label">Símbolo</label><input className="input" placeholder="R$" value={nueva.simbolo} onChange={e => setNueva(p => ({ ...p, simbolo: e.target.value }))} /></div>
            <div><label className="label">1 unidad = Gs. *</label><input type="number" min="0" step="any" className="input" value={nueva.tipo_cambio} onChange={e => setNueva(p => ({ ...p, tipo_cambio: e.target.value }))} /></div>
            <button className="btn-primary flex items-center justify-center gap-2" onClick={handleNueva}><Plus className="w-4 h-4" />Agregar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
