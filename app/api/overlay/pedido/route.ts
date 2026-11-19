import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getPedidoSelecionado, setPedidoSelecionado } from '@/lib/overlay';

// GET /api/overlay/pedido -> tracking selecionado no painel
export async function GET() {
  const db = getDb();
  return NextResponse.json({ trackingId: getPedidoSelecionado(db) });
}

// PUT /api/overlay/pedido { trackingId } -> define o pedido exibido na overlay
export async function PUT(req: NextRequest) {
  const db = getDb();
  const body = (await req.json().catch(() => ({}))) as { trackingId?: string };
  const trackingId = setPedidoSelecionado(db, body.trackingId);
  return NextResponse.json({ ok: true, trackingId });
}
