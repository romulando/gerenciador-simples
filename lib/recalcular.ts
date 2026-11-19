import {
  atualizarPedido,
  listarRegistros,
  obterPedido,
  registrarLog,
  salvarTracking,
} from './data';
import { recalcularNoSite } from './siteApi';
import type { RespostaRecalculo } from './types';

export async function recalcularPedido(pedidoId: string): Promise<RespostaRecalculo> {
  const pedido = await obterPedido(pedidoId);
  if (!pedido) throw new Error('Pedido não encontrado.');

  const registros = await listarRegistros(pedidoId);
  const registrosMmr = registros.filter((r) => r.tipo === 'mmr');
  const registrosPartidas = registros.filter((r) => r.tipo === 'partidas');

  const resposta = await recalcularNoSite(pedido, registrosMmr, registrosPartidas);

  await atualizarPedido(pedidoId, {
    mmr_atual: resposta.calculo.mmr_atual,
    saldo_restante: resposta.calculo.saldo_restante,
    consumido: resposta.calculo.consumido,
    progresso_pct: resposta.calculo.progresso_pct,
    mmr_final_calculado: resposta.calculo.mmr_final_calculado,
    recalculado_em: new Date().toISOString(),
  });

  await salvarTracking(resposta.tracking as unknown as Record<string, unknown>);

  await registrarLog(pedidoId, 'recalculo', 'Valores recalculados pelo site', resposta.calculo);

  return resposta;
}
