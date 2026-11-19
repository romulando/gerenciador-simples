import { NextResponse } from 'next/server';
import { recalcularPedido } from '@/lib/recalcular';

type Params = { params: Promise<{ id: string }> };

// POST /api/orders/[id]/recalcular -> pergunta os valores ao site e atualiza o tracking.
export async function POST(_req: Request, { params }: Params) {
  const pedidoId = (await params).id;
  try {
    const resposta = await recalcularPedido(pedidoId);
    return NextResponse.json({ ok: true, ...resposta });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao recalcular no site.' },
      { status: 502 }
    );
  }
}
