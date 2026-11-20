// GSI do Dota 2: estado ao vivo + partidas locais para W/L e cenas do OBS.
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';
import { getDb } from './db';
import { agoraLocal, ehServicoDuo } from './helpers';
import { registrarEventoOverlay } from './overlayEventos';
import { aoEstadoGsi } from './obsCenas';
import { accountIdDeSteamId } from './contaDota';
import {
  getPedidoSelecionado,
  getPedidoSelecionadoTipo,
  setPedidoSelecionado,
} from './pedidoSelecionado';
import {
  getContaPedido,
  getContaPedidoTipo,
  listarContasPedidos,
  resolverPedidoDaPartida,
} from './pedidoContas';
import { enfileirarPartida } from './registrosPendentes';

export interface PayloadGsi {
  map?: Record<string, unknown>;
  player?: Record<string, unknown>;
  hero?: Record<string, unknown>;
  auth?: Record<string, unknown>;
  // Payload sintético do botão "Testar recebimento": confirma que a rota
  // pública está acessível e com o token certo, sem mexer na partida.
  teste?: boolean;
}

export interface GsiRequestMeta {
  host?: string;
  bytes?: number;
  ip?: string;
}

export interface GsiDiagnosticoPayload {
  em: number;
  gameState: string;
  matchId: string | null;
  accountId: string;
  hero: string;
  host: string;
  bytes: number;
  teste: boolean;
}

export interface GsiDiagnosticoRejeicao {
  em: number;
  motivo: 'token' | 'json' | 'outro';
  host: string;
  bytes: number;
  // Só o prefixo/tamanho: o token inteiro nunca é persistido no diagnóstico.
  tokenPrefixo: string;
  tokenTamanho: number;
}

export interface GsiDiagnostico {
  ultimoPayload: GsiDiagnosticoPayload | null;
  ultimaRejeicao: GsiDiagnosticoRejeicao | null;
  aceitos: number;
  rejeitados: number;
  ultimoTesteEm: number | null;
}

function diagnosticoVazio(): GsiDiagnostico {
  return {
    ultimoPayload: null,
    ultimaRejeicao: null,
    aceitos: 0,
    rejeitados: 0,
    ultimoTesteEm: null,
  };
}

interface EstadoGsiInterno {
  ultimoContatoEm: number | null;
  gameState: string;
  matchId: string | null;
  hero: string;
  accountId: string;
  steamId: string;
  kills: number;
  deaths: number;
  assists: number;
  clock: number;
  ultimoClock: number;
  teamName: string;
  winTeam: string;
  winTeamMatchId: string;
  iniciadaEm: string | null;
  partidaContada: boolean;
  ultimaPartida: { id: number; matchId: string | null; resultado: string; hero: string } | null;
  ultimaContaEvento: string;
  ultimoErroPartida: string;
  ultimoPostGameMatchId: string;
  silencioTratado: boolean;
  diagnostico: GsiDiagnostico;
  diagCarregado: boolean;
  diagPersistidoEm: number;
  ultimoAndamentoEm: number;
  ultimoAndamentoMatchId: string;
  ultimoAndamentoEstado: string;
}

const globalForGsi = globalThis as unknown as {
  _gsiTheone?: EstadoGsiInterno;
  _gsiWatchdogTheone?: ReturnType<typeof setInterval>;
};

function estadoInterno(): EstadoGsiInterno {
  if (!globalForGsi._gsiTheone) {
    globalForGsi._gsiTheone = {
      ultimoContatoEm: null,
      gameState: '',
      matchId: null,
      hero: '',
      accountId: '',
      steamId: '',
      kills: 0,
      deaths: 0,
      assists: 0,
      clock: 0,
      ultimoClock: 0,
      teamName: '',
      winTeam: '',
      winTeamMatchId: '',
      iniciadaEm: null,
      partidaContada: false,
      ultimaPartida: null,
      ultimaContaEvento: '',
      ultimoErroPartida: '',
      ultimoPostGameMatchId: '',
      silencioTratado: false,
      diagnostico: diagnosticoVazio(),
      diagCarregado: false,
      diagPersistidoEm: 0,
      ultimoAndamentoEm: 0,
      ultimoAndamentoMatchId: '',
      ultimoAndamentoEstado: '',
    };
  }
  return globalForGsi._gsiTheone;
}

const CONFIG_DIAGNOSTICO_GSI = 'gsi_diagnostico';
const DIAGNOSTICO_PERSISTIR_MS = 5_000;

function carregarDiagnostico(db: DatabaseSync, s: EstadoGsiInterno): void {
  if (s.diagCarregado) return;
  s.diagCarregado = true;
  let bruto: string | null = null;
  try {
    bruto = getConfigValor(db, CONFIG_DIAGNOSTICO_GSI);
  } catch {
    // Diagnóstico é acessório; não pode derrubar o estado ao vivo.
    return;
  }
  if (!bruto) return;
  try {
    const parsed = JSON.parse(bruto) as Partial<GsiDiagnostico>;
    s.diagnostico = {
      ultimoPayload: parsed.ultimoPayload ?? null,
      ultimaRejeicao: parsed.ultimaRejeicao ?? null,
      aceitos: Number(parsed.aceitos) || 0,
      rejeitados: Number(parsed.rejeitados) || 0,
      ultimoTesteEm: Number(parsed.ultimoTesteEm) || null,
    };
  } catch {
    // Diagnóstico antigo/ilegível: recomeça sem derrubar o GSI.
  }
}

