import type { DatabaseSync } from 'node:sqlite';

export function getConfigValor(db: DatabaseSync, chave: string): string | null {
  const row = db.prepare('SELECT valor FROM config WHERE chave = ?').get(chave) as
    | { valor: string }
    | undefined;
  return row ? row.valor : null;
}

export function setConfigValor(db: DatabaseSync, chave: string, valor: string): void {
  db.prepare(
    `INSERT INTO config (chave, valor) VALUES (?, ?)
     ON CONFLICT(chave) DO UPDATE SET valor = excluded.valor`
  ).run(chave, valor);
}
