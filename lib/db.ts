// Banco local do overlay: configuração, partidas do GSI e eventos.
// Os dados de pedido/registros/tracking ficam no Supabase.
import Database from 'better-sqlite3';
import path from 'path';

const dbPath = path.join(process.cwd(), 'overlay.db');

const globalForDb = globalThis as unknown as { _overlayDb?: Database.Database };

export function getDb(): Database.Database {
  if (globalForDb._overlayDb) return globalForDb._overlayDb;

  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('busy_timeout = 5000');

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

  globalForDb._overlayDb = db;
  return db;
}
