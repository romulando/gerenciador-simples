import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  contarPartidas,
  listarPartidas,
  resumoPartidas,
  salvarPartidaManual,
} from '@/lib/acompanhamentoPartidas';

export const dynamic = 'force-dynamic';

// GET /api/acompanhamento/partidas?hoje=1&resultado=W&vinculo=sem&busca=&limite=
export async function GET(req: NextRequest) {
  const db = getDb();
  const sp = req.nextUrl.searchParams;
  const filtros = {
    hoje: sp.get('hoje') === '1',
    resultado: sp.get('resultado') ?? '',
    vinculo: sp.get('vinculo') ?? '',
    busca: sp.get('busca') ?? '',
    limite: Number(sp.get('limite')) || 50,
  };
  return NextResponse.json(
    {
      partidas: listarPartidas(db, filtros),
      resumo: resumoPartidas(db),
      total: contarPartidas(db, filtros),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// POST /api/acompanhamento/partidas -> adiciona uma partida manual no banco local.
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const matchId = String(b.matchId ?? '').trim();

  try {
    const resultado = salvarPartidaManual(db, {
      matchId,
      trackingId: String(b.trackingId ?? ''),
      hero: String(b.hero ?? ''),
      resultado: String(b.resultado ?? ''),
      kills: Number(b.kills) || 0,
      deaths: Number(b.deaths) || 0,
      assists: Number(b.assists) || 0,
      duracao: Number(b.duracao) || 0,
      data: String(b.data ?? ''),
    });
    if (!resultado.nova) {
      return NextResponse.json(
        { error: `A partida ${matchId} já está salva no histórico.` },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, partida: resultado.partida }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao salvar a partida.' },
      { status: 400 }
    );
  }
}
