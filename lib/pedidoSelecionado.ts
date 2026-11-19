// Pedido exibido na overlay (config local). Módulo neutro para evitar o ciclo
// de imports entre overlay.ts (que importa o GSI) e gsi.ts (que lê a seleção).
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';

const CHAVE_PEDIDO_SELECIONADO = 'overlay_pedido_selecionado';
const CHAVE_PEDIDO_SELECIONADO_TIPO = 'overlay_pedido_selecionado_tipo';

export function getPedidoSelecionado(db: DatabaseSync): string {
  return (getConfigValor(db, CHAVE_PEDIDO_SELECIONADO) ?? '').trim().toUpperCase();
}

// Tipo do serviço do pedido selecionado. Define o modo de vínculo:
// duo/grupo usa o pedido selecionado; solo usa a conta do Dota.
export function getPedidoSelecionadoTipo(db: DatabaseSync): string {
  return (getConfigValor(db, CHAVE_PEDIDO_SELECIONADO_TIPO) ?? '').trim();
}

export function setPedidoSelecionado(
  db: DatabaseSync,
  trackingId: unknown,
  tipoServico?: unknown
): string {
  const id = String(trackingId ?? '').trim().toUpperCase();
  const valido = /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id);
  setConfigValor(db, CHAVE_PEDIDO_SELECIONADO, valido ? id : '');
  setConfigValor(
    db,
    CHAVE_PEDIDO_SELECIONADO_TIPO,
    valido ? String(tipoServico ?? '').trim() : ''
  );
  return id;
}
