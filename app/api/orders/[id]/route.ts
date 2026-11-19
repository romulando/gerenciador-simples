import { NextRequest, NextResponse } from 'next/server';
import { atualizarPedido, obterPedido, registrarLog } from '@/lib/data';
import { recalcularPedido } from '@/lib/recalcular';

type Params = { params: Promise<{ id: string }> };

// PATCH /api/orders/[id] { estado?, observacoes? }
export async function PATCH(req: NextRequest, { params }: Params) {
  const pedidoId = (await params).id;
  const b = (await req.json().catch(() => ({}))) as {
    estado?: string;
    observacoes?: string;
  };

  const pedido = await obterPedido(pedidoId);
  if (!pedido) return NextResponse.json({ error: 'Pedido não encontrado.' }, { status: 404 });

  const patch: Record<string, unknown> = {};
  if (b.estado !== undefined) {
    const estados = [
      'lead_aberto',
      'aguardando_pagamento',
      'em_andamento',
      'pausado',
      'concluido',
      'cancelado',
      'ban',
    ];
    if (!estados.includes(b.estado)) {
      return NextResponse.json({ error: 'Estado inválido.' }, { status: 400 });
    }
    patch.estado = b.estado;
  }
  if (b.observacoes !== undefined) patch.observacoes = String(b.observacoes);

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nada para atualizar.' }, { status: 400 });
  }

  await atualizarPedido(pedidoId, patch);
  if (patch.estado && patch.estado !== pedido.estado) {
    await registrarLog(pedidoId, 'estado', `Estado alterado: ${pedido.estado} → ${patch.estado}`, {
      antes: pedido.estado,
      depois: patch.estado,
    });
  }
  if (patch.observacoes !== undefined && patch.observacoes !== pedido.observacoes) {
    await registrarLog(pedidoId, 'observacao', 'Observação atualizada');
  }

  let aviso: string | undefined;
  try {
    await recalcularPedido(pedidoId);
  } catch (e) {
    aviso = (e as Error).message;
  }

  return NextResponse.json({ ok: true, aviso });
}
