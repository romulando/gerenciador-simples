import { createClient } from '@supabase/supabase-js';

// Cliente público (publishable key): usado apenas para as RPCs de leitura
// pública do overlay, nunca para escrever.
export function getSupabasePublic() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error('Supabase não configurado (SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY).');
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
