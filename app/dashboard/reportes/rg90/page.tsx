'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { FileSpreadsheet, Printer, Download, Loader2, ChevronLeft } from 'lucide-react';
import Link from 'next/link';

interface RG90Row {
  id: string;
  fecha: string;
  timbrado: string | null;
  punto_venta: string | null;
  numero_factura: string | null;
  ruc_comprador: string | null;
  nombre_comprador: string;
  condicion: string;
  tasa_iva: number;
  total: number;
  // calculados
  gravado_10: number;
  gravado_5: number;
  exento: number;
  iva_10: number;
  iva_5: number;
}

function calcularIVA(total: number, tasa: number) {
  if (tasa === 10) {
    const gravado_10 = Math.round((total * 100) / 110);
    const iva_10 = total - gravado_10;
    return { gravado_10, gravado_5: 0, exento: 0, iva_10, iva_5: 0 };
  }
  if (tasa === 5) {
    const gravado_5 = Math.round((total * 100) / 105);
    const iva_5 = total - gravado_5;
    return { gravado_10: 0, gravado_5, exento: 0, iva_10: 0, iva_5 };
  }
  return { gravado_10: 0, gravado_5: 0, exento: total, iva_10: 0, iva_5: 0 };
}

function formatGs(v: number) {
  if (v === 0) return '—';
  return v.toLocaleString('es-PY');
}

function padNro(pv: string | null, nf: string | null) {
  if (!pv && !nf) return '—';
  const p = (pv || '001').padStart(3, '0');
  const n = (nf || '').padStart(7, '0');
  return `${p}-${n}`;
}

const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

