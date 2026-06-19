# OrçaFlow Studio AI

Aplicação React para criar, acompanhar e exportar orçamentos comerciais com OpenAI e armazenamento online no Supabase.

## O que fica online

- Empresas e identidades visuais
- Orçamentos e CRM
- Metadados e histórico
- Login e recuperação de senha

Os dados são separados por conta através de Row Level Security. A mesma conta pode ser usada no computador, celular ou tablet.

## Configuração do Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. Abra **SQL Editor** e execute [supabase/schema.sql](supabase/schema.sql).
3. Em **Authentication → Providers → Email**, mantenha o login por e-mail habilitado.
4. Em **Project Settings → API**, copie a Project URL e a chave pública `anon`/`publishable`.
5. Configure `.env.local`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=
```

As funções serverless reutilizam essas variáveis para validar o token do usuário.

## OpenAI

```env
OPENAI_API_KEY=
OPENAI_BUDGET_MODEL=gpt-4.1-mini
OPENAI_TRANSCRIBE_MODEL=whisper-1
```

A chave OpenAI é usada somente pelas funções da pasta `api/`.

## Desenvolvimento

Requer Node.js 20.19 ou superior.

```bash
npm install
npm run dev
```

O comando usa a Vercel CLI para disponibilizar o frontend e as APIs locais.

## Migração automática

Ao entrar pela primeira vez, os dados antigos do `localStorage` são enviados automaticamente para a conta autenticada. Depois disso, a nuvem passa a ser a fonte principal e o navegador mantém apenas um cache separado por usuário.

Faça um backup JSON antes da primeira migração como precaução.

## Deploy na Vercel

Cadastre estas variáveis em **Project Settings → Environment Variables**:

- `OPENAI_API_KEY`
- `OPENAI_BUDGET_MODEL`
- `OPENAI_TRANSCRIBE_MODEL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois execute o deploy normalmente.

## Segurança

- Login gerenciado pelo Supabase Auth.
- Tokens verificados novamente nas APIs de IA.
- Dados protegidos com RLS por `auth.uid()`.
- Chave OpenAI restrita ao servidor.
- Limite de requisições e tamanho de upload.
- Senhas nunca são armazenadas pelo aplicativo.
