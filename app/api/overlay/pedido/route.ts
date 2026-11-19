import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  getPedidoSelecionado,
  getPedidoSelecionadoTipo,
  setPedidoSelecionado,
} from '@/lib/pedidoSelecionado';

// GET /api/overlay/pedido -> tracking selecionado no painel
export async function GET() {
  const db = getDb();
  return NextResponse.json({
    trackingId: getPedidoSelecionado(db),
    tipoServico: getPedidoSelecionadoTipo(db),
  });
}

// PUT /api/overlay/pedido { trackingId, tipoServico } -> define o pedido exibido
export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as {
    trackingId?: string;
    tipoServico?: string;
  };
  const trackingId = setPedidoSelecionado(db, body.trackingId, body.tipoServico);
  return NextResponse.json({
    ok: true,
    trackingId,
    tipoServico: getPedidoSelecionadoTipo(db),
  });
}