function persistirDiagnostico(
  db: DatabaseSync,
  s: EstadoGsiInterno,
  forcar = false
): void {
  const agora = Date.now();
  if (!forcar && agora - s.diagPersistidoEm < DIAGNOSTICO_PERSISTIR_MS) return;
  s.diagPersistidoEm = agora;
  try {
    setConfigValor(db, CONFIG_DIAGNOSTICO_GSI, JSON.stringify(s.diagnostico));
  } catch {
    // Diagnóstico é acessório: nunca derruba o processamento do GSI.
  }
}

export function getDiagnosticoGsi(): GsiDiagnostico {
  const db = getDb();
  const s = estadoInterno();
  carregarDiagnostico(db, s);
  return s.diagnostico;
}

export function registrarPayloadInvalido(
  meta: GsiRequestMeta,
  motivo: GsiDiagnosticoRejeicao['motivo'] = 'token',
  tokenRecebido = ''
): void {
  const db = getDb();
  const s = estadoInterno();
  carregarDiagnostico(db, s);
  const token = String(tokenRecebido ?? '');
  s.diagnostico.ultimaRejeicao = {
    em: Date.now(),
    motivo,
    host: String(meta.host ?? ''),
    bytes: Number(meta.bytes) || 0,
    tokenPrefixo: token.slice(0, 4),
    tokenTamanho: token.length,
  };
  s.diagnostico.rejeitados++;
  persistirDiagnostico(db, s, true);
  const detalhe =
    motivo === 'json'
      ? 'payload JSON inválido'
      : token
        ? `token ${token.slice(0, 4)}… (${token.length} chars)`
        : 'token ausente';
  console.warn(
    `[GSI] Payload rejeitado (${detalhe}) host=${meta.host || '—'} bytes=${Number(meta.bytes) || 0}`
  );
}

const GSI_MENU = 'menu';
const GSI_TESTANDO_HEROI = 'testando_heroi';
const GSI_ONLINE_JANELA_MS = 40_000;
const GSI_SILENCIO_MENU_MS = 60_000;
const GSI_WATCHDOG_INTERVALO_MS = 15_000;

export function getGsiToken(db: DatabaseSync): string {
  const existente = (getConfigValor(db, 'gsi_token') ?? '').trim();
  if (/^[a-f0-9]{16,64}$/i.test(existente)) return existente;
  const token = crypto.randomBytes(16).toString('hex');
  setConfigValor(db, 'gsi_token', token);
  return token;
}

function verificarSilencioGsi(): void {
  const s = estadoInterno();
  if (s.ultimoContatoEm == null) return;
  if (Date.now() - s.ultimoContatoEm < GSI_SILENCIO_MENU_MS) return;
  if (s.silencioTratado) return;
  s.silencioTratado = true;
  try {
    aoEstadoGsi(getDb(), '');
  } catch {
    // OBS indisponível.
  }
}

function iniciarWatchdogGsi(): void {
  if (globalForGsi._gsiWatchdogTheone) return;
  const timer = setInterval(verificarSilencioGsi, GSI_WATCHDOG_INTERVALO_MS);
  timer.unref?.();
  globalForGsi._gsiWatchdogTheone = timer;
}

const ESTADOS_LOCAIS_GSI = new Set([
  'DOTA_GAMERULES_STATE_PRE_GAME',
  'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
  'DOTA_GAMERULES_STATE_POST_GAME',
]);

function matchIdValidoGsi(matchId: string | null): boolean {
  return matchId != null && matchId !== '' && matchId !== '0';
}

function estadoGsiExibido(s: EstadoGsiInterno): string {
  if (!s.gameState) return GSI_MENU;
  if (!matchIdValidoGsi(s.matchId) && ESTADOS_LOCAIS_GSI.has(s.gameState)) {
    return GSI_TESTANDO_HEROI;
  }
  return s.gameState;
}

export interface EstadoGsi {
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
  ultimaPartida: { id: number; matchId: string | null; resultado: string; hero: string } | null;
  ultimoErroPartida: string;
}

