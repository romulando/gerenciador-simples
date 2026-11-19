import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken } from '@/lib/gsi';
import { GSI_ARQUIVO, localizarDota, montarConteudoGsi } from '@/lib/dotaGsi';

// GET /api/acompanhamento/gsi-config -> conteúdo do arquivo GSI + pasta detectada
export async function GET(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);

  // Dota 2 só posta em HTTP no localhost; usamos a mesma porta do painel.
  const host = req.headers.get('host') ?? 'localhost:4000';
  const porta = host.includes(':') ? host.split(':').pop() : '4000';
  const uri = `http://localhost:${porta}/api/gsi`;

  return NextResponse.json({
    uri,
    token,
    nomeArquivo: GSI_ARQUIVO,
    conteudo: montarConteudoGsi(uri, token),
    localizacao: localizarDota(),
  });
}
