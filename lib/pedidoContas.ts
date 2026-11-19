// Vínculo entre o tracking ID do pedido e o account_id do Dota 2.
// Guardado no banco local (overlay.db) para o GSI (sem sessão/Supabase) usar
// na atribuição automática das partidas.
import type { DatabaseSync } from 'node:sqlite';
import { agoraLocal } from './helpers';
import { normalizarIdDota } from './contaDota';

export interface ContaPedido {
  trackingId: string;
  accountId: string;
  atualizadoEm: string;
}

function trackingNormalizado(valor: unknown): string {
  return String(valor ?? '').trim().toUpperCase();
}

export function listarContasPedidos(db: DatabaseSync): ContaPedido[] {
  const linhas = db
    .prepare('SELECT trackingId, accountId, atualizadoEm FROM pedido_contas ORDER BY trackingId')
    .all() as unknown as ContaPedido[];
  return linhas.map((linha) => ({
    trackingId: trackingNormalizado(linha.trackingId),
    accountId: String(linha.accountId ?? '').replace(/\D/g, ''),
    atualizadoEm: String(linha.atualizadoEm ?? ''),
  }));
}

export function getContaPedido(db: DatabaseSync, trackingId: unknown): string {
  const id = trackingNormalizado(trackingId);
  if (!id) return '';
  const linha = db
    .prepare('SELECT accountId FROM pedido_contas WHERE trackingId = ?')
    .get(id) as { accountId: string } | undefined;
  return String(linha?.accountId ?? '').replace(/\D/g, '');
}

// Salva (ou remove, com conta vazia) o vínculo e devolve a conta normalizada.
export function setContaPedido(
  db: DatabaseSync,
  trackingId: unknown,
  accountId: unknown
): string {
  const id = trackingNormalizado(trackingId);
  const conta = normalizarIdDota(accountId);
  if (!id) return '';
  if (!conta) {
    db.prepare('DELETE FROM pedido_contas WHERE trackingId = ?').run(id);
    return '';
  }
  db.prepare(
    `INSERT INTO pedido_contas (trackingId, accountId, atualizadoEm)
     VALUES (?, ?, ?)
     ON CONFLICT(trackingId) DO UPDATE SET
       accountId = excluded.accountId,
       atualizadoEm = excluded.atualizadoEm`
  ).run(id, conta, agoraLocal());

  // Backfill: partidas antigas dessa conta que ainda não tinham vínculo passam
  // a apontar para o pedido — somente quando a conta é exclusiva deste pedido.
  const vinculosDaConta = db
    .prepare('SELECT COUNT(*) AS total FROM pedido_contas WHERE accountId = ?')
    .get(conta) as { total: number };
  if (Number(vinculosDaConta.total) === 1) {
    db.prepare(
      "UPDATE partidas SET trackingId = ? WHERE accountId = ? AND (trackingId IS NULL OR trackingId = '')"
    ).run(id, conta);
  }

  return conta;
}

// Tracking ID que deve receber a partida da conta informada.
// Prioriza o pedido selecionado na overlay; sem ele, usa a conta quando existe
// um único vínculo cadastrado (evita atribuição errada em caso de ambiguidade).
export function pedidoDaPartida(
  db: DatabaseSync,
  accountId: unknown,
  selecionado?: string | null
): string {
  const conta = normalizarIdDota(accountId);
  if (!conta) return '';

  const idSelecionado = trackingNormalizado(selecionado);
  if (idSelecionado && getContaPedido(db, idSelecionado) === conta) return idSelecionado;

  const linhas = db
    .prepare('SELECT trackingId FROM pedido_contas WHERE accountId = ?')
    .all(conta) as { trackingId: string }[];
  if (linhas.length !== 1) return '';
  return trackingNormalizado(linhas[0].trackingId);
}
