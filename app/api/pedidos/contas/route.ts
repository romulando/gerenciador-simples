import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { contaDotaValida } from '@/lib/contaDota';
import { TIPOS_SERVICO } from '@/lib/helpers';
import { listarContasPedidos, setContaPedido } from '@/lib/pedidoContas';

// GET /api/pedidos/contas -> vínculos tracking ID x conta do Dota 2 (banco local)
export async function GET() {
  const db = getDb();
  return NextResponse.json(
    { contas: listarContasPedidos(db) },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

// PUT /api/pedidos/contas { trackingId, accountId, tipoServico? }
// accountId vazio remove o vínculo. Aceita account_id ou SteamID64.
export async function PUT(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    trackingId?: string;
    accountId?: string;
    tipoServico?: string;
  };
  const trackingId = String(body.trackingId ?? '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(trackingId)) {
    return NextResponse.json({ error: 'Tracking ID inválido.' }, { status: 400 });
  }

  const bruto = String(body.accountId ?? '').trim();
  if (bruto && !contaDotaValida(bruto)) {
    return NextResponse.json(
      { error: 'Informe um ID numérico válido (mínimo 4 dígitos).' },
      { status: 400 }
    );
  }

  const tipoBruto = String(body.tipoServico ?? '').trim();
  const tipoServico = Object.prototype.hasOwnProperty.call(TIPOS_SERVICO, tipoBruto)
    ? tipoBruto
    : '';

  const accountId = setContaPedido(getDb(), trackingId, bruto, tipoServico);
  return NextResponse.json({ ok: true, trackingId, accountId, tipoServico });
}
