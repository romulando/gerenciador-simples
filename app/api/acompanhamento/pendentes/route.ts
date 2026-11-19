import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createSupabaseServer } from '@/lib/supabase/server';
import {
  processarPendentes,
  resumoPendentes,
} from '@/lib/registrosPendentes';

export const dynamic = 'force-dynamic';

// GET /api/acompanhamento/pendentes -> resumo da fila local
export async function GET() {
  return NextResponse.json(resumoPendentes(getDb()), {
    headers: { 'Cache-Control': 'no-store' },
  });
}

// POST /api/acompanhamento/pendentes -> grava as partidas pendentes no
// Supabase e recalcula os pedidos. Usa a sessão do usuário (RLS do Theone).
export async function POST() {
  const db = getDb();
  try {
    const cliente = await createSupabaseServer();
    const resultado = await processarPendentes(db, {
      cliente,
      forcar: true,
      timeoutMs: 20_000,
    });
    return NextResponse.json(resultado, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao registrar as partidas pendentes.' },
      { status: 500 }
    );
  }
}
