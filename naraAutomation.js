const DIA_MS = 86400000;

export const KEY_NARA_AUTOMATION = "orcaflow_nara_automation";
export const KEY_DAILY_RADAR_PENDING = "orcaflow_nara_daily_radar_pending";
export const KEY_AUTO_BACKUP_LOG = "orcaflow_auto_backup_log";

export const DEFAULT_NARA_CONFIG = {
  radarDiarioAtivo: true,
  checklistGeracaoAtivo: true,
  auditoriaContatosAtiva: true,
  detectorSimilaridadeAtivo: true,
  backupAssistidoAtivo: true,
  horaRadar: "08:00",
  diaBackup: 5,
};

export function cleanText(valor = "", limite = 1000) {
  return String(valor || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limite);
}

export function textoBusca(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function parseValorBR(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  let texto = String(valor)
    .trim()
    .replace(/r\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");
  if (!texto) return 0;
  if (texto.includes(",") && texto.includes(".")) texto = texto.replace(/\./g, "").replace(",", ".");
  else if (texto.includes(",")) texto = texto.replace(",", ".");
  else if (texto.includes(".")) {
    const partes = texto.split(".");
    if (partes.length > 1 && partes.at(-1)?.length === 3) texto = texto.replace(/\./g, "");
  }
  const n = Number.parseFloat(texto);
  return Number.isFinite(n) ? n : 0;
}

export function brl(valor) {
  return parseValorBR(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function dataISOEmDias(dias = 0, base = new Date()) {
  const data = new Date(base);
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

export function diasAte(data) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(`${String(data).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.round((alvo - hoje) / DIA_MS);
}

export function diasDesde(data) {
  if (!data) return 0;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - d.getTime()) / DIA_MS));
}

export function normalizarStatus(itemOuStatus) {
  const raw = typeof itemOuStatus === "string"
    ? itemOuStatus
    : itemOuStatus?.status || itemOuStatus?.statusFunil || "";
  const status = textoBusca(raw);
  if (/finaliz|conclu|fechad|ganh|aprovad/.test(status)) return "Finalizado";
  if (/andament|negoci|process|execu/.test(status)) return "Andamento";
  return "Aberto";
}

export function isFinalizado(item) {
  return normalizarStatus(item) === "Finalizado";
}

export function contatosOrcamento(item = {}) {
  const conversas = Array.isArray(item.conversas) ? item.conversas : [];
  const followups = Array.isArray(item.followups) ? item.followups : Array.isArray(item.contatos) ? item.contatos : [];
  const base = [
    ...conversas.map((msg) => ({
      ...msg,
      mensagem: msg.mensagem || msg.conteudo || "",
      criadoEm: msg.criadoEm || msg.data || "",
      origem: msg.origem || "",
    })),
    ...followups.map((msg) => ({
      ...msg,
      mensagem: msg.mensagem || msg.conteudo || "",
      criadoEm: msg.criadoEm || msg.data || "",
      origem: msg.origem || "",
    })),
  ];
  return base
    .filter((msg) => msg.mensagem || msg.criadoEm || msg.arquivoNome)
    .sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

export function avaliarPrioridadeNara(item = {}) {
  if (isFinalizado(item)) {
    return {
      score: 0,
      nivel: "Fechado",
      cor: "#00E676",
      motivos: ["orcamento finalizado"],
      acao: "manter como historico comercial",
    };
  }

  let score = 15;
  const motivos = [];
  const diasContato = diasAte(item.proximoContato);
  const valor = parseValorBR(item.valorGlobal ?? item.valor ?? item.valorTotal);
  const idade = diasDesde(item.criadoEm || item.dataDocumento || item.dataArquivo);
  const contatos = contatosOrcamento(item);

  if (diasContato === null) {
    score += 28;
    motivos.push("sem proximo contato");
  } else if (diasContato < 0) {
    score += 38;
    motivos.push(`contato atrasado ha ${Math.abs(diasContato)} dia(s)`);
  } else if (diasContato === 0) {
    score += 24;
    motivos.push("contato hoje");
  } else if (diasContato <= 3) {
    score += 12;
    motivos.push("contato proximo");
  }

  if (normalizarStatus(item) === "Andamento") {
    score += 10;
    motivos.push("em negociacao");
  } else {
    score += 8;
    motivos.push("em aberto");
  }

  if (!contatos.length) {
    score += 18;
    motivos.push("sem historico registrado");
  } else if (diasDesde(contatos[0]?.criadoEm) >= 7) {
    score += 12;
    motivos.push("historico sem atualizacao recente");
  }

  if (valor >= 100000) {
    score += 18;
    motivos.push("alto valor");
  } else if (valor >= 50000) {
    score += 12;
    motivos.push("valor relevante");
  } else if (valor >= 10000) {
    score += 7;
    motivos.push("valor comercial");
  }

  if (idade >= 21) {
    score += 12;
    motivos.push("orcamento antigo");
  } else if (idade >= 7) {
    score += 6;
    motivos.push("aguardando retorno");
  }

  score = Math.min(100, Math.max(0, score));

  let nivel = "Baixa";
  let cor = "#00E676";
  if (score >= 80) {
    nivel = "Critica";
    cor = "#F87171";
  } else if (score >= 60) {
    nivel = "Alta";
    cor = "#F59E0B";
  } else if (score >= 35) {
    nivel = "Media";
    cor = "#00B0FF";
  }

  const acao = montarProximoPassoOrcamento(item, motivos);
  return { score, nivel, cor, motivos, acao };
}

export function montarProximoPassoOrcamento(item = {}, motivos = []) {
  const cliente = cleanText(item.cliente || "cliente", 80);
  const numero = item.numero ? ` ${item.numero}` : "";
  const textoMotivos = textoBusca(motivos.join(" "));

  if (/atrasado|historico sem atualizacao|sem proximo contato/.test(textoMotivos)) {
    return `Retomar contato com ${cliente} sobre o orcamento${numero}, confirmar recebimento e registrar resposta real no historico.`;
  }
  if (/alto valor|valor relevante/.test(textoMotivos)) {
    return `Tratar ${cliente} como oportunidade prioritaria: validar decisor, objeções e etapa de fechamento do orcamento${numero}.`;
  }
  if (/sem historico/.test(textoMotivos)) {
    return `Registrar a primeira tratativa com ${cliente} e definir o proximo contato do orcamento${numero}.`;
  }
  return `Manter acompanhamento comercial de ${cliente} e atualizar o CRM apos cada retorno.`;
}

function clienteOrcamentos(cliente = {}, crm = []) {
  const alvo = textoBusca([cliente.nome, cliente.empresa, cliente.documento, cliente.email, cliente.whatsapp].filter(Boolean).join(" "));
  if (!alvo) return [];
  return (Array.isArray(crm) ? crm : []).filter((orc) => {
    const texto = textoBusca([orc.cliente, orc.numero, orc.empresaNome, orc.descricaoArquivo].filter(Boolean).join(" "));
    const nomeOrc = textoBusca(orc.cliente || "");
    return texto.includes(alvo) || (nomeOrc && alvo.includes(nomeOrc));
  });
}

export function avaliarClienteNara(cliente = {}, crm = []) {
  let score = 10;
  const motivos = [];
  const orcamentos = clienteOrcamentos(cliente, crm);
  const abertos = orcamentos.filter((orc) => !isFinalizado(orc));
  const contatos = Array.isArray(cliente.contatos) ? cliente.contatos : [];
  const diasContato = diasAte(cliente.proximoContato);
  const valorOrcs = abertos.reduce((soma, orc) => soma + parseValorBR(orc.valorGlobal ?? orc.valor), 0);
  const valor = parseValorBR(cliente.valorPotencial) || valorOrcs;

  if (diasContato === null) {
    score += 20;
    motivos.push("sem proximo contato");
  } else if (diasContato < 0) {
    score += 34;
    motivos.push(`contato atrasado ha ${Math.abs(diasContato)} dia(s)`);
  } else if (diasContato === 0) {
    score += 24;
    motivos.push("contato hoje");
  }

  if (textoBusca(cliente.temperatura).includes("quente")) {
    score += 16;
    motivos.push("cliente quente");
  }
  if (abertos.length) {
    score += Math.min(18, abertos.length * 6);
    motivos.push(`${abertos.length} orcamento(s) aberto(s)`);
  }
  if (!contatos.length) {
    score += 15;
    motivos.push("sem historico no CRM");
  } else if (diasDesde(contatos[0]?.criadoEm) >= 7) {
    score += 10;
    motivos.push("cliente sem interacao recente");
  }
  if (valor >= 100000) score += 15;
  else if (valor >= 50000) score += 10;
  else if (valor >= 10000) score += 6;

  score = Math.min(100, Math.max(0, score));
  const nivel = score >= 80 ? "Critica" : score >= 60 ? "Alta" : score >= 35 ? "Media" : "Baixa";
  const acao = montarProximoPassoCliente(cliente, motivos, abertos);
  return { score, nivel, motivos, acao, valorPotencial: valor, orcamentosAbertos: abertos.length };
}

export function montarProximoPassoCliente(cliente = {}, motivos = [], abertos = []) {
  const nome = cleanText(cliente.nome || cliente.empresa || "cliente", 90);
  const motivo = textoBusca(motivos.join(" "));
  if (/sem historico|sem proximo contato|atrasado/.test(motivo)) {
    return `Fazer contato com ${nome}, confirmar contexto atual e registrar a resposta no CRM.`;
  }
  if (abertos.length) {
    return `Relacionar a conversa de ${nome} ao orcamento aberto correto e validar decisor, objeção e proxima etapa.`;
  }
  if (/quente/.test(motivo)) {
    return `Manter ${nome} aquecido com mensagem consultiva e pergunta objetiva sobre a decisao.`;
  }
  return `Atualizar dados de contato de ${nome} e definir novo passo comercial.`;
}

export function detectarOrcamentosParecidos({ texto = "", cliente = "", crm = [], limite = 5 } = {}) {
  const alvoTokens = tokenSet(`${cliente} ${texto}`);
  if (!alvoTokens.size) return [];
  return (Array.isArray(crm) ? crm : [])
    .map((item) => {
      const fonte = [
        item.cliente,
        item.descricaoArquivo,
        item.lembreteIA,
        item.resumoConversas,
        item.orcamentoCompleto?.campos?.escopo,
        item.orcamentoCompleto?.campos?.objetivo,
        item.orcamentoCompleto?.campos?.intro,
      ].filter(Boolean).join(" ");
      const score = jaccard(alvoTokens, tokenSet(fonte));
      return { item, score };
    })
    .filter(({ score }) => score >= 0.42)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite)
    .map(({ item, score }) => ({
      id: item.id,
      numero: item.numero || "",
      cliente: item.cliente || "",
      empresaNome: item.empresaNome || "",
      score: Number(score.toFixed(2)),
    }));
}

function tokenSet(valor = "") {
  const stop = new Set(["para", "com", "dos", "das", "uma", "um", "que", "por", "sobre", "este", "esta", "servico", "orcamento", "proposta"]);
  const tokens = textoBusca(valor)
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 4 && !stop.has(token));
  return new Set(tokens);
}

function jaccard(a, b) {
  if (!a.size || !b.size) return 0;
  let inter = 0;
  for (const token of a) if (b.has(token)) inter += 1;
  return inter / (a.size + b.size - inter);
}

export function gerarChecklistPreGeracao({ cliente = "", texto = "", obs = "", selecao = [], empresas = [], crm = [] } = {}) {
  const bloqueios = [];
  const avisos = [];
  const acoes = [];
  const textoTotal = `${texto}\n${obs}`;
  const textoNormal = textoBusca(textoTotal);

  if (!cleanText(cliente, 300)) bloqueios.push("Informe o cliente/destinatario.");
  if (!cleanText(texto, 500)) bloqueios.push("Descreva o servico ou anexe um PDF/imagem para leitura.");
  if (!Array.isArray(selecao) || !selecao.length) bloqueios.push("Selecione pelo menos uma empresa.");

  for (const s of selecao || []) {
    const emp = empresas.find((e) => e.id === s.empId);
    if (!emp) {
      bloqueios.push("Uma das empresas selecionadas nao foi encontrada.");
      continue;
    }
    if (!parseValorBR(s.valorGlobal)) avisos.push(`${emp.nome || "Empresa"} esta sem valor global.`);
    if (!cleanText(emp.dnaLinguagem || emp.estruturaOrcamento || emp.padraoDocumental, 200)) {
      avisos.push(`${emp.nome || "Empresa"} esta com DNA documental incompleto.`);
    }
    if (!emp.papelTimbrado) avisos.push(`${emp.nome || "Empresa"} esta sem papel timbrado anexado.`);
  }

  if (/\bprazo\b|\bvalidade\b|condi[cç][aã]o|pagamento|garantia|cronograma/.test(textoNormal)) {
    avisos.push("O resumo menciona prazo, validade, garantia ou condicoes. A Nara vai remover isso do documento final.");
    acoes.push("Nao incluir prazo, data, validade, garantia, pagamento ou condicoes de execucao.");
  }

  const temListaProvavel = /(\n|\r|;|\d+\s*[xX]|\bqtd\b|\bun\b|\bitem\b|\br\$\s*\d)/i.test(textoTotal) &&
    /(material|item|produto|peca|pe[cç]a|equipamento|luminaria|cabo|disjuntor|poste|maquina|servico)/i.test(textoTotal);
  if (temListaProvavel) {
    acoes.push("Quando houver lista real de itens, gerar tabela com valores finais fechando exatamente no valor global.");
  } else {
    acoes.push("Nao criar tabela de materiais sem lista real de itens.");
  }

  const parecidos = detectarOrcamentosParecidos({ texto, cliente, crm, limite: 4 });
  if (parecidos.length) {
    avisos.push(`Foram encontrados ${parecidos.length} orcamento(s) parecido(s). A Nara vai variar estrutura, linguagem e visual.`);
    acoes.push("Evitar abertura, fechamento, rotulos e sequencia de secoes similares aos orcamentos anteriores.");
  }

  return {
    ok: !bloqueios.length,
    bloqueios,
    avisos,
    acoes,
    parecidos,
    temListaProvavel,
    resumo: [
      bloqueios.length ? `Bloqueios: ${bloqueios.join(" | ")}` : "Sem bloqueios.",
      avisos.length ? `Avisos: ${avisos.join(" | ")}` : "Sem avisos relevantes.",
      acoes.length ? `Acoes automaticas: ${acoes.join(" | ")}` : "",
    ].filter(Boolean).join("\n"),
  };
}

export function gerarRadarDiarioNara({ crm = [], clientes = [], empresas = [], usuarioNome = "", agora = new Date() } = {}) {
  const orcamentos = Array.isArray(crm) ? crm : [];
  const contatos = Array.isArray(clientes) ? clientes : [];
  const filaOrcamentos = orcamentos
    .filter((item) => !isFinalizado(item))
    .map((item) => ({ item, prioridade: avaliarPrioridadeNara(item) }))
    .sort((a, b) => b.prioridade.score - a.prioridade.score);
  const filaClientes = contatos
    .map((cliente) => ({ cliente, prioridade: avaliarClienteNara(cliente, orcamentos) }))
    .filter(({ prioridade }) => prioridade.score >= 35)
    .sort((a, b) => b.prioridade.score - a.prioridade.score);

  const valorAberto = filaOrcamentos.reduce((soma, { item }) => soma + parseValorBR(item.valorGlobal ?? item.valor), 0);
  const criticos = filaOrcamentos.filter(({ prioridade }) => prioridade.score >= 80).length + filaClientes.filter(({ prioridade }) => prioridade.score >= 80).length;
  const data = agora instanceof Date ? agora : new Date(agora);

  const linhasOrcamentos = filaOrcamentos.slice(0, 8).map(({ item, prioridade }, index) => {
    const empresa = empresas.find((emp) => emp.id === item.empresaId)?.nome || item.empresaNome || "Empresa nao identificada";
    return `${index + 1}. ${item.cliente || "Cliente sem nome"} - ${item.numero || "sem numero"}\nEmpresa: ${empresa} | Valor: ${brl(item.valorGlobal ?? item.valor)} | Prioridade: ${prioridade.nivel} ${prioridade.score}\nMotivo: ${prioridade.motivos.join(", ") || "acompanhamento"}\nProximo passo: ${prioridade.acao}`;
  });

  const linhasClientes = filaClientes.slice(0, 8).map(({ cliente, prioridade }, index) => {
    return `${index + 1}. ${cliente.nome || cliente.empresa || "Cliente sem nome"}\nPrioridade: ${prioridade.nivel} ${prioridade.score} | Potencial: ${brl(prioridade.valorPotencial || cliente.valorPotencial)}\nMotivo: ${prioridade.motivos.join(", ") || "acompanhamento"}\nProximo passo: ${prioridade.acao}`;
  });

  const texto = [
    "Nara - Radar diario comercial",
    `Responsavel: ${usuarioNome || "OrcaFlow"}`,
    `Gerado em: ${data.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`,
    "",
    `Resumo: ${filaOrcamentos.length} orcamento(s) aberto(s), ${filaClientes.length} cliente(s) em atencao, ${criticos} prioridade(s) critica(s).`,
    `Valor aberto monitorado: ${brl(valorAberto)}`,
    "",
    "Orcamentos para agir hoje:",
    linhasOrcamentos.length ? linhasOrcamentos.join("\n\n") : "Nenhum orcamento critico no momento.",
    "",
    "Clientes para manter aquecidos:",
    linhasClientes.length ? linhasClientes.join("\n\n") : "Nenhum cliente priorizado no momento.",
    "",
    "Orientacao da Nara: fale primeiro com os casos criticos, registre a resposta real no CRM e defina sempre um proximo contato.",
  ].join("\n");

  return {
    id: `radar_${data.toISOString().slice(0, 10)}`,
    tipo: "radar_diario",
    titulo: "Radar diario da Nara",
    geradoEm: data.toISOString(),
    criticos,
    totalOrcamentos: filaOrcamentos.length,
    totalClientes: filaClientes.length,
    valorAberto,
    orcamentos: filaOrcamentos.slice(0, 8).map(({ item, prioridade }) => ({ id: item.id, numero: item.numero, cliente: item.cliente, prioridade })),
    clientes: filaClientes.slice(0, 8).map(({ cliente, prioridade }) => ({ id: cliente.id, nome: cliente.nome || cliente.empresa, prioridade })),
    texto,
  };
}

export function gerarAuditoriaEquipe({ crm = [], clientes = [] } = {}) {
  const problemas = [];
  const orcamentos = Array.isArray(crm) ? crm : [];
  const listaClientes = Array.isArray(clientes) ? clientes : [];

  for (const item of orcamentos) {
    const contatos = contatosOrcamento(item);
    if (!isFinalizado(item) && !contatos.length) {
      problemas.push({
        tipo: "orcamento_sem_historico",
        nivel: "alto",
        alvo: item.cliente || item.numero || "orcamento",
        detalhe: "Orcamento aberto sem conversa, follow-up ou comprovante registrado.",
      });
    }
    for (const contato of contatos.slice(0, 20)) {
      const texto = cleanText(contato.mensagem || contato.conteudo || "", 220);
      const temAnexo = Boolean(contato.arquivoNome || contato.arquivoPreview || contato.anexoUrl);
      if (!temAnexo && texto.length < 18 && contato.origem !== "ia") {
        problemas.push({
          tipo: "registro_fraco",
          nivel: "medio",
          alvo: item.cliente || item.numero || "orcamento",
          detalhe: "Registro manual muito curto e sem comprovante anexado.",
        });
      }
    }
  }

  for (const cliente of listaClientes) {
    const contatos = Array.isArray(cliente.contatos) ? cliente.contatos : [];
    for (const contato of contatos.slice(0, 20)) {
      const texto = cleanText(contato.mensagem || contato.arquivoResumo || "", 220);
      const temAnexo = Boolean(contato.arquivoNome || contato.arquivoPreview);
      if (!temAnexo && texto.length < 18) {
        problemas.push({
          tipo: "cliente_registro_fraco",
          nivel: "medio",
          alvo: cliente.nome || cliente.empresa || "cliente",
          detalhe: "Contato do cliente sem detalhe suficiente e sem anexo.",
        });
      }
    }
  }

  const texto = [
    "Nara - Auditoria de registros comerciais",
    `Total de pontos encontrados: ${problemas.length}`,
    "",
    problemas.length
      ? problemas.slice(0, 20).map((p, i) => `${i + 1}. [${p.nivel}] ${p.alvo}\n${p.detalhe}`).join("\n\n")
      : "Nenhum ponto critico encontrado. Os registros possuem historico suficiente para acompanhamento.",
    "",
    "Orientacao: contatos comerciais importantes devem conter data, canal, resumo real da conversa e, quando possivel, print/foto/arquivo de apoio.",
  ].join("\n");

  return {
    total: problemas.length,
    problemas,
    texto,
  };
}

export function deveGerarRadarHoje(ultimoRadar, agora = new Date()) {
  const hoje = agora.toISOString().slice(0, 10);
  return ultimoRadar?.dia !== hoje;
}

export function precisaBackupAssistido(ultimoBackupISO, agora = new Date()) {
  if (!ultimoBackupISO) return true;
  return diasDesde(ultimoBackupISO) >= 7;
}
