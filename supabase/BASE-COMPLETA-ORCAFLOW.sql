-- ============================================================
-- ORCAFLOW STUDIO AI - BASE COMPLETA SUPABASE
-- Versao: 3.3.19
--
-- Como usar:
-- 1. Abra Supabase > SQL Editor > New query.
-- 2. Cole todo este arquivo.
-- 3. Clique em Run.
--
-- Este script e idempotente: pode ser executado novamente para atualizar
-- tabelas, funcoes, politicas e permissoes sem apagar empresas, usuarios,
-- orcamentos, CRM, agenda ou historicos.
--
-- Estrutura:
-- - public.user_state: armazenamento online por usuario.
-- - public.app_users: controle de acesso e papeis.
-- - admin: controle total.
-- - gestor: supervisao dos usuarios simples, sem edicao operacional.
-- - usuario: cria e ve somente os proprios dados.
-- ============================================================

create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null check (char_length(key) between 1 and 120),
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_state enable row level security;

drop policy if exists "user_state_select_own" on public.user_state;
create policy "user_state_select_own"
on public.user_state for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "user_state_insert_own" on public.user_state;
create policy "user_state_insert_own"
on public.user_state for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists "user_state_update_own" on public.user_state;
create policy "user_state_update_own"
on public.user_state for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "user_state_delete_own" on public.user_state;
create policy "user_state_delete_own"
on public.user_state for delete
to authenticated
using (auth.uid() = user_id);

create index if not exists user_state_updated_at_idx
  on public.user_state (user_id, updated_at desc);

create table if not exists public.app_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  role text not null default 'usuario' check (role in ('admin', 'gestor', 'usuario')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  blocked_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.app_users add column if not exists display_name text;
alter table public.app_users add column if not exists signature_name text;
alter table public.app_users add column if not exists phone text;
alter table public.app_users add column if not exists cargo text;

do $$
begin
  alter table public.app_users drop constraint if exists app_users_role_check;
exception
  when others then null;
end $$;

alter table public.app_users
  add constraint app_users_role_check
  check (role in ('admin', 'gestor', 'usuario'));

alter table public.app_users enable row level security;

create or replace function public.is_app_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = uid
      and role = 'admin'
      and status = 'approved'
  );
$$;

create or replace function public.is_app_supervisor(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_users
    where user_id = uid
      and role in ('admin', 'gestor')
      and status = 'approved'
  );
$$;

