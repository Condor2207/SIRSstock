'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { Plus, Edit2, X, Loader2, Check, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Marca, Linea, Grupo } from '@/lib/types';

export default function MarcasPage() {
  const supabase = createClient();
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMarca, setSelectedMarca] = useState<Marca | null>(null);
  const [selectedLinea, setSelectedLinea] = useState<Linea | null>(null);

  const [modal, setModal] = useState<null | 'marca' | 'linea' | 'grupo'>(null);
  const [editando, setEditando] = useState<Marca | Linea | Grupo | null>(null);
  const [saving, setSaving] = useState(false);
  const [formNombre, setFormNombre] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, lRes, gRes] = await Promise.all([
      supabase.from('marcas').select('*').order('nombre'),
      supabase.from('lineas').select('*').order('nombre'),
      supabase.from('grupos').select('*').order('nombre'),
    ]);
    setMarcas(mRes.data as Marca[] || []);
    setLineas(lRes.data as Linea[] || []);
    setGrupos(gRes.data as Grupo[] || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const lineasDeMarca = lineas.filter(l => l.marca_id === selectedMarca?.id);
  const gruposDeLinea = grupos.filter(g => g.linea_id === selectedLinea?.id);

  function openModal(tipo: 'marca' | 'linea' | 'grupo', item?: Marca | Linea | Grupo) {
    setModal(tipo);
    setEditando(item || null);
    setFormNombre(item ? item.nombre : '');
  }

  async function handleSave() {
    if (!formNombre.trim()) { toast.error('El nombre es obligatorio'); return; }
    setSaving(true);
    let error: any = null;
    const nombre = formNombre.trim().toUpperCase();

    if (modal === 'marca') {
      const { error: e } = editando
        ? await supabase.from('marcas').update({ nombre }).eq('id', editando.id)
        : await supabase.from('marcas').insert({ nombre });
      error = e;
    } else if (modal === 'linea') {
      const { error: e } = editando
        ? await supabase.from('lineas').update({ nombre }).eq('id', editando.id)
        : await supabase.from('lineas').insert({ nombre, marca_id: selectedMarca?.id });
      error = e;
    } else if (modal === 'grupo') {
      const { error: e } = editando
        ? await supabase.from('grupos').update({ nombre }).eq('id', editando.id)
        : await supabase.from('grupos').insert({ nombre, linea_id: selectedLinea?.id });
      error = e;
    }

    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editando ? 'Actualizado' : 'Creado');
    setModal(null);
    load();
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Marcas / Líneas / Grupos" />
      <div className="p-6">
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Jerarquía de clasificación de productos: Marca → Línea → Grupo</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Marcas */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Marcas</h3>
              <button className="btn-primary text-xs py-1 px-2 flex items-center gap-1" onClick={() => openModal('marca')}><Plus className="w-3 h-3" />Nueva</button>
            </div>
            <div className="space-y-1">
              {marcas.map(m => (
                <div key={m.id}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedMarca?.id === m.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                  onClick={() => { setSelectedMarca(m); setSelectedLinea(null); }}>
                  <span className="text-sm font-medium">{m.nombre}</span>
                  <div className="flex items-center gap-1">
                    <button className="text-blue-400 hover:text-blue-600 p-0.5" onClick={e => { e.stopPropagation(); openModal('marca', m); }}><Edit2 className="w-3 h-3" /></button>
                    <ChevronRight className="w-3 h-3 text-gray-400" />
                  </div>
                </div>
              ))}
              {marcas.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Sin marcas</p>}
            </div>
          </div>

          {/* Líneas */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Líneas {selectedMarca && <span className="text-blue-500 font-normal">— {selectedMarca.nombre}</span>}
              </h3>
              {selectedMarca && (
                <button className="btn-primary text-xs py-1 px-2 flex items-center gap-1" onClick={() => openModal('linea')}><Plus className="w-3 h-3" />Nueva</button>
              )}
            </div>
            {!selectedMarca ? (
              <p className="text-xs text-gray-400 text-center py-3">Seleccioná una marca</p>
            ) : (
              <div className="space-y-1">
                {lineasDeMarca.map(l => (
                  <div key={l.id}
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors ${selectedLinea?.id === l.id ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 'hover:bg-gray-50 dark:hover:bg-gray-800'}`}
                    onClick={() => setSelectedLinea(l)}>
                    <span className="text-sm font-medium">{l.nombre}</span>
                    <div className="flex items-center gap-1">
                      <button className="text-blue-400 hover:text-blue-600 p-0.5" onClick={e => { e.stopPropagation(); openModal('linea', l); }}><Edit2 className="w-3 h-3" /></button>
                      <ChevronRight className="w-3 h-3 text-gray-400" />
                    </div>
                  </div>
                ))}
                {lineasDeMarca.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Sin líneas</p>}
              </div>
            )}
          </div>

          {/* Grupos */}
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                Grupos {selectedLinea && <span className="text-blue-500 font-normal">— {selectedLinea.nombre}</span>}
              </h3>
              {selectedLinea && (
                <button className="btn-primary text-xs py-1 px-2 flex items-center gap-1" onClick={() => openModal('grupo')}><Plus className="w-3 h-3" />Nuevo</button>
              )}
            </div>
            {!selectedLinea ? (
              <p className="text-xs text-gray-400 text-center py-3">Seleccioná una línea</p>
            ) : (
              <div className="space-y-1">
                {gruposDeLinea.map(g => (
                  <div key={g.id} className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
                    <span className="text-sm font-medium">{g.nombre}</span>
                    <button className="text-blue-400 hover:text-blue-600 p-0.5" onClick={() => openModal('grupo', g)}><Edit2 className="w-3 h-3" /></button>
                  </div>
                ))}
                {gruposDeLinea.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Sin grupos</p>}
              </div>
            )}
          </div>
        </div>
      </div>

      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-sm p-6">
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {editando ? 'Editar' : 'Nuevo'} {modal === 'marca' ? 'Marca' : modal === 'linea' ? 'Línea' : 'Grupo'}
              </h3>
              <button onClick={() => setModal(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div>
              <label className="label">Nombre *</label>
              <input className="input uppercase" value={formNombre} onChange={e => setFormNombre(e.target.value.toUpperCase())} placeholder="NOMBRE" autoFocus />
            </div>
            <div className="flex gap-3 mt-6">
              <button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancelar</button>
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