export function getEstadoGsi(): EstadoGsi {
  const db = getDb();
  const s = estadoInterno();
  carregarDiagnostico(db, s);
  // Depois de um reinício do servidor o estado em memória some; o último
  // payload persistido mantém o painel "online" enquanto o Dota continua
  // enviando (o próximo POST renova o contato de qualquer forma).
  const ultimoContato =
    s.ultimoContatoEm ?? s.diagnostico.ultimoPayload?.em ?? null;
  return {
    online:
      ultimoContato != null && Date.now() - ultimoContato < GSI_ONLINE_JANELA_MS,
    ultimoContatoEm: ultimoContato,
    gameState: estadoGsiExibido(s),
    matchId: s.matchId,
    hero: s.hero,
    accountId: s.accountId || null,
    steamId: s.steamId || null,
    kills: s.kills,
    deaths: s.deaths,
    assists: s.assists,
    duracao: s.clock,
    iniciadaEm: s.iniciadaEm,
    emPartida: s.gameState === 'DOTA_GAMERULES_STATE_GAME_IN_PROGRESS',
    ultimaPartida: s.ultimaPartida,
    ultimoErroPartida: s.ultimoErroPartida,
  };
}

interface DadosPartida {
  matchId: string | null;
  accountId?: string;
  steamId?: string;
  trackingId?: string;
  hero?: string;
  resultado: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  duracao?: number;
  iniciadaEm?: string | null;
  finalizadaEm?: string;
  fonte?: string;
}

function salvarPartida(
  db: DatabaseSync,
  dados: DadosPartida
): { id: number; matchId: string | null; resultado: string; hero: string; nova: boolean } {
  const matchId = dados.matchId ? String(dados.matchId) : null;
  if (matchId) {
    const existente = db
      .prepare('SELECT id, matchId, resultado, hero, trackingId FROM partidas WHERE matchId = ?')
      .get(matchId) as
      | { id: number; matchId: string | null; resultado: string; hero: string; trackingId: string | null }
      | undefined;
    if (existente) {
      // Partida salva antes de a conta ser vinculada: aproveita o vínculo novo.
      const trackingNovo = String(dados.trackingId ?? '').trim().toUpperCase();
      if (trackingNovo && !existente.trackingId) {
        db.prepare('UPDATE partidas SET trackingId = ? WHERE id = ?').run(trackingNovo, existente.id);
        existente.trackingId = trackingNovo;
      }
      return { ...existente, nova: false };
    }
  }
  const info = db
    .prepare(
      `INSERT INTO partidas
        (matchId, accountId, steamId, trackingId, hero, resultado, kills, deaths, assists, duracao, iniciadaEm, finalizadaEm, fonte)
       VALUES (@matchId, @accountId, @steamId, @trackingId, @hero, @resultado, @kills, @deaths, @assists, @duracao, @iniciadaEm, @finalizadaEm, @fonte)`
    )
    .run({
      matchId,
      accountId: String(dados.accountId ?? ''),
      steamId: String(dados.steamId ?? ''),
      trackingId: String(dados.trackingId ?? '').trim().toUpperCase(),
      hero: String(dados.hero ?? ''),
      resultado: dados.resultado === 'L' ? 'L' : 'W',
      kills: Number(dados.kills) || 0,
      deaths: Number(dados.deaths) || 0,
      assists: Number(dados.assists) || 0,
      duracao: Number(dados.duracao) || 0,
      iniciadaEm: dados.iniciadaEm ?? null,
      finalizadaEm: dados.finalizadaEm ?? agoraLocal(),
      fonte: dados.fonte === 'manual' ? 'manual' : 'gsi',
    });
  return {
    id: Number(info.lastInsertRowid),
    matchId,
    resultado: dados.resultado === 'L' ? 'L' : 'W',
    hero: String(dados.hero ?? ''),
    nova: true,
  };
}

// ─── Partida em andamento (sobrevive a reinício do servidor) ────────────────

interface AndamentoGsi {
  matchId: string;
  accountId: string;
  steamId: string;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  radiantScore: number;
  direScore: number;
  teamName: string;
  winTeam: string;
  gameState: string;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  status: 'em_andamento' | 'post_game' | 'interrompida';
  atualizadoEm: string;
}

export interface PartidaPendenteGsi {
  matchId: string;
  accountId: string;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  duracao: number;
  iniciadaEm: string | null;
  finalizadaEm: string | null;
  gameState: string;
  status: 'post_game' | 'interrompida';
  atualizadoEm: string;
  resultadoSugerido: 'W' | 'L' | null;
}

const ANDAMENTO_PERSISTIR_MS = 5_000;
// Se o servidor ficou fechado, o snapshot para de atualizar. Depois de 1h
// sem contato a partida é tratada como interrompida (o próximo payload, se o
// jogo ainda estiver rolando, volta o status para "em andamento").
const PENDENTE_ABANDONO_HORAS = 1;

function mapearAndamento(row: Record<string, unknown>): AndamentoGsi {
  const status =
    row.status === 'post_game'
      ? 'post_game'
      : row.status === 'interrompida'
        ? 'interrompida'
        : 'em_andamento';
  return {
    matchId: String(row.matchId ?? ''),
    accountId: String(row.accountId ?? ''),
    steamId: String(row.steamId ?? ''),
    hero: String(row.hero ?? ''),
    kills: Number(row.kills) || 0,
    deaths: Number(row.deaths) || 0,
    assists: Number(row.assists) || 0,
    duracao: Number(row.duracao) || 0,
    radiantScore: Number(row.radiantScore) || 0,
    direScore: Number(row.direScore) || 0,
    teamName: String(row.teamName ?? ''),
    winTeam: String(row.winTeam ?? ''),
    gameState: String(row.gameState ?? ''),
    iniciadaEm: row.iniciadaEm == null ? null : String(row.iniciadaEm),
    finalizadaEm: row.finalizadaEm == null ? null : String(row.finalizadaEm),
    status,
    atualizadoEm: String(row.atualizadoEm ?? ''),
  };
}

