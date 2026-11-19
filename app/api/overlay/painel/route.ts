import { NextResponse, after } from 'next/server';
import { getDb } from '@/lib/db';
import {
  dadosOverlay,
  getOverlayModoBoost,
  getOverlayToken,
  getOverlayWinsLimite,
  getPedidoSelecionado,
} from '@/lib/overlay';
import { getPedidoSelecionadoTipo } from '@/lib/pedidoSelecionado';
import { getCenasAtivas } from '@/lib/obsCenas';
import { listarEventosOverlay } from '@/lib/overlayEventos';
import { listarContasPedidos } from '@/lib/pedidoContas';
import { processarPendentes, resumoPendentes, contarPendentes } from '@/lib/registrosPendentes';
import { createSupabaseServer } from '@/lib/supabase/server';

// GET /api/overlay/painel -> dados da overlay + config + log de eventos.
// Consumido pela página admin (com sessão).
export async function GET() {
  const db = getDb();

  // Com o painel aberto, as partidas enfileiradas pelo GSI são gravadas no
  // pedido em segundo plano, usando a sessão do usuário (RLS do Theone).
  after(async () => {
    if (contarPendentes(db) === 0) return;
    try {
      const cliente = await createSupabaseServer();
      await processarPendentes(db, { cliente, silencioso: true });
    } catch (e) {
      console.warn('[pendentes] falha ao processar:', (e as Error)?.message ?? e);
    }
  });

  return NextResponse.json(
    {
      dados: await dadosOverlay(db),
      cenasAtivo: getCenasAtivas(db),
      limiteWins: getOverlayWinsLimite(db),
      modoBoost: getOverlayModoBoost(db),
      token: getOverlayToken(db),
      pedidoSelecionado: getPedidoSelecionado(db),
      pedidoSelecionadoTipo: getPedidoSelecionadoTipo(db),
      contas: listarContasPedidos(db),
      pendentes: resumoPendentes(db),
      eventos: listarEventosOverlay(db, 80),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
