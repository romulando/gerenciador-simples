// Pedido exibido na overlay (config local). Módulo neutro para evitar o ciclo
// de imports entre overlay.ts (que importa o GSI) e gsi.ts (que lê a seleção).
import type Database from 'better-sqlite3';
import { getConfigValor, setConfigValor } from './config';

const CHAVE_PEDIDO_SELECIONADO = 'overlay_pedido_selecionado';

export function getPedidoSelecionado(db: Database.Database): string {
  return (getConfigValor(db, CHAVE_PEDIDO_SELECIONADO) ?? '').trim().toUpperCase();
}

export function setPedidoSelecionado(db: Database.Database, trackingId: unknown): string {
  const id = String(trackingId ?? '').trim().toUpperCase();
  setConfigValor(
    db,
    CHAVE_PEDIDO_SELECIONADO,
    /^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(id) ? id : ''
  );
  return id;
}
