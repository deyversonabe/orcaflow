# OrcaFlow Studio AI - Relatorio completo de estrutura e atualizacoes

Versao atual do projeto: 3.3.0  
Data do registro: 14/07/2026  
Projeto: OrcaFlow Studio AI  
Dominio em uso: orcaflow.ia.br  
Hospedagem prevista: Vercel  
Banco de dados: Supabase  
IA: OpenAI API

## 1. Resumo do sistema

O OrcaFlow Studio AI e uma plataforma para geracao, gestao e acompanhamento comercial de orcamentos com apoio de IA.

O sistema permite:

- cadastrar varias empresas emissoras de orcamento;
- criar perfil documental e visual individual para cada empresa;
- gerar orcamentos com IA respeitando o DNA de linguagem de cada empresa;
- exportar orcamentos em PDF;
- salvar e acompanhar orcamentos em uma area de gestao;
- apagar orcamentos errados individualmente ou em bloco;
- restaurar orcamentos apagados pela lixeira;
- auditar acoes importantes de gestao comercial;
- visualizar pipeline comercial por etapa, quantidade e valor;
- importar orcamentos antigos em massa;
- criar e acompanhar clientes em CRM;
- manter cliente e orcamento como cadastros separados, com vinculo manual entre eles;
- sugerir clientes compativeis para orcamentos sem transformar orcamento em cliente automaticamente;
- segmentar clientes com etiquetas inteligentes e filtros comerciais;
- preparar campanhas assistidas sem envio automatico pago;
- usar playbooks manuais de follow-up, cobranca, reativacao e pedido de dados;
- operar o CRM com lateral mais limpa, cards compactos e acoes em lote separadas;
- registrar historico real de contatos por cliente e por orcamento;
- usar a assistente Nara para mensagens, follow-up, analise comercial e relatorios;
- controlar usuarios, acessos e isolamento de dados por usuario;
- permitir que o administrador copie ou mova dados entre usuarios.

## 2. Estrutura atual de pastas

```text
orcaflow-main/
  api/
    _security.js
    chat-assistant.js
    client-crm-assistant.js
    generate-budget.js
    import-budget-file.js
    read-company-card.js
    read-service-attachment.js
    transcribe.js
    weekly-report.js
    whatsapp-webhook.js

  public/
    logo-orcaflow.png

  src/
    App.jsx
    AgendaClientesPanel.jsx
    ClientesCRMPanel.jsx
    WhatsAppInboxPanel.jsx
    main.jsx
    naraAutomation.js
    store.js
    supabase.js
    weeklyReport.js

  supabase/
    schema.sql

  .env.example
  .gitignore
  ATIVAR-BANCO-ONLINE.md
  README.md
  index.html
  package.json
  package-lock.json
  vercel.json
  vite.config.js
```

Arquivos que nao devem ser enviados ao GitHub/Vercel:

- `.env.local`
- `node_modules/`
- `dist/`
- arquivos de log locais
- zips antigos dentro de `outputs/`

## 3. Variaveis de ambiente necessarias

No Vercel, devem existir:

```text
OPENAI_API_KEY=chave da OpenAI
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=chave publica/publishable do Supabase
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_ANON_KEY=chave publica/publishable do Supabase
```

Quando usar webhook oficial do WhatsApp/Meta:

```text
SUPABASE_SERVICE_ROLE_KEY=service role key do Supabase
WHATSAPP_VERIFY_TOKEN=token criado por voce para verificar webhook
```

Observacao importante:

- `SUPABASE_URL` nao deve terminar com `/rest/v1`.
- A chave secreta da OpenAI nunca deve ficar no frontend.
- `.env.local` nao deve ser enviado ao GitHub.

## 4. Banco de dados Supabase

Arquivo principal:

```text
supabase/schema.sql
```

Tabelas principais:

### public.user_state

Guarda dados operacionais do sistema por usuario.

Campos:

- `user_id`
- `key`
- `value`
- `updated_at`

Cada usuario salva seus proprios blocos de dados, como:

- empresas;
- orcamentos/gestao;
- clientes CRM;
- agenda;
- chat da Nara;
- caixa de WhatsApp;
- relatorios e configuracoes.

### public.app_users

Controla acesso dos usuarios ao sistema.

Campos principais:

