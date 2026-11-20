// Histórico local das partidas do GSI (overlay.db).
// O Dota 2 envia a partida para /api/gsi, que já grava nesta tabela; aqui
// apenas listamos, resumimos e permitimos lançamentos/exclusões manuais.
import type { DatabaseSync } from 'node:sqlite';
import { normalizarDataRegistro } from './helpers';
import { internoHeroi } from './heroes';

export interface PartidaLocal {
  id: number;
  matchId: string | null;
  accountId: string;
  steamId: string;
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
  createdAt: string;
}

export interface FiltrosPartidas {
  hoje?: boolean;
  resultado?: string;
  vinculo?: string; // 'com' | 'sem'
  busca?: string;
  limite?: number;
}

export interface ResumoPartidas {
  total: number;
  hoje: number;
  semVinculo: number;
  vitorias: number;
  derrotas: number;
}

export interface DadosPartidaManual {
  matchId?: string;
  trackingId?: string;
  hero?: string;
  resultado?: string;
  kills?: number;
  deaths?: number;
  assists?: number;
  duracao?: number;
  data?: string;
}

export interface ResultadoPartidaManual {
  partida: PartidaLocal;
  nova: boolean;
}

const CAMPOS = `id, matchId, accountId, steamId, trackingId, hero, resultado,
  kills, deaths, assists, duracao, iniciadaEm, finalizadaEm, fonte, createdAt`;

function mapear(row: Record<string, unknown>): PartidaLocal {
  return {
    id: Number(row.id),
    matchId: row.matchId == null ? null : String(row.matchId),
    accountId: String(row.accountId ?? ''),
    steamId: String(row.steamId ?? ''),
    trackingId: String(row.trackingId ?? '').trim().toUpperCase(),
    hero: String(row.hero ?? ''),
    resultado: row.resultado === 'L' ? 'L' : 'W',
    kills: Number(row.kills) || 0,
    deaths: Number(row.deaths) || 0,
    assists: Number(row.assists) || 0,
    duracao: Number(row.duracao) || 0,
    iniciadaEm: row.iniciadaEm == null ? null : String(row.iniciadaEm),
    finalizadaEm: String(row.finalizadaEm ?? ''),
    fonte: String(row.fonte ?? 'gsi'),
    createdAt: String(row.createdAt ?? ''),
  };
}

function montarFiltros(filtros: FiltrosPartidas): {
  where: string;
  params: (string | number | null)[];
} {
  const params: (string | number | null)[] = [];
  let where = 'WHERE 1=1';

  if (filtros.hoje) {
    where += " AND date(finalizadaEm) = date('now','localtime')";
  }
  if (filtros.resultado === 'W' || filtros.resultado === 'L') {
    where += ' AND resultado = ?';
    params.push(filtros.resultado);
  }
  if (filtros.vinculo === 'com') {
    where += " AND TRIM(trackingId) <> ''";
  }
  if (filtros.vinculo === 'sem') {
    where += " AND TRIM(trackingId) = ''";
  }

  const busca = String(filtros.busca ?? '').trim();
  if (busca) {
    const like = `%${busca}%`;
    // O campo mostra o nome de exibição do herói; aceita também o interno.
    const hero = internoHeroi(busca);
    where += ' AND (matchId LIKE ? OR hero LIKE ? OR trackingId LIKE ?';
    params.push(like, like, like);
    if (hero && hero !== busca) {
      where += ' OR hero = ?';
      params.push(hero);
    }
    where += ')';
  }

  return { where, params };
}

export function listarPartidas(
  db: DatabaseSync,
  filtros: FiltrosPartidas = {}
): PartidaLocal[] {
  const { where, params } = montarFiltros(filtros);
  const limite = Math.min(Math.max(Number(filtros.limite) || 50, 1), 2000);
  const rows = db
    .prepare(
      `SELECT ${CAMPOS} FROM partidas
       ${where}
       ORDER BY finalizadaEm DESC, id DESC
       LIMIT ?`
    )
    .all(...params, limite) as unknown as Record<string, unknown>[];
  return rows.map(mapear);
}

export function contarPartidas(
  db: DatabaseSync,
  filtros: FiltrosPartidas = {}
): number {
  const { where, params } = montarFiltros(filtros);
  const row = db
    .prepare(`SELECT COUNT(*) AS total FROM partidas ${where}`)
    .get(...params) as { total: number | null } | undefined;
  return Number(row?.total) || 0;
}

export function resumoPartidas(db: DatabaseSync): ResumoPartidas {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN date(finalizadaEm) = date('now','localtime') THEN 1 ELSE 0 END) AS hoje,
         SUM(CASE WHEN TRIM(trackingId) = '' THEN 1 ELSE 0 END) AS semVinculo,
         SUM(CASE WHEN resultado = 'W' THEN 1 ELSE 0 END) AS vitorias,
         SUM(CASE WHEN resultado = 'L' THEN 1 ELSE 0 END) AS derrotas
       FROM partidas`
    )
    .get() as
    | {
        total: number | null;
        hoje: number | null;
        semVinculo: number | null;
        vitorias: number | null;
        derrotas: number | null;
      }
    | undefined;
  return {
    total: Number(row?.total) || 0,
    hoje: Number(row?.hoje) || 0,
    semVinculo: Number(row?.semVinculo) || 0,
    vitorias: Number(row?.vitorias) || 0,
    derrotas: Number(row?.derrotas) || 0,
  };
}

export function salvarPartidaManual(
  db: DatabaseSync,
  dados: DadosPartidaManual
): ResultadoPartidaManual {
  const matchId = String(dados.matchId ?? '').trim() || null;

  if (matchId) {
    const existente = db
      .prepare(`SELECT ${CAMPOS} FROM partidas WHERE matchId = ?`)
      .get(matchId) as Record<string, unknown> | undefined;
    if (existente) return { partida: mapear(existente), nova: false };
  }

  const finalizadaEm = normalizarDataRegistro(dados.data);
  const info = db
    .prepare(
      `INSERT INTO partidas
        (matchId, accountId, steamId, trackingId, hero, resultado, kills, deaths,
         assists, duracao, iniciadaEm, finalizadaEm, fonte)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
    )
    .run(
      matchId,
      '',
      '',
      String(dados.trackingId ?? '').trim().toUpperCase(),
      internoHeroi(dados.hero),
      dados.resultado === 'L' ? 'L' : 'W',
      Number(dados.kills) || 0,
      Number(dados.deaths) || 0,
      Number(dados.assists) || 0,
      Number(dados.duracao) || 0,
      null,
      finalizadaEm,
      'manual'
    );

  const row = db
    .prepare(`SELECT ${CAMPOS} FROM partidas WHERE id = ?`)
    .get(Number(info.lastInsertRowid)) as Record<string, unknown> | undefined;
  if (!row) throw new Error('Partida não encontrada após salvar.');
  return { partida: mapear(row), nova: true };
}

export function excluirPartida(db: DatabaseSync, id: number): boolean {
  const info = db.prepare('DELETE FROM partidas WHERE id = ?').run(id);
  return Number(info.changes) > 0;
}
