import { isBoost, rotuloQuantidade } from './helpers';
import type { PedidoTheone } from './types';

export function textoMmr(p: PedidoTheone): string {
  const inicial = p.mmr_inicial ?? '—';
  const atual = p.mmr_atual ?? '—';
  const final = p.mmr_final_calculado ?? p.mmr_desejado ?? '—';
  return `${inicial} → ${atual} → ${final}`;
}

export function textoQuantidade(p: PedidoTheone): string {
  if (isBoost(p.tipo_servico)) return textoMmr(p);
  const total = p.partidas ?? 0;
  return `${p.partidas_jogadas ?? 0}/${total || '—'} ${rotuloQuantidade(p.tipo_servico)}`;
}

export function percentual(p: PedidoTheone): number {
  const n = Number(p.progresso_pct);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export function valorPedido(p: PedidoTheone): number {
  return Number(p.valor) || 0;
}
