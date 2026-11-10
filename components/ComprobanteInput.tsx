'use client';

import { useState } from 'react';
import { Paperclip, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { validarArchivoComprobante } from '@/lib/comprobantes';

interface Props {
  numero: string;
  onNumero: (value: string) => void;
  file: File | null;
  onFile: (file: File | null) => void;
  label?: string;
  numeroPlaceholder?: string;
  existente?: string | null;
}

// Comprobante obligatorio: número y/o archivo (imagen o PDF). Al menos uno es requerido.
export function ComprobanteInput({ numero, onNumero, file, onFile, label = 'Comprobante', numeroPlaceholder = 'N° de comprobante', existente }: Props) {
  const [inputKey, setInputKey] = useState(0);
  const faltante = !numero.trim() && !file && !existente;
  return (
    <div>
      <label className="label">{label} <span className="text-red-500">*</span></label>
      <div className="flex flex-col sm:flex-row gap-2">
        <input className={`input flex-1 ${faltante ? 'border-red-300' : ''}`} value={numero} onChange={e => onNumero(e.target.value)} placeholder={numeroPlaceholder} />
        <div className="flex items-center gap-2">
          <label className="btn-secondary flex items-center gap-1 cursor-pointer text-xs py-2 whitespace-nowrap">
            <Paperclip className="w-3.5 h-3.5" /> {file ? 'Cambiar archivo' : 'Adjuntar archivo'}
            <input
              key={inputKey}
              type="file"
              accept="image/jpeg,image/png,image/webp,application/pdf"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0] || null;
                if (!f) return;
                const err = validarArchivoComprobante(f);
                if (err) { toast.error(err); setInputKey(k => k + 1); return; }
                onFile(f);
              }}
            />
          </label>
          {file && (
            <span className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 max-w-[160px]">
              <span className="truncate">{file.name}</span>
              <button type="button" onClick={() => { onFile(null); setInputKey(k => k + 1); }} className="text-red-500"><X className="w-3.5 h-3.5" /></button>
            </span>
          )}
        </div>
      </div>
      {faltante && <p className="text-xs text-red-500 mt-1">Ingresá el número de comprobante o adjuntá el archivo.</p>}
    </div>
  );
}
