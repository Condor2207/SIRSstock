import type { SupabaseClient } from '@supabase/supabase-js';
import { roundTo, DECIMALES_CANTIDAD } from '@/lib/utils';

interface MoverStockParams {
  productoId: string;
  delta: number; // positivo = entrada, negativo = salida
  tipo: 'entrada' | 'salida' | 'ajuste' | 'produccion' | 'devolucion';
  referenciaTipo: string;
  referenciaId?: string | null;
  notas?: string | null;
  // Productos genéricos: sin lote ni vencimiento (solo se mueve el stock total)
  loteId?: string | null;
  numeroLote?: string | null;
  fechaVencimiento?: string | null;
}

// Actualiza stock total, lote (si corresponde) y registra el movimiento. Soporta decimales (3).
export async function moverStock(supabase: SupabaseClient, p: MoverStockParams) {
  const { data: prod, error } = await supabase.from('productos').select('stock_actual').eq('id', p.productoId).single();
  if (error || !prod) throw error || new Error('Producto no encontrado');
  const anterior = Number(prod.stock_actual) || 0;
  const posterior = roundTo(anterior + p.delta, DECIMALES_CANTIDAD);
  if (posterior < 0) throw new Error('Stock insuficiente para completar la operación');

  let loteId = p.loteId || null;
  if (loteId || p.numeroLote) {
    const query = supabase.from('lotes').select('id, stock_actual');
    const { data: lote } = loteId
      ? await query.eq('id', loteId).maybeSingle()
      : await query.eq('producto_id', p.productoId).eq('numero_lote', p.numeroLote as string).maybeSingle();
    if (lote) {
      const nuevo = roundTo(Number(lote.stock_actual) + p.delta, DECIMALES_CANTIDAD);
      if (nuevo < 0) throw new Error('Stock insuficiente en el lote seleccionado');
      const { error: upErr } = await supabase.from('lotes').update({ stock_actual: nuevo }).eq('id', lote.id);
      if (upErr) throw upErr;
      loteId = lote.id;
    } else if (p.numeroLote && p.delta > 0) {
      const { data: nuevoLote, error: insErr } = await supabase.from('lotes').insert({
        producto_id: p.productoId, numero_lote: p.numeroLote, fecha_vencimiento: p.fechaVencimiento || null,
        stock_actual: p.delta, stock_inicial: p.delta,
      }).select('id').single();
      if (insErr) throw insErr;
      loteId = nuevoLote.id;
    }
  }

  const { error: stockErr } = await supabase.from('productos').update({ stock_actual: posterior }).eq('id', p.productoId);
  if (stockErr) throw stockErr;
  const { error: movErr } = await supabase.from('movimientos_stock').insert({
    producto_id: p.productoId, lote_id: loteId, tipo: p.tipo, cantidad: p.delta,
    referencia_tipo: p.referenciaTipo, referencia_id: p.referenciaId || null,
    saldo_anterior: anterior, saldo_posterior: posterior, notas: p.notas || null,
  });
  if (movErr) throw movErr;
  return { loteId, posterior };
}
