'use client';

import type { SupabaseClient } from '@supabase/supabase-js';

export const COMPROBANTE_BUCKET = 'comprobantes';
export const COMPROBANTE_MAX_BYTES = 10 * 1024 * 1024;
export const COMPROBANTE_TIPOS = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];

export function validarArchivoComprobante(file: File): string | null {
  if (!COMPROBANTE_TIPOS.includes(file.type)) return 'El comprobante debe ser una imagen (JPG, PNG, WEBP) o un PDF';
  if (file.size > COMPROBANTE_MAX_BYTES) return 'El archivo del comprobante no puede superar los 10 MB';
  return null;
}

export async function subirComprobante(supabase: SupabaseClient, file: File, carpeta: string): Promise<string> {
  const ext = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const path = `${carpeta}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(COMPROBANTE_BUCKET).upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return path;
}

export async function abrirComprobante(supabase: SupabaseClient, path: string) {
  const { data, error } = await supabase.storage.from(COMPROBANTE_BUCKET).createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error || new Error('No se pudo abrir el comprobante');
  window.open(data.signedUrl, '_blank', 'noopener');
}
