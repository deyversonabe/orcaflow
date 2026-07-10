# OrçaFlow 3.1.4 - WhatsApp observador com Nara

Esta versão cria uma aba **WhatsApp** para acompanhar mensagens reais recebidas via webhook oficial da Meta e usar a Nara para sugerir respostas e próximos passos.

## O que foi implementado

- Nova aba **WhatsApp** no menu principal.
- Webhook em `/api/whatsapp-webhook` para receber mensagens do WhatsApp Business Platform.
- Registro automático e auditável das mensagens recebidas.
- Criação/atualização automática de cliente no CRM quando chegar uma mensagem nova.
- Nara gera resposta assistida com base no histórico real recebido, CRM e orçamentos relacionados.
- Botões de **Copiar** e **Abrir WhatsApp externo** com a mensagem pronta.
- Nenhum envio automático pela plataforma.

## Variáveis no Vercel

Confira em **Vercel > Project > Settings > Environment Variables**:

```text
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
WHATSAPP_VERIFY_TOKEN=um-token-seguro-criado-por-voce
ORCAFLOW_REPORT_USER_ID=
WHATSAPP_REPORT_TO=5517992529930
```

`ORCAFLOW_REPORT_USER_ID` pode ficar vazio se já existir um usuário admin aprovado no OrçaFlow.
`SUPABASE_SERVICE_ROLE_KEY` deve receber a chave service role do Supabase, sem publicar essa chave no GitHub.

## Configurar na Meta

No painel da Meta/WhatsApp Business Platform:

1. Abra o app usado para o WhatsApp.
2. Vá em **WhatsApp > Configuration** ou **Webhooks**.
3. Em **Callback URL**, informe:

```text
https://orcaflow.ia.br/api/whatsapp-webhook
```

4. Em **Verify token**, informe exatamente o mesmo valor de `WHATSAPP_VERIFY_TOKEN`.
5. Assine o evento **messages**.
6. Salve.

Depois envie uma mensagem para o número conectado ao WhatsApp Business Platform e abra a aba **WhatsApp** no OrçaFlow.

## Como usar no dia a dia

1. Cliente manda mensagem no WhatsApp conectado à Meta.
2. A mensagem aparece na aba **WhatsApp CRM**.
3. Clique no contato.
4. Clique em **Sugerir resposta**.
5. Revise a resposta da Nara.
6. Use **Copiar** ou **Abrir WhatsApp externo**.
7. O envio final continua manual, feito por você no WhatsApp.

## Limites importantes

- A plataforma não envia mensagem automaticamente para evitar disparos e cobrança de envio.
- A plataforma recebe automaticamente apenas mensagens que chegam no número conectado à WhatsApp Business Platform.
- Mensagens enviadas pelo aplicativo do celular ou WhatsApp Web externo não voltam automaticamente para o OrçaFlow como saída auditada.
- Arquivos e imagens recebidos pelo webhook ficam registrados como mídia recebida; para baixar e armazenar o arquivo dentro do OrçaFlow será preciso adicionar token de mídia da Meta em uma próxima etapa.

## Quando vale evoluir para API completa

Use API completa somente se você quiser:

- Caixa de entrada 100% dentro do OrçaFlow.
- Envio direto pela plataforma.
- Histórico auditável de entrada e saída.
- Controle de atendentes.
- Relatórios completos de conversas.

O modo atual é o mais econômico: observa mensagens reais, orienta estratégia e mantém o envio humano.
