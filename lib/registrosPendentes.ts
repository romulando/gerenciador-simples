// Fila local das partidas salvas pelo GSI.
//
// O endpoint /api/gsi é público (o Dota 2 não envia cookie de sessão), então
// ele apenas grava a partida no SQLite. A gravação no Supabase (records_theone)
// acontece depois, numa rota autenticada / no after() do painel, respeitando a
// RLS do usuário Theone.
import type { DatabaseSync } from 'node:sqlite';
import type { PedidoTheone } from './types';
import { obterPedidoPorTracking, registroPorOrigemId } from './data';
import type { ClienteSupabase } from './data';
import { criarRegistro } from './records';
import { recalcularPedido } from './recalcular';
import {
  getContaPedidoTipo,
  resolverPedidoDaPartida,
} from './pedidoContas';
import { getPedidoSelecionado, getPedidoSelecionadoTipo } from './pedidoSelecionado';
import {
  agoraLocal,
  dataHoraInicioPartida,
  isBoost,
} from './helpers';
import { registrarEventoOverlay } from './overlayEventos';

const MMR_POR_PARTIDA = 25;
const MMR_POR_PARTIDA_DOBRO = 50;
const LIMITE_POR_EXECUCAO = 3;
const THROTTLE_MS = 5_000;
const RETRY_APOS_SEGUNDOS = 30;
const RETENCAO_DIAS = 7;

export interface PartidaParaRegistrar {
  matchId: string;
  accountId?: string;
  trackingId?: string;
  tipoServico?: string;
  hero?: string;
  resultado?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  duracao?: number;
  iniciadaEm?: string | null;
  finalizadaEm?: string | null;
}

export interface LinhaPendente {
  id: number;
  matchId: string;
  accountId: string;
  trackingId: string;
  tipoServico: string;
  hero: string;
  resultado: string;
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  iniciadaEm: string | null;
  finalizadaEm: string;
  data: string;
  registroId: string | null;
  recalculoOk: number;
  status: string;
  tentativas: number;
  ultimoErro: string;
  createdAt: string;
  atualizadoEm: string;
}

export interface ResumoPendentes {
  pendentes: number;
  recalculoPendente: number;
  ultimoErro: string;
  atualizadoEm: string | null;
}

export interface ResultadoProcessarPendentes {
  processados: number;
  registrados: number;
  recalculados: number;
  falhas: number;
  pendentes: number;
  erros: string[];
}

export function contarPendentes(db: DatabaseSync): number {
  const row = db
    .prepare("SELECT COUNT(*) AS total FROM registros_pendentes WHERE status = 'pendente'")
    .get() as { total: number } | undefined;
  return Number(row?.total) || 0;
}

