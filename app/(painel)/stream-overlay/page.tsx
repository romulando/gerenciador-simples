'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ClipboardCopy,
  Gamepad2,
  MonitorPlay,
  PencilRuler,
  Settings,
  TriangleAlert,
} from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import { copiarTexto } from '@/lib/clipboard';
import { btnSecondary, buscarJson } from '@/components/pedidos/common';
import LogEventos from '@/components/stream-overlay/LogEventos';
import ConfigOverlayModal from '@/components/stream-overlay/ConfigOverlayModal';
import ControleCenas from '@/components/stream-overlay/ControleCenas';
import ControleTransicaoFogo from '@/components/stream-overlay/ControleTransicaoFogo';
import GsiConfig from '@/components/stream-overlay/GsiConfig';
import AvisoSemConta from '@/components/pedidos/AvisoSemConta';
import AdicionarIdContaModal from '@/components/pedidos/AdicionarIdContaModal';
import { CANVAS_ALTURA, CANVAS_LARGURA } from '@/components/stream-overlay/common';
import type {
  ContaPedidoOverlay,
  EstadoCena,
  RespostaPainelOverlay,
} from '@/components/stream-overlay/common';
import { TIPOS_SERVICO } from '@/lib/helpers';
import type { PedidoTheone } from '@/lib/types';

const ROTULOS_ESTADO: Record<EstadoCena, string> = {
  menu: 'Menu',
  draft: 'Draft',
  game: 'Jogando',
  descanso: 'Descanso',
};

function formatarAtualizacao(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function Campo({ rotulo, valor, destaque }: { rotulo: string; valor: string; destaque?: boolean }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className={`truncate text-sm ${destaque ? 'font-semibold text-[#e8a020]' : 'text-gray-100'}`}>
        {valor}
      </p>
    </div>
  );
}