// Grava o estado da partida de tempos em tempos. O upsert nunca "piora" um
// dado já conhecido: campos vazios/zerados de um payload magro não apagam o
// que foi visto antes (KDA, placar, time, início).
function salvarAndamentoGsi(
  db: DatabaseSync,
  s: EstadoGsiInterno,
  gameState: string,
  map: Record<string, unknown>
): void {
  if (!matchIdValidoGsi(s.matchId)) return;
  const matchId = String(s.matchId);
  const status: AndamentoGsi['status'] =
    gameState === 'DOTA_GAMERULES_STATE_POST_GAME' ? 'post_game' : 'em_andamento';
  const agora = Date.now();
  const mudouAlvo = s.ultimoAndamentoMatchId !== matchId;
  const mudouEstado = s.ultimoAndamentoEstado !== gameState;
  if (!mudouAlvo && !mudouEstado && agora - s.ultimoAndamentoEm < ANDAMENTO_PERSISTIR_MS) {
    return;
  }

  db.prepare(
    `INSERT INTO gsi_andamento
       (matchId, accountId, steamId, hero, kills, deaths, assists, duracao,
        radiantScore, direScore, teamName, winTeam, gameState, status,
        iniciadaEm, finalizadaEm, atualizadoEm)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now','localtime'))
     ON CONFLICT(matchId) DO UPDATE SET
       accountId = CASE WHEN excluded.accountId <> '' THEN excluded.accountId ELSE gsi_andamento.accountId END,
       steamId = CASE WHEN excluded.steamId <> '' THEN excluded.steamId ELSE gsi_andamento.steamId END,
       hero = CASE WHEN excluded.hero <> '' THEN excluded.hero ELSE gsi_andamento.hero END,
       kills = CASE WHEN excluded.kills > 0 OR gsi_andamento.kills = 0 THEN excluded.kills ELSE gsi_andamento.kills END,
       deaths = CASE WHEN excluded.deaths > 0 OR gsi_andamento.deaths = 0 THEN excluded.deaths ELSE gsi_andamento.deaths END,
       assists = CASE WHEN excluded.assists > 0 OR gsi_andamento.assists = 0 THEN excluded.assists ELSE gsi_andamento.assists END,
       duracao = CASE WHEN excluded.duracao > 0 THEN excluded.duracao ELSE gsi_andamento.duracao END,
       radiantScore = CASE WHEN excluded.radiantScore > 0 THEN excluded.radiantScore ELSE gsi_andamento.radiantScore END,
       direScore = CASE WHEN excluded.direScore > 0 THEN excluded.direScore ELSE gsi_andamento.direScore END,
       teamName = CASE WHEN excluded.teamName <> '' THEN excluded.teamName ELSE gsi_andamento.teamName END,
       winTeam = CASE WHEN excluded.winTeam <> '' THEN excluded.winTeam ELSE gsi_andamento.winTeam END,
       gameState = excluded.gameState,
       status = CASE WHEN gsi_andamento.status = 'post_game' AND excluded.status = 'em_andamento'
                     THEN gsi_andamento.status ELSE excluded.status END,
       iniciadaEm = COALESCE(gsi_andamento.iniciadaEm, excluded.iniciadaEm),
       finalizadaEm = COALESCE(gsi_andamento.finalizadaEm, excluded.finalizadaEm),
       atualizadoEm = datetime('now','localtime')`
  ).run(
    matchId,
    s.accountId,
    s.steamId,
    s.hero,
    s.kills,
    s.deaths,
    s.assists,
    s.clock,
    Number(map.radiant_score) || 0,
    Number(map.dire_score) || 0,
    s.teamName,
    s.winTeamMatchId === matchId ? s.winTeam : '',
    gameState,
    status,
    s.iniciadaEm,
    status === 'post_game' ? agoraLocal() : null
  );

  s.ultimoAndamentoEm = agora;
  s.ultimoAndamentoMatchId = matchId;
  s.ultimoAndamentoEstado = gameState;
}

function obterAndamentoGsi(db: DatabaseSync, matchId: string): AndamentoGsi | null {
  const row = db.prepare('SELECT * FROM gsi_andamento WHERE matchId = ?').get(matchId) as
    | Record<string, unknown>
    | undefined;
  return row ? mapearAndamento(row) : null;
}

function removerAndamentoGsi(db: DatabaseSync, matchId: string): boolean {
  const info = db.prepare('DELETE FROM gsi_andamento WHERE matchId = ?').run(matchId);
  return Number(info.changes) > 0;
}

