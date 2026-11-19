import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken } from '@/lib/gsi';
import {
  localizarDota,
  montarConteudoGsi,
  verificarGsiInstalado,
  instalarGsi,
} from '@/lib/dotaGsi';

// Dota 2 só posta em HTTP no localhost; usamos a mesma porta do painel.
function uriGsi(req: NextRequest): string {
  const host = req.headers.get('host') ?? 'localhost:4000';
  const porta = host.includes(':') ? host.split(':').pop() : '4000';
  return `http://localhost:${porta}/api/gsi`;
}

// POST /api/acompanhamento/instalar-gsi -> instala o .cfg na pasta do Dota 2 detectada
export async function POST(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);
  const uri = uriGsi(req);

  const resultado = instalarGsi(montarConteudoGsi(uri, token));
  return NextResponse.json(
    {
      ...resultado,
      // Revalida o que foi gravado: se o arquivo não for o nosso, o painel
      // segue mostrando o card para o usuário substituir.
      verificacao: verificarGsiInstalado(resultado.localizacao, uri, token),
    },
    { status: resultado.ok ? 200 : 400 }
  );
}

// GET -> apenas consulta a localização atual do Dota 2
export async function GET(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);
  const uri = uriGsi(req);
  const localizacao = localizarDota();
  return NextResponse.json({
    ...localizacao,
    verificacao: verificarGsiInstalado(localizacao, uri, token),
  });
}
