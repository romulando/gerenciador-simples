-- ============================================================
-- GERENCIADOR SIMPLES — THEONE
-- Rode este arquivo no SQL Editor do Supabase (mesmo projeto do site).
--
-- IMPORTANTE: este SQL é somente aditivo/idempotente.
-- Não faz INSERT/UPDATE/DELETE/TRUNCATE em tabelas existentes.
-- As tabelas orders_theone, records_theone, logs_theone e
-- web_tracking_theone são novas.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- PEDIDOS DO THEONE (dados contratuais, sem credenciais/nome)
-- ------------------------------------------------------------
create table if not exists public.orders_theone (
  id text primary key,
  tracking_id text not null unique,
  tipo_servico text not null,
  adicional text not null default 'nenhum',
  estado text not null default 'em_andamento',
  mmr_inicial integer,
  mmr_atual integer,
  mmr_desejado integer,
  medalha text,
  partidas integer,
  partidas_jogadas integer not null default 0,
  cupom text not null default '',
  valor numeric(12,2) not null default 0,
  saldo_manual jsonb,
  tabela_precos jsonb,
  observacoes text not null default '',
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  sincronizado_em timestamptz not null default now(),
  -- valores calculados pelo site (privados; não vão para o tracking público)
  saldo_restante numeric(12,2),
  consumido numeric(12,2),
  progresso_pct numeric(5,2),
  mmr_final_calculado integer,
  recalculado_em timestamptz
);

create index if not exists idx_orders_theone_estado on public.orders_theone(estado);
create index if not exists idx_orders_theone_tracking on public.orders_theone(tracking_id);

