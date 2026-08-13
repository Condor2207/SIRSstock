'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { createClient } from '@/lib/supabase';
import { formatDateTime } from '@/lib/utils';
import { Pagination, usePagination, useSort } from '@/components/TableUtils';
import { ScrollText, Loader2, Search } from 'lucide-react';
import type { AuditLog } from '@/lib/types';

const AUDIT_FETCH_LIMIT = 300;

export default function AuditoriaPage() {
  const supabase = createClient();
  const [items, setItems] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('auditoria_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(AUDIT_FETCH_LIMIT);
    setItems((data as AuditLog[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { load(); }, [load]);

  const filtered = items.filter(item => {
    const term = search.toLowerCase();
    return !term
      || (item.user_email || '').toLowerCase().includes(term)
      || item.modulo.toLowerCase().includes(term)
      || item.accion.toLowerCase().includes(term)
      || item.descripcion.toLowerCase().includes(term);
  });
  const { sorted } = useSort(filtered as any[]);
  const { paginated, page, setPage, pageSize, setPageSize, totalPages, total } = usePagination(sorted);

  return (
    <div className="flex flex-col min-h-full">
      <Header title="Auditoría" subtitle="Bitácora reciente de acciones registradas" />
      <div className="p-4 md:p-6">
        <div className="relative max-w-sm mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="input pl-9" placeholder="Buscar en auditoría..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Mostrando hasta {AUDIT_FETCH_LIMIT} registros recientes.</p>
        <div className="card overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center p-10">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <ScrollText className="w-10 h-10 mx-auto mb-2 opacity-40" />
              <p>Sin movimientos auditados todavía</p>
            </div>
          ) : (
            <>
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <th className="table-header">Fecha</th>
                    <th className="table-header">Usuario</th>
                    <th className="table-header">Módulo</th>
                    <th className="table-header">Acción</th>
                    <th className="table-header">Detalle</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {paginated.map(item => (
                    <tr key={item.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="table-cell whitespace-nowrap">{formatDateTime(item.created_at)}</td>
                      <td className="table-cell">{item.user_email || 'Desconocido'}</td>
                      <td className="table-cell">{item.modulo}</td>
                      <td className="table-cell">
                        <span className="badge bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 capitalize">
                          {item.accion}
                        </span>
                      </td>
                      <td className="table-cell">{item.descripcion}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination page={page} totalPages={totalPages} pageSize={pageSize} total={total} onPageChange={setPage} onPageSizeChange={setPageSize} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
