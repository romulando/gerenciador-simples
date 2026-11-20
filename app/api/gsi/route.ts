import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  getGsiToken,
  processarGsi,
  registrarPayloadInvalido,
  type PayloadGsi,
} from '@/lib/gsi';

export const dynamic = 'force-dynamic';

function metaDaRequisicao(req: NextRequest) {
  return {
    host: req.headers.get('host') ?? '',
    bytes: Number(req.headers.get('content-length')) || 0,
    ip: req.headers.get('x-forwarded-for') ?? '',
  };
}

// GET serve só para conferir no navegador que a rota/porta está acessível.
// O Dota 2 sempre usa POST.
export async function GET() {
  return NextResponse.json(
    {
      ok: true,
      rota: '/api/gsi',
      metodo: 'POST',
      descricao: 'Receptor do Game State Integration do Dota 2',
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// Receptor do Game State Integration do Dota 2 (aba Acompanhamento).
// Configurado pelo arquivo gamestate_integration_acompanhamento.cfg.
// Esta rota fica liberada no proxy (sem sessão), protegida pelo token do GSI.
export async function POST(req: NextRequest) {
  const meta = metaDaRequisicao(req);

  let data: PayloadGsi;
  try {
    data = (await req.json()) as PayloadGsi;
  } catch {
    registrarPayloadInvalido(meta, 'json');
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const db = getDb();
  const tokenEsperado = getGsiToken(db);
  const tokenRecebido = String(data.auth?.token ?? '');
  if (tokenRecebido !== tokenEsperado) {
    // Registra o motivo no diagnóstico do painel: sem isso, um token de outra
    // instalação deixava o Acompanhamento eternamente em "aguardando".
    registrarPayloadInvalido(meta, 'token', tokenRecebido);
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    processarGsi(data, meta);
  } catch (e) {
    console.error('[GSI] Erro ao processar payload:', e);
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
