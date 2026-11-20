import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  descartarPartidaPendente,
  finalizarPartidaPendente,
} from '@/lib/gsi';

export const dynamic = 'force-dynamic';

// POST /api/acompanhamento/partida-pendente { matchId, resultado: 'W'|'L' }
// Registra no pedido uma partida que ficou aguardando resultado.
export async function POST(req: NextRequest) {
  let body: { matchId?: string; resultado?: string };
  try {
    body = (await req.json()) as { matchId?: string; resultado?: string };
  } catch {
    return NextResponse.json({ error: 'Payload inválido.' }, { status: 400 });
  }

  const matchId = String(body.matchId ?? '').trim();
  const resultado: 'W' | 'L' | null =
    body.resultado === 'W' ? 'W' : body.resultado === 'L' ? 'L' : null;
  if (!matchId || !resultado) {
    return NextResponse.json(
      { error: 'Informe matchId e resultado (W ou L).' },
      { status: 400 }
    );
  }

  const r = finalizarPartidaPendente(getDb(), matchId, resultado);
  return NextResponse.json(
    r.ok ? r : { ...r, error: r.erro || 'Partida pendente não encontrada.' },
    { status: r.ok ? 200 : 404 }
  );
}

// DELETE /api/acompanhamento/partida-pendente?matchId=...
// Descarta a partida pendente sem registrar.
export async function DELETE(req: NextRequest) {
  const matchId = String(req.nextUrl.searchParams.get('matchId') ?? '').trim();
  if (!matchId) {
    return NextResponse.json({ error: 'Informe o matchId.' }, { status: 400 });
  }
  const ok = descartarPartidaPendente(getDb(), matchId);
  return NextResponse.json(
    ok ? { ok } : { ok, error: 'Partida pendente não encontrada.' },
    { status: ok ? 200 : 404 }
  );
}
