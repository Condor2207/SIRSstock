'use client';
import { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

// ── Pagination ──────────────────────────────────────────────
export function usePagination<T>(items: T[], defaultPageSize = 10) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated = items.slice((safePage - 1) * pageSize, safePage * pageSize);

  function handlePageSizeChange(newSize: number) {
    setPageSize(newSize);
    setPage(1);
  }

  return { paginated, page: safePage, setPage, pageSize, setPageSize: handlePageSizeChange, totalPages, total: items.length };
}

interface PaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  total: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}

export function Pagination({ page, totalPages, pageSize, total, onPageChange, onPageSizeChange }: PaginationProps) {
  return (
    <div className="flex flex-wrap items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-gray-700 text-sm text-gray-500 gap-2">
      <div className="flex items-center gap-2">
        <span>Mostrar</span>
        <select
          className="input w-auto py-1 text-sm"
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
        >
          {[10, 25, 50, 100].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <span className="text-gray-400">de {total} registros</span>
      </div>
      <div className="flex items-center gap-1">
        <button
          disabled={page === 1}
          onClick={() => onPageChange(1)}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-xs"
        >«</button>
        <button
          disabled={page === 1}
          onClick={() => onPageChange(page - 1)}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
        >‹</button>
        <span className="px-2">{page} / {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(page + 1)}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40"
        >›</button>
        <button
          disabled={page === totalPages}
          onClick={() => onPageChange(totalPages)}
          className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700 disabled:opacity-40 text-xs"
        >»</button>
      </div>
    </div>
  );
}

// ── Sortable ─────────────────────────────────────────────────
export type SortDir = 'asc' | 'desc' | null;

export function useSort<T>(items: T[]) {
  const [sortKey, setSortKey] = useState<keyof T | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);

  function handleSort(key: keyof T) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : d === 'desc' ? null : 'asc');
      if (sortDir === 'desc') setSortKey(null);
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  }

  const sorted = sortKey && sortDir
    ? [...items].sort((a, b) => {
        const av = a[sortKey] ?? '';
        const bv = b[sortKey] ?? '';
        const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
        return sortDir === 'asc' ? cmp : -cmp;
      })
    : items;

  return { sorted, sortKey, sortDir, handleSort };
}

interface SortableThProps {
  label: string;
  sortKey?: string;
  currentKey?: string | number | symbol | null;
  currentDir?: SortDir;
  onSort?: (key: string) => void;
  className?: string;
}

export function SortableTh({ label, sortKey, currentKey, currentDir, onSort, className }: SortableThProps) {
  const active = sortKey && sortKey === currentKey;
  return (
    <th
      className={`table-header select-none ${sortKey ? 'cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700' : ''} ${className || ''}`}
      onClick={() => sortKey && onSort?.(sortKey)}
    >
      <div className="flex items-center gap-1">
        <span>{label}</span>
        {sortKey && (
          <span className="flex flex-col leading-none">
            <ChevronUp className={`w-2.5 h-2.5 -mb-0.5 ${active && currentDir === 'asc' ? 'text-blue-500' : 'text-gray-300'}`} />
            <ChevronDown className={`w-2.5 h-2.5 ${active && currentDir === 'desc' ? 'text-blue-500' : 'text-gray-300'}`} />
          </span>
        )}
      </div>
    </th>
  );
}
