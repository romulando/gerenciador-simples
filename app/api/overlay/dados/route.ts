import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { dadosOverlay, getOverlayToken } from '@/lib/overlay';
import { ESTADOS_OVERLAY, type EstadoCena } from '@/components/stream-overlay/common';

// GET /api/overlay/dados?token=...&cena=... -> payload consumido pela overlay no
// OBS. Sem sessão de login (OBS browser source), protegido pelo token da URL.
// O parâmetro opcional ?cena= força o layout de uma cena específica.
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
  return NextResponse.json(await dadosOverlay(db, cena), {
    headers: { 'Cache-Control': 'no-store' },
  });
}
