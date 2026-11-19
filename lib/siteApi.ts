import type { PedidoTheone, RegistroTheone, RespostaRecalculo } from './types';

function numero(valor: unknown): number | null {
  if (valor == null || valor === '') return null;
  const n = Number(valor);
  return Number.isFinite(n) ? n : null;
}

export async function recalcularNoSite(
  pedido: PedidoTheone,
  registrosMmr: RegistroTheone[],
  registrosPartidas: RegistroTheone[]
): Promise<RespostaRecalculo> {
  const base = (process.env.SITE_API_URL ?? '').replace(/\/+$/, '');
  const secret = process.env.THEONE_API_SECRET ?? '';
  if (!base || !secret) {
    throw new Error('SITE_API_URL ou THEONE_API_SECRET não configurados.');
  }

  const payload = {
    pedido: {
      id: pedido.id,
      tracking_id: pedido.tracking_id,
      tipo_servico: pedido.tipo_servico,
      adicional: pedido.adicional,
      estado: pedido.estado,
      mmr_inicial: numero(pedido.mmr_inicial),
      mmr_atual: numero(pedido.mmr_atual),
      mmr_desejado: numero(pedido.mmr_desejado),
      partidas: numero(pedido.partidas),
      partidas_jogadas: numero(pedido.partidas_jogadas) ?? 0,
      medalha: pedido.medalha,
      valor: numero(pedido.valor) ?? 0,
      saldo_manual: pedido.saldo_manual,
      tabela_precos: pedido.tabela_precos,
      observacoes: pedido.observacoes ?? '',
    },
    registros: {
      mmr: registrosMmr.map((r) => ({
        id: r.id,
        data: r.data,
        mmr_inicial: numero(r.mmr_inicial) ?? 0,
        mmr_final: numero(r.mmr_final) ?? 0,
        observacoes: r.observacoes ?? '',
        hero: r.hero ?? '',
        resultado: r.resultado ?? '',
        kills: numero(r.kills),
        deaths: numero(r.deaths),
        assists: numero(r.assists),
        motivo_ajuste: r.motivo_ajuste,
        ordem: numero(r.ordem),
      })),
      partidas: registrosPartidas.map((r) => ({
        id: r.id,
        data: r.data,
        quantidade: numero(r.quantidade) ?? 0,
        medalha: r.medalha ?? '',
        observacoes: r.observacoes ?? '',
        hero: r.hero ?? '',
        resultado: r.resultado ?? '',
        kills: numero(r.kills),
        deaths: numero(r.deaths),
        assists: numero(r.assists),
        ordem: numero(r.ordem),
      })),
    },
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${base}/api/tracking-theone/recalcular`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-theone-secret': secret,
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    throw new Error(
      (e as Error)?.name === 'AbortError'
        ? 'O site demorou para responder o recálculo. Tente novamente.'
        : 'Não foi possível falar com o site para recalcular.'
    );
  }
  clearTimeout(timer);

  const json = (await res.json().catch(() => ({}))) as
    | RespostaRecalculo
    | { error?: string };
  if (!res.ok) {
    throw new Error(
      ('error' in json && json.error) || `Falha no recálculo (HTTP ${res.status}).`
    );
  }
  if (!('calculo' in json) || !('tracking' in json)) {
    throw new Error('Resposta inválida do site.');
  }
  return json;
}
