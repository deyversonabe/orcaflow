# OrcaFlow Studio AI

Aplicacao React/Vite para gerar, revisar, salvar e exportar orcamentos comerciais com IA, Supabase Auth, banco online e APIs serverless na Vercel.

## Principais melhorias desta versao

- Banco online via Supabase, separado por usuario autenticado.
- Geracao de multiplos orcamentos no mesmo fluxo.
- Cada empresa pode ter DNA de linguagem, estrutura documental, assinatura visual, fonte, cores e papel timbrado proprios.
- A IA agora retorna identidade documental por empresa: titulo, rotulos e ordem de secoes.
- Quando houver lista de materiais, o sistema gera tabela estruturada com quantidade, unidade, valor original, acrescimo, valor unitario e subtotal.
- O backend normaliza os valores da tabela para fechar com o valor global informado.
- Backup completo com empresas, CRM/orcamentos, meta, logs, usuarios internos e solicitacoes.
- Aba de chat IA comercial para e-mail, cobranca, WhatsApp, resposta a cliente e apoio na montagem de orcamentos.
- Gestao preparada para alto volume, com filtros rapidos, ordenacao, quantidade por pagina e paginacao.
- Automacao comercial na Gestao: score de prioridade, fila de follow-up, historico de contatos por orcamento e botoes para IA gerar cobranca, e-mail e WhatsApp.
- Historico de conversas por orcamento, com canal, direcao da mensagem, tipo de interacao, resumo IA e sugestao IA de resposta ao cliente.
- Cadastro de empresa com leitura IA do PDF do Cartao CNPJ para preencher dados cadastrais, assinatura e rodape; PDFs escaneados usam OCR visual com IA e PDFs com texto mantem fallback local.
- Controle de acesso com aprovacao: o primeiro usuario vira admin, novos cadastros ficam pendentes e so entram apos aprovacao.

## Variaveis de ambiente

Crie `.env.local` somente no seu computador ou cadastre as variaveis diretamente na Vercel.

```env
OPENAI_API_KEY=
OPENAI_BUDGET_MODEL=gpt-5.5
OPENAI_BUDGET_REASONING_EFFORT=high
OPENAI_BUDGET_VERBOSITY=medium
OPENAI_CHAT_MODEL=gpt-5.5
OPENAI_CHAT_REASONING_EFFORT=high
OPENAI_CHAT_VERBOSITY=medium
OPENAI_TRANSCRIBE_MODEL=whisper-1

VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=
```

Importante:

- `SUPABASE_URL` deve ser a Project URL limpa, sem `/rest/v1`.
- Use somente chave publica `anon`/`publishable` no frontend.
- Nunca coloque `service_role` em variaveis `VITE_`.
- Nao publique `.env.local`.
- Para reduzir custo/tempo, troque `OPENAI_BUDGET_REASONING_EFFORT` para `medium`. Para maxima qualidade, mantenha `high`.

## Configuracao do Supabase

1. Crie ou abra o projeto em [supabase.com](https://supabase.com).
2. Em **SQL Editor**, execute todo o conteudo de `supabase/schema.sql`.
3. Em **Authentication > Providers > Email**, deixe o provedor Email ativo.
4. Em **Project Settings > API**, copie a Project URL e a chave publica.
5. Configure as variaveis no `.env.local` e na Vercel.

Os dados ficam na tabela `public.user_state`, com Row Level Security. Cada conta acessa apenas seus proprios registros.

## Desenvolvimento local

Requer Node.js 20.19 ou superior.

```bash
npm install
npm run dev
```

O comando `npm run dev` usa a Vercel CLI para subir frontend e APIs locais. Para testar apenas a interface sem APIs serverless:

```bash
npm run dev:ui
```

## Deploy na Vercel

1. Importe o repositorio/projeto na Vercel.
2. Cadastre todas as variaveis de ambiente listadas acima.
3. Rode o deploy.
4. Abra o sistema, crie a conta pelo Supabase Auth e faca login.
5. Use **Banco > Importar** para restaurar backup antigo, se existir.

## Backup

O backup atual exporta:

- empresas;
- orcamentos/CRM;
- historico do chat IA;
- metadados;
- log;
- usuarios internos;
- solicitacoes de senha.

Backups antigos com apenas `empresas` continuam sendo aceitos, mas nao conseguem restaurar historico que nao existia no arquivo original.

## Seguranca

- A chave OpenAI fica somente no backend/serverless.
- As APIs exigem sessao Supabase valida.
- O backend aplica controle de origem, limite de requisicoes e limite de upload.
- O fechamento financeiro da tabela de materiais e revisado no servidor antes de voltar para a tela.
