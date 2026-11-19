import { createSupabaseServer } from './supabase/server';
import type { LogTheone, PedidoTheone, RegistroTheone } from './types';

export async function listarPedidos(): Promise<PedidoTheone[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('orders_theone')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PedidoTheone[];
}

export async function obterPedido(id: string): Promise<PedidoTheone | null> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('orders_theone')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PedidoTheone | null) ?? null;
}

export async function listarRegistros(pedidoId: string): Promise<RegistroTheone[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('records_theone')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('ordem', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RegistroTheone[];
}

export async function listarLogs(pedidoId: string, limite = 200): Promise<LogTheone[]> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('logs_theone')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('criado_em', { ascending: false })
    .limit(limite);
  if (error) throw new Error(error.message);
  return (data ?? []) as LogTheone[];
}

export async function atualizarPedido(
  id: string,
  patch: Record<string, unknown>
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('orders_theone')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function inserirRegistro(
  registro: Record<string, unknown>
): Promise<RegistroTheone> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('records_theone')
    .insert(registro)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RegistroTheone;
}

export async function atualizarRegistro(
  id: string,
  patch: Record<string, unknown>
): Promise<RegistroTheone> {
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from('records_theone')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RegistroTheone;
}

export async function excluirRegistro(id: string): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from('records_theone').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function registrarLog(
  pedidoId: string | null,
  tipo: string,
  mensagem: string,
  detalhes?: unknown
): Promise<void> {
  try {
    const supabase = await createSupabaseServer();
    await supabase.from('logs_theone').insert({
      pedido_id: pedidoId,
      tipo,
      mensagem: mensagem.slice(0, 500),
      detalhes: detalhes ?? null,
      origem: 'theone',
    });
  } catch {
    // Log acessório: nunca derruba a ação principal.
  }
}

export async function salvarTracking(
  tracking: Record<string, unknown>
): Promise<void> {
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from('web_tracking_theone')
    .upsert(tracking, { onConflict: 'tracking_id' });
  if (error) throw new Error(error.message);
}
