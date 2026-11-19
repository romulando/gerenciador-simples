import { cache } from 'react';
import { createSupabaseServer } from './supabase/server';

export const THEONE_EMAIL = process.env.THEONE_EMAIL ?? 'theone@boostmmr.com.br';
export const THEONE_LOGIN = process.env.THEONE_LOGIN ?? 'Theone';

export function loginPermitido(login: string): boolean {
  const valor = String(login ?? '').trim().toLowerCase();
  return valor === THEONE_LOGIN.toLowerCase() || valor === THEONE_EMAIL.toLowerCase();
}

export const getUser = cache(async () => {
  const supabase = await createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
