'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { btnDanger, btnPrimary, btnSecondary } from '@/components/pedidos/common';
import { useCamadaModal } from '@/components/ui/useCamadaModal';

export type ConfirmarTipo = 'perigo' | 'aviso';

export interface ConfirmarOpcoes {
  titulo: string;
  mensagem?: ReactNode;
  confirmarTexto?: string;
  cancelarTexto?: string;
  tipo?: ConfirmarTipo;
  // Aviso apenas informativo: esconde o botão de cancelar (só OK)
  somenteOk?: boolean;
}

type ConfirmarFn = (opcoes: ConfirmarOpcoes) => Promise<boolean>;

const ConfirmarContext = createContext<ConfirmarFn | null>(null);

export function useConfirmar(): ConfirmarFn {
  const ctx = useContext(ConfirmarContext);
  if (!ctx) throw new Error('useConfirmar deve ser usado dentro de <ConfirmarProvider>');
  return ctx;
}

const CORES: Record<ConfirmarTipo, { icon: string; ring: string; botao: string }> = {
  perigo: {
    icon: 'text-red-400',
    ring: 'border-red-500/20 bg-red-500/10',
    botao: btnDanger,
  },
  aviso: {
    icon: 'text-amber-400',
    ring: 'border-amber-500/20 bg-amber-500/10',
    botao: btnPrimary,
  },
};

export function ConfirmarProvider({ children }: { children: ReactNode }) {
  const [opcoes, setOpcoes] = useState<ConfirmarOpcoes | null>(null);
  const resolverRef = useRef<((valor: boolean) => void) | null>(null);

  useEffect(() => {
    return () => {
      resolverRef.current?.(false);
      resolverRef.current = null;
    };
  }, []);

  const confirmar = useCallback<ConfirmarFn>((novasOpcoes) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current?.(false);
      resolverRef.current = resolve;
      setOpcoes(novasOpcoes);
    });
  }, []);

  const fechar = useCallback((valor: boolean) => {
    resolverRef.current?.(valor);
    resolverRef.current = null;
    setOpcoes(null);
  }, []);

  useEffect(() => {
    if (!opcoes) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') fechar(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [opcoes, fechar]);

  const tipo = opcoes?.tipo ?? 'perigo';
  const cores = CORES[tipo];

  return (
    <ConfirmarContext.Provider value={confirmar}>
      {children}
      {opcoes &&
        typeof document !== 'undefined' &&
        createPortal(
          <ConfirmarDialogo opcoes={opcoes} cores={cores} onFechar={fechar} />,
          document.body
        )}
    </ConfirmarContext.Provider>
  );
}

function ConfirmarDialogo({
  opcoes,
  cores,
  onFechar,
}: {
  opcoes: ConfirmarOpcoes;
  cores: { icon: string; ring: string; botao: string };
  onFechar: (valor: boolean) => void;
}) {
  const z = useCamadaModal();
  return (
    <div
      style={{ zIndex: z }}
      className="fixed inset-0 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={() => onFechar(false)}
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-label={opcoes.titulo}
        className="w-full max-w-md overflow-hidden rounded-3xl border border-white/10 bg-[#151515]/95 shadow-[0_8px_32px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-5">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border ${cores.ring}`}
          >
            <TriangleAlert className={`h-5 w-5 ${cores.icon}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="font-semibold text-gray-100">{opcoes.titulo}</h2>
            {opcoes.mensagem && (
              <div className="mt-1 text-sm text-gray-400">{opcoes.mensagem}</div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-white/10 px-5 py-4">
          {!opcoes.somenteOk && (
            <button className={btnSecondary} onClick={() => onFechar(false)}>
              {opcoes.cancelarTexto ?? 'Cancelar'}
            </button>
          )}
          <button className={cores.botao} onClick={() => onFechar(true)} autoFocus>
            {opcoes.confirmarTexto ?? 'Excluir'}
          </button>
        </div>
      </div>
    </div>
  );
}