-- ------------------------------------------------------------
-- REGISTROS DO ACOMPANHAMENTO
-- ------------------------------------------------------------
create table if not exists public.records_theone (
  id uuid primary key default gen_random_uuid(),
  pedido_id text not null references public.orders_theone(id) on delete cascade,
  origem text not null default 'theone',
  origem_id text unique,
  tipo text not null check (tipo in ('mmr', 'partidas')),
  data text not null,
  mmr_inicial integer,
  mmr_final integer,
  quantidade integer,
  medalha text not null default '',
  observacoes text not null default '',
  hero text not null default '',
  resultado text not null default '',
  kills integer,
  deaths integer,
  assists integer,
  motivo_ajuste text,
  ordem numeric,
  created_at timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_records_theone_pedido
  on public.records_theone(pedido_id, tipo, ordem);
create index if not exists idx_records_theone_data
  on public.records_theone(pedido_id, data);

-- ------------------------------------------------------------
-- LOG DO PEDIDO (append-only)
-- ------------------------------------------------------------
create table if not exists public.logs_theone (
  id bigint generated always as identity primary key,
  pedido_id text references public.orders_theone(id) on delete cascade,
  tipo text not null,
  mensagem text not null,
  detalhes jsonb,
  origem text not null default 'theone',
  criado_em timestamptz not null default now()
);

create index if not exists idx_logs_theone_pedido
  on public.logs_theone(pedido_id, criado_em desc);

-- ------------------------------------------------------------
-- TRACKING PÚBLICO DO THEONE
-- Mesmas colunas de web_tracking; sem valor, saldo, nome ou credenciais.
-- ------------------------------------------------------------
create table if not exists public.web_tracking_theone (
  tracking_id text primary key,
  tipo_servico text not null default '',
  servico_label text not null default '',
  estado text not null default 'em_andamento',
  mmr_inicial integer,
  mmr_atual integer,
  mmr_desejado integer,
  mmr_inicial_ajustado integer,
  mmr_final_ajustado integer,
  partidas integer,
  partidas_jogadas integer not null default 0,
  progresso_pct numeric(5,2),
  vitorias integer not null default 0,
  derrotas integer not null default 0,
  historico jsonb not null default '[]'::jsonb,
  atualizado_em timestamptz not null default now()
);

-- ------------------------------------------------------------
-- AUTORIZAÇÃO: SOMENTE O USUÁRIO THEONE
-- ------------------------------------------------------------
create or replace function public.is_theone()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(auth.jwt() ->> 'email', '') = 'theone@boostmmr.com.br'
$$;

alter table public.orders_theone enable row level security;
alter table public.records_theone enable row level security;
alter table public.logs_theone enable row level security;
alter table public.web_tracking_theone enable row level security;

revoke all on table public.orders_theone from anon, authenticated;
revoke all on table public.records_theone from anon, authenticated;
revoke all on table public.logs_theone from anon, authenticated;
revoke all on table public.web_tracking_theone from anon, authenticated;

grant select, update on table public.orders_theone to authenticated;
grant select, insert, update, delete on table public.records_theone to authenticated;
grant select, insert on table public.logs_theone to authenticated;
grant select, insert, update on table public.web_tracking_theone to authenticated;

-- orders_theone
drop policy if exists "theone_select_orders" on public.orders_theone;
create policy "theone_select_orders"
  on public.orders_theone for select
  to authenticated
  using (public.is_theone());

drop policy if exists "theone_update_orders" on public.orders_theone;
create policy "theone_update_orders"
  on public.orders_theone for update
  to authenticated
  using (public.is_theone())
  with check (public.is_theone());

-- records_theone
drop policy if exists "theone_select_records" on public.records_theone;
create policy "theone_select_records"
  on public.records_theone for select
  to authenticated
  using (public.is_theone());

drop policy if exists "theone_insert_records" on public.records_theone;
create policy "theone_insert_records"
  on public.records_theone for insert
  to authenticated
  with check (public.is_theone());

drop policy if exists "theone_update_records" on public.records_theone;
create policy "theone_update_records"
  on public.records_theone for update
  to authenticated
  using (public.is_theone())
  with check (public.is_theone());

drop policy if exists "theone_delete_records" on public.records_theone;
create policy "theone_delete_records"
  on public.records_theone for delete
  to authenticated
  using (public.is_theone());

-- logs_theone (append-only)
drop policy if exists "theone_select_logs" on public.logs_theone;
create policy "theone_select_logs"
  on public.logs_theone for select
  to authenticated
  using (public.is_theone());

drop policy if exists "theone_insert_logs" on public.logs_theone;
create policy "theone_insert_logs"
  on public.logs_theone for insert
  to authenticated
  with check (public.is_theone());

-- web_tracking_theone (sem delete para o Theone)
drop policy if exists "theone_select_tracking" on public.web_tracking_theone;
create policy "theone_select_tracking"
  on public.web_tracking_theone for select
  to authenticated
  using (public.is_theone());

drop policy if exists "theone_insert_tracking" on public.web_tracking_theone;
create policy "theone_insert_tracking"
  on public.web_tracking_theone for insert
  to authenticated
  with check (public.is_theone());

drop policy if exists "theone_update_tracking" on public.web_tracking_theone;
create policy "theone_update_tracking"
  on public.web_tracking_theone for update
  to authenticated
  using (public.is_theone())
  with check (public.is_theone());

-- ------------------------------------------------------------
-- RPC: LEITURA PÚBLICA DO TRACKING
-- ------------------------------------------------------------
create or replace function public.get_tracking_theone(p_tracking_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select to_jsonb(t)
  from public.web_tracking_theone t
  where p_tracking_id ~ '^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$'
    and t.tracking_id = upper(trim(p_tracking_id))
  limit 1;
$$;

revoke all on function public.get_tracking_theone(text) from public, anon, authenticated;
grant execute on function public.get_tracking_theone(text) to anon, authenticated;

-- ------------------------------------------------------------
-- RPC: DADOS SEGUROS DO PEDIDO PARA O OVERLAY
-- Usada quando o web_tracking_theone ainda não foi gerado.
-- NÃO devolve valor, saldo, observações, credenciais ou snapshot de preços.
-- ------------------------------------------------------------
create or replace function public.get_order_public_theone(p_tracking_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'tracking_id', o.tracking_id,
    'tipo_servico', o.tipo_servico,
    'estado', o.estado,
    'mmr_inicial', o.mmr_inicial,
    'mmr_atual', o.mmr_atual,
    'mmr_desejado', o.mmr_desejado,
    'mmr_final_calculado', o.mmr_final_calculado,
    'partidas', o.partidas,
    'partidas_jogadas', o.partidas_jogadas,
    'medalha', o.medalha,
    'progresso_pct', o.progresso_pct
  )
  from public.orders_theone o
  where p_tracking_id ~ '^[A-Za-z0-9]{4}-[A-Za-z0-9]{4}-[A-Za-z0-9]{4}$'
    and o.tracking_id = upper(trim(p_tracking_id))
  limit 1;
$$;

revoke all on function public.get_order_public_theone(text) from public, anon, authenticated;
grant execute on function public.get_order_public_theone(text) to anon, authenticated;

-- Recarrega o cache de schema do PostgREST.
notify pgrst, 'reload schema';