function resultadoSugeridoAndamento(andamento: AndamentoGsi): 'W' | 'L' | null {
  if (andamento.winTeam && andamento.winTeam !== 'none' && andamento.teamName) {
    return andamento.winTeam === andamento.teamName ? 'W' : 'L';
  }
  // Placar só vale como sugestão quando o jogo realmente terminou; numa
  // partida interrompida o placar pode ser parcial.
  if (
    andamento.status === 'post_game' &&
    andamento.teamName &&
    andamento.radiantScore !== andamento.direScore
  ) {
    const vencedor = andamento.radiantScore > andamento.direScore ? 'radiant' : 'dire';
    return vencedor === andamento.teamName ? 'W' : 'L';
  }
  return null;
}

// Partidas que terminaram mas não puderam ser registradas (payload final sem
// vencedor/time/placar, servidor fechado no fim do jogo etc.).
export function listarPartidasPendentes(db: DatabaseSync): PartidaPendenteGsi[] {
  // Limpa pendências antigas que nunca foram completadas/descartadas.
  db.prepare(
    `DELETE FROM gsi_andamento
     WHERE status IN ('post_game','interrompida')
       AND atualizadoEm < datetime('now','localtime','-30 days')`
  ).run();

  // Partida em andamento sem contato por muito tempo: o servidor ficou
  // fechado ou o Dota foi encerrado. Mantém para completar manualmente.
  db.prepare(
    `UPDATE gsi_andamento
     SET status = 'interrompida',
         finalizadaEm = COALESCE(finalizadaEm, datetime('now','localtime')),
         atualizadoEm = datetime('now','localtime')
     WHERE status = 'em_andamento'
       AND atualizadoEm < datetime('now','localtime','-${PENDENTE_ABANDONO_HORAS} hours')`
  ).run();

  const rows = db
    .prepare(
      `SELECT * FROM gsi_andamento
       WHERE status IN ('post_game','interrompida')
       ORDER BY COALESCE(finalizadaEm, atualizadoEm) DESC, matchId DESC
       LIMIT 10`
    )
    .all() as unknown as Record<string, unknown>[];

  return rows.map((row) => {
    const andamento = mapearAndamento(row);
    return {
      matchId: andamento.matchId,
      accountId: andamento.accountId,
      hero: andamento.hero,
      kills: andamento.kills,
      deaths: andamento.deaths,
      assists: andamento.assists,
      duracao: andamento.duracao,
      iniciadaEm: andamento.iniciadaEm,
      finalizadaEm: andamento.finalizadaEm,
      gameState: andamento.gameState,
      status: andamento.status === 'interrompida' ? 'interrompida' : 'post_game',
      atualizadoEm: andamento.atualizadoEm,
      resultadoSugerido: resultadoSugeridoAndamento(andamento),
    };
  });
}

// Registra uma partida no pedido (vínculo + tabela local + fila do Supabase).
function registrarPartidaNoPedido(
  db: DatabaseSync,
  dados: DadosPartida
): {
  partida: { id: number; matchId: string | null; resultado: string; hero: string; nova: boolean };
  trackingId: string;
} {
  const selecionado = getPedidoSelecionado(db);
  const tipoSelecionado =
    getPedidoSelecionadoTipo(db) ||
    (selecionado ? getContaPedidoTipo(db, selecionado) : '');
  const trackingId = resolverPedidoDaPartida(
    db,
    String(dados.accountId ?? ''),
    selecionado,
    tipoSelecionado
  );
  const tipoServico = trackingId
    ? trackingId === selecionado && tipoSelecionado
      ? tipoSelecionado
      : getContaPedidoTipo(db, trackingId)
    : '';

  const partida = salvarPartida(db, { ...dados, trackingId, fonte: 'gsi' });
  enfileirarPartida(db, {
    matchId: dados.matchId ?? '',
    accountId: String(dados.accountId ?? ''),
    trackingId,
    tipoServico,
    hero: String(dados.hero ?? ''),
    resultado: dados.resultado,
    kills: dados.kills,
    deaths: dados.deaths,
    assists: dados.assists,
    duracao: dados.duracao,
    iniciadaEm: dados.iniciadaEm ?? null,
    finalizadaEm: dados.finalizadaEm ?? agoraLocal(),
  });
  return { partida, trackingId };
}

