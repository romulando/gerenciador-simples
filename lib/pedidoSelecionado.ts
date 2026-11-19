// Pedido exibido na overlay (config local). Módulo neutro para evitar o ciclo
// de imports entre overlay.ts (que importa o GSI) e gsi.ts (que lê a seleção).
import type { DatabaseSync } from 'node:sqlite';
import { getConfigValor, setConfigValor } from './config';

const CHAVE_PEDIDO_SELECIONADO = 'overlay_pedido_selecionado';

export function getPedidoSelecionado(db: DatabaseSync): string {
  return (getConfigValor(db, CHAVE_PEDIDO_SELECIONADO) ?? '').trim().toUpperCase();
}

export function setPedidoSelecionado(db: DatabaseSync, trackingId: unknown): string {
  const id = String(trackingId ?? '').trim().toUpperCase();
  setConfigValor(
    db,
    CHAVE_PEDIDO_SELECIONADO,
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id) ? id : ''
  );
  return id;
}
