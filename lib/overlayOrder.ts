import { getSupabasePublic } from './supabase/public';

export interface PedidoOverlayResumo {
  id: number;
  trackingId: string;
  tipoServico: string;
  estado: string;
  mmrInicial: number | null;
  mmrAtual: number | null;
  mmrFinal: number | null;
  progressoPct: number;
  vitorias: number;
  derrotas: number;
}

function num(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

// Lê somente os dados públicos do pedido no Supabase, usando a publishable key.
// Primeiro tenta o tracking calculado; se ainda não existir, usa a projeção
// segura de orders_theone (sem valor, saldo, observações ou credenciais).
export async function obterPedidoPublicoTheone(
  trackingId: string
): Promise<PedidoOverlayResumo | null> {
  const id = String(trackingId ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id)) return null;

  try {
    const sb = getSupabasePublic();
    const { data: tracking } = await sb.rpc('get_tracking_theone', {
      p_tracking_id: id,
    });
    if (tracking) {
      const t = tracking as Record<string, unknown>;
      return {
        id: 0,
        trackingId: String(t.tracking_id ?? id),
        tipoServico: String(t.tipo_servico ?? ''),
        estado: String(t.estado ?? 'em_andamento'),
        mmrInicial: num(t.mmr_inicial_ajustado) ?? num(t.mmr_inicial),
        mmrAtual: num(t.mmr_atual),
        mmrFinal: num(t.mmr_final_ajustado) ?? num(t.mmr_desejado),
        progressoPct: num(t.progresso_pct) ?? 0,
        vitorias: Number(t.vitorias) || 0,
        derrotas: Number(t.derrotas) || 0,
      };
    }

    const { data: order } = await sb.rpc('get_order_public_theone', {
      p_tracking_id: id,
    });
    if (!order) return null;
    const o = order as Record<string, unknown>;
    return {
      id: 0,
      trackingId: String(o.tracking_id ?? id),
      tipoServico: String(o.tipo_servico ?? ''),
      estado: String(o.estado ?? 'em_andamento'),
      mmrInicial: num(o.mmr_inicial),
      mmrAtual: num(o.mmr_atual),
      mmrFinal: num(o.mmr_final_calculado) ?? num(o.mmr_desejado),
      progressoPct: num(o.progresso_pct) ?? 0,
      vitorias: 0,
      derrotas: 0,
    };
  } catch {
    return null;
  }
}
