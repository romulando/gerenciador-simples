import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  ESTILOS_BARRA_LIVEPIX,
  FOGO_DURACAO_MAX_MS,
  FOGO_DURACAO_MIN_MS,
  LIVEPIX_META_MAX,
  OVERLAY_SUB_META_MAX,
  OVERLAY_SUB_META_MIN,
  OVERLAY_WINS_LIMITE_MAX,
  OVERLAY_WINS_LIMITE_MIN,
  PALETAS_FOGO,
  type EstiloBarraLivepix,
  type FogoOverlayConfig,
  type PaletaFogo,
} from '@/components/stream-overlay/common';
import {
  getOverlayFogo,
  getOverlayLivepixAtivo,
  getOverlayLivepixEstilo,
  getOverlayLivepixMeta,
  getOverlayModoBoost,
  getOverlaySlides,
  getOverlaySubAtivo,
  getOverlaySubCor,
  getOverlaySubMeta,
  getOverlayToken,
  getOverlayWinsLimite,
  setOverlayFogo,
  setOverlayLivepixAtivo,
  setOverlayLivepixEstilo,
  setOverlayLivepixMeta,
  setOverlayModoBoost,
  setOverlaySlides,
  setOverlaySubAtivo,
  setOverlaySubCor,
  setOverlaySubMeta,
  setOverlayWinsLimite,
} from '@/lib/overlay';

// GET /api/overlay/config -> limites atuais, carrossel, LivePix, transição de
// fogo e token da overlay
export async function GET() {
  const db = getDb();
  return NextResponse.json({
    limiteWins: getOverlayWinsLimite(db),
    modoBoost: getOverlayModoBoost(db),
    subAtivo: getOverlaySubAtivo(db),
    subMeta: getOverlaySubMeta(db),
    subCor: getOverlaySubCor(db),
    slides: getOverlaySlides(db),
    livepixAtivo: getOverlayLivepixAtivo(db),
    livepixEstilo: getOverlayLivepixEstilo(db),
    livepixMeta: getOverlayLivepixMeta(db),
    fogo: getOverlayFogo(db),
    token: getOverlayToken(db),
  });
}

// PUT /api/overlay/config { limiteWins, modoBoost, subAtivo, subMeta, subCor,
//   slides, livepixAtivo, livepixEstilo, livepixMeta, fogo }
export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));

  if (b.limiteWins !== undefined) {
    const valor = Number(b.limiteWins);
    if (
      !Number.isFinite(valor) ||
      valor < OVERLAY_WINS_LIMITE_MIN ||
      valor > OVERLAY_WINS_LIMITE_MAX
    ) {
      return NextResponse.json(
        {
          error: `Quantidade de partidas deve ser um número entre ${OVERLAY_WINS_LIMITE_MIN} e ${OVERLAY_WINS_LIMITE_MAX}`,
        },
        { status: 400 }
      );
    }
    setOverlayWinsLimite(db, valor);
  }

  if (b.modoBoost !== undefined) {
    setOverlayModoBoost(db, b.modoBoost);
  }

  if (b.subAtivo !== undefined) {
    setOverlaySubAtivo(db, b.subAtivo);
  }

  if (b.subMeta !== undefined) {
    const valor = Number(b.subMeta);
    if (
      !Number.isFinite(valor) ||
      valor < OVERLAY_SUB_META_MIN ||
      valor > OVERLAY_SUB_META_MAX
    ) {
      return NextResponse.json(
        { error: `Meta de subs deve ser um número entre ${OVERLAY_SUB_META_MIN} e ${OVERLAY_SUB_META_MAX}` },
        { status: 400 }
      );
    }
    setOverlaySubMeta(db, valor);
  }

  if (b.subCor !== undefined) {
    setOverlaySubCor(db, b.subCor);
  }

  if (b.slides !== undefined) {
    setOverlaySlides(db, b.slides);
  }

  if (b.livepixAtivo !== undefined) {
    setOverlayLivepixAtivo(db, b.livepixAtivo);
  }

  if (b.livepixEstilo !== undefined) {
    if (!ESTILOS_BARRA_LIVEPIX.includes(b.livepixEstilo as EstiloBarraLivepix)) {
      return NextResponse.json(
        { error: 'Estilo da barra do LivePix inválido' },
        { status: 400 }
      );
    }
    setOverlayLivepixEstilo(db, b.livepixEstilo);
  }

  if (b.livepixMeta !== undefined) {
    const valor = Number(b.livepixMeta);
    if (!Number.isFinite(valor) || valor < 0 || valor > LIVEPIX_META_MAX) {
      return NextResponse.json(
        { error: `A meta do LivePix deve ser um número entre 0 e ${LIVEPIX_META_MAX}.` },
        { status: 400 }
      );
    }
    setOverlayLivepixMeta(db, valor);
  }

  if (b.fogo !== undefined) {
    if (typeof b.fogo !== 'object' || b.fogo === null || Array.isArray(b.fogo)) {
      return NextResponse.json(
        { error: 'Configuração da transição de fogo inválida' },
        { status: 400 }
      );
    }
    const fogo = b.fogo as Partial<FogoOverlayConfig>;
    if (fogo.ativo !== undefined && typeof fogo.ativo !== 'boolean') {
      return NextResponse.json(
        { error: 'O campo "ativo" da transição de fogo deve ser booleano' },
        { status: 400 }
      );
    }
    if (fogo.paleta !== undefined && !PALETAS_FOGO.includes(fogo.paleta as PaletaFogo)) {
      return NextResponse.json({ error: 'Paleta de fogo inválida' }, { status: 400 });
    }
    if (fogo.duracaoMs !== undefined) {
      const duracao = Number(fogo.duracaoMs);
      if (
        !Number.isFinite(duracao) ||
        duracao < FOGO_DURACAO_MIN_MS ||
        duracao > FOGO_DURACAO_MAX_MS
      ) {
        return NextResponse.json(
          {
            error: `A duração da transição deve ficar entre ${FOGO_DURACAO_MIN_MS} e ${FOGO_DURACAO_MAX_MS} ms`,
          },
          { status: 400 }
        );
      }
    }
    setOverlayFogo(db, fogo);
  }

  return NextResponse.json({
    ok: true,
    limiteWins: getOverlayWinsLimite(db),
    modoBoost: getOverlayModoBoost(db),
    subAtivo: getOverlaySubAtivo(db),
    subMeta: getOverlaySubMeta(db),
    subCor: getOverlaySubCor(db),
    slides: getOverlaySlides(db),
    livepixAtivo: getOverlayLivepixAtivo(db),
    livepixEstilo: getOverlayLivepixEstilo(db),
    livepixMeta: getOverlayLivepixMeta(db),
    fogo: getOverlayFogo(db),
  });
}
