# Relatorio semanal assistido da Nara - OrcaFlow 3.1.3

## O que foi criado

- Botao manual na aba Gestao: Enviar relatorio semanal Nara.
- Botao manual na aba Clientes/CRM: Enviar relatorio semanal Nara.
- Numero padrao do WhatsApp: +5517992529930.
- Modo assistido: a Nara prepara tudo, mas nunca envia WhatsApp sozinha.
- Relatorio pendente na tela inicial quando o agendamento semanal rodar.
- Relatorio com 2 blocos:
  - Bloco 1: Gestao / orcamentos em aberto / orcamentos gerados / interacoes da semana.
  - Bloco 2: CRM / contatos registrados / bons resultados / clientes que precisam de atencao.
- Endpoint automatico: /api/weekly-report.
- Agendamento Vercel Cron: toda sexta-feira, 20:00 UTC, equivalente a 17:00 em Sao Paulo.

## Como funciona o modo assistido

A Nara gera o relatorio e salva como pendente na nuvem.

Quando voce abrir o OrcaFlow, aparece uma caixa "Modo assistido" com botoes:

- Abrir WhatsApp;
- Copiar;
- Ja resolvi.

O sistema apenas abre o WhatsApp com a mensagem pronta. O envio final depende do seu clique.

Nao existe envio automatico pela Meta neste modo, entao nao ha cobranca de mensagem pela Cloud API.

## Variaveis de ambiente na Vercel

Adicione no projeto da Vercel:

```text
CRON_SECRET=
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
ORCAFLOW_REPORT_USER_ID=
WHATSAPP_REPORT_TO=5517992529930
```

Se deixar ORCAFLOW_REPORT_USER_ID vazio, o sistema tenta usar o primeiro admin aprovado no banco.

## Teste manual do endpoint

Depois do deploy, abra:

```text
https://SEU-DOMINIO/api/weekly-report
```

Se CRON_SECRET estiver configurado, o teste direto pelo navegador sera bloqueado. Nesse caso teste por ferramenta de API enviando:

```text
Authorization: Bearer SEU_CRON_SECRET
```

## Resultado esperado

Toda sexta-feira as 17:00, a Vercel chama o endpoint. O endpoint le Supabase, gera o relatorio da Nara e salva como pendente para o admin.

Quando voce abrir o OrcaFlow, o relatorio aparece pronto para abrir no WhatsApp:

```text
+5517992529930
```