- `user_id`
- `email`
- `name`
- `display_name`
- `signature_name`
- `phone`
- `cargo`
- `role`
- `status`
- `requested_at`
- `approved_at`
- `blocked_at`
- `updated_at`

Funcoes criadas/atualizadas:

- `public.is_app_admin(uid uuid)`
- `public.ensure_app_user()`
- `public.update_my_app_profile(...)`

Politicas RLS:

- usuario comum acessa apenas seus proprios dados;
- administrador aprovado consegue ler, copiar, mover e gerenciar dados entre usuarios;
- administrador consegue aprovar, bloquear e alterar perfis.

Acao obrigatoria apos subir esta versao:

1. Abrir Supabase.
2. Ir em SQL Editor.
3. Colar o conteudo atualizado de `supabase/schema.sql`.
4. Clicar em Run.

Sem isso, as novas funcoes de perfil comercial e compartilhamento entre usuarios podem nao funcionar.

## 5. Controle de usuarios e acessos

Foi melhorada a aba de usuarios/acessos.

Agora existe:

### Meu perfil comercial

Cada usuario pode configurar:

- como quer ser chamado pela Nara;
- nome/assinatura para mensagens ao cliente;
- telefone/WhatsApp;
- cargo ou funcao.

Essas informacoes sao usadas pela Nara para:

- falar com o usuario pelo nome correto;
- gerar mensagens com o responsavel correto;
- evitar textos genericos;
- melhorar a personalizacao da comunicacao comercial.

### Isolamento de dados por usuario

Usuario comum:

- ve apenas seus dados;
- ve apenas empresas/orcamentos/clientes criados por ele ou compartilhados com ele;
- nao acessa dados de outros usuarios.

Administrador:

- ve todos os usuarios;
- aprova ou bloqueia cadastros;
- muda perfil entre `admin` e `usuario`;
- ve contagem de dados por usuario;
- copia ou move dados entre usuarios.

### Compartilhamento e transferencia de dados

O administrador pode:

- copiar empresas cadastradas para outro usuario;
- copiar orcamentos;
- copiar clientes CRM;
- copiar agenda;
- copiar chat/historico da Nara;
- copiar caixa WhatsApp;
- mover dados de uma conta para outra.

Essa funcao serve para:

- compartilhar empresas prontas;
- montar uma base inicial para novos usuarios;
- transferir carteira de cliente;
- organizar dados criados em contas erradas;
- centralizar cadastros no usuario administrador.

## 6. IA/Nara

A assistente da plataforma se chama Nara.

Ela atua em:

- chat comercial;
- geracao de mensagens de WhatsApp;
- corpo de e-mail;
- resposta ao cliente;
- cobranca/follow-up;
- analise de cliente no CRM;
- analise de agenda;
- relatorios semanais;
- radar diario;
- auditoria de historicos;
- orientacao antes de contato comercial.

Melhorias implementadas:

- Nara usa o nome escolhido no perfil do usuario;
- Nara recebe contexto do usuario responsavel;
- Nara considera assinatura comercial quando gera mensagem;
- Nara evita prometer prazo, desconto, garantia, validade ou condicoes nao informadas;
- Nara deve pedir dados faltantes quando nao tiver informacao suficiente;
- Nara deve trabalhar com historico real, sem criar conversas falsas;
- Nara trata orcamentos separados dentro do mesmo cliente.

Arquivos relacionados:

```text
api/chat-assistant.js
api/client-crm-assistant.js
src/naraAutomation.js
src/weeklyReport.js
src/ClientesCRMPanel.jsx
src/AgendaClientesPanel.jsx
src/WhatsAppInboxPanel.jsx
```

## 7. Geracao de orcamentos

Arquivo principal de IA:

```text
api/generate-budget.js
```

Regras principais do sistema:

- cada empresa deve ter DNA de linguagem proprio;
- cada empresa deve ter estrutura documental propria;
- cada empresa deve ter identidade visual propria;
- o PDF deve respeitar papel timbrado cadastrado;
- nao incluir prazo, data, validade, garantia ou condicoes de pagamento/execucao se o usuario nao solicitar;
- nao criar materiais, valores ou escopos nao informados;
- quando houver lista de itens, gerar tabela somente com os valores finais;
- nao exibir valor original nem percentual de acrescimo no PDF final;
- se houver valor global, a tabela deve fechar dentro do valor global informado.

