import type { SupabaseClient } from '@supabase/supabase-js';
import { roundTo } from '@/lib/utils';

export interface VentaCuotaAplicada {
  cuota_id: string;
  monto: number;
}

export async function aplicarCreditoAVenta(
  supabase: SupabaseClient,
  ventaId: string,
  clienteId: string,
  monto: number,
): Promise<{ aplicado: number; detalle: VentaCuotaAplicada[] }> {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select('id, cliente_id, total, saldo_pendiente, estado')
    .eq('id', ventaId)
    .single();
  if (error) throw error;
  if (venta.cliente_id !== clienteId) throw new Error('La venta seleccionada pertenece a otro cliente');
  if (venta.estado === 'anulado') throw new Error('No se puede asociar una NC a una venta anulada');

  const aplicado = roundTo(Math.min(Math.max(0, monto), Number(venta.saldo_pendiente) || 0), 2);
  if (aplicado <= 0) return { aplicado: 0, detalle: [] };

  const { data: cuotas, error: cuotasError } = await supabase
    .from('venta_cuotas')
    .select('id, monto, monto_pagado, estado')
    .eq('venta_id', ventaId)
    .neq('estado', 'anulada')
    .order('numero_cuota');
  if (cuotasError) throw cuotasError;

  let restante = aplicado;
  const detalle: VentaCuotaAplicada[] = [];
  for (const cuota of cuotas || []) {
    if (restante <= 0) break;
    const pendiente = roundTo(Math.max(0, Number(cuota.monto) - Number(cuota.monto_pagado)), 2);
    const aplicar = roundTo(Math.min(restante, pendiente), 2);
    if (aplicar <= 0) continue;
    const pagado = roundTo(Number(cuota.monto_pagado) + aplicar, 2);
    const estado = pagado >= Number(cuota.monto) ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';
    const { error: cuotaError } = await supabase.from('venta_cuotas').update({ monto_pagado: pagado, estado }).eq('id', cuota.id);
    if (cuotaError) throw cuotaError;
    detalle.push({ cuota_id: cuota.id, monto: aplicar });
    restante = roundTo(restante - aplicar, 2);
  }

  const nuevoSaldo = roundTo(Math.max(0, Number(venta.saldo_pendiente) - aplicado), 2);
  const { error: ventaError } = await supabase.from('ventas').update({
    saldo_pendiente: nuevoSaldo,
    estado: nuevoSaldo === 0 ? 'pagado' : 'parcial',
  }).eq('id', ventaId);
  if (ventaError) throw ventaError;

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('saldo_pendiente')
    .eq('id', clienteId)
    .single();
  if (clienteError) throw clienteError;
  const { error: saldoError } = await supabase.from('clientes')
    .update({ saldo_pendiente: roundTo(Math.max(0, Number(cliente.saldo_pendiente) - aplicado), 2) })
    .eq('id', clienteId);
  if (saldoError) throw saldoError;

  return { aplicado, detalle };
}

export async function revertirCreditoVenta(
  supabase: SupabaseClient,
  ventaId: string,
  monto: number,
  detalle: VentaCuotaAplicada[],
) {
  const { data: venta, error } = await supabase
    .from('ventas')
    .select('total, saldo_pendiente, cliente_id')
    .eq('id', ventaId)
    .single();
  if (error) throw error;

  for (const aplicado of detalle) {
    const { data: cuota, error: cuotaError } = await supabase
      .from('venta_cuotas')
      .select('monto, monto_pagado, estado')
      .eq('id', aplicado.cuota_id)
      .maybeSingle();
    if (cuotaError) throw cuotaError;
    if (!cuota) continue;
    const pagado = roundTo(Math.max(0, Number(cuota.monto_pagado) - aplicado.monto), 2);
    const estado = cuota.estado === 'anulada' ? 'anulada' : pagado >= Number(cuota.monto) ? 'pagado' : pagado > 0 ? 'parcial' : 'pendiente';
    const { error: updateError } = await supabase.from('venta_cuotas').update({ monto_pagado: pagado, estado }).eq('id', aplicado.cuota_id);
    if (updateError) throw updateError;
  }

  const nuevoSaldo = roundTo(Math.min(Number(venta.total), Number(venta.saldo_pendiente) + monto), 2);
  const { error: ventaError } = await supabase.from('ventas').update({
    saldo_pendiente: nuevoSaldo,
    estado: nuevoSaldo === Number(venta.total) ? 'pendiente' : nuevoSaldo > 0 ? 'parcial' : 'pagado',
  }).eq('id', ventaId);
  if (ventaError) throw ventaError;

  const { data: cliente, error: clienteError } = await supabase
    .from('clientes')
    .select('saldo_pendiente')
    .eq('id', venta.cliente_id)
    .single();
  if (clienteError) throw clienteError;
  const { error: saldoError } = await supabase.from('clientes')
    .update({ saldo_pendiente: roundTo(Number(cliente.saldo_pendiente) + monto, 2) })
    .eq('id', venta.cliente_id);
  if (saldoError) throw saldoError;
}