export function resumoPendentes(db: DatabaseSync): ResumoPendentes {
  const row = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status = 'pendente' THEN 1 ELSE 0 END) AS pendentes,
         SUM(CASE
               WHEN status = 'pendente' AND registroId IS NOT NULL AND recalculoOk = 0
               THEN 1 ELSE 0
             END) AS recalculoPendente,
         MAX(atualizadoEm) AS atualizadoEm
       FROM registros_pendentes
       WHERE status = 'pendente'`
    )
    .get() as
    | {
        pendentes: number | null;
        recalculoPendente: number | null;
        atualizadoEm: string | null;
      }
    | undefined;
  const erro = db
    .prepare(
      `SELECT ultimoErro FROM registros_pendentes
       WHERE status = 'pendente' AND ultimoErro <> ''
       ORDER BY atualizadoEm DESC, id DESC LIMIT 1`
    )
    .get() as { ultimoErro: string } | undefined;
  return {
    pendentes: Number(row?.pendentes) || 0,
    recalculoPendente: Number(row?.recalculoPendente) || 0,
    ultimoErro: String(erro?.ultimoErro ?? ''),
    atualizadoEm: row?.atualizadoEm ?? null,
  };
}

function trackingNormalizado(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase();
}

// Tipo do serviço no momento da partida: duo/grupo usa o pedido selecionado;
// solo usa o tipo salvo junto ao vínculo da conta.
function tipoDoPedido(
  db: DatabaseSync,
  trackingId: string,
  selecionado: string,
  tipoSelecionado: string
): string {
  if (!trackingId) return '';
  if (selecionado && trackingId === selecionado && tipoSelecionado) {
    return tipoSelecionado;
  }
  return getContaPedidoTipo(db, trackingId);
}

// Enfileira a partida (idempotente por matchId) e devolve o tracking usado.
export function enfileirarPartida(
  db: DatabaseSync,
  partida: PartidaParaRegistrar
): string {
  const matchId = String(partida.matchId ?? '').trim();
  if (!matchId) return '';

  const selecionado = getPedidoSelecionado(db);
  const tipoSelecionado = getPedidoSelecionadoTipo(db);
  const trackingId =
    trackingNormalizado(partida.trackingId) ||
    resolverPedidoDaPartida(db, partida.accountId, selecionado, tipoSelecionado);
  const tipoServico =
    String(partida.tipoServico ?? '').trim() ||
    tipoDoPedido(db, trackingId, selecionado, tipoSelecionado);
  const resultado = partida.resultado === 'L' ? 'L' : 'W';
  const data =
    dataHoraInicioPartida(partida.iniciadaEm, partida.finalizadaEm) ?? agoraLocal();

  db.prepare(
    `INSERT INTO registros_pendentes
       (matchId, accountId, trackingId, tipoServico, hero, resultado,
        kills, deaths, assists, duracao, iniciadaEm, finalizadaEm, data)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(matchId) DO UPDATE SET
       accountId = CASE
         WHEN excluded.accountId <> '' THEN excluded.accountId
         ELSE registros_pendentes.accountId
       END,
       trackingId = CASE
         WHEN excluded.trackingId <> '' THEN excluded.trackingId
         ELSE registros_pendentes.trackingId
       END,
       tipoServico = CASE
         WHEN excluded.tipoServico <> '' THEN excluded.tipoServico
         ELSE registros_pendentes.tipoServico
       END,
       hero = CASE WHEN excluded.hero <> '' THEN excluded.hero ELSE registros_pendentes.hero END,
       atualizadoEm = datetime('now','localtime')`
  ).run(
    matchId,
    String(partida.accountId ?? '').replace(/\D/g, ''),
    trackingId,
    tipoServico,
    String(partida.hero ?? ''),
    resultado,
    Number(partida.kills) || 0,
    Number(partida.deaths) || 0,
    Number(partida.assists) || 0,
    Number(partida.duracao) || 0,
    partida.iniciadaEm ?? null,
    partida.finalizadaEm ?? agoraLocal(),
    data
  );

  return trackingId;
}

function idadeEmDias(valor: unknown): number {
  const ms = Date.parse(String(valor ?? '').replace(' ', 'T'));
  return Number.isFinite(ms) ? (Date.now() - ms) / 86_400_000 : 0;
}

function marcarErro(db: DatabaseSync, id: number, erro: string): void {
  db.prepare(
    `UPDATE registros_pendentes
     SET tentativas = tentativas + 1,
         ultimoErro = ?,
         atualizadoEm = datetime('now','localtime')
     WHERE id = ?`
  ).run(String(erro ?? '').slice(0, 500), id);
}

function marcarIgnorado(db: DatabaseSync, id: number, motivo: string): void {
  db.prepare(
    `UPDATE registros_pendentes
     SET status = 'ignorado',
         ultimoErro = ?,
         atualizadoEm = datetime('now','localtime')
     WHERE id = ?`
  ).run(String(motivo ?? '').slice(0, 500), id);
}

function marcarRegistroCriado(
  db: DatabaseSync,
  id: number,
  registroId: string,
  tipoServico: string
): void {
  db.prepare(
    `UPDATE registros_pendentes
     SET registroId = ?,
         tipoServico = ?,
         ultimoErro = '',
         atualizadoEm = datetime('now','localtime')
     WHERE id = ?`
  ).run(registroId, tipoServico, id);
}

function marcarRegistrado(db: DatabaseSync, id: number): void {
  db.prepare(
    `UPDATE registros_pendentes
     SET status = 'registrado',
         recalculoOk = 1,
         ultimoErro = '',
         atualizadoEm = datetime('now','localtime')
     WHERE id = ?`
  ).run(id);
}

function limparAntigos(db: DatabaseSync): void {
  db.prepare(
    `DELETE FROM registros_pendentes
     WHERE status IN ('registrado', 'ignorado')
       AND atualizadoEm < datetime('now','localtime','-30 days')`
  ).run();
}

interface OpcoesProcessar {
  cliente?: ClienteSupabase;
  forcar?: boolean;
  limite?: number;
  timeoutMs?: number;
  silencioso?: boolean;
}

const globalPendentes = globalThis as unknown as {
  _registrosPendentesProcessando?: boolean;
  _registrosPendentesUltimaEm?: number;
};

function resultadoVazio(pendentes: number): ResultadoProcessarPendentes {
  return {
    processados: 0,
    registrados: 0,
    recalculados: 0,
    falhas: 0,
    pendentes,
    erros: [],
  };
}

// Processa a fila usando a sessão do usuário (cliente injetado) ou a sessão do
// request atual (createSupabaseServer via camada de dados).
export async function processarPendentes(
  db: DatabaseSync,
  opcoes: OpcoesProcessar = {}
): Promise<ResultadoProcessarPendentes> {
  if (globalPendentes._registrosPendentesProcessando) {
    return resultadoVazio(contarPendentes(db));
  }
  if (
    !opcoes.forcar &&
    Date.now() - (globalPendentes._registrosPendentesUltimaEm ?? 0) < THROTTLE_MS
  ) {
    return resultadoVazio(contarPendentes(db));
  }

  globalPendentes._registrosPendentesProcessando = true;
  globalPendentes._registrosPendentesUltimaEm = Date.now();

  const resultado: ResultadoProcessarPendentes = {
    processados: 0,
    registrados: 0,
    recalculados: 0,
    falhas: 0,
    pendentes: 0,
    erros: [],
  };

  try {
    limparAntigos(db);

    const limite = Math.min(
      Math.max(Math.round(Number(opcoes.limite) || LIMITE_POR_EXECUCAO), 1),
      20
    );
    const filtroTempo = opcoes.forcar
      ? ''
      : `AND (
           ultimoErro = ''
           OR atualizadoEm <= datetime('now','localtime','-${RETRY_APOS_SEGUNDOS} seconds')
         )`;
    const linhas = db
      .prepare(
        `SELECT * FROM registros_pendentes
         WHERE status = 'pendente' ${filtroTempo}
         ORDER BY id
         LIMIT ?`
      )
      .all(limite) as unknown as LinhaPendente[];

    for (const linha of linhas) {
      resultado.processados++;
      try {
        await processarLinha(db, linha, opcoes, resultado);
      } catch (e) {
        const msg = (e as Error)?.message ?? String(e);
        marcarErro(db, linha.id, msg);
        resultado.falhas++;
        resultado.erros.push(`#${linha.matchId}: ${msg}`);
      }
    }
  } finally {
    globalPendentes._registrosPendentesProcessando = false;
    resultado.pendentes = contarPendentes(db);
  }

  return resultado;
}

