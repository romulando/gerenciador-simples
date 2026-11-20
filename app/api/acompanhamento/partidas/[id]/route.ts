import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { excluirPartida } from '@/lib/acompanhamentoPartidas';

type Params = { params: Promise<{ id: string }> };

// DELETE /api/acompanhamento/partidas/[id]
// Remove apenas o histórico local; o registro já lançado no pedido não é alterado.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const partidaId = Number(id);
  if (!Number.isInteger(partidaId) || partidaId <= 0) {
    return NextResponse.json({ error: 'ID inválido.' }, { status: 400 });
  }
  const ok = excluirPartida(getDb(), partidaId);
  if (!ok) {
    return NextResponse.json({ error: 'Partida não encontrada.' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
