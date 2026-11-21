import { atualizarPedido, inserirRegistro, listarRegistros, obterPedido } from './data';
import type { ClienteSupabase } from './data';
import { chaveDataHora, normalizarDataRegistro, agoraLocal } from './helpers';
import { registrarLog } from './data';
import type { RegistroTheone } from './types';

export type MotivoAjuste = 'inicial' | 'partidas_cliente' | 'outro';

export const ROTULO_PARTIDAS_CLIENTE =
  'alteração no MMR durante o serviço não relacionado ao booster';

export function rotuloMotivoAjuste(motivo: MotivoAjuste, outro?: string | null): string {
  if (motivo === 'partidas_cliente') return ROTULO_PARTIDAS_CLIENTE;
  return String(outro ?? '').trim();
}

export function montarObservacaoAjuste(
  motivo: MotivoAjuste,
  anterior: number | null | undefined,
  novo: number,
  outro?: string | null
): string {
  const antes = anterior == null ? '—' : String(anterior);
  if (motivo === 'inicial') return `Ajuste MMR inicial ${antes} → ${novo}`;
  return `Ajuste de MMR: ${antes} → ${novo} (Motivo: ${rotuloMotivoAjuste(
    motivo,
    outro
  )}).`;
}

export function ordemDaData(valor: unknown): number {
  const data = normalizarDataRegistro(valor);
  const ms = Date.parse(data.replace(' ', 'T'));
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : Math.floor(Date.now() / 1000);
}

export async function recalcularDerivados(
  pedidoId: string,
  cliente?: ClienteSupabase
): Promise<void> {
  const pedido = await obterPedido(pedidoId, cliente);
  if (!pedido) return;
  const registros = await listarRegistros(pedidoId, cliente);
  const mmr = registros.filter((r) => r.tipo === 'mmr');
  const partidas = registros.filter((r) => r.tipo === 'partidas');
  const ultimo = mmr[mmr.length - 1];
  const mmrAtual = ultimo?.mmr_final ?? pedido.mmr_inicial ?? null;
  const partidasJogadas = partidas.reduce((acc, r) => acc + (Number(r.quantidade) || 0), 0);
  await atualizarPedido(
    pedidoId,
    {
      mmr_atual: mmrAtual,
      partidas_jogadas: partidasJogadas,
    },
    cliente
  );
}

