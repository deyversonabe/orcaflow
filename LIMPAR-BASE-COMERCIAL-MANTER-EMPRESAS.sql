-- OrcaFlow Studio AI
-- Limpa a base comercial para comecar do zero, mantendo empresas e acessos.
--
-- O que este script limpa:
-- - orcamentos gerados/importados;
-- - lixeira de orcamentos;
-- - clientes do CRM;
-- - agenda de contatos;
-- - historico da Nara/chat;
-- - inbox/monitoramento WhatsApp;
-- - relatorios pendentes;
-- - auditoria comercial;
-- - contador de orcamentos.
--
-- O que este script NAO limpa:
-- - orcaflow_empresas;
-- - usuarios/acessos;
-- - solicitacoes de senha;
-- - configuracao da Nara;
-- - numero de WhatsApp para relatorios;
-- - log principal.
--
-- Rode no Supabase SQL Editor e confirme a execucao.

begin;

create table if not exists public.user_state_reset_backup (
  created_at timestamptz not null default now(),
  reason text not null,
  user_id uuid,
  key text,
  value jsonb,
  updated_at timestamptz
);

insert into public.user_state_reset_backup (reason, user_id, key, value, updated_at)
select
  'reset_comercial_mantendo_empresas_2026_07_15',
  user_id,
  key,
  value,
  updated_at
from public.user_state
where key in (
  'orcaflow_crm_orcamentos',
  'orcaflow_crm_lixeira',
  'orcaflow_auditoria_acoes',
  'orcaflow_meta',
  'orcaflow_chat_ia',
  'orcaflow_clientes_crm',
  'orcaflow_agenda_clientes',
  'orcaflow_weekly_report_pending',
  'orcaflow_whatsapp_inbox',
  'orcaflow_nara_daily_radar_pending',
  'orcaflow_auto_backup_log'
);

with usuarios as (
  select distinct user_id
  from public.user_state
  where user_id is not null
),
limpeza(key, value) as (
  values
    ('orcaflow_crm_orcamentos', '[]'::jsonb),
    ('orcaflow_crm_lixeira', '[]'::jsonb),
    ('orcaflow_auditoria_acoes', '[]'::jsonb),
    ('orcaflow_meta', '{"totalOrcamentos":0}'::jsonb),
    ('orcaflow_chat_ia', '[]'::jsonb),
    ('orcaflow_clientes_crm', '[]'::jsonb),
    ('orcaflow_agenda_clientes', '[]'::jsonb),
    ('orcaflow_weekly_report_pending', '{}'::jsonb),
    ('orcaflow_whatsapp_inbox', '[]'::jsonb),
    ('orcaflow_nara_daily_radar_pending', '{}'::jsonb),
    ('orcaflow_auto_backup_log', '[]'::jsonb)
),
payload as (
  select usuarios.user_id, limpeza.key, limpeza.value
  from usuarios
  cross join limpeza
)
insert into public.user_state (user_id, key, value, updated_at)
select user_id, key, value, now()
from payload
on conflict (user_id, key)
do update set
  value = excluded.value,
  updated_at = excluded.updated_at;

commit;

