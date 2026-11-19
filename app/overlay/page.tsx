'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import OverlayVisual from '@/components/stream-overlay/OverlayVisual';
import TransicaoFogo from '@/components/stream-overlay/TransicaoFogo';
import type { TransicaoFogoHandle } from '@/components/stream-overlay/TransicaoFogo';
import {
  fogoPadrao,
  type DadosOverlay,
  type EstadoCena,
  type FogoOverlayConfig,
  type LayoutOverlay,
} from '@/components/stream-overlay/common';

// A cena + layout vêm de um endpoint leve, consultado em alta frequência: é o
// que faz os elementos mudarem de lugar junto com a troca de cena no OBS. Os
// dados completos (subs, LivePix, pedido, W/L) seguem no poll maior.
const INTERVALO_ESTADO_MS = 120;
const INTERVALO_DADOS_MS = 2500;

interface TransicaoEstado {
  seq: number;
  destino: EstadoCena;
  layout: LayoutOverlay | null;
  fogo: FogoOverlayConfig;
}

interface RespostaEstado {
  estado: EstadoCena | null;
  layout: LayoutOverlay | null;
  fogo: FogoOverlayConfig;
  transicao: TransicaoEstado | null;
}

function chaveEstado(estado: EstadoCena | null, layout: LayoutOverlay | null): string {
  return JSON.stringify([estado, layout]);
}

