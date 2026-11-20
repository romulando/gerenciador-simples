'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CheckCircle2,
  Gamepad2,
  Link2,
  Pencil,
  RefreshCw,
  TriangleAlert,
  UserRound,
  Wifi,
  WifiOff,
} from 'lucide-react';
import Alerta from '@/components/ui/Alerta';
import AdicionarIdContaModal from '@/components/pedidos/AdicionarIdContaModal';
import { buscarJson, btnSecondary } from '@/components/pedidos/common';
import { TIPOS_SERVICO, ehServicoDuo, ehServicoSolo } from '@/lib/helpers';

export interface PedidoStatusAcomp {
  id: string;
  tracking_id: string;
  tipo_servico: string;
  estado: string;
}

export interface ContaStatusAcomp {
  trackingId: string;
  accountId: string;
  tipoServico: string;
  atualizadoEm: string;
}

export interface GsiStatusAcomp {
  online: boolean;
  ultimoContatoEm: number | null;
  gameState: string;
  matchId: string | null;
  hero: string;
  accountId: string | null;
  steamId: string | null;
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  iniciadaEm: string | null;
  emPartida: boolean;
  ultimaPartida: {
    id: number;
    matchId: string | null;
    resultado: string;
    hero: string;
  } | null;
  ultimoErroPartida: string;
}

export interface PendentesStatus {
  pendentes: number;
  recalculoPendente: number;
  ultimoErro: string;
  atualizadoEm: string | null;
}

export interface StatusAcompResposta {
  gsi: GsiStatusAcomp;
  pedidoSelecionado: string;
  pedidoSelecionadoTipo: string;
  contas: ContaStatusAcomp[];
  pendentes: PendentesStatus;
  autoVinculo?: {
    vinculado: boolean;
    trackingId: string;
    motivo: string;
  } | null;
}

function rotuloGameState(valor: string): string {
  switch (valor) {
    case 'menu':
      return 'Menu';
    case 'testando_heroi':
      return 'Testando herói';
    case 'DOTA_GAMERULES_STATE_HERO_SELECTION':
      return 'Draft';
    case 'DOTA_GAMERULES_STATE_PRE_GAME':
      return 'Pré-jogo';
    case 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS':
      return 'Em partida';
    case 'DOTA_GAMERULES_STATE_POST_GAME':
      return 'Pós-jogo';
    default:
      return valor || '—';
  }
}

