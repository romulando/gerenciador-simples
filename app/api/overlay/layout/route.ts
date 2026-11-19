import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getOverlayLayout, getOverlayLayouts, setOverlayLayoutCena } from '@/lib/overlay';
import { ESTADOS_OVERLAY, type EstadoCena } from '@/components/stream-overlay/common';

// GET /api/overlay/layout -> layout legado + layouts por cena (editor)
export async function GET() {
  const db = getDb();
  return NextResponse.json({
    layout: getOverlayLayout(db),
    layouts: getOverlayLayouts(db),
  });
}

// PUT /api/overlay/layout { cena, layout } -> salva posições/tamanhos de uma cena
export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));
  const cena = String(b.cena ?? '') as EstadoCena;
  if (!ESTADOS_OVERLAY.includes(cena)) {
    return NextResponse.json({ error: 'Cena inválida' }, { status: 400 });
  }
  const layouts = setOverlayLayoutCena(db, cena, b.layout ?? {});
  return NextResponse.json({ ok: true, layouts });
}
