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
import { CANVAS_ALTURA, CANVAS_LARGURA, CENA_FIXA } from '@/components/stream-overlay/common';
import type {
  ContaPedidoOverlay,
  EstadoCena,
  RespostaPainelOverlay,
} from '@/components/stream-overlay/common';
import { TIPOS_SERVICO, ehServicoDuo, ehServicoSolo } from '@/lib/helpers';
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
  // Lista de pedidos e vínculos chegam em requisições separadas. Sem estas
  // flags, a tela compara pedidos com uma lista de contas ainda vazia e acusa
  // "sem ID" em todos eles por alguns instantes.
  const [pedidosProntos, setPedidosProntos] = useState(false);
  const [contasProntas, setContasProntas] = useState(false);
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

  const selecionar = useCallback(async (trackingId: string, tipoServico?: string) => {
    setErro('');
    await buscarJson('/api/overlay/pedido', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackingId, tipoServico }),
    });
    setSelecionado(trackingId);
  }, []);

  const carregarPainel = useCallback(async (): Promise<RespostaPainelOverlay> => {
    const data = await buscarJson<RespostaPainelOverlay>('/api/overlay/painel');
    setPainel(data);
    setContas(data.contas ?? []);
    setSelecionado(data.pedidoSelecionado ?? '');
    setContasProntas(true);
    return data;
  }, []);

  const carregarPedidos = useCallback(async (): Promise<PedidoTheone[]> => {
    const lista = await buscarJson<{ pedidos: PedidoTheone[] }>('/api/orders');
    const novos = lista.pedidos ?? [];
    setPedidos(novos);
    setPedidosProntos(true);
    return novos;
  }, []);

  const carregar = useCallback(async () => {
    const [data, lista] = await Promise.all([carregarPainel(), carregarPedidos()]);
    let atual = data.pedidoSelecionado ?? '';

    // Seleção apontando para um tracking que não existe mais (pedido apagado
    // ou tracking antigo): limpa para a overlay não ficar presa em
    // "aguardando". Só limpa quando o painel também não resolve o pedido e ele
    // não está na lista, para não perder a seleção por uma falha passageira.
    const naLista = lista.some(
      (p) => String(p.tracking_id ?? '').toUpperCase() === atual
    );
    if (atual && !naLista && !data.dados.pedido) {
      await selecionar('');
      atual = '';
    }

    // Primeira carga sem seleção: se houver só um pedido em andamento, usa ele.
    if (!atual && !autoSelecionou.current) {
      const ativos = lista.filter((p) => p.estado === 'em_andamento');
      if (ativos.length === 1) {
        autoSelecionou.current = true;
        await selecionar(ativos[0].tracking_id, ativos[0].tipo_servico);
      }
    }

    // Seleção antiga sem o tipo salvo: reenvia o tipo para o vínculo duo/grupo.
    if (atual && !data.pedidoSelecionadoTipo) {
      const escolhido = lista.find((p) => p.tracking_id === atual);
      if (escolhido?.tipo_servico) {
        await selecionar(atual, escolhido.tipo_servico);
      }
    }
  }, [carregarPainel, carregarPedidos, selecionar]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        await carregar();
      } catch (e) {
        if (ativo) setErro((e as Error).message);
      }
    })();
    // O painel continua atualizando a cada 3 s (leituras locais + cache).
    const tPainel = setInterval(() => {
      carregarPainel().catch(() => {});
    }, 3000);
    // A lista de pedidos muda raramente: uma leitura por minuto basta.
    const tPedidos = setInterval(() => {
      carregarPedidos().catch(() => {});
    }, 60_000);
    return () => {
      ativo = false;
      clearInterval(tPainel);
      clearInterval(tPedidos);
    };
  }, [carregar, carregarPainel, carregarPedidos]);

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

  // Troca de cenas desligada: a prévia fica presa na cena fixa.
  const cenasAtivo = painel?.cenasAtivo ?? true;
  const urlPreview =
    urlOverlay && !cenasAtivo
      ? `${urlOverlay}&cena=${encodeURIComponent(CENA_FIXA)}`
      : urlOverlay;

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
    await carregarPainel();
  }

  const dados = painel?.dados ?? null;
  const pedido = dados?.pedido ?? null;
  const pedidoCompleto = pedidos.find((p) => p.tracking_id === selecionado) ?? null;
  const progressoPct = Math.max(
    0,
    Math.min(100, Number(pedidoCompleto?.progresso_pct ?? 0) || 0)
  );

  const contasPorTracking = new Map(contas.map((conta) => [conta.trackingId, conta.accountId]));
  const contaSelecionada = selecionado
    ? contasPorTracking.get(String(selecionado).toUpperCase()) ?? ''
    : '';
  const contaDetectada = dados?.gsi.online ? dados.gsi.contaDetectada ?? '' : '';
  const contaDiferente = Boolean(
    pedidoCompleto &&
      !ehServicoDuo(pedidoCompleto.tipo_servico) &&
      contaSelecionada &&
      contaDetectada &&
      contaSelecionada !== contaDetectada
  );
  const dadosCarregados = pedidosProntos && contasProntas;
  const pedidosSemConta = !dadosCarregados
    ? []
    : pedidos
        .filter((p) => p.estado === 'em_andamento')
        .filter((p) => ehServicoSolo(p.tipo_servico))
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

      <AvisoSemConta
        pedidos={pedidosSemConta}
        carregado={dadosCarregados}
        contaDetectada={dados?.gsi.online ? dados.gsi.contaDetectada : null}
        onSalvo={carregar}
      />

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
                {!cenasAtivo && (
                  <span className="flex items-center gap-1.5 rounded-full border border-[#e8a020]/40 bg-[#e8a020]/10 px-2.5 py-1 text-xs font-medium text-[#e8a020]">
                    Cena fixa · {ROTULOS_ESTADO[CENA_FIXA]}
                  </span>
                )}
              </div>
            </div>

            <div
              ref={previewRef}
              className="relative aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-[#0a0c10]"
            >
              {urlOverlay ? (
                <iframe
                  title="Prévia da overlay"
                  src={urlPreview}
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
              {cenasAtivo ? (
                <>
                  A prévia usa exatamente a mesma página enviada ao OBS (fundo transparente). Use
                  “Copiar Overlay para OBS” e adicione como Browser Source 1920×1080.
                </>
              ) : (
                <>
                  Troca de cenas desligada: a prévia e a overlay no OBS usam apenas o layout da
                  cena fixa {ROTULOS_ESTADO[CENA_FIXA]}. Ligue “Troca de cenas” no Controle de
                  Cenas para voltar a usar as quatro cenas.
                </>
              )}
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

            {pedidoCompleto && (
              <p className="mt-2 text-[11px] leading-relaxed text-gray-500">
                {ehServicoDuo(pedidoCompleto.tipo_servico) ? (
                  <>
                    <span className="font-semibold text-fuchsia-300">Duo/Grupo:</span> as partidas
                    serão registradas neste pedido selecionado, mesmo que a conta logada seja a do
                    booster.
                  </>
                ) : (
                  <>
                    <span className="font-semibold text-sky-300">Solo:</span> vínculo automático
                    pela conta do Dota
                    {dados?.gsi.contaDetectada ? ` (${dados.gsi.contaDetectada})` : ''}.
                  </>
                )}
              </p>
            )}

            {(painel?.pendentes?.pendentes ?? 0) > 0 && (
              <p className="mt-2 text-[11px] text-amber-300">
                {painel?.pendentes?.pendentes} partida(s) aguardando registro no pedido. Abra o
                Acompanhamento para sincronizar.
              </p>
            )}

            {contaDiferente && (
              <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
                A conta logada ({contaDetectada}) não é a conta deste pedido (
                {contaSelecionada}). O vínculo das partidas solo usa a conta do Dota 2; para
                duo/grupo vale o pedido exibido.
              </p>
            )}

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
            ) : !painel ? (
              <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-white/[0.02] px-3 py-3">
                <div className="h-3 w-40 animate-pulse rounded bg-white/10" />
                <div className="h-3 w-64 animate-pulse rounded bg-white/5" />
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2.5 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a020]" />
                <p className="text-sm leading-relaxed text-gray-400">
                  Aguardando o GSI detectar a conta do Dota 2. Quando ela estiver vinculada a um
                  pedido em andamento, o pedido aparece aqui automaticamente. A overlay atualiza
                  sozinha.
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
                    {cenasAtivo ? 'Cena ativa' : 'Cena fixa'}
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

          <ControleCenas
            onCenasAtivasChange={(ativo) =>
              setPainel((atual) => (atual ? { ...atual, cenasAtivo: ativo } : atual))
            }
          />
        </div>

        <div className="space-y-6">
          <LogEventos eventos={painel?.eventos ?? []} />
          {cenasAtivo && <ControleTransicaoFogo />}
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
          tipoServico={pedido.tipoServico}
          contaAtual={pedido.contaDota}
          contaSugerida={dados?.gsi.online ? dados.gsi.contaDetectada : null}
          onFechar={() => setContaEditando(false)}
          onSalvo={async () => {
            setContaEditando(false);
            await carregarPainel();
          }}
        />
      )}
    </div>
  );
}
