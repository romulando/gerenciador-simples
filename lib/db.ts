// Banco local do overlay: configuração, partidas do GSI e eventos.
// Os dados de pedido/registros/tracking ficam no Supabase.
import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const dbPath = path.join(process.cwd(), 'overlay.db');

const globalForDb = globalThis as unknown as { _overlayDb?: DatabaseSync };

export function getDb(): DatabaseSync {
  if (globalForDb._overlayDb) return globalForDb._overlayDb;

  const db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA busy_timeout = 5000');

  db.exec(`
    CREATE TABLE IF NOT EXISTS config (
      chave TEXT PRIMARY KEY,
      valor TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS partidas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matchId TEXT,
      accountId TEXT DEFAULT '',
      steamId TEXT DEFAULT '',
      trackingId TEXT NOT NULL DEFAULT '',
      hero TEXT DEFAULT '',
      resultado TEXT NOT NULL DEFAULT 'W',
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      duracao INTEGER NOT NULL DEFAULT 0,
      iniciadaEm TEXT,
      finalizadaEm TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      fonte TEXT NOT NULL DEFAULT 'gsi',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE UNIQUE INDEX IF NOT EXISTS idx_partidas_matchId ON partidas(matchId);
    CREATE INDEX IF NOT EXISTS idx_partidas_finalizadaEm ON partidas(finalizadaEm);

    CREATE TABLE IF NOT EXISTS pedido_contas (
      trackingId TEXT PRIMARY KEY,
      accountId TEXT NOT NULL DEFAULT '',
      atualizadoEm TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_pedido_contas_accountId ON pedido_contas(accountId);

    CREATE TABLE IF NOT EXISTS overlay_eventos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tipo TEXT NOT NULL DEFAULT '',
      mensagem TEXT NOT NULL DEFAULT '',
      detalhes TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_overlay_eventos_createdAt ON overlay_eventos(createdAt);
    CREATE INDEX IF NOT EXISTS idx_overlay_eventos_tipo ON overlay_eventos(tipo);
  `);

  // Migração aditiva: bancos antigos ainda não têm a coluna de vínculo.
  const colunasPartidas = db.prepare('PRAGMA table_info(partidas)').all() as { name: string }[];
  if (!colunasPartidas.some((coluna) => coluna.name === 'trackingId')) {
    db.exec("ALTER TABLE partidas ADD COLUMN trackingId TEXT NOT NULL DEFAULT ''");
  }
  db.exec('CREATE INDEX IF NOT EXISTS idx_partidas_trackingId ON partidas(trackingId)');

  globalForDb._overlayDb = db;
  return db;
}
