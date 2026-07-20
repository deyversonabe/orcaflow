export const WHATS_REPORT_NUMBER = "5517992529930";
export const WHATS_REPORT_STORAGE_KEY = "orcaflow_whats_relatorio";
export const WEEKLY_REPORT_PENDING_KEY = "orcaflow_weekly_report_pending";

function clean(valor = "", limite = 600) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function parseValorBR(valor) {
  if (valor === null || valor === undefined) return 0;
  if (typeof valor === "number") return Number.isFinite(valor) ? valor : 0;
  let s = String(valor).trim().replace(/r\$/gi, "").replace(/\s/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.replace(/\./g, "").replace(",", ".");
  else if (s.includes(",")) s = s.replace(",", ".");
  else if (s.includes(".")) {
    const partes = s.split(".");
    if (partes.length > 1 && partes.at(-1)?.length === 3) s = s.replace(/\./g, "");
  }
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function brl(valor) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(parseValorBR(valor));
}

function dataHoraBR(data = new Date()) {
  const d = data instanceof Date ? data : new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function dataCurtaBR(data) {
  if (!data) return "";
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("pt-BR");
}

function inicioJanelaSemanal(agora = new Date()) {
  const d = new Date(agora);
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dentroDaSemana(data, inicio, fim) {
  if (!data) return false;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return false;
  return d >= inicio && d <= fim;
}

function textoBusca(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function statusOrcamento(item = {}) {
  const status = textoBusca(item.status || item.statusFunil || "");
  if (/finaliz|fechad|concluid|aprovad|ganh/.test(status)) return "Finalizado";
  if (/andament|negoci|execu|process/.test(status)) return "Andamento";
  return "Aberto";
}

function isFinalizado(item = {}) {
  return statusOrcamento(item) === "Finalizado";
}

function diasAte(data) {
  if (!data) return null;
  const alvo = new Date(`${String(data).slice(0, 10)}T00:00:00`);
  if (Number.isNaN(alvo.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((alvo - hoje) / 86400000);
}

function contatosOrcamento(item = {}) {
  const conversas = Array.isArray(item.conversas) ? item.conversas : [];
  const followups = Array.isArray(item.followups) ? item.followups : Array.isArray(item.contatos) ? item.contatos : [];
  const base = [
    ...conversas.map((msg) => ({
      canal: msg.canal || "Contato",
      tipo: msg.tipo || "Conversa",
      direcao: msg.direcao || "",
      mensagem: msg.mensagem || msg.conteudo || "",
      criadoEm: msg.criadoEm || msg.data || "",
      origem: msg.origem || "",
    })),
    ...followups.map((msg) => ({
      canal: msg.canal || "Follow-up",
      tipo: msg.tipo || "Follow-up",
      direcao: msg.direcao || "",
      mensagem: msg.mensagem || msg.conteudo || "",
      criadoEm: msg.criadoEm || msg.data || "",
      origem: msg.origem || "",
    })),
  ];
  return base.sort((a, b) => new Date(b.criadoEm || 0) - new Date(a.criadoEm || 0));
}

function prioridadeOrcamento(item = {}) {
  let score = 20;
  const motivos = [];
  const dias = diasAte(item.proximoContato);
  if (!isFinalizado(item)) score += 10;
  if (dias === null) {
    score += 18;
    motivos.push("sem proximo contato");
  } else if (dias < 0) {
    score += 32;
    motivos.push(`contato atrasado ha ${Math.abs(dias)} dia(s)`);
  } else if (dias === 0) {
    score += 22;
    motivos.push("contato hoje");
  }
  if (!contatosOrcamento(item).length) {
    score += 14;
    motivos.push("sem historico registrado");
  }
  if (parseValorBR(item.valorGlobal ?? item.valor ?? item.valorTotal) >= 10000) {
    score += 10;
    motivos.push("valor relevante");
  }
  if (score >= 78) return { score, nivel: "Critico", motivos };
  if (score >= 58) return { score, nivel: "Alta", motivos };
  if (score >= 36) return { score, nivel: "Media", motivos };
  return { score, nivel: "Baixa", motivos };
}

function orcamentoDaEmpresa(item = {}, empresas = []) {
  return empresas.find((emp) => emp.id === item.empresaId)?.nome || item.empresaNome || item.empresa || "Empresa nao identificada";
}

function clienteTemResultadoBom(cliente = {}, contatosSemana = [], orcamentosCliente = []) {
  const texto = textoBusca([
    cliente.status,
    cliente.proximoPasso,
    cliente.lembreteJade,
    ...contatosSemana.map((msg) => `${msg.tipo} ${msg.assunto || ""} ${msg.mensagem || msg.arquivoResumo || ""}`),
    ...orcamentosCliente.map((orc) => `${orc.status || ""} ${orc.numero || ""}`),
  ].join(" "));
  if (/fech|aprov|reunia|reuniao|orcamento|proposta enviada|servico|visita|negoci/.test(texto)) return true;
  return orcamentosCliente.some((orc) => dentroDaSemana(orc.criadoEm || orc.dataCriacaoArquivo || orc.dataDocumento, inicioJanelaSemanal(), new Date()));
}

function clientePrecisaAtencao(cliente = {}, orcamentosCliente = []) {
  const motivos = [];
  const dias = diasAte(cliente.proximoContato);
  if (!cliente.proximoContato) motivos.push("sem proximo contato");
  else if (dias < 0) motivos.push(`contato atrasado ha ${Math.abs(dias)} dia(s)`);
  else if (dias === 0) motivos.push("contato hoje");
  if (cliente.temperatura === "Quente") motivos.push("cliente quente");
  if (!Array.isArray(cliente.contatos) || !cliente.contatos.length) motivos.push("sem historico no CRM");
  if (orcamentosCliente.some((orc) => !isFinalizado(orc))) motivos.push("orcamento aberto vinculado");
  return motivos;
}

function orcamentosDoCliente(cliente = {}, crm = []) {
  const alvo = textoBusca([cliente.nome, cliente.empresa, cliente.email, cliente.email2, cliente.telefone, cliente.whatsapp, cliente.documento].filter(Boolean).join(" "));
  if (!alvo) return [];
  return (Array.isArray(crm) ? crm : []).filter((orc) => {
    const texto = textoBusca([orc.cliente, orc.empresaNome, orc.numero, orc.lembreteIA, orc.resumoConversas].filter(Boolean).join(" "));
    const clienteOrc = textoBusca(orc.cliente || "");
    return texto.includes(alvo) || (clienteOrc && alvo.includes(clienteOrc));
  });
}

function limitar(lista = [], limite = 12, formatador = (item) => String(item)) {
  const linhas = lista.slice(0, limite).map(formatador);
  if (lista.length > limite) linhas.push(`... +${lista.length - limite} item(ns) no OrcaFlow.`);
  return linhas.length ? linhas.join("\n\n") : "Nenhum registro encontrado.";
}

export function normalizarWhatsDestino(valor = WHATS_REPORT_NUMBER) {
  const numero = String(valor || "").replace(/\D/g, "");
  if (!numero) return WHATS_REPORT_NUMBER;
  return numero.startsWith("55") ? numero : `55${numero}`;
}

export function abrirWhatsRelatorio({ numero = WHATS_REPORT_NUMBER, texto = "" } = {}) {
  const destino = normalizarWhatsDestino(numero);
  if (typeof window !== "undefined") {
    window.open(`https://wa.me/${destino}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
  }
  return destino;
}

export function gerarRelatorioSemanalNara({ crm = [], clientes = [], empresas = [], usuarioNome = "", agora = new Date() } = {}) {
  const fim = agora instanceof Date ? agora : new Date(agora);
  const inicio = inicioJanelaSemanal(fim);
  const orcamentos = Array.isArray(crm) ? crm : [];
  const contatosClientes = Array.isArray(clientes) ? clientes : [];

  const abertos = orcamentos
    .filter((item) => !isFinalizado(item))
    .map((item) => ({ item, prioridade: prioridadeOrcamento(item) }))
    .sort((a, b) => b.prioridade.score - a.prioridade.score);

  const geradosSemana = orcamentos.filter((item) => dentroDaSemana(item.criadoEm || item.dataCriacaoArquivo || item.dataDocumento, inicio, fim));
  const interacoesSemana = orcamentos
    .flatMap((item) => contatosOrcamento(item)
      .filter((msg) => dentroDaSemana(msg.criadoEm, inicio, fim))
      .map((msg) => ({ item, msg })))
    .sort((a, b) => new Date(b.msg.criadoEm || 0) - new Date(a.msg.criadoEm || 0));

  const valorAberto = abertos.reduce((soma, { item }) => soma + parseValorBR(item.valorGlobal ?? item.valor ?? item.valorTotal), 0);
  const valorGerado = geradosSemana.reduce((soma, item) => soma + parseValorBR(item.valorGlobal ?? item.valor ?? item.valorTotal), 0);

  const linhasAbertos = limitar(abertos, 12, ({ item, prioridade }, i) => {
    const motivos = prioridade.motivos.length ? ` | ${prioridade.motivos.join(", ")}` : "";
    return `${i + 1}. ${item.cliente || "Cliente sem nome"} - ${item.numero || "sem numero"}\nEmpresa: ${orcamentoDaEmpresa(item, empresas)}\nValor: ${brl(item.valorGlobal ?? item.valor ?? item.valorTotal)} | Status: ${statusOrcamento(item)} | Prioridade: ${prioridade.nivel} ${prioridade.score}${motivos}\nAcao Nara: ${clean(item.lembreteIA || item.lembrete || "fazer follow-up e registrar retorno", 220)}`;
  });

  const linhasGerados = limitar(geradosSemana, 10, (item, i) => {
    return `${i + 1}. ${item.numero || "sem numero"} - ${item.cliente || "Cliente sem nome"}\nEmpresa: ${orcamentoDaEmpresa(item, empresas)} | Valor: ${brl(item.valorGlobal ?? item.valor ?? item.valorTotal)} | Criado: ${dataCurtaBR(item.criadoEm || item.dataCriacaoArquivo || item.dataDocumento)}`;
  });

  const linhasInteracoes = limitar(interacoesSemana, 12, ({ item, msg }, i) => {
    return `${i + 1}. ${dataHoraBR(msg.criadoEm)} - ${item.cliente || "Cliente sem nome"} (${item.numero || "sem numero"})\n${msg.canal || "Contato"} / ${msg.tipo || "Follow-up"}: ${clean(msg.mensagem, 260) || "registro sem texto"}`;
  });

  const contatosSemana = contatosClientes
    .flatMap((cliente) => (Array.isArray(cliente.contatos) ? cliente.contatos : [])
      .filter((msg) => dentroDaSemana(msg.criadoEm, inicio, fim))
      .map((msg) => ({ cliente, msg })))
    .sort((a, b) => new Date(b.msg.criadoEm || 0) - new Date(a.msg.criadoEm || 0));

  const clientesComContexto = contatosClientes.map((cliente) => {
    const orcs = orcamentosDoCliente(cliente, orcamentos);
    const registros = Array.isArray(cliente.contatos) ? cliente.contatos : [];
    const semana = registros.filter((msg) => dentroDaSemana(msg.criadoEm, inicio, fim));
    return {
      cliente,
      orcamentos: orcs,
      contatosSemana: semana,
      bomResultado: clienteTemResultadoBom(cliente, semana, orcs),
      motivosAtencao: clientePrecisaAtencao(cliente, orcs),
    };
  });

  const bonsResultados = clientesComContexto.filter((item) => item.bomResultado);
  const precisamAtencao = clientesComContexto
    .filter((item) => item.motivosAtencao.length)
    .sort((a, b) => b.motivosAtencao.length - a.motivosAtencao.length);

  const linhasContatos = limitar(contatosSemana, 14, ({ cliente, msg }, i) => {
    return `${i + 1}. ${dataHoraBR(msg.criadoEm)} - ${cliente.nome || cliente.empresa || "Cliente sem nome"}\n${msg.canal || "Contato"} / ${msg.tipo || "Registro"}: ${clean(msg.mensagem || msg.arquivoResumo, 260) || "registro/anexo sem texto"}`;
  });

  const linhasResultados = limitar(bonsResultados, 8, ({ cliente, orcamentos: orcs, contatosSemana: semana }, i) => {
    const ultimo = semana[0] || (Array.isArray(cliente.contatos) ? cliente.contatos[0] : null);
    return `${i + 1}. ${cliente.nome || cliente.empresa || "Cliente sem nome"}\nResultado percebido: ${clean(ultimo?.tipo || cliente.status || "movimentacao positiva", 90)} | Orcamentos vinculados: ${orcs.length}\nProximo passo: ${clean(cliente.proximoPasso || cliente.lembreteJade || "manter cliente aquecido", 220)}`;
  });

  const linhasAtencao = limitar(precisamAtencao, 10, ({ cliente, motivosAtencao, orcamentos: orcs }, i) => {
    const valor = orcs.reduce((soma, orc) => soma + parseValorBR(orc.valorGlobal ?? orc.valor ?? orc.valorTotal), 0);
    return `${i + 1}. ${cliente.nome || cliente.empresa || "Cliente sem nome"}\nMotivos: ${motivosAtencao.join(", ")} | Potencial: ${brl(cliente.valorPotencial || valor)}\nAcao Nara: ${clean(cliente.proximoPasso || cliente.lembreteJade || "fazer contato consultivo e registrar resposta", 220)}`;
  });

  return [
    `Nara - Relatorio semanal OrcaFlow`,
    `Responsavel: ${usuarioNome || "OrcaFlow"}`,
    `Periodo analisado: ${dataCurtaBR(inicio)} a ${dataCurtaBR(fim)}`,
    `Envio programado: sexta-feira, 17:00`,
    "",
    "BLOCO 1 - GESTAO / ORCAMENTOS",
    `Resumo: ${abertos.length} aberto(s), ${geradosSemana.length} gerado(s) na semana, ${interacoesSemana.length} interacao(oes) registradas.`,
    `Valor aberto: ${brl(valorAberto)} | Valor gerado na semana: ${brl(valorGerado)}`,
    "",
    "1. Orcamentos em aberto geral:",
    linhasAbertos,
    "",
    "2. Orcamentos gerados na semana:",
    linhasGerados,
    "",
    "3. Interacoes e historico da semana:",
    linhasInteracoes,
    "",
    "BLOCO 2 - CRM / CLIENTES",
    `Resumo: ${contatosSemana.length} contato(s) registrado(s), ${bonsResultados.length} sinal(is) positivo(s), ${precisamAtencao.length} cliente(s) pedindo atencao.`,
    "",
    "1. Contatos registrados na semana:",
    linhasContatos,
    "",
    "2. Bons resultados percebidos:",
    linhasResultados,
    "",
    "3. Clientes que precisam de atencao:",
    linhasAtencao,
    "",
    "Fechamento da Nara: priorize os clientes com contato atrasado, valor relevante ou orcamento aberto sem retorno. Depois registre cada resposta no CRM para melhorar a proxima analise.",
  ].join("\n");
}
