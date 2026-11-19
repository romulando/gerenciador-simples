import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTwitchStatus, limparTokens, setTwitchCredenciais } from '@/lib/twitch';

// GET /api/overlay/twitch -> status da integração (nunca devolve o secret)
export async function GET() {
  const db = getDb();
  return NextResponse.json(getTwitchStatus(db), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// PUT /api/overlay/twitch { clientId, clientSecret } -> salva credenciais do
// app criado em dev.twitch.tv. Secret vazio mantém o já salvo.
export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));
  const clientId = String(b.clientId ?? '');
  const clientSecret = String(b.clientSecret ?? '');
  if (!clientId.trim() && !clientSecret.trim()) {
    return NextResponse.json({ error: 'Informe o Client ID do app da Twitch.' }, { status: 400 });
  }
  return NextResponse.json(setTwitchCredenciais(db, clientId, clientSecret));
}

// DELETE /api/overlay/twitch -> desconecta o canal (mantém as credenciais)
export async function DELETE() {
  const db = getDb();
  limparTokens(db);
  return NextResponse.json(getTwitchStatus(db));
}