Empresas/DNAs previstos:

- Engenharia Lider Eletrica;
- Power Service;
- A Construir;
- AD Solucoes;
- Orlovic;
- H&H Decoracoes;
- Pupo e Agnelo / Eletro Lider.

## 8. Cadastro de empresas

O cadastro de empresa possui:

- dados cadastrais;
- leitura de Cartao CNPJ em PDF;
- DNA de linguagem;
- estrutura do orcamento;
- padrao documental e visual;
- assinatura visual/DNA do PDF;
- papel timbrado;
- logo;
- cores do documento;
- altura de cabecalho e rodape;
- fonte e tamanho de fonte.

O sistema tenta respeitar:

- area de cabecalho do timbrado;
- area de rodape;
- proporcao do papel;
- identidade visual individual de cada empresa.

Arquivo principal:

```text
src/App.jsx
api/read-company-card.js
```

## 9. CRM de clientes

Arquivo principal:

```text
src/ClientesCRMPanel.jsx
```

Funcoes do CRM:

- criar perfil de cliente;
- editar dados pessoais;
- registrar contatos;
- anexar prints, fotos, PDFs e arquivos;
- vincular orcamentos criados no sistema;
- anexar orcamentos externos;
- manter historico separado por orcamento dentro do cliente;
- criar clientes a partir de orcamentos;
- importar contatos;
- usar Nara para proximo passo comercial.

Regras importantes:

- cada orcamento dentro do cliente tem historico proprio;
- o historico de um orcamento nao deve contaminar outro;
- nao gerar informacao falsa ou generica;
- contato real deve ser registrado pelo usuario ou importado de fonte real;
- anexos sem leitura clara devem ser tratados como referencia, nao como verdade inventada.

## 10. Agenda telefonica de contatos

Arquivo principal:

```text
src/AgendaClientesPanel.jsx
```

Funcoes:

- cadastrar e editar contatos telefonicos;
- vincular contato ao cliente do CRM;
- criar cliente automaticamente quando o contato ainda nao existe no CRM;
- registrar nome, empresa, cargo, decisor, WhatsApp, telefone, e-mail, endereco, cidade/UF, segmento e observacoes;
- buscar contatos por nome, empresa, telefone, e-mail ou observacoes;
- filtrar contatos com WhatsApp, com e-mail, vinculados ao CRM ou sem telefone;
- importar contatos existentes do CRM;
- importar arquivos `.vcf` e `.csv`;
- abrir WhatsApp externo com mensagem pronta;
- ligar pelo telefone do dispositivo quando disponivel;
- abrir e-mail;
- copiar dados do contato;
- consultar a Nara para abordagem comercial personalizada;
- exibir orcamentos relacionados e historico real do cliente sem criar informacoes falsas.

## 11. WhatsApp e modo assistido

Arquivo principal:

```text
src/WhatsAppInboxPanel.jsx
api/whatsapp-webhook.js
```

Modo atual recomendado:

- recebimento automatico pode ser feito via webhook oficial Meta Cloud API;
- resposta continua assistida;
- Nara sugere a mensagem;
- usuario revisa;
- usuario copia ou abre WhatsApp externo com texto pronto.

Isso evita:

- mensagens automaticas indevidas;
- risco de conversa sem revisao humana;
- cobranca por envio desnecessario se optar por envio manual.

Observacao:

- receber mensagens automaticamente dentro do OrcaFlow exige integracao oficial do WhatsApp/Meta.
- abrir WhatsApp externo com mensagem pronta nao e envio automatico.

## 12. Relatorios Nara

Relatorios existentes:

- relatorio de orcamentos pendentes;
- relatorio semanal;
- radar diario;
- auditoria de registros comerciais;
- relatorio de CRM/clientes.

Destino padrao mencionado:

```text
+5517992529930
```

Modo atual:

- a Nara gera o texto;
- o sistema abre WhatsApp com mensagem pronta;
- envio e manual.

## 13. Melhorias de performance feitas

Arquivo principal:

```text
src/store.js
src/App.jsx
```

Melhorias:

- cache de sessao do Supabase;
- leitura em lote com `store.getMany`;
- salvamento em lote com `store.setMany`;
- admin consegue ler dados de varios usuarios com `getAllUserRows`;
- leitura de PDF limitada por paginas e caracteres;
- OCR/imagem so e acionado quando o PDF nao tem texto suficiente;
- imagens para IA foram reduzidas para evitar payload pesado;
- `jsPDF` passou a carregar somente quando o usuario baixa/exporta PDF.

