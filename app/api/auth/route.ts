import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServer } from '@/lib/supabase/server';
import { loginPermitido, THEONE_EMAIL } from '@/lib/auth';

// POST /api/auth { action: 'login' | 'logout', login?, senha? }
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    login?: string;
    senha?: string;
  };

  if (body.action === 'logout') {
    const supabase = await createSupabaseServer();
    await supabase.auth.signOut();
    return NextResponse.json({ ok: true });
  }

  const login = String(body.login ?? '').trim();
  const senha = String(body.senha ?? '');
  if (!login || !senha) {
    return NextResponse.json({ error: 'Informe usuário e senha.' }, { status: 400 });
  }
  if (!loginPermitido(login)) {
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: THEONE_EMAIL,
    password: senha,
  });
  if (error) {
    const codigo = String((error as { code?: string }).code ?? '');
    if (codigo === 'email_provider_disabled') {
      return NextResponse.json(
        {
          error:
            'O login por e-mail está desativado no Supabase. Ative em Authentication > Providers > Email.',
        },
        { status: 503 }
      );
    }
    if (/email not confirmed/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Confirme o e-mail do usuário Theone no Supabase antes de entrar.' },
        { status: 401 }
      );
    }
    return NextResponse.json({ error: 'Usuário ou senha incorretos.' }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
