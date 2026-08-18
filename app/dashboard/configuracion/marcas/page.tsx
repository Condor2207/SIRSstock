'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { logAudit } from '@/lib/audit';
import { Plus, Edit2, Trash2, X, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import type { Marca, Linea, Grupo, MarcaLinea, MarcaGrupo } from '@/lib/types';

type Modal = null | 'marca' | 'linea' | 'grupo';
type Item = Marca | Linea | Grupo;

export default function MarcasPage() {
  const supabase = createClient();
  const [marcas, setMarcas] = useState<Marca[]>([]);
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [marcaLineas, setMarcaLineas] = useState<MarcaLinea[]>([]);
  const [marcaGrupos, setMarcaGrupos] = useState<MarcaGrupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [editando, setEditando] = useState<Item | null>(null);
  const [saving, setSaving] = useState(false);
  const [formNombre, setFormNombre] = useState('');
  const [lineasSeleccionadas, setLineasSeleccionadas] = useState<string[]>([]);
  const [gruposSeleccionados, setGruposSeleccionados] = useState<string[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [mRes, lRes, gRes, mlRes, mgRes] = await Promise.all([
      supabase.from('marcas').select('*').order('nombre'), supabase.from('lineas').select('*').order('nombre'),
      supabase.from('grupos').select('*').order('nombre'), supabase.from('marca_lineas').select('marca_id,linea_id'),
      supabase.from('marca_grupos').select('marca_id,grupo_id'),
    ]);
    setMarcas((mRes.data as Marca[]) || []); setLineas((lRes.data as Linea[]) || []); setGrupos((gRes.data as Grupo[]) || []);
    setMarcaLineas((mlRes.data as MarcaLinea[]) || []); setMarcaGrupos((mgRes.data as MarcaGrupo[]) || []); setLoading(false);
  }, [supabase]);
  useEffect(() => { load(); }, [load]);

  function openModal(tipo: Exclude<Modal, null>, item?: Item) {
    setModal(tipo); setEditando(item || null); setFormNombre(item?.nombre || '');
    setLineasSeleccionadas(tipo === 'marca' && item ? marcaLineas.filter(x => x.marca_id === item.id).map(x => x.linea_id) : []);
    setGruposSeleccionados(tipo === 'marca' && item ? marcaGrupos.filter(x => x.marca_id === item.id).map(x => x.grupo_id) : []);
  }
  const toggle = (ids: string[], id: string, setIds: (v: string[]) => void) => setIds(ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id]);

  async function guardarAsociaciones(marcaId: string) {
    const eliminados = await Promise.all([supabase.from('marca_lineas').delete().eq('marca_id', marcaId), supabase.from('marca_grupos').delete().eq('marca_id', marcaId)]);
    if (eliminados.find(r => r.error)?.error) throw eliminados.find(r => r.error)!.error;
    const operaciones = [];
    if (lineasSeleccionadas.length) operaciones.push(supabase.from('marca_lineas').insert(lineasSeleccionadas.map(linea_id => ({ marca_id: marcaId, linea_id }))));
    if (gruposSeleccionados.length) operaciones.push(supabase.from('marca_grupos').insert(gruposSeleccionados.map(grupo_id => ({ marca_id: marcaId, grupo_id }))));
    const resultados = await Promise.all(operaciones);
    if (resultados.find(r => r.error)?.error) throw resultados.find(r => r.error)!.error;
  }

  async function handleSave() {
    if (!modal || !formNombre.trim()) return toast.error('El nombre es obligatorio');
    setSaving(true); const nombre = formNombre.trim().toUpperCase(); const table = modal === 'marca' ? 'marcas' : modal === 'linea' ? 'lineas' : 'grupos';
    try {
      const { data, error } = editando ? await supabase.from(table).update({ nombre }).eq('id', editando.id).select('id').single() : await supabase.from(table).insert({ nombre }).select('id').single();
      if (error) throw error;
      const recordId = data?.id || editando?.id;
      if (modal === 'marca' && recordId) await guardarAsociaciones(recordId);
      await logAudit(supabase, { modulo: 'Configuración', entidad: modal === 'marca' ? 'Marca' : modal === 'linea' ? 'Línea' : 'Grupo', accion: editando ? 'editar' : 'crear', descripcion: `${editando ? 'Editó' : 'Creó'} ${nombre}`, registroId: recordId });
      toast.success(editando ? 'Actualizado' : 'Creado'); setModal(null); load();
    } catch (error: any) { toast.error(error.message || 'No se pudo guardar'); } finally { setSaving(false); }
  }
  async function handleDelete(tipo: Exclude<Modal, null>, item: Item) {
    if (!window.confirm(`¿Eliminar ${tipo} "${item.nombre}"?`)) return;
    const table = tipo === 'marca' ? 'marcas' : tipo === 'linea' ? 'lineas' : 'grupos'; const { error } = await supabase.from(table).delete().eq('id', item.id);
    if (error) return toast.error(error.message);
    await logAudit(supabase, { modulo: 'Configuración', entidad: tipo === 'marca' ? 'Marca' : tipo === 'linea' ? 'Línea' : 'Grupo', accion: 'borrar', descripcion: `Eliminó ${item.nombre}`, registroId: item.id });
    toast.success('Registro eliminado'); load();
  }
  const nombres = (ids: string[], items: { id: string; nombre: string }[]) => items.filter(item => ids.includes(item.id)).map(item => item.nombre).join(', ') || 'Sin asignar';
  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-blue-500" /></div>;

  return <div className="flex flex-col min-h-full"><Header title="Marcas / Líneas / Grupos" /><div className="p-4 md:p-6 space-y-5">
    <p className="text-sm text-gray-500 dark:text-gray-400">Cargá líneas y grupos una sola vez. Al crear una marca, seleccioná todas las líneas y grupos que le correspondan.</p>
    <div className="card overflow-hidden"><div className="flex items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700"><h3 className="font-semibold">Marcas y sus asignaciones</h3><button className="btn-primary text-xs py-1.5 px-2 flex gap-1 items-center" onClick={() => openModal('marca')}><Plus className="w-3 h-3" />Nueva marca</button></div><div className="divide-y divide-gray-100 dark:divide-gray-700">
      {marcas.map(marca => <div key={marca.id} className="p-4 flex flex-col md:flex-row md:items-center gap-3 justify-between"><div><p className="font-medium text-gray-900 dark:text-white">{marca.nombre}</p><p className="text-xs text-gray-500 mt-1"><b>Líneas:</b> {nombres(marcaLineas.filter(x => x.marca_id === marca.id).map(x => x.linea_id), lineas)}</p><p className="text-xs text-gray-500 mt-1"><b>Grupos:</b> {nombres(marcaGrupos.filter(x => x.marca_id === marca.id).map(x => x.grupo_id), grupos)}</p></div><div className="flex gap-2"><button className="btn-secondary text-xs py-1.5 px-2" onClick={() => openModal('marca', marca)}><Edit2 className="w-3 h-3 inline mr-1" />Editar</button><button className="text-red-500 p-2" onClick={() => handleDelete('marca', marca)}><Trash2 className="w-4 h-4" /></button></div></div>)}
      {!marcas.length && <p className="p-6 text-center text-sm text-gray-400">Sin marcas cargadas</p>}</div></div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5"><Catalogo titulo="Líneas" items={lineas} onNew={() => openModal('linea')} onEdit={item => openModal('linea', item)} onDelete={item => handleDelete('linea', item)} /><Catalogo titulo="Grupos" items={grupos} onNew={() => openModal('grupo')} onEdit={item => openModal('grupo', item)} onDelete={item => handleDelete('grupo', item)} /></div>
  </div>{modal && <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"><div className="bg-white dark:bg-gray-900 rounded-xl shadow-xl w-full max-w-2xl p-6 max-h-[90vh] overflow-y-auto"><div className="flex justify-between items-center mb-5"><h3 className="font-semibold">{editando ? 'Editar' : 'Nueva'} {modal}</h3><button onClick={() => setModal(null)}><X className="w-5 h-5 text-gray-400" /></button></div><label className="label">Nombre *</label><input className="input uppercase" value={formNombre} onChange={e => setFormNombre(e.target.value.toUpperCase())} placeholder="NOMBRE" autoFocus />
    {modal === 'marca' && <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-5"><SelectorMultiple titulo="Líneas de esta marca" items={lineas} selected={lineasSeleccionadas} onToggle={id => toggle(lineasSeleccionadas, id, setLineasSeleccionadas)} /><SelectorMultiple titulo="Grupos de esta marca" items={grupos} selected={gruposSeleccionados} onToggle={id => toggle(gruposSeleccionados, id, setGruposSeleccionados)} /></div>}
    <div className="flex gap-3 mt-6"><button className="btn-secondary flex-1" onClick={() => setModal(null)}>Cancelar</button><button className="btn-primary flex-1 flex justify-center gap-2" onClick={handleSave} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}Guardar</button></div></div></div>}</div>;
}