export async function criarRegistro(
  dados: {
    pedido_id: string;
    tipo: 'mmr' | 'partidas' | 'ajuste_mmr';
    data?: string;
    mmr_inicial?: number;
    mmr_final?: number;
    quantidade?: number;
    medalha?: string;
    observacoes?: string;
    hero?: string;
    resultado?: string;
    kills?: number | null;
    deaths?: number | null;
    assists?: number | null;
    novoMmr?: number;
    motivo?: MotivoAjuste;
    motivoOutro?: string | null;
    // Identificador idempotente do GSI (ex.: gsi:1234567890).
    origemId?: string | null;
    automatico?: boolean;
  },
  cliente?: ClienteSupabase
): Promise<RegistroTheone> {
  const pedido = await obterPedido(dados.pedido_id, cliente);
  if (!pedido) throw new Error('Pedido não encontrado.');
  const data = normalizarDataRegistro(dados.data);
  const registros = await listarRegistros(dados.pedido_id, cliente);
  const origemId = dados.origemId ?? null;
  const automatico = dados.automatico === true;
  const sufixoAuto = automatico ? ' · automático pelo GSI' : '';
  const detalhesAuto = { automatico, origemId };

  if (dados.tipo === 'ajuste_mmr') {
    const novo = Number(dados.novoMmr);
    if (!Number.isInteger(novo) || novo < 0) {
      throw new Error('Informe um MMR válido (inteiro maior ou igual a zero).');
    }
    const motivo = dados.motivo;
    if (motivo !== 'inicial' && motivo !== 'partidas_cliente' && motivo !== 'outro') {
      throw new Error('Motivo do ajuste inválido.');
    }
    const outro = String(dados.motivoOutro ?? '').trim();
    if (motivo === 'outro' && !outro) throw new Error('Descreva o motivo do ajuste.');

    const referencia =
      motivo === 'inicial' ? pedido.mmr_inicial : pedido.mmr_atual ?? pedido.mmr_inicial;
    const observacoes = montarObservacaoAjuste(
      motivo,
      referencia == null ? null : Number(referencia),
      novo,
      outro
    );
    const ordens = registros.map((r) => Number(r.ordem)).filter((n) => Number.isFinite(n));
    const ordem =
      motivo === 'inicial'
        ? (ordens.length ? Math.min(...ordens) - 1 : -1)
        : (ordens.length ? Math.max(...ordens) + 1 : 1);

    const registro = await inserirRegistro(
      {
        pedido_id: dados.pedido_id,
        tipo: 'mmr',
        data,
        mmr_inicial: novo,
        mmr_final: novo,
        observacoes,
        motivo_ajuste: motivo,
        ordem,
        origem: 'theone',
      },
      cliente
    );
    await registrarLog(
      dados.pedido_id,
      'ajuste_mmr',
      observacoes,
      { registroId: registro.id, motivo, novoMmr: novo, data },
      cliente
    );
    await recalcularDerivados(dados.pedido_id, cliente);
    return registro;
  }

  if (dados.tipo === 'mmr') {
    const mmrInicial = Number(dados.mmr_inicial);
    const mmrFinal = Number(dados.mmr_final);
    if (!Number.isInteger(mmrInicial) || mmrInicial < 0 || !Number.isInteger(mmrFinal) || mmrFinal < 0) {
      throw new Error('Informe o MMR inicial e o MMR final.');
    }
    const registro = await inserirRegistro(
      {
        pedido_id: dados.pedido_id,
        tipo: 'mmr',
        data,
        mmr_inicial: mmrInicial,
        mmr_final: mmrFinal,
        observacoes: String(dados.observacoes ?? ''),
        hero: String(dados.hero ?? ''),
        resultado: dados.resultado === 'W' || dados.resultado === 'L' ? dados.resultado : '',
        kills: dados.kills ?? null,
        deaths: dados.deaths ?? null,
        assists: dados.assists ?? null,
        ordem: ordemDaData(data),
        origem: 'theone',
        origem_id: origemId,
      },
      cliente
    );
    await registrarLog(
      dados.pedido_id,
      'mmr',
      `Registro de MMR: ${mmrInicial} → ${mmrFinal} (${mmrFinal - mmrInicial >= 0 ? '+' : ''}${
        mmrFinal - mmrInicial
      })${sufixoAuto}`,
      { registroId: registro.id, data, mmrInicial, mmrFinal, ...detalhesAuto },
      cliente
    );
    await recalcularDerivados(dados.pedido_id, cliente);
    return registro;
  }

  const quantidade = Number(dados.quantidade);
  if (!Number.isInteger(quantidade) || quantidade <= 0) {
    throw new Error('Informe a quantidade de partidas/fichas/pontos.');
  }
  const registro = await inserirRegistro(
    {
      pedido_id: dados.pedido_id,
      tipo: 'partidas',
      data,
      quantidade,
      medalha: String(dados.medalha ?? pedido.medalha ?? ''),
      observacoes: String(dados.observacoes ?? ''),
      hero: String(dados.hero ?? ''),
      resultado: dados.resultado === 'W' || dados.resultado === 'L' ? dados.resultado : '',
      kills: dados.kills ?? null,
      deaths: dados.deaths ?? null,
      assists: dados.assists ?? null,
      ordem: ordemDaData(data),
      origem: 'theone',
      origem_id: origemId,
    },
    cliente
  );
  await registrarLog(
    dados.pedido_id,
    'partidas',
    `Registro de partidas: +${quantidade}${
      registro.medalha ? ` · ${registro.medalha}` : ''
    }${sufixoAuto}`,
    { registroId: registro.id, data, quantidade, medalha: registro.medalha, ...detalhesAuto },
    cliente
  );
  await recalcularDerivados(dados.pedido_id, cliente);
  return registro;
}