export default function RG90Page() {
  const supabase = createClient();
  const hoy = new Date();

  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [rows, setRows] = useState<RG90Row[]>([]);
  const [loading, setLoading] = useState(false);
  // Datos de la empresa (para el encabezado del informe)
  const [rucEmpresa, setRucEmpresa] = useState('');
  const [nombreEmpresa, setNombreEmpresa] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    const desde = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const hasta = new Date(anio, mes, 0).toISOString().split('T')[0]; // último día del mes

    const { data, error } = await supabase
      .from('ventas')
      .select('id, fecha, timbrado, punto_venta, numero_factura, condicion_pago, total, tasa_iva, clientes(nombre, documento)')
      .gte('fecha', desde)
      .lte('fecha', hasta + 'T23:59:59')
      .neq('estado', 'anulado')
      .order('fecha', { ascending: true });

    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }

    const resultado: RG90Row[] = (data || []).map((v: any) => {
      const tasa = v.tasa_iva ?? 10;
      const iva = calcularIVA(v.total, tasa);
      return {
        id: v.id,
        fecha: v.fecha?.slice(0, 10) ?? '',
        timbrado: v.timbrado,
        punto_venta: v.punto_venta,
        numero_factura: v.numero_factura,
        ruc_comprador: v.clientes?.documento ?? null,
        nombre_comprador: v.clientes?.nombre ?? '—',
        condicion: v.condicion_pago === 'contado' ? 'CO' : 'CR',
        tasa_iva: tasa,
        total: v.total,
        ...iva,
      };
    });

    setRows(resultado);
    setLoading(false);
  }, [mes, anio]);

  useEffect(() => { loadData(); }, [loadData]);

  // Totales
  const totales = rows.reduce(
    (acc, r) => ({
      gravado_10: acc.gravado_10 + r.gravado_10,
      gravado_5: acc.gravado_5 + r.gravado_5,
      exento: acc.exento + r.exento,
      total: acc.total + r.total,
      iva_10: acc.iva_10 + r.iva_10,
      iva_5: acc.iva_5 + r.iva_5,
    }),
    { gravado_10: 0, gravado_5: 0, exento: 0, total: 0, iva_10: 0, iva_5: 0 }
  );

  function imprimir() {
    const periodoStr = `${MESES[mes - 1]} ${anio}`;
    const encabezado = `
      <div class="header">
        <div class="empresa-info">
          <div class="titulo">REGISTRO DE COMPROBANTES DE VENTA</div>
          <div class="subtitulo">RG N° 90 — DNIT Paraguay</div>
          <table class="info-table">
            <tr><td><strong>RUC:</strong></td><td>${rucEmpresa || '________________'}</td></tr>
            <tr><td><strong>Razón Social:</strong></td><td>${nombreEmpresa || '________________________________'}</td></tr>
            <tr><td><strong>Período:</strong></td><td>${periodoStr}</td></tr>
          </table>
        </div>
      </div>
    `;

    const filas = rows.map((r, i) => `
      <tr class="${i % 2 === 0 ? 'par' : 'impar'}">
        <td class="center">${i + 1}</td>
        <td class="center">${r.fecha}</td>
        <td class="center">${r.timbrado || '—'}</td>
        <td class="center">${padNro(r.punto_venta, r.numero_factura)}</td>
        <td class="center">${r.ruc_comprador || '—'}</td>
        <td>${r.nombre_comprador}</td>
        <td class="center">${r.condicion}</td>
        <td class="right">${formatGs(r.gravado_10)}</td>
        <td class="right">${formatGs(r.gravado_5)}</td>
        <td class="right">${formatGs(r.exento)}</td>
        <td class="right total-col">${formatGs(r.total)}</td>
        <td class="right">${formatGs(r.iva_10)}</td>
        <td class="right">${formatGs(r.iva_5)}</td>
      </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <title>RG90 — ${periodoStr}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #000; padding: 8mm 10mm; }
    .header { margin-bottom: 12px; }
    .titulo { font-size: 13px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; }
    .subtitulo { font-size: 10px; color: #555; margin-bottom: 8px; }
    .info-table td { padding: 2px 8px 2px 0; font-size: 10px; }
    table.rg90 { width: 100%; border-collapse: collapse; margin-top: 6px; }
    table.rg90 thead tr { background: #1a2e4a; color: #fff; }
    table.rg90 thead th { padding: 5px 4px; text-align: center; font-size: 8px; border: 1px solid #aaa; white-space: nowrap; }
    table.rg90 tbody td { padding: 3px 4px; border: 1px solid #ccc; font-size: 8.5px; }
    .par { background: #f7f9fc; }
    .impar { background: #fff; }
    .center { text-align: center; }
    .right { text-align: right; }
    .total-col { font-weight: bold; }
    .footer-row td { background: #1a2e4a; color: #fff; font-weight: bold; font-size: 9px; padding: 5px 4px; border: 1px solid #aaa; }
    .pie { margin-top: 30px; display: flex; justify-content: space-between; font-size: 9px; }
    .firma { text-align: center; }
    .firma-line { border-top: 1px solid #000; min-width: 160px; padding-top: 4px; margin-top: 40px; }
    @media print { @page { margin: 8mm; size: A4 landscape; } }
  </style>
</head>
<body>
  ${encabezado}
  <table class="rg90">
    <thead>
      <tr>
        <th style="width:28px">N°</th>
        <th style="width:70px">Fecha</th>
        <th style="width:62px">Timbrado</th>
        <th style="width:72px">N° Comprobante</th>
        <th style="width:72px">RUC/CI<br>Comprador</th>
        <th>Nombre / Razón Social Comprador</th>
        <th style="width:28px">Cond.</th>
        <th style="width:72px">Gravado<br>10%</th>
        <th style="width:72px">Gravado<br>5%</th>
        <th style="width:72px">Exento</th>
        <th style="width:80px">Total<br>Comprobante</th>
        <th style="width:65px">IVA<br>10%</th>
        <th style="width:65px">IVA<br>5%</th>
      </tr>
    </thead>
    <tbody>
      ${filas}
    </tbody>
    <tfoot>
      <tr class="footer-row">
        <td colspan="7" class="right">TOTALES</td>
        <td class="right">${totales.gravado_10.toLocaleString('es-PY')}</td>
        <td class="right">${totales.gravado_5.toLocaleString('es-PY')}</td>
        <td class="right">${totales.exento.toLocaleString('es-PY')}</td>
        <td class="right">${totales.total.toLocaleString('es-PY')}</td>
        <td class="right">${totales.iva_10.toLocaleString('es-PY')}</td>
        <td class="right">${totales.iva_5.toLocaleString('es-PY')}</td>
      </tr>
    </tfoot>
  </table>
  <div class="pie">
    <div class="firma">
      <div class="firma-line">Firma y Aclaración Responsable</div>
    </div>
    <div style="font-size:8px;color:#666;align-self:flex-end">
      Generado: ${new Date().toLocaleString('es-PY')}
    </div>
  </div>
</body>
</html>`;

    const w = window.open('', '_blank', 'width=1200,height=800');
    if (w) {
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 600);
    }
  }

  function exportarCSV() {
    const periodoStr = `${String(mes).padStart(2, '0')}_${anio}`;
    const headers = [
      'N°', 'Fecha', 'Timbrado', 'N° Comprobante',
      'RUC/CI Comprador', 'Nombre Comprador', 'Cond.',
      'Gravado 10%', 'Gravado 5%', 'Exento', 'Total',
      'IVA 10%', 'IVA 5%',
    ];

    const csvRows = rows.map((r, i) => [
      i + 1,
      r.fecha,
      r.timbrado ?? '',
      padNro(r.punto_venta, r.numero_factura),
      r.ruc_comprador ?? '',
      `"${r.nombre_comprador.replace(/"/g, '""')}"`,
      r.condicion,
      r.gravado_10,
      r.gravado_5,
      r.exento,
      r.total,
      r.iva_10,
      r.iva_5,
    ].join(';'));

    const totalesRow = [
      '', '', '', '', '', '', 'TOTALES',
      totales.gravado_10, totales.gravado_5, totales.exento,
      totales.total, totales.iva_10, totales.iva_5,
    ].join(';');

    const csv = [headers.join(';'), ...csvRows, totalesRow].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `RG90_${periodoStr}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const aniosDisponibles = Array.from({ length: 5 }, (_, i) => hoy.getFullYear() - i);

  return (
    <>
      <Header
        title="RG90 — Registro de Comprobantes de Venta"
        subtitle="Informe fiscal periódico DNIT Paraguay"
      />
      <div className="p-6 space-y-5">
        <Link
          href="/dashboard/reportes"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
        >
          <ChevronLeft className="w-4 h-4" /> Volver a Reportes
        </Link>

        {/* Controles */}
        <div className="card p-5">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Período */}
            <div>
              <label className="label">Mes</label>
              <select className="input" value={mes} onChange={e => setMes(parseInt(e.target.value))}>
                {MESES.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Año</label>
              <select className="input" value={anio} onChange={e => setAnio(parseInt(e.target.value))}>
                {aniosDisponibles.map(a => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
            </div>
            {/* Empresa */}
            <div>
              <label className="label">RUC de la empresa</label>
              <input
                className="input"
                placeholder="80012345-6"
                value={rucEmpresa}
                onChange={e => setRucEmpresa(e.target.value)}
              />
            </div>
            <div>
              <label className="label">Razón Social</label>
              <input
                className="input"
                placeholder="EDULCORANTES S.A."
                value={nombreEmpresa}
                onChange={e => setNombreEmpresa(e.target.value)}
              />
            </div>
          </div>

          {/* Acciones */}
          <div className="flex flex-wrap gap-3 mt-4 pt-4 border-t border-gray-100 dark:border-gray-700">
            <button
              onClick={imprimir}
              disabled={loading || rows.length === 0}
              className="btn-primary flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              Imprimir RG90
            </button>
            <button
              onClick={exportarCSV}
              disabled={loading || rows.length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-lg border border-emerald-600 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 font-medium text-sm transition-colors disabled:opacity-40"
            >
              <Download className="w-4 h-4" />
              Exportar CSV
            </button>
            {rows.length > 0 && (
              <span className="ml-auto self-center text-sm text-gray-500">
                {rows.length} comprobante{rows.length !== 1 ? 's' : ''} — Total: <strong>Gs. {totales.total.toLocaleString('es-PY')}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Resumen de totales */}
        {rows.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Gravado 10%', value: totales.gravado_10, color: 'blue' },
              { label: 'IVA 10%', value: totales.iva_10, color: 'indigo' },
              { label: 'Gravado 5%', value: totales.gravado_5, color: 'purple' },
              { label: 'IVA 5%', value: totales.iva_5, color: 'violet' },
              { label: 'Exento', value: totales.exento, color: 'gray' },
              { label: 'TOTAL', value: totales.total, color: 'emerald' },
            ].map(item => (
              <div key={item.label} className="card p-3 text-center">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className={`font-bold text-sm ${item.color === 'emerald' ? 'text-emerald-600' : ''}`}>
                  Gs. {item.value.toLocaleString('es-PY')}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Tabla RG90 */}
        <div className="card overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
              <Loader2 className="w-6 h-6 animate-spin" />
              <span>Cargando comprobantes...</span>
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-gray-400 gap-3">
              <FileSpreadsheet className="w-12 h-12 opacity-30" />
              <p className="text-sm">No hay comprobantes registrados para {MESES[mes - 1]} {anio}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-[#1a2e4a] text-white">
                    <th className="px-3 py-2 text-center whitespace-nowrap w-8">#</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">Fecha</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">Timbrado</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">N° Comprobante</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">RUC/CI Comprador</th>
                    <th className="px-3 py-2 text-left whitespace-nowrap">Nombre Comprador</th>
                    <th className="px-3 py-2 text-center whitespace-nowrap">Cond.</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Gravado 10%</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Gravado 5%</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">Exento</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap font-bold">Total</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">IVA 10%</th>
                    <th className="px-3 py-2 text-right whitespace-nowrap">IVA 5%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {rows.map((r, i) => (
                    <tr
                      key={r.id}
                      className={i % 2 === 0
                        ? 'bg-white dark:bg-gray-900'
                        : 'bg-gray-50 dark:bg-gray-800/50'}
                    >
                      <td className="px-3 py-2 text-center text-gray-400">{i + 1}</td>
                      <td className="px-3 py-2 text-center font-mono">{r.fecha}</td>
                      <td className="px-3 py-2 text-center font-mono">
                        {r.timbrado
                          ? <span className="text-blue-700 dark:text-blue-400 font-semibold">{r.timbrado}</span>
                          : <span className="text-red-400 text-xs">Sin timbrado</span>}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">
                        {padNro(r.punto_venta, r.numero_factura)}
                      </td>
                      <td className="px-3 py-2 text-center font-mono">
                        {r.ruc_comprador || <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="px-3 py-2 max-w-[200px] truncate">{r.nombre_comprador}</td>
                      <td className="px-3 py-2 text-center">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                          r.condicion === 'CO'
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300'
                            : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                        }`}>
                          {r.condicion}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.gravado_10 > 0 ? r.gravado_10.toLocaleString('es-PY') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.gravado_5 > 0 ? r.gravado_5.toLocaleString('es-PY') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {r.exento > 0 ? r.exento.toLocaleString('es-PY') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-bold">
                        {r.total.toLocaleString('es-PY')}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-indigo-600 dark:text-indigo-400">
                        {r.iva_10 > 0 ? r.iva_10.toLocaleString('es-PY') : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-violet-600 dark:text-violet-400">
                        {r.iva_5 > 0 ? r.iva_5.toLocaleString('es-PY') : <span className="text-gray-300">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#1a2e4a] text-white font-bold text-xs">
                    <td colSpan={7} className="px-3 py-2.5 text-right">TOTALES</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.gravado_10.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.gravado_5.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.exento.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.total.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.iva_10.toLocaleString('es-PY')}</td>
                    <td className="px-3 py-2.5 text-right font-mono">{totales.iva_5.toLocaleString('es-PY')}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Registro de Comprobantes de Venta — RG N° 90 — DNIT Paraguay.
          Montos en Guaraníes (Gs.) | CO = Contado, CR = Crédito.
          IVA calculado: 10% → Gs×10/110 · 5% → Gs×5/105
        </p>
      </div>
    </>
  );
}