// Completa manualmente uma partida que ficou pendente. Usa o snapshot para
// não perder herói/KDA/duração e segue o mesmo caminho do POST_GAME.
export function finalizarPartidaPendente(
  db: DatabaseSync,
  matchId: string,
  resultado: 'W' | 'L'
): { ok: boolean; erro?: string; trackingId?: string; partidaId?: number } {
  const id = String(matchId ?? '').trim();
  if (!matchIdValidoGsi(id)) return { ok: false, erro: 'Match ID inválido.' };

  const andamento = obterAndamentoGsi(db, id);
  if (!andamento) return { ok: false, erro: 'Partida pendente não encontrada.' };

  const existente = db
    .prepare('SELECT id FROM partidas WHERE matchId = ?')
    .get(id) as { id: number } | undefined;
  if (existente) {
    removerAndamentoGsi(db, id);
    const s = estadoInterno();
    s.ultimoErroPartida = '';
    s.ultimoPostGameMatchId = '';
    return { ok: true, partidaId: existente.id };
  }

  const registrada = registrarPartidaNoPedido(db, {
    matchId: id,
    accountId: andamento.accountId,
    steamId: andamento.steamId,
    hero: andamento.hero,
    resultado,
    kills: andamento.kills,
    deaths: andamento.deaths,
    assists: andamento.assists,
    duracao: andamento.duracao,
    iniciadaEm: andamento.iniciadaEm,
    finalizadaEm: andamento.finalizadaEm ?? agoraLocal(),
  });
  removerAndamentoGsi(db, id);
  registrarEventoOverlay(
    db,
    'jogo_salvo',
    `Jogo salvo manualmente: ${resultado === 'W' ? 'Vitória' : 'Derrota'}${
      andamento.hero ? ` · ${andamento.hero}` : ''
    }${
      registrada.trackingId
        ? ` · pedido ${registrada.trackingId} · aguardando registro`
        : ' · sem vínculo'
    }`,
    {
      partidaId: registrada.partida.id,
      matchId: id,
      resultado,
      hero: andamento.hero,
      trackingId: registrada.trackingId || null,
      manual: true,
    }
  );

  // Some com o alerta de "fim de partida sem resultado" no Ao Vivo.
  const s = estadoInterno();
  s.ultimoErroPartida = '';
  s.ultimoPostGameMatchId = '';
  s.ultimaPartida = {
    id: registrada.partida.id,
    matchId: registrada.partida.matchId,
    resultado: registrada.partida.resultado,
    hero: registrada.partida.hero,
  };

  return {
    ok: true,
    trackingId: registrada.trackingId,
    partidaId: registrada.partida.id,
  };
}

export function descartarPartidaPendente(db: DatabaseSync, matchId: string): boolean {
  const removeu = removerAndamentoGsi(db, String(matchId ?? '').trim());
  if (removeu) {
    const s = estadoInterno();
    s.ultimoErroPartida = '';
    s.ultimoPostGameMatchId = '';
  }
  return removeu;
}

// Conta detectada: registra o evento e reconcilia o pedido selecionado com a
// conta logada. Duo/grupo continua manual (o booster joga na própria conta);
// solo passa a seguir o único pedido vinculado à conta, mesmo que exista uma
// seleção antiga de outro pedido.
function sincronizarSelecaoPorConta(db: DatabaseSync, conta: string): void {
  if (!conta) return;
  const s = estadoInterno();
  if (conta !== s.ultimaContaEvento) {
    s.ultimaContaEvento = conta;
    const vinculo = listarContasPedidos(db).find((c) => c.accountId === conta);
    registrarEventoOverlay(
      db,
      'conta_detectada',
      `Conta logada no Dota 2 detectada: ${conta}${vinculo ? ` · pedido ${vinculo.trackingId}` : ''}`,
      {
        accountId: conta,
        ...(vinculo ? { trackingId: vinculo.trackingId } : {}),
      }
    );
  }

  const selecionado = getPedidoSelecionado(db);
  const tipoSelecionado =
    getPedidoSelecionadoTipo(db) ||
    (selecionado ? getContaPedidoTipo(db, selecionado) : '');

  // Duo/grupo é escolha manual: o booster joga na própria conta.
  if (selecionado && ehServicoDuo(tipoSelecionado)) return;

  const contas = listarContasPedidos(db).filter(
    (c) => c.accountId === conta && !ehServicoDuo(c.tipoServico)
  );

  if (contas.length === 1) {
    const alvo = contas[0];
    if (selecionado !== alvo.trackingId) {
      setPedidoSelecionado(db, alvo.trackingId, alvo.tipoServico);
      registrarEventoOverlay(
        db,
        'vinculo_auto',
        `Pedido ${alvo.trackingId} selecionado automaticamente pela conta ${conta}`,
        {
          accountId: conta,
          trackingId: alvo.trackingId,
          tipoServico: alvo.tipoServico,
        }
      );
    }
    return;
  }

  // Sem vínculo único para a conta: se a seleção é solo de outra conta,
  // limpa para a overlay não ficar presa em um pedido errado.
  const contaSelecionada = selecionado ? getContaPedido(db, selecionado) : '';
  if (
    selecionado &&
    !ehServicoDuo(tipoSelecionado) &&
    contaSelecionada &&
    contaSelecionada !== conta
  ) {
    setPedidoSelecionado(db, '', '');
    registrarEventoOverlay(
      db,
      'vinculo_auto',
      `Pedido ${selecionado} limpo: a conta logada (${conta}) é diferente da conta do pedido (${contaSelecionada}).`,
      {
        accountId: conta,
        trackingIdAnterior: selecionado,
        contaAnterior: contaSelecionada,
      }
    );
  }
}

