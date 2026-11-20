import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getGsiToken } from '@/lib/gsi';

export const dynamic = 'force-dynamic';

function portaDoHost(host: string): string {
  if (!host) return '4000';
  // Host IPv6: [::1]:4000
  if (host.startsWith('[')) {
    const fim = host.indexOf(']');
    const resto = fim >= 0 ? host.slice(fim + 1) : '';
    return resto.startsWith(':') ? resto.slice(1) : '4000';
  }
  return host.includes(':') ? host.split(':').pop() || '4000' : '4000';
}

// POST /api/acompanhamento/testar-gsi
// Envia um payload sintético para a rota pública /api/gsi. Testa de ponta a
// ponta: servidor ouvindo, rota respondendo e token do painel válido.
export async function POST(req: NextRequest) {
  const db = getDb();
  const token = getGsiToken(db);
  const host = req.headers.get('host') ?? '';
  const porta = portaDoHost(host);
  const url = `http://127.0.0.1:${porta}/api/gsi`;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ teste: true, auth: { token } }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5_000),
    });
    const resposta = (await res.text()).slice(0, 200);
    return NextResponse.json({
      ok: res.ok,
      status: res.status,
      url,
      resposta,
    });
  } catch (e) {
    return NextResponse.json(
      {
        ok: false,
        url,
        error:
          (e as Error).message ||
          'Não foi possível falar com a rota /api/gsi neste PC.',
      },
      { status: 502 }
    );
  }
}
