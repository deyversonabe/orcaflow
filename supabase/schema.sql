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