// account_id do jogador local. O Dota 2 pode mandar o account_id de 32 bits em
// player.accountid ou o SteamID64 em player.steamid; aceita os dois formatos.
function accountIdDoPlayer(player: Record<string, unknown>): string {
  const accountId = String(player.accountid ?? '').replace(/\D/g, '');
  if (accountId) return accountId;
  const steamId = String(player.steamid ?? '').trim();
  if (/^\d{1,15}$/.test(steamId)) return steamId;
  return accountIdDeSteamId(steamId);
}

// Resultado da partida: usa win_team/team_name e, se o Dota não mandar o
// vencedor no payload final, cai para o placar radiant/dire.
function resultadoDaPartida(
  winTeam: string,
  playerTeam: string,
  map: Record<string, unknown>
): 'W' | 'L' | null {
  if (winTeam && winTeam !== 'none' && playerTeam) {
    return winTeam === playerTeam ? 'W' : 'L';
  }

  const radiant = Number(map.radiant_score);
  const dire = Number(map.dire_score);
  if (playerTeam && Number.isFinite(radiant) && Number.isFinite(dire) && radiant !== dire) {
    const vencedor = radiant > dire ? 'radiant' : 'dire';
    return vencedor === playerTeam ? 'W' : 'L';
  }

  return null;
}

