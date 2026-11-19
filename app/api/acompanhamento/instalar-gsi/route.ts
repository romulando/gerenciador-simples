import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken } from '@/lib/gsi';
import { localizarDota, montarConteudoGsi } from '@/lib/dotaGsi';
import { instalarGsi } from '@/lib/dotaGsi';

// POST /api/acompanhamento/instalar-gsi -> instala o .cfg na pasta do Dota 2 detectada
export async function POST(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);
  const host = req.headers.get('host') ?? 'localhost:4000';
  const porta = host.includes(':') ? host.split(':').pop() : '4000';
  const uri = `http://localhost:${porta}/api/gsi`;

  const resultado = instalarGsi(montarConteudoGsi(uri, token));
  return NextResponse.json(resultado, { status: resultado.ok ? 200 : 400 });
}

// GET -> apenas consulta a localização atual do Dota 2
export async function GET() {
  return NextResponse.json(localizarDota());
}
