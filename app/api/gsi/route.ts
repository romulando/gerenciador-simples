import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken, processarGsi, type PayloadGsi } from '@/lib/gsi';

// Receptor do Game State Integration do Dota 2 (aba Acompanhamento).
// Configurado pelo arquivo gamestate_integration_acompanhamento.cfg.
// Esta rota fica liberada no proxy (sem sessão), protegida pelo token do GSI.
export async function POST(req: NextRequest) {
  let data: PayloadGsi;
  try {
    data = (await req.json()) as PayloadGsi;
  } catch {
    return NextResponse.json({ error: 'Payload inválido' }, { status: 400 });
  }

  const db = getDb();
  const tokenEsperado = getGsiToken(db);
  const tokenRecebido = String(data.auth?.token ?? '');
  if (tokenRecebido !== tokenEsperado) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 });
  }

  try {
    processarGsi(data);
  } catch (e) {
    console.error('[GSI] Erro ao processar payload:', e);
  }

  return new Response('OK', { status: 200, headers: { 'Content-Type': 'text/plain' } });
}
