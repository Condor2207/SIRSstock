import { escapeHtml } from '@/lib/utils';

export async function descargarExcel(filename: string, sheetName: string, rows: Record<string, any>[]) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.columns = Object.keys(rows[0]).map(key => ({ header: key, key, width: 20 }));
  rows.forEach(r => ws.addRow(r));
  ws.getRow(1).font = { bold: true };
  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.xlsx`; a.click();
  URL.revokeObjectURL(url);
}

// Abre una vista imprimible (Imprimir / Guardar como PDF)
export function imprimirDocumento(titulo: string, cuerpoHtml: string) {
  const w = window.open('', '_blank');
  if (!w) return false;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(titulo)}</title>
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#111}h1{font-size:18px;margin:0 0 8px}
table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left}
th{background:#f3f4f6}.r{text-align:right}.meta{display:grid;grid-template-columns:1fr 1fr;gap:4px;margin:8px 0}</style></head>
<body>${cuerpoHtml}<script>window.onload=function(){window.print()}<\/script></body></html>`);
  w.document.close();
  return true;
}
