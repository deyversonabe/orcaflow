# Ativar banco online do OrcaFlow

Use este roteiro para deixar os orcamentos acessiveis de varios computadores, celulares e locais diferentes.

## 1. Supabase

1. Acesse https://supabase.com/dashboard.
2. Crie um projeto ou abra o projeto do OrcaFlow.
3. Va em **SQL Editor > New query**.
4. Cole e execute todo o arquivo `supabase/schema.sql`.
5. Va em **Authentication > Providers > Email** e confirme que Email esta ativo.
6. Va em **Project Settings > API** e copie:
   - Project URL;
   - Publishable key ou anon public key.

## 2. Variaveis no Vercel

No projeto da Vercel, abra **Settings > Environment Variables** e cadastre:

```env
OPENAI_API_KEY=sua-chave-openai
OPENAI_BUDGET_MODEL=gpt-5.5
OPENAI_BUDGET_REASONING_EFFORT=high
OPENAI_BUDGET_VERBOSITY=medium
OPENAI_CHAT_MODEL=gpt-5.5
OPENAI_CHAT_REASONING_EFFORT=high
OPENAI_CHAT_VERBOSITY=medium
OPENAI_TRANSCRIBE_MODEL=whisper-1
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=sua-chave-publica
```

`SUPABASE_URL` nao deve ter `/rest/v1`.

## 3. Deploy

1. Faca novo deploy na Vercel.
2. Abra o OrcaFlow publicado.
3. Crie uma conta pelo login do Supabase.
4. Entre com a mesma conta nos outros dispositivos.

## 4. Restaurar dados

1. Entre no sistema.
2. Abra **Banco**.
3. Clique em **Importar**.
4. Selecione o backup JSON.

A versao nova restaura empresas, orcamentos/CRM, meta, log, usuarios internos e solicitacoes quando esses dados existirem no backup.

## 5. Regras de seguranca

- Nunca cole `service_role` no frontend.
- Nunca envie `.env.local` para GitHub, ZIP publico, Hostinger ou terceiros.
- Se uma chave OpenAI antiga vazou em ZIP, revogue a chave antiga na OpenAI Platform e gere outra.
