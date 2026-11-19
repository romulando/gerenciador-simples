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
      tipoServico TEXT NOT NULL DEFAULT '',
      atualizadoEm TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_pedido_contas_accountId ON pedido_contas(accountId);

    -- Partidas salvas pelo GSI aguardando o registro no pedido do Supabase.
    -- O GSI só enfileira (rota pública); a gravação acontece numa rota
    -- autenticada, respeitando a RLS do Theone.
    CREATE TABLE IF NOT EXISTS registros_pendentes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      matchId TEXT NOT NULL UNIQUE,
      accountId TEXT NOT NULL DEFAULT '',
      trackingId TEXT NOT NULL DEFAULT '',
      tipoServico TEXT NOT NULL DEFAULT '',
      hero TEXT NOT NULL DEFAULT '',
      resultado TEXT NOT NULL DEFAULT 'W',
      kills INTEGER NOT NULL DEFAULT 0,
      deaths INTEGER NOT NULL DEFAULT 0,
      assists INTEGER NOT NULL DEFAULT 0,
      duracao INTEGER NOT NULL DEFAULT 0,
      iniciadaEm TEXT,
      finalizadaEm TEXT NOT NULL,
      data TEXT NOT NULL,
      registroId TEXT,
      recalculoOk INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pendente',
      tentativas INTEGER NOT NULL DEFAULT 0,
      ultimoErro TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT (datetime('now','localtime')),
      atualizadoEm TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
    CREATE INDEX IF NOT EXISTS idx_registros_pendentes_status
      ON registros_pendentes(status, recalculoOk);

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

  // Migração aditiva: tipo do serviço junto ao vínculo tracking x conta.
  const colunasContas = db.prepare('PRAGMA table_info(pedido_contas)').all() as {
    name: string;
  }[];
  if (!colunasContas.some((coluna) => coluna.name === 'tipoServico')) {
    db.exec("ALTER TABLE pedido_contas ADD COLUMN tipoServico TEXT NOT NULL DEFAULT ''");
  }

  globalForDb._overlayDb = db;
  return db;
}
