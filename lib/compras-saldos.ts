import type { SupabaseClient } from '@supabase/supabase-js';
import { roundMoneda } from '@/lib/utils';

export function estadoCompraPorSaldo(total: number, saldo: number, moneda: string): 'pendiente' | 'parcial' | 'pagado' {
  const s = roundMoneda(saldo, moneda);
  if (s <= 0) return 'pagado';
  if (s >= roundMoneda(total, moneda)) return 'pendiente';
  return 'parcial';
}

export interface DetalleCuotaAplicada { cuota_id: string; monto: number }

// Aplica un crédito (nota de crédito) al saldo de una compra y a sus cuotas, de la más antigua a la más nueva.
export async function aplicarCreditoACompra(supabase: SupabaseClient, compraId: string, monto: number) {
  const { data: compra, error } = await supabase.from('compras')
    .select('id, total, saldo_pendiente, moneda, estado, compra_cuotas(id, monto, monto_pagado, estado, fecha_vencimiento, numero_cuota)')
    .eq('id', compraId).single();
  if (error || !compra) throw error || new Error('Compra no encontrada');
  const moneda = compra.moneda || 'GS';
  const aplicable = Math.min(roundMoneda(monto, moneda), Number(compra.saldo_pendiente) || 0);
  if (aplicable <= 0) return { aplicado: 0, detalle: [] as DetalleCuotaAplicada[] };

  let restante = aplicable;
  const detalle: DetalleCuotaAplicada[] = [];
  const cuotas = ((compra as any).compra_cuotas || [])
    .filter((c: any) => c.estado !== 'anulada' && c.estado !== 'pagada')
    .sort((a: any, b: any) => (a.fecha_vencimiento || '').localeCompare(b.fecha_vencimiento || '') || a.numero_cuota - b.numero_cuota);
  for (const c of cuotas) {
    if (restante <= 0) break;
    const pendiente = roundMoneda(Number(c.monto) - Number(c.monto_pagado), moneda);
    const aplicar = Math.min(pendiente, restante);
    if (aplicar <= 0) continue;
    const pagado = roundMoneda(Number(c.monto_pagado) + aplicar, moneda);
    const { error: e } = await supabase.from('compra_cuotas').update({
      monto_pagado: pagado,
      estado: pagado >= Number(c.monto) ? 'pagada' : c.estado,
    }).eq('id', c.id);
    if (e) throw e;
    detalle.push({ cuota_id: c.id, monto: aplicar });
    restante = roundMoneda(restante - aplicar, moneda);
  }
  const nuevoSaldo = roundMoneda(Number(compra.saldo_pendiente) - aplicable, moneda);
  const { error: upErr } = await supabase.from('compras').update({
    saldo_pendiente: nuevoSaldo, estado: estadoCompraPorSaldo(Number(compra.total), nuevoSaldo, moneda),
  }).eq('id', compraId);
  if (upErr) throw upErr;
  return { aplicado: aplicable, detalle };
}

// Revierte una aplicación previa (anulación de la nota de crédito)
export async function revertirCreditoCompra(supabase: SupabaseClient, compraId: string, monto: number, detalle: DetalleCuotaAplicada[]) {
  const { data: compra, error } = await supabase.from('compras').select('id, total, saldo_pendiente, moneda').eq('id', compraId).single();
  if (error || !compra) throw error || new Error('Compra no encontrada');
  const moneda = compra.moneda || 'GS';
  for (const d of detalle) {
    const { data: c } = await supabase.from('compra_cuotas').select('id, monto, monto_pagado, estado').eq('id', d.cuota_id).maybeSingle();
    if (!c) continue;
    const pagado = Math.max(0, roundMoneda(Number(c.monto_pagado) - d.monto, moneda));
    await supabase.from('compra_cuotas').update({ monto_pagado: pagado, estado: c.estado === 'anulada' ? 'anulada' : 'pendiente', fecha_pago: null }).eq('id', c.id);
  }
  const nuevoSaldo = Math.min(Number(compra.total), roundMoneda(Number(compra.saldo_pendiente) + monto, moneda));
  const { error: upErr } = await supabase.from('compras').update({
    saldo_pendiente: nuevoSaldo, estado: estadoCompraPorSaldo(Number(compra.total), nuevoSaldo, moneda),
  }).eq('id', compraId);
  if (upErr) throw upErr;
}
