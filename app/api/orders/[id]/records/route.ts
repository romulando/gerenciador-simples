import { NextRequest, NextResponse } from 'next/server';
import { criarRegistro, editarRegistro, removerRegistro, type MotivoAjuste } from '@/lib/records';
import { recalcularPedido } from '@/lib/recalcular';

type Params = { params: Promise<{ id: string }> };

async function tentarRecalcular(pedidoId: string) {
  try {
    return { recalculo: await recalcularPedido(pedidoId) };
  } catch (e) {
    return { aviso: (e as Error).message || 'Registro salvo, mas o site não recalculou.' };
  }
}

// POST /api/orders/[id]/records
export async function POST(req: NextRequest, { params }: Params) {
  const pedidoId = (await params).id;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const tipo = String(b.tipo ?? '');

  try {
    if (tipo !== 'mmr' && tipo !== 'partidas' && tipo !== 'ajuste_mmr') {
      return NextResponse.json({ error: 'Tipo de registro inválido.' }, { status: 400 });
    }
    const registro = await criarRegistro({
      pedido_id: pedidoId,
      tipo,
      data: b.data as string | undefined,
      mmr_inicial: b.mmrInicial != null ? Number(b.mmrInicial) : undefined,
      mmr_final: b.mmrFinal != null ? Number(b.mmrFinal) : undefined,
      quantidade: b.quantidade != null ? Number(b.quantidade) : undefined,
      medalha: b.medalha as string | undefined,
      observacoes: b.observacoes as string | undefined,
      hero: b.hero as string | undefined,
      resultado: b.resultado as string | undefined,
      kills: b.kills == null || b.kills === '' ? null : Number(b.kills),
      deaths: b.deaths == null || b.deaths === '' ? null : Number(b.deaths),
      assists: b.assists == null || b.assists === '' ? null : Number(b.assists),
      novoMmr: b.novoMmr != null ? Number(b.novoMmr) : undefined,
      motivo: b.motivo as MotivoAjuste | undefined,
      motivoOutro: b.motivoOutro as string | undefined,
    });
    const resultado = await tentarRecalcular(pedidoId);
    return NextResponse.json({ ok: true, registro, ...resultado }, { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao salvar o registro.' },
      { status: 400 }
    );
  }
}

// PUT /api/orders/[id]/records { registroId, ... }
export async function PUT(req: NextRequest, { params }: Params) {
  const pedidoId = (await params).id;
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const registroId = String(b.registroId ?? '');
  if (!registroId) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 });

  try {
    // O formulário envia camelCase; o banco usa snake_case.
    const dados: Record<string, unknown> = {
      data: b.data,
      quantidade: b.quantidade,
      medalha: b.medalha,
      observacoes: b.observacoes,
      hero: b.hero,
      resultado: b.resultado,
      kills: b.kills,
      deaths: b.deaths,
      assists: b.assists,
    };
    if (b.mmrInicial !== undefined) dados.mmr_inicial = b.mmrInicial;
    if (b.mmrFinal !== undefined) dados.mmr_final = b.mmrFinal;
    if (b.motivo_ajuste !== undefined) dados.motivo_ajuste = b.motivo_ajuste;

    const registro = await editarRegistro(pedidoId, registroId, dados);
    const resultado = await tentarRecalcular(pedidoId);
    return NextResponse.json({ ok: true, registro, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao editar o registro.' },
      { status: 400 }
    );
  }
}

// DELETE /api/orders/[id]/records?registroId=...
export async function DELETE(req: NextRequest, { params }: Params) {
  const pedidoId = (await params).id;
  const registroId = req.nextUrl.searchParams.get('registroId') ?? '';
  if (!registroId) return NextResponse.json({ error: 'Registro inválido.' }, { status: 400 });

  try {
    await removerRegistro(pedidoId, registroId);
    const resultado = await tentarRecalcular(pedidoId);
    return NextResponse.json({ ok: true, ...resultado });
  } catch (e) {
    return NextResponse.json(
      { error: (e as Error).message || 'Falha ao excluir o registro.' },
      { status: 400 }
    );
  }
}
