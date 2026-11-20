import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken } from '@/lib/gsi';
import {
  GSI_ARQUIVO,
  localizarDota,
  montarConteudoGsi,
  verificarGsiInstalado,
} from '@/lib/dotaGsi';

// GET /api/acompanhamento/gsi-config -> conteúdo do arquivo GSI + pasta detectada
export async function GET(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);

  // Dota 2 só posta em HTTP no próprio PC; usamos a mesma porta do painel.
  // 127.0.0.1 evita o caso em que "localhost" resolve para IPv6 (::1) e o
  // servidor do Next está ouvindo só em IPv4.
  const host = req.headers.get('host') ?? 'localhost:4000';
  const porta = host.includes(':') ? host.split(':').pop() : '4000';
  const uri = `http://127.0.0.1:${porta}/api/gsi`;

  const localizacao = localizarDota();

  return NextResponse.json({
    uri,
    token,
    nomeArquivo: GSI_ARQUIVO,
    conteudo: montarConteudoGsi(uri, token),
    localizacao,
    // Diz se o .cfg encontrado é deste painel (o nome do arquivo é o mesmo de
    // outros gerenciadores, então não basta existir).
    verificacao: verificarGsiInstalado(localizacao, uri, token),
  });
}
