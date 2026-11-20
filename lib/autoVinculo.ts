// Vínculo automático entre a conta detectada pelo GSI e o pedido em andamento.
//
// O gerenciador-simples lê os pedidos do Supabase, mas o espelho orders_theone
// não traz a conta Dota 2 do cliente. Para não depender de o booster clicar em
// "Adicionar ID" em cada pedido, usamos uma regra conservadora: só vinculamos
// quando existe exatamente UM pedido solo ativo e a conta ainda não pertence a
// outro pedido. Com mais de um pedido solo, a escolha continua manual.
import type { DatabaseSync } from 'node:sqlite';
import { listarPedidos } from './data';
import { getEstadoGsi } from './gsi';
import { ehServicoDuo, ehServicoSolo } from './helpers';
import { registrarEventoOverlay } from './overlayEventos';
import {
  getContaPedido,
  listarContasPedidos,
  setContaPedido,
} from './pedidoContas';
import {
  getPedidoSelecionado,
  getPedidoSelecionadoTipo,
  setPedidoSelecionado,
} from './pedidoSelecionado';
import type { PedidoTheone } from './types';

export interface ResultadoAutoVinculo {
  vinculado: boolean;
  trackingId: string;
  motivo: string;
}

const INTERVALO_MS = 10_000;
const LEITURA_PEDIDOS_TIMEOUT_MS = 4_000;

const globalAutoVinculo = globalThis as unknown as {
  _autoVinculoUltimaEm?: number;
  _autoVinculoProcessando?: boolean;
};

function resultado(
  vinculado: boolean,
  trackingId: string,
  motivo: string
): ResultadoAutoVinculo {
  return { vinculado, trackingId, motivo };
}

// O polling do painel não pode ficar preso se o Supabase demorar. A leitura
// continua em segundo plano; o vínculo simplesmente tenta de novo depois.
function comTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Tempo esgotado.')), ms);
    promise.then(
      (valor) => {
        clearTimeout(timer);
        resolve(valor);
      },
      (erro) => {
        clearTimeout(timer);
        reject(erro);
      }
    );
  });
}

// Chamada pelas rotas autenticadas (status/overlay/painel). O throttle evita
// consultar o Supabase a cada polling de 3 s; `pedidos` injetado (página do
// Acompanhamento) ignora o throttle para o vínculo aparecer já na primeira
// leitura da tela.
export async function autoVincularContaDetectada(
  db: DatabaseSync,
  pedidos?: PedidoTheone[]
): Promise<ResultadoAutoVinculo> {
  const gsi = getEstadoGsi();
  const conta = String(gsi.accountId ?? '').replace(/\D/g, '');
  if (!gsi.online || !conta) {
    return resultado(false, '', 'GSI sem conta detectada.');
  }

  if (globalAutoVinculo._autoVinculoProcessando) {
    return resultado(false, '', 'Vínculo automático já em andamento.');
  }

  if (!pedidos) {
    const agora = Date.now();
    if (agora - (globalAutoVinculo._autoVinculoUltimaEm ?? 0) < INTERVALO_MS) {
      return resultado(false, '', 'Aguardando intervalo do vínculo automático.');
    }
  }

  globalAutoVinculo._autoVinculoProcessando = true;
  try {
    let lista: PedidoTheone[];
    try {
      lista = pedidos ?? (await comTimeout(listarPedidos(), LEITURA_PEDIDOS_TIMEOUT_MS));
    } catch {
      return resultado(false, '', 'Não foi possível ler os pedidos do Supabase.');
    }

    // Seleções antigas podem não ter o tipo salvo em pedido_contas; nesse caso
    // usa o tipo do próprio pedido na lista para não confundir duo com solo.
    const selecionado = getPedidoSelecionado(db);
    const selecionadoNaLista = lista.find(
      (p) => String(p.tracking_id ?? '').trim().toUpperCase() === selecionado
    );
    const tipoSelecionado =
      getPedidoSelecionadoTipo(db) || selecionadoNaLista?.tipo_servico || '';
    if (ehServicoDuo(tipoSelecionado)) {
      // Duo/grupo ativo continua manual. Se o pedido duo não existe mais (ou
      // foi concluído), limpa para não desviar partidas futuras para ele.
      if (
        selecionado &&
        (!selecionadoNaLista || selecionadoNaLista.estado !== 'em_andamento')
      ) {
        setPedidoSelecionado(db, '', '');
        registrarEventoOverlay(
          db,
          'vinculo_auto',
          `Pedido ${selecionado} limpo: duo/grupo não está mais em andamento.`
        );
      }
      return resultado(false, '', 'Pedido duo/grupo selecionado.');
    }

    // Seleção apontando para pedido que não existe mais ou não está mais em
    // andamento: limpa para a overlay não ficar presa em um pedido antigo.
    if (
      selecionado &&
      (!selecionadoNaLista || selecionadoNaLista.estado !== 'em_andamento')
    ) {
      setPedidoSelecionado(db, '', '');
      registrarEventoOverlay(
        db,
        'vinculo_auto',
        `Pedido ${selecionado} limpo: não está mais em andamento.`
      );
    }

    const ativosSolo = lista.filter(
      (p) => p.estado === 'em_andamento' && ehServicoSolo(p.tipo_servico)
    );
    if (ativosSolo.length === 0) {
      return resultado(false, '', 'Nenhum pedido solo ativo.');
    }
    if (ativosSolo.length > 1) {
      return resultado(
        false,
        '',
        `${ativosSolo.length} pedidos solo ativos; selecione o correto manualmente.`
      );
    }

    const pedido = ativosSolo[0];
    const trackingId = String(pedido.tracking_id ?? '').trim().toUpperCase();
    if (!trackingId) {
      return resultado(false, '', 'O pedido solo ativo está sem tracking ID.');
    }

    const contaAtual = getContaPedido(db, trackingId);
    if (contaAtual === conta) {
      // Já vinculado: garante que a overlay não fique presa em outro pedido.
      if (getPedidoSelecionado(db) !== trackingId) {
        setPedidoSelecionado(db, trackingId, pedido.tipo_servico);
      }
      return resultado(false, trackingId, 'Conta já vinculada a este pedido.');
    }
    if (contaAtual) {
      return resultado(
        false,
        trackingId,
        `O pedido já está vinculado à conta ${contaAtual}.`
      );
    }

    const outro = listarContasPedidos(db).find(
      (c) => c.accountId === conta && c.trackingId !== trackingId
    );
    if (outro) {
      return resultado(
        false,
        trackingId,
        `A conta ${conta} já está vinculada ao pedido ${outro.trackingId}.`
      );
    }

    setContaPedido(db, trackingId, conta, pedido.tipo_servico);
    setPedidoSelecionado(db, trackingId, pedido.tipo_servico);
    registrarEventoOverlay(
      db,
      'vinculo_auto',
      `Conta ${conta} vinculada automaticamente ao pedido ${trackingId} (único pedido solo ativo)`,
      {
        accountId: conta,
        trackingId,
        tipoServico: pedido.tipo_servico,
      }
    );
    return resultado(true, trackingId, 'Conta vinculada automaticamente.');
  } finally {
    globalAutoVinculo._autoVinculoProcessando = false;
    globalAutoVinculo._autoVinculoUltimaEm = Date.now();
  }
}