export async function editarRegistro(
  pedidoId: string,
  registroId: string,
  dados: Record<string, unknown>
): Promise<RegistroTheone> {
  const { atualizarRegistro, listarRegistros: listar } = await import('./data');
  const registros = await listar(pedidoId);
  const atual = registros.find((r) => r.id === registroId);
  if (!atual) throw new Error('Registro não encontrado.');

  const patch: Record<string, unknown> = { origem: 'theone' };
  if (dados.data !== undefined) {
    const novaData = normalizarDataRegistro(dados.data);
    // O formulário tem precisão de minutos; se o usuário não mudou o horário,
    // preserva os segundos originais para não reordenar o histórico.
    const mesmoMinuto =
      novaData.slice(0, 16) === chaveDataHora(atual.data).slice(0, 16);
    if (!mesmoMinuto) {
      patch.data = novaData;
      patch.ordem = ordemDaData(novaData);
    }
  }
  if (atual.tipo === 'mmr') {
    // Aceita tanto snake_case (banco) quanto camelCase (formulário).
    const mmrInicial = dados.mmr_inicial ?? dados.mmrInicial;
    const mmrFinal = dados.mmr_final ?? dados.mmrFinal;
    for (const [campo, valor] of [
      ['mmr_inicial', mmrInicial],
      ['mmr_final', mmrFinal],
    ] as const) {
      if (valor === undefined) continue;
      const n = Number(valor);
      if (valor === '' || !Number.isInteger(n) || n < 0) {
        throw new Error('Informe um MMR válido (inteiro maior ou igual a zero).');
      }
      patch[campo] = n;
    }
    if (dados.motivo_ajuste !== undefined) patch.motivo_ajuste = dados.motivo_ajuste || null;
  } else {
    if (dados.quantidade !== undefined) patch.quantidade = Number(dados.quantidade);
    if (dados.medalha !== undefined) patch.medalha = String(dados.medalha ?? '');
  }
  if (dados.observacoes !== undefined) patch.observacoes = String(dados.observacoes ?? '');
  if (dados.hero !== undefined) patch.hero = String(dados.hero ?? '');
  if (dados.resultado !== undefined) {
    patch.resultado = dados.resultado === 'W' || dados.resultado === 'L' ? dados.resultado : '';
  }
  for (const campo of ['kills', 'deaths', 'assists'] as const) {
    if (dados[campo] !== undefined) {
      const n = dados[campo] === '' || dados[campo] == null ? null : Number(dados[campo]);
      patch[campo] = Number.isFinite(n as number) ? n : null;
    }
  }

  const registro = await atualizarRegistro(registroId, patch);
  await registrarLog(pedidoId, atual.tipo, `Registro editado (${atual.tipo})`, {
    registroId,
    antes: atual,
    depois: registro,
  });
  await recalcularDerivados(pedidoId);
  return registro;
}

export async function removerRegistro(pedidoId: string, registroId: string): Promise<void> {
  const { excluirRegistro, listarRegistros: listar } = await import('./data');
  const registros = await listar(pedidoId);
  const atual = registros.find((r) => r.id === registroId);
  if (!atual) throw new Error('Registro não encontrado.');
  await excluirRegistro(registroId);
  await registrarLog(pedidoId, atual.tipo, `Registro excluído (${atual.tipo})`, {
    registroId,
    registro: atual,
  });
  await recalcularDerivados(pedidoId);
}

export function observacaoComData(valor: string | null | undefined): string {
  return chaveDataHora(valor ?? agoraLocal());
}
