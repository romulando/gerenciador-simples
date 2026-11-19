import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { concluirAutorizacao } from '@/lib/twitch';

// GET /api/overlay/twitch/callback -> retorno do consentimento da Twitch.
// Valida o state, troca o código por tokens e volta para o painel.
export async function GET(req: NextRequest) {
  const db = getDb();
  const params = req.nextUrl.searchParams;
  const destino = (query: string) => {
    const res = NextResponse.redirect(new URL(`/stream-overlay${query}`, req.nextUrl.origin));
    res.cookies.delete('gp_twitch_state');
    return res;
  };

  const erroTwitch = params.get('error');
  if (erroTwitch) {
    const motivo = params.get('error_description') || 'Autorização cancelada na Twitch.';
    return destino(`?twitch=erro&motivo=${encodeURIComponent(motivo)}`);
  }

  const code = params.get('code') ?? '';
  const state = params.get('state') ?? '';
  const stateCookie = req.cookies.get('gp_twitch_state')?.value ?? '';
  if (!code) {
    return destino(`?twitch=erro&motivo=${encodeURIComponent('Código ausente no retorno da Twitch.')}`);
  }
  if (!state || !stateCookie || state !== stateCookie) {
    return destino(
      `?twitch=erro&motivo=${encodeURIComponent('Sessão de autorização inválida. Tente conectar novamente.')}`
    );
  }

  const redirectUri = new URL('/api/overlay/twitch/callback', req.nextUrl.origin).toString();
  const resultado = await concluirAutorizacao(db, code, redirectUri);
  if (!resultado.ok) {
    return destino(`?twitch=erro&motivo=${encodeURIComponent(resultado.mensagem)}`);
  }
  return destino('?twitch=ok');
}
