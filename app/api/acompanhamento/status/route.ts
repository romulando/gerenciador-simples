import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getEstadoGsi } from '@/lib/gsi';
import { listarContasPedidos } from '@/lib/pedidoContas';
import {
  getPedidoSelecionado,
  getPedidoSelecionadoTipo,
} from '@/lib/pedidoSelecionado';
import { resumoPendentes } from '@/lib/registrosPendentes';

export const dynamic = 'force-dynamic';

// GET /api/acompanhamento/status -> GSI ao vivo + vínculos + fila pendente.
// Rota autenticada (o proxy exige sessão); usada pela página de Acompanhamento.
export async function GET() {
  const db = getDb();
  return NextResponse.json(
    {
      gsi: getEstadoGsi(),
      pedidoSelecionado: getPedidoSelecionado(db),
      pedidoSelecionadoTipo: getPedidoSelecionadoTipo(db),
      contas: listarContasPedidos(db),
      pendentes: resumoPendentes(db),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
