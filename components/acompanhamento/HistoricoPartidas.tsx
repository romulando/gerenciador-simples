'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Check,
  ChevronDown,
  Copy,
  ListChecks,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react';
import Modal from '@/components/Modal';
import { useConfirmar } from '@/components/ui/Confirmar';
import HeroImg from '@/components/ui/HeroImg';
import HeroSelect from '@/components/ui/HeroSelect';
import { copiarTexto } from '@/lib/clipboard';
import { TIPOS_SERVICO } from '@/lib/helpers';
import { nomeHeroi } from '@/lib/heroes';
import {
  buscarJson,
  btnPrimary,
  btnSecondary,
  enviarJson,
  inputCls,
  labelCls,
} from '@/components/pedidos/common';

export interface PartidaHistorico {
  id: number;
  matchId: string | null;
  trackingId: string;
  hero: string;
  resultado: 'W' | 'L';
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  iniciadaEm: string | null;
  finalizadaEm: string;
  fonte: string;
}

export interface ResumoHistorico {
  total: number;
  hoje: number;
  semVinculo: number;
  vitorias: number;
  derrotas: number;
}

export interface PedidoHistorico {
  id: string;
  tracking_id: string;
  tipo_servico: string;
  estado: string;
}

interface FiltrosPartidasUI {
  hoje: boolean;
  resultado: string;
  vinculo: string;
  busca: string;
}

interface DadosPartidaManual {
  matchId: string;
  trackingId: string;
  hero: string;
  resultado: 'W' | 'L';
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  data: string;
}

const PARTIDAS_POR_PAGINA = 50;

function agoraInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function formatarDuracao(segundos: number): string {
  const s = Math.max(0, Math.floor(segundos || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${m}:${pad(r)}`;
}

function formatarIntervaloPartida(
  iniciadaEm: string | null,
  finalizadaEm: string,
  duracao: number
): string {
  const fim = finalizadaEm.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (!fim) return finalizadaEm;
  const pad = (n: number) => String(n).padStart(2, '0');
  const data = `${fim[3]}/${fim[2]}`;
  const horaFim = `${fim[4]}:${fim[5]}`;

  let horaInicio = '';
  if (iniciadaEm) {
    if (/(?:Z|[+-]\d{2}:?\d{2})$/.test(iniciadaEm)) {
      const d = new Date(iniciadaEm);
      if (!Number.isNaN(d.getTime())) {
        horaInicio = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
      }
    } else {
      const local = iniciadaEm.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
      if (local) horaInicio = `${local[4]}:${local[5]}`;
    }
  }

  if (!horaInicio && duracao > 0) {
    const fimSeg = Number(fim[4]) * 3600 + Number(fim[5]) * 60;
    const inicioSeg = (((fimSeg - Math.round(duracao)) % 86400) + 86400) % 86400;
    horaInicio = `${pad(Math.floor(inicioSeg / 3600))}:${pad(
      Math.floor((inicioSeg % 3600) / 60)
    )}`;
  }

  return horaInicio ? `${data} ${horaInicio} → ${horaFim}` : `${data} ${horaFim}`;
}

function BadgeResultado({ resultado }: { resultado: 'W' | 'L' }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${
        resultado === 'W'
          ? 'bg-green-500/10 text-green-400'
          : 'bg-red-500/10 text-red-400'
      }`}
    >
      {resultado === 'W' ? 'Vitória' : 'Derrota'}
    </span>
  );
}

