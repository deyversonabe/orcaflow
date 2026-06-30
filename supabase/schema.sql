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
  role text not null default 'usuario' check (role in ('admin', 'usuario')),
  status text not null default 'pending' check (status in ('pending', 'approved', 'blocked')),
  requested_at timestamptz not null default now(),
  approved_at timestamptz,
  blocked_at timestamptz,
  updated_at timestamptz not null default now()
);

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

drop policy if exists "app_users_select_own_or_admin" on public.app_users;
create policy "app_users_select_own_or_admin"
on public.app_users for select
to authenticated
using (auth.uid() = user_id or public.is_app_admin(auth.uid()));

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
grant update on public.app_users to authenticated;
grant delete on public.app_users to authenticated;
grant execute on function public.ensure_app_user() to authenticated;
grant execute on function public.is_app_admin(uuid) to authenticated;

create index if not exists app_users_status_idx
  on public.app_users (status, requested_at desc);
