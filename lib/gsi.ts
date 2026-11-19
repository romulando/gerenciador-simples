// GSI do Dota 2: estado ao vivo + partidas locais para W/L e cenas do OBS.
import crypto from 'crypto';
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';
import { getDb } from './db';
import { agoraLocal } from './helpers';
import { registrarEventoOverlay } from './overlayEventos';
import { aoEstadoGsi } from './obsCenas';
import { accountIdDeSteamId } from './contaDota';
import { getPedidoSelecionado } from './pedidoSelecionado';
import { pedidoDaPartida } from './pedidoContas';

export interface PayloadGsi {
  map?: Record<string, unknown>;
  player?: Record<string, unknown>;
  hero?: Record<string, unknown>;
  auth?: Record<string, unknown>;
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
  iniciadaEm: string | null;
  partidaContada: boolean;
  ultimaPartida: { id: number; matchId: string | null; resultado: string; hero: string } | null;
  silencioTratado: boolean;
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
      iniciadaEm: null,
      partidaContada: false,
      ultimaPartida: null,
      silencioTratado: false,
    };
  }
  return globalForGsi._gsiTheone;
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
}

export function getEstadoGsi(): EstadoGsi {
  const s = estadoInterno();
  return {
    online: s.ultimoContatoEm != null && Date.now() - s.ultimoContatoEm < GSI_ONLINE_JANELA_MS,
    ultimoContatoEm: s.ultimoContatoEm,
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

// Processa o payload GSI: estado ao vivo, cenas e salvamento de partidas.
export function processarGsi(payload: PayloadGsi): void {
  const db = getDb();
  const s = estadoInterno();
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
  s.kills = Number(player.kills) || 0;
  s.deaths = Number(player.deaths) || 0;
  s.assists = Number(player.assists) || 0;
  s.clock = Number(map.clock_time) || 0;

  const steamId = String(player.steamid ?? '');
  if (steamId) {
    s.steamId = steamId;
    const acc = accountIdDeSteamId(steamId);
    if (acc) s.accountId = acc;
  }

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
    } else if (gameState === 'DOTA_GAMERULES_STATE_PRE_GAME') {
      s.partidaContada = false;
      if (!s.iniciadaEm) s.iniciadaEm = new Date().toISOString();
    }
  }

  if (gameState === 'DOTA_GAMERULES_STATE_POST_GAME') {
    const winTeam = String(map.win_team ?? '').toLowerCase();
    const playerTeam = String(player.team_name ?? '').toLowerCase();
    if (matchIdValidoGsi(s.matchId) && winTeam && playerTeam && !s.partidaContada) {
      s.partidaContada = true;
      const resultado = winTeam === playerTeam ? 'W' : 'L';
      // Atribui a partida ao pedido selecionado ou à única conta vinculada.
      const trackingId = pedidoDaPartida(db, s.accountId, getPedidoSelecionado(db));
      const partida = salvarPartida(db, {
        matchId: s.matchId,
        accountId: s.accountId,
        steamId: s.steamId,
        trackingId,
        hero: s.hero,
        resultado,
        kills: s.kills,
        deaths: s.deaths,
        assists: s.assists,
        duracao: s.clock,
        iniciadaEm: s.iniciadaEm,
        finalizadaEm: agoraLocal(),
        fonte: 'gsi',
      });
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
          }${trackingId ? ` · pedido ${trackingId}` : ' · sem vínculo'}`,
          {
            partidaId: partida.id,
            matchId: s.matchId,
            resultado,
            hero: s.hero,
            trackingId: trackingId || null,
          }
        );
      }
    }
  }
}