function ModalPartidaManual({
  pedidos,
  onFechar,
  onSalvar,
}: {
  pedidos: PedidoHistorico[];
  onFechar: () => void;
  onSalvar: (dados: DadosPartidaManual) => Promise<void>;
}) {
  const [matchId, setMatchId] = useState('');
  const [trackingId, setTrackingId] = useState('');
  const [hero, setHero] = useState('');
  const [resultado, setResultado] = useState<'W' | 'L'>('W');
  const [kills, setKills] = useState('');
  const [deaths, setDeaths] = useState('');
  const [assists, setAssists] = useState('');
  const [duracaoMin, setDuracaoMin] = useState('');
  const [data, setData] = useState(agoraInput);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  async function enviar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErro('');
    setSalvando(true);
    try {
      await onSalvar({
        matchId: matchId.trim(),
        trackingId,
        hero,
        resultado,
        kills: Number(kills) || 0,
        deaths: Number(deaths) || 0,
        assists: Number(assists) || 0,
        duracao: (Number(duracaoMin) || 0) * 60,
        data,
      });
      onFechar();
    } catch (e) {
      setErro((e as Error).message);
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Modal
      pill="Partida manual"
      titulo="Adicionar partida manual"
      descricao="A partida entra apenas no histórico local; registros já lançados no pedido não são alterados."
      largura="max-w-2xl"
      accent
      onClose={onFechar}
    >
      <form onSubmit={enviar} className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={labelCls} htmlFor="manual-match-id">
              Match ID (opcional)
            </label>
            <input
              id="manual-match-id"
              className={inputCls}
              value={matchId}
              onChange={(e) => setMatchId(e.target.value)}
              placeholder="Ex.: 9031591847"
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="manual-pedido">
              Pedido (opcional)
            </label>
            <select
              id="manual-pedido"
              className={inputCls}
              value={trackingId}
              onChange={(e) => setTrackingId(e.target.value)}
            >
              <option value="">Sem vínculo</option>
              {pedidos
                .filter((p) => String(p.tracking_id ?? '').trim())
                .map((p) => (
                  <option key={p.id} value={p.tracking_id}>
                    {p.tracking_id} · {TIPOS_SERVICO[p.tipo_servico] ?? p.tipo_servico}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Herói</label>
            <HeroSelect className={inputCls} value={hero} onChange={(e) => setHero(e.target.value)} />
          </div>
          <div>
            <label className={labelCls} htmlFor="manual-resultado">
              Resultado
            </label>
            <select
              id="manual-resultado"
              className={inputCls}
              value={resultado}
              onChange={(e) => setResultado(e.target.value as 'W' | 'L')}
            >
              <option value="W">Vitória</option>
              <option value="L">Derrota</option>
            </select>
          </div>
          <div>
            <label className={labelCls} htmlFor="manual-data">
              Data e hora
            </label>
            <input
              id="manual-data"
              type="datetime-local"
              className={inputCls}
              value={data}
              onChange={(e) => setData(e.target.value)}
            />
          </div>
          <div>
            <label className={labelCls} htmlFor="manual-duracao">
              Duração (min)
            </label>
            <input
              id="manual-duracao"
              type="number"
              min={0}
              className={inputCls}
              value={duracaoMin}
              onChange={(e) => setDuracaoMin(e.target.value)}
              placeholder="Ex.: 42"
            />
          </div>
          <div className="grid grid-cols-3 gap-2 sm:col-span-2">
            <div>
              <label className={labelCls} htmlFor="manual-kills">
                Kills
              </label>
              <input
                id="manual-kills"
                type="number"
                min={0}
                className={inputCls}
                value={kills}
                onChange={(e) => setKills(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="manual-deaths">
                Deaths
              </label>
              <input
                id="manual-deaths"
                type="number"
                min={0}
                className={inputCls}
                value={deaths}
                onChange={(e) => setDeaths(e.target.value)}
              />
            </div>
            <div>
              <label className={labelCls} htmlFor="manual-assists">
                Assists
              </label>
              <input
                id="manual-assists"
                type="number"
                min={0}
                className={inputCls}
                value={assists}
                onChange={(e) => setAssists(e.target.value)}
              />
            </div>
          </div>
        </div>

        {erro && (
          <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {erro}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-white/10 pt-4">
          <button type="button" className={btnSecondary} onClick={onFechar} disabled={salvando}>
            Cancelar
          </button>
          <button type="submit" className={btnPrimary} disabled={salvando}>
            {salvando ? 'Salvando...' : 'Salvar partida'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export default function HistoricoPartidas({
  partidasIniciais,
  resumoInicial,
  totalInicial,
  pedidos,
}: {
  partidasIniciais: PartidaHistorico[];
  resumoInicial: ResumoHistorico;
  totalInicial: number;
  pedidos: PedidoHistorico[];
}) {
  const confirmar = useConfirmar();
  const [partidas, setPartidas] = useState(partidasIniciais);
  const [resumo, setResumo] = useState(resumoInicial);
  const [total, setTotal] = useState(totalInicial);
  const [filtros, setFiltros] = useState<FiltrosPartidasUI>({
    hoje: false,
    resultado: '',
    vinculo: '',
    busca: '',
  });
  const [limite, setLimite] = useState(PARTIDAS_POR_PAGINA);
  const [carregando, setCarregando] = useState(false);
  const [manualAberto, setManualAberto] = useState(false);
  const [copiadoId, setCopiadoId] = useState<number | null>(null);
  const [erro, setErro] = useState('');

  const filtrosRef = useRef(filtros);
  useEffect(() => {
    filtrosRef.current = filtros;
  }, [filtros]);

  const limiteRef = useRef(limite);
  useEffect(() => {
    limiteRef.current = limite;
  }, [limite]);

  const carregar = useCallback(
    async (f: FiltrosPartidasUI, l: number, silencioso = false) => {
      if (!silencioso) setCarregando(true);
      try {
        const sp = new URLSearchParams();
        if (f.hoje) sp.set('hoje', '1');
        if (f.resultado) sp.set('resultado', f.resultado);
        if (f.vinculo) sp.set('vinculo', f.vinculo);
        if (f.busca.trim()) sp.set('busca', f.busca.trim());
        sp.set('limite', String(l));
        const data = await buscarJson<{
          partidas: PartidaHistorico[];
          resumo: ResumoHistorico;
          total: number;
        }>(`/api/acompanhamento/partidas?${sp.toString()}`);
        setPartidas(data.partidas);
        setResumo(data.resumo);
        setTotal(data.total);
        if (!silencioso) setErro('');
      } catch (e) {
        if (!silencioso) setErro((e as Error).message);
      } finally {
        if (!silencioso) setCarregando(false);
      }
    },
    []
  );

  useEffect(() => {
    const t = setTimeout(() => {
      void carregar(filtros, limite);
    }, 250);
    return () => clearTimeout(t);
  }, [filtros, limite, carregar]);

  useEffect(() => {
    const t = setInterval(() => {
      void carregar(filtrosRef.current, limiteRef.current, true);
    }, 8000);
    return () => clearInterval(t);
  }, [carregar]);

  function alterarFiltros(novos: Partial<FiltrosPartidasUI>) {
    setFiltros((atual) => ({ ...atual, ...novos }));
    setLimite(PARTIDAS_POR_PAGINA);
  }

  async function adicionarManual(dados: DadosPartidaManual) {
    await enviarJson('/api/acompanhamento/partidas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dados),
    });
    await carregar(filtros, limite);
  }

  async function excluir(partida: PartidaHistorico) {
    const ok = await confirmar({
      titulo: 'Excluir partida do histórico',
      mensagem:
        'Remover esta partida do histórico local? O registro já lançado no pedido não será desfeito.',
      tipo: 'perigo',
      confirmarTexto: 'Excluir',
    });
    if (!ok) return;
    setErro('');
    try {
      await enviarJson(`/api/acompanhamento/partidas/${partida.id}`, { method: 'DELETE' });
      await carregar(filtros, limite);
    } catch (e) {
      setErro((e as Error).message);
    }
  }

  async function copiarMatchId(partida: PartidaHistorico) {
    if (!partida.matchId) return;
    if (!(await copiarTexto(partida.matchId))) return;
    setCopiadoId(partida.id);
    setTimeout(() => setCopiadoId(null), 1500);
  }

  const pedidosPorTracking = useMemo(
    () =>
      new Map(
        pedidos.map((p) => [String(p.tracking_id ?? '').trim().toUpperCase(), p])
      ),
    [pedidos]
  );

  const winrate = useMemo(() => {
    const decididas = resumo.vitorias + resumo.derrotas;
    return decididas > 0 ? (resumo.vitorias / decididas) * 100 : null;
  }, [resumo.vitorias, resumo.derrotas]);

  return (
    <>
      <section className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 backdrop-blur-xl">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-100">
              <ListChecks className="h-5 w-5 text-amber-500" />
              Histórico de Partidas
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Hoje: <span className="text-gray-300">{resumo.hoje}</span> · Vitórias:{' '}
              <span className="text-green-400">{resumo.vitorias}</span> · Derrotas:{' '}
              <span className="text-red-400">{resumo.derrotas}</span> · Sem vínculo:{' '}
              <span className={resumo.semVinculo > 0 ? 'text-amber-400' : 'text-gray-300'}>
                {resumo.semVinculo}
              </span>{' '}
              · Winrate:{' '}
              <span className="text-amber-400">
                {winrate !== null ? `${winrate.toFixed(1)}%` : '—'}
              </span>
            </p>
          </div>
          <button className={btnSecondary} onClick={() => setManualAberto(true)}>
            <span className="flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar manual
            </span>
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => alterarFiltros({ hoje: !filtros.hoje })}
            className={`rounded-full border px-3 py-1.5 text-xs transition-colors ${
              filtros.hoje
                ? 'border-[#e8a020]/70 bg-[#e8a020]/15 font-semibold text-[#e8a020]'
                : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10'
            }`}
          >
            Hoje
          </button>
          <select
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-gray-200 outline-none focus:border-white/30"
            value={filtros.resultado}
            onChange={(e) => alterarFiltros({ resultado: e.target.value })}
          >
            <option value="">Todos os resultados</option>
            <option value="W">Vitórias</option>
            <option value="L">Derrotas</option>
          </select>
          <select
            className="h-9 rounded-xl border border-white/10 bg-white/5 px-2 text-xs text-gray-200 outline-none focus:border-white/30"
            value={filtros.vinculo}
            onChange={(e) => alterarFiltros({ vinculo: e.target.value })}
          >
            <option value="">Todos os vínculos</option>
            <option value="com">Com pedido</option>
            <option value="sem">Sem vínculo</option>
          </select>
          <input
            className={`${inputCls} h-9 w-72`}
            placeholder="Buscar por Match ID, herói ou tracking"
            value={filtros.busca}
            onChange={(e) => alterarFiltros({ busca: e.target.value })}
          />
          {carregando && <span className="text-xs text-gray-500">Atualizando...</span>}
        </div>

        {erro && (
          <p className="mb-3 rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {erro}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm text-gray-300">
            <thead className="text-xs uppercase text-gray-500">
              <tr>
                <th className="py-1 text-left">Foto</th>
                <th className="text-left">Herói</th>
                <th className="text-left">K/D/A</th>
                <th className="text-left">Resultado</th>
                <th className="text-left">Data</th>
                <th className="text-left">Tempo</th>
                <th className="text-left">Match ID</th>
                <th className="text-left">Pedido</th>
                <th className="text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {partidas.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-gray-500">
                    Nenhuma partida encontrada. As partidas aparecem aqui automaticamente ao fim de
                    cada jogo (GSI) ou podem ser adicionadas manualmente.
                  </td>
                </tr>
              )}
              {partidas.map((partida) => {
                const pedido = pedidosPorTracking.get(partida.trackingId);
                return (
                  <tr key={partida.id} className="border-t border-white/10">
                    <td className="py-1.5">
                      <HeroImg
                        interno={partida.hero}
                        nome={nomeHeroi(partida.hero) || 'Herói'}
                        className="h-8 w-14 rounded object-cover"
                      />
                    </td>
                    <td>{nomeHeroi(partida.hero) || '—'}</td>
                    <td className="whitespace-nowrap">
                      {partida.kills}/{partida.deaths}/{partida.assists}
                    </td>
                    <td>
                      <BadgeResultado resultado={partida.resultado} />
                    </td>
                    <td className="whitespace-nowrap">
                      {formatarIntervaloPartida(
                        partida.iniciadaEm,
                        partida.finalizadaEm,
                        partida.duracao
                      )}
                    </td>
                    <td className="whitespace-nowrap">{formatarDuracao(partida.duracao)}</td>
                    <td>
                      {partida.matchId ? (
                        <button
                          type="button"
                          onClick={() => copiarMatchId(partida)}
                          title="Copiar Match ID"
                          className="inline-flex items-center gap-1 rounded border border-sky-700/60 bg-sky-900/60 px-1.5 py-0.5 font-mono text-xs text-sky-300 transition-colors hover:bg-sky-800/60"
                        >
                          {partida.matchId}
                          {copiadoId === partida.id ? (
                            <Check className="h-3 w-3 text-green-400" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      ) : (
                        <span className="text-gray-600">—</span>
                      )}
                    </td>
                    <td>
                      {!partida.trackingId ? (
                        <span className="text-xs text-amber-400/90">Sem vínculo</span>
                      ) : pedido ? (
                        <Link href={`/pedidos/${pedido.id}`} className="group block">
                          <span className="font-mono text-xs text-sky-300 group-hover:text-sky-200">
                            {partida.trackingId}
                          </span>
                          <span className="block text-[11px] text-gray-500">
                            {TIPOS_SERVICO[pedido.tipo_servico] ?? pedido.tipo_servico}
                          </span>
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-gray-400">{partida.trackingId}</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {partida.fonte === 'manual' && (
                          <span className="text-[10px] uppercase tracking-wide text-gray-500">
                            manual
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => excluir(partida)}
                          title="Excluir do histórico local"
                          className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] text-red-300 transition-colors hover:bg-red-500/20"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <span className="block text-xs text-gray-500">
            Mostrando {partidas.length} de {Math.max(total, partidas.length)} partidas
          </span>
          {partidas.length < total && (
            <button
              type="button"
              onClick={() => setLimite((atual) => atual + PARTIDAS_POR_PAGINA)}
              disabled={carregando}
              title="Carregar mais"
              aria-label="Carregar mais partidas"
              className="mt-1 flex w-full items-center justify-center border-0 bg-transparent py-2 text-gray-400 transition-colors hover:bg-white/5 hover:text-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {carregando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
          )}
        </div>
      </section>

      {manualAberto && (
        <ModalPartidaManual
          pedidos={pedidos}
          onFechar={() => setManualAberto(false)}
          onSalvar={adicionarManual}
        />
      )}
    </>
  );
}
