import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOverlayToken } from '@/lib/overlay';
import { confirmarTransicao } from '@/lib/obsCenas';

// POST /api/overlay/transicao?token=... { seq }
// A overlay chama no instante em que o fogo cobre a tela: é aqui que o OBS
// troca de cena, embaixo do efeito. Confirmações repetidas são ignoradas.
export async function POST(req: NextRequest) {
  const db = getDb();
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token || token !== getOverlayToken(db)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const seq = Number((body as { seq?: unknown }).seq);
  if (!Number.isFinite(seq) || seq <= 0) {
    return NextResponse.json({ error: 'Sequência inválida' }, { status: 400 });
  }

  const res = await confirmarTransicao(db, seq);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.erro || 'Falha ao trocar a cena no OBS' },
      { status: 502 }
    );
  }
  return NextResponse.json({ ok: true, ignorada: Boolean(res.ignorada) });
}
