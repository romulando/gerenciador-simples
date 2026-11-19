import { NextResponse } from 'next/server';
import { listarPedidos } from '@/lib/data';

// GET /api/orders -> lista os pedidos do Theone (RLS).
export async function GET() {
  try {
    const pedidos = await listarPedidos();
    return NextResponse.json({ pedidos }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao listar os pedidos.' },
      { status: 500 }
    );
  }
}
