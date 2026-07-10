# OrcaFlow Studio AI 3.1.0 - CRM de Clientes com Nara

Esta versao adiciona uma evolucao da aba de clientes/CRM e troca a assistente comercial para Nara.

## Referencia analisada

Foi usado o HubSpot como referencia de boas praticas de CRM, principalmente:

- ficha unica do cliente;
- historico centralizado de comunicacoes;
- tarefas, atividades e proximos contatos;
- pipeline/temperatura do lead;
- IA para resumir registros, preparar respostas e sugerir proximos passos;
- visao de prioridade para manter leads aquecidos.

Nao foram copiadas partes complexas como marketplace, pagamentos, help desk completo, automacoes pesadas, integrações externas e funil enterprise, porque isso deixaria o OrcaFlow mais pesado sem necessidade neste momento.

## O que entrou

- Aba Clientes/CRM com painel mais profissional.
- Radar da Nara mostrando os clientes que mais precisam de atencao.
- KPIs de clientes ativos, quentes, atrasados e valor potencial.
- Filtros por Todos, Quentes, Atrasados, Hoje e Sem contato.
- Cadastro de contato com:
  - nome;
  - empresa;
  - cargo;
  - decisor/influenciador;
  - segmento;
  - telefone/WhatsApp;
  - e-mail;
  - origem;
  - status;
  - temperatura;
  - proximo contato;
  - valor potencial;
  - perfil/contexto;
  - observacoes internas.
- Historico de contato por cliente com:
  - WhatsApp;
  - e-mail;
  - ligacao;
  - reuniao;
  - visita;
  - registro interno;
  - anexo de print/foto/PDF/texto.
- Vinculo automatico com orcamentos relacionados ao nome do cliente.
- Botao para criar clientes a partir dos orcamentos existentes.
- Nara analisa perfil, historico, anexos e orcamentos relacionados.
- Nara sugere:
  - proximo passo;
  - estrategia;
  - mensagem de resposta;
  - dados faltantes;
  - prioridade;
  - lembrete;
  - proxima data de contato quando fizer sentido.
- A mensagem sugerida pode ser copiada, aberta no WhatsApp ou enviada por e-mail.
- O chat geral tambem passa a enxergar o CRM de clientes.

## Importante

Os campos internos antigos chamados `jade` e `lembreteJade` foram mantidos por compatibilidade com os dados ja salvos. Na interface e nos prompts, a assistente agora aparece como Nara.

## Como usar

1. Suba esta versao no GitHub.
2. Aguarde o deploy da Vercel.
3. Abra o sistema.
4. Entre na aba Clientes.
5. Clique em Criar clientes dos orcamentos para puxar sua base existente.
6. Abra um cliente e registre historicos de contato.
7. Clique em Analisar com Nara.
8. Use Copiar, WhatsApp ou E-mail para agir sobre a mensagem gerada.

## Verificacao feita

Comando executado:

```bash
npm run build
```

Resultado: build concluido com sucesso.

