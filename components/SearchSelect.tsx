'use client';
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, X } from 'lucide-react';

export interface SelectOption { value: string; label: string; sublabel?: string; }

interface Props {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  emptyLabel?: string;
}

export function SearchSelect({ options, value, onChange, placeholder = 'Seleccionar...', disabled, className, emptyLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find(o => o.value === value);

  const filtered = search
    ? options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase()) ||
        (o.sublabel || '').toLowerCase().includes(search.toLowerCase())
      ).slice(0, 60)
    : options.slice(0, 60);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  function handleToggle() {
    if (disabled) return;
    setOpen(o => !o);
    setSearch('');
  }

  function handleSelect(val: string) {
    onChange(val);
    setOpen(false);
    setSearch('');
  }

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        className={`input w-full flex items-center justify-between gap-2 text-left ${disabled ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className={selected ? 'text-gray-900 dark:text-gray-100 truncate' : 'text-gray-400 truncate'}>
          {selected ? selected.label : placeholder}
        </span>
        <div className="flex items-center gap-1 shrink-0">
          {value && !disabled && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onChange(''); }}
              onKeyDown={e => { if (e.key === 'Enter') { e.stopPropagation(); onChange(''); } }}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-0.5 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </button>

      {open && !disabled && (
        <div className="absolute z-[100] top-full mt-1 left-0 right-0 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-xl min-w-[200px]">
          <div className="p-2 border-b border-gray-100 dark:border-gray-700">
            <input
              ref={inputRef}
              type="text"
              className="input text-sm py-1.5"
              placeholder="Buscar..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onClick={e => e.stopPropagation()}
            />
          </div>
          <div className="max-h-52 overflow-y-auto">
            <div
              className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
              onClick={() => handleSelect('')}
            >
              {emptyLabel || placeholder}
            </div>
            {filtered.length === 0 ? (
              <div className="px-3 py-4 text-sm text-gray-400 text-center">Sin resultados</div>
            ) : filtered.map(o => (
              <div
                key={o.value}
                className={`px-3 py-2 text-sm cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 ${o.value === value ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-700 dark:text-gray-300'}`}
                onClick={() => handleSelect(o.value)}
              >
                <div>{o.label}</div>
                {o.sublabel && <div className="text-xs text-gray-400">{o.sublabel}</div>}
              </div>
            ))}
            {options.length > 60 && filtered.length === 60 && (
              <div className="px-3 py-1.5 text-xs text-gray-400 text-center border-t border-gray-100 dark:border-gray-700">Mostrando 60 de {options.length}. Escribí para filtrar.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
