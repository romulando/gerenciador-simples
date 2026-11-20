'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, TriangleAlert } from 'lucide-react';
import { useConfirmar } from '@/components/ui/Confirmar';
import AdicionarIdContaModal from './AdicionarIdContaModal';

export interface PedidoSemConta {
  trackingId: string;
  tipoServico?: string;
}

// Aviso de pedidos em andamento sem o ID da conta do Dota 2 vinculado.
// Mesmo comportamento do gerenciador de pedidos: banner âmbar + popup ao
// entrar na página + botão "Adicionar ID" por pedido.
export default function AvisoSemConta({
  pedidos,
  carregado = true,
  contaDetectada,
  onSalvo,
}: {
  pedidos: PedidoSemConta[];
  carregado?: boolean;
  contaDetectada?: string | null;
  onSalvo?: () => void | Promise<void>;
}) {
  const confirmar = useConfirmar();
  const router = useRouter();
  const avisado = useRef(false);
  const [alvo, setAlvo] = useState<PedidoSemConta | null>(null);

  const chave = useMemo(
    () => pedidos.map((p) => p.trackingId).join('|'),
    [pedidos]
  );

  useEffect(() => {
    if (!carregado || !pedidos.length || avisado.current) return;
    avisado.current = true;
    void confirmar({
      titulo: 'Pedidos sem ID do Dota 2',
      mensagem: `${pedidos.length} ${
        pedidos.length === 1 ? 'pedido precisa' : 'pedidos precisam'
      } do ID do Dota 2 vinculado. Use o botão "Adicionar ID" no aviso.`,
      tipo: 'aviso',
      confirmarTexto: 'OK',
      somenteOk: true,
    });
    // `chave` acompanha a lista para o efeito rodar quando ela muda.
  }, [carregado, pedidos, chave, confirmar]);

  if (!carregado || !pedidos.length) return null;

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 shadow-[0_8px_32px_rgba(0,0,0,0.35)] backdrop-blur-xl">
        <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
        <div className="flex flex-wrap items-center gap-2.5 text-sm text-amber-200">
          <TriangleAlert className="h-4 w-4 shrink-0 text-[#e8a020]" />
          <p className="min-w-0 flex-1">
            <strong className="font-semibold">
              {pedidos.length} {pedidos.length === 1 ? 'pedido precisa' : 'pedidos precisam'}
            </strong>{' '}
            do ID do Dota 2 vinculado para o vínculo automático das partidas.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {pedidos.map((pedido) => (
              <button
                key={pedido.trackingId}
                type="button"
                onClick={() => setAlvo(pedido)}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#e8a020]/40 bg-[#e8a020]/10 px-3 py-1 text-[11px] font-semibold text-[#e8a020] transition-all duration-300 hover:scale-105 hover:bg-[#e8a020]/20"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar ID
                <span className="font-mono font-normal opacity-80">{pedido.trackingId}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {alvo && (
        <AdicionarIdContaModal
          trackingId={alvo.trackingId}
          tipoServico={alvo.tipoServico}
          contaSugerida={contaDetectada}
          onFechar={() => setAlvo(null)}
          onSalvo={async () => {
            setAlvo(null);
            if (onSalvo) await onSalvo();
            else router.refresh();
          }}
        />
      )}
    </>
  );
}