create or replace function public.can_read_user_state(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer = target
    or public.is_app_admin(viewer)
    or exists (
      select 1
      from public.app_users gestor
      join public.app_users dono on dono.user_id = target
      where gestor.user_id = viewer
        and gestor.role = 'gestor'
        and gestor.status = 'approved'
        and dono.role = 'usuario'
        and dono.status = 'approved'
    );
$$;

create or replace function public.can_read_app_user(viewer uuid, target uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    viewer = target
    or public.is_app_admin(viewer)
    or exists (
      select 1
      from public.app_users gestor
      join public.app_users alvo on alvo.user_id = target
      where gestor.user_id = viewer
        and gestor.role = 'gestor'
        and gestor.status = 'approved'
        and alvo.role = 'usuario'
        and alvo.status = 'approved'
    )
    or exists (
      select 1
      from public.app_users usuario
      join public.app_users alvo on alvo.user_id = target
      where usuario.user_id = viewer
        and usuario.role = 'usuario'
        and usuario.status = 'approved'
        and alvo.status = 'approved'
    );
$$;

drop policy if exists "user_state_select_admin_all" on public.user_state;
create policy "user_state_select_admin_all"
on public.user_state for select
to authenticated
using (public.can_read_user_state(auth.uid(), user_id));

drop policy if exists "user_state_insert_admin_all" on public.user_state;
create policy "user_state_insert_admin_all"
on public.user_state for insert
to authenticated
with check (public.is_app_admin(auth.uid()));

drop policy if exists "user_state_update_admin_all" on public.user_state;
create policy "user_state_update_admin_all"
on public.user_state for update
to authenticated
using (public.is_app_admin(auth.uid()))
with check (public.is_app_admin(auth.uid()));

drop policy if exists "user_state_delete_admin_all" on public.user_state;
create policy "user_state_delete_admin_all"
on public.user_state for delete
to authenticated
using (public.is_app_admin(auth.uid()));

create or replace function public.ensure_app_user()
returns public.app_users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  existing public.app_users;
  admins_count integer;
  current_email text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select email into current_email
  from auth.users
  where id = auth.uid();

  select * into existing
  from public.app_users
  where user_id = auth.uid();

  if found then
    update public.app_users
       set email = coalesce(current_email, existing.email),
           name = coalesce(existing.name, current_email),
           display_name = coalesce(existing.display_name, existing.name, current_email),
           signature_name = coalesce(existing.signature_name, existing.display_name, existing.name, current_email),
           updated_at = now()
     where user_id = auth.uid()
     returning * into existing;

    return existing;
  end if;

  select count(*) into admins_count
  from public.app_users
  where role = 'admin'
    and status = 'approved';

  insert into public.app_users (
    user_id,
    email,
    name,
    display_name,
    signature_name,
    role,
    status,
    requested_at,
    approved_at,
    updated_at
  )
  values (
    auth.uid(),
    current_email,
    coalesce(current_email, 'Usuario'),
    coalesce(current_email, 'Usuario'),
    coalesce(current_email, 'Usuario'),
    case when admins_count = 0 then 'admin' else 'usuario' end,
    case when admins_count = 0 then 'approved' else 'pending' end,
    now(),
    case when admins_count = 0 then now() else null end,
    now()
  )
  returning * into existing;

  return existing;
end;
$$;

drop function if exists public.update_my_app_profile(text, text, text, text);
create function public.update_my_app_profile(
  p_cargo text default null,
  p_display_name text default null,
  p_phone text default null,
  p_signature_name text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  updated public.app_users;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update public.app_users
     set display_name = nullif(trim(coalesce(p_display_name, display_name, name, email)), ''),
         signature_name = nullif(trim(coalesce(p_signature_name, signature_name, p_display_name, display_name, name, email)), ''),
         phone = nullif(trim(coalesce(p_phone, phone, '')), ''),
         cargo = nullif(trim(coalesce(p_cargo, cargo, '')), ''),
         name = nullif(trim(coalesce(p_display_name, display_name, name, email)), ''),
         updated_at = now()
   where user_id = auth.uid()
   returning * into updated;

  if updated.user_id is null then
    updated := public.ensure_app_user();
  end if;

  return updated;
end;
$$;

drop function if exists public.admin_update_app_user(uuid, text, text, text, text, text, text);
create function public.admin_update_app_user(
  p_user_id uuid,
  p_role text default null,
  p_status text default null,
  p_display_name text default null,
  p_signature_name text default null,
  p_phone text default null,
  p_cargo text default null
)
returns public.app_users
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_row public.app_users;
  updated public.app_users;
  approved_admins integer;
  next_role text;
  next_status text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin(auth.uid()) then
    raise exception 'admin required';
  end if;

  if p_user_id is null then
    raise exception 'user_id required';
  end if;

  select * into current_row
  from public.app_users
  where user_id = p_user_id;

  if current_row.user_id is null then
    raise exception 'user not found';
  end if;

  next_role := coalesce(nullif(trim(p_role), ''), current_row.role);
  next_status := coalesce(nullif(trim(p_status), ''), current_row.status);

  if next_role not in ('admin', 'gestor', 'usuario') then
    raise exception 'invalid role';
  end if;

  if next_status not in ('pending', 'approved', 'blocked') then
    raise exception 'invalid status';
  end if;

  if current_row.role = 'admin'
     and current_row.status = 'approved'
     and (next_role <> 'admin' or next_status <> 'approved') then
    select count(*) into approved_admins
    from public.app_users
    where role = 'admin'
      and status = 'approved';

    if approved_admins <= 1 then
      raise exception 'cannot remove last approved admin';
    end if;
  end if;

  update public.app_users
     set role = next_role,
         status = next_status,
         display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
         signature_name = coalesce(nullif(trim(p_signature_name), ''), signature_name),
         phone = coalesce(nullif(trim(p_phone), ''), phone),
         cargo = coalesce(nullif(trim(p_cargo), ''), cargo),
         name = coalesce(nullif(trim(p_display_name), ''), name),
         approved_at = case when next_status = 'approved' then coalesce(approved_at, now()) else approved_at end,
         blocked_at = case
           when next_status = 'blocked' then now()
           when next_status = 'approved' then null
           else blocked_at
         end,
         updated_at = now()
   where user_id = p_user_id
   returning * into updated;

  return updated;
end;
$$;

drop policy if exists "app_users_select_own_or_admin" on public.app_users;
create policy "app_users_select_own_or_admin"
on public.app_users for select
to authenticated
using (public.can_read_app_user(auth.uid(), user_id));

drop policy if exists "app_users_update_own_profile" on public.app_users;
create policy "app_users_update_own_profile"
on public.app_users for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists "app_users_update_admin" on public.app_users;
create policy "app_users_update_admin"
on public.app_users for update
to authenticated
using (public.is_app_admin(auth.uid()))
with check (public.is_app_admin(auth.uid()));

drop policy if exists "app_users_delete_admin" on public.app_users;
create policy "app_users_delete_admin"
on public.app_users for delete
to authenticated
using (public.is_app_admin(auth.uid()));

grant select on public.app_users to authenticated;
revoke update on public.app_users from authenticated;
grant update (name, display_name, signature_name, phone, cargo, updated_at) on public.app_users to authenticated;
grant delete on public.app_users to authenticated;
grant execute on function public.ensure_app_user() to authenticated;
grant execute on function public.update_my_app_profile(text, text, text, text) to authenticated;
grant execute on function public.admin_update_app_user(uuid, text, text, text, text, text, text) to authenticated;
grant execute on function public.is_app_admin(uuid) to authenticated;
grant execute on function public.is_app_supervisor(uuid) to authenticated;
grant execute on function public.can_read_user_state(uuid, uuid) to authenticated;
grant execute on function public.can_read_app_user(uuid, uuid) to authenticated;

create index if not exists app_users_status_idx
  on public.app_users (status, requested_at desc);

notify pgrst, 'reload schema';
select pg_notify('pgrst', 'reload schema');