function SelectorMultiple({ titulo, items, selected, onToggle }: { titulo: string; items: { id: string; nombre: string }[]; selected: string[]; onToggle: (id: string) => void }) { return <div><p className="label">{titulo} <span className="text-gray-400 font-normal">(selección múltiple)</span></p><div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-52 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">{items.map(item => <label key={item.id} className="flex items-center gap-2 px-3 py-2 text-sm cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"><input type="checkbox" className="accent-blue-600" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />{item.nombre}</label>)}{!items.length && <p className="p-3 text-xs text-gray-400">Primero cargá opciones en el catálogo.</p>}</div></div>; }
function Catalogo({ titulo, items, onNew, onEdit, onDelete }: { titulo: string; items: (Linea | Grupo)[]; onNew: () => void; onEdit: (item: Linea | Grupo) => void; onDelete: (item: Linea | Grupo) => void }) { return <div className="card p-4"><div className="flex justify-between items-center mb-3"><h3 className="font-semibold text-sm">{titulo}</h3><button className="btn-primary text-xs py-1 px-2 flex gap-1 items-center" onClick={onNew}><Plus className="w-3 h-3" />Nuevo</button></div><div className="space-y-1">{items.map(item => <div key={item.id} className="flex justify-between items-center px-3 py-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800"><span className="text-sm">{item.nombre}</span><span className="flex gap-2"><button className="text-blue-500" onClick={() => onEdit(item)}><Edit2 className="w-3.5 h-3.5" /></button><button className="text-red-500" onClick={() => onDelete(item)}><Trash2 className="w-3.5 h-3.5" /></button></span></div>)}{!items.length && <p className="text-xs text-gray-400 text-center py-3">Sin registros</p>}</div></div>; }
