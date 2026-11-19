import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { estadoLayoutOverlay, getOverlayToken } from '@/lib/overlay';
import { getTransicaoPendente } from '@/lib/obsCenas';
import { ESTADOS_OVERLAY, type EstadoCena } from '@/components/stream-overlay/common';

// GET /api/overlay/estado?token=...&cena=... -> cena atual, layout e transição.
// Endpoint leve (leitura do banco, sem Twitch/LivePix) consultado em alta
// frequência pela overlay: assim os elementos acompanham a troca de cena do
// OBS em menos de 1 s, sem esperar o payload completo de /api/overlay/dados.
// `transicao` anuncia a próxima cena: a overlay toca o fogo e confirma na
// cobertura, e só então o servidor troca a cena no OBS.
export async function GET(req: NextRequest) {
  const db = getDb();
  const token = req.nextUrl.searchParams.get('token') ?? '';
  if (!token || token !== getOverlayToken(db)) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }
  const cenaParam = req.nextUrl.searchParams.get('cena') ?? '';
  const cena = ESTADOS_OVERLAY.includes(cenaParam as EstadoCena)
    ? (cenaParam as EstadoCena)
    : null;

  const base = estadoLayoutOverlay(db, cena);
  // Em modo de cena forçada (prévia do editor) a transição não é seguida.
  const pendente = cena ? null : getTransicaoPendente();
  let transicao = null;
  if (pendente) {
    const alvo = estadoLayoutOverlay(db, pendente.destino);
    transicao = {
      seq: pendente.seq,
      destino: pendente.destino,
      layout: alvo.layout,
      fogo: alvo.fogo,
    };
  }

  return NextResponse.json(
    { ...base, transicao },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