function formatarDuracao(segundos: number): string {
  const total = Math.max(0, Math.round(Number(segundos) || 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function formatarContatoGsi(ms: number | null): string {
  if (!ms) return 'nunca';
  const segundos = Math.max(0, Math.round((Date.now() - ms) / 1000));
  if (segundos < 60) return `há ${segundos}s`;
  const minutos = Math.floor(segundos / 60);
  if (minutos < 60) return `há ${minutos}min`;
  return `há ${Math.floor(minutos / 60)}h`;
}

function Campo({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-500">{rotulo}</p>
      <p className="truncate text-sm text-gray-100">{valor}</p>
    </div>
  );
}

export default function StatusGsi({
  statusInicial,
  pedidos,
}: {
  statusInicial: StatusAcompResposta;
  pedidos: PedidoStatusAcomp[];
}) {
  const [status, setStatus] = useState(statusInicial);
  const [sincronizando, setSincronizando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [contaEditando, setContaEditando] = useState<{
    trackingId: string;
    tipoServico?: string;
    contaAtual?: string | null;
  } | null>(null);
  const sincronizandoRef = useRef(false);
  const router = useRouter();

  const carregar = useCallback(async () => {
    try {
      const data = await buscarJson<StatusAcompResposta>('/api/acompanhamento/status');
      setStatus(data);
      // O vínculo automático altera os dados renderizados no servidor
      // (aviso "pedido sem ID", cartões de pedido). Atualiza a página uma vez.
      if (data.autoVinculo?.vinculado) router.refresh();
    } catch {
      // O polling é silencioso; o erro do botão manual aparece no alerta.
    }
  }, [router]);

  useEffect(() => {
    const t = setInterval(() => void carregar(), 3000);
    return () => clearInterval(t);
  }, [carregar]);

  const sincronizar = useCallback(
    async (silencioso = false) => {
      if (sincronizandoRef.current) return;
      sincronizandoRef.current = true;
      if (!silencioso) {
        setErro('');
        setSucesso('');
      }
      setSincronizando(true);
      try {
        const r = await buscarJson<{
          registrados: number;
          recalculados: number;
          falhas: number;
          pendentes: number;
          erros: string[];
        }>('/api/acompanhamento/pendentes', { method: 'POST' });
        if (!silencioso) {
          setSucesso(
            `Sincronização concluída: ${r.registrados} registro(s), ${r.recalculados} recálculo(s), ${r.pendentes} pendente(s).`
          );
          if (r.erros.length > 0) setErro(r.erros[0]);
        }
        await carregar();
        if (r.registrados > 0 || r.recalculados > 0) router.refresh();
      } catch (e) {
        if (!silencioso) setErro((e as Error).message);
      } finally {
        sincronizandoRef.current = false;
        setSincronizando(false);
      }
    },
    [carregar, router]
  );

  // Com a página aberta, tenta sincronizar assim que aparecer pendência e
  // repete a cada 15s enquanto a fila não esvaziar.
  useEffect(() => {
    if (status.pendentes.pendentes === 0) return;
    void sincronizar(true);
    const t = setInterval(() => void sincronizar(true), 15_000);
    return () => clearInterval(t);
  }, [status.pendentes.pendentes, sincronizar]);

  const gsi = status.gsi;
  const contaDetectada = gsi.accountId ?? '';
  const vinculosDaConta = contaDetectada
    ? status.contas.filter((c) => c.accountId === contaDetectada)
    : [];
  const pedidosDaConta = vinculosDaConta
    .map((vinculo) => ({
      vinculo,
      pedido: pedidos.find(
        (p) => String(p.tracking_id ?? '').toUpperCase() === vinculo.trackingId
      ),
    }))
    .filter((item) => item.pedido);
  const ativosDaConta = pedidosDaConta.filter(
    (item) => item.pedido?.estado === 'em_andamento'
  );

  const contasPorTracking = new Map(
    status.contas.map((c) => [c.trackingId.toUpperCase(), c.accountId])
  );
  const soloComOutraConta = pedidos
    .filter((p) => p.estado === 'em_andamento' && ehServicoSolo(p.tipo_servico))
    .map((p) => ({
      pedido: p,
      conta: contasPorTracking.get(String(p.tracking_id ?? '').toUpperCase()) ?? '',
    }))
    .filter((item) => item.conta && item.conta !== contaDetectada);

  const selecionado = pedidos.find(
    (p) => String(p.tracking_id ?? '').toUpperCase() === status.pedidoSelecionado
  );
  const modoDuo = ehServicoDuo(status.pedidoSelecionadoTipo || selecionado?.tipo_servico);  const contaSelecionada =
    status.contas.find((c) => c.trackingId === status.pedidoSelecionado)?.accountId ?? '';
  const contaDiferente = Boolean(
    selecionado &&
      !modoDuo &&
      contaSelecionada &&
      contaDetectada &&
      contaSelecionada !== contaDetectada
  );

  return (
    <section className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="absolute left-6 right-6 top-0 h-[1.5px] rounded-full bg-gradient-to-r from-transparent via-[#e8a020]/80 to-transparent" />
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
            <Gamepad2 className="h-5 w-5 text-amber-500" />
            Ao Vivo (GSI)
          </h2>
          <span
            className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${
              gsi.online
                ? 'border-green-500/40 bg-green-500/10 text-green-300'
                : 'border-white/15 bg-white/5 text-gray-400'
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                gsi.online
                  ? 'bg-green-400 ' + (gsi.emPartida ? 'animate-pulse' : '')
                  : 'bg-gray-500'
              }`}
            />
            {gsi.online
              ? `GSI: ${gsi.emPartida ? 'em partida' : 'conectado'}`
              : 'GSI: aguardando'}
          </span>
        </div>

        {!gsi.online ? (
          <div className="flex items-start gap-2 rounded-xl border border-dashed border-white/15 bg-white/[0.02] px-3 py-3 text-sm text-gray-400">
            <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-gray-500" />
            <div className="space-y-1">
              <p>Abra o Dota 2 com o GSI instalado para detectar a conta logada e as partidas.</p>
              <p className="text-xs text-gray-500">
                {gsi.ultimoContatoEm
                  ? `Último contato com o Dota: ${formatarContatoGsi(gsi.ultimoContatoEm)}.`
                  : 'Nenhum dado do Dota recebido desde que o painel abriu.'}{' '}
                <a
                  href="#gsi-config"
                  className="text-[#e8a020] underline underline-offset-2 hover:text-amber-200"
                >
                  Ver diagnóstico do GSI
                </a>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <Campo rotulo="Estado" valor={rotuloGameState(gsi.gameState)} />
            <Campo rotulo="Conta logada" valor={gsi.accountId || '—'} />
            <Campo rotulo="Herói" valor={gsi.hero || '—'} />
            <Campo rotulo="Match ID" valor={gsi.matchId || '—'} />
            <Campo
              rotulo="K/D/A"
              valor={`${gsi.kills}/${gsi.deaths}/${gsi.assists}`}
            />
            <Campo rotulo="Relógio" valor={formatarDuracao(gsi.duracao)} />
          </div>
        )}

        {gsi.ultimoErroPartida && (
          <div className="mt-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {gsi.ultimoErroPartida}
          </div>
        )}

        {gsi.online && contaDetectada && ativosDaConta.length === 1 && (
          <div className="mt-3 flex items-center gap-2 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm text-green-200">
            <Link2 className="h-4 w-4 shrink-0 text-green-400" />
            Pedido reconhecido:{' '}
            <span className="font-mono text-green-300">
              {ativosDaConta[0].vinculo.trackingId}
            </span>
            <span className="text-green-300/70">
              ·{' '}
              {TIPOS_SERVICO[ativosDaConta[0].pedido?.tipo_servico ?? ''] ??
                ativosDaConta[0].pedido?.tipo_servico ??
                '—'}
            </span>
            <button
              type="button"
              onClick={() =>
                setContaEditando({
                  trackingId: ativosDaConta[0].vinculo.trackingId,
                  tipoServico: ativosDaConta[0].pedido?.tipo_servico,
                  contaAtual: ativosDaConta[0].vinculo.accountId,
                })
              }
              className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-gray-300 transition-colors hover:bg-white/10 hover:text-white"
              title="Editar ou remover o vínculo da conta"
            >
              <Pencil className="h-3 w-3" />
              Editar vínculo
            </button>
          </div>
        )}

        {gsi.online &&
          contaDetectada &&
          pedidosDaConta.length === 0 &&
          soloComOutraConta.length !== 1 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a020]" />
              <p>
                A conta <span className="font-mono">{contaDetectada}</span> não está vinculada a
                nenhum pedido. Use <span className="font-semibold">Adicionar ID</span> em um pedido
                solo para o vínculo automático.
              </p>
            </div>
          )}

        {gsi.online &&
          contaDetectada &&
          pedidosDaConta.length === 0 &&
          soloComOutraConta.length === 1 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <TriangleAlert className="h-4 w-4 shrink-0 text-[#e8a020]" />
              <p className="min-w-0 flex-1">
                A conta logada <span className="font-mono">{contaDetectada}</span> é diferente da
                conta vinculada ao pedido{' '}
                <span className="font-mono">
                  {soloComOutraConta[0].pedido.tracking_id}
                </span>{' '}
                (<span className="font-mono">{soloComOutraConta[0].conta}</span>). Se você trocou
                de conta, atualize o vínculo.
              </p>
              <button
                type="button"
                onClick={() =>
                  setContaEditando({
                    trackingId: soloComOutraConta[0].pedido.tracking_id,
                    tipoServico: soloComOutraConta[0].pedido.tipo_servico,
                    contaAtual: soloComOutraConta[0].conta,
                  })
                }
                className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] text-gray-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3 w-3" />
                Editar vínculo
              </button>
            </div>
          )}

        {gsi.online && contaDetectada && ativosDaConta.length > 1 && (
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a020]" />
            <p>
              Mais de um pedido usa a conta <span className="font-mono">{contaDetectada}</span>.
              Selecione o pedido correto na overlay para evitar vínculo errado.
            </p>
          </div>
        )}

        {gsi.online &&
          contaDetectada &&
          pedidosDaConta.length > 0 &&
          ativosDaConta.length === 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#e8a020]" />
              <p>
                O pedido vinculado à conta <span className="font-mono">{contaDetectada}</span> não
                está em andamento. As partidas não serão registradas até ele ser retomado.
              </p>
            </div>
          )}

        {gsi.ultimaPartida && (
          <p className="mt-3 flex items-center gap-1.5 text-xs text-gray-400">
            <Wifi className="h-3.5 w-3.5 text-green-400" />
            Última partida salva:{' '}
            <span className="text-gray-200">
              {gsi.ultimaPartida.resultado === 'W' ? 'Vitória' : 'Derrota'}
            </span>
            {gsi.ultimaPartida.hero ? ` · ${gsi.ultimaPartida.hero}` : ''}
            {gsi.ultimaPartida.matchId ? ` · ID ${gsi.ultimaPartida.matchId}` : ''}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3 text-xs text-gray-400">
          <UserRound className="h-3.5 w-3.5 text-[#e8a020]" />
          {selecionado ? (
            modoDuo ? (
              <span>
                Modo Duo/Grupo: as partidas serão registradas no pedido selecionado{' '}
                <span className="font-mono text-gray-200">{status.pedidoSelecionado}</span>.
              </span>
            ) : (
              <span>
                Modo Solo: vínculo automático pela conta do Dota
                {contaDetectada ? ` ${contaDetectada}` : ''}.
              </span>
            )
          ) : (
            <span>
              Nenhum pedido selecionado na overlay. Para duo/grupo, selecione o pedido no painel
              Stream Overlay.
            </span>
          )}
        </div>

        {contaDiferente && (
          <p className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] leading-relaxed text-amber-200">
            A conta logada ({contaDetectada}) não é a conta do pedido selecionado (
            {contaSelecionada}). Se for duo/grupo, selecione o pedido correto no Stream Overlay
            para o registro automático.
          </p>
        )}
      </div>

      {status.pendentes.pendentes > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-2 text-sm text-amber-200">
              <TriangleAlert className="h-4 w-4 shrink-0 text-[#e8a020]" />
              <span>
                <strong className="font-semibold">
                  {status.pendentes.pendentes} partida(s)
                </strong>{' '}
                aguardando registro no pedido
                {status.pendentes.recalculoPendente > 0
                  ? ` · ${status.pendentes.recalculoPendente} com recálculo pendente`
                  : ''}
                .
              </span>
            </p>
            <button
              type="button"
              className={btnSecondary}
              onClick={() => void sincronizar()}
              disabled={sincronizando}
            >
              <span className="flex items-center gap-1.5">
                <RefreshCw className={`h-4 w-4 ${sincronizando ? 'animate-spin' : ''}`} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar agora'}
              </span>
            </button>
          </div>
          {status.pendentes.ultimoErro && (
            <p className="mt-1.5 text-[11px] text-amber-300/80">
              Último erro: {status.pendentes.ultimoErro}
            </p>
          )}
        </div>
      )}

      {erro && <Alerta tipo="erro">{erro}</Alerta>}
      {sucesso && (
        <Alerta tipo="sucesso">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4" />
            {sucesso}
          </span>
        </Alerta>
      )}

      {contaEditando && (
        <AdicionarIdContaModal
          trackingId={contaEditando.trackingId}
          tipoServico={contaEditando.tipoServico}
          contaAtual={contaEditando.contaAtual}
          contaSugerida={gsi.accountId}
          onFechar={() => setContaEditando(null)}
          onSalvo={async () => {
            setContaEditando(null);
            await carregar();
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
