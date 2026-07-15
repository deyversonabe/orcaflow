import React, { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "./supabase.js";
import { store } from "./store.js";
import { Copy, Mail, MessageCircle, Send, Tags, Upload, Users, Wand2 } from "lucide-react";
import { abrirWhatsRelatorio, gerarRelatorioSemanalNara, normalizarWhatsDestino, WHATS_REPORT_NUMBER, WHATS_REPORT_STORAGE_KEY } from "./weeklyReport.js";

const KEY_CLIENTES = "orcaflow_clientes_crm";
const KEY_ORCAMENTOS = "orcaflow_crm_orcamentos";

const C = {
  bg: "#07111F",
  panel: "#0B1628",
  panel2: "#071220",
  border: "#1E3352",
  border2: "#28425F",
  text: "#E5F0FF",
  muted: "#9FB0C8",
  dim: "#65758F",
  green: "#00FF88",
  green2: "#16A34A",
  blue2: "#2563EB",
  warn: "#F59E0B",
  danger: "#FB7185",
};

function clean(valor = "", limite = 4000) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function uniqueList(lista = []) {
  return [...new Set((Array.isArray(lista) ? lista : []).map((item) => clean(item, 60)).filter(Boolean))];
}

function normalizarEtiquetas(valor = []) {
  if (Array.isArray(valor)) return uniqueList(valor);
  return uniqueList(String(valor || "").split(/[,;\n]/));
}

function textoBusca(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function brl(valor) {
  const n = Number(String(valor ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
}

function formatTelefone(valor = "") {
  const d = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

function normalizarNumeroWhats(valor = "") {
  let d = String(valor || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("55") && d.length >= 12) return d;
  if (d.length === 10 || d.length === 11) return `55${d}`;
  return d;
}

const ETIQUETAS_PADRAO = [
  ["orcamento-aberto", "Orcamento aberto", C.blue2],
  ["alto-valor", "Alto valor", C.warn],
  ["atrasado", "Atrasado", C.danger],
  ["cliente-quente", "Cliente quente", C.warn],
  ["sem-whatsapp", "Sem WhatsApp", C.danger],
  ["sem-historico", "Sem historico", C.blue2],
  ["precisa-retorno", "Precisa retorno", C.green2],
  ["pediu-desconto", "Pediu desconto", C.warn],
  ["aguardando-documento", "Aguardando doc.", C.blue2],
  ["reuniao", "Reuniao", C.green2],
  ["bom-sinal", "Bom sinal", C.green2],
];

const PLAYBOOKS_ASSISTIDOS = [
  {
    id: "confirmar-recebimento",
    label: "Confirmar recebimento",
    tipo: "Follow-up",
    assunto: "Confirmar recebimento da proposta",
  },
  {
    id: "cobrar-retorno",
    label: "Cobrar retorno",
    tipo: "Cobranca",
    assunto: "Retorno sobre proposta em aberto",
  },
  {
    id: "pedir-dados",
    label: "Pedir dados faltantes",
    tipo: "Duvida",
    assunto: "Dados para avancar na proposta",
  },
  {
    id: "reativar",
    label: "Reativar cliente",
    tipo: "Follow-up",
    assunto: "Retomada de conversa",
  },
  {
    id: "pos-reuniao",
    label: "Pos-reuniao",
    tipo: "Retorno",
    assunto: "Resumo do alinhamento",
  },
];

const CAMPANHAS_ASSISTIDAS = [
  ["retomar-atrasados", "Retomar atrasados"],
  ["aquecer-quentes", "Aquecer clientes quentes"],
  ["confirmar-recebimento", "Confirmar propostas"],
  ["pedir-documentos", "Pedir documentos/dados"],
  ["reativar-sem-contato", "Reativar sem contato"],
];

function tsFmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizarStatus(item = {}) {
  const status = textoBusca(item.status || "");
  if (/finaliz|fechad|concluid|aprovad|ganh/.test(status)) return "Finalizado";
  if (/andament|negoci|execu|process/.test(status)) return "Andamento";
  return "Aberto";
}

function diasAte(data) {
  if (!data) return null;
  const d = new Date(data);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
}

function isAtrasado(item = {}) {
  const dif = diasAte(item.proximoContato);
  return normalizarStatus(item) !== "Finalizado" && dif !== null && dif < 0;
}

function isHoje(item = {}) {
  return diasAte(item.proximoContato) === 0;
}

function statusFunil(item = {}) {
  return isAtrasado(item) ? "Atrasado" : normalizarStatus(item);
}

function valorOrcamento(item = {}) {
  return Number(String(item.valorGlobal ?? item.valor ?? item.valorTotal ?? item.valorPotencial ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, "")) || 0;
}

function labelEtiqueta(id = "") {
  return ETIQUETAS_PADRAO.find(([key]) => key === id)?.[1] || id;
}

function corEtiqueta(id = "") {
  return ETIQUETAS_PADRAO.find(([key]) => key === id)?.[2] || C.border2;
}

function etiquetasPorTexto(texto = "") {
  const t = textoBusca(texto);
  const tags = [];
  if (/desconto|menor preco|menor valor|negociar|abatimento/.test(t)) tags.push("pediu-desconto");
  if (/documento|cnpj|cpf|art|projeto|arquivo|planilha|enviar dados|faltou/.test(t)) tags.push("aguardando-documento");
  if (/reuniao|visita|call|ligacao|videoconferencia/.test(t)) tags.push("reuniao");
  if (/aprov|fechar|vamos fazer|autoriz|ok para iniciar|pode emitir/.test(t)) tags.push("bom-sinal");
  if (/retorno|follow|cobrar|sem resposta|aguardando/.test(t)) tags.push("precisa-retorno");
  return uniqueList(tags);
}

function sugerirEtiquetasCliente(cliente = {}, orcamentos = []) {
  const tags = [];
  const abertos = (Array.isArray(orcamentos) ? orcamentos : []).filter((orc) => normalizarStatus(orc) !== "Finalizado");
  const valorTotal = abertos.reduce((soma, orc) => soma + valorOrcamento(orc), 0) || valorOrcamento(cliente);
  const contatos = Array.isArray(cliente.contatos) ? cliente.contatos : [];
  const textoHistorico = contatos.slice(0, 12).map((msg) => [msg.tipo, msg.assunto, msg.mensagem, msg.arquivoResumo].filter(Boolean).join(" ")).join(" ");

  if (abertos.length) tags.push("orcamento-aberto");
  if (valorTotal >= 50000) tags.push("alto-valor");
  if (isAtrasado(cliente) || abertos.some(isAtrasado)) tags.push("atrasado");
  if (cliente.temperatura === "Quente") tags.push("cliente-quente");
  if (!cliente.whatsapp && !cliente.telefone) tags.push("sem-whatsapp");
  if (!contatos.length) tags.push("sem-historico");
  if (!cliente.proximoContato || isAtrasado(cliente)) tags.push("precisa-retorno");
  return uniqueList([...tags, ...etiquetasPorTexto(textoHistorico)]);
}

function combinarEtiquetas(...listas) {
  return uniqueList(listas.flatMap((lista) => normalizarEtiquetas(lista)));
}

function sugerirPlaybookCliente(cliente = {}, orcamentos = []) {
  const tags = combinarEtiquetas(cliente.etiquetas, sugerirEtiquetasCliente(cliente, orcamentos));
  if (tags.includes("aguardando-documento")) return "pedir-dados";
  if (tags.includes("atrasado") || tags.includes("precisa-retorno")) return "cobrar-retorno";
  if (tags.includes("sem-historico")) return "confirmar-recebimento";
  if (tags.includes("reuniao")) return "pos-reuniao";
  if (!cliente.proximoContato) return "reativar";
  return "confirmar-recebimento";
}

function primeiroNome(valor = "") {
  const nome = clean(valor, 80);
  return nome.split(/\s+/).filter(Boolean)[0] || nome || "tudo bem";
}

function resumoOrcamentoCurto(orcamento = {}) {
  if (!orcamento) return "a proposta que conversamos";
  const numero = orcamento.numero ? `orcamento ${orcamento.numero}` : "proposta";
  const valor = orcamento.valor ? ` no valor de ${brl(orcamento.valor)}` : "";
  const empresa = orcamento.empresaNome ? ` (${orcamento.empresaNome})` : "";
  return `${numero}${empresa}${valor}`;
}

function montarMensagemAssistida({ cliente = {}, orcamento = null, playbookId = "confirmar-recebimento", usuarioNome = "" } = {}) {
  const nome = primeiroNome(cliente.nome || cliente.empresa);
  const responsavel = clean(usuarioNome, 80);
  const assinatura = responsavel ? `\n\n${responsavel}` : "";
  const proposta = resumoOrcamentoCurto(orcamento);

  if (playbookId === "cobrar-retorno") {
    return `Ola, ${nome}. Tudo bem?\n\nEstou passando para acompanhar ${proposta}. Voce conseguiu avaliar ou existe algum ponto que eu possa esclarecer para ajudar na decisao?${assinatura}`;
  }
  if (playbookId === "pedir-dados") {
    return `Ola, ${nome}. Tudo bem?\n\nPara eu conseguir avancar corretamente com ${proposta}, preciso confirmar alguns dados que ainda ficaram pendentes. Pode me retornar com as informacoes que faltam ou me indicar quem consegue confirmar isso?${assinatura}`;
  }
  if (playbookId === "reativar") {
    return `Ola, ${nome}. Tudo bem?\n\nRetomando nosso contato para entender se essa demanda ainda esta em aberto e se faz sentido eu atualizar o acompanhamento por aqui. Caso tenha mudado alguma coisa, me envie o contexto atual que eu ajusto a tratativa.${assinatura}`;
  }
  if (playbookId === "pos-reuniao") {
    return `Ola, ${nome}. Obrigado pelo alinhamento.\n\nVou manter o acompanhamento de ${proposta} com base no que foi conversado. Se houver algum ajuste ou informacao complementar, pode me encaminhar por aqui para eu registrar corretamente.${assinatura}`;
  }
  return `Ola, ${nome}. Tudo bem?\n\nEstou confirmando se voce recebeu ${proposta} e se ficou alguma duvida para avaliacao. Se preferir, posso te ajudar com um resumo objetivo dos principais pontos.${assinatura}`;
}

function selecionarClientesCampanha(clientes = [], filtro = "retomar-atrasados", etiqueta = "") {
  const lista = Array.isArray(clientes) ? clientes : [];
  return lista.filter((cliente) => {
    const tags = combinarEtiquetas(cliente._tags, cliente.etiquetas);
    if (etiqueta && !tags.includes(etiqueta)) return false;
    if (filtro === "retomar-atrasados") return tags.includes("atrasado") || isAtrasado(cliente);
    if (filtro === "aquecer-quentes") return cliente.temperatura === "Quente" || tags.includes("cliente-quente") || tags.includes("bom-sinal");
    if (filtro === "confirmar-recebimento") return tags.includes("orcamento-aberto") || tags.includes("sem-historico");
    if (filtro === "pedir-documentos") return tags.includes("aguardando-documento");
    if (filtro === "reativar-sem-contato") return !cliente.proximoContato || tags.includes("sem-historico");
    return true;
  });
}

function criarCliente(usuarioAtual, dados = {}) {
  const agora = new Date().toISOString();
  return {
    id: dados.id || `cli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome: dados.nome || "",
    empresa: dados.empresa || "",
    cargo: dados.cargo || "",
    email: dados.email || "",
    email2: dados.email2 || "",
    telefone: dados.telefone || "",
    whatsapp: dados.whatsapp || "",
    telefone2: dados.telefone2 || "",
    documento: dados.documento || "",
    endereco: dados.endereco || "",
    cidadeUf: dados.cidadeUf || "",
    segmento: dados.segmento || "",
    decisor: dados.decisor || "",
    origem: dados.origem || "",
    canalPreferido: dados.canalPreferido || "WhatsApp",
    etiquetas: normalizarEtiquetas(dados.etiquetas),
    intencao: dados.intencao || "",
    objecao: dados.objecao || "",
    perfil: dados.perfil || "",
    status: dados.status || "Em acompanhamento",
    temperatura: dados.temperatura || "Morno",
    proximoContato: dados.proximoContato || "",
    valorPotencial: dados.valorPotencial || "",
    observacoes: dados.observacoes || "",
    proximoPasso: dados.proximoPasso || "",
    lembreteJade: dados.lembreteJade || "",
    jade: dados.jade || null,
    contatos: Array.isArray(dados.contatos) ? dados.contatos : [],
    orcamentosVinculados: Array.isArray(dados.orcamentosVinculados) ? dados.orcamentosVinculados : [],
    userId: dados.userId || usuarioAtual?.id || "admin",
    criadoEm: dados.criadoEm || agora,
    atualizadoEm: agora,
  };
}

const CAMPOS_AUDITORIA_CLIENTE = [
  ["nome", "Nome"],
  ["empresa", "Empresa"],
  ["cargo", "Cargo"],
  ["decisor", "Decisor"],
  ["whatsapp", "WhatsApp"],
  ["telefone", "Telefone"],
  ["telefone2", "Telefone alternativo"],
  ["email", "E-mail"],
  ["email2", "E-mail alternativo"],
  ["documento", "Documento"],
  ["endereco", "Endereco"],
  ["cidadeUf", "Cidade/UF"],
  ["segmento", "Segmento"],
  ["origem", "Origem"],
  ["canalPreferido", "Canal preferido"],
  ["etiquetas", "Etiquetas"],
  ["intencao", "Intencao"],
  ["objecao", "Objecao"],
  ["status", "Status"],
  ["temperatura", "Temperatura"],
  ["proximoContato", "Proximo contato"],
  ["valorPotencial", "Valor potencial"],
  ["perfil", "Perfil"],
  ["observacoes", "Observacoes"],
  ["proximoPasso", "Proximo passo"],
];

function valorAuditoria(valor = "") {
  return clean(valor, 140) || "(vazio)";
}

function descreverAlteracoesCliente(anterior = {}, atual = {}) {
  return CAMPOS_AUDITORIA_CLIENTE
    .map(([key, label]) => {
      const antes = valorAuditoria(anterior[key]);
      const depois = valorAuditoria(atual[key]);
      return antes === depois ? "" : `${label}: "${antes}" -> "${depois}"`;
    })
    .filter(Boolean)
    .slice(0, 24);
}

function criarRegistroSistemaCliente(usuarioAtual, dados = {}) {
  return {
    id: dados.id || `ct_sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    canal: dados.canal || "Sistema",
    direcao: dados.direcao || "Registro interno",
    tipo: dados.tipo || "Atualizacao",
    assunto: dados.assunto || "",
    mensagem: clean(dados.mensagem || "", 5000),
    orcamentoClienteId: dados.orcamentoClienteId || "",
    orcamentoId: dados.orcamentoId || "",
    orcamentoNumero: dados.orcamentoNumero || "",
    orcamentoTitulo: dados.orcamentoTitulo || "",
    criadoEm: dados.criadoEm || new Date().toISOString(),
    userId: dados.userId || usuarioAtual?.id || "admin",
    origem: dados.origem || "crm_cliente",
  };
}

function direcaoOrcamento(direcao = "") {
  const d = textoBusca(direcao);
  if (/cliente|entrada|receb/.test(d)) return "entrada";
  if (/intern|sistema|registro/.test(d)) return "interna";
  return "saida";
}

function registroClienteParaConversaOrcamento(registro = {}, usuarioAtual) {
  const mensagem = clean([registro.mensagem, registro.arquivoResumo ? `Anexo: ${registro.arquivoResumo}` : ""].filter(Boolean).join("\n"), 6000);
  return {
    id: `conv_${registro.id}`,
    followupId: registro.id,
    canal: registro.canal || "CRM",
    direcao: direcaoOrcamento(registro.direcao),
    tipo: registro.tipo || "CRM",
    mensagem,
    criadoEm: registro.criadoEm || new Date().toISOString(),
    origem: registro.origem || "crm_cliente",
    usuarioNome: usuarioAtual?.nome || usuarioAtual?.email || "",
    clienteId: registro.clienteId || "",
  };
}

function registroClienteParaFollowupOrcamento(registro = {}) {
  return {
    id: registro.id,
    tipo: registro.tipo || "CRM",
    canal: registro.canal || "CRM",
    conteudo: clean(registro.mensagem || registro.arquivoResumo || registro.assunto || "Registro comercial vinculado ao orcamento.", 6000),
    criadoEm: registro.criadoEm || new Date().toISOString(),
    origem: registro.origem || "crm_cliente",
  };
}

function telefoneKey(valor = "") {
  let d = String(valor || "").replace(/\D/g, "");
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  if (d.length > 11) d = d.slice(-11);
  return d;
}

function formatTelefoneImportado(valor = "") {
  return formatTelefone(telefoneKey(valor));
}

function valorVCard(linha = "") {
  const idx = linha.indexOf(":");
  let valor = idx >= 0 ? linha.slice(idx + 1) : linha;
  valor = valor.replace(/\\n/gi, " ").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\s+/g, " ").trim();
  if (/ENCODING=QUOTED-PRINTABLE/i.test(linha)) {
    try {
      valor = decodeURIComponent(valor.replace(/=([A-Fa-f0-9]{2})/g, "%$1"));
    } catch {
      valor = valor.replace(/=([A-Fa-f0-9]{2})/g, "");
    }
  }
  return clean(valor, 600);
}

function parseVCardContacts(texto = "") {
  const normal = String(texto || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n[ \t]/g, "");
  const blocos = normal.match(/BEGIN:VCARD[\s\S]*?END:VCARD/gi) || [];
  return blocos.map((bloco) => {
    const linhas = bloco.split("\n").map((l) => l.trim()).filter(Boolean);
    const tels = [];
    const emails = [];
    let nome = "";
    let empresa = "";
    let cargo = "";
    let endereco = "";
    for (const linha of linhas) {
      const tag = linha.split(/[;:]/)[0]?.toUpperCase();
      if (tag === "FN") nome = valorVCard(linha);
      if (!nome && tag === "N") nome = valorVCard(linha).split(";").filter(Boolean).join(" ");
      if (tag === "TEL") tels.push(valorVCard(linha));
      if (tag === "EMAIL") emails.push(valorVCard(linha));
      if (tag === "ORG") empresa = valorVCard(linha);
      if (tag === "TITLE") cargo = valorVCard(linha);
      if (tag === "ADR") endereco = valorVCard(linha).split(";").filter(Boolean).join(", ");
    }
    return { nome, empresa, cargo, telefone: tels[0] || "", telefone2: tels[1] || "", email: emails[0] || "", email2: emails[1] || "", endereco };
  }).filter((item) => item.nome || item.telefone || item.email);
}

function detectarSeparadorCsv(linha = "") {
  const candidatos = [";", ",", "\t"];
  return candidatos.sort((a, b) => linha.split(b).length - linha.split(a).length)[0];
}

function separarCsvLinha(linha = "", sep = ";") {
  const partes = [];
  let atual = "";
  let aspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const ch = linha[i];
    if (ch === '"' && linha[i + 1] === '"') {
      atual += '"';
      i += 1;
    } else if (ch === '"') {
      aspas = !aspas;
    } else if (ch === sep && !aspas) {
      partes.push(clean(atual, 1000));
      atual = "";
    } else {
      atual += ch;
    }
  }
  partes.push(clean(atual, 1000));
  return partes;
}

function parseCsvContacts(texto = "") {
  const linhas = String(texto || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n").filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = detectarSeparadorCsv(linhas[0]);
  const primeira = separarCsvLinha(linhas[0], sep);
  const pareceCabecalho = primeira.some((c) => /nome|name|email|e-mail|telefone|phone|whats|celular|empresa|company|org/i.test(c));
  const headers = pareceCabecalho ? primeira.map(textoBusca) : [];
  const dados = pareceCabecalho ? linhas.slice(1) : linhas;

  const pegar = (cols, nomes) => {
    const idx = headers.findIndex((h) => nomes.some((n) => h.includes(n)));
    return idx >= 0 ? cols[idx] || "" : "";
  };

  return dados.map((linha) => {
    const cols = separarCsvLinha(linha, sep);
    if (headers.length) {
      return {
        nome: pegar(cols, ["nome", "name", "contato", "cliente"]),
        empresa: pegar(cols, ["empresa", "company", "org", "organizacao"]),
        cargo: pegar(cols, ["cargo", "funcao", "title"]),
        telefone: pegar(cols, ["whatsapp", "telefone", "phone", "celular", "mobile", "tel"]),
        telefone2: pegar(cols, ["telefone 2", "phone 2", "celular 2"]),
        email: pegar(cols, ["email", "e-mail", "mail"]),
        endereco: pegar(cols, ["endereco", "address", "rua"]),
      };
    }
    const email = cols.find((c) => /\S+@\S+\.\S+/.test(c)) || "";
    const telefone = cols.find((c) => telefoneKey(c).length >= 8) || "";
    const nome = cols.find((c) => c && c !== email && c !== telefone) || "";
    return { nome, email, telefone };
  }).filter((item) => item.nome || item.telefone || item.email);
}

function enderecoContactPicker(valor) {
  const endereco = Array.isArray(valor) ? valor[0] : valor;
  if (!endereco) return "";
  if (typeof endereco === "string") return clean(endereco, 240);
  return clean([endereco.addressLine, endereco.city, endereco.region, endereco.country].flat().filter(Boolean).join(", "), 240);
}

function normalizarContatoImportado(usuarioAtual, raw = {}, origem = "Importado") {
  const nomes = Array.isArray(raw.name) ? raw.name : [raw.name || raw.nome || raw.fullName || raw.displayName || ""];
  const tels = Array.isArray(raw.tel) ? raw.tel : [raw.telefone || raw.phone || raw.whatsapp || "", raw.telefone2 || ""].filter(Boolean);
  const emails = Array.isArray(raw.email) ? raw.email : [raw.email || "", raw.email2 || ""].filter(Boolean);
  const nome = clean(nomes[0] || raw.nome || raw.empresa || "", 180);
  return criarCliente(usuarioAtual, {
    nome,
    empresa: clean(raw.empresa || raw.org || raw.company || "", 180),
    cargo: clean(raw.cargo || raw.title || "", 120),
    email: clean(emails[0] || "", 180),
    email2: clean(emails[1] || "", 180),
    telefone: formatTelefoneImportado(tels[0] || ""),
    whatsapp: formatTelefoneImportado(tels[0] || ""),
    telefone2: formatTelefoneImportado(tels[1] || ""),
    endereco: clean(raw.endereco || enderecoContactPicker(raw.address), 240),
    origem,
    status: "Em acompanhamento",
    temperatura: "Morno",
    observacoes: "Cadastro importado automaticamente. Conferir os dados antes do primeiro contato.",
  });
}

function chavesContato(cliente = {}) {
  const chaves = [];
  [cliente.email, cliente.email2].filter(Boolean).forEach((email) => chaves.push(`email:${clean(email).toLowerCase()}`));
  [cliente.whatsapp, cliente.telefone, cliente.telefone2].map(telefoneKey).filter((tel) => tel.length >= 8).forEach((tel) => chaves.push(`tel:${tel}`));
  const nome = textoBusca(cliente.nome || cliente.empresa || "");
  if (nome) chaves.push(`nome:${nome}`);
  return [...new Set(chaves)];
}

function scoreCliente(cliente = {}, orcamentos = []) {
  let score = 20;
  if (cliente.temperatura === "Quente") score += 25;
  if (cliente.temperatura === "Morno") score += 10;
  if (isAtrasado(cliente)) score += 30;
  if (isHoje(cliente)) score += 20;
  if (!cliente.proximoContato) score += 18;
  if (Array.isArray(cliente.contatos) && cliente.contatos.length) score += Math.min(18, cliente.contatos.length * 3);
  if (orcamentos.some((o) => isAtrasado(o))) score += 18;
  if (orcamentos.some((o) => normalizarStatus(o) !== "Finalizado")) score += 10;
  return Math.max(0, Math.min(100, score));
}

function nivelCliente(score) {
  if (score >= 78) return "Critico";
  if (score >= 58) return "Alta";
  if (score >= 36) return "Media";
  return "Baixa";
}

function alvoCliente(cliente = {}) {
  return textoBusca([cliente.nome, cliente.empresa, cliente.email, cliente.email2, cliente.telefone, cliente.whatsapp, cliente.documento].filter(Boolean).join(" "));
}

function clienteTemContatoReal(cliente = {}) {
  return Boolean(
    clean(cliente.whatsapp) ||
    clean(cliente.telefone) ||
    clean(cliente.telefone2) ||
    clean(cliente.email) ||
    clean(cliente.email2) ||
    clean(cliente.documento) ||
    clean(cliente.decisor) ||
    clean(cliente.cargo)
  );
}

function clienteCriadoApenasDeOrcamento(cliente = {}) {
  const origem = textoBusca(cliente.origem || "");
  const origemOrcamento = /\borcamento\b|\borc\b|proposta|cotacao/.test(origem);
  const semVinculoManual = !Array.isArray(cliente.orcamentosVinculados) || cliente.orcamentosVinculados.length === 0;
  return origemOrcamento && !clienteTemContatoReal(cliente) && semVinculoManual;
}

function clienteVisivelNoCRM(cliente = {}) {
  return !clienteCriadoApenasDeOrcamento(cliente);
}

function idsOrcamentosVinculados(cliente = {}) {
  return new Set((Array.isArray(cliente.orcamentosVinculados) ? cliente.orcamentosVinculados : []).map((item) => item.orcamentoId).filter(Boolean));
}

function orcamentosDoCliente(cliente = {}, crm = []) {
  const ids = idsOrcamentosVinculados(cliente);
  if (!cliente?.id && !ids.size) return [];
  return (Array.isArray(crm) ? crm : []).filter((item) => (
    (item?.id && ids.has(item.id)) ||
    item?.clienteVinculadoId === cliente.id ||
    item?.clienteCRMId === cliente.id
  ));
}

function orcamentosCompativeisCliente(cliente = {}, crm = []) {
  const alvo = alvoCliente(cliente);
  if (!alvo) return [];
  const ids = idsOrcamentosVinculados(cliente);
  return (Array.isArray(crm) ? crm : []).filter((item) => {
    if (item?.id && ids.has(item.id)) return false;
    if (item?.clienteVinculadoId || item?.clienteCRMId) return false;
    const clienteOrc = textoBusca(item?.cliente || "");
    const texto = textoBusca([item?.cliente, item?.empresaNome, item?.numero, item?.lembreteIA].filter(Boolean).join(" "));
    return texto.includes(alvo) || (clienteOrc && alvo.includes(clienteOrc));
  });
}

function criarOrcamentoVinculado(usuarioAtual, dados = {}) {
  const agora = new Date().toISOString();
  return {
    id: dados.id || `ocli_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    origem: dados.origem || "sistema",
    orcamentoId: dados.orcamentoId || "",
    numero: dados.numero || "",
    titulo: clean(dados.titulo || dados.cliente || dados.arquivoNome || "Orcamento sem titulo", 180),
    empresaNome: dados.empresaNome || "",
    valor: dados.valor || dados.valorGlobal || "",
    status: dados.status || "",
    resumo: clean(dados.resumo || dados.lembreteIA || dados.resumoConversas || "", 2200),
    arquivoNome: dados.arquivoNome || "",
    arquivoTipo: dados.arquivoTipo || "",
    arquivoTamanho: dados.arquivoTamanho || 0,
    arquivoTexto: clean(dados.arquivoTexto || "", 12000),
    arquivoResumo: clean(dados.arquivoResumo || "", 2200),
    arquivoDataUrl: dados.arquivoDataUrl || "",
    historico: Array.isArray(dados.historico) ? dados.historico : [],
    userId: dados.userId || usuarioAtual?.id || "admin",
    criadoEm: dados.criadoEm || agora,
    anexadoEm: dados.anexadoEm || agora,
    atualizadoEm: agora,
  };
}

function orcamentoDoSistemaParaCliente(orc = {}, usuarioAtual) {
  return criarOrcamentoVinculado(usuarioAtual, {
    origem: "sistema",
    orcamentoId: orc.id || "",
    numero: orc.numero || "",
    titulo: orc.cliente || orc.numero || "Orcamento do sistema",
    empresaNome: orc.empresaNome || "",
    valor: orc.valorGlobal || orc.valor || "",
    status: orc.status || "",
    resumo: orc.lembreteIA || orc.resumoConversas || orc.descricao || "",
    criadoEm: orc.criadoEm || new Date().toISOString(),
  });
}

function lerArquivoComoDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Falha ao ler arquivo."));
    reader.readAsDataURL(file);
  });
}

function inputStyle() {
  return {
    background: C.panel2,
    border: `1px solid ${C.border2}`,
    borderRadius: 10,
    padding: "10px 12px",
    color: C.text,
    fontSize: 12,
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
    fontFamily: "inherit",
  };
}

export function ClientesCRMPanel({
  clientes = [],
  setClientes,
  crm = [],
  setCrm,
  empresas = [],
  pushToast,
  usuarioAtual,
  lerTextoPDF,
  imagemParaLeitura,
}) {
  const isAdmin = usuarioAtual?.tipo === "admin";
  const base = useMemo(
    () => (isAdmin ? clientes : clientes.filter((item) => item.userId === usuarioAtual?.id)).filter(clienteVisivelNoCRM),
    [clientes, isAdmin, usuarioAtual?.id]
  );
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [filtroEtiqueta, setFiltroEtiqueta] = useState("");
  const [ativoId, setAtivoId] = useState(base[0]?.id || "");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState(criarCliente(usuarioAtual));
  const [contato, setContato] = useState({
    canal: "WhatsApp",
    direcao: "Cliente respondeu",
    tipo: "Follow-up",
    assunto: "",
    mensagem: "",
    orcamentoId: "",
    orcamentoClienteId: "",
  });
  const [buscaOrcamento, setBuscaOrcamento] = useState("");
  const [orcamentoSistemaId, setOrcamentoSistemaId] = useState("");
  const [orcamentoAtivoId, setOrcamentoAtivoId] = useState("");
  const [anexo, setAnexo] = useState(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [lendoOrcamentoArquivo, setLendoOrcamentoArquivo] = useState(false);
  const [jadeLoading, setJadeLoading] = useState(false);
  const [pedidoJade, setPedidoJade] = useState("Nara, leia este cliente e me diga o melhor proximo passo para aumentar a chance de fechamento.");
  const [whatsRelatorio, setWhatsRelatorio] = useState(WHATS_REPORT_NUMBER);
  const [campanhaFiltro, setCampanhaFiltro] = useState("retomar-atrasados");
  const [campanhaPlaybook, setCampanhaPlaybook] = useState("cobrar-retorno");
  const [campanhaResultados, setCampanhaResultados] = useState([]);
  const refArquivo = useRef(null);
  const refArquivoOrcamento = useRef(null);
  const refImportarContatos = useRef(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const salvo = await store.get(WHATS_REPORT_STORAGE_KEY);
      if (ativo && typeof salvo === "string" && salvo.trim()) setWhatsRelatorio(salvo);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const enriquecidos = useMemo(() => {
    return base.map((item) => {
      const sugestoesPorNome = orcamentosCompativeisCliente(item, crm);
      const vinculadosExplicitos = Array.isArray(item.orcamentosVinculados) ? item.orcamentosVinculados : [];
      const sugestoesNaoVinculadas = sugestoesPorNome.filter((orc) => !vinculadosExplicitos.some((v) => v.orcamentoId === orc.id));
      const score = scoreCliente(item, vinculadosExplicitos);
      const baseOrcamentos = vinculadosExplicitos;
      const tags = combinarEtiquetas(item.etiquetas, sugerirEtiquetasCliente(item, baseOrcamentos));
      return {
        ...item,
        _orcamentos: vinculadosExplicitos,
        _orcamentosSugeridos: sugestoesNaoVinculadas,
        _score: score,
        _nivel: nivelCliente(score),
        _tags: tags,
        _playbook: sugerirPlaybookCliente(item, baseOrcamentos),
      };
    }).sort((a, b) => b._score - a._score);
  }, [base, crm]);

  const kpis = useMemo(() => {
    const abertos = enriquecidos.filter((item) => !/fechad|perdid/i.test(textoBusca(item.status))).length;
    const quentes = enriquecidos.filter((item) => item.temperatura === "Quente").length;
    const atrasados = enriquecidos.filter(isAtrasado).length;
    const semContato = enriquecidos.filter((item) => !item.proximoContato).length;
    return { abertos, quentes, atrasados, semContato };
  }, [enriquecidos]);

  const filtrados = useMemo(() => {
    const q = textoBusca(busca);
    return enriquecidos.filter((item) => {
      const texto = textoBusca([item.nome, item.empresa, item.email, item.email2, item.telefone, item.whatsapp, item.documento, item.cidadeUf, item.status, item.proximoPasso, item.lembreteJade, item.canalPreferido, ...(item._tags || [])].join(" "));
      const matchBusca = !q || texto.includes(q);
      const matchFiltro =
        filtro === "todos" ||
        (filtro === "quentes" && item.temperatura === "Quente") ||
        (filtro === "atrasados" && isAtrasado(item)) ||
        (filtro === "hoje" && isHoje(item)) ||
        (filtro === "sem-contato" && !item.proximoContato) ||
        (filtro === "sem-whatsapp" && !item.whatsapp && !item.telefone);
      const matchEtiqueta = !filtroEtiqueta || (item._tags || []).includes(filtroEtiqueta);
      return matchBusca && matchFiltro && matchEtiqueta;
    });
  }, [enriquecidos, busca, filtro, filtroEtiqueta]);

  const etiquetasDisponiveis = useMemo(() => {
    const usadas = new Set(enriquecidos.flatMap((item) => item._tags || []));
    return ETIQUETAS_PADRAO.filter(([id]) => usadas.has(id));
  }, [enriquecidos]);

  const ativo = enriquecidos.find((item) => item.id === ativoId) || filtrados[0] || null;
  const relacionados = useMemo(() => (ativo ? orcamentosDoCliente(ativo, crm) : []), [ativo, crm]);
  const contatosAtivo = Array.isArray(ativo?.contatos) ? ativo.contatos : [];
  const orcamentosVinculadosAtivo = useMemo(
    () => (Array.isArray(ativo?.orcamentosVinculados) ? ativo.orcamentosVinculados : []),
    [ativo?.orcamentosVinculados]
  );
  const orcamentoAtivo = orcamentosVinculadosAtivo.find((item) => item.id === orcamentoAtivoId) || orcamentosVinculadosAtivo[0] || null;
  const opcoesOrcamentoSistema = useMemo(() => {
    const q = textoBusca(buscaOrcamento);
    const jaVinculados = new Set(orcamentosVinculadosAtivo.map((item) => item.orcamentoId).filter(Boolean));
    return (Array.isArray(crm) ? crm : [])
      .filter((orc) => {
        if (orc?.id && jaVinculados.has(orc.id)) return false;
        if (orc?.clienteVinculadoId && orc.clienteVinculadoId !== ativo?.id) return false;
        const texto = textoBusca([orc?.numero, orc?.cliente, orc?.empresaNome, orc?.status, orc?.lembreteIA].filter(Boolean).join(" "));
        return !q || texto.includes(q);
      })
      .slice(0, 30);
  }, [crm, buscaOrcamento, orcamentosVinculadosAtivo, ativo?.id]);

  const clientesCampanha = useMemo(
    () => selecionarClientesCampanha(filtrados, campanhaFiltro, filtroEtiqueta).slice(0, 25),
    [filtrados, campanhaFiltro, filtroEtiqueta]
  );

  useEffect(() => {
    if (!ativoId && filtrados[0]?.id) setAtivoId(filtrados[0].id);
  }, [ativoId, filtrados]);

  useEffect(() => {
    if (ativo && !editando) setForm(criarCliente(usuarioAtual, ativo));
  }, [ativo?.id, editando, usuarioAtual]);

  useEffect(() => {
    setOrcamentoAtivoId("");
    setOrcamentoSistemaId("");
    setContato((atual) => ({ ...atual, orcamentoClienteId: "", orcamentoId: "" }));
  }, [ativo?.id]);

  const salvarLista = async (nova) => {
    setClientes(nova);
    const ok = await store.set(KEY_CLIENTES, nova);
    if (!ok) pushToast("Nao foi possivel salvar clientes na nuvem.", "erro");
    return ok;
  };

  const salvarOrcamentosGlobais = async (nova) => {
    if (typeof setCrm === "function") setCrm(nova);
    const ok = await store.set(KEY_ORCAMENTOS, nova);
    if (!ok) pushToast("Nao foi possivel atualizar o historico do orcamento na nuvem.", "erro");
    return ok;
  };

  const adicionarRegistrosHistoricoOrcamentos = async (pares = []) => {
    const validos = pares.filter((par) => par?.orcamentoId && par?.registro);
    if (!validos.length) return false;
    let mudou = false;
    const porOrcamento = validos.reduce((mapa, par) => {
      const lista = mapa.get(par.orcamentoId) || [];
      lista.push(par.registro);
      mapa.set(par.orcamentoId, lista);
      return mapa;
    }, new Map());

    const nova = (Array.isArray(crm) ? crm : []).map((orc) => {
      const registros = porOrcamento.get(orc.id);
      const patches = validos.filter((par) => par?.orcamentoId === orc.id && par.patch).map((par) => par.patch);
      if (!registros?.length && !patches.length) return orc;
      let conversas = Array.isArray(orc.conversas) ? [...orc.conversas] : [];
      let followups = Array.isArray(orc.followups) ? [...orc.followups] : [];
      let itemMudou = Boolean(patches.length);

      for (const registro of registros || []) {
        const existeConversa = conversas.some((msg) => msg.followupId === registro.id || msg.id === `conv_${registro.id}`);
        const existeFollowup = followups.some((msg) => msg.id === registro.id);
        if (!existeConversa) {
          conversas = [registroClienteParaConversaOrcamento(registro, usuarioAtual), ...conversas].slice(0, 120);
          itemMudou = true;
        }
        if (!existeFollowup) {
          followups = [registroClienteParaFollowupOrcamento(registro), ...followups].slice(0, 60);
          itemMudou = true;
        }
      }

      if (!itemMudou) return orc;
      mudou = true;
      const ultimo = registros?.[0] || {};
      return {
        ...orc,
        ...Object.assign({}, ...patches),
        conversas,
        followups,
        ultimoContatoEm: ultimo.criadoEm || new Date().toISOString(),
        lembreteIA: ultimo.mensagem ? clean(ultimo.mensagem, 260) : orc.lembreteIA,
        atualizadoEm: new Date().toISOString(),
      };
    });

    if (mudou) await salvarOrcamentosGlobais(nova);
    return mudou;
  };

  const registrarHistoricoOrcamentoGlobal = async (orcamentoId, registro) => {
    return adicionarRegistrosHistoricoOrcamentos([{ orcamentoId, registro }]);
  };

  const novoCliente = () => {
    setForm(criarCliente(usuarioAtual));
    setAtivoId("");
    setEditando(true);
  };

  const editarCliente = () => {
    if (ativo) setForm(criarCliente(usuarioAtual, ativo));
    setEditando(true);
  };

  const cancelarEdicao = () => {
    if (ativo) {
      setForm(criarCliente(usuarioAtual, ativo));
    } else {
      setForm(criarCliente(usuarioAtual));
    }
    setEditando(false);
  };

  const salvarCliente = async () => {
    const nome = clean(form.nome || form.empresa, 180);
    if (!nome) {
      pushToast("Informe ao menos o nome do contato ou empresa.", "erro");
      return;
    }
    let pronto = criarCliente(usuarioAtual, { ...form, nome });
    const anterior = clientes.find((item) => item.id === pronto.id);
    const existe = Boolean(anterior);
    if (existe) {
      const alteracoes = descreverAlteracoesCliente(anterior, pronto);
      if (alteracoes.length) {
        const registro = criarRegistroSistemaCliente(usuarioAtual, {
          tipo: "Perfil atualizado",
          assunto: "Cadastro do cliente",
          mensagem: `Campos atualizados no perfil: ${alteracoes.join("; ")}`,
        });
        pronto = { ...pronto, contatos: [registro, ...(Array.isArray(pronto.contatos) ? pronto.contatos : [])].slice(0, 160) };
      }
    } else {
      const registro = criarRegistroSistemaCliente(usuarioAtual, {
        tipo: "Cliente criado",
        assunto: "Novo cadastro CRM",
        mensagem: `Cliente criado no CRM: ${nome}. Origem: ${clean(pronto.origem || "Cadastro manual", 120)}.`,
      });
      pronto = { ...pronto, contatos: [registro, ...(Array.isArray(pronto.contatos) ? pronto.contatos : [])].slice(0, 160) };
    }
    const nova = existe ? clientes.map((item) => (item.id === pronto.id ? pronto : item)) : [pronto, ...clientes];
    await salvarLista(nova);
    setAtivoId(pronto.id);
    setEditando(false);
    pushToast("Cliente salvo no CRM.", "ok");
  };

  const excluirCliente = async () => {
    if (!ativo) return;
    const nova = clientes.filter((item) => item.id !== ativo.id);
    await salvarLista(nova);
    setAtivoId(nova[0]?.id || "");
    setEditando(false);
    pushToast("Cliente removido do CRM.", "aviso");
  };

  const atualizarCliente = async (patch) => {
    if (!ativo) return null;
    const { _orcamentos, _score, _nivel, _tags, _playbook, ...persistivel } = ativo;
    const atualizado = { ...persistivel, ...patch, atualizadoEm: new Date().toISOString() };
    await salvarLista(clientes.map((item) => (item.id === ativo.id ? atualizado : item)));
    setForm(criarCliente(usuarioAtual, atualizado));
    return atualizado;
  };

  const aplicarEtiquetasInteligentes = async (somenteAtivo = true) => {
    if (somenteAtivo && !ativo) return;
    const ids = somenteAtivo && ativo ? new Set([ativo.id]) : new Set(filtrados.map((item) => item.id));
    let alterados = 0;
    const nova = clientes.map((cliente) => {
      if (!ids.has(cliente.id)) return cliente;
      const orcs = orcamentosDoCliente(cliente, crm);
      const etiquetas = combinarEtiquetas(cliente.etiquetas, sugerirEtiquetasCliente(cliente, orcs));
      if (etiquetas.join("|") === normalizarEtiquetas(cliente.etiquetas).join("|")) return cliente;
      alterados += 1;
      return { ...cliente, etiquetas, atualizadoEm: new Date().toISOString() };
    });
    if (!alterados) {
      pushToast("As etiquetas ja estavam atualizadas.", "aviso");
      return;
    }
    await salvarLista(nova);
    pushToast(`${alterados} cliente(s) atualizado(s) com etiquetas inteligentes.`, "ok");
  };

  const prepararPlaybook = (playbookId = ativo?._playbook || "confirmar-recebimento") => {
    if (!ativo) return;
    const playbook = PLAYBOOKS_ASSISTIDOS.find((item) => item.id === playbookId) || PLAYBOOKS_ASSISTIDOS[0];
    const orc = orcamentoAtivo || orcamentosVinculadosAtivo[0] || null;
    const mensagem = montarMensagemAssistida({
      cliente: ativo,
      orcamento: orc,
      playbookId,
      usuarioNome: usuarioAtual?.nomeTratamento || usuarioAtual?.nome || usuarioAtual?.email || "",
    });
    setContato((atual) => ({
      ...atual,
      canal: ativo.canalPreferido || "WhatsApp",
      direcao: "Empresa enviou",
      tipo: playbook.tipo,
      assunto: playbook.assunto,
      mensagem,
      orcamentoClienteId: orcamentoAtivo?.id || orcamentosVinculadosAtivo[0]?.id || atual.orcamentoClienteId || "",
      orcamentoId: orcamentoAtivo?.orcamentoId || orcamentosVinculadosAtivo[0]?.orcamentoId || atual.orcamentoId || "",
    }));
    pushToast("Playbook preparado no registro de contato. Revise antes de enviar.", "ok");
  };

  const registrarAcaoAssistida = async (clienteId, texto = "", acao = "Mensagem assistida") => {
    const cliente = clientes.find((item) => item.id === clienteId);
    if (!cliente) return;
    const registro = criarRegistroSistemaCliente(usuarioAtual, {
      canal: "Nara",
      direcao: "Registro interno",
      tipo: acao,
      assunto: "Manychat assistido gratuito",
      mensagem: `Acao assistida preparada. Texto:\n${clean(texto, 1800)}`,
      origem: "crm_manychat_assistido",
    });
    const atualizado = {
      ...cliente,
      contatos: [registro, ...(Array.isArray(cliente.contatos) ? cliente.contatos : [])].slice(0, 160),
      atualizadoEm: new Date().toISOString(),
    };
    await salvarLista(clientes.map((item) => (item.id === clienteId ? atualizado : item)));
  };

  const gerarCampanhaAssistida = () => {
    if (!clientesCampanha.length) {
      pushToast("Nenhum cliente encontrado para esta campanha.", "aviso");
      return;
    }
    const resultados = clientesCampanha.slice(0, 15).map((cliente) => {
      const orc = (Array.isArray(cliente.orcamentosVinculados) ? cliente.orcamentosVinculados[0] : null) || null;
      return {
        clienteId: cliente.id,
        nome: cliente.nome || cliente.empresa || "Cliente",
        whatsapp: cliente.whatsapp || cliente.telefone || "",
        tags: cliente._tags || [],
        texto: montarMensagemAssistida({
          cliente,
          orcamento: orc,
          playbookId: campanhaPlaybook,
          usuarioNome: usuarioAtual?.nomeTratamento || usuarioAtual?.nome || usuarioAtual?.email || "",
        }),
      };
    });
    setCampanhaResultados(resultados);
    pushToast(`${resultados.length} mensagem(ns) preparada(s). Envio continua manual.`, "ok");
  };

  const abrirWhatsCliente = async (cliente, texto = "") => {
    const numero = normalizarNumeroWhats(cliente?.whatsapp || cliente?.telefone || "");
    if (!numero) {
      pushToast("Este cliente nao tem WhatsApp/telefone cadastrado.", "aviso");
      return;
    }
    await registrarAcaoAssistida(cliente.id, texto, "WhatsApp assistido aberto");
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto)}`, "_blank", "noopener,noreferrer");
    pushToast("WhatsApp externo aberto. Revise e envie manualmente.", "ok");
  };

  const copiarCampanha = async (clienteId, texto = "") => {
    await copiarTexto(texto);
    await registrarAcaoAssistida(clienteId, texto, "Mensagem assistida copiada");
  };

  const vincularOrcamentoSistema = async () => {
    if (!ativo) {
      pushToast("Selecione ou crie um cliente primeiro.", "erro");
      return;
    }
    const orc = crm.find((item) => item.id === orcamentoSistemaId);
    if (!orc) {
      pushToast("Pesquise e selecione um orcamento do sistema.", "aviso");
      return;
    }
    if (orcamentosVinculadosAtivo.some((item) => item.orcamentoId === orc.id)) {
      pushToast("Este orcamento ja esta vinculado ao cliente.", "aviso");
      return;
    }
    if (orc.clienteVinculadoId && orc.clienteVinculadoId !== ativo.id) {
      pushToast("Este orcamento ja esta vinculado a outro cliente.", "erro");
      return;
    }
    const registro = criarRegistroSistemaCliente(usuarioAtual, {
      tipo: "Orcamento vinculado",
      assunto: orc.numero || "Orcamento do sistema",
      mensagem: `Orcamento ${orc.numero || orc.id || ""} vinculado ao perfil do cliente ${ativo.nome || ativo.empresa || ""}. Valor: ${brl(orc.valorGlobal || orc.valor)}.`,
      orcamentoId: orc.id,
      orcamentoNumero: orc.numero || "",
    });
    const vinculo = {
      ...orcamentoDoSistemaParaCliente(orc, usuarioAtual),
      historico: [registro],
      atualizadoEm: new Date().toISOString(),
    };
    await atualizarCliente({
      contatos: [registro, ...contatosAtivo].slice(0, 160),
      orcamentosVinculados: [vinculo, ...orcamentosVinculadosAtivo].slice(0, 80),
    });
    await adicionarRegistrosHistoricoOrcamentos([{
      orcamentoId: orc.id,
      registro,
      patch: {
        clienteVinculadoId: ativo.id,
        clienteCRMId: ativo.id,
        clienteVinculadoNome: ativo.nome || ativo.empresa || "",
        clienteSugeridoId: "",
        clienteSugeridoNome: "",
        clienteSugeridoScore: 0,
      },
    }]);
    setOrcamentoAtivoId(vinculo.id);
    setContato((atual) => ({ ...atual, orcamentoClienteId: vinculo.id, orcamentoId: vinculo.orcamentoId }));
    setOrcamentoSistemaId("");
    pushToast("Orcamento do sistema vinculado ao perfil do cliente.", "ok");
  };

  const anexarOrcamentoArquivo = async (file) => {
    if (!file || !ativo) return;
    const limiteMB = 8;
    if (file.size > limiteMB * 1024 * 1024) {
      pushToast(`Arquivo muito grande. Limite para orcamento externo: ${limiteMB} MB.`, "erro");
      return;
    }
    setLendoOrcamentoArquivo(true);
    try {
      const nome = file.name || "orcamento-anexo";
      const tipo = file.type || "";
      let textoArquivo = "";
      let dataUrl = "";
      const podeGuardarArquivo = file.size <= 2.2 * 1024 * 1024;

      if (/\.pdf$/i.test(nome) || tipo === "application/pdf") {
        textoArquivo = lerTextoPDF ? clean(await lerTextoPDF(file, { maxPages: 8, maxChars: 12000 }), 12000) : "";
      } else if (/^image\//i.test(tipo) || /\.(png|jpe?g|webp)$/i.test(nome)) {
        textoArquivo = "Imagem de orcamento anexada. A Nara deve usar apenas o que estiver descrito no historico ou extraido manualmente.";
      } else if (/^text\//i.test(tipo) || /\.(txt|csv|md)$/i.test(nome)) {
        textoArquivo = clean(await file.text(), 12000);
      }

      if (podeGuardarArquivo) {
        dataUrl = await lerArquivoComoDataUrl(file);
      }

      const vinculo = criarOrcamentoVinculado(usuarioAtual, {
        origem: "arquivo",
        titulo: nome.replace(/\.[^.]+$/, ""),
        arquivoNome: nome,
        arquivoTipo: tipo,
        arquivoTamanho: file.size,
        arquivoTexto: textoArquivo,
        arquivoResumo: textoArquivo ? clean(textoArquivo, 1600) : "Arquivo anexado sem texto pesquisavel. Nenhuma informacao foi inventada.",
        arquivoDataUrl: dataUrl,
        resumo: textoArquivo ? clean(textoArquivo, 1600) : "",
      });

      await atualizarCliente({
        orcamentosVinculados: [vinculo, ...orcamentosVinculadosAtivo].slice(0, 80),
      });
      setOrcamentoAtivoId(vinculo.id);
      setContato((atual) => ({ ...atual, orcamentoClienteId: vinculo.id, orcamentoId: "" }));
      pushToast(podeGuardarArquivo ? "Orcamento externo anexado ao cliente." : "Orcamento indexado pelo nome/texto. Arquivo grande nao foi embutido no banco.", "ok");
    } catch (error) {
      console.error("Erro ao anexar orcamento ao cliente:", error);
      pushToast(error.message || "Nao foi possivel anexar o orcamento.", "erro");
    } finally {
      setLendoOrcamentoArquivo(false);
    }
  };

  const removerOrcamentoVinculado = async (orcamentoClienteId) => {
    if (!ativo) return;
    const alvo = orcamentosVinculadosAtivo.find((item) => item.id === orcamentoClienteId);
    if (!alvo) return;
    if (!window.confirm(`Remover o vinculo "${alvo.numero || alvo.titulo || alvo.arquivoNome}" deste cliente?`)) return;
    await atualizarCliente({
      orcamentosVinculados: orcamentosVinculadosAtivo.filter((item) => item.id !== orcamentoClienteId),
    });
    if (alvo.orcamentoId) {
      await salvarOrcamentosGlobais((Array.isArray(crm) ? crm : []).map((orc) => orc.id === alvo.orcamentoId ? {
        ...orc,
        clienteVinculadoId: "",
        clienteCRMId: "",
        clienteVinculadoNome: "",
        atualizadoEm: new Date().toISOString(),
      } : orc));
    }
    setOrcamentoAtivoId("");
    setContato((atual) => atual.orcamentoClienteId === orcamentoClienteId ? { ...atual, orcamentoClienteId: "", orcamentoId: "" } : atual);
    pushToast("Vinculo de orcamento removido do cliente.", "aviso");
  };

  const sincronizarOrcamentos = async () => {
    if (!ativo) {
      pushToast("Selecione um cliente para buscar orcamentos compativeis.", "aviso");
      return;
    }
    const termo = clean(ativo.nome || ativo.empresa || "", 120);
    setBuscaOrcamento(termo);
    const sugestoes = (Array.isArray(ativo._orcamentosSugeridos) ? ativo._orcamentosSugeridos : []).length;
    pushToast(sugestoes ? `${sugestoes} orcamento(s) compativel(is) encontrado(s). Revise e clique em Vincular.` : "Busca preenchida. Revise a lista e vincule manualmente se fizer sentido.", "ok");
  };

  const salvarContatosImportados = async (lista = [], origem = "Importacao de contatos") => {
    const existentes = new Set(clientes.flatMap(chavesContato));
    const novos = [];
    let ignorados = 0;

    for (const item of lista) {
      const pronto = normalizarContatoImportado(usuarioAtual, item, origem);
      const temDadoUtil = pronto.nome || pronto.email || pronto.whatsapp || pronto.telefone;
      if (!temDadoUtil) continue;
      const chaves = chavesContato(pronto);
      if (chaves.some((chave) => existentes.has(chave))) {
        ignorados += 1;
        continue;
      }
      chaves.forEach((chave) => existentes.add(chave));
      novos.push(pronto);
    }

    if (!novos.length) {
      pushToast(ignorados ? "Nenhum contato novo encontrado. Os contatos importados ja existem no CRM." : "Nenhum contato valido foi encontrado.", "aviso");
      return;
    }

    await salvarLista([...novos, ...clientes]);
    setAtivoId(novos[0].id);
    pushToast(`${novos.length} contato(s) importado(s). ${ignorados ? `${ignorados} duplicado(s) ignorado(s).` : ""}`.trim(), "ok");
  };

  const importarContatosDoAparelho = async () => {
    const picker = typeof navigator !== "undefined" ? navigator.contacts : null;
    if (!picker?.select) {
      pushToast("Este navegador nao permite ler contatos direto. Importe um arquivo .vcf ou .csv exportado do celular.", "aviso");
      refImportarContatos.current?.click();
      return;
    }

    try {
      const contatos = await picker.select(["name", "email", "tel", "address"], { multiple: true });
      await salvarContatosImportados(contatos, "Importado do aparelho celular");
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error("Erro ao importar contatos do aparelho:", error);
      pushToast("O celular bloqueou o acesso aos contatos. Use a opcao de importar .vcf/.csv.", "aviso");
      refImportarContatos.current?.click();
    }
  };

  const importarArquivoContatos = async (file) => {
    if (!file) return;
    const limiteMB = 15;
    if (file.size > limiteMB * 1024 * 1024) {
      pushToast(`Arquivo de contatos muito grande. Limite: ${limiteMB} MB.`, "erro");
      return;
    }

    try {
      const texto = await file.text();
      const nome = file.name || "contatos";
      const lista = /\.vcf|text\/vcard/i.test(`${nome} ${file.type || ""}`) ? parseVCardContacts(texto) : parseCsvContacts(texto);
      await salvarContatosImportados(lista, `Arquivo ${nome}`);
    } catch (error) {
      console.error("Erro ao importar arquivo de contatos:", error);
      pushToast(error.message || "Nao foi possivel importar o arquivo de contatos.", "erro");
    }
  };

  const prepararArquivo = async (file) => {
    if (!file) return;
    const limiteMB = 8;
    if (file.size > limiteMB * 1024 * 1024) {
      pushToast(`Arquivo muito grande. Limite para historico: ${limiteMB} MB.`, "erro");
      return;
    }
    setLendoArquivo(true);
    try {
      const nome = file.name || "arquivo";
      const tipo = file.type || "";
      let preview = "";
      let textoArquivo = "";

      if (/^image\//i.test(tipo) || /\.(png|jpe?g|webp)$/i.test(nome)) {
        preview = imagemParaLeitura ? await imagemParaLeitura(file) : "";
        if (preview.length > 650000) preview = "";
        textoArquivo = "Imagem/print anexado para leitura da Nara.";
      } else if (/\.pdf$/i.test(nome) || tipo === "application/pdf") {
        textoArquivo = lerTextoPDF ? clean(await lerTextoPDF(file, { maxPages: 6, maxChars: 9000 }), 9000) : "";
      } else if (/^text\//i.test(tipo) || /\.(txt|csv|md)$/i.test(nome)) {
        textoArquivo = clean(await file.text(), 9000);
      }

      setAnexo({
        arquivoNome: nome,
        arquivoTipo: tipo,
        arquivoTamanho: file.size,
        arquivoPreview: preview,
        arquivoTexto: textoArquivo,
        arquivoResumo: textoArquivo ? clean(textoArquivo, 1200) : "Arquivo anexado sem texto extraivel; usar como referencia do historico.",
      });
      pushToast("Arquivo anexado ao contato. Salve a conversa para gravar no historico.", "ok");
    } catch (error) {
      console.error("Erro ao anexar arquivo no CRM:", error);
      pushToast(error.message || "Nao foi possivel ler o arquivo.", "erro");
    } finally {
      setLendoArquivo(false);
    }
  };

  const salvarContato = async () => {
    if (!ativo) {
      pushToast("Selecione ou crie um cliente primeiro.", "erro");
      return;
    }
    if (!clean(contato.mensagem) && !anexo) {
      pushToast("Escreva uma mensagem ou anexe um arquivo.", "erro");
      return;
    }

    const orcamentoCliente = orcamentosVinculadosAtivo.find((item) => item.id === contato.orcamentoClienteId);
    const orc = orcamentoCliente?.orcamentoId ? crm.find((item) => item.id === orcamentoCliente.orcamentoId) : null;
    const registro = {
      id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      canal: contato.canal,
      direcao: contato.direcao,
      tipo: contato.tipo,
      assunto: contato.assunto,
      mensagem: clean(contato.mensagem, 5000),
      orcamentoClienteId: contato.orcamentoClienteId || "",
      orcamentoId: orcamentoCliente?.orcamentoId || "",
      orcamentoNumero: orcamentoCliente?.numero || orc?.numero || "",
      orcamentoTitulo: orcamentoCliente?.titulo || "",
      ...anexo,
      criadoEm: new Date().toISOString(),
      userId: usuarioAtual?.id || "admin",
    };
    const orcamentosAtualizados = orcamentosVinculadosAtivo.map((item) => (
      item.id === contato.orcamentoClienteId
        ? { ...item, historico: [registro, ...(Array.isArray(item.historico) ? item.historico : [])].slice(0, 140), atualizadoEm: new Date().toISOString() }
        : item
    ));

    await atualizarCliente({
      contatos: [registro, ...contatosAtivo].slice(0, 140),
      orcamentosVinculados: orcamentosAtualizados,
      proximoPasso: ativo.proximoPasso || "Nara pode analisar este historico e sugerir o proximo passo.",
      etiquetas: combinarEtiquetas(ativo.etiquetas, etiquetasPorTexto([registro.tipo, registro.assunto, registro.mensagem, registro.arquivoResumo].filter(Boolean).join(" "))),
    });
    if (orcamentoCliente?.orcamentoId) {
      await registrarHistoricoOrcamentoGlobal(orcamentoCliente.orcamentoId, registro);
    }
    setContato({ canal: "WhatsApp", direcao: "Cliente respondeu", tipo: "Follow-up", assunto: "", mensagem: "", orcamentoId: "", orcamentoClienteId: "" });
    setAnexo(null);
    pushToast(orcamentoCliente ? "Contato salvo no historico do cliente e deste orcamento." : "Contato salvo no historico geral do cliente.", "ok");
  };

  const chamarJade = async (pedido = pedidoJade) => {
    if (!ativo || jadeLoading) return;
    setJadeLoading(true);
    try {
      const imagemRecente = contatosAtivo.find((msg) => msg.arquivoPreview)?.arquivoPreview || "";
      const response = await fetch("/api/client-crm-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          usuarioNome: usuarioAtual?.nomeTratamento || usuarioAtual?.nome || usuarioAtual?.email || "responsavel",
          cliente: {
            nome: ativo.nome,
            empresa: ativo.empresa,
            cargo: ativo.cargo,
            email: ativo.email,
            email2: ativo.email2,
            telefone: ativo.telefone,
            whatsapp: ativo.whatsapp,
            telefone2: ativo.telefone2,
            documento: ativo.documento,
            endereco: ativo.endereco,
            cidadeUf: ativo.cidadeUf,
            segmento: ativo.segmento,
            decisor: ativo.decisor,
            origem: ativo.origem,
            canalPreferido: ativo.canalPreferido,
            etiquetas: ativo._tags || ativo.etiquetas || [],
            intencao: ativo.intencao,
            objecao: ativo.objecao,
            perfil: ativo.perfil,
            status: ativo.status,
            temperatura: ativo.temperatura,
            proximoContato: ativo.proximoContato,
            valorPotencial: ativo.valorPotencial,
            observacoes: clean(ativo.observacoes, 1600),
          },
          contatos: contatosAtivo.slice(0, 35).map((msg) => ({
            canal: msg.canal,
            direcao: msg.direcao,
            tipo: msg.tipo,
            assunto: msg.assunto,
            mensagem: clean(msg.mensagem, 1800),
            orcamentoClienteId: msg.orcamentoClienteId,
            orcamentoId: msg.orcamentoId,
            orcamentoNumero: msg.orcamentoNumero,
            orcamentoTitulo: msg.orcamentoTitulo,
            arquivoNome: msg.arquivoNome,
            arquivoTipo: msg.arquivoTipo,
            arquivoTamanho: msg.arquivoTamanho,
            arquivoResumo: clean(msg.arquivoResumo || msg.arquivoTexto, 1600),
            criadoEm: msg.criadoEm,
          })),
          orcamentos: orcamentosVinculadosAtivo.length
            ? orcamentosVinculadosAtivo.map((orc) => ({
              id: orc.id,
              origem: orc.origem,
              numero: orc.numero,
              titulo: orc.titulo,
              empresaNome: orc.empresaNome,
              valor: orc.valor,
              status: orc.status,
              resumo: clean(orc.resumo || orc.arquivoResumo || orc.arquivoTexto, 1800),
              historico: (Array.isArray(orc.historico) ? orc.historico : []).slice(0, 20).map((msg) => ({
                canal: msg.canal,
                tipo: msg.tipo,
                assunto: msg.assunto,
                mensagem: clean(msg.mensagem, 1400),
                criadoEm: msg.criadoEm,
              })),
            }))
            : [],
          pedido,
          imagem: imagemRecente,
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta da Nara veio invalida.");
      }
      if (!response.ok) throw new Error(data.error || "Erro ao consultar a Nara.");

      const analise = data.analise || {};
      const dataSugerida = /^\d{4}-\d{2}-\d{2}$/.test(String(analise.proximoContatoSugerido || ""))
        ? analise.proximoContatoSugerido
        : ativo.proximoContato;
      const registroNara = criarRegistroSistemaCliente(usuarioAtual, {
        canal: "Nara",
        direcao: "Registro interno",
        tipo: "Analise Nara",
        assunto: "Estrategia comercial",
        mensagem: [
          `Pedido: ${clean(pedido, 700)}`,
          analise.resumo ? `Resumo: ${clean(analise.resumo, 1200)}` : "",
          analise.proximoPasso ? `Proximo passo: ${clean(analise.proximoPasso, 1200)}` : "",
          analise.lembreteSugerido ? `Lembrete sugerido: ${clean(analise.lembreteSugerido, 900)}` : "",
          analise.mensagemSugerida ? `Mensagem sugerida: ${clean(analise.mensagemSugerida, 1400)}` : "",
        ].filter(Boolean).join("\n"),
        orcamentoClienteId: orcamentoAtivo?.id || "",
        orcamentoId: orcamentoAtivo?.orcamentoId || "",
        orcamentoNumero: orcamentoAtivo?.numero || "",
        orcamentoTitulo: orcamentoAtivo?.titulo || "",
      });
      const orcamentosAtualizados = orcamentoAtivo
        ? orcamentosVinculadosAtivo.map((orc) => (
          orc.id === orcamentoAtivo.id
            ? { ...orc, historico: [registroNara, ...(Array.isArray(orc.historico) ? orc.historico : [])].slice(0, 140), atualizadoEm: new Date().toISOString() }
            : orc
        ))
        : orcamentosVinculadosAtivo;
      await atualizarCliente({
        jade: { ...analise, atualizadoEm: new Date().toISOString(), pedido },
        proximoPasso: analise.proximoPasso || ativo.proximoPasso,
        lembreteJade: analise.lembreteSugerido || ativo.lembreteJade,
        proximoContato: dataSugerida,
        temperatura: analise.prioridade === "critica" || analise.prioridade === "alta" ? "Quente" : ativo.temperatura,
        etiquetas: combinarEtiquetas(ativo.etiquetas, ativo._tags, etiquetasPorTexto(registroNara.mensagem)),
        contatos: [registroNara, ...contatosAtivo].slice(0, 160),
        orcamentosVinculados: orcamentosAtualizados,
      });
      if (orcamentoAtivo?.orcamentoId) {
        await registrarHistoricoOrcamentoGlobal(orcamentoAtivo.orcamentoId, registroNara);
      }
      pushToast("Nara analisou o cliente e sugeriu o proximo passo.", "ok");
    } catch (error) {
      console.error("Erro na Nara CRM:", error);
      pushToast(error.message || "Erro ao analisar cliente com Nara.", "erro");
    } finally {
      setJadeLoading(false);
    }
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      pushToast("Texto copiado.", "ok");
    } catch {
      pushToast("Nao foi possivel copiar.", "erro");
    }
  };

  const abrirWhats = (texto = "") => {
    const contatoWhats = ativo?.whatsapp || ativo?.telefone;
    if (!contatoWhats) {
      pushToast("Cadastre o WhatsApp/telefone do cliente primeiro.", "aviso");
      return;
    }
    const numero = normalizarNumeroWhats(contatoWhats);
    if (!numero) {
      pushToast("Telefone do cliente invalido.", "erro");
      return;
    }
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto || ativo?.jade?.mensagemSugerida || "")}`, "_blank", "noopener,noreferrer");
  };

  const abrirEmail = (texto = "") => {
    const emailDestino = ativo?.email || ativo?.email2;
    if (!emailDestino) {
      pushToast("Cadastre o e-mail do cliente primeiro.", "aviso");
      return;
    }
    const assunto = encodeURIComponent(`Acompanhamento - ${ativo.empresa || ativo.nome || "OrcaFlow"}`);
    const body = encodeURIComponent(texto || ativo?.jade?.mensagemSugerida || "");
    window.open(`mailto:${emailDestino}?subject=${assunto}&body=${body}`, "_blank", "noopener,noreferrer");
  };

  const abrirRelatorioSemanal = () => {
    const numero = normalizarWhatsDestino(whatsRelatorio || WHATS_REPORT_NUMBER);
    setWhatsRelatorio(numero);
    store.set(WHATS_REPORT_STORAGE_KEY, numero);
    const texto = gerarRelatorioSemanalNara({
      crm,
      clientes: base,
      empresas,
      usuarioNome: usuarioAtual?.nome || usuarioAtual?.email || "OrcaFlow",
    });
    abrirWhatsRelatorio({ numero, texto });
    pushToast("Relatorio semanal da Nara aberto no WhatsApp.", "ok");
  };

  const INP = inputStyle();
  const LBL = { fontSize: 9, color: C.dim, letterSpacing: 1.4, fontWeight: 900, marginBottom: 5 };

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "320px 1fr", minHeight: 0, overflow: "hidden" }}>
      <aside style={{ borderRight: `1px solid ${C.border}`, background: "rgba(7,17,31,.72)", padding: 14, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>CRM de Clientes</div>
            <div style={{ color: C.dim, fontSize: 11 }}>{base.length} cliente(s) em acompanhamento com Nara</div>
          </div>
          <button onClick={novoCliente} style={{ border: "none", borderRadius: 10, padding: "9px 11px", background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Novo</button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {[
            ["Ativos", kpis.abertos, C.blue2],
            ["Quentes", kpis.quentes, C.warn],
            ["Atrasados", kpis.atrasados, C.danger],
            ["Sem contato", kpis.semContato, C.green],
          ].map(([label, valor, cor]) => (
            <div key={label} style={{ border: `1px solid ${cor}33`, background: `${cor}12`, borderRadius: 12, padding: 10 }}>
              <div style={{ color: cor, fontWeight: 950, fontSize: 15 }}>{valor}</div>
              <div style={{ color: C.dim, fontSize: 10 }}>{label}</div>
            </div>
          ))}
        </div>

        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, contato, empresa..." style={{ ...INP, marginBottom: 10 }} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            ["todos", "Todos"],
            ["quentes", "Quentes"],
            ["atrasados", "Atrasados"],
            ["hoje", "Hoje"],
            ["sem-contato", "Sem contato"],
            ["sem-whatsapp", "Sem WhatsApp"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{ padding: "6px 9px", borderRadius: 999, border: `1px solid ${filtro === id ? C.green2 : C.border2}`, background: filtro === id ? `${C.green2}18` : "transparent", color: filtro === id ? C.green : C.muted, cursor: "pointer", fontSize: 10.5, fontWeight: 850 }}>{label}</button>
          ))}
        </div>
        <select value={filtroEtiqueta} onChange={(e) => setFiltroEtiqueta(e.target.value)} style={{ ...INP, marginBottom: 10 }}>
          <option value="">Todas as etiquetas inteligentes</option>
          {etiquetasDisponiveis.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <details style={{ marginBottom: 12 }}>
          <summary style={{ color: C.muted, cursor: "pointer", fontSize: 11, fontWeight: 900 }}>Ferramentas</summary>
          <div style={{ display: "grid", gap: 7, marginTop: 8 }}>
            <input ref={refImportarContatos} type="file" accept=".vcf,.csv,.txt,text/vcard,text/csv,text/plain" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; importarArquivoContatos(file); }} />
            <button onClick={importarContatosDoAparelho} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.green2}66`, background: `${C.green2}16`, color: C.green, fontWeight: 900, cursor: "pointer" }}>Importar contatos do celular</button>
            <button onClick={() => refImportarContatos.current?.click()} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.border2}`, background: C.panel2, color: C.muted, fontWeight: 850, cursor: "pointer" }}>Importar arquivo .vcf/.csv</button>
            <div style={{ color: C.dim, fontSize: 10, lineHeight: 1.35 }}>No celular, use o navegador com permissao de contatos. Se nao aparecer a agenda, exporte contatos como .vcf ou .csv e importe aqui.</div>
            <button onClick={sincronizarOrcamentos} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", fontWeight: 850, cursor: "pointer" }}>Buscar orcamentos compativeis</button>
            <button onClick={abrirRelatorioSemanal} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.green2}66`, background: `${C.green2}16`, color: C.green, fontWeight: 900, cursor: "pointer" }}>Relatorio Nara</button>
            <button onClick={() => aplicarEtiquetasInteligentes(false)} style={{ width: "100%", padding: "8px 10px", borderRadius: 10, border: `1px solid ${C.warn}55`, background: `${C.warn}12`, color: C.warn, fontWeight: 850, cursor: "pointer" }}>Aplicar etiquetas nos filtrados</button>
          </div>
        </details>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map((item) => {
            const selected = item.id === ativo?.id;
            const principal = item.nome || item.empresa || "Cliente sem nome";
            const secundario = item.empresa && item.empresa !== item.nome ? item.empresa : item.email || item.email2 || item.whatsapp || item.telefone || "Sem dados de contato";
            const sugestao = clean(item.proximoPasso || item.lembreteJade || "", 120);
            return (
              <button key={item.id} onClick={() => { setAtivoId(item.id); setEditando(false); }} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}14` : C.panel2, color: C.text, cursor: "pointer", minHeight: 0 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 12.5, lineHeight: 1.25 }}>{principal}</strong>
                  <span style={{ color: item.temperatura === "Quente" ? C.warn : C.green, fontSize: 10, fontWeight: 900 }}>{item.temperatura}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 10.5, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{secundario}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <span style={{ color: item._score >= 78 ? C.danger : item._score >= 58 ? C.warn : "#93C5FD", fontSize: 10, fontWeight: 950 }}>Nara: {item._nivel} {item._score}</span>
                  <span style={{ color: isAtrasado(item) ? C.danger : isHoje(item) ? C.warn : C.dim, fontSize: 10 }}>{item.proximoContato || "sem data"}</span>
                </div>
                {sugestao && <div style={{ color: "#93C5FD", fontSize: 10, marginTop: 5, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{sugestao}</div>}
                {!!item._tags?.length && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 7 }}>
                    {item._tags.slice(0, 3).map((tag) => <span key={tag} style={{ border: `1px solid ${corEtiqueta(tag)}55`, color: labelEtiqueta(tag) === tag ? C.muted : corEtiqueta(tag), borderRadius: 999, padding: "2px 6px", fontSize: 9, fontWeight: 850 }}>{labelEtiqueta(tag)}</span>)}
                    {item._tags.length > 3 && <span style={{ color: C.dim, fontSize: 9, padding: "2px 0" }}>+{item._tags.length - 3}</span>}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ overflowY: "auto", padding: 18 }}>
        {!ativo && !editando ? (
          <div style={{ height: "100%", minHeight: 420, display: "grid", placeItems: "center", color: C.dim, textAlign: "center" }}>
            <div><Users size={42} style={{ opacity: 0.55 }} /><div style={{ marginTop: 10, fontWeight: 900 }}>Crie um cliente para iniciar o acompanhamento.</div></div>
          </div>
        ) : (
          <>
          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
              <div>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>ACOES EM LOTE</div>
                <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>Segmentos e mensagens assistidas. A Nara prepara; voce revisa e envia manualmente.</div>
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <select value={campanhaFiltro} onChange={(e) => setCampanhaFiltro(e.target.value)} style={{ ...INP, width: 190 }}>
                  {CAMPANHAS_ASSISTIDAS.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
                </select>
                <select value={campanhaPlaybook} onChange={(e) => setCampanhaPlaybook(e.target.value)} style={{ ...INP, width: 180 }}>
                  {PLAYBOOKS_ASSISTIDOS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                <button onClick={gerarCampanhaAssistida} style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${C.green2}66`, background: `${C.green2}16`, color: C.green, fontWeight: 900, cursor: "pointer" }}><Wand2 size={13} /> Preparar</button>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 10, color: C.dim, fontSize: 11 }}>
              <span>{clientesCampanha.length} cliente(s) no segmento atual{filtroEtiqueta ? ` com etiqueta ${labelEtiqueta(filtroEtiqueta)}` : ""}.</span>
              {campanhaResultados.length > 0 && <button onClick={() => setCampanhaResultados([])} style={{ border: "none", background: "transparent", color: C.danger, cursor: "pointer", fontSize: 11, fontWeight: 850 }}>Limpar lista preparada</button>}
            </div>
            {campanhaResultados.length > 0 && (
              <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 8, maxHeight: 260, overflowY: "auto" }}>
                {campanhaResultados.map((item) => {
                  const cliente = clientes.find((cli) => cli.id === item.clienteId) || {};
                  return (
                    <div key={item.clienteId} style={{ border: `1px solid ${C.border2}`, background: C.panel2, borderRadius: 12, padding: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 6 }}>
                        <strong style={{ fontSize: 12 }}>{item.nome}</strong>
                        <span style={{ color: item.whatsapp ? C.green : C.danger, fontSize: 10, fontWeight: 900 }}>{item.whatsapp ? "WhatsApp ok" : "Sem numero"}</span>
                      </div>
                      <div style={{ whiteSpace: "pre-wrap", color: C.muted, fontSize: 11, lineHeight: 1.5, marginBottom: 8, display: "-webkit-box", WebkitLineClamp: 5, WebkitBoxOrient: "vertical", overflow: "hidden" }}>{item.texto}</div>
                      <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                        <button onClick={() => copiarCampanha(item.clienteId, item.texto)} style={{ padding: "6px 9px", borderRadius: 8, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 850 }}><Copy size={12} /> Copiar</button>
                        <button onClick={() => abrirWhatsCliente(cliente, item.texto)} style={{ padding: "6px 9px", borderRadius: 8, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 850 }}><MessageCircle size={12} /> WhatsApp</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(360px, 0.9fr) minmax(420px, 1.1fr)", gap: 16, alignItems: "start" }}>
            <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>PERFIL DO CLIENTE</div>
                  <div style={{ fontSize: 18, fontWeight: 950 }}>{editando ? "Cadastro do cliente" : ativo?.nome || ativo?.empresa}</div>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  {!editando && <button onClick={editarCliente} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, fontWeight: 850, cursor: "pointer" }}>Editar</button>}
                  {ativo && <button onClick={excluirCliente} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.danger}55`, background: "transparent", color: C.danger, fontWeight: 850, cursor: "pointer" }}>Excluir</button>}
                </div>
              </div>

              {(editando || !ativo) ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div style={{ gridColumn: "1 / -1", color: C.green, fontSize: 10, letterSpacing: 1.8, fontWeight: 950, borderBottom: `1px solid ${C.border2}`, paddingBottom: 7 }}>DADOS PESSOAIS E CONTATO</div>
                  {[
                    ["nome", "NOME DO CONTATO", "Ex: Carlos Silva"],
                    ["empresa", "EMPRESA / CLIENTE", "Ex: Prefeitura Municipal"],
                    ["cargo", "CARGO / PAPEL", "Ex: Comprador, engenheiro..."],
                    ["decisor", "DECISOR / INFLUENCIADOR", "Ex: decisor final, influencia tecnica..."],
                    ["whatsapp", "WHATSAPP PRINCIPAL", "(00) 00000-0000"],
                    ["telefone", "TELEFONE PRINCIPAL", "(00) 00000-0000"],
                    ["telefone2", "TELEFONE ALTERNATIVO", "(00) 00000-0000"],
                    ["email", "E-MAIL", "cliente@email.com"],
                    ["email2", "E-MAIL ALTERNATIVO", "outro@email.com"],
                    ["documento", "CPF / CNPJ / IDENTIFICADOR", "Documento do cliente"],
                    ["endereco", "ENDERECO", "Rua, numero, bairro"],
                    ["cidadeUf", "CIDADE / UF", "Cidade/UF"],
                    ["segmento", "SEGMENTO", "Ex: prefeitura, industria, comercio..."],
                    ["origem", "ORIGEM", "Orcamento, indicacao, visita..."],
                    ["intencao", "INTENCAO / INTERESSE", "Ex: manutencao, compra, obra, visita..."],
                    ["objecao", "OBJECAO PRINCIPAL", "Ex: preco, prazo interno, documento pendente..."],
                  ].map(([key, label, placeholder]) => (
                    <div key={key}>
                      <div style={LBL}>{label}</div>
                      <input
                        value={form[key] || ""}
                        onChange={(e) => setForm((f) => ({
                          ...f,
                          [key]: ["telefone", "whatsapp", "telefone2"].includes(key) ? formatTelefone(e.target.value) : e.target.value,
                        }))}
                        placeholder={placeholder}
                        style={INP}
                      />
                    </div>
                  ))}
                  <div style={{ gridColumn: "1 / -1", color: C.green, fontSize: 10, letterSpacing: 1.8, fontWeight: 950, borderBottom: `1px solid ${C.border2}`, paddingBottom: 7, marginTop: 4 }}>ACOMPANHAMENTO COMERCIAL</div>
                  <div>
                    <div style={LBL}>CANAL PREFERIDO</div>
                    <select value={form.canalPreferido || "WhatsApp"} onChange={(e) => setForm((f) => ({ ...f, canalPreferido: e.target.value }))} style={INP}>
                      {["WhatsApp", "E-mail", "Ligacao", "Reuniao", "Visita"].map((op) => <option key={op}>{op}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={LBL}>ETIQUETAS MANUAIS</div>
                    <input value={normalizarEtiquetas(form.etiquetas).join(", ")} onChange={(e) => setForm((f) => ({ ...f, etiquetas: normalizarEtiquetas(e.target.value) }))} placeholder="Ex: alto valor, setor publico, decisor" style={INP} />
                  </div>
                  <div>
                    <div style={LBL}>STATUS</div>
                    <select value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))} style={INP}>
                      {["Novo", "Em acompanhamento", "Proposta enviada", "Negociacao", "Fechado", "Perdido"].map((op) => <option key={op}>{op}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={LBL}>TEMPERATURA</div>
                    <select value={form.temperatura} onChange={(e) => setForm((f) => ({ ...f, temperatura: e.target.value }))} style={INP}>
                      {["Frio", "Morno", "Quente"].map((op) => <option key={op}>{op}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={LBL}>PROXIMO CONTATO</div>
                    <input type="date" value={form.proximoContato || ""} onChange={(e) => setForm((f) => ({ ...f, proximoContato: e.target.value }))} style={INP} />
                  </div>
                  <div>
                    <div style={LBL}>VALOR POTENCIAL</div>
                    <input value={form.valorPotencial || ""} onChange={(e) => setForm((f) => ({ ...f, valorPotencial: e.target.value }))} placeholder="Ex: 15000" style={INP} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={LBL}>PERFIL / CONTEXTO DO CLIENTE</div>
                    <textarea value={form.perfil || ""} onChange={(e) => setForm((f) => ({ ...f, perfil: e.target.value }))} rows={3} placeholder="Como esse cliente compra, quem decide, dores, objeções, relacionamento..." style={{ ...INP, resize: "vertical" }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <div style={LBL}>OBSERVACOES INTERNAS</div>
                    <textarea value={form.observacoes || ""} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} placeholder="Informacoes importantes para a Nara considerar..." style={{ ...INP, resize: "vertical" }} />
                  </div>
                  <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    {ativo && <button onClick={cancelarEdicao} style={{ padding: "10px 13px", borderRadius: 11, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, fontWeight: 900, cursor: "pointer" }}>Cancelar</button>}
                    <button onClick={salvarCliente} style={{ padding: "10px 14px", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", fontWeight: 950, cursor: "pointer" }}>{ativo ? "Salvar alteracoes" : "Salvar cliente"}</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gap: 10, color: C.muted, fontSize: 12, lineHeight: 1.65 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                    <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                      <div style={{ color: C.dim, fontSize: 10 }}>Prioridade Nara</div>
                      <div style={{ color: ativo._score >= 78 ? C.danger : ativo._score >= 58 ? C.warn : C.green, fontWeight: 950 }}>{ativo._nivel || nivelCliente(scoreCliente(ativo, relacionados))} {ativo._score || scoreCliente(ativo, relacionados)}</div>
                    </div>
                    <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                      <div style={{ color: C.dim, fontSize: 10 }}>Proximo contato</div>
                      <div style={{ color: isAtrasado(ativo) ? C.danger : isHoje(ativo) ? C.warn : C.text, fontWeight: 950 }}>{ativo.proximoContato || "Sem data"}</div>
                    </div>
                    <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                      <div style={{ color: C.dim, fontSize: 10 }}>Historico</div>
                      <div style={{ color: C.green, fontWeight: 950 }}>{contatosAtivo.length} registro(s)</div>
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 8 }}>
                      <strong style={{ color: C.text, fontSize: 12 }}><Tags size={13} /> Etiquetas inteligentes</strong>
                      <button onClick={() => aplicarEtiquetasInteligentes(true)} style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.warn}55`, background: `${C.warn}12`, color: C.warn, cursor: "pointer", fontSize: 10, fontWeight: 850 }}>Aplicar</button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {(ativo._tags || []).length ? (ativo._tags || []).map((tag) => (
                        <span key={tag} style={{ border: `1px solid ${corEtiqueta(tag)}66`, color: corEtiqueta(tag), borderRadius: 999, padding: "4px 8px", fontSize: 10, fontWeight: 900 }}>{labelEtiqueta(tag)}</span>
                      )) : <span style={{ color: C.dim, fontSize: 11 }}>Sem etiquetas sugeridas.</span>}
                    </div>
                  </div>
                  <div><strong style={{ color: C.text }}>Empresa:</strong> {ativo.empresa || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>WhatsApp:</strong> {ativo.whatsapp || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Contato:</strong> {[ativo.telefone, ativo.telefone2, ativo.email, ativo.email2].filter(Boolean).join(" | ") || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Documento:</strong> {ativo.documento || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Localizacao:</strong> {[ativo.endereco, ativo.cidadeUf].filter(Boolean).join(" - ") || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Decisor:</strong> {ativo.decisor || ativo.cargo || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Segmento:</strong> {ativo.segmento || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Origem:</strong> {ativo.origem || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Canal preferido:</strong> {ativo.canalPreferido || "WhatsApp"}</div>
                  <div><strong style={{ color: C.text }}>Intencao:</strong> {ativo.intencao || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Objecao:</strong> {ativo.objecao || "Nao informado"}</div>
                  <div><strong style={{ color: C.text }}>Orcamentos no perfil:</strong> {orcamentosVinculadosAtivo.length ? `${orcamentosVinculadosAtivo.length} vinculado(s), cada um com historico proprio.` : "Nenhum orcamento vinculado"}</div>
                  {!orcamentosVinculadosAtivo.length && Array.isArray(ativo._orcamentosSugeridos) && ativo._orcamentosSugeridos.length > 0 && (
                    <div style={{ color: C.warn }}><strong>Sugestao:</strong> existem {ativo._orcamentosSugeridos.length} orcamento(s) com nome parecido. Eles nao entram no CRM deste cliente ate voce vincular manualmente.</div>
                  )}
                  <div><strong style={{ color: C.text }}>Perfil:</strong> {ativo.perfil || "Sem perfil detalhado"}</div>
                  <div><strong style={{ color: C.text }}>Proximo passo:</strong> {ativo.proximoPasso || "Nara ainda nao analisou"}</div>
                  <div><strong style={{ color: C.text }}>Lembrete Nara:</strong> {ativo.lembreteJade || "Sem lembrete"}</div>
                </div>
              )}
            </section>

            <section style={{ display: "grid", gap: 14 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>NARA CRM</div>
                    <div style={{ color: C.dim, fontSize: 12 }}>Assistente pessoal de estrategia comercial</div>
                  </div>
                  <button onClick={() => chamarJade()} disabled={!ativo || jadeLoading} style={{ padding: "9px 13px", borderRadius: 10, border: `1px solid ${C.green2}66`, background: jadeLoading ? C.border2 : `${C.green2}18`, color: jadeLoading ? C.dim : C.green, fontWeight: 950, cursor: jadeLoading ? "not-allowed" : "pointer" }}>
                    {jadeLoading ? "Nara analisando..." : "Analisar com Nara"}
                  </button>
                </div>
                <textarea value={pedidoJade} onChange={(e) => setPedidoJade(e.target.value)} rows={2} style={{ ...INP, resize: "vertical", marginBottom: 10 }} />
                {ativo?.jade ? (
                  <div style={{ display: "grid", gap: 9, fontSize: 12, lineHeight: 1.65 }}>
                    <div style={{ color: C.text, fontWeight: 900 }}>{ativo.jade.proximoPasso}</div>
                    <div style={{ color: C.muted }}>{ativo.jade.estrategia || ativo.jade.leituraDaSituacao}</div>
                    {ativo.jade.perguntaParaUsuario && <div style={{ padding: 10, borderRadius: 10, background: `${C.blue2}12`, border: `1px solid ${C.blue2}33`, color: "#BFDBFE" }}>{ativo.jade.perguntaParaUsuario}</div>}
                    {Array.isArray(ativo.jade.dadosFaltantes) && ativo.jade.dadosFaltantes.length > 0 && <div style={{ color: C.warn }}><strong>Dados que a Nara precisa:</strong> {ativo.jade.dadosFaltantes.join(" | ")}</div>}
                    {ativo.jade.mensagemSugerida && (
                      <div style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12 }}>
                        <div style={{ color: C.green, fontSize: 10, fontWeight: 950, marginBottom: 6 }}>MENSAGEM SUGERIDA</div>
                        <div style={{ whiteSpace: "pre-wrap" }}>{ativo.jade.mensagemSugerida}</div>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                          <button onClick={() => copiarTexto(ativo.jade.mensagemSugerida)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 850 }}><Copy size={13} /> Copiar</button>
                          <button onClick={() => abrirWhats(ativo.jade.mensagemSugerida)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 850 }}><MessageCircle size={13} /> WhatsApp</button>
                          <button onClick={() => abrirEmail(ativo.jade.mensagemSugerida)} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: "pointer", fontWeight: 850 }}><Mail size={13} /> E-mail</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6 }}>Salve contatos, anexos ou vincule orcamentos. Depois peça para a Nara pensar no proximo passo.</div>
                )}
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>MODO ASSISTIDO GRATUITO</div>
                    <div style={{ color: C.dim, fontSize: 12 }}>Playbooks estilo Manychat, mas com envio manual e historico fiel.</div>
                  </div>
                  {ativo?._playbook && <span style={{ border: `1px solid ${C.green2}55`, color: C.green, borderRadius: 999, padding: "5px 8px", fontSize: 10, fontWeight: 900 }}>Sugestao: {PLAYBOOKS_ASSISTIDOS.find((p) => p.id === ativo._playbook)?.label || ativo._playbook}</span>}
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {PLAYBOOKS_ASSISTIDOS.map((playbook) => (
                    <button key={playbook.id} onClick={() => prepararPlaybook(playbook.id)} disabled={!ativo} style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${ativo?._playbook === playbook.id ? C.green2 : C.border2}`, background: ativo?._playbook === playbook.id ? `${C.green2}16` : C.panel2, color: ativo?._playbook === playbook.id ? C.green : C.muted, cursor: ativo ? "pointer" : "not-allowed", fontWeight: 850, fontSize: 11 }}>
                      {playbook.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 8 }}>ORCAMENTOS DO CLIENTE</div>
                <div style={{ color: C.dim, fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>Vincule orcamentos reais do sistema ou arquivos externos. Cada orcamento mantem um historico separado dentro deste cliente.</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 8 }}>
                  <input value={buscaOrcamento} onChange={(e) => setBuscaOrcamento(e.target.value)} placeholder="Pesquisar orcamento do sistema..." style={INP} />
                  <select value={orcamentoSistemaId} onChange={(e) => setOrcamentoSistemaId(e.target.value)} style={INP}>
                    <option value="">Selecione um orcamento...</option>
                    {opcoesOrcamentoSistema.map((orc) => <option key={orc.id} value={orc.id}>{orc.numero || "Orcamento"} - {orc.cliente || "Sem cliente"} - {brl(orc.valorGlobal || orc.valor)}</option>)}
                  </select>
                  <button onClick={vincularOrcamentoSistema} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 900 }}>Vincular</button>
                </div>
                <input ref={refArquivoOrcamento} type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,.md,application/pdf,image/png,image/jpeg,image/webp,text/*" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; anexarOrcamentoArquivo(file); }} />
                <button onClick={() => refArquivoOrcamento.current?.click()} disabled={lendoOrcamentoArquivo || !ativo} style={{ marginBottom: 10, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: lendoOrcamentoArquivo ? "not-allowed" : "pointer", fontWeight: 850 }}>
                  <Upload size={14} /> {lendoOrcamentoArquivo ? "Lendo orcamento..." : "Anexar orcamento do dispositivo"}
                </button>

                <div style={{ display: "grid", gap: 8 }}>
                  {orcamentosVinculadosAtivo.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum orcamento vinculado ao perfil ainda.</div>}
                  {orcamentosVinculadosAtivo.map((orc) => {
                    const selected = orc.id === orcamentoAtivo?.id;
                    const totalHistorico = Array.isArray(orc.historico) ? orc.historico.length : 0;
                    return (
                      <button key={orc.id} onClick={() => { setOrcamentoAtivoId(orc.id); setContato((c) => ({ ...c, orcamentoClienteId: orc.id, orcamentoId: orc.orcamentoId || "" })); }} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}12` : C.panel2, color: C.text, cursor: "pointer" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                          <strong style={{ fontSize: 12 }}>{orc.numero || orc.titulo || orc.arquivoNome || "Orcamento"}</strong>
                          <span style={{ color: orc.origem === "arquivo" ? "#93C5FD" : C.green, fontSize: 10, fontWeight: 950 }}>{orc.origem === "arquivo" ? "Arquivo" : "Sistema"}</span>
                        </div>
                        <div style={{ color: C.dim, fontSize: 10.5, marginTop: 4 }}>{[orc.empresaNome, orc.status, orc.valor ? brl(orc.valor) : ""].filter(Boolean).join(" | ") || "Sem dados adicionais"}</div>
                        <div style={{ color: C.muted, fontSize: 10.5, marginTop: 5 }}>{totalHistorico} registro(s) neste orcamento</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                          {orc.arquivoDataUrl && <span onClick={(e) => { e.stopPropagation(); window.open(orc.arquivoDataUrl, "_blank", "noopener,noreferrer"); }} style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.blue2}55`, color: "#93C5FD", fontSize: 10, fontWeight: 850 }}>Abrir arquivo</span>}
                          <span onClick={(e) => { e.stopPropagation(); removerOrcamentoVinculado(orc.id); }} style={{ padding: "5px 8px", borderRadius: 8, border: `1px solid ${C.danger}55`, color: C.danger, fontSize: 10, fontWeight: 850 }}>Remover vinculo</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {orcamentoAtivo && (
                  <div style={{ marginTop: 12, borderTop: `1px solid ${C.border2}`, paddingTop: 10 }}>
                    <div style={{ color: C.green, fontSize: 10, fontWeight: 950, letterSpacing: 1.6, marginBottom: 8 }}>HISTORICO DESTE ORCAMENTO</div>
                    {(!Array.isArray(orcamentoAtivo.historico) || orcamentoAtivo.historico.length === 0) && <div style={{ color: C.dim, fontSize: 12 }}>Ainda nao ha tratativas registradas para este orcamento.</div>}
                    <div style={{ display: "grid", gap: 8 }}>
                      {(Array.isArray(orcamentoAtivo.historico) ? orcamentoAtivo.historico : []).slice(0, 12).map((msg) => (
                        <div key={msg.id} style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: 10 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: C.dim, fontSize: 10, marginBottom: 5 }}><span>{msg.canal} | {msg.tipo}</span><span>{tsFmt(msg.criadoEm)}</span></div>
                          <div style={{ whiteSpace: "pre-wrap", fontSize: 12, lineHeight: 1.55 }}>{msg.mensagem || msg.assunto || "Registro sem texto"}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>NOVO REGISTRO DE CONTATO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <select value={contato.canal} onChange={(e) => setContato((c) => ({ ...c, canal: e.target.value }))} style={INP}>{["WhatsApp", "E-mail", "Ligacao", "Reuniao", "Visita", "Sistema"].map((op) => <option key={op}>{op}</option>)}</select>
                  <select value={contato.direcao} onChange={(e) => setContato((c) => ({ ...c, direcao: e.target.value }))} style={INP}>{["Cliente respondeu", "Empresa enviou", "Registro interno"].map((op) => <option key={op}>{op}</option>)}</select>
                  <select value={contato.tipo} onChange={(e) => setContato((c) => ({ ...c, tipo: e.target.value }))} style={INP}>{["Follow-up", "Cobranca", "Duvida", "Negociacao", "Envio de arquivo", "Retorno"].map((op) => <option key={op}>{op}</option>)}</select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={contato.assunto} onChange={(e) => setContato((c) => ({ ...c, assunto: e.target.value }))} placeholder="Assunto do contato" style={INP} />
                  <select value={contato.orcamentoClienteId} onChange={(e) => {
                    const vinculo = orcamentosVinculadosAtivo.find((orc) => orc.id === e.target.value);
                    setContato((c) => ({ ...c, orcamentoClienteId: e.target.value, orcamentoId: vinculo?.orcamentoId || "" }));
                    setOrcamentoAtivoId(e.target.value);
                  }} style={INP}>
                    <option value="">Sem orcamento vinculado</option>
                    {orcamentosVinculadosAtivo.map((orc) => <option key={orc.id} value={orc.id}>{orc.numero || orc.titulo || orc.arquivoNome || "Orcamento"} {orc.valor ? `- ${brl(orc.valor)}` : ""}</option>)}
                  </select>
                </div>
                <textarea value={contato.mensagem} onChange={(e) => setContato((c) => ({ ...c, mensagem: e.target.value }))} rows={4} placeholder="Cole conversa, observacao, resposta do cliente, print transcrito ou detalhe do contato..." style={{ ...INP, resize: "vertical", marginBottom: 8 }} />
                <input ref={refArquivo} type="file" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; e.target.value = ""; prepararArquivo(file); }} />
                {anexo && <div style={{ marginBottom: 8, padding: 9, borderRadius: 10, border: `1px solid ${C.blue2}33`, color: "#BFDBFE", fontSize: 11 }}>Anexo pronto: {anexo.arquivoNome} {anexo.arquivoResumo ? `- ${clean(anexo.arquivoResumo, 120)}` : ""}</div>}
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => refArquivo.current?.click()} disabled={lendoArquivo} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: lendoArquivo ? "not-allowed" : "pointer", fontWeight: 850 }}><Upload size={14} /> {lendoArquivo ? "Lendo arquivo..." : "Anexar print/foto/arquivo"}</button>
                  <button onClick={salvarContato} style={{ padding: "9px 12px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", cursor: "pointer", fontWeight: 950 }}>Salvar contato</button>
                  <button onClick={() => chamarJade("Nara, gere uma mensagem inteligente para responder este cliente com base no historico e nos orcamentos relacionados.")} disabled={!ativo || jadeLoading} style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: "transparent", color: C.green, cursor: jadeLoading ? "not-allowed" : "pointer", fontWeight: 850 }}><Send size={14} /> Gerar resposta Nara</button>
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>HISTORICO DO CLIENTE</div>
                <div style={{ display: "grid", gap: 9 }}>
                  {contatosAtivo.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum contato registrado ainda.</div>}
                  {contatosAtivo.slice(0, 30).map((msg) => (
                    <div key={msg.id} style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}><strong style={{ fontSize: 12 }}>{msg.canal} | {msg.tipo}</strong><span style={{ color: C.dim, fontSize: 10 }}>{tsFmt(msg.criadoEm)}</span></div>
                      <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>{msg.direcao}{(msg.orcamentoNumero || msg.orcamentoTitulo) ? ` | ${msg.orcamentoNumero || msg.orcamentoTitulo}` : ""}</div>
                      {msg.mensagem && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 12 }}>{msg.mensagem}</div>}
                      {msg.arquivoNome && <div style={{ marginTop: 8, color: "#93C5FD", fontSize: 11 }}>Anexo: {msg.arquivoNome} - {msg.arquivoResumo}</div>}
                      {msg.arquivoPreview && <img src={msg.arquivoPreview} alt="" style={{ marginTop: 8, maxHeight: 120, maxWidth: "100%", borderRadius: 8, border: `1px solid ${C.border2}` }} />}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
          </>
        )}
      </main>
    </div>
  );
}
