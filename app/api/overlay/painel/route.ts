import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  dadosOverlay,
  getOverlayModoBoost,
  getOverlayToken,
  getOverlayWinsLimite,
  getPedidoSelecionado,
} from '@/lib/overlay';
import { listarEventosOverlay } from '@/lib/overlayEventos';
import { listarContasPedidos } from '@/lib/pedidoContas';

// GET /api/overlay/painel -> dados da overlay + config + log de eventos.
// Consumido pela página admin (com sessão).
export async function GET() {
  const db = getDb();
  return NextResponse.json(
    {
      dados: await dadosOverlay(db),
      limiteWins: getOverlayWinsLimite(db),
      modoBoost: getOverlayModoBoost(db),
      token: getOverlayToken(db),
      pedidoSelecionado: getPedidoSelecionado(db),
      contas: listarContasPedidos(db),
      eventos: listarEventosOverlay(db, 80),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
