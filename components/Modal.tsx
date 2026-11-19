'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import { useCamadaModal } from '@/components/ui/useCamadaModal';

export default function Modal({
  titulo,
  pill,
  descricao,
  accent = false,
  onClose,
  children,
  largura = 'max-w-lg',
}: {
  titulo?: string;
  pill?: string;
  descricao?: string;
  accent?: boolean;
  onClose: () => void;
  children: React.ReactNode;
  largura?: string;
}) {
  const z = useCamadaModal();
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const cabecalhoComposto = Boolean(pill || descricao);

  return (
    <div
      style={{ zIndex: z }}
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Luzes ambiente (skill: Dark Apple Glassmorphism) */}
      {accent && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-[10%] left-[10%] h-[32rem] w-[32rem] rounded-full bg-[#e8a020]/10 blur-[140px]" />
          <div className="absolute -bottom-[10%] right-[5%] h-[28rem] w-[28rem] rounded-full bg-indigo-700/10 blur-[130px]" />
        </div>
      )}

      <div
        role="dialog"
        aria-modal="true"
        aria-label={titulo}
        className={`relative w-full ${largura} max-h-[90vh] overflow-y-auto rounded-3xl border border-white/10 bg-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl`}
        onClick={(e) => e.stopPropagation()}
      >
        {accent && (
          <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
        )}

        <div
          className={`flex justify-between gap-3 border-b border-white/10 px-5 py-3 ${
            cabecalhoComposto ? 'items-start' : 'items-center'
          }`}
        >
          <div className="min-w-0">
            {pill && (
              <span className="mb-1 inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[#e8a020]">
                {pill}
              </span>
            )}
            {titulo && <h2 className="font-semibold text-gray-100">{titulo}</h2>}
            {descricao && (
              <p className="mt-1 text-xs font-light leading-relaxed text-gray-400">{descricao}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-white/10 hover:text-white"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
