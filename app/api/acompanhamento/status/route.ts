import { NextResponse } from 'next/server';
import { autoVincularContaDetectada } from '@/lib/autoVinculo';
import { getDb } from '@/lib/db';
import {
  getDiagnosticoGsi,
  getEstadoGsi,
  listarPartidasPendentes,
} from '@/lib/gsi';
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
  // Mantém o vínculo automático atualizado enquanto o Acompanhamento estiver
  // aberto, sem depender de recarregar a página. O resultado é devolvido para
  // a tela atualizar os componentes renderizados no servidor (aviso de conta).
  const autoVinculo = await autoVincularContaDetectada(db).catch(() => null);
  return NextResponse.json(
    {
      gsi: getEstadoGsi(),
      gsiDiagnostico: getDiagnosticoGsi(),
      partidasPendentes: listarPartidasPendentes(db),
      pedidoSelecionado: getPedidoSelecionado(db),
      pedidoSelecionadoTipo: getPedidoSelecionadoTipo(db),
      contas: listarContasPedidos(db),
      pendentes: resumoPendentes(db),
      autoVinculo,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
