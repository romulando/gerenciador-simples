import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getTwitchStatus, montarUrlAutorizacao } from '@/lib/twitch';

// GET /api/overlay/twitch/autorizar -> URL de consentimento da Twitch.
// O `state` anti-CSRF fica num cookie httpOnly verificado no callback.
export async function GET(req: NextRequest) {
  const db = getDb();
  if (!getTwitchStatus(db).secretDefinido) {
    return NextResponse.json(
      { error: 'Salve o Client ID e o Client Secret antes de conectar.' },
      { status: 400 }
    );
  }
  const redirectUri = new URL('/api/overlay/twitch/callback', req.nextUrl.origin).toString();
  const resultado = montarUrlAutorizacao(db, redirectUri);
  if (!resultado) {
    return NextResponse.json({ error: 'Client ID não configurado.' }, { status: 400 });
  }
  const res = NextResponse.json({ url: resultado.url, redirectUri });
  res.cookies.set('gp_twitch_state', resultado.state, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