// Processa o payload GSI: estado ao vivo, cenas e salvamento de partidas.
export function processarGsi(payload: PayloadGsi, meta: GsiRequestMeta = {}): void {
  const db = getDb();
  const s = estadoInterno();
  carregarDiagnostico(db, s);

  // Teste do painel: não mexe em conta, partida nem contato real. Serve para
  // confirmar que a rota pública está acessível e com o token certo.
  if (payload.teste) {
    s.diagnostico.ultimoTesteEm = Date.now();
    persistirDiagnostico(db, s, true);
    return;
  }

  iniciarWatchdogGsi();
  const map = payload.map ?? {};
  const player = payload.player ?? {};
  const hero = payload.hero ?? {};
  const gameState = String(map.game_state ?? '');
  const estadoAnterior = s.gameState;

  const contatoAnterior = s.ultimoContatoEm;
  s.ultimoContatoEm = Date.now();
  s.silencioTratado = false;
  if (contatoAnterior == null || Date.now() - contatoAnterior > GSI_ONLINE_JANELA_MS) {
    registrarEventoOverlay(db, 'gsi_conectado', 'GSI conectado — Dota 2 enviando dados');
  }

  if (gameState) {
    s.gameState = gameState;
  } else {
    s.gameState = '';
    s.matchId = null;
    s.hero = '';
    s.kills = 0;
    s.deaths = 0;
    s.assists = 0;
    s.clock = 0;
    s.iniciadaEm = null;
    s.partidaContada = false;
  }

  const matchIdBruto = map.matchid;
  if (
    matchIdBruto !== undefined &&
    matchIdBruto !== null &&
    String(matchIdBruto) !== '' &&
    String(matchIdBruto) !== '0'
  ) {
    s.matchId = String(matchIdBruto);
  }

  const heroNome = String(hero.name ?? '').replace('npc_dota_hero_', '');
  if (heroNome) s.hero = heroNome;
  // Payloads magros (principalmente no fim da partida) não podem zerar o que
  // já foi visto: só sobrescreve o campo quando ele veio no payload.
  if (player.kills != null) s.kills = Number(player.kills) || 0;
  if (player.deaths != null) s.deaths = Number(player.deaths) || 0;
  if (player.assists != null) s.assists = Number(player.assists) || 0;
  if (map.clock_time != null) s.clock = Number(map.clock_time) || 0;
  if (s.clock > 0) s.ultimoClock = s.clock;

  const teamName = String(player.team_name ?? '').toLowerCase();
  if (teamName) s.teamName = teamName;
  const winTeam = String(map.win_team ?? '').toLowerCase();
  if (winTeam && winTeam !== 'none') {
    s.winTeam = winTeam;
    s.winTeamMatchId = s.matchId ?? '';
  }

  const steamId = String(player.steamid ?? '');
  if (steamId) s.steamId = steamId;
  const acc = accountIdDoPlayer(player);
  if (acc) s.accountId = acc;
  if (s.accountId) sincronizarSelecaoPorConta(db, s.accountId);

  const activity = String(player.activity ?? '').toLowerCase();
  const semPartida = !gameState || activity === 'menu';
  try {
    aoEstadoGsi(db, semPartida ? '' : gameState);
  } catch {
    // OBS indisponível.
  }

  if (gameState && gameState !== estadoAnterior) {
    if (gameState === 'DOTA_GAMERULES_STATE_HERO_SELECTION') {
      s.iniciadaEm = new Date().toISOString();
      s.partidaContada = false;
      s.matchId = null;
      s.ultimaPartida = null;
      s.kills = 0;
      s.deaths = 0;
      s.assists = 0;
      s.clock = 0;
      s.ultimoClock = 0;
      s.teamName = '';
      s.winTeam = '';
      s.winTeamMatchId = '';
      s.ultimoErroPartida = '';
      s.ultimoPostGameMatchId = '';
    } else if (gameState === 'DOTA_GAMERULES_STATE_PRE_GAME') {
      s.partidaContada = false;
      if (!s.iniciadaEm) s.iniciadaEm = new Date().toISOString();
    }
  }

  if (gameState && gameState !== estadoAnterior) {
    console.log(
      `[GSI] estado=${gameState} match=${s.matchId ?? '—'} conta=${
        s.accountId || '—'
      } herói=${s.hero || '—'}`
    );
  }

  // Snapshot persistido: permite finalizar a partida mesmo se o servidor
  // reiniciar no meio do jogo ou se o payload final vier incompleto.
  const andamento =
    matchIdValidoGsi(s.matchId) ? obterAndamentoGsi(db, String(s.matchId)) : null;
  salvarAndamentoGsi(db, s, gameState, map);

  if (gameState === 'DOTA_GAMERULES_STATE_POST_GAME') {
    // O payload final pode vir sem win_team/team_name; usa o que foi guardado
    // durante a partida (inclusive em execuções anteriores) e, por último, o
    // placar radiant/dire.
    const win = String(map.win_team ?? '').toLowerCase();
    const team = String(player.team_name ?? '').toLowerCase();
    const winGuardado =
      (s.matchId && s.winTeamMatchId === s.matchId ? s.winTeam : '') ||
      andamento?.winTeam ||
      '';
    const teamGuardado = team || s.teamName || andamento?.teamName || '';
    const placar = {
      ...map,
      radiant_score:
        map.radiant_score != null ? map.radiant_score : (andamento?.radiantScore ?? 0),
      dire_score:
        map.dire_score != null ? map.dire_score : (andamento?.direScore ?? 0),
    };
    const resultado = resultadoDaPartida(
      win && win !== 'none' ? win : winGuardado,
      teamGuardado,
      placar
    );

    if (matchIdValidoGsi(s.matchId) && !resultado && !s.partidaContada) {
      if (s.ultimoPostGameMatchId !== String(s.matchId)) {
        s.ultimoPostGameMatchId = String(s.matchId);
        s.ultimoErroPartida =
          'Fim de partida detectado, mas o Dota não enviou vencedor/time/placar. A partida ficou pendente para você completar o resultado.';
        registrarEventoOverlay(db, 'gsi_erro_partida', s.ultimoErroPartida, {
          matchId: s.matchId,
          mapKeys: Object.keys(map),
          playerKeys: Object.keys(player),
        });
      }
    } else if (matchIdValidoGsi(s.matchId) && resultado && !s.partidaContada) {
      s.ultimoErroPartida = '';
      const finalizadaEm = agoraLocal();
      const duracao =
        s.clock > 0 ? s.clock : s.ultimoClock || andamento?.duracao || 0;
      const registrada = registrarPartidaNoPedido(db, {
        matchId: s.matchId,
        accountId: s.accountId || andamento?.accountId || '',
        steamId: s.steamId || andamento?.steamId || '',
        hero: s.hero || andamento?.hero || '',
        resultado,
        kills: s.kills || andamento?.kills || 0,
        deaths: s.deaths || andamento?.deaths || 0,
        assists: s.assists || andamento?.assists || 0,
        duracao,
        iniciadaEm: s.iniciadaEm ?? andamento?.iniciadaEm ?? null,
        finalizadaEm,
      });
      const { partida, trackingId } = registrada;
      s.partidaContada = true;

      s.ultimaPartida = {
        id: partida.id,
        matchId: partida.matchId,
        resultado: partida.resultado,
        hero: partida.hero,
      };
      if (partida.nova) {
        registrarEventoOverlay(
          db,
          'jogo_salvo',
          `Jogo salvo: ${resultado === 'W' ? 'Vitória' : 'Derrota'}${
            s.hero ? ` · ${s.hero}` : ''
          }${
            trackingId
              ? ` · pedido ${trackingId} · aguardando registro`
              : ' · sem vínculo'
          }`,
          {
            partidaId: partida.id,
            matchId: s.matchId,
            resultado,
            hero: s.hero,
            trackingId: trackingId || null,
          }
        );
      }
      removerAndamentoGsi(db, String(s.matchId));
    }
  }

  s.diagnostico.aceitos++;
  s.diagnostico.ultimoPayload = {
    em: Date.now(),
    gameState: s.gameState,
    matchId: s.matchId,
    accountId: s.accountId,
    hero: s.hero,
    host: String(meta.host ?? ''),
    bytes: Number(meta.bytes) || 0,
    teste: false,
  };
  // No pós-jogo grava na hora: é o estado que interessa para diagnosticar uma
  // partida que não foi salva.
  persistirDiagnostico(db, s, gameState === 'DOTA_GAMERULES_STATE_POST_GAME');
}
