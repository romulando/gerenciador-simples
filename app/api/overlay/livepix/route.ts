import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import {
  getLivepixStatus,
  limparTokensLivepix,
  setLivepixCredenciais,
  testarConexaoLivepix,
} from '@/lib/livepix';

// GET /api/overlay/livepix -> status da integração (nunca devolve o secret)
export async function GET() {
  const db = getDb();
  return NextResponse.json(getLivepixStatus(db), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// PUT /api/overlay/livepix { clientId, clientSecret } -> salva as credenciais
// do app criado no painel da LivePix e testa a conexão (client_credentials).
// Secret vazio mantém o já salvo.
export async function PUT(req: NextRequest) {
  const db = getDb();
  const b = await req.json().catch(() => ({}));
  const clientId = String(b.clientId ?? '');
  const clientSecret = String(b.clientSecret ?? '');
  if (!clientId.trim() && !clientSecret.trim()) {
    return NextResponse.json(
      { error: 'Informe o Client ID do app da LivePix.' },
      { status: 400 }
    );
  }
  const status = setLivepixCredenciais(db, clientId, clientSecret);
  if (!status.clientIdDefinido || !status.secretDefinido) {
    return NextResponse.json(status);
  }
  const teste = await testarConexaoLivepix(db);
  return NextResponse.json({ ...getLivepixStatus(db), mensagem: teste.mensagem });
}

// DELETE /api/overlay/livepix -> desconecta (mantém as credenciais salvas)
export async function DELETE() {
  const db = getDb();
  limparTokensLivepix(db);
  return NextResponse.json(getLivepixStatus(db));
}
