// Log de eventos da overlay de stream (tabela overlay_eventos do SQLite local).
import type { DatabaseSync } from 'node:sqlite';

export type EventoOverlayTipo =
  | 'gsi_conectado'
  | 'conta_detectada'
  | 'jogo_salvo'
  | 'cena_trocada';

export interface EventoOverlay {
  id: number;
  tipo: string;
  mensagem: string;
  detalhes: string;
  createdAt: string;
}

const LIMITE_EVENTOS = 200;

export function registrarEventoOverlay(
  db: DatabaseSync,
  tipo: EventoOverlayTipo,
  mensagem: string,
  detalhes?: unknown
): void {
  try {
    db.prepare('INSERT INTO overlay_eventos (tipo, mensagem, detalhes) VALUES (?, ?, ?)').run(
      tipo,
      mensagem.slice(0, 500),
      detalhes == null ? '' : JSON.stringify(detalhes).slice(0, 2000)
    );
    db.prepare(
      `DELETE FROM overlay_eventos WHERE id <= (
         SELECT id FROM overlay_eventos ORDER BY id DESC LIMIT 1 OFFSET ?
       )`
    ).run(LIMITE_EVENTOS);
  } catch {
    // Log acessório: nunca derruba a operação principal.
  }
}

export function listarEventosOverlay(db: DatabaseSync, limite = 100): EventoOverlay[] {
  const n = Math.min(Math.max(Math.round(Number(limite) || 100), 1), LIMITE_EVENTOS);
  return db
    .prepare(
      'SELECT id, tipo, mensagem, detalhes, createdAt FROM overlay_eventos ORDER BY id DESC LIMIT ?'
    )
    .all(n) as unknown as EventoOverlay[];
}

export function limparEventosOverlay(db: DatabaseSync): void {
  db.prepare('DELETE FROM overlay_eventos').run();
}