async function processarLinha(
  db: DatabaseSync,
  linha: LinhaPendente,
  opcoes: OpcoesProcessar,
  resultado: ResultadoProcessarPendentes
): Promise<void> {
  let trackingId = trackingNormalizado(linha.trackingId);

  if (!trackingId) {
    trackingId = resolverPedidoDaPartida(
      db,
      linha.accountId,
      getPedidoSelecionado(db),
      getPedidoSelecionadoTipo(db)
    );
    if (trackingId) {
      db.prepare(
        `UPDATE registros_pendentes
         SET trackingId = ?, atualizadoEm = datetime('now','localtime')
         WHERE id = ?`
      ).run(trackingId, linha.id);
      linha.trackingId = trackingId;
    }
  }

  if (!trackingId) {
    if (idadeEmDias(linha.createdAt) > RETENCAO_DIAS) {
      marcarIgnorado(db, linha.id, 'Sem conta/pedido vinculado após 7 dias.');
    } else {
      marcarErro(db, linha.id, 'Aguardando vínculo de conta/pedido.');
    }
    return;
  }

  const pedido = await obterPedidoPorTracking(trackingId, opcoes.cliente);
  if (!pedido) {
    if (idadeEmDias(linha.createdAt) > RETENCAO_DIAS) {
      marcarIgnorado(db, linha.id, `Pedido não encontrado para o tracking ${trackingId}.`);
    } else {
      marcarErro(db, linha.id, `Pedido não encontrado para o tracking ${trackingId}.`);
    }
    return;
  }

  const estado = String(pedido.estado ?? '');
  if (estado !== 'em_andamento') {
    if (estado === 'pausado') {
      if (idadeEmDias(linha.createdAt) > RETENCAO_DIAS) {
        marcarIgnorado(db, linha.id, 'Pedido pausado por mais de 7 dias.');
      } else {
        marcarErro(db, linha.id, 'Pedido pausado; aguardando retomada.');
      }
    } else {
      marcarIgnorado(
        db,
        linha.id,
        `Pedido não está mais em andamento (${estado || 'sem estado'}).`
      );
    }
    return;
  }

  let registroId = linha.registroId ? String(linha.registroId) : '';
  const origemId = `gsi:${linha.matchId}`;

  if (!registroId) {
    const existente = await registroPorOrigemId(origemId, opcoes.cliente);
    if (existente) {
      registroId = existente;
      marcarRegistroCriado(db, linha.id, registroId, pedido.tipo_servico);
      resultado.registrados++;
    } else {
      const tipo = isBoost(pedido.tipo_servico) ? 'mmr' : 'partidas';
      const dobro = String(pedido.cupom ?? '').trim().toUpperCase() === 'DOBRO';
      const passo = dobro ? MMR_POR_PARTIDA_DOBRO : MMR_POR_PARTIDA;
      const mmrInicial = Math.max(
        0,
        Math.round(Number(pedido.mmr_atual ?? pedido.mmr_inicial ?? 0) || 0)
      );
      const resultadoPartida = linha.resultado === 'L' ? 'L' : 'W';
      const delta = resultadoPartida === 'L' ? -passo : passo;
      const mmrFinal = Math.max(0, mmrInicial + delta);
      const data =
        dataHoraInicioPartida(linha.iniciadaEm, linha.finalizadaEm) ||
        linha.data ||
        agoraLocal();

      try {
        const registro = await criarRegistro(
          {
            pedido_id: pedido.id,
            tipo,
            data,
            mmr_inicial: tipo === 'mmr' ? mmrInicial : undefined,
            mmr_final: tipo === 'mmr' ? mmrFinal : undefined,
            quantidade: tipo === 'partidas' ? 1 : undefined,
            medalha: String(pedido.medalha ?? ''),
            observacoes: '',
            hero: linha.hero,
            resultado: resultadoPartida,
            kills: linha.kills,
            deaths: linha.deaths,
            assists: linha.assists,
            origemId,
            automatico: true,
          },
          opcoes.cliente
        );
        registroId = String(registro.id);
      } catch (e) {
        // Corrida/retry: se o registro já existe com o mesmo origem_id,
        // aproveita em vez de falhar.
        const existenteAgora = await registroPorOrigemId(origemId, opcoes.cliente);
        if (!existenteAgora) throw e;
        registroId = existenteAgora;
      }

      marcarRegistroCriado(db, linha.id, registroId, pedido.tipo_servico);
      linha.registroId = registroId;
      resultado.registrados++;

      registrarEventoOverlay(
        db,
        'vinculo_auto',
        `Partida registrada automaticamente no pedido ${trackingId}`,
        {
          pedidoId: pedido.id,
          trackingId,
          matchId: linha.matchId,
          hero: linha.hero,
          resultado: resultadoPartida,
          registroId,
          tipo,
        }
      );
    }
  }

  if (Number(linha.recalculoOk) === 1) {
    marcarRegistrado(db, linha.id);
    return;
  }

  try {
    await recalcularPedido(pedido.id, {
      timeoutMs: opcoes.timeoutMs ?? 8_000,
      cliente: opcoes.cliente,
    });
    marcarRegistrado(db, linha.id);
    resultado.recalculados++;
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    marcarErro(db, linha.id, `Registro salvo, mas o site não recalculou: ${msg}`);
    resultado.falhas++;
    resultado.erros.push(`#${linha.matchId}: ${msg}`);
  }
}