export default function StreamOverlayPage() {
  const [painel, setPainel] = useState<RespostaPainelOverlay | null>(null);
  const [pedidos, setPedidos] = useState<PedidoTheone[]>([]);
  const [contas, setContas] = useState<ContaPedidoOverlay[]>([]);
  const [selecionado, setSelecionado] = useState('');
  const [contaEditando, setContaEditando] = useState(false);
  const [erro, setErro] = useState('');
  const [avisoTwitch, setAvisoTwitch] = useState<{ tipo: 'sucesso' | 'erro'; texto: string } | null>(
    null
  );
  const [configAberto, setConfigAberto] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const [escala, setEscala] = useState(0.25);
  const previewRef = useRef<HTMLDivElement>(null);
  const autoSelecionou = useRef(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const twitch = params.get('twitch');
    if (!twitch) return;
    setAvisoTwitch(
      twitch === 'ok'
        ? {
            tipo: 'sucesso',
            texto:
              'Twitch conectada com sucesso. Ligue o “Mostrar contador de subs” na Configuração da Overlay.',
          }
        : { tipo: 'erro', texto: params.get('motivo') || 'Não foi possível conectar com a Twitch.' }
    );
    window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const selecionar = useCallback(async (trackingId: string) => {
    setErro('');
    await buscarJson('/api/overlay/pedido', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId }),
    });
    setSelecionado(trackingId);
  }, []);

  const carregar = useCallback(async () => {
    const [data, lista] = await Promise.all([
      buscarJson<RespostaPainelOverlay>('/api/overlay/painel'),
      buscarJson<{ pedidos: PedidoTheone[] }>('/api/orders'),
    ]);
    setPainel(data);
    setPedidos(lista.pedidos ?? []);
    setContas(data.contas ?? []);
    const atual = data.pedidoSelecionado ?? '';
    setSelecionado(atual);

    // Primeira carga sem seleção: se houver só um pedido em andamento, usa ele.
    if (!atual && !autoSelecionou.current) {
      const ativos = (lista.pedidos ?? []).filter((p) => p.estado === 'em_andamento');
      if (ativos.length === 1) {
        autoSelecionou.current = true;
        await selecionar(ativos[0].tracking_id);
      }
    }
  }, [selecionar]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        await carregar();
      } catch (e) {
        if (ativo) setErro((e as Error).message);
      }
    })();
    const t = setInterval(() => {
      carregar().catch(() => {});
    }, 3000);
    return () => {
      ativo = false;
      clearInterval(t);
    };
  }, [carregar]);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const calcular = () => setEscala(el.clientWidth / CANVAS_LARGURA);
    calcular();
    const ro = new ResizeObserver(calcular);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const urlOverlay =
    painel && typeof window !== 'undefined'
      ? new URL(`/overlay?token=${encodeURIComponent(painel.token)}`, window.location.origin).toString()
      : '';

  async function copiarUrl() {
    if (!urlOverlay) return;
    if (!(await copiarTexto(urlOverlay))) {
      setErro('Não foi possível copiar a URL da overlay.');
      return;
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  async function salvarConfig(cfg: {
    limiteWins: number;
    modoBoost: boolean;
    subAtivo: boolean;
    subMeta: number;
    livepixAtivo: boolean;
    livepixMeta: number;
  }) {
    setErro('');
    await buscarJson('/api/overlay/config', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cfg),
    });
    setConfigAberto(false);
    await carregar();
  }

  const dados = painel?.dados ?? null;
  const pedido = dados?.pedido ?? null;
  const pedidoCompleto = pedidos.find((p) => p.tracking_id === selecionado) ?? null;
  const progressoPct = Math.max(
    0,
    Math.min(100, Number(pedidoCompleto?.progresso_pct ?? 0) || 0)
  );

  const contasPorTracking = new Map(contas.map((conta) => [conta.trackingId, conta.accountId]));
  const pedidosSemConta = pedidos
    .filter((p) => p.estado === 'em_andamento')
    .filter((p) => !contasPorTracking.get(String(p.tracking_id ?? '').toUpperCase()))
    .map((p) => ({ trackingId: p.tracking_id, tipoServico: p.tipo_servico }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Stream Overlay</h1>
          <p className="text-sm text-gray-500">
            Overlay do OBS com MMR, progresso, W/L e cenas automáticas via GSI.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/stream-overlay/editar" className={btnSecondary}>
            <span className="flex items-center gap-1.5">
              <PencilRuler className="h-4 w-4" />
              Editar Overlay
            </span>
          </Link>
          <button className={btnSecondary} onClick={() => void copiarUrl()} disabled={!urlOverlay}>
            <span className="flex items-center gap-1.5">
              {copiado ? (
                <Check className="h-4 w-4 text-green-400" />
              ) : (
                <ClipboardCopy className="h-4 w-4" />
              )}
              {copiado ? 'Copiado!' : 'Copiar Overlay para OBS'}
            </span>
          </button>
          <button
            className={btnSecondary}
            onClick={() => setConfigAberto(true)}
            title="Configuração da Overlay"
            aria-label="Configuração da Overlay"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {avisoTwitch && <Alerta tipo={avisoTwitch.tipo}>{avisoTwitch.texto}</Alerta>}

      <AvisoSemConta pedidos={pedidosSemConta} onSalvo={carregar} />

      <GsiConfig />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_26rem] xl:items-start">
        <div className="space-y-6">
          <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
                <MonitorPlay className="h-5 w-5 text-amber-500" />
                Prévia da Overlay
              </h2>
              <div className="flex items-center gap-2">
                <span className="text-[11px] uppercase tracking-wide text-gray-500">
                  {CANVAS_LARGURA} × {CANVAS_ALTURA}
                </span>
                <span
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
                    dados?.gsi.online
                      ? 'border-green-500/40 bg-green-500/10 text-green-300'
                      : 'border-white/15 bg-white/5 text-gray-400'
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full ${dados?.gsi.online ? 'bg-green-400' : 'bg-gray-500'}`}
                  />
                  {dados?.gsi.online ? 'GSI: conectado' : 'GSI: aguardando'}
                </span>
              </div>
            </div>

            <div
              ref={previewRef}
              className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0c10]"
            >
              {urlOverlay ? (
                <iframe
                  title="Prévia da overlay"
                  src={urlOverlay}
                  className="pointer-events-none absolute left-0 top-0 border-0"
                  style={{
                    width: CANVAS_LARGURA,
                    height: CANVAS_ALTURA,
                    transform: `scale(${escala})`,
                    transformOrigin: 'top left',
                  }}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500">
                  Carregando prévia...
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
              A prévia usa exatamente a mesma página enviada ao OBS (fundo transparente). Use
              “Copiar Overlay para OBS” e adicione como Browser Source 1920×1080.
            </p>
          </section>

          <section className="relative rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
            <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
                <Gamepad2 className="h-5 w-5 text-amber-500" />
                Pedido exibido na overlay
              </h2>
              {dados && (
                <span className="text-[11px] text-gray-500">
                  atualizado {formatarAtualizacao(dados.atualizadoEm)}
                  {dados.gsi.contaDetectada ? ` · conta ${dados.gsi.contaDetectada}` : ''}
                </span>
              )}
            </div>

            <select
              value={selecionado}
              onChange={(e) => void selecionar(e.target.value)}
              className="h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-sm text-white outline-none focus:border-white/30"
            >
              <option value="">— Nenhum pedido selecionado —</option>
              {pedidos.map((p) => (
                <option key={p.id} value={p.tracking_id}>
                  {p.tracking_id} · {TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico} · {p.estado}
                </option>
              ))}
            </select>

            {pedido ? (
              <>
                <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
                  <Campo rotulo="Tracking" valor={pedido.trackingId ?? '—'} />
                  <Campo
                    rotulo="Serviço"
                    valor={TIPOS_SERVICO[pedido.tipoServico] ?? pedido.tipoServico}
                  />
                  <Campo
                    rotulo="MMR Inicial"
                    valor={pedido.mmrInicial != null ? String(pedido.mmrInicial) : '—'}
                  />
                  <Campo
                    rotulo="MMR Atual"
                    valor={pedido.mmrAtual != null ? String(pedido.mmrAtual) : '—'}
                    destaque
                  />
                  <Campo
                    rotulo="MMR Final"
                    valor={pedido.mmrFinal != null ? String(pedido.mmrFinal) : '—'}
                  />
                  <Campo rotulo="Medalha" valor={pedido.medalhaAtual?.nome ?? '—'} />
                  <Campo rotulo="Conta do pedido" valor={pedido.contaDota ?? '—'} />
                </div>

                <div className="mt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setContaEditando(true)}
                    className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-medium text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
                  >
                    {pedido.contaDota ? 'Editar ID do Dota 2' : 'Adicionar ID do Dota 2'}
                  </button>
                </div>

                <div className="mt-4">
                  <div className="mb-1 flex items-center justify-between text-[11px] text-gray-400">
                    <span>Progresso do pedido</span>
                    <span>{progressoPct.toFixed(0)}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full border border-[#e8a020]/20 bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-[#e8a020]/70 to-[#e8a020] transition-all duration-500"
                      style={{ width: `${progressoPct}%` }}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a020]" />
                <p className="text-sm leading-relaxed text-gray-400">
                  Selecione um pedido acima. Se houver só um em andamento, ele é selecionado
                  automaticamente. A overlay atualiza sozinha.
                </p>
              </div>
            )}

            {dados && (
              <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-white/10 pt-3 text-sm">
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    Vitórias / Derrotas
                  </span>
                  <p className="font-semibold text-gray-100">
                    <span className="text-green-400">{dados.wins}W</span>
                    <span className="text-gray-600"> · </span>
                    <span className="text-red-400">{dados.losses}L</span>
                  </p>
                </div>
                <div>
                  <span className="text-[11px] uppercase tracking-wide text-gray-500">
                    Cena ativa
                  </span>
                  <p className="font-semibold text-gray-100">
                    {dados.estado ? ROTULOS_ESTADO[dados.estado] : '—'}
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  Últimas {dados.limiteWins} partidas · GSI local
                </p>
              </div>
            )}
          </section>

          <ControleCenas />
        </div>

        <div className="space-y-6">
          <LogEventos eventos={painel?.eventos ?? []} />
          <ControleTransicaoFogo />
        </div>
      </div>

      {configAberto && painel && (
        <ConfigOverlayModal
          limiteWins={painel.limiteWins}
          modoBoost={painel.modoBoost}
          subAtivo={painel.dados.sub.ativo}
          subMeta={painel.dados.sub.meta}
          livepixAtivo={painel.dados.livepix.ativo}
          livepixMeta={painel.dados.livepix.meta}
          urlOverlay={urlOverlay}
          onFechar={() => setConfigAberto(false)}
          onSalvar={salvarConfig}
        />
      )}

      {contaEditando && pedido?.trackingId && (
        <AdicionarIdContaModal
          trackingId={pedido.trackingId}
          contaAtual={pedido.contaDota}
          onFechar={() => setContaEditando(false)}
          onSalvo={async () => {
            setContaEditando(false);
            await carregar();
          }}
        />
      )}
    </div>
  );
}
