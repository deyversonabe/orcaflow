-- OrcaFlow Studio AI
-- Correcao do erro:
-- Could not find the function public.update_my_app_profile(...) in the schema cache
--
-- Rode este arquivo no Supabase SQL Editor do projeto usado pelo Vercel.

alter table public.app_users add column if not exists display_name text;
alter table public.app_users add column if not exists signature_name text;
alter table public.app_users add column if not exists phone text;
alter table public.app_users add column if not exists cargo text;

create or replace function public.update_my_app_profile(
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

grant execute on function public.update_my_app_profile(text, text, text, text) to authenticated;

-- Forca o PostgREST/Supabase a recarregar o cache do schema.
notify pgrst, 'reload schema';

