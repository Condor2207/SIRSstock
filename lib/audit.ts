'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

const AUDIT_SESSION_KEY = 'sirs_audit_session_id';

export interface AuditPayload {
  modulo: string;
  entidad: string;
  accion: string;
  descripcion: string;
  registroId?: string | null;
  detalles?: Record<string, unknown>;
}

function getSessionId() {
  if (typeof window === 'undefined') return 'server';

  const current = window.sessionStorage.getItem(AUDIT_SESSION_KEY);
  if (current) return current;

  const created = crypto.randomUUID();
  window.sessionStorage.setItem(AUDIT_SESSION_KEY, created);
  return created;
}

export async function logAudit(supabase: SupabaseClient, payload: AuditPayload) {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      console.error('No se pudo obtener el usuario para auditoría:', authError.message);
      return;
    }

    const { error: insertError } = await supabase.from('auditoria_logs').insert({
      user_id: user?.id ?? null,
      user_email: user?.email ?? null,
      session_id: getSessionId(),
      modulo: payload.modulo,
      entidad: payload.entidad,
      accion: payload.accion,
      descripcion: payload.descripcion,
      registro_id: payload.registroId ?? null,
      detalles: payload.detalles ?? {},
    });

    if (insertError) {
      console.error('No se pudo insertar el log de auditoría:', insertError.message);
    }
  } catch (error) {
    console.error('No se pudo registrar la auditoría', error);
  }
}
