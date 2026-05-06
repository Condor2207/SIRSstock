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
export function formatNumber(num: number, decimals = 2): string {
  return new Intl.NumberFormat('es-PY', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(num);
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
  const montoCuota = Math.round((total / cantidadCuotas) * 100) / 100;
  const cuotas = [];
  for (let i = 1; i <= cantidadCuotas; i++) {
    const fecha = new Date(fechaInicio);
    fecha.setDate(fecha.getDate() + plazoDias * i);
    cuotas.push({
      numero: i,
      fecha_vencimiento: format(fecha, 'yyyy-MM-dd'),
      monto: i === cantidadCuotas ? total - montoCuota * (cantidadCuotas - 1) : montoCuota,
    });
  }
  return cuotas;
}

// Validar CUIT argentino (básico)
export function validarCuit(cuit: string): boolean {
  const clean = cuit.replace(/[-\s]/g, '');
  return /^\d{11}$/.test(clean);
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