// Overlay exibida no OBS (browser source 1920x1080). Sem sessão de login:
// o acesso é validado pelo token da URL (?token=...).
function OverlayConteudo() {
  const params = useSearchParams();
  const token = params.get('token') ?? '';
  const cena = params.get('cena') ?? '';
  const [dados, setDados] = useState<DadosOverlay | null>(null);
  const [estadoLayout, setEstadoLayout] = useState<RespostaEstado | null>(null);
  const transicaoRef = useRef<TransicaoFogoHandle>(null);

  // Descarta respostas fora de ordem: um poll antigo (que saiu antes da troca
  // de cena) pode chegar depois do novo e sobrescrever o layout, fazendo os
  // elementos voltarem para a posição anterior.
  const seqDados = useRef(0);
  const seqEstado = useRef(0);
  const chaveEstadoRef = useRef('');
  // Cena que está desenhada agora (undefined = primeira leitura, não anima).
  const estadoExibidoRef = useRef<EstadoCena | null | undefined>(undefined);
  const fogoRef = useRef<FogoOverlayConfig>(fogoPadrao());
  const transicaoAtivaRef = useRef(false);
  // Estado mais recente recebido durante uma transição local (fallback).
  const estadoPendenteRef = useRef<RespostaEstado | null>(null);
  // Último seq de transição anunciada pelo servidor que esta aba já atendeu.
  const seqTransicaoRef = useRef<number | null>(null);

  const query = `token=${encodeURIComponent(token)}${
    cena ? `&cena=${encodeURIComponent(cena)}` : ''
  }`;

  const aplicarEstado = useCallback(
    (estado: EstadoCena | null, layout: LayoutOverlay | null, fogo: FogoOverlayConfig) => {
      estadoExibidoRef.current = estado;
      chaveEstadoRef.current = chaveEstado(estado, layout);
      setEstadoLayout({ estado, layout, fogo, transicao: null });
    },
    []
  );

  const carregarDados = useCallback(async () => {
    if (!token) return;
    const seq = ++seqDados.current;
    try {
      const res = await fetch(`/api/overlay/dados?${query}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as DadosOverlay;
      if (seq !== seqDados.current) return;
      setDados(json);
    } catch {
      // mantém o último estado; a overlay é somente leitura
    }
  }, [token, query]);

  // Avisa o servidor que o fogo cobriu a tela: é o instante em que o OBS
  // troca de cena. O fallback do servidor cobre uma eventual falha de rede.
  const confirmarTransicao = useCallback(
    async (seq: number) => {
      try {
        await fetch(`/api/overlay/transicao?${query}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ seq }),
          cache: 'no-store',
        });
      } catch {
        // mantém a cena; o servidor troca sozinho no timeout
      }
    },
    [query]
  );

  const tocarTransicao = useCallback(
    (t: TransicaoEstado) => {
      let aplicado = false;
      const aplicarDestino = () => {
        if (aplicado) return;
        aplicado = true;
        aplicarEstado(t.destino, t.layout, t.fogo);
        void confirmarTransicao(t.seq);
      };

      const transicao = transicaoRef.current;
      if (!transicao) {
        aplicarDestino();
        return;
      }

      transicaoAtivaRef.current = true;
      const iniciou = transicao.play(t.fogo.paleta, t.fogo.duracaoMs, {
        onCover: aplicarDestino,
        onEnd: () => {
          transicaoAtivaRef.current = false;
        },
      });
      // Sem animação (WebGL indisponível/movimento reduzido): aplica direto.
      if (!iniciou) {
        transicaoAtivaRef.current = false;
        aplicarDestino();
      }
    },
    [aplicarEstado, confirmarTransicao]
  );

  const carregarEstado = useCallback(async () => {
    if (!token) return;
    const seq = ++seqEstado.current;
    try {
      const res = await fetch(`/api/overlay/estado?${query}`, {
        cache: 'no-store',
      });
      if (!res.ok) return;
      const json = (await res.json()) as RespostaEstado;
      if (seq !== seqEstado.current) return;

      fogoRef.current = json.fogo ?? fogoPadrao();

      // 1) O servidor anunciou a próxima cena: toca o fogo e segura a cena
      // atual. A troca (layout local + OBS) acontece na cobertura.
      const anunciada = json.transicao;
      if (anunciada && anunciada.seq !== seqTransicaoRef.current) {
        seqTransicaoRef.current = anunciada.seq;
        if (transicaoAtivaRef.current) return;
        tocarTransicao(anunciada);
        return;
      }

      // 2) Enquanto o efeito roda, o onCover aplica o destino.
      if (transicaoAtivaRef.current) return;

      // Só re-renderiza quando o estado/layout realmente mudam.
      if (chaveEstado(json.estado, json.layout) === chaveEstadoRef.current) return;

      // Primeira leitura: aplica direto, sem animar a abertura da overlay.
      if (estadoExibidoRef.current === undefined) {
        aplicarEstado(json.estado, json.layout, fogoRef.current);
        return;
      }

      // Mesma cena (ex.: ajuste no layout): aplica na hora, sem fogo.
      if (json.estado === estadoExibidoRef.current) {
        aplicarEstado(json.estado, json.layout, fogoRef.current);
        return;
      }

      // Trocou de cena sem anúncio (fogo desligado ou troca fora do app).
      if (!fogoRef.current.ativo) {
        aplicarEstado(json.estado, json.layout, fogoRef.current);
        return;
      }

      // Fallback local: guarda o estado mais recente e só aplica na cobertura.
      estadoPendenteRef.current = json;
      const transicao = transicaoRef.current;
      if (!transicao) {
        aplicarEstado(json.estado, json.layout, fogoRef.current);
        estadoPendenteRef.current = null;
        return;
      }

      transicaoAtivaRef.current = true;
      const iniciou = transicao.play(json.fogo.paleta, json.fogo.duracaoMs, {
        onCover: () => {
          const pendente = estadoPendenteRef.current;
          if (!pendente) return;
          aplicarEstado(pendente.estado, pendente.layout, fogoRef.current);
          estadoPendenteRef.current = null;
        },
        onEnd: () => {
          transicaoAtivaRef.current = false;
        },
      });
      if (!iniciou) {
        transicaoAtivaRef.current = false;
        aplicarEstado(json.estado, json.layout, fogoRef.current);
        estadoPendenteRef.current = null;
      }
    } catch {
      // idem: mantém o último layout conhecido
    }
  }, [token, query, aplicarEstado, tocarTransicao]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      await Promise.all([carregarEstado(), carregarDados()]);
    })();
    const tEstado = setInterval(() => void carregarEstado(), INTERVALO_ESTADO_MS);
    const tDados = setInterval(() => void carregarDados(), INTERVALO_DADOS_MS);
    return () => {
      clearInterval(tEstado);
      clearInterval(tDados);
    };
  }, [token, carregarEstado, carregarDados]);

  // O layout do endpoint leve tem prioridade: ele chega antes de a troca de
  // cena aparecer no payload completo. Sem ele, usa o layout que veio nos dados.
  const layout = estadoLayout?.layout ?? dados?.layout ?? null;

  return (
    <div className="fixed inset-0 overflow-hidden bg-transparent">
      <OverlayVisual dados={dados} layout={layout} />
      <TransicaoFogo ref={transicaoRef} />
    </div>
  );
}

export default function OverlayPage() {
  return (
    <>
      {/* Fundo transparente para o OBS (o body global do painel é escuro) */}
      <style>{`html, body { background: transparent !important; overflow: hidden; }`}</style>
      <Suspense fallback={null}>
        <OverlayConteudo />
      </Suspense>
    </>
  );
}