Resultado validado:

- build de producao passou;
- preview local respondeu HTTP 200;
- pacote inicial ficou menor que antes da otimizacao.

## 14. Arquivos gerados hoje

Zips principais:

```text
outputs/orcaflow-studio-ai-3.2.3-performance.zip
outputs/orcaflow-studio-ai-3.2.4-usuarios-compartilhamento.zip
outputs/orcaflow-studio-ai-3.2.5-agenda-telefonica.zip
outputs/orcaflow-studio-ai-3.2.6-exclusao-orcamentos.zip
outputs/orcaflow-studio-ai-3.2.7-upgrades-gestao.zip
outputs/orcaflow-studio-ai-3.2.8-manychat-assistido-gratis.zip
outputs/orcaflow-studio-ai-3.2.9-crm-limpo-acoes-em-lote.zip
outputs/orcaflow-studio-ai-3.3.0-vinculo-manual-clientes-orcamentos.zip
```

Versao recomendada para subir:

```text
outputs/orcaflow-studio-ai-3.3.0-vinculo-manual-clientes-orcamentos.zip
```

## 15. Validacoes realizadas

Comandos executados:

```text
npm run build
npm run preview -- --host 127.0.0.1 --port 4177
```

Resultado:

```text
Build: aprovado
Preview local: HTTP 200
Zip: conferido
Segredos no zip: nao encontrados
Arquivos sensiveis no zip: nao encontrados
```

## 16. Passo a passo para subir esta versao

1. Usar o zip:

```text
outputs/orcaflow-studio-ai-3.3.0-vinculo-manual-clientes-orcamentos.zip
```

2. Enviar os arquivos para o GitHub.

3. Conferir no Vercel as variaveis de ambiente.

4. Rodar no Supabase o `supabase/schema.sql` atualizado.

5. Fazer novo deploy no Vercel.

6. Testar:

- login;
- aprovacao de usuario;
- editar Meu Perfil;
- usuario comum ver apenas seus dados;
- admin ver contagem de dados por usuario;
- admin copiar empresa cadastrada para outro usuario;
- gerar orcamento;
- salvar no CRM;
- conferir que orcamento sem cliente vinculado nao cria cliente automaticamente;
- vincular cliente a um orcamento pela Gestao;
- vincular orcamento ao perfil de cliente pela aba Clientes;
- apagar orcamento individual e apagar orcamentos selecionados em bloco;
- restaurar orcamento pela lixeira;
- conferir auditoria de acoes;
- baixar PDF;
- usar Nara no CRM, agenda telefonica e WhatsApp assistido.
- usar filtros por etiqueta inteligente;
- gerar campanha assistida e abrir WhatsApp externo manualmente;
- preparar playbooks sem envio automatico.
- conferir CRM com lista lateral compacta e acoes em lote no painel principal.

## 17. Pontos que ainda podem evoluir

Melhorias futuras recomendadas:

- separar dados em tabelas proprias no Supabase em vez de salvar tudo em `user_state`;
- criar log detalhado de cada transferencia entre usuarios;
- adicionar permissao por equipe/grupo;
- criar lixeira/restauracao de dados movidos;
- criar busca global para admin;
- criar tela de auditoria de uso da IA;
- criar integracao oficial completa com Meta Cloud API para caixa WhatsApp real;
- enviar campanhas automaticas pelo WhatsApp oficial somente apos avaliar custo e regras da Meta;
- criar painel de qualidade de orcamentos gerados;
- criar controle de versao dos DNAs das empresas.

## 18. Observacao final

O sistema esta estruturado para operar como uma plataforma multiusuario:

- usuario comum trabalha com sua propria base;
- administrador controla acessos e compartilhamentos;
- Nara atua como assistente comercial;
- CRM guarda historico real por cliente e por orcamento, somente quando houver vinculo real;
- orcamentos respeitam o DNA de cada empresa;
- banco fica em nuvem pelo Supabase.

Antes de considerar tudo em producao, a etapa mais importante e rodar o `schema.sql` atualizado no Supabase e redeployar a versao 3.3.0 no Vercel.
