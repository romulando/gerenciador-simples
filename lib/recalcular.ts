import {
  atualizarPedido,
  listarRegistros,
  obterPedido,
  registrarLog,
  salvarTracking,
} from './data';
import type { ClienteSupabase } from './data';
import { recalcularNoSite } from './siteApi';
import type { RespostaRecalculo } from './types';

export async function recalcularPedido(
  pedidoId: string,
  opcoes?: { timeoutMs?: number; cliente?: ClienteSupabase }
): Promise<RespostaRecalculo> {
  const cliente = opcoes?.cliente;
  const pedido = await obterPedido(pedidoId, cliente);
  if (!pedido) throw new Error('Pedido não encontrado.');

  const registros = await listarRegistros(pedidoId, cliente);
  const registrosMmr = registros.filter((r) => r.tipo === 'mmr');
  const registrosPartidas = registros.filter((r) => r.tipo === 'partidas');

  const resposta = await recalcularNoSite(pedido, registrosMmr, registrosPartidas, {
    timeoutMs: opcoes?.timeoutMs,
  });

  await atualizarPedido(
    pedidoId,
    {
      mmr_atual: resposta.calculo.mmr_atual,
      saldo_restante: resposta.calculo.saldo_restante,
      consumido: resposta.calculo.consumido,
      progresso_pct: resposta.calculo.progresso_pct,
      mmr_final_calculado: resposta.calculo.mmr_final_calculado,
      recalculado_em: new Date().toISOString(),
    },
    cliente
  );

  await salvarTracking(resposta.tracking as unknown as Record<string, unknown>, cliente);

  await registrarLog(
    pedidoId,
    'recalculo',
    'Valores recalculados pelo site',
    resposta.calculo,
    cliente
  );

  return resposta;
}
