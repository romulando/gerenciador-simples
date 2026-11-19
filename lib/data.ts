import { createSupabaseServer } from './supabase/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { LogTheone, PedidoTheone, RegistroTheone } from './types';

// Cliente Supabase injetável: o fluxo normal usa a sessão do usuário
// (createSupabaseServer); o processamento em segundo plano pode reaproveitar
// um cliente já criado no request que o disparou.
export type ClienteSupabase = SupabaseClient;

async function clientePadrao(cliente?: ClienteSupabase): Promise<ClienteSupabase> {
  return cliente ?? (await createSupabaseServer());
}

export async function listarPedidos(cliente?: ClienteSupabase): Promise<PedidoTheone[]> {
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('orders_theone')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PedidoTheone[];
}

export async function obterPedido(
  id: string,
  cliente?: ClienteSupabase
): Promise<PedidoTheone | null> {
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('orders_theone')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as PedidoTheone | null) ?? null;
}

// Pedido pelo tracking público (usado pelo registro automático do GSI).
export async function obterPedidoPorTracking(
  trackingId: string,
  cliente?: ClienteSupabase
): Promise<PedidoTheone | null> {
  const id = String(trackingId ?? '').trim().toUpperCase();
  if (!id) return null;
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('orders_theone')
    .select('*')
    .eq('tracking_id', id)
    .order('created_at', { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as PedidoTheone | undefined) ?? null;
}

export async function listarRegistros(
  pedidoId: string,
  cliente?: ClienteSupabase
): Promise<RegistroTheone[]> {
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('records_theone')
    .select('*')
    .eq('pedido_id', pedidoId)
    .order('ordem', { ascending: true, nullsFirst: true })
    .order('created_at', { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as RegistroTheone[];
}

export async function listarLogs(
  pedidoId: string,
  limite = 200,
  cliente?: ClienteSupabase
): Promise<LogTheone[]> {
  const supabase = await clientePadrao(cliente);
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
  patch: Record<string, unknown>,
  cliente?: ClienteSupabase
): Promise<void> {
  const supabase = await clientePadrao(cliente);
  const { error } = await supabase
    .from('orders_theone')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function inserirRegistro(
  registro: Record<string, unknown>,
  cliente?: ClienteSupabase
): Promise<RegistroTheone> {
  const supabase = await clientePadrao(cliente);
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
  patch: Record<string, unknown>,
  cliente?: ClienteSupabase
): Promise<RegistroTheone> {
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('records_theone')
    .update({ ...patch, atualizado_em: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as RegistroTheone;
}

export async function excluirRegistro(id: string, cliente?: ClienteSupabase): Promise<void> {
  const supabase = await clientePadrao(cliente);
  const { error } = await supabase.from('records_theone').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

// Registro já espelhado no Supabase para um `origem_id` (idempotência do GSI).
export async function registroPorOrigemId(
  origemId: string,
  cliente?: ClienteSupabase
): Promise<string | null> {
  const id = String(origemId ?? '').trim();
  if (!id) return null;
  const supabase = await clientePadrao(cliente);
  const { data, error } = await supabase
    .from('records_theone')
    .select('id')
    .eq('origem_id', id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? String((data as { id: string }).id) : null;
}

export async function registrarLog(
  pedidoId: string | null,
  tipo: string,
  mensagem: string,
  detalhes?: unknown,
  cliente?: ClienteSupabase
): Promise<void> {
  try {
    const supabase = await clientePadrao(cliente);
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
  tracking: Record<string, unknown>,
  cliente?: ClienteSupabase
): Promise<void> {
  const supabase = await clientePadrao(cliente);
  const { error } = await supabase
    .from('web_tracking_theone')
    .upsert(tracking, { onConflict: 'tracking_id' });
  if (error) throw new Error(error.message);
}
