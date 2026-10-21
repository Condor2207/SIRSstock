import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, parseISO, differenceInDays } from 'date-fns';
import { es } from 'date-fns/locale';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Formatear moneda paraguaya (Guaraní - PYG, sin decimales)
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('es-PY', {
    style: 'currency',
    currency: 'PYG',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Math.round(amount));
}

// Formatear número
export function formatNumber(num: number, decimals = 0): string {
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
}

// Normalizar inputs numéricos a enteros
export function toIntegerInput(value: string): string {
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return '';
  const numeric = Number(normalized);
  if (Number.isFinite(numeric)) return String(Math.round(numeric));
  return normalized.replace(/\D+/g, '');
}

// Convertir cualquier valor numérico a entero
export function toInteger(value: string | number, fallback = 0): number {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : fallback;
  const normalized = String(value ?? '').trim().replace(',', '.');
  if (!normalized) return fallback;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? Math.round(numeric) : fallback;
}

// Mantener solo dígitos para campos de identificación numérica
export function toDigitsOnly(value: string): string {
  return (value || '').replace(/\D+/g, '');
}

// Formatear fecha
export function formatDate(date: string | Date, fmt = 'dd/MM/yyyy'): string {
  if (!date) return '-';
  try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    return format(d, fmt, { locale: es });
  } catch {
    return String(date);
  }
}

// Formatear fecha y hora
export function formatDateTime(date: string | Date): string {
  return formatDate(date, 'dd/MM/yyyy HH:mm');
}

// Días hasta vencimiento
export function diasHastaVencimiento(fecha: string): number {
  if (!fecha) return 9999;
  try {
    return differenceInDays(parseISO(fecha), new Date());
  } catch {
    return 9999;
  }
}

// Estado de vencimiento
export function estadoVencimiento(fecha?: string): {
  label: string;
  color: string;
  urgent: boolean;
} {
  if (!fecha) return { label: 'Sin vencimiento', color: 'text-gray-500', urgent: false };
  const dias = diasHastaVencimiento(fecha);
  if (dias < 0) return { label: `Vencido hace ${Math.abs(dias)}d`, color: 'text-red-600', urgent: true };
  if (dias <= 30) return { label: `Vence en ${dias}d`, color: 'text-red-500', urgent: true };
  if (dias <= 90) return { label: `Vence en ${dias}d`, color: 'text-yellow-600', urgent: false };
  return { label: formatDate(fecha), color: 'text-green-600', urgent: false };
}

// Generar número de documento (venta, compra, etc.)
export function generarNumero(prefijo: string, correlativo: number): string {
  return `${prefijo}-${String(correlativo).padStart(5, '0')}`;
}

// Calcular cuotas
export function calcularCuotas(
  total: number,
  cantidadCuotas: number,
  plazoDias: number,
  fechaInicio: Date = new Date()
): Array<{ numero: number; fecha_vencimiento: string; monto: number }> {
  const totalEntero = Math.round(total);
  const montoCuota = Math.round(totalEntero / cantidadCuotas);
  const cuotas = [];
  for (let i = 1; i <= cantidadCuotas; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + plazoDias * i);
    cuotas.push({
      numero: i,
      fecha_vencimiento: format(fecha, 'yyyy-MM-dd'),
      monto: i === cantidadCuotas ? totalEntero - montoCuota * (cantidadCuotas - 1) : montoCuota,
    });
  }
  return cuotas;
}

// Validar RUC paraguayo (6 a 8 dígitos + guion + dígito verificador)
export function validarRucParaguayo(ruc: string): boolean {
  return /^\d{6,8}-\d$/.test((ruc || '').trim());
}

// Badge de estado
export function estadoBadgeClass(estado: string): string {
  const map: Record<string, string> = {
    pendiente: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
    pagado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    parcial: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
    anulado: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
    confirmado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    borrador: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
    contado: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
    credito: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
    vencido: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  };
  return map[estado] || 'bg-gray-100 text-gray-800';
}

// Porcentaje de uso de crédito
export function porcentajeCredito(saldo: number, limite: number): number {
  if (limite === 0) return 0;
  return Math.min(100, (saldo / limite) * 100);
}

export function getErrorMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    return String((error as { message?: unknown }).message || '');
  }
  return '';
}

export function isForeignKeyConstraintError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = 'code' in error ? String((error as { code?: unknown }).code || '') : '';
  if (code === '23503') return true;
  const message = getErrorMessage(error).toLowerCase();
  return message.includes('foreign key') || message.includes('violates foreign key');
}

export function getDeleteErrorMessage(error: unknown, entityLabel: string): string {
  if (isForeignKeyConstraintError(error)) {
    return `No se puede eliminar ${entityLabel} porque tiene registros asociados.`;
  }
  return getErrorMessage(error) || `No se pudo eliminar ${entityLabel}.`;
}

