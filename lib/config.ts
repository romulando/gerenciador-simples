import type Database from 'better-sqlite3';

export function getConfigValor(db: Database.Database, chave: string): string | null {
  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave) as
    | { valor: string }
    | undefined;
  return row ? row.valor : null;
}

export function setConfigValor(db: Database.Database, chave: string, valor: string): void {
  db.prepare(
    `INSERT INTO config (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(chave, valor);
}
