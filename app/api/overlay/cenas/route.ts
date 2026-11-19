import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  forcarEstado,
  getCenasAtivas,
  getEstadoExibicao,
  getModoDescanso,
  getObsConexao,
  getObsNomes,
  setCenasAtivas,
  setObsConexao,
  setObsNomes,
  statusObs,
  type EstadoCena,
} from '@/lib/obsCenas';

const ESTADOS_VALIDOS: EstadoCena[] = ['menu', 'draft', 'game', 'descanso'];

// GET /api/overlay/cenas -> status do OBS + nomes/config das cenas
export async function GET() {
  const db = getDb();
  const ativo = getCenasAtivas(db);
  // Desligado: nem tenta abrir conexão com o OBS.
  const status = ativo
    ? await statusObs(db)
    : { conectado: false, cenaAtual: null, cenas: [], erro: '' };
  const conexao = getObsConexao(db);
  return NextResponse.json(
    {
      ...status,
      ativo,
      nomes: getObsNomes(db),
      modoDescanso: ativo ? getModoDescanso(db) : false,
      ultimoEstado: getEstadoExibicao(db),
      conexao: {
        host: conexao.host,
        port: conexao.port,
        senhaDefinida: Boolean(conexao.senha),
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PUT /api/overlay/cenas { nomes?, conexao? } -> salva nomes das cenas e/ou conexão
export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));

  if (typeof b.ativo === 'boolean') {
    setCenasAtivas(db, b.ativo);
  }
  if (b.nomes && typeof b.nomes === 'object') {
    setObsNomes(db, b.nomes as Record<EstadoCena, unknown>);
  }
  if (b.conexao && typeof b.conexao === 'object') {
    setObsConexao(db, b.conexao as { host?: unknown; port?: unknown; senha?: unknown });
  }

  const conexao = getObsConexao(db);
  return NextResponse.json({
    ok: true,
    ativo: getCenasAtivas(db),
    nomes: getObsNomes(db),
    conexao: {
      host: conexao.host,
      port: conexao.port,
      senhaDefinida: Boolean(conexao.senha),
    },
  });
}

// POST /api/overlay/cenas { estado } -> força a troca de cena (Menu/Draft/Jogando/Descanso)
export async function POST(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));
  const estado = String(b.estado ?? '') as EstadoCena;

  if (!ESTADOS_VALIDOS.includes(estado)) {
    return NextResponse.json({ error: 'Estado inválido' }, { status: 400 });
  }

  // Troca de cenas desligada: responde ok sem tocar no OBS.
  if (!getCenasAtivas(db)) {
    return NextResponse.json({ ok: true, desativado: true });
  }

  const res = await forcarEstado(db, estado);
  if (!res.ok) {
    return NextResponse.json(
      { error: res.erro || 'Falha ao trocar a cena no OBS' },
      { status: 502 }
    );
  }
  return NextResponse.json({
    ok: true,
    estado,
    cenaAtual: res.cenaAtual,
    pendente: Boolean(res.pendente),
  });
}