// Detecta errores de Supabase/PostgREST causados por columnas o tablas faltantes
// en el schema cache. Si se pasan refs, solo devuelve true cuando el mensaje
// también menciona alguna de esas referencias.
export function isSchemaCacheMissing(error: unknown, refs: string[] = []): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (!message) return false;
  const mentionsSchemaCache = message.includes('schema cache') || message.includes('could not find');
  if (!mentionsSchemaCache) return false;
  if (refs.length === 0) return true;
  return refs.some(ref => {
    const escaped = ref.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(^|[^a-z0-9_])${escaped}([^a-z0-9_]|$)`).test(message);
  });
}

// ============================================================
// Número de factura: formato 001-001-1234567 (3-3-7 dígitos)
// ============================================================
export const FACTURA_REGEX = /^\d{3}-\d{3}-\d{7}$/;

export function esNumeroFacturaValido(value: string): boolean {
  return FACTURA_REGEX.test((value || '').trim());
}

// Aplica máscara mientras se escribe: 001001 1234567 -> 001-001-1234567
export function maskNumeroFactura(value: string): string {
  const d = toDigitsOnly(value).slice(0, 13);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

// Muestra un número de factura. Los números con formato anterior se
// conservan tal cual; los de 13 dígitos se formatean sin alterar el dato guardado.
export function formatNumeroFactura(value?: string | null, puntoVenta?: string | null): string {
  if (!value) return '';
  const v = String(value).trim();
  if (FACTURA_REGEX.test(v)) return v;
  const d = toDigitsOnly(v);
  if (d.length === 13 && d === v) return maskNumeroFactura(d);
  if (puntoVenta && /^\d{3}-\d{3}$/.test(puntoVenta) && /^\d{1,7}$/.test(v)) {
    return `${puntoVenta}-${v.padStart(7, '0')}`;
  }
  return v;
}

// ============================================================
// Código de barras EAN-13 (estándar GS1, imprimible/compatible con lectores)
// Prefijo 200-299 reservado por GS1 para uso interno/restringido.
// ============================================================
export function ean13CheckDigit(first12: string): number {
  let sum = 0;
  for (let i = 0; i < 12; i++) sum += Number(first12[i]) * (i % 2 === 0 ? 1 : 3);
  return (10 - (sum % 10)) % 10;
}

export function esEan13Valido(code: string): boolean {
  return /^\d{13}$/.test(code) && ean13CheckDigit(code.slice(0, 12)) === Number(code[12]);
}

export function generarEan13(): string {
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  const body = '20' + String((arr[0] * 4294967296 + arr[1]) % 10000000000).padStart(10, '0');
  return body + ean13CheckDigit(body);
}

// Patrones EAN-13 para dibujar el código en SVG
const EAN_L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
const EAN_G = ['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'];
const EAN_R = ['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100'];
const EAN_PARITY = ['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];

export function ean13Bits(code: string): string | null {
  if (!esEan13Valido(code)) return null;
  const parity = EAN_PARITY[Number(code[0])];
  let bits = '101';
  for (let i = 0; i < 6; i++) {
    const d = Number(code[i + 1]);
    bits += parity[i] === 'L' ? EAN_L[d] : EAN_G[d];
  }
  bits += '01010';
  for (let i = 7; i < 13; i++) bits += EAN_R[Number(code[i])];
  return bits + '101';
}

// SVG (string) del código de barras para vista/impresión. null si no es EAN-13 válido.
export function ean13Svg(code: string, height = 60): string | null {
  const bits = ean13Bits(code);
  if (!bits) return null;
  const w = 2;
  const margin = 10 * w;
  const total = bits.length * w + margin * 2;
  let rects = '';
  for (let i = 0; i < bits.length; i++) {
    if (bits[i] === '1') rects += `<rect x="${margin + i * w}" y="0" width="${w}" height="${height}" fill="#000"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${total}" height="${height + 16}" viewBox="0 0 ${total} ${height + 16}"><rect width="100%" height="100%" fill="#fff"/>${rects}<text x="${total / 2}" y="${height + 13}" font-family="monospace" font-size="12" text-anchor="middle">${code}</text></svg>`;
}

// Estado de una deuda por factura
export function estadoDeuda(total: number, pagado: number, fechaVencimiento?: string | null): 'pagada' | 'parcial' | 'vencida' | 'pendiente' {
  const saldo = Math.round(total) - Math.round(pagado);
  if (saldo <= 0) return 'pagada';
  const vencida = !!fechaVencimiento && diasHastaVencimiento(fechaVencimiento) < 0;
  if (vencida) return 'vencida';
  return pagado > 0 ? 'parcial' : 'pendiente';
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c] as string));
}

export function formatMonto(amount: number, moneda: 'GS' | 'USD' | string = 'GS'): string {
  if (moneda === 'USD') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  }
  return formatCurrency(amount);
}
