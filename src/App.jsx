import React, { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders, supabase } from "./supabase.js";
import { store } from "./store.js";
import { ClientesCRMPanel } from "./ClientesCRMPanel.jsx";
import { AgendaClientesPanel, KEY_AGENDA_CLIENTES } from "./AgendaClientesPanel.jsx";
import { WhatsAppInboxPanel, KEY_WHATSAPP_INBOX } from "./WhatsAppInboxPanel.jsx";
import { abrirWhatsRelatorio, gerarRelatorioSemanalNara, normalizarWhatsDestino, WHATS_REPORT_NUMBER, WEEKLY_REPORT_PENDING_KEY } from "./weeklyReport.js";
import {
  DEFAULT_NARA_CONFIG,
  KEY_AUTO_BACKUP_LOG,
  KEY_DAILY_RADAR_PENDING,
  KEY_NARA_AUTOMATION,
  gerarAuditoriaEquipe,
  gerarChecklistPreGeracao,
  gerarRadarDiarioNara,
  precisaBackupAssistido,
} from "./naraAutomation.js";

import {
  FileText,
  Building2,
  Users,
  Database,
  Bot,
  Shield,
  Bell,
  Search,
  Download,
  Mic,
  Upload,
  Send,
  Copy,
  Trash2,
  Mail,
  MessageSquareText
} from "lucide-react";

let pdfJsPromise;
let jsPdfPromise;

async function getJsPdf() {
  if (!jsPdfPromise) {
    jsPdfPromise = import("jspdf").then((module) => module.jsPDF);
  }
  return jsPdfPromise;
}

async function getPdfJs() {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import("pdfjs-dist"),
      import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
    ]).then(([pdfjsLib, pdfWorker]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker.default;
      return pdfjsLib;
    });
  }
  return pdfJsPromise;
}

// ─────────────────────────────────────────────────────────────────────────────
// ORÇAFLOW — APP.JSX CORRIGIDO
// Alterações incluídas:
// 1) Removida a aba Visual.
// 2) Logo do OrçaFlow clicável para voltar ao início.
// 3) Identidade visual geral baseada na logo: fundo escuro, verde e azul.
// 4) Botão para importar Cartão CNPJ em PDF e preencher campos automaticamente.
// 5) Cadastro reduzido para Dados, Linguagem e Documento.
// 6) Documento final prioriza logo e papel timbrado cadastrados.
// ─────────────────────────────────────────────────────────────────────────────

const KEY_EMP = "orcaflow_empresas";
const KEY_LOG = "orcaflow_log";
const KEY_META = "orcaflow_meta";
const KEY_CRM = "orcaflow_crm_orcamentos";
const KEY_CRM_TRASH = "orcaflow_crm_lixeira";
const KEY_AUDITORIA = "orcaflow_auditoria_acoes";
const KEY_USERS = "orcaflow_users";
const KEY_RESET = "orcaflow_reset_senha";
const KEY_CHAT = "orcaflow_chat_ia";
const KEY_CLIENTES = "orcaflow_clientes_crm";
const KEY_LAST_LOGIN_USER = "orcaflow_last_login_user";
const KEY_WHATS_RELATORIO = "orcaflow_whats_relatorio";
const KEY_WEEKLY_REPORT_PENDING = WEEKLY_REPORT_PENDING_KEY;
const KEY_WHATSAPP_MONITOR = KEY_WHATSAPP_INBOX;
const KEY_AGENDA = KEY_AGENDA_CLIENTES;
const KEY_NARA_AUTO = KEY_NARA_AUTOMATION;
const KEY_NARA_RADAR = KEY_DAILY_RADAR_PENDING;
const KEY_BACKUP_AUTO = KEY_AUTO_BACKUP_LOG;
const BACKUP_KEYS = [KEY_EMP, KEY_CRM, KEY_CRM_TRASH, KEY_AUDITORIA, KEY_META, KEY_LOG, KEY_USERS, KEY_RESET, KEY_CHAT, KEY_CLIENTES, KEY_AGENDA, KEY_WHATS_RELATORIO, KEY_WEEKLY_REPORT_PENDING, KEY_WHATSAPP_MONITOR, KEY_NARA_AUTO, KEY_NARA_RADAR, KEY_BACKUP_AUTO];
const USER_TRANSFER_KEYS = [KEY_EMP, KEY_CRM, KEY_CRM_TRASH, KEY_AUDITORIA, KEY_CLIENTES, KEY_AGENDA, KEY_CHAT, KEY_WHATSAPP_MONITOR];
const USER_TRANSFER_OPTIONS = [
  { id: "empresas", label: "Empresas cadastradas", keys: [KEY_EMP] },
  { id: "orcamentos", label: "Orcamentos/gestao", keys: [KEY_CRM, KEY_CRM_TRASH, KEY_AUDITORIA] },
  { id: "clientes", label: "Clientes CRM", keys: [KEY_CLIENTES] },
  { id: "agenda", label: "Agenda de contatos", keys: [KEY_AGENDA] },
  { id: "chat", label: "Historico da Nara", keys: [KEY_CHAT] },
  { id: "whatsapp", label: "Caixa WhatsApp", keys: [KEY_WHATSAPP_MONITOR] },
  { id: "comercial", label: "Tudo comercial", keys: [KEY_EMP, KEY_CRM, KEY_CRM_TRASH, KEY_CLIENTES, KEY_AGENDA] },
];

const ADMIN_PADRAO = {
  id: "admin-master",
  nome: "admin",
  tipo: "admin",
  perfil: "Administrador",
  ativo: true,
  criadoEm: new Date().toISOString(),
};

function nomeUsuarioSistema(usuario = {}) {
  return clean(usuario.nomeTratamento || usuario.displayName || usuario.nome || usuario.email || "responsavel", 80);
}

function assinaturaUsuarioSistema(usuario = {}) {
  return clean(usuario.nomeAssinatura || usuario.signatureName || usuario.nomeTratamento || usuario.nome || usuario.email || "", 100);
}

const usuariosBase = [
  ADMIN_PADRAO,
  {
    id: "user-michel",
    nome: "Michel",
    tipo: "usuario",
    perfil: "Usuário",
    ativo: true,
    criadoEm: new Date().toISOString(),
  },
];

function isAdminProtegido(usuario) {
  return (
    usuario?.id === "admin-master" ||
    String(usuario?.nome || "").toLowerCase() === "admin"
  );
}

const BRAND = {
  bg: "#050B14",
  panel: "#0A1525",
  panel2: "#07111F",
  border: "#1A2840",
  border2: "#1E293B",
  green: "#00E676",
  green2: "#16A34A",
  blue: "#00B0FF",
  blue2: "#2563EB",
  text: "#F8FAFC",
  muted: "#94A3B8",
  dim: "#475569",
  danger: "#F87171",
  warn: "#F59E0B",
};

const UI = {
  title: 14,
  text: 12,
  small: 10,
};

function safeFileName(v = "arquivo") {
  return String(v)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "arquivo";
}

function imageTypeFromDataUrl(dataUrl = "") {
  if (String(dataUrl).includes("image/png")) return "PNG";
  if (String(dataUrl).includes("image/webp")) return "WEBP";
  return "JPEG";
}

function hexToRgb(hex, fallback = [22, 163, 74]) {
  const cleanHex = String(hex || "").replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(cleanHex)) return fallback;
  return [
    parseInt(cleanHex.slice(0, 2), 16),
    parseInt(cleanHex.slice(2, 4), 16),
    parseInt(cleanHex.slice(4, 6), 16),
  ];
}

function mapPdfFont(font = "") {
  const f = String(font).toLowerCase();
  if (f.includes("times") || f.includes("georgia") || f.includes("garamond") || f.includes("cambria") || f.includes("constantia") || f.includes("palatino")) return "times";
  if (f.includes("courier") || f.includes("consolas") || f.includes("lucida console")) return "courier";
  return "helvetica";
}

function diasAte(data) {
  if (!data) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const alvo = new Date(data + "T00:00:00");
  if (Number.isNaN(alvo.getTime())) return null;
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000);
}

function gerarTextoWhatsPendencias(lista, empresas = []) {
  const itens = Array.isArray(lista) ? lista : [];
  const pendentes = itens
    .filter((o) => !isFinalizadoOrcamento(o))
    .map((o) => ({ item: o, prioridade: avaliarPrioridadeOrcamento(o) }))
    .sort((a, b) => b.prioridade.score - a.prioridade.score);

  if (!pendentes.length) return "Nara: nao ha orcamentos pendentes no momento.";

  const hoje = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  const atrasados = pendentes.filter(({ item }) => isAtrasadoOrcamento(item)).length;
  const criticos = pendentes.filter(({ prioridade }) => prioridade.score >= 70).length;
  const semContato = pendentes.filter(({ item }) => !item.proximoContato).length;
  const valorTotal = pendentes.reduce((soma, { item }) => soma + parseValorBR(item.valorGlobal ?? item.valor ?? item.valorTotal), 0);

  const resumoContato = (item) => {
    const dias = diasAte(item.proximoContato);
    if (dias === null) return "sem proximo contato definido";
    if (dias < 0) return `contato atrasado ha ${Math.abs(dias)} dia(s)`;
    if (dias === 0) return "contato previsto para hoje";
    return `proximo contato em ${dias} dia(s)`;
  };

  const linhas = pendentes.slice(0, 12).map(({ item, prioridade }, i) => {
    const emp = empresas.find((e) => e.id === item.empresaId)?.nome || item.empresaNome || "Empresa nao identificada";
    const motivos = prioridade.motivos?.length ? ` Motivo: ${prioridade.motivos.join(", ")}.` : "";
    const lembrete = item.lembreteIA || item.lembrete || "Definir retorno comercial objetivo.";
    return [
      `${i + 1}. ${item.cliente || "Cliente nao informado"} (${item.numero || "sem numero"})`,
      `Empresa: ${emp}`,
      `Valor: ${brl(item.valorGlobal ?? item.valor ?? item.valorTotal)} | Status: ${statusFunilOrcamento(item)} | Prioridade: ${prioridade.nivel} ${prioridade.score}`,
      `Situacao: ${resumoContato(item)}.${motivos}`,
      `Acao sugerida pela Nara: ${prioridade.acao || lembrete}`,
    ].join("\n");
  });

  const excedentes = pendentes.length > 12 ? `\n\nMais ${pendentes.length - 12} orcamento(s) ficaram fora desta previa. Consulte o OrcaFlow para ver a fila completa.` : "";

  return [
    "Nara - Relatorio de orcamentos que precisam de atencao",
    `Gerado em: ${hoje}`,
    "",
    "Resumo executivo:",
    `- Total em acompanhamento: ${pendentes.length}`,
    `- Criticos: ${criticos}`,
    `- Atrasados: ${atrasados}`,
    `- Sem proximo contato: ${semContato}`,
    `- Valor potencial: ${brl(valorTotal)}`,
    "",
    "Prioridade de acao:",
    linhas.join("\n\n"),
    excedentes,
    "",
    "Orientacao da Nara: priorizar os casos criticos e atrasados primeiro, depois registrar o retorno no historico do cliente para manter a estrategia atualizada.",
  ].filter(Boolean).join("\n");
}

async function logOp(acao, nome, id) {
  try {
    const logs = (await store.get(KEY_LOG)) || [];
    logs.unshift({ acao, nome, id, ts: new Date().toISOString() });
    await store.set(KEY_LOG, logs.slice(0, 120));
  } catch {}
}

const uid = () => `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const orcNum = () => `ORC-${String(Math.floor(Math.random() * 900000) + 100000)}`;
// Interpreta valores no formato brasileiro corretamente:
// "3.500" → 3500 | "3.500,00" → 3500 | "3500,50" → 3500.5 | "3.5" → 3.5
function parseValorBR(v) {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return Number.isFinite(v) ? v : 0;
  let s = String(v).trim().replace(/r\$/gi, "").replace(/\s/g, "");
  if (!s) return 0;
  const temVirgula = s.includes(",");
  const temPonto = s.includes(".");
  if (temVirgula && temPonto) {
    // formato BR completo: ponto = milhar, vírgula = decimal
    s = s.replace(/\./g, "").replace(",", ".");
  } else if (temVirgula) {
    // só vírgula = separador decimal
    s = s.replace(",", ".");
  } else if (temPonto) {
    // só ponto: se o último grupo tem 3 dígitos, é separador de milhar (3.500 = 3500)
    const partes = s.split(".");
    const ultima = partes[partes.length - 1];
    if (partes.length > 1 && ultima.length === 3) s = s.replace(/\./g, "");
    // caso contrário mantém como decimal (3.5 = 3,5)
  }
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

const brl = (v) => parseValorBR(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const DEFAULT_SECTION_ORDER = ["intro", "objetivo", "escopo", "materiais", "consideracoes", "recursos", "itens", "fechamento"];
const SECTION_FALLBACK_LABELS = {
  intro: "APRESENTACAO",
  objetivo: "OBJETIVO",
  escopo: "ESCOPO DO SERVICO",
  materiais: "MATERIAIS E EQUIPAMENTOS",
  consideracoes: "CONSIDERACOES TECNICAS",
  recursos: "RECURSOS OPERACIONAIS",
  itens: "ITENS INCLUIDOS",
  fechamento: "FECHAMENTO",
};

function materialRows(dados) {
  return Array.isArray(dados?.materiaisTabela) ? dados.materiaisTabela.filter((item) => item?.descricao) : [];
}

function materialTotal(rows = []) {
  return rows.reduce((acc, item) => acc + parseValorBR(item?.subtotal), 0);
}

function isEletroLiderProfile(perfil = {}) {
  return perfil?.tipo === "varejo-eletrico";
}

function documentoExibeCodigo(perfil = {}) {
  return isEletroLiderProfile(perfil);
}

function normalizarTituloDocumento(texto = "", perfil = {}) {
  let titulo = clean(texto || "PROPOSTA COMERCIAL");
  if (!isEletroLiderProfile(perfil)) {
    titulo = titulo
      .replace(/\bor[cç]amentos?\b/gi, "Proposta")
      .replace(/\bcota[cç][aã]o\b/gi, "Proposta")
      .replace(/\bORC[-\s]*\d+\b/gi, "")
      .replace(/\s+[-–—]\s*$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }
  return titulo || "PROPOSTA COMERCIAL";
}

function getDocTitle(dados, perfil = {}) {
  return normalizarTituloDocumento(dados?.identidadeDocumento?.tituloDocumento || "PROPOSTA COMERCIAL", perfil);
}

function assuntoResumoDocumento(dados = {}, textoBase = "") {
  let origem = [
    dados?.assuntoResumo,
    dados?.campos?.objetivo,
    dados?.campos?.escopo,
    dados?.campos?.intro,
    textoBase,
  ].find((item) => clean(item));

  if (!origem && clean(dados?.tituloResumo)) {
    const partes = clean(dados.tituloResumo).split(/\s+-\s+/).filter(Boolean);
    origem = partes.length > 1 ? partes.slice(1).join(" - ") : dados.tituloResumo;
  }

  const texto = clean(origem || "")
    .replace(/^leitura do anexo\s*\([^)]+\)\s*:/i, "")
    .replace(/\b(valor identificado|observacoes do anexo|observações do anexo)\b.*$/i, "")
    .replace(/\b(orcamento|orçamento|proposta|cotacao|cotação)\b\s*/gi, "")
    .replace(/\bORC[-\s]*\d+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  const palavras = texto.split(/\s+/).filter(Boolean).slice(0, 9).join(" ");
  return clean(palavras || "Servico solicitado", 90);
}

function resumoComercialOrcamento(dados = {}, emp = {}, clienteFallback = "", textoBase = "") {
  const clienteDoc = clean(dados?.campos?.cliente || clienteFallback || "Cliente", 80);
  const assunto = assuntoResumoDocumento(dados, textoBase);
  return clean(`${clienteDoc} - ${assunto}`, 130);
}

function nomeArquivoPDFOrcamento(emp = {}, dados = {}, clienteFallback = "", textoBase = "") {
  const perfil = perfilVisualEmpresa(emp, dados);
  if (isEletroLiderProfile(perfil)) {
    return `${safeFileName(emp.nome)}-${safeFileName(dados?.numero || "cotacao")}.pdf`;
  }
  const resumo = resumoComercialOrcamento(dados, emp, clienteFallback, textoBase);
  return `${safeFileName(resumo)}-${safeFileName(emp.nome || "empresa")}.pdf`;
}

function termoComCase(original = "", singular = "proposta", plural = "propostas") {
  const texto = String(original || "");
  const isPlural = /s$/i.test(texto) || /(coes|ções)$/i.test(texto);
  const base = isPlural ? plural : singular;
  if (texto === texto.toUpperCase()) return base.toUpperCase();
  if (/^[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/.test(texto)) return base.charAt(0).toUpperCase() + base.slice(1);
  return base;
}

function normalizarTextoPublicoDocumento(valor = "", perfil = {}) {
  if (typeof valor !== "string" || isEletroLiderProfile(perfil)) return valor;
  return valor
    .replace(/\bORC[-\s]*\d+\b/gi, "")
    .replace(/\bor[cç]amentos?\b/gi, (m) => termoComCase(m))
    .replace(/\bcota[cç](?:ao|ão|oes|ões)\b/gi, (m) => termoComCase(m))
    .replace(/\s{2,}/g, " ")
    .trim();
}

function normalizarDocumentoPublico(dados = {}, emp = {}) {
  const perfil = perfilVisualEmpresa(emp, dados);
  if (isEletroLiderProfile(perfil)) return dados;

  const normalizarMapa = (obj = {}) => Object.fromEntries(
    Object.entries(obj || {}).map(([key, value]) => [key, typeof value === "string" ? normalizarTextoPublicoDocumento(value, perfil) : value])
  );

  return {
    ...dados,
    identidadeDocumento: {
      ...(dados.identidadeDocumento || {}),
      tituloDocumento: normalizarTituloDocumento(dados.identidadeDocumento?.tituloDocumento || "", perfil),
      subtitulo: normalizarTextoPublicoDocumento(dados.identidadeDocumento?.subtitulo || "", perfil),
      rotulos: normalizarMapa(dados.identidadeDocumento?.rotulos || {}),
    },
    campos: normalizarMapa(dados.campos || {}),
    itensIA: Array.isArray(dados.itensIA) ? dados.itensIA.map((item) => normalizarTextoPublicoDocumento(item, perfil)) : [],
    materiaisTabela: Array.isArray(dados.materiaisTabela)
      ? dados.materiaisTabela.map((item) => ({
          ...item,
          descricao: normalizarTextoPublicoDocumento(item?.descricao || "", perfil),
        }))
      : [],
  };
}

function getSectionLabel(dados, key) {
  return clean(dados?.identidadeDocumento?.rotulos?.[key] || SECTION_FALLBACK_LABELS[key] || key).toUpperCase();
}

function getSectionOrder(dados, perfil = null) {
  const preferidasPorPerfil = {
    "varejo-eletrico": ["materiais", "intro", "escopo", "fechamento"],
    eventos: ["intro", "recursos", "materiais", "escopo", "fechamento"],
    orlovic: ["objetivo", "escopo", "materiais", "consideracoes", "fechamento"],
    consultoria: ["objetivo", "materiais", "consideracoes", "escopo", "fechamento"],
    operacional: ["objetivo", "recursos", "escopo", "materiais", "fechamento"],
    construcao: ["intro", "escopo", "itens", "materiais", "fechamento"],
    engenharia: ["intro", "objetivo", "materiais", "escopo", "consideracoes", "fechamento"],
  };
  const received = Array.isArray(dados?.identidadeDocumento?.ordemSecoes)
    ? dados.identidadeDocumento.ordemSecoes
    : [];
  const base = preferidasPorPerfil[perfil?.tipo] || received;
  const allowed = new Set(DEFAULT_SECTION_ORDER);
  const ordered = base.map((item) => clean(item)).filter((item) => allowed.has(item));
  for (const item of DEFAULT_SECTION_ORDER) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
}

function textoBuscaVisual(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function textoComparacaoPessoa(valor = "") {
  return textoBuscaVisual(valor)
    .replace(/\b(prefeitura|municipal|municipio|camara|secretaria|departamento|ltda|eireli|mei|sa|s\/a|me|epp|comercio|servicos|engenharia)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokensComparacao(valor = "") {
  const stop = new Set(["de", "da", "do", "das", "dos", "para", "com", "sem", "por", "em"]);
  return textoComparacaoPessoa(valor).split(/\s+/).filter((token) => token.length >= 3 && !stop.has(token));
}

function scoreClienteOrcamento(orc = {}, cliente = {}) {
  const alvoOrc = textoComparacaoPessoa([orc.cliente, orc.destinatario, orc.descricaoArquivo].filter(Boolean).join(" "));
  const alvoCliente = textoComparacaoPessoa([cliente.nome, cliente.empresa, cliente.documento, cliente.email, cliente.whatsapp, cliente.telefone].filter(Boolean).join(" "));
  if (!alvoOrc || !alvoCliente) return 0;
  if (alvoOrc === alvoCliente) return 96;
  if (alvoOrc.length >= 8 && alvoCliente.length >= 8 && (alvoOrc.includes(alvoCliente) || alvoCliente.includes(alvoOrc))) return 86;

  const tokensOrc = new Set(tokensComparacao(alvoOrc));
  const tokensCliente = new Set(tokensComparacao(alvoCliente));
  if (!tokensOrc.size || !tokensCliente.size) return 0;
  let inter = 0;
  for (const token of tokensOrc) if (tokensCliente.has(token)) inter += 1;
  const score = Math.round((inter / Math.max(tokensOrc.size, tokensCliente.size)) * 78);
  return score >= 38 ? score : 0;
}

function clientesCompativeisComOrcamento(orc = {}, clientes = [], limite = 4) {
  return (Array.isArray(clientes) ? clientes : [])
    .map((cliente) => ({ cliente, score: scoreClienteOrcamento(orc, cliente) }))
    .filter(({ score }) => score >= 45)
    .sort((a, b) => b.score - a.score)
    .slice(0, limite);
}

function normalizarStatusOrcamento(itemOuStatus) {
  const bruto = typeof itemOuStatus === "string" ? itemOuStatus : itemOuStatus?.status;
  const status = textoBuscaVisual(clean(bruto || ""));

  if (!status) return "Aberto";
  if (/finaliz|fechad|concluid|aprovad|ganh|closed|won/.test(status)) return "Finalizado";
  if (/andament|negoci|execu[cç][aã]o|process|em curso|ongoing/.test(status)) return "Andamento";
  if (/abert|pendente|novo|anexad|importad|aguard|open/.test(status)) return "Aberto";

  return "Aberto";
}

function isFinalizadoOrcamento(itemOuStatus) {
  return normalizarStatusOrcamento(itemOuStatus) === "Finalizado";
}

function isAtrasadoOrcamento(item) {
  if (isFinalizadoOrcamento(item)) return false;
  const status = textoBuscaVisual(item?.status || "");
  return status.includes("atrasad") || (diasAte(item?.proximoContato) !== null && diasAte(item?.proximoContato) < 0);
}

function statusFunilOrcamento(item) {
  if (isAtrasadoOrcamento(item)) return "Atrasado";
  return normalizarStatusOrcamento(item);
}

function perfilVisualEmpresa(emp = {}, dados = {}) {
  const alvo = textoBuscaVisual([
    emp.nome,
    emp.nomeFantasia,
    emp.dnaLinguagem,
    emp.estruturaOrcamento,
    emp.padraoDocumental,
    emp.assinaturaVisual,
    dados?.identidadeDocumento?.variante,
    dados?.identidadeDocumento?.tituloDocumento,
  ].join(" "));

  if (/eletro\s*lider|pupo|agnelo|materiais\s+eletricos/.test(alvo)) {
    return {
      tipo: "varejo-eletrico",
      tituloMaxLinhas: 2,
      tituloMaxSize: 25,
      tituloMinSize: 14,
      numeroLabel: "Cotacao",
      clienteLabel: "Dados do cliente",
      valorLabel: "Total da cotacao",
      extraTopo: 24,
      assinatura: "fornecedor-compacto",
      rodape: "compacto",
    };
  }

  if (/h&h|decoracoes|decoracao|eventos|ambientacao/.test(alvo)) {
    return {
      tipo: "eventos",
      tituloMaxLinhas: 2,
      tituloMaxSize: 24,
      tituloMinSize: 13,
      numeroLabel: "Atendimento",
      clienteLabel: "Destinatario",
      valorLabel: "Valor global",
      extraTopo: 8,
      assinatura: "eventos",
      rodape: "duas-linhas",
    };
  }

  if (/orlovic/.test(alvo)) {
    return {
      tipo: "orlovic",
      tituloMaxLinhas: 2,
      tituloMaxSize: 22,
      tituloMinSize: 12,
      numeroLabel: "Proposta",
      clienteLabel: "Contratante",
      valorLabel: "Investimento",
      extraTopo: 10,
      assinatura: "institucional-direita",
      rodape: "duas-linhas",
    };
  }

  if (/ad\s+solucoes|consultoria|diagnostico|levantamento|laudo|parecer/.test(alvo)) {
    return {
      tipo: "consultoria",
      tituloMaxLinhas: 2,
      tituloMaxSize: 20,
      tituloMinSize: 12,
      numeroLabel: "Documento",
      clienteLabel: "Solicitante",
      valorLabel: "Valor global",
      extraTopo: 6,
      assinatura: "tecnica",
      rodape: "duas-linhas",
    };
  }

  if (/power|service|operacional|execucao/.test(alvo)) {
    return {
      tipo: "operacional",
      tituloMaxLinhas: 2,
      tituloMaxSize: 22,
      tituloMinSize: 12,
      numeroLabel: "Orcamento",
      clienteLabel: "Cliente",
      valorLabel: "Valor global",
      extraTopo: 8,
      assinatura: "operacional",
      rodape: "compacto",
    };
  }

  if (/construir|construcao|obra|reforma/.test(alvo)) {
    return {
      tipo: "construcao",
      tituloMaxLinhas: 2,
      tituloMaxSize: 23,
      tituloMinSize: 12,
      numeroLabel: "Proposta",
      clienteLabel: "Cliente",
      valorLabel: "Investimento global",
      extraTopo: 8,
      assinatura: "comercial",
      rodape: "duas-linhas",
    };
  }

  return {
    tipo: "engenharia",
    tituloMaxLinhas: 2,
    tituloMaxSize: 22,
    tituloMinSize: 12,
    numeroLabel: "Proposta",
    clienteLabel: "Destinatario",
    valorLabel: "Valor global",
    extraTopo: 8,
    assinatura: "engenharia",
    rodape: "duas-linhas",
  };
}

const CORES_PERFIL_DOCUMENTO = {
  "varejo-eletrico": { primaria: "#111827", secundaria: "#F59E0B" },
  eventos: { primaria: "#B91C1C", secundaria: "#F97316" },
  orlovic: { primaria: "#374151", secundaria: "#64748B" },
  consultoria: { primaria: "#111827", secundaria: "#475569" },
  operacional: { primaria: "#15803D", secundaria: "#0369A1" },
  construcao: { primaria: "#B45309", secundaria: "#92400E" },
  engenharia: { primaria: "#0F766E", secundaria: "#1D4ED8" },
};

function corDocumento(emp = {}, perfil = null, canal = "primaria") {
  const p = perfil || perfilVisualEmpresa(emp);
  const fallback = CORES_PERFIL_DOCUMENTO[p.tipo]?.[canal] || (canal === "secundaria" ? BRAND.blue2 : BRAND.green2);
  const valor = canal === "secundaria" ? emp.corSecundaria : emp.corPrimaria;
  if (!valor) return fallback;

  const normal = String(valor).trim().toLowerCase();
  const defaultPrimaria = BRAND.green2.toLowerCase();
  const defaultSecundaria = BRAND.blue2.toLowerCase();
  if (normal === defaultPrimaria || normal === defaultSecundaria) return fallback;

  return valor;
}

function assinaturaDocumento(emp = {}, perfil = null) {
  const p = perfil || perfilVisualEmpresa(emp);
  const assinaturaAtual = clean(emp.assinatura || "");
  const nome = clean(emp.nomeFantasia || emp.nome || "");

  if (assinaturaAtual && !/^departamento comercial\b/i.test(assinaturaAtual)) {
    return assinaturaAtual;
  }

  const base = nome || "Empresa";
  const porPerfil = {
    "varejo-eletrico": `Atendimento comercial - ${base}`,
    eventos: `Producao e operacoes - ${base}`,
    orlovic: `Gestao corporativa - ${base}`,
    consultoria: `Consultoria tecnica - ${base}`,
    operacional: `Coordenacao operacional - ${base}`,
    construcao: `Gestao de obras e solucoes - ${base}`,
    engenharia: `Responsavel tecnico-comercial - ${base}`,
  };

  return porPerfil[p.tipo] || base;
}

function rodapeDocumento(emp = {}) {
  const atual = clean(emp.rodape || "");
  if (atual) return atual;
  return [emp.nome, emp.cnpj ? `CNPJ ${emp.cnpj}` : "", emp.email, emp.telefone]
    .map((p) => clean(p))
    .filter(Boolean)
    .join(" | ");
}

const tsFmt = (iso) => {
  try {
    return iso ? new Date(iso).toLocaleString("pt-BR") : "—";
  } catch {
    return "—";
  }
};
const onlyDigits = (v = "") => String(v).replace(/\D/g, "");
const clean = (v = "") => String(v).replace(/\s+/g, " ").trim();
const lineClean = (v = "") => clean(v).replace(/^[-:;,.\s]+|[-:;,.\s]+$/g, "");

const TONS = [
  "profissional",
  "técnico e preciso",
  "corporativo e elegante",
  "criativo e persuasivo",
  "direto e objetivo",
  "premium e sofisticado",
  "amigável e acessível",
];

const FONTES = [
  { id: "Arial", label: "Arial", cat: "Sans" },
  { id: "Arial Narrow", label: "Arial Narrow", cat: "Sans" },
  { id: "Arial Black", label: "Arial Black", cat: "Sans" },
  { id: "Calibri", label: "Calibri", cat: "Sans" },
  { id: "Calibri Light", label: "Calibri Light", cat: "Sans" },
  { id: "Cambria", label: "Cambria", cat: "Serif" },
  { id: "Candara", label: "Candara", cat: "Sans" },
  { id: "Century Gothic", label: "Century Gothic", cat: "Sans" },
  { id: "Consolas", label: "Consolas", cat: "Mono" },
  { id: "Constantia", label: "Constantia", cat: "Serif" },
  { id: "Corbel", label: "Corbel", cat: "Sans" },
  { id: "Courier New", label: "Courier New", cat: "Mono" },
  { id: "Garamond", label: "Garamond", cat: "Serif" },
  { id: "Georgia", label: "Georgia", cat: "Serif" },
  { id: "Helvetica", label: "Helvetica", cat: "Sans" },
  { id: "Lucida Console", label: "Lucida Console", cat: "Mono" },
  { id: "Lucida Sans Unicode", label: "Lucida Sans Unicode", cat: "Sans" },
  { id: "Palatino Linotype", label: "Palatino Linotype", cat: "Serif" },
  { id: "Segoe UI", label: "Segoe UI", cat: "Sans" },
  { id: "Segoe UI Light", label: "Segoe UI Light", cat: "Sans" },
  { id: "Tahoma", label: "Tahoma", cat: "Sans" },
  { id: "Times New Roman", label: "Times New Roman", cat: "Serif" },
  { id: "Trebuchet MS", label: "Trebuchet MS", cat: "Sans" },
  { id: "Verdana", label: "Verdana", cat: "Sans" },
];

const T_TITULO = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 25, 26, 27, 28, 30, 32, 34, 36, 38,
  40, 42, 44, 46, 48, 50, 54, 60, 66, 72
];

const T_CORPO = [
  8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
  21, 22, 23, 24, 26, 28, 30, 32, 36
];

function empVazio() {
  return {
    id: uid(),
    criadaEm: new Date().toISOString(),
    atualizadaEm: new Date().toISOString(),
    nome: "",
    nomeFantasia: "",
    cnpj: "",
    email: "",
    telefone: "",
    site: "",
    endereco: "",
    assinatura: "",
    rodape: "",
    diferenciais: "",
    tom: "profissional",
    dnaLinguagem: "",
    estruturaOrcamento: "",
    padraoDocumental: "",
    assinaturaVisual: "",
    // Cores fixas de fallback; a aba Visual foi removida.
    corPrimaria: BRAND.green2,
    corSecundaria: BRAND.blue2,
    corTexto: "#0F172A",
    corFundo: "#FFFFFF",
    fonteTitulo: "Georgia",
    tamanhoTitulo: 24,
    fonteCorpo: "Trebuchet MS",
    tamanhoCorpo: 12,
    logo: null,
    logoNome: "",
    posicaoLogo: "esquerda",
    papelTimbrado: null,
    papelTimbradoNome: "",
    // Medidas em PONTOS (pt), capturadas automaticamente do PDF/imagem do timbrado.
    timbradoLarguraPt: 595.28,
    timbradoAlturaPt: 841.89,
    altoCabecalho: 150,
    altoRodape: 100,
  };
}

function formatCNPJ(v) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

function formatTelefone(v) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/^(\d{2})(\d{4})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
  return d.replace(/^(\d{2})(\d{5})(\d{0,4}).*/, "($1) $2-$3").replace(/-$/, "");
}

function getFieldAfter(label, text) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`${escaped}\\s*[:\-]?\\s*([^\\n\\r]+)`, "i"),
    new RegExp(`${escaped}\\s*\\n\\s*([^\\n\\r]+)`, "i"),
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m?.[1]) return lineClean(m[1]);
  }
  return "";
}

function getBetween(labelA, labelB, text) {
  const a = labelA.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const b = labelB.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = text.match(new RegExp(`${a}\\s*([\\s\\S]{0,220}?)\\s*${b}`, "i"));
  return m?.[1] ? lineClean(m[1].split(/\n|\r/).filter(Boolean).pop() || m[1]) : "";
}

function extrairDadosCartaoCNPJ(textoOriginal) {
  const text = textoOriginal.replace(/\r/g, "\n").replace(/[ \t]+/g, " ");
  const flat = clean(text);

  const cnpj = (flat.match(/\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}/) || flat.match(/\b\d{14}\b/) || [""])[0];
  const email = (flat.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [""])[0];
  const site = (flat.match(/(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+\.[a-z]{2,}(?:\.[a-z]{2})?(?![\w.-]*@)/i) || [""])[0];
  const tel =
    getFieldAfter("TELEFONE", text) ||
    (flat.match(/\(?\d{2}\)?\s*\d{4,5}[-\s]?\d{4}/) || [""])[0];

  let nome =
    getFieldAfter("NOME EMPRESARIAL", text) ||
    getBetween("NOME EMPRESARIAL", "TÍTULO DO ESTABELECIMENTO", text) ||
    getBetween("NOME EMPRESARIAL", "CODIGO E DESCRICAO", text) ||
    "";

  let nomeFantasia =
    getFieldAfter("TÍTULO DO ESTABELECIMENTO", text) ||
    getFieldAfter("NOME DE FANTASIA", text) ||
    getBetween("TÍTULO DO ESTABELECIMENTO", "CÓDIGO E DESCRIÇÃO", text) ||
    "";

  const logradouro = getFieldAfter("LOGRADOURO", text);
  const numero = getFieldAfter("NÚMERO", text) || getFieldAfter("NUMERO", text);
  const complemento = getFieldAfter("COMPLEMENTO", text);
  const cep = getFieldAfter("CEP", text);
  const bairro = getFieldAfter("BAIRRO/DISTRITO", text) || getFieldAfter("BAIRRO", text);
  const municipio = getFieldAfter("MUNICÍPIO", text) || getFieldAfter("MUNICIPIO", text);
  const uf = getFieldAfter("UF", text);

  const enderecoParts = [];
  if (logradouro) enderecoParts.push(logradouro);
  if (numero && numero.toUpperCase() !== "S/N") enderecoParts.push(`nº ${numero}`);
  if (complemento && !/SEM|NAO|NÃO/i.test(complemento)) enderecoParts.push(complemento);
  if (bairro) enderecoParts.push(bairro);
  if (municipio || uf) enderecoParts.push(`${municipio}${uf ? `/${uf.slice(0, 2).toUpperCase()}` : ""}`);
  if (cep) enderecoParts.push(`CEP ${cep}`);

  return {
    nome: clean(nome).replace(/^[:\-]/, ""),
    nomeFantasia: clean(nomeFantasia).replace(/^[:\-]/, ""),
    cnpj: formatCNPJ(cnpj),
    email,
    telefone: formatTelefone(tel),
    site: email && site === email.split("@")[1] ? "" : site,
    endereco: enderecoParts.join(" — "),
  };
}

async function lerTextoPDF(file, options = {}) {
  const maxPages = Number(options.maxPages) > 0 ? Number(options.maxPages) : 20;
  const maxChars = Number(options.maxChars) > 0 ? Number(options.maxChars) : 90000;
  const buffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfJs();
  const task = pdfjsLib.getDocument({ data: buffer });
  const pdf = await task.promise;

  let texto = "";

  for (let i = 1; i <= Math.min(pdf.numPages, maxPages); i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((item) => item.str).join("\n") + "\n";
    if (texto.length >= maxChars) break;
  }

  try {
    await pdf.destroy();
  } catch {}

  return texto.slice(0, maxChars);
}

async function pdfParaImagemCartaoCNPJ(file) {
  const buffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const maiorLado = Math.max(base.width, base.height);
  const escala = Math.max(1.25, Math.min(2, 1400 / maiorLado));
  const viewport = page.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.82);
}

async function imagemParaLeitura(file) {
  const dataUrl = await lerArquivoComoDataURL(file);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const maiorLado = Math.max(img.width, img.height);
      const escala = maiorLado > 1400 ? 1400 / maiorLado : 1;
      const width = Math.max(1, Math.round(img.width * escala));
      const height = Math.max(1, Math.round(img.height * escala));
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");

      canvas.width = width;
      canvas.height = height;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

// Detecta automaticamente onde termina o cabeçalho e onde começa o rodapé
// analisando a "tinta" (pixels não-brancos) de cada linha do timbrado renderizado.
// Retorna as alturas em PONTOS (pt) do PDF — captação automática das medidas.
function detectarZonasTimbrado(canvas, alturaPt) {
  try {
    const ctx = canvas.getContext("2d");
    const { width: W, height: H } = canvas;
    const img = ctx.getImageData(0, 0, W, H).data;

    // Marca cada linha que possui conteúdo (pixel claramente diferente do branco).
    const passo = Math.max(1, Math.floor(W / 220)); // amostragem horizontal p/ performance
    const linhaTemTinta = new Array(H).fill(false);

    for (let y = 0; y < H; y += 1) {
      let tinta = 0;
      for (let x = 0; x < W; x += passo) {
        const i = (y * W + x) * 4;
        const r = img[i], g = img[i + 1], b = img[i + 2], a = img[i + 3];
        // considera "tinta" qualquer pixel visível e não-branco
        if (a > 30 && (r < 245 || g < 245 || b < 245)) tinta += 1;
      }
      linhaTemTinta[y] = tinta > 0;
    }

    // Encontra a maior faixa vazia (sem tinta) localizada na região central
    // da página. O topo dessa faixa = fim do cabeçalho; a base = início do rodapé.
    const limTopo = Math.floor(H * 0.10);
    const limBase = Math.ceil(H * 0.90);

    let melhorIni = -1, melhorFim = -1, melhorTam = 0;
    let ini = -1;
    for (let y = 0; y <= H; y += 1) {
      const vazia = y < H ? !linhaTemTinta[y] : false;
      if (vazia && ini === -1) ini = y;
      if ((!vazia || y === H) && ini !== -1) {
        const fim = y - 1;
        // só considera faixas que cruzam a região central
        const cruzaCentro = fim >= limTopo && ini <= limBase;
        const tam = fim - ini;
        if (cruzaCentro && tam > melhorTam) {
          melhorTam = tam;
          melhorIni = ini;
          melhorFim = fim;
        }
        ini = -1;
      }
    }

    const ptPorPx = alturaPt / H;
    let cabecalhoPx, rodapePx;

    if (melhorIni >= 0 && melhorTam > H * 0.04) {
      cabecalhoPx = melhorIni; // fim do conteúdo do topo
      rodapePx = H - melhorFim; // altura do bloco de rodapé
    } else {
      // fallback seguro caso não detecte faixa vazia clara
      cabecalhoPx = H * 0.18;
      rodapePx = H * 0.12;
    }

    // pequena folga para garantir que o corpo não encoste no timbrado
    const folga = H * 0.012;
    const altoCabecalho = Math.round((cabecalhoPx + folga) * ptPorPx);
    const altoRodape = Math.round((rodapePx + folga) * ptPorPx);

    return {
      altoCabecalho: Math.max(40, Math.min(altoCabecalho, Math.round(alturaPt * 0.5))),
      altoRodape: Math.max(24, Math.min(altoRodape, Math.round(alturaPt * 0.4))),
    };
  } catch (e) {
    console.warn("Não foi possível detectar zonas do timbrado:", e);
    return { altoCabecalho: Math.round(alturaPt * 0.18), altoRodape: Math.round(alturaPt * 0.12) };
  }
}

// Converte o PDF do timbrado em imagem e captura automaticamente:
// dimensões reais da página (em pontos) e as zonas de cabeçalho/rodapé.
function rgbToHex(r, g, b) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function distanciaCor(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function ajustarCor(rgb, fator = 0.74) {
  return rgbToHex(rgb.r * fator, rgb.g * fator, rgb.b * fator);
}

function extrairCoresTimbrado(canvas) {
  try {
    const ctx = canvas.getContext("2d");
    const { width, height } = canvas;
    const data = ctx.getImageData(0, 0, width, height).data;
    const stepX = Math.max(1, Math.floor(width / 180));
    const stepY = Math.max(1, Math.floor(height / 260));
    const buckets = new Map();

    for (let y = 0; y < height; y += stepY) {
      for (let x = 0; x < width; x += stepX) {
        const i = (y * width + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const a = data[i + 3];
        if (a < 60) continue;

        const { s, l } = rgbToHsl(r, g, b);
        const nearWhite = r > 238 && g > 238 && b > 238;
        const nearBlack = r < 28 && g < 28 && b < 28;
        const lowSignalGray = s < 0.08 && l > 0.82;
        if (nearWhite || lowSignalGray || nearBlack) continue;

        const qr = Math.round(r / 24) * 24;
        const qg = Math.round(g / 24) * 24;
        const qb = Math.round(b / 24) * 24;
        const key = `${qr},${qg},${qb}`;
        const atual = buckets.get(key) || { r: 0, g: 0, b: 0, peso: 0, count: 0 };
        const peso = 1 + s * 4 + (l > 0.12 && l < 0.86 ? 1 : 0);
        atual.r += r * peso;
        atual.g += g * peso;
        atual.b += b * peso;
        atual.peso += peso;
        atual.count += 1;
        buckets.set(key, atual);
      }
    }

    const cores = Array.from(buckets.values())
      .filter((c) => c.count >= 3)
      .map((c) => {
        const rgb = { r: c.r / c.peso, g: c.g / c.peso, b: c.b / c.peso };
        const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
        return { ...rgb, score: c.peso * (1 + hsl.s * 2), sat: hsl.s, lum: hsl.l };
      })
      .filter((c) => c.lum > 0.08 && c.lum < 0.92)
      .sort((a, b) => b.score - a.score);

    if (!cores.length) return null;

    const primaria = cores.find((c) => c.sat > 0.16) || cores[0];
    const secundaria = cores.find((c) => c !== primaria && distanciaCor(c, primaria) > 82) || cores.find((c) => c !== primaria) || null;

    return {
      primaria: rgbToHex(primaria.r, primaria.g, primaria.b),
      secundaria: secundaria ? rgbToHex(secundaria.r, secundaria.g, secundaria.b) : ajustarCor(primaria, primaria.lum > 0.45 ? 0.68 : 1.28),
    };
  } catch (error) {
    console.warn("Nao foi possivel extrair cores do timbrado:", error);
    return null;
  }
}

async function pdfParaImagemTimbrado(file) {
  const buffer = await file.arrayBuffer();

  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);

  // viewport em escala 1 = dimensões reais da página em PONTOS (pt)
  const viewportBase = page.getViewport({ scale: 1 });
  const larguraPt = viewportBase.width;
  const alturaPt = viewportBase.height;

  const escala = 3;
  const viewport = page.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  canvas.width = viewport.width;
  canvas.height = viewport.height;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;

  const zonas = detectarZonasTimbrado(canvas, alturaPt);
  const cores = extrairCoresTimbrado(canvas);

  return {
    imagem: canvas.toDataURL("image/png", 1),
    larguraPt,
    alturaPt,
    altoCabecalho: zonas.altoCabecalho,
    altoRodape: zonas.altoRodape,
    cores,
  };
}

// Para timbrados enviados como imagem (PNG/JPG): captura dimensões e zonas
// usando A4 retrato como referência de proporção da página final.
async function imagemParaTimbrado(dataUrl) {
  return new Promise((resolve) => {
    const A4_W = 595.28;
    const A4_H = 841.89;
    const fallback = {
      imagem: dataUrl,
      larguraPt: A4_W,
      alturaPt: A4_H,
      altoCabecalho: Math.round(A4_H * 0.18),
      altoRodape: Math.round(A4_H * 0.12),
    };
    try {
      const im = new Image();
      im.onload = () => {
        try {
          const ratio = im.naturalHeight / im.naturalWidth || A4_H / A4_W;
          const larguraPt = A4_W;
          const alturaPt = A4_W * ratio;
          const canvas = document.createElement("canvas");
          canvas.width = Math.min(im.naturalWidth, 1400);
          canvas.height = Math.round(canvas.width * ratio);
          const ctx = canvas.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
          const zonas = detectarZonasTimbrado(canvas, alturaPt);
          const cores = extrairCoresTimbrado(canvas);
          resolve({ imagem: dataUrl, larguraPt, alturaPt, altoCabecalho: zonas.altoCabecalho, altoRodape: zonas.altoRodape, cores });
        } catch {
          resolve(fallback);
        }
      };
      im.onerror = () => resolve(fallback);
      im.src = dataUrl;
    } catch {
      resolve(fallback);
    }
  });
}

function lerArquivoComoDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function baixarDataUrl(dataUrl, nomeArquivo) {
  try {
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = nomeArquivo || "orcamento.pdf";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}

// Modal para ANEXAR um orçamento já existente (PDF) e acompanhar o status
// na plataforma, com as mesmas funções dos orçamentos gerados internamente.
function ModalAnexarOrcamento({ empresas, usuarioAtual, onSave, onCancel, pushToast }) {
  const [cliente, setCliente] = useState("");
  const [empresaId, setEmpresaId] = useState(empresas[0]?.id || "");
  const [numero, setNumero] = useState("");
  const [valorGlobal, setValorGlobal] = useState("");
  const [statusItem, setStatusItem] = useState("Aberto");
  const [proximoContato, setProximoContato] = useState("");
  const [arquivo, setArquivo] = useState(null);
  const [arquivoNome, setArquivoNome] = useState("");
  const [salvandoLocal, setSalvandoLocal] = useState(false);
  const [importandoMassa, setImportandoMassa] = useState(false);
  const [progressoMassa, setProgressoMassa] = useState("");
  const refFile = useRef(null);
  const refBulk = useRef(null);

  const inp = {
    width: "100%", background: BRAND.panel2, border: `1px solid ${BRAND.border2}`,
    borderRadius: 10, padding: "11px 13px", color: BRAND.text, fontSize: 12.5,
    outline: "none", boxSizing: "border-box",
  };

  const anexarPdf = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const nome = String(file.name || "").toLowerCase();
    if (file.type !== "application/pdf" && !nome.endsWith(".pdf")) {
      pushToast("Anexe o orçamento em PDF.", "erro");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      pushToast("Arquivo muito grande. Envie até 8 MB.", "erro");
      return;
    }
    try {
      const dataUrl = await lerArquivoComoDataURL(file);
      setArquivo(dataUrl);
      setArquivoNome(file.name);
      pushToast("PDF anexado. Preencha os dados para acompanhamento.", "ok");
    } catch {
      pushToast("Erro ao ler o PDF.", "erro");
    }
  };

  const empresasCompactas = () => empresas.map((emp) => ({
    id: emp.id,
    nome: emp.nome || "",
    nomeFantasia: emp.nomeFantasia || "",
    cnpj: emp.cnpj || "",
    email: emp.email || "",
    assinatura: emp.assinatura || "",
    rodape: emp.rodape || "",
  }));

  const empresaPorIA = (dados) => {
    const porId = empresas.find((emp) => emp.id === dados?.empresaId);
    if (porId) return porId;
    const alvo = clean(`${dados?.empresaNomeDetectada || ""} ${dados?.observacoes || ""}`).toLowerCase();
    if (!alvo) return null;
    return empresas.find((emp) => {
      const nome = clean(`${emp.nome || ""} ${emp.nomeFantasia || ""} ${emp.cnpj || ""}`).toLowerCase();
      return nome && (alvo.includes(nome) || nome.includes(alvo));
    }) || null;
  };

  const importarEmMassa = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (!files.length || importandoMassa) return;

    setImportandoMassa(true);
    let importados = 0;
    let falhas = 0;

    try {
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        const nome = String(file.name || "");
        const nomeLower = nome.toLowerCase();
        const isPdf = file.type === "application/pdf" || nomeLower.endsWith(".pdf");
        const isDocx = nomeLower.endsWith(".docx") || /officedocument\.wordprocessingml\.document/i.test(file.type);

        setProgressoMassa(`Importando ${i + 1}/${files.length}: ${nome}`);

        if (!isPdf && !isDocx) {
          falhas += 1;
          continue;
        }
        if (file.size > 8 * 1024 * 1024) {
          falhas += 1;
          continue;
        }

        try {
          const dataUrl = await lerArquivoComoDataURL(file);
          const dataArquivo = file.lastModified ? new Date(file.lastModified).toISOString() : new Date().toISOString();
          let texto = "";
          let imagem = "";

          if (isPdf) {
            texto = await lerTextoPDF(file, { maxPages: 10, maxChars: 50000 });
            if (!texto || texto.trim().length < 40) {
              imagem = await pdfParaImagemCartaoCNPJ(file);
            }
          }

          const response = await fetch("/api/import-budget-file", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...(await authHeaders()),
            },
            body: JSON.stringify({
              filename: nome,
              mimeType: file.type || (isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf"),
              texto,
              imagem,
              fileData: isDocx ? dataUrl : "",
              fileModifiedAt: dataArquivo,
              empresas: empresasCompactas(),
            }),
          });

          let data = {};
          try {
            data = await response.json();
          } catch {
            throw new Error("A resposta da IA veio invalida.");
          }
          if (!response.ok) throw new Error(data.error || "Erro ao importar arquivo com IA.");

          const dados = data.dados || {};
          const emp = empresaPorIA(dados) || empresas[0];
          if (!emp) throw new Error("Cadastre uma empresa antes de importar.");

          const item = {
            id: `crm_import_${Date.now()}_${i}`,
            numero: dados.numero || orcNum(),
            empresaId: emp.id,
            empresaNome: emp.nome || "",
            cliente: dados.cliente || safeFileName(nome),
            valorGlobal: parseValorBR(dados.valorGlobal),
            status: "Aberto",
            proximoContato: "",
            lembreteIA: dados.descricao || "",
            descricaoArquivo: dados.descricao || "",
            empresaNomeDetectada: dados.empresaNomeDetectada || "",
            dataDocumento: dados.dataDocumento || "",
            dataArquivo,
            confiancaImportacao: dados.confianca || "",
            observacoesImportacao: dados.observacoes || "",
            origemImportacao: "massa_ia",
            userId: usuarioAtual?.id || "admin",
            criadoEm: dataArquivo,
            atualizadoEm: new Date().toISOString(),
            anexado: true,
            arquivoPdf: dataUrl,
            arquivoNome: nome,
            arquivoTipo: file.type || (isDocx ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" : "application/pdf"),
            conversas: [{
              id: `conv_import_${Date.now()}_${i}`,
              canal: "Importacao",
              direcao: "interna",
              tipo: "Importacao em massa",
              mensagem: `Arquivo importado com IA: ${nome}. ${dados.descricao ? clean(dados.descricao, 260) : "Revise os dados extraidos antes do acompanhamento."}`,
              criadoEm: new Date().toISOString(),
              origem: "ia",
              usuarioNome: nomeUsuarioSistema(usuarioAtual),
              arquivoNome: nome,
            }],
            orcamentoCompleto: null,
          };

          await onSave(item, { keepOpen: true, silent: true });
          importados += 1;
        } catch (error) {
          console.error("Erro ao importar arquivo em massa:", file.name, error);
          falhas += 1;
        }
      }

      pushToast(`Importacao concluida: ${importados} arquivo(s) importado(s)${falhas ? `, ${falhas} falha(s)` : ""}.`, falhas ? "aviso" : "ok");
      setProgressoMassa("");
    } finally {
      setImportandoMassa(false);
    }
  };

  const salvar = async () => {
    if (!cliente.trim()) { pushToast("Informe o cliente.", "erro"); return; }
    if (!empresaId) { pushToast("Selecione a empresa.", "erro"); return; }
    if (!arquivo) { pushToast("Anexe o PDF do orçamento.", "erro"); return; }
    setSalvandoLocal(true);
    const emp = empresas.find((e) => e.id === empresaId);
    const item = {
      id: `crm_anexo_${Date.now()}`,
      numero: numero.trim() || orcNum(),
      empresaId,
      empresaNome: emp?.nome || "",
      cliente: cliente.trim(),
      valorGlobal: parseValorBR(valorGlobal),
      status: statusItem,
      proximoContato: proximoContato || "",
      lembreteIA: "",
      userId: usuarioAtual?.id || "admin",
      criadoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
      anexado: true,
      arquivoPdf: arquivo,
      arquivoNome: arquivoNome || "orcamento.pdf",
      conversas: [{
        id: `conv_anexo_${Date.now()}`,
        canal: "Anexo",
        direcao: "interna",
        tipo: "Orcamento anexado",
        mensagem: `Orcamento externo anexado para acompanhamento: ${arquivoNome || "orcamento.pdf"}.`,
        criadoEm: new Date().toISOString(),
        origem: "manual",
        usuarioNome: nomeUsuarioSistema(usuarioAtual),
        arquivoNome: arquivoNome || "orcamento.pdf",
      }],
      orcamentoCompleto: null,
    };
    await onSave(item);
    setSalvandoLocal(false);
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, width: "100%", maxWidth: 520, maxHeight: "86vh", overflowY: "auto", padding: "20px 22px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>📎 Anexar orçamento existente</div>
            <div style={{ fontSize: 11.5, color: BRAND.dim, marginTop: 3 }}>Acompanhe status, contato e cobrança igual aos gerados na plataforma.</div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${BRAND.border2}`, color: BRAND.muted, width: 30, height: 30, borderRadius: 8, cursor: "pointer" }}>✕</button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
          <div>
            <Lbl c="CLIENTE / DESTINATÁRIO *" />
            <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex: Prefeitura de Mirassol" style={inp} />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <Lbl c="EMPRESA *" />
              <select value={empresaId} onChange={(e) => setEmpresaId(e.target.value)} style={inp}>
                {empresas.length === 0 && <option value="">Nenhuma empresa</option>}
                {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
              </select>
            </div>
            <div>
              <Lbl c="Nº DO ORÇAMENTO" />
              <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="Opcional (gera automático)" style={inp} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <Lbl c="VALOR GLOBAL (R$)" />
              <input type="text" inputMode="decimal" value={valorGlobal} onChange={(e) => setValorGlobal(e.target.value)} placeholder="Ex: 3.500 ou 3500,00" style={inp} />
              {valorGlobal.trim() !== "" && <div style={{ fontSize: 10, color: BRAND.green, marginTop: 4, fontWeight: 800 }}>{brl(parseValorBR(valorGlobal))}</div>}
            </div>
            <div>
              <Lbl c="STATUS" />
              <select value={statusItem} onChange={(e) => setStatusItem(e.target.value)} style={inp}>
                {["Aberto", "Andamento", "Finalizado"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div>
            <Lbl c="PRÓXIMO CONTATO" />
            <input type="date" value={proximoContato} onChange={(e) => setProximoContato(e.target.value)} style={inp} />
          </div>

          <div>
            <Lbl c="ARQUIVO PDF DO ORÇAMENTO *" />
            <input ref={refFile} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={anexarPdf} />
            <input ref={refBulk} type="file" accept="application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" multiple style={{ display: "none" }} onChange={importarEmMassa} />
            <button onClick={() => refFile.current?.click()} style={{ width: "100%", padding: "12px", borderRadius: 10, border: `1px dashed ${arquivo ? BRAND.green2 : BRAND.blue2}66`, background: arquivo ? `${BRAND.green2}12` : `${BRAND.blue2}10`, color: arquivo ? BRAND.green : "#93C5FD", cursor: "pointer", fontSize: 12, fontWeight: 850 }}>
              {arquivo ? `✓ ${arquivoNome}` : "📎 Selecionar PDF do orçamento"}
            </button>
            <button type="button" onClick={() => refBulk.current?.click()} disabled={importandoMassa} style={{ width: "100%", marginTop: 8, padding: "11px", borderRadius: 10, border: `1px solid ${BRAND.green2}55`, background: `${BRAND.green2}14`, color: BRAND.green, cursor: importandoMassa ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 900 }}>
              {importandoMassa ? "IA importando arquivos..." : "Importar varios orcamentos com IA"}
            </button>
            {progressoMassa && <div style={{ fontSize: 10.5, color: BRAND.dim, marginTop: 6 }}>{progressoMassa}</div>}
          </div>

          <div style={{ display: "flex", gap: 9, marginTop: 6 }}>
            <button onClick={onCancel} style={{ flex: 1, padding: "11px", borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 12.5, fontWeight: 800 }}>Cancelar</button>
            <button onClick={salvar} disabled={salvandoLocal} style={{ flex: 2, padding: "11px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", cursor: salvandoLocal ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 900 }}>{salvandoLocal ? "Salvando..." : "Salvar e acompanhar"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function useDB() {
  const [empresas, setEmpresas] = useState([]);
  const [status, setStatus] = useState("carregando");
  const [meta, setMeta] = useState({ totalOrcamentos: 0 });
  const [toast, setToast] = useState(null);
  const timer = useRef(null);
  const empresasRef = useRef([]);

  useEffect(() => {
    empresasRef.current = empresas;
  }, [empresas]);

  const pushToast = useCallback((msg, tipo = "ok") => {
    clearTimeout(timer.current);
    setToast({ msg, tipo });
    timer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  useEffect(() => {
    (async () => {
      const dados = await store.getMany([KEY_EMP, KEY_META]);
      setEmpresas(dados[KEY_EMP] || []);
      setMeta(dados[KEY_META] || { totalOrcamentos: 0 });
      setStatus("ok");
    })();
  }, []);

  const salvarEmpresa = useCallback(
    async (form) => {
      const prev = empresasRef.current;
      const existe = prev.find((e) => e.id === form.id);
      const upd = {
        ...form,
        atualizadaEm: new Date().toISOString(),
        criadaEm: existe ? form.criadaEm || existe.criadaEm : new Date().toISOString(),
      };
      const nova = existe ? prev.map((e) => (e.id === form.id ? upd : e)) : [...prev, upd];
      if (JSON.stringify(nova).length > 4_800_000) {
        pushToast("✗ Limite de 5 MB atingido. Reduza o tamanho das imagens.", "erro");
        return false;
      }
      const ok = await store.set(KEY_EMP, nova);
      if (ok) {
        setEmpresas(nova);
        await logOp(existe ? "UPDATE" : "INSERT", upd.nome, upd.id);
        pushToast(existe ? `✓ ${upd.nome} atualizada` : `✓ ${upd.nome} cadastrada`, "ok");
      } else {
        pushToast("✗ Falha ao salvar no banco", "erro");
      }
      return ok;
    },
    [pushToast]
  );

  const excluirEmpresa = useCallback(
    async (id) => {
      const prev = empresasRef.current;
      const emp = prev.find((e) => e.id === id);
      const nova = prev.filter((e) => e.id !== id);
      const ok = await store.set(KEY_EMP, nova);
      if (ok) {
        setEmpresas(nova);
        await logOp("DELETE", emp?.nome || "?", id);
        pushToast(`🗑 ${emp?.nome || "Empresa"} removida`, "aviso");
      }
    },
    [pushToast]
  );

  const exportarBackup = useCallback(async () => {
    try {
      const dadosSalvos = await store.getMany(BACKUP_KEYS);
      const dados = Object.fromEntries(BACKUP_KEYS.map((key) => [
        key,
        dadosSalvos[key] || (key === KEY_META || key === KEY_WEEKLY_REPORT_PENDING ? {} : key === KEY_WHATS_RELATORIO ? "" : []),
      ]));
      dados[KEY_EMP] = empresasRef.current;
      const m = dados[KEY_META] || {};
      const blob = new Blob(
        [JSON.stringify({
          geradoEm: new Date().toISOString(),
          versao: "2.1",
          app: "OrcaFlow Studio AI",
          meta: m,
          empresas: dados[KEY_EMP] || [],
          crm: dados[KEY_CRM] || [],
          orcamentos: dados[KEY_CRM] || [],
          log: dados[KEY_LOG] || [],
          usuarios: dados[KEY_USERS] || [],
          solicitacoesSenha: dados[KEY_RESET] || [],
          chatIA: dados[KEY_CHAT] || [],
          clientesCRM: dados[KEY_CLIENTES] || [],
          agendaClientes: dados[KEY_AGENDA] || [],
          whatsRelatorio: typeof dados[KEY_WHATS_RELATORIO] === "string" ? dados[KEY_WHATS_RELATORIO] : "",
          relatorioSemanalPendente: dados[KEY_WEEKLY_REPORT_PENDING] || {},
          whatsappInbox: dados[KEY_WHATSAPP_MONITOR] || [],
          dados,
        }, null, 2)],
        { type: "application/json" }
      );
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `orcaflow_backup_${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      pushToast("✓ Backup exportado", "ok");
    } catch (error) {
      pushToast(`✗ ${error.message}`, "erro");
    }
  }, [pushToast]);

  const importarBackup = useCallback(
    async (file) => {
      try {
        const parsed = JSON.parse(await file.text());
        const dados = parsed.dados && typeof parsed.dados === "object" ? parsed.dados : {};
        const empresasImport = Array.isArray(parsed.empresas) ? parsed.empresas : dados[KEY_EMP];
        if (!Array.isArray(empresasImport)) throw new Error("Arquivo invalido");

        const crmImport = Array.isArray(parsed.crm) ? parsed.crm : Array.isArray(parsed.orcamentos) ? parsed.orcamentos : dados[KEY_CRM];
        const metaImport = parsed.meta && typeof parsed.meta === "object" ? parsed.meta : dados[KEY_META];
        const logImport = Array.isArray(parsed.log) ? parsed.log : dados[KEY_LOG];
        const usersImport = Array.isArray(parsed.usuarios) ? parsed.usuarios : dados[KEY_USERS];
        const resetImport = Array.isArray(parsed.solicitacoesSenha) ? parsed.solicitacoesSenha : dados[KEY_RESET];
        const chatImport = Array.isArray(parsed.chatIA) ? parsed.chatIA : dados[KEY_CHAT];
        const clientesImport = Array.isArray(parsed.clientesCRM) ? parsed.clientesCRM : dados[KEY_CLIENTES];
        const agendaImport = Array.isArray(parsed.agendaClientes) ? parsed.agendaClientes : dados[KEY_AGENDA];
        const whatsappInboxImport = Array.isArray(parsed.whatsappInbox) ? parsed.whatsappInbox : dados[KEY_WHATSAPP_MONITOR];
        const relatorioPendenteImport = parsed.relatorioSemanalPendente && typeof parsed.relatorioSemanalPendente === "object"
          ? parsed.relatorioSemanalPendente
          : dados[KEY_WEEKLY_REPORT_PENDING] && typeof dados[KEY_WEEKLY_REPORT_PENDING] === "object"
            ? dados[KEY_WEEKLY_REPORT_PENDING]
            : {};
        const whatsRelatorioImport = typeof parsed.whatsRelatorio === "string"
          ? parsed.whatsRelatorio
          : typeof dados[KEY_WHATS_RELATORIO] === "string"
            ? dados[KEY_WHATS_RELATORIO]
            : "";

        const payload = {
          [KEY_EMP]: empresasImport,
          [KEY_CRM]: Array.isArray(crmImport) ? crmImport : [],
          [KEY_META]: metaImport && typeof metaImport === "object" ? metaImport : { totalOrcamentos: 0 },
          [KEY_LOG]: Array.isArray(logImport) ? logImport : [],
          [KEY_USERS]: Array.isArray(usersImport) ? usersImport : [],
          [KEY_RESET]: Array.isArray(resetImport) ? resetImport : [],
          [KEY_CHAT]: Array.isArray(chatImport) ? chatImport : [],
          [KEY_CLIENTES]: Array.isArray(clientesImport) ? clientesImport : [],
          [KEY_AGENDA]: Array.isArray(agendaImport) ? agendaImport : [],
          [KEY_WHATS_RELATORIO]: whatsRelatorioImport,
          [KEY_WEEKLY_REPORT_PENDING]: relatorioPendenteImport,
          [KEY_WHATSAPP_MONITOR]: Array.isArray(whatsappInboxImport) ? whatsappInboxImport : [],
        };

        const ok = await store.setMany(Object.fromEntries(BACKUP_KEYS.map((key) => [key, payload[key]])));
        if (ok) {
          setEmpresas(payload[KEY_EMP]);
          setMeta(payload[KEY_META]);
          window.dispatchEvent(new CustomEvent("orcaflow:clientes-imported", { detail: { clientes: payload[KEY_CLIENTES] } }));
          window.dispatchEvent(new CustomEvent("orcaflow:backup-imported", { detail: { crm: payload[KEY_CRM] } }));
          await logOp("IMPORT", `${payload[KEY_EMP].length} empresas / ${payload[KEY_CRM].length} orcamentos`, "batch");
          pushToast(`✓ Backup importado: ${payload[KEY_EMP].length} empresa(s) e ${payload[KEY_CRM].length} orcamento(s)`, "ok");
        }
      } catch (error) {
        pushToast(`✗ ${error.message}`, "erro");
      }
    },
    [pushToast]
  );

  const incOrcamentos = useCallback(async (n = 1) => {
    const m = (await store.get(KEY_META)) || { totalOrcamentos: 0 };
    m.totalOrcamentos = (m.totalOrcamentos || 0) + n;
    m.ultimaGeracao = new Date().toISOString();
    await store.set(KEY_META, m);
    setMeta({ ...m });
  }, []);

  const kbUsados = () => {
    try {
      return Math.round(JSON.stringify(empresasRef.current).length / 1024);
    } catch {
      return 0;
    }
  };

  return { empresas, status, meta, setMeta, toast, salvarEmpresa, excluirEmpresa, exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast };
}

function Toast({ toast }) {
  if (!toast) return null;
  const color = { ok: BRAND.green2, erro: BRAND.danger, aviso: BRAND.warn }[toast.tipo] || BRAND.blue;
  return (
    <div
      style={{
        position: "fixed",
        bottom: 20,
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 9999,
        padding: "11px 18px",
        borderRadius: 12,
        background: "rgba(7,17,31,.96)",
        border: `1.5px solid ${color}`,
        color: BRAND.text,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: "0 16px 42px rgba(0,0,0,.55)",
        maxWidth: "90vw",
        display: "flex",
        alignItems: "center",
        gap: 9,
        whiteSpace: "normal",
      }}
    >
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0 }} />
      {toast.msg}
    </div>
  );
}

function OrcaFlowLogo({ onClick }) {
  return (
    <button
      onClick={onClick}
      title="Voltar ao início"
      style={{
        display: "flex",
        alignItems: "center",
        background: "transparent",
        border: "none",
        cursor: "pointer",
        padding: 0,
        margin: 0,
      }}
    >
      <img
        src="/logo-orcaflow.png"
        alt="OrçaFlow"
        style={{
          height: 68,
          width: "auto",
          maxWidth: 280,
          objectFit: "contain",
          display: "block",
          filter: "drop-shadow(0 8px 22px rgba(0, 176, 255, .22))",
        }}
      />
    </button>
  );
}

function Lbl({ c, err }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        color: err ? BRAND.danger : "#6B7A90",
        letterSpacing: 1.15,
        marginBottom: 6,
      }}
    >
      {c}
      {err && ` — ${err}`}
    </div>
  );
}

function Sec({ t, children, action }) {
  return (
    <div style={{ marginBottom: 21 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          fontSize: UI.title,
          fontWeight: 900,
          color: BRAND.green,
          letterSpacing: 1.4,
          marginBottom: 12,
          paddingBottom: 7,
          borderBottom: `1px solid ${BRAND.border}`,
        }}
      >
        <span>{t}</span>
        {action}
      </div>
      {children}
    </div>
  );
}

function Row({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gap: 12,
      }}
    >
      {children}
    </div>
  );
}

function RelatorioPendenteNara({ relatorio, onEnviar, onCopiar, onDispensar }) {
  if (!relatorio?.texto) return null;
  return (
    <div style={{
      position: "fixed",
      right: 18,
      bottom: 76,
      zIndex: 80,
      width: "min(440px, calc(100vw - 36px))",
      background: "linear-gradient(135deg, rgba(7,17,31,.98), rgba(12,28,48,.98))",
      border: `1px solid ${BRAND.green2}66`,
      borderRadius: 16,
      boxShadow: "0 24px 80px rgba(0,0,0,.45)",
      padding: 14,
      color: BRAND.text,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <div style={{ color: BRAND.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>MODO ASSISTIDO</div>
          <div style={{ fontSize: 15, fontWeight: 950, marginTop: 4 }}>{relatorio.titulo || "Relatorio semanal da Nara"}</div>
          <div style={{ color: BRAND.muted, fontSize: 11, marginTop: 4 }}>
            Gerado em {relatorio.geradoEm ? tsFmt(relatorio.geradoEm) : "agora"}. A Nara preparou tudo; o envio depende do seu clique.
          </div>
        </div>
        <button onClick={onDispensar} title="Dispensar" style={{ border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, borderRadius: 9, padding: "5px 8px", cursor: "pointer" }}>×</button>
      </div>
      <div style={{ marginTop: 10, padding: 10, borderRadius: 12, background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.muted, fontSize: 11, lineHeight: 1.5, maxHeight: 118, overflow: "hidden", whiteSpace: "pre-wrap" }}>
        {String(relatorio.texto).slice(0, 520)}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
        <button onClick={onEnviar} className="of-neon-btn" style={{ padding: "9px 12px", borderRadius: 11, cursor: "pointer" }}>Abrir WhatsApp</button>
        <button onClick={onCopiar} style={{ padding: "9px 12px", borderRadius: 11, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}12`, color: "#93C5FD", cursor: "pointer", fontWeight: 900 }}>Copiar</button>
        <button onClick={onDispensar} style={{ padding: "9px 12px", borderRadius: 11, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 900 }}>Ja resolvi</button>
      </div>
    </div>
  );
}

function ModalEmpresa({ empresa, onSave, onCancel, salvando, pushToast }) {
  const [form, setForm] = useState({ ...empVazio(), ...empresa });
  const [aba, setAba] = useState("dados");
  const [erros, setErros] = useState({});
  const [importandoCNPJ, setImportandoCNPJ] = useState(false);
  const refLogo = useRef(null);
  const refPapel = useRef(null);
  const refCNPJ = useRef(null);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));

  const uploadImagem = (key, nomeKey, e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > 2_097_152) {
      alert("Máximo 2 MB por imagem.");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      set(key, ev.target.result);
      set(nomeKey, file.name);
    };
    reader.onerror = () => alert("Erro ao ler arquivo.");
    reader.readAsDataURL(file);
  };

  const uploadPapelTimbrado = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";

    if (!file) return;

    const nome = String(file.name || "").toLowerCase();
    const isPdf = file.type === "application/pdf" || nome.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");

    if (!isPdf && !isImage) {
      pushToast("Envie o papel timbrado em PDF, PNG ou JPG.", "erro");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      pushToast("Arquivo muito grande. Envie até 8 MB.", "erro");
      return;
    }

    try {
      let resultado;

      if (isPdf) {
        pushToast("Lendo papel timbrado e capturando medidas...", "aviso");
        resultado = await pdfParaImagemTimbrado(file);
      } else {
        const dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (ev) => resolve(ev.target.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        resultado = await imagemParaTimbrado(dataUrl);
      }

      set("papelTimbrado", resultado.imagem);
      set("papelTimbradoNome", file.name);
      set("timbradoLarguraPt", resultado.larguraPt);
      set("timbradoAlturaPt", resultado.alturaPt);
      set("altoCabecalho", resultado.altoCabecalho);
      set("altoRodape", resultado.altoRodape);
      if (resultado.cores?.primaria) set("corPrimaria", resultado.cores.primaria);
      if (resultado.cores?.secundaria) set("corSecundaria", resultado.cores.secundaria);

      pushToast(
        `Timbrado anexado. Cabeçalho ~${resultado.altoCabecalho}pt, rodapé ~${resultado.altoRodape}pt${resultado.cores?.primaria ? " e cores do timbrado detectadas" : ""}.`,
        "ok"
      );
    } catch (error) {
      console.error("Erro ao processar papel timbrado:", error);
      pushToast("Erro ao processar o papel timbrado.", "erro");
    }
  };

  const importarCartao = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/pdf/i.test(file.type) && !/\.pdf$/i.test(file.name)) {
      pushToast("Envie um PDF do Cartão CNPJ.", "erro");
      return;
    }
    setImportandoCNPJ(true);
    try {
      const texto = await lerTextoPDF(file, { maxPages: 2, maxChars: 25000 });
      const temTextoPesquisavel = Boolean(texto && texto.trim().length >= 40);
      let imagemCartao = "";
      if (!temTextoPesquisavel) {
        pushToast("PDF sem texto pesquisavel. Fazendo leitura visual com IA...", "aviso");
        imagemCartao = await pdfParaImagemCartaoCNPJ(file);
      }
      if (false && (!texto || texto.trim().length < 40)) {
        throw new Error("Este PDF parece ser imagem ou não possui texto pesquisável. Será necessário OCR.");
      }

      let dados;
      let origem = imagemCartao ? "IA visual" : "IA";

      try {
        const response = await fetch("/api/read-company-card", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(await authHeaders()),
          },
          body: JSON.stringify({
            filename: file.name,
            texto,
            imagem: imagemCartao,
          }),
        });

        let data = {};
        try {
          data = await response.json();
        } catch {
          throw new Error("A resposta da IA veio inválida.");
        }

        if (!response.ok) throw new Error(data.error || "Erro ao ler Cartão CNPJ com IA.");
        dados = data.dados || {};
      } catch (iaError) {
        if (!temTextoPesquisavel) {
          throw new Error(iaError.message || "O PDF nao tem texto pesquisavel e a leitura visual da IA falhou.");
        }
        console.warn("Leitura com IA indisponível, usando leitor local:", iaError);
        dados = extrairDadosCartaoCNPJ(texto);
        origem = "leitor local";
      }

      setForm((prev) => {
        const next = { ...prev };
        const put = (campo, valor) => {
          if (valor && !String(next[campo] || "").trim()) next[campo] = valor;
        };
        put("nome", dados.nome);
        put("nomeFantasia", dados.nomeFantasia);
        put("cnpj", formatCNPJ(dados.cnpj || ""));
        put("email", dados.email);
        put("telefone", formatTelefone(dados.telefone || ""));
        put("site", dados.site);
        put("endereco", dados.endereco);
        if (!next.assinatura && dados.assinatura) next.assinatura = dados.assinatura;
        if (!next.assinatura && (dados.nome || prev.nome)) {
          next.assinatura = assinaturaDocumento({ ...next, nome: dados.nome || prev.nome });
        }
        if (!next.rodape && dados.rodape) next.rodape = dados.rodape;
        if (!next.rodape) {
          const parts = [dados.nome || prev.nome, dados.cnpj, dados.email, dados.telefone].filter(Boolean);
          next.rodape = parts.join(" | ");
        }
        return next;
      });
      pushToast(`Dados do Cartão CNPJ importados com ${origem}. Confira antes de salvar.`, "ok");
    } catch (error) {
      console.error(error);
      pushToast(error.message || "Não foi possível ler o PDF. Se for escaneado como imagem, será necessário OCR.", "erro");
    } finally {
      setImportandoCNPJ(false);
    }
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = "obrigatório";
    setErros(e);
    return !Object.keys(e).length;
  };

  const INP = {
    width: "100%",
    background: BRAND.panel2,
    border: `1px solid ${BRAND.border2}`,
    borderRadius: 9,
    padding: "10px 12px",
    color: BRAND.text,
    fontSize: UI.text,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "all .22s ease",
  };
  const TXT = { ...INP, resize: "vertical", lineHeight: 1.65 };


  const ABAS = [
    ["dados", "📋 Dados"],
    ["linguagem", "✍️ Linguagem"],
    ["documento", "📄 Documento"],
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,.92)",
        backdropFilter: "blur(10px)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 12,
      }}
    >
      <div
        style={{
          background: BRAND.panel,
          border: `1px solid ${BRAND.border}`,
          borderRadius: 18,
          width: "100%",
          maxWidth: 900,
          maxHeight: "92vh",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 28px 90px rgba(0,0,0,.86)",
          animation: "ofModalIn .22s ease both",
        }}
      >
        <div style={{ padding: "15px 20px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 900, color: BRAND.text }}>{!empresa.nome ? "Nova Empresa" : `Editando: ${form.nome || "—"}`}</div>
            <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3 }}>{empresa.criadaEm ? `Criada ${tsFmt(empresa.criadaEm)}` : "Novo cadastro"} · …{form.id.slice(-6)}</div>
          </div>
          <button onClick={onCancel} style={{ background: "transparent", border: `1px solid ${BRAND.border2}`, color: BRAND.muted, width: 32, height: 32, borderRadius: 9, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>

        <div style={{ display: "flex", background: BRAND.panel2, borderBottom: `1px solid ${BRAND.border}`, overflowX: "auto" }}>
          {ABAS.map(([id, lbl]) => (
            <button
              key={id}
              onClick={() => setAba(id)}
              style={{
                padding: "10px 18px",
                border: "none",
                background: "transparent",
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 850,
                whiteSpace: "nowrap",
                color: aba === id ? BRAND.green : BRAND.dim,
                borderBottom: `2px solid ${aba === id ? BRAND.green : "transparent"}`,
                transition: "all .22s ease",
              }}
            >
              {lbl}
            </button>
          ))}
        </div>

        <div style={{ overflowY: "auto", padding: "20px", flex: 1 }}>
          {aba === "dados" && (
            <>
              <Sec
                t="CARTÃO CNPJ"
                action={
                  <button
                    onClick={() => refCNPJ.current?.click()}
                    disabled={importandoCNPJ}
                    style={{
                      padding: "8px 13px",
                      borderRadius: 9,
                      border: `1px solid ${BRAND.green2}55`,
                      background: importandoCNPJ ? BRAND.border2 : `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`,
                      color: "#fff",
                      cursor: importandoCNPJ ? "not-allowed" : "pointer",
                      fontSize: 11.5,
                      fontWeight: 900,
                      boxShadow: importandoCNPJ ? "none" : `0 8px 24px ${BRAND.green2}33`,
                    }}
                  >
                    {importandoCNPJ ? "IA lendo PDF…" : "📎 Anexar Cartão CNPJ"}
                  </button>
                }
              >
                <input ref={refCNPJ} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={importarCartao} />
                <div style={{ padding: "12px 14px", background: `${BRAND.blue2}12`, border: `1px solid ${BRAND.blue2}2a`, borderRadius: 10, color: "#A7C7FF", fontSize: 12.2, lineHeight: 1.6 }}>
                  Envie o PDF oficial do Cartão CNPJ. A IA lê o texto extraído do PDF e preenche razão social, CNPJ, telefone, e-mail, endereço, assinatura e rodapé. PDFs escaneados como imagem precisam de OCR.
                </div>
              </Sec>

              <Sec t="IDENTIFICAÇÃO">
                <Row>
                  <div>
                    <Lbl c="RAZÃO SOCIAL *" err={erros.nome} />
                    <input style={{ ...INP, borderColor: erros.nome ? BRAND.danger : BRAND.border2 }} value={form.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Nome completo da empresa" />
                  </div>
                  <div>
                    <Lbl c="NOME FANTASIA" />
                    <input style={INP} value={form.nomeFantasia || ""} onChange={(e) => set("nomeFantasia", e.target.value)} placeholder="Nome fantasia" />
                  </div>
                  <div>
                    <Lbl c="CNPJ" />
                    <input style={INP} value={form.cnpj} onChange={(e) => set("cnpj", formatCNPJ(e.target.value))} placeholder="00.000.000/0001-00" />
                  </div>
                  <div>
                    <Lbl c="E-MAIL" />
                    <input style={INP} value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@empresa.com.br" />
                  </div>
                  <div>
                    <Lbl c="TELEFONE" />
                    <input style={INP} value={form.telefone} onChange={(e) => set("telefone", formatTelefone(e.target.value))} placeholder="(00) 00000-0000" />
                  </div>
                  <div>
                    <Lbl c="SITE" />
                    <input style={INP} value={form.site} onChange={(e) => set("site", e.target.value)} placeholder="www.empresa.com.br" />
                  </div>
                  <div style={{ gridColumn: "1 / -1" }}>
                    <Lbl c="ENDEREÇO" />
                    <input style={INP} value={form.endereco} onChange={(e) => set("endereco", e.target.value)} placeholder="Rua, Nº — Cidade/UF" />
                  </div>
                </Row>
              </Sec>

              <Sec t="PERFIL COMERCIAL">
                <div style={{ marginBottom: 12 }}>
                  <Lbl c="ASSINATURA DO DOCUMENTO" />
                  <input style={INP} value={form.assinatura} onChange={(e) => set("assinatura", e.target.value)} placeholder="Ex: Depto Comercial · Empresa S.A." />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Lbl c="RODAPÉ DO DOCUMENTO" />
                  <input style={INP} value={form.rodape} onChange={(e) => set("rodape", e.target.value)} placeholder="Ex: Empresa S.A. | CNPJ | E-mail | Tel" />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <Lbl c="DIFERENCIAIS (separe por vírgula)" />
                  <input style={INP} value={form.diferenciais} onChange={(e) => set("diferenciais", e.target.value)} placeholder="Ex: Suporte 24/7, SLA garantido, equipe certificada" />
                </div>
                <div>
                  <Lbl c="TOM DE VOZ" />
                  <select style={INP} value={form.tom} onChange={(e) => set("tom", e.target.value)}>
                    {TONS.map((t) => (
                      <option key={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </Sec>
            </>
          )}

          {aba === "linguagem" && (
            <>
              <Sec t="DNA DE LINGUAGEM DA EMPRESA">
                <div style={{ marginBottom: 14, padding: "12px 14px", background: `${BRAND.blue2}0e`, border: `1px solid ${BRAND.blue2}25`, borderRadius: 10, fontSize: 12, color: "#93C5FD", lineHeight: 1.7 }}>
                  Cole textos reais da empresa: propostas antigas, e-mails, apresentações ou site. A IA usa esse material como referência de linguagem.
                </div>
                <Lbl c="EXEMPLOS DE TEXTO / MATERIAL DE REFERÊNCIA" />
                <textarea
                  value={form.dnaLinguagem || ""}
                  onChange={(e) => set("dnaLinguagem", e.target.value)}
                  rows={12}
                  placeholder="Cole aqui exemplos reais de comunicação desta empresa..."
                  style={{ ...TXT, minHeight: 220 }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: (form.dnaLinguagem || "").length > 100 ? BRAND.green : BRAND.dim }}>
                    {(form.dnaLinguagem || "").length > 100 ? "✓ DNA suficiente" : "⚠ Adicione mais exemplos para melhorar o resultado"}
                  </span>
                  <span style={{ fontSize: 10, color: BRAND.dim }}>{(form.dnaLinguagem || "").length} chars</span>
                </div>
              </Sec>

              <Sec t="ESTRUTURA DO ORÇAMENTO">
                <Lbl c="INSTRUÇÕES DE ESTRUTURA (opcional)" />
                <textarea
                  value={form.estruturaOrcamento || ""}
                  onChange={(e) => set("estruturaOrcamento", e.target.value)}
                  rows={6}
                  placeholder="Ex: iniciar com objetivo, depois escopo técnico, condições comerciais e fechamento..."
                  style={TXT}
                />
              </Sec>

              <Sec t="PADRAO DOCUMENTAL E VISUAL">
                <div style={{ marginBottom: 12 }}>
                  <Lbl c="PADRAO DOCUMENTAL PROPRIO" />
                  <textarea
                    value={form.padraoDocumental || ""}
                    onChange={(e) => set("padraoDocumental", e.target.value)}
                    rows={5}
                    placeholder="Ex: proposta objetiva, com foco em escopo executivo; evitar textos longos; trazer tabela antes das consideracoes..."
                    style={TXT}
                  />
                </div>
                <div>
                  <Lbl c="ASSINATURA VISUAL / DNA DO PDF" />
                  <textarea
                    value={form.assinaturaVisual || ""}
                    onChange={(e) => set("assinaturaVisual", e.target.value)}
                    rows={4}
                    placeholder="Ex: linguagem visual tecnica, secoes curtas, titulos diretos, fechamento institucional, uso forte do timbrado..."
                    style={TXT}
                  />
                </div>
              </Sec>
            </>
          )}

          {aba === "documento" && (
            <>
              <Sec t="LOGO E PAPEL TIMBRADO">
                <Row>
                  <div>
                    <Lbl c="LOGO DA EMPRESA" />
                    <div onClick={() => refLogo.current?.click()} style={{ border: `2px dashed ${BRAND.border2}`, borderRadius: 12, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: BRAND.panel2, minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all .22s ease" }}>
                      {form.logo ? (
                        <>
                          <img src={form.logo} alt="logo" style={{ maxHeight: 62, maxWidth: "100%", objectFit: "contain" }} />
                          <div style={{ fontSize: 10, color: BRAND.green, marginTop: 8 }}>✓ {form.logoNome}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 28, opacity: 0.35, marginBottom: 6 }}>🖼</div>
                          <div style={{ fontSize: 12, color: BRAND.muted }}>Clique para enviar</div>
                          <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 2 }}>PNG · JPG · SVG · max 2 MB</div>
                        </>
                      )}
                    </div>
                    <input ref={refLogo} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadImagem("logo", "logoNome", e)} />
                    {form.logo && <button onClick={() => { set("logo", null); set("logoNome", ""); }} style={{ marginTop: 7, width: "100%", padding: "6px", borderRadius: 8, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontSize: 11 }}>Remover logo</button>}
                  </div>

                  <div>
                    <Lbl c="PAPEL TIMBRADO" />
                    <div onClick={() => refPapel.current?.click()} style={{ border: `2px dashed ${BRAND.border2}`, borderRadius: 12, padding: "18px 12px", textAlign: "center", cursor: "pointer", background: BRAND.panel2, minHeight: 100, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transition: "all .22s ease" }}>
                      {form.papelTimbrado ? (
                        <>
                          <img src={form.papelTimbrado} alt="timbrado" style={{ maxHeight: 62, maxWidth: "100%", objectFit: "contain", opacity: 0.9 }} />
                          <div style={{ fontSize: 10, color: BRAND.green, marginTop: 8 }}>✓ {form.papelTimbradoNome}</div>
                        </>
                      ) : (
                        <>
                          <div style={{ fontSize: 28, opacity: 0.35, marginBottom: 6 }}>📑</div>
                          <div style={{ fontSize: 12, color: BRAND.muted }}>Enviar papel timbrado</div>
                          <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 2 }}>PDF · PNG · JPG · A4 · max 8 MB</div>
                        </>
                      )}
                    </div>
                    <input
                      ref={refPapel}
                      type="file"
                      accept="image/*,application/pdf,.pdf"
                      style={{ display: "none" }}
                      onChange={uploadPapelTimbrado}
                    />
                    {form.papelTimbrado && (
                      <>
                        <button onClick={() => { set("papelTimbrado", null); set("papelTimbradoNome", ""); }} style={{ marginTop: 7, width: "100%", padding: "6px", borderRadius: 8, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontSize: 11 }}>Remover timbrado</button>
                        <div style={{ marginTop: 10, padding: "8px 10px", borderRadius: 8, background: `${BRAND.green2}12`, border: `1px solid ${BRAND.green2}33`, fontSize: 10.5, color: BRAND.green, lineHeight: 1.5 }}>
                          ✓ Medidas capturadas automaticamente do arquivo. O corpo do orçamento fica sempre entre o cabeçalho e o rodapé do timbrado. Ajuste fino abaixo se precisar.
                        </div>
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <Lbl c={`ZONA DO CABEÇALHO: ${form.altoCabecalho} pt`} />
                            <input type="range" min={40} max={Math.round((form.timbradoAlturaPt || 842) * 0.5)} value={form.altoCabecalho} onChange={(e) => set("altoCabecalho", Number(e.target.value))} style={{ width: "100%", accentColor: BRAND.green }} />
                          </div>
                          <div>
                            <Lbl c={`ZONA DO RODAPÉ: ${form.altoRodape} pt`} />
                            <input type="range" min={24} max={Math.round((form.timbradoAlturaPt || 842) * 0.4)} value={form.altoRodape} onChange={(e) => set("altoRodape", Number(e.target.value))} style={{ width: "100%", accentColor: BRAND.green }} />
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                </Row>
              </Sec>

              <Sec t="TIPOGRAFIA DO DOCUMENTO">
                <Row>
                  <div>
                    <Lbl c="FONTE DO TÍTULO" />
                    <select style={INP} value={form.fonteTitulo} onChange={(e) => set("fonteTitulo", e.target.value)}>
                      {FONTES.map((f) => <option key={f.id} value={f.id}>[{f.cat}] {f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="TAMANHO DO TÍTULO" />
                    <select style={INP} value={form.tamanhoTitulo} onChange={(e) => set("tamanhoTitulo", Number(e.target.value))}>
                      {T_TITULO.map((t) => <option key={t} value={t}>{t}px</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="FONTE DO CORPO" />
                    <select style={INP} value={form.fonteCorpo} onChange={(e) => set("fonteCorpo", e.target.value)}>
                      {FONTES.map((f) => <option key={f.id} value={f.id}>[{f.cat}] {f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <Lbl c="TAMANHO DO CORPO" />
                    <select style={INP} value={form.tamanhoCorpo} onChange={(e) => set("tamanhoCorpo", Number(e.target.value))}>
                      {T_CORPO.map((t) => <option key={t} value={t}>{t}px</option>)}
                    </select>
                  </div>
                </Row>
              </Sec>
            </>
          )}
        </div>

        <div style={{ padding: "13px 20px", borderTop: `1px solid ${BRAND.border}`, display: "flex", justifyContent: "space-between", alignItems: "center", background: BRAND.panel2 }}>
          <div style={{ fontSize: 10, color: BRAND.dim, fontFamily: "monospace" }}>ID: {form.id.slice(-10)}</div>
          <div style={{ display: "flex", gap: 9 }}>
            <button onClick={onCancel} style={{ padding: "9px 18px", borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 12.5, fontWeight: 700 }}>Cancelar</button>
            <button onClick={() => validar() && onSave(form)} disabled={salvando} style={{ padding: "9px 24px", borderRadius: 10, border: "none", background: salvando ? BRAND.border2 : `linear-gradient(135deg, ${BRAND.green2}, #15803D)`, color: salvando ? BRAND.dim : "#fff", cursor: salvando ? "not-allowed" : "pointer", fontSize: 12.5, fontWeight: 900, boxShadow: salvando ? "none" : `0 8px 22px ${BRAND.green2}35` }}>{salvando ? "Salvando…" : "💾 Salvar no Banco"}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MateriaisTabela({ emp, dados, perfil }) {
  const rows = materialRows(dados);
  if (!rows.length) return null;

  const total = materialTotal(rows);
  const tipo = perfil?.tipo || perfilVisualEmpresa(emp, dados).tipo;
  const cor = corDocumento(emp, perfil, "primaria");
  const corSec = corDocumento(emp, perfil, "secundaria");

  if (tipo === "operacional") {
    return (
      <div style={{ marginTop: 10 }}>
        <div style={{ display: "grid", gap: 8 }}>
          {rows.map((item, i) => (
            <div key={`${item.descricao}-${i}`} style={{ display: "grid", gridTemplateColumns: "1fr 72px 110px", gap: 10, alignItems: "center", padding: "10px 12px", borderLeft: `5px solid ${cor}`, background: i % 2 === 0 ? "#F8FAFC" : "#FFFFFF", borderBottom: "1px solid #E2E8F0" }}>
              <div style={{ fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000", lineHeight: 1.35 }}>
                <strong>{String(i + 1).padStart(2, "0")}</strong> - {item.descricao}
                {item.observacao && <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{item.observacao}</div>}
              </div>
              <div style={{ textAlign: "center", color: "#000", fontSize: 10, fontWeight: 800 }}>{item.quantidade || 1} {item.unidade || "un"}</div>
              <div style={{ textAlign: "right", color: "#000", fontSize: 12, fontWeight: 900 }}>{brl(item.subtotal)}</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 10, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ borderTop: `2px solid ${cor}`, paddingTop: 7, minWidth: 190, textAlign: "right", color: "#000", fontWeight: 950 }}>TOTAL DOS ITENS: {brl(total)}</div>
        </div>
      </div>
    );
  }

  if (tipo === "consultoria") {
    return (
      <div style={{ marginTop: 12, overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620, borderTop: "2px solid #111827", borderBottom: "1px solid #CBD5E1" }}>
          <thead>
            <tr>
              {["DESCRICAO", "QTD", "UN", "VALOR UNIT.", "VALOR FINAL"].map((h, i) => (
                <th key={h} style={{ padding: "8px 8px", color: "#111827", textAlign: i === 0 ? "left" : "right", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.1, fontWeight: 900, borderBottom: "1px solid #CBD5E1" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((item, i) => (
              <tr key={`${item.descricao}-${i}`} style={{ borderBottom: "1px solid #E2E8F0" }}>
                <td style={{ padding: "9px 8px", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000", minWidth: 220 }}>{item.descricao}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: "#000", fontSize: 10 }}>{item.quantidade || 1}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: "#000", fontSize: 10 }}>{item.unidade || "un"}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: "#000", fontSize: 10 }}>{brl(item.valorUnitario)}</td>
                <td style={{ padding: "9px 8px", textAlign: "right", color: "#000", fontSize: 11, fontWeight: 850 }}>{brl(item.subtotal)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={4} style={{ padding: "10px 8px", textAlign: "right", color: "#000", fontSize: 10, fontWeight: 850 }}>Valor consolidado dos itens</td>
              <td style={{ padding: "10px 8px", textAlign: "right", color: "#000", fontSize: 12, fontWeight: 950 }}>{brl(total)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 620 }}>
        <thead>
          <tr style={{ background: cor }}>
            {["ITEM", "QTD", "UN", "VALOR UNIT.", "VALOR FINAL"].map((h, i) => (
              <th key={h} style={{ padding: "8px 10px", color: "#fff", textAlign: i === 0 ? "left" : "right", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.2, fontWeight: 900 }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((item, i) => (
            <tr key={`${item.descricao}-${i}`} style={{ background: i % 2 === 0 ? `${cor}0a` : emp.corFundo || "#fff", borderBottom: `1px solid ${cor}18` }}>
              <td style={{ padding: "9px 10px", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000", minWidth: 210 }}>
                {item.descricao}
                {item.observacao && <div style={{ fontSize: 9, color: "#475569", marginTop: 2 }}>{item.observacao}</div>}
              </td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{item.quantidade || 1}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{item.unidade || "un"}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{brl(item.valorUnitario)}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11, fontWeight: 850 }}>{brl(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={3} style={{ padding: "10px", textAlign: "right", color: "#000", fontSize: 10, fontWeight: 850 }}>
              Total dos itens
            </td>
            <td style={{ padding: "10px", textAlign: "right", color: "#000", fontSize: 11, fontWeight: 900 }}>TOTAL</td>
            <td style={{ padding: "10px", textAlign: "right", color: "#000", fontSize: 12, fontWeight: 950 }}>{brl(total)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function OrcamentoDoc({ emp, dados, editando, onChange }) {
  const difs = (emp.diferenciais || "").split(",").map((d) => d.trim()).filter(Boolean);
  const perfil = perfilVisualEmpresa(emp, dados);
  const cor = corDocumento(emp, perfil, "primaria");
  const corSec = corDocumento(emp, perfil, "secundaria");
  const exibirCodigoDocumento = documentoExibeCodigo(perfil);

  const F = ({ campo, multiline }) => {
    const val = dados.campos?.[campo] || "";
    const base = {
      width: "100%",
      border: `1.5px dashed ${cor}`,
      borderRadius: 6,
      padding: "7px 10px",
      fontFamily: emp.fonteCorpo,
      fontSize: Number(emp.tamanhoCorpo) || 12,
      color: "#000000",
      background: emp.corFundo || "#fff",
      outline: "none",
      lineHeight: 1.75,
      boxSizing: "border-box",
    };
    if (!editando) return <span style={{ fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000000" }}>{val}</span>;
    return multiline ? <textarea value={val} rows={3} onChange={(e) => onChange(campo, e.target.value)} style={{ ...base, resize: "vertical", minHeight: 58 }} /> : <input value={val} onChange={(e) => onChange(campo, e.target.value)} style={base} />;
  };

  const secLbl = { fontSize: 9, fontWeight: 900, color: "#000000", letterSpacing: 2.2, fontFamily: "sans-serif", marginBottom: 7, display: "block" };
  const docTitle = getDocTitle(dados, perfil).toUpperCase();

  const renderItens = () => {
    if (!dados.itensIA?.length) return null;
    return (
      <div key="itens" style={{ marginBottom: 18 }}>
        <span style={secLbl}>{getSectionLabel(dados, "itens")}</span>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: cor }}><th style={{ padding: "9px 13px", color: "#fff", textAlign: "left", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900 }}>DESCRICAO DA ETAPA / ITEM</th><th style={{ padding: "9px 13px", color: "#fff", textAlign: "center", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900, width: 86 }}>STATUS</th></tr></thead>
          <tbody>
            {dados.itensIA.map((it, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? `${cor}0a` : emp.corFundo || "#fff", borderBottom: `1px solid ${cor}18` }}>
                <td style={{ padding: "10px 13px", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000000" }}>{it}</td>
                <td style={{ padding: "10px 13px", textAlign: "center" }}><span style={{ padding: "3px 9px", borderRadius: 12, background: `${cor}18`, color: corSec, fontSize: 8.5, fontWeight: 800 }}>Incluido</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderSection = (key) => {
    if (key === "itens") return renderItens();

    if (key === "materiais") {
      const hasTable = materialRows(dados).length > 0;
      const hasText = Boolean(dados.campos?.materiais);
      if (!hasTable && !hasText && !editando) return null;
      return (
        <div key="materiais" style={{ marginBottom: 18 }}>
          <span style={secLbl}>{getSectionLabel(dados, "materiais")}</span>
          {hasText || editando ? <div style={{ lineHeight: 1.85, marginBottom: hasTable ? 10 : 0 }}><F campo="materiais" multiline /></div> : null}
          <MateriaisTabela emp={emp} dados={dados} perfil={perfil} />
        </div>
      );
    }

    const val = dados.campos?.[key] || "";
    const required = key === "intro" || key === "escopo";
    if (!required && !val && !editando) return null;

    const content = <div style={{ lineHeight: 1.85 }}><F campo={key} multiline /></div>;
    if (key === "fechamento") {
      return (
        <div key={key} style={{ marginBottom: 22, padding: "13px 15px", borderRadius: 9, background: `${cor}0a`, borderLeft: `4px solid ${cor}` }}>
          <span style={secLbl}>{getSectionLabel(dados, key)}</span>
          <div style={{ fontStyle: "italic" }}>{content}</div>
        </div>
      );
    }

    return (
      <div key={key} style={{ marginBottom: 18 }}>
        <span style={secLbl}>{getSectionLabel(dados, key)}</span>
        {content}
      </div>
    );
  };

  return (
    <div style={{ background: emp.corFundo || "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 44px rgba(0,0,0,.2)", animation: "ofCardIn .28s ease both" }}>
      {emp.papelTimbrado ? (
        <div style={{ position: "relative", overflow: "hidden" }}>
          <img src={emp.papelTimbrado} style={{ width: "100%", height: "auto", display: "block" }} alt="" />
          {exibirCodigoDocumento && (
            <div style={{ position: "absolute", top: 10, right: 18, background: "rgba(0,0,0,.58)", backdropFilter: "blur(4px)", borderRadius: 9, padding: "8px 13px", textAlign: "right" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,.72)", letterSpacing: 1.5 }}>{perfil.numeroLabel}</div>
              <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            </div>
          )}
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${cor}, ${corSec})`, padding: "22px 28px", minHeight: emp.altoCabecalho || 120, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {emp.logo ? <img src={emp.logo} style={{ maxHeight: 48, maxWidth: 150, objectFit: "contain", display: "block", marginBottom: 6 }} alt="" /> : <div style={{ fontFamily: emp.fonteTitulo, fontSize: Number(emp.tamanhoTitulo) || 24, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{emp.nome}</div>}
            <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.78)", fontFamily: "sans-serif" }}>{assinaturaDocumento(emp, perfil)}</div>
          </div>
          {exibirCodigoDocumento && (
            <div style={{ textAlign: "right", background: "rgba(0,0,0,.18)", borderRadius: 10, padding: "11px 16px" }}>
              <div style={{ fontSize: 8, color: "rgba(255,255,255,.65)", letterSpacing: 1.5 }}>{perfil.numeroLabel}</div>
              <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            </div>
          )}
        </div>
      )}

      <div style={{ padding: "25px 30px" }}>
        <div style={{ marginBottom: 18, padding: "12px 15px", background: `${cor}14`, borderRadius: 9, borderLeft: `4px solid ${cor}` }}>
          <span style={secLbl}>{perfil.clienteLabel}</span>
          <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) + 1, fontWeight: 800, color: "#000000" }}><F campo="cliente" /></div>
        </div>

        {dados.identidadeDocumento?.subtitulo && (
          <div style={{ marginBottom: 18, color: "#475569", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, fontStyle: "italic" }}>
            {dados.identidadeDocumento.subtitulo}
          </div>
        )}

        {getSectionOrder(dados, perfil).map(renderSection)}

        <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: `linear-gradient(135deg, ${cor}, ${corSec})`, borderRadius: 11, padding: "15px 23px", color: "#fff", textAlign: "right", minWidth: 210 }}>
            <div style={{ fontSize: 8, opacity: 0.82, letterSpacing: 2, marginBottom: 4 }}>{perfil.valorLabel}</div>
            <div style={{ fontFamily: emp.fonteTitulo, fontSize: Math.round((Number(emp.tamanhoTitulo) || 24) * 0.82), fontWeight: 950 }}>{brl(dados.valorGlobal)}</div>
          </div>
        </div>

        {difs.length > 0 && <div style={{ marginBottom: 18 }}><span style={secLbl}>DIFERENCIAIS</span><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{difs.map((d, i) => <span key={i} style={{ padding: "5px 12px", background: `${cor}12`, border: `1px solid ${cor}30`, borderRadius: 20, fontSize: 10, color: corSec, fontWeight: 800 }}>{d}</span>)}</div></div>}

        {perfil.assinatura !== "fornecedor-compacto" && <div style={{ borderTop: `2px solid ${cor}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ width: 170, borderBottom: `1px solid ${cor}44`, marginBottom: 7 }} />
            <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) - 1, fontWeight: 800, color: "#000000", overflowWrap: "anywhere" }}>{assinaturaDocumento(emp, perfil)}</div>
            
          </div>
          {emp.logo && <img src={emp.logo} style={{ maxHeight: 36, maxWidth: 110, objectFit: "contain", opacity: 0.18 }} alt="" />}
        </div>}
      </div>

      <div style={{ background: emp.papelTimbrado ? `${cor}14` : "#0F172A", borderTop: `1px solid ${cor}22`, padding: "9px 28px", textAlign: "center" }}>
        <div style={{ fontFamily: emp.fonteCorpo, fontSize: 9.5, color: emp.papelTimbrado ? "#475569" : "#94A3B8", overflowWrap: "anywhere", lineHeight: 1.45 }}>{rodapeDocumento(emp)}</div>
      </div>
    </div>
  );
}
function textoCurto(valor, limite = 900) {
  return clean(valor || "").slice(0, limite);
}

function contextoCompactoChat(empresas = [], crm = [], clientes = []) {
  return {
    empresas: (Array.isArray(empresas) ? empresas : []).slice(0, 24).map((emp) => ({
      nome: emp?.nome || "",
      nomeFantasia: emp?.nomeFantasia || "",
      cnpj: emp?.cnpj || "",
      tom: textoCurto(emp?.tom, 220),
      diferenciais: textoCurto(emp?.diferenciais, 450),
      dnaLinguagem: textoCurto(emp?.dnaLinguagem, 900),
      estruturaOrcamento: textoCurto(emp?.estruturaOrcamento, 700),
      padraoDocumental: textoCurto(emp?.padraoDocumental, 700),
      assinaturaVisual: textoCurto(emp?.assinaturaVisual, 500),
    })),
    crm: (Array.isArray(crm) ? crm : []).slice(0, 35).map((item) => {
      const conversas = Array.isArray(item?.conversas) ? item.conversas : [];
      return {
        numero: item?.numero || "",
        cliente: item?.cliente || "",
        empresaNome: item?.empresaNome || "",
        valorGlobal: item?.valorGlobal ?? item?.valor ?? "",
        status: item?.status || "",
        proximoContato: item?.proximoContato || "",
        lembreteIA: textoCurto(item?.lembreteIA, 450),
        resumoConversas: textoCurto(item?.resumoConversas, 550),
        conversasRecentes: conversas.slice(-3).map((msg) => ({
          canal: msg?.canal || "",
          direcao: msg?.direcao || "",
          tipo: msg?.tipo || "",
          mensagem: textoCurto(msg?.mensagem || msg?.conteudo, 450),
          criadoEm: msg?.criadoEm || "",
        })),
      };
    }),
    clientesCRM: (Array.isArray(clientes) ? clientes : []).slice(0, 30).map((cliente) => {
      const contatos = Array.isArray(cliente?.contatos) ? cliente.contatos : [];
      return {
        nome: cliente?.nome || "",
        empresa: cliente?.empresa || "",
        cargo: cliente?.cargo || "",
        email: cliente?.email || "",
        email2: cliente?.email2 || "",
        telefone: cliente?.telefone || "",
        whatsapp: cliente?.whatsapp || "",
        telefone2: cliente?.telefone2 || "",
        documento: cliente?.documento || "",
        endereco: cliente?.endereco || "",
        cidadeUf: cliente?.cidadeUf || "",
        decisor: cliente?.decisor || "",
        segmento: cliente?.segmento || "",
        status: cliente?.status || "",
        temperatura: cliente?.temperatura || "",
        proximoContato: cliente?.proximoContato || "",
        valorPotencial: cliente?.valorPotencial || "",
        proximoPasso: textoCurto(cliente?.proximoPasso, 500),
        lembreteNara: textoCurto(cliente?.lembreteJade, 500),
        historicoRecente: contatos.slice(0, 4).map((msg) => ({
          canal: msg?.canal || "",
          direcao: msg?.direcao || "",
          tipo: msg?.tipo || "",
          mensagem: textoCurto(msg?.mensagem || msg?.arquivoResumo, 500),
          criadoEm: msg?.criadoEm || "",
        })),
      };
    }),
  };
}

function empresasCompactasParaGeracao(empresas = [], selecao = []) {
  const selecionadas = new Set((Array.isArray(selecao) ? selecao : []).map((item) => item.empId));
  return (Array.isArray(empresas) ? empresas : [])
    .filter((emp) => selecionadas.has(emp.id))
    .map((emp) => ({
      id: emp.id,
      nome: emp.nome || "",
      nomeFantasia: emp.nomeFantasia || "",
      tom: textoCurto(emp.tom, 320),
      dnaLinguagem: textoCurto(emp.dnaLinguagem, 3200),
      estruturaOrcamento: textoCurto(emp.estruturaOrcamento, 1800),
      padraoDocumental: textoCurto(emp.padraoDocumental, 1400),
      assinaturaVisual: textoCurto(emp.assinaturaVisual, 900),
      diferenciais: textoCurto(emp.diferenciais, 600),
      fonteTitulo: emp.fonteTitulo || "",
      fonteCorpo: emp.fonteCorpo || "",
      corPrimaria: emp.corPrimaria || "",
      corSecundaria: emp.corSecundaria || "",
      temPapelTimbrado: Boolean(emp.papelTimbrado),
    }));
}

function ChatIAPanel({ empresas = [], crm = [], clientes = [], pushToast, usuarioAtual }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState("geral");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    (async () => {
      const saved = (await store.get(KEY_CHAT)) || [];
      if (Array.isArray(saved)) setMessages(saved.slice(-80));
    })();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  const persist = async (next) => {
    const limited = next.slice(-80);
    setMessages(limited);
    await store.set(KEY_CHAT, limited);
  };

  const atalhos = [
    {
      id: "email",
      label: "E-mail",
      icon: <Mail size={15} />,
      prompt: "Gere um e-mail profissional para enviar ao cliente sobre o orçamento. Use assunto e corpo.",
    },
    {
      id: "cobranca",
      label: "Cobrança",
      icon: <Bell size={15} />,
      prompt: "Crie uma mensagem de cobrança/follow-up educada para um orçamento enviado e ainda sem retorno.",
    },
    {
      id: "whatsapp",
      label: "WhatsApp",
      icon: <MessageSquareText size={15} />,
      prompt: "Transforme este contexto em uma mensagem curta de WhatsApp para o cliente.",
    },
    {
      id: "resposta_cliente",
      label: "Resposta",
      icon: <Send size={15} />,
      prompt: "Monte uma resposta profissional para o cliente com tom cordial e proximo passo claro.",
    },
    {
      id: "orcamento",
      label: "Orçamento",
      icon: <FileText size={15} />,
      prompt: "Me oriente como escrever o resumo do serviço para a IA gerar um orçamento mais completo.",
    },
  ];

  const enviar = async (textoForcado = "") => {
    const texto = clean(textoForcado || input);
    if (!texto || loading) return;

    const userMsg = { id: `msg_${Date.now()}_u`, role: "user", content: texto, ts: new Date().toISOString() };
    const base = [...messages, userMsg];
    setInput("");
    setLoading(true);
    setMessages(base);

    try {
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode,
          messages: base.slice(-12).map((msg) => ({ role: msg.role, content: textoCurto(msg.content, 3000) })),
          context: {
            ...contextoCompactoChat(empresas, crm, clientes),
            usuarioSistema: {
              nomeTratamento: nomeUsuarioSistema(usuarioAtual),
              assinatura: assinaturaUsuarioSistema(usuarioAtual),
              cargo: usuarioAtual?.cargo || "",
              telefone: usuarioAtual?.telefone || "",
            },
          },
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta do chat veio invalida.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Erro ao consultar a IA.");
      }

      const assistantMsg = {
        id: `msg_${Date.now()}_a`,
        role: "assistant",
        content: clean(data.answer || ""),
        model: data.model || "",
        ts: new Date().toISOString(),
      };
      await persist([...base, assistantMsg]);
    } catch (error) {
      console.error("Erro no chat IA:", error);
      setMessages(messages);
      pushToast(error.message || "Erro no chat com IA.", "erro");
    } finally {
      setLoading(false);
    }
  };

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      pushToast("Texto copiado.", "ok");
    } catch {
      pushToast("Nao foi possivel copiar.", "erro");
    }
  };

  const limpar = async () => {
    await persist([]);
    pushToast("Historico do chat limpo.", "aviso");
  };

  const bubble = (msg) => {
    const isUser = msg.role === "user";
    return (
      <div key={msg.id || `${msg.role}_${msg.ts}`} style={{ display: "flex", justifyContent: isUser ? "flex-end" : "flex-start", marginBottom: 12 }}>
        <div style={{ maxWidth: "min(760px, 86%)", background: isUser ? `linear-gradient(135deg, ${BRAND.green2}, #15803D)` : BRAND.panel, border: `1px solid ${isUser ? `${BRAND.green2}55` : BRAND.border}`, color: isUser ? "#fff" : BRAND.text, borderRadius: 14, padding: "12px 14px", boxShadow: "0 10px 28px rgba(0,0,0,.2)" }}>
          <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.65, fontSize: 13 }}>{msg.content}</div>
          {!isUser && (
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 10 }}>
              <span style={{ fontSize: 10, color: BRAND.dim }}>{msg.model || "IA"}</span>
              <button onClick={() => copiar(msg.content)} title="Copiar" style={{ width: 30, height: 30, display: "grid", placeItems: "center", borderRadius: 8, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer" }}>
                <Copy size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", padding: "18px 16px", maxWidth: 1180, width: "100%", margin: "0 auto", boxSizing: "border-box" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 950, color: BRAND.text }}>Nara - IA Comercial</div>
          <div style={{ fontSize: 12, color: BRAND.dim, marginTop: 3 }}>E-mails, cobrancas, respostas, follow-up e estrategia para orcamentos.</div>
        </div>
        <button onClick={limpar} disabled={!messages.length || loading} title="Limpar historico" style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 9, border: `1px solid ${BRAND.danger}40`, background: "transparent", color: messages.length ? BRAND.danger : BRAND.dim, cursor: messages.length && !loading ? "pointer" : "not-allowed", fontWeight: 850 }}>
          <Trash2 size={15} /> Limpar
        </button>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {atalhos.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              setMode(item.id);
              setInput((atual) => atual || item.prompt);
            }}
            style={{ display: "flex", alignItems: "center", gap: 7, padding: "8px 12px", borderRadius: 10, border: `1px solid ${mode === item.id ? BRAND.green2 : BRAND.border2}`, background: mode === item.id ? `${BRAND.green2}18` : BRAND.panel2, color: mode === item.id ? BRAND.green : BRAND.muted, cursor: "pointer", fontWeight: 850 }}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", background: "rgba(7,17,31,.66)", border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 16, minHeight: 320 }}>
        {!messages.length && (
          <div style={{ height: "100%", minHeight: 260, display: "grid", placeItems: "center", textAlign: "center", color: BRAND.dim }}>
            <div>
              <Bot size={36} style={{ opacity: 0.45, marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 900, color: BRAND.muted, marginBottom: 6 }}>Nara pronta para escrever com voce</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 520 }}>Selecione um atalho ou digite diretamente o que precisa gerar.</div>
            </div>
          </div>
        )}
        {messages.map(bubble)}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "12px 14px", color: BRAND.muted, fontSize: 13 }}>Nara escrevendo...</div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10, marginTop: 12 }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) enviar();
          }}
          rows={3}
          placeholder="Ex: gere um e-mail cobrando retorno do orçamento ORC-123456 com tom educado..."
          style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 12, padding: "12px 14px", color: BRAND.text, fontSize: 13, outline: "none", resize: "vertical", lineHeight: 1.65, fontFamily: "inherit", minHeight: 76 }}
        />
        <button
          onClick={() => enviar()}
          disabled={!input.trim() || loading}
          title="Enviar"
          style={{ width: 54, borderRadius: 12, border: "none", display: "grid", placeItems: "center", cursor: input.trim() && !loading ? "pointer" : "not-allowed", background: input.trim() && !loading ? `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})` : BRAND.border2, color: input.trim() && !loading ? "#fff" : BRAND.dim }}
        >
          <Send size={20} />
        </button>
      </div>
    </div>
  );
}


function DashboardPanel({ crm, empresas, meta, usuarioAtual, setView }) {
  const isAdmin = usuarioAtual?.tipo === "admin";
  const lista = isAdmin ? crm : crm.filter((o) => o.userId === usuarioAtual?.id);
  const abertos = lista.filter((o) => statusFunilOrcamento(o) === "Aberto").length;
  const andamento = lista.filter((o) => statusFunilOrcamento(o) === "Andamento").length;
  const finalizados = lista.filter((o) => statusFunilOrcamento(o) === "Finalizado").length;
  const atrasados = lista.filter((o) => statusFunilOrcamento(o) === "Atrasado").length;
  const valorPotencial = lista.filter((o) => !isFinalizadoOrcamento(o)).reduce((acc, o) => acc + (parseFloat(o.valorGlobal) || 0), 0);
  const totalValor = lista.reduce((acc, o) => acc + (parseFloat(o.valorGlobal) || 0), 0);
  const ticketMedio = lista.length ? totalValor / lista.length : 0;
  const conversao = lista.length ? Math.round((finalizados / lista.length) * 100) : 0;
  const proximos = lista.filter((o) => !isFinalizadoOrcamento(o) && o.proximoContato).sort((a,b) => String(a.proximoContato).localeCompare(String(b.proximoContato))).slice(0, 5);

  const kpi = (label, valor, sub, cor, icon) => (
    <div className="of-dashboard-card">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 12, color: "var(--of-muted)", fontWeight: 800 }}>{label}</div>
        <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", background: `${cor}18`, border: `1px solid ${cor}44`, color: cor }}>{icon}</div>
      </div>
      <div style={{ fontSize: 30, fontWeight: 950, marginTop: 12, color: cor }}>{valor}</div>
      <div style={{ fontSize: 11, color: "var(--of-muted)", marginTop: 4 }}>{sub}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 22, position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, color: BRAND.green, fontWeight: 900, letterSpacing: 2 }}>ORÇAFLOW STUDIO AI</div>
          <h1 className="of-title-gradient" style={{ fontSize: 34, lineHeight: 1.1, margin: "8px 0 6px", fontWeight: 950 }}>Dashboard Inteligente</h1>
          <div style={{ fontSize: 13, color: BRAND.muted }}>Controle comercial, orçamentos, CRM e follow-up com IA integrada.</div>
        </div>
        <button className="of-neon-btn" onClick={() => setView("orcamento")} style={{ padding: "12px 18px", borderRadius: 14, cursor: "pointer" }}>✨ Novo orçamento</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        {kpi("Orçamentos cadastrados", lista.length, `${empresas.length} empresa(s) cadastrada(s)`, BRAND.blue, "📄")}
        {kpi("Abertos", abertos, "Aguardando andamento", BRAND.blue, "🔎")}
        {kpi("Em andamento", andamento, "Em negociação", BRAND.warn, "⚙")}
        {kpi("Finalizados", finalizados, `${conversao}% de conversão`, BRAND.green, "✅")}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.15fr .85fr", gap: 16, alignItems: "stretch" }}>
        <div className="of-glass" style={{ borderRadius: 20, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 950 }}>Funil comercial</div>
              <div style={{ fontSize: 12, color: BRAND.muted }}>Visão rápida dos orçamentos por etapa.</div>
            </div>
            <span style={{ color: BRAND.green, fontSize: 12, fontWeight: 900 }}>{brl(valorPotencial)} em potencial</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 10 }}>
            {[
              ["Aberto", abertos, BRAND.blue],
              ["Contato", andamento, BRAND.warn],
              ["Proposta", lista.length, BRAND.purple || "#7c3aed"],
              ["Fechado", finalizados, BRAND.green],
              ["Atrasado", atrasados, BRAND.danger],
            ].map(([l,v,c]) => (
              <div key={l} style={{ borderRadius: 16, padding: 14, minHeight: 110, background: `${c}12`, border: `1px solid ${c}38`, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div style={{ fontSize: 11, color: BRAND.muted, fontWeight: 850 }}>{l}</div>
                <div style={{ fontSize: 28, color: c, fontWeight: 950 }}>{v}</div>
                <div style={{ height: 5, borderRadius: 999, background: `${c}55` }} />
              </div>
            ))}
          </div>
        </div>

        <div className="of-glass" style={{ borderRadius: 20, padding: 18 }}>
          <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 8 }}>OrçaFlow AI</div>
          <div style={{ fontSize: 12, color: BRAND.muted, lineHeight: 1.6, marginBottom: 14 }}>Sugestões inteligentes para cobrança e acompanhamento.</div>
          <div style={{ display: "grid", gap: 10 }}>
            {[
              [`${abertos} orçamentos em aberto`, "Gerar mensagens de follow-up"],
              [`${atrasados} contatos atrasados`, "Priorizar cobranças hoje"],
              [`${brl(ticketMedio)} ticket médio`, "Acompanhar propostas de maior valor"],
            ].map(([a,b]) => (
              <div key={a} style={{ padding: 12, borderRadius: 14, background: "rgba(2,6,23,.55)", border: `1px solid ${BRAND.border2}` }}>
                <div style={{ fontSize: 13, fontWeight: 900 }}>{a}</div>
                <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 3 }}>{b}</div>
              </div>
            ))}
          </div>
          <button onClick={() => setView("clientes")} style={{ marginTop: 14, width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}18`, color: "#93C5FD", fontWeight: 900, cursor: "pointer" }}>Abrir CRM</button>
        </div>
      </div>

      <div className="of-glass" style={{ borderRadius: 20, padding: 18, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 10 }}>Próximos contatos</div>
        {proximos.length === 0 ? (
          <div style={{ color: BRAND.dim, fontSize: 13, padding: 16, textAlign: "center" }}>Nenhum acompanhamento programado.</div>
        ) : proximos.map((o) => (
          <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1fr .8fr .6fr .8fr", gap: 10, padding: "10px 0", borderTop: `1px solid ${BRAND.border2}`, alignItems: "center" }}>
            <div><strong>{o.cliente}</strong><div style={{ fontSize: 11, color: BRAND.dim }}>{o.numero}</div></div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>{o.empresaNome}</div>
            <div style={{ fontSize: 12, fontWeight: 900 }}>{brl(o.valorGlobal)}</div>
            <div style={{ fontSize: 12, color: diasAte(o.proximoContato) < 0 ? BRAND.danger : BRAND.green }}>{new Date(o.proximoContato + "T00:00:00").toLocaleDateString("pt-BR")}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LoginScreen({ onLogin, pushToast }) {
  const [usuario, setUsuario] = useState(() => {
    try {
      return localStorage.getItem(KEY_LAST_LOGIN_USER) || "";
    } catch {
      return "";
    }
  });
  const [senha, setSenha] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [criandoConta, setCriandoConta] = useState(false);

  const [entrando, setEntrando] = useState(false);

  const entrar = async () => {
    if (!usuario.trim() || !senha) {
      pushToast("Informe usuário e senha.", "erro");
      return;
    }

    setEntrando(true);
    try {
      const email = usuario.trim().toLowerCase();
      try {
        localStorage.setItem(KEY_LAST_LOGIN_USER, email);
      } catch {
        // O sistema nunca grava senha; se o navegador bloquear localStorage, apenas nao lembra o e-mail.
      }
      const result = criandoConta
        ? await supabase.auth.signUp({ email, password: senha })
        : await supabase.auth.signInWithPassword({ email, password: senha });
      if (result.error) throw result.error;
      if (criandoConta && !result.data.session) {
        pushToast("Conta criada. Confirme o e-mail antes de entrar.", "ok");
        setCriandoConta(false);
        setSenha("");
        return;
      }
      setSenha("");
      onLogin(result.data.user);
    } catch (error) {
      pushToast(error.message || "Usuário ou senha inválidos.", "erro");
    } finally {
      setEntrando(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 20% 10%, ${BRAND.green2}22, transparent 30%), radial-gradient(circle at 80% 0%, ${BRAND.blue2}22, transparent 32%), ${BRAND.bg}`, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        :root { --of-bg:#030712; --of-panel:rgba(10,21,37,.82); --of-card:rgba(15,23,42,.76); --of-border:rgba(0,176,255,.22); --of-green:#00e676; --of-blue:#00b0ff; --of-purple:#7c3aed; --of-text:#f8fafc; --of-muted:#94a3b8; }
        .of-glass { background:linear-gradient(145deg,rgba(15,23,42,.86),rgba(3,7,18,.78)); border:1px solid rgba(0,176,255,.22); box-shadow:0 0 35px rgba(0,230,118,.08), inset 0 1px 0 rgba(255,255,255,.05); backdrop-filter:blur(18px); }
        .of-title-gradient { background:linear-gradient(90deg,#fff,#00e676,#00b0ff); -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
      `}</style>
      <div className="of-glass" style={{ width: "100%", maxWidth: 430, borderRadius: 26, padding: 34, position: "relative", overflow: "hidden" }}>
        <div style={{ position: "absolute", inset: "auto -80px -120px auto", width: 280, height: 280, borderRadius: "50%", background: `${BRAND.blue2}20`, filter: "blur(30px)" }} />
        <div style={{ textAlign: "center", position: "relative" }}>
          <img src="/logo-orcaflow.png" alt="OrçaFlow" style={{ height: 84, objectFit: "contain", filter: "drop-shadow(0 0 28px rgba(0,230,118,.25))" }} />
          <div className="of-title-gradient" style={{ fontSize: 30, fontWeight: 950, marginTop: 12 }}>OrçaFlow</div>
          <div style={{ fontSize: 11, letterSpacing: 3, color: BRAND.muted, marginTop: 2 }}>STUDIO AI</div>
          <div style={{ fontSize: 12, color: BRAND.muted, margin: "10px 0 24px" }}>Orçamentos Inteligentes. Resultados Reais.</div>
        </div>
        <div style={{ display: "grid", gap: 12, position: "relative" }}>
          <div>
            <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>E-MAIL / USUÁRIO</div>
            <input type="email" autoComplete="username" value={usuario} onChange={(e) => setUsuario(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="voce@empresa.com" style={{ width: "100%", boxSizing: "border-box", background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 13, padding: "13px 14px", color: BRAND.text, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>SENHA</div>
            <div style={{ display: "flex", background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 13, overflow: "hidden" }}>
              <input type={mostrar ? "text" : "password"} autoComplete="new-password" data-lpignore="true" data-1p-ignore="true" value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="Digite sua senha" style={{ flex: 1, background: "transparent", border: 0, padding: "13px 14px", color: BRAND.text, outline: "none" }} />
              <button onClick={() => setMostrar((v) => !v)} style={{ width: 52, border: 0, background: "transparent", color: BRAND.muted, cursor: "pointer" }}>{mostrar ? "Ocultar" : "Ver"}</button>
            </div>
          </div>
          <button className="of-neon-btn" disabled={entrando} onClick={entrar} style={{ marginTop: 10, padding: "14px 16px", borderRadius: 14, cursor: entrando ? "not-allowed" : "pointer", fontSize: 15 }}>{entrando ? "Aguarde..." : criandoConta ? "Criar conta" : "Entrar"}</button>
          <div style={{ display: "flex", justifyContent: "center", gap: 18, marginTop: 4 }}>
            <button onClick={() => setCriandoConta((v) => !v)} style={{ border: 0, background: "transparent", color: "#93C5FD", cursor: "pointer", fontSize: 12 }}>{criandoConta ? "Já tenho conta" : "Criar conta"}</button>
            <button onClick={async () => { if (!usuario.trim()) return pushToast("Informe seu e-mail primeiro.", "erro"); const { error } = await supabase.auth.resetPasswordForEmail(usuario.trim(), { redirectTo: window.location.origin }); pushToast(error ? error.message : "Enviamos as instruções para seu e-mail.", error ? "erro" : "ok"); }} style={{ border: 0, background: "transparent", color: "#93C5FD", cursor: "pointer", fontSize: 12 }}>Esqueci a senha</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AccessStatusScreen({ perfil, onSignOut }) {
  const status = perfil?.status || "pending";
  const bloqueado = status === "blocked";
  const titulo = bloqueado ? "Acesso bloqueado" : "Acesso aguardando aprovação";
  const texto = bloqueado
    ? "Seu cadastro existe, mas foi bloqueado pelo administrador do OrçaFlow."
    : "Seu cadastro foi recebido. Um administrador precisa aprovar seu acesso antes de liberar o sistema.";

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 20% 10%, ${BRAND.green2}22, transparent 30%), radial-gradient(circle at 80% 0%, ${BRAND.blue2}22, transparent 32%), ${BRAND.bg}`, color: BRAND.text, display: "flex", alignItems: "center", justifyContent: "center", padding: 18, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>
      <style>{`
        .of-glass { background:linear-gradient(145deg,rgba(15,23,42,.86),rgba(3,7,18,.78)); border:1px solid rgba(0,176,255,.22); box-shadow:0 0 35px rgba(0,230,118,.08), inset 0 1px 0 rgba(255,255,255,.05); backdrop-filter:blur(18px); }
      `}</style>
      <div className="of-glass" style={{ width: "100%", maxWidth: 460, borderRadius: 24, padding: 30, textAlign: "center", border: `1px solid ${bloqueado ? BRAND.danger : BRAND.warn}55` }}>
        <img src="/logo-orcaflow.png" alt="OrçaFlow" style={{ height: 76, objectFit: "contain", marginBottom: 12 }} />
        <div style={{ fontSize: 22, fontWeight: 950, marginBottom: 8, color: bloqueado ? BRAND.danger : BRAND.warn }}>{titulo}</div>
        <div style={{ fontSize: 13, color: BRAND.muted, lineHeight: 1.7, marginBottom: 16 }}>{texto}</div>
        <div style={{ padding: 12, borderRadius: 12, background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, fontSize: 12, marginBottom: 18 }}>
          {perfil?.email || perfil?.name || "Usuário"}
        </div>
        <button onClick={onSignOut} style={{ padding: "11px 16px", borderRadius: 12, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 900 }}>
          Sair
        </button>
      </div>
    </div>
  );
}

function CRMPanel({ crm, setCrm, empresas, pushToast, usuarioAtual }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [whats, setWhats] = useState("");

  const isAdmin = usuarioAtual?.tipo === "admin";
  const visiveisPorUsuario = isAdmin ? crm : crm.filter((o) => o.userId === usuarioAtual?.id);
  const lista = visiveisPorUsuario.filter((o) => {
    const alvo = `${o.cliente || ""} ${o.empresaNome || ""} ${o.numero || ""} ${o.status || ""} ${normalizarStatusOrcamento(o)}`.toLowerCase();
    const okBusca = !busca || alvo.includes(busca.toLowerCase());
    const okStatus = statusFiltro === "Todos" || normalizarStatusOrcamento(o) === statusFiltro;
    const okEmpresa = empresaFiltro === "Todas" || o.empresaId === empresaFiltro;
    return okBusca && okStatus && okEmpresa;
  });

  const totais = {
    aberto: visiveisPorUsuario.filter((o) => statusFunilOrcamento(o) === "Aberto").length,
    andamento: visiveisPorUsuario.filter((o) => statusFunilOrcamento(o) === "Andamento").length,
    finalizado: visiveisPorUsuario.filter((o) => statusFunilOrcamento(o) === "Finalizado").length,
    vencidos: visiveisPorUsuario.filter((o) => statusFunilOrcamento(o) === "Atrasado").length,
  };

  const salvarCRM = (nova) => {
    setCrm(nova);
    store.set(KEY_CRM, nova);
  };

  const updateItem = (id, campo, valor) => {
    salvarCRM(crm.map((o) => (o.id === id ? { ...o, [campo]: valor, atualizadoEm: new Date().toISOString() } : o)));
  };

  const criarLembretesIA = () => {
    const nova = crm.map((o) => {
      if (isFinalizadoOrcamento(o)) return o;
      if (o.lembreteIA) return o;
      const atraso = diasAte(o.proximoContato);
      let texto = `Fazer follow-up do orçamento ${o.numero || ""} com ${o.cliente || "cliente"}.`;
      if (atraso !== null && atraso < 0) texto = `Cobrança urgente: orçamento ${o.numero || ""} de ${o.cliente || "cliente"} está com contato atrasado.`;
      if (atraso === 0) texto = `Entrar em contato hoje com ${o.cliente || "cliente"} sobre o orçamento ${o.numero || ""}.`;
      return { ...o, lembreteIA: texto };
    });
    salvarCRM(nova);
    pushToast("Lembretes de cobrança criados para os orçamentos em aberto.", "ok");
  };

  const notificarHoje = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const vencidosHoje = visiveisPorUsuario.filter((o) => !isFinalizadoOrcamento(o) && (!o.proximoContato || o.proximoContato <= hoje));
    if (!vencidosHoje.length) {
      pushToast("Não há cobranças pendentes para hoje.", "aviso");
      return;
    }
    if ("Notification" in window) {
      const perm = await Notification.requestPermission();
      if (perm === "granted") {
        new Notification("OrçaFlow CRM", { body: `${vencidosHoje.length} orçamento(s) precisam de acompanhamento hoje.` });
      }
    }
    pushToast(`${vencidosHoje.length} orçamento(s) pendente(s) para acompanhar.`, "ok");
  };

  const abrirWhats = () => {
    const numero = onlyDigits(whats);
    if (!numero || numero.length < 10) {
      pushToast("Informe o WhatsApp com DDD para enviar o relatório.", "erro");
      return;
    }
    const msg = gerarTextoWhatsPendencias(visiveisPorUsuario, empresas);
    window.open(`https://wa.me/55${numero.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const card = (label, valor, cor) => (
    <div style={{ background: BRAND.panel, border: `1px solid ${cor}33`, borderRadius: 16, padding: 16 }}>
      <div style={{ fontSize: 24, fontWeight: 950, color: cor }}>{valor}</div>
      <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>{label}</div>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 18, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 950 }}>CRM de Orçamentos</div>
          <div style={{ fontSize: 12, color: BRAND.dim, marginTop: 3 }}>Busca, acompanhamento, status, follow-up e lembretes de cobrança.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={criarLembretesIA} style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}18`, color: "#93C5FD", fontWeight: 900, cursor: "pointer" }}>IA criar lembretes</button>
          <button onClick={notificarHoje} style={{ padding: "9px 14px", borderRadius: 10, border: `1px solid ${BRAND.warn}66`, background: `${BRAND.warn}18`, color: "#FBBF24", fontWeight: 900, cursor: "pointer" }}>Notificar pendentes</button>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(130px,1fr))", gap: 12, marginBottom: 16 }}>
        {card("Abertos", totais.aberto, BRAND.blue)}
        {card("Em andamento", totais.andamento, BRAND.warn)}
        {card("Finalizados", totais.finalizado, BRAND.green)}
        {card("Atrasados", totais.vencidos, BRAND.danger)}
      </div>

      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: 10 }}>
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por cliente, orçamento, empresa ou status..." style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12, outline: "none" }} />
          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12 }}>
            {["Todos", "Aberto", "Andamento", "Finalizado"].map((s) => <option key={s}>{s}</option>)}
          </select>
          <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12 }}>
            <option value="Todas">Todas as empresas</option>
            {empresas.map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}
          </select>
        </div>
      </div>

      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, overflow: "hidden", marginBottom: 16 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .8fr .9fr .9fr 1.2fr", gap: 8, padding: "10px 12px", background: BRAND.panel2, color: BRAND.muted, fontSize: 10, fontWeight: 900, letterSpacing: 1 }}>
          <div>CLIENTE</div><div>EMPRESA</div><div>VALOR</div><div>STATUS</div><div>PRÓXIMO CONTATO</div><div>LEMBRETE</div>
        </div>
        {lista.length === 0 ? (
          <div style={{ padding: 26, textAlign: "center", color: BRAND.dim, fontSize: 13 }}>Nenhum orçamento encontrado no CRM.</div>
        ) : lista.map((o) => (
          <div key={o.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr .8fr .9fr .9fr 1.2fr", gap: 8, alignItems: "center", padding: "10px 12px", borderTop: `1px solid ${BRAND.border2}` }}>
            <div>
              <div style={{ fontSize: 12, fontWeight: 850 }}>{o.cliente || "—"}</div>
              <div style={{ fontSize: 10, color: BRAND.dim }}>{o.numero || "—"} · {tsFmt(o.criadoEm)}</div>
            </div>
            <div style={{ fontSize: 12, color: BRAND.muted }}>{o.empresaNome || "—"}</div>
            <div style={{ fontSize: 12, fontWeight: 850 }}>{brl(o.valorGlobal)}</div>
            <select value={normalizarStatusOrcamento(o)} onChange={(e) => updateItem(o.id, "status", e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12 }}>
              {["Aberto", "Andamento", "Finalizado"].map((s) => <option key={s}>{s}</option>)}
            </select>
            <input type="date" value={o.proximoContato || ""} onChange={(e) => updateItem(o.id, "proximoContato", e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12 }} />
            <textarea value={o.lembreteIA || ""} onChange={(e) => updateItem(o.id, "lembreteIA", e.target.value)} placeholder="Lembrete de cobrança..." rows={2} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12, resize: "vertical" }} />
          </div>
        ))}
      </div>

      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 14 }}>
        <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 6 }}>Relatório para WhatsApp</div>
        <div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 10 }}>O navegador não envia WhatsApp agendado sozinho. Este botão abre o WhatsApp com o relatório pronto. Para envio automático programado, será necessário backend com API oficial da Meta/WhatsApp.</div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="DDD + número do WhatsApp do usuário" style={{ flex: 1, background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12 }} />
          <button onClick={abrirWhats} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Enviar relatório</button>
        </div>
      </div>
    </div>
  );
}


// Editor manual de preço usado na tabela de Gestão. Aceita formato brasileiro
// (3.500 / 3.500,00 / 3500) e salva o valor numérico correto.
function ValorEditavel({ valor, onSalvar }) {
  const [edit, setEdit] = useState(valor === "" || valor === null || valor === undefined ? "" : String(valor));

  useEffect(() => {
    setEdit(valor === "" || valor === null || valor === undefined ? "" : String(valor));
  }, [valor]);

  const commit = () => {
    const n = parseValorBR(edit);
    onSalvar(n);
    setEdit(n ? String(n) : "");
  };

  return (
    <div>
      <input
        value={edit}
        onChange={(e) => setEdit(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
        placeholder="0,00"
        title="Digite o valor (ex: 3.500 ou 3500,00) e pressione Enter"
        style={{
          width: "100%",
          background: BRAND.panel2,
          border: `1px solid ${BRAND.border2}`,
          borderRadius: 9,
          padding: "8px 10px",
          color: BRAND.text,
          fontSize: 12,
          fontWeight: 850,
          outline: "none",
          boxSizing: "border-box",
        }}
      />
      <div style={{ fontSize: 10, color: BRAND.green, marginTop: 3, fontWeight: 800 }}>
        {brl(parseValorBR(edit))}
      </div>
    </div>
  );
}

function diasDesde(iso) {
  if (!iso) return 0;
  const data = new Date(iso);
  if (Number.isNaN(data.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - data.getTime()) / 86400000));
}

function dataISOEmDias(dias = 3) {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function contatosDoOrcamento(item) {
  return Array.isArray(item?.followups) ? item.followups : Array.isArray(item?.contatos) ? item.contatos : [];
}

function conversasDoOrcamento(item) {
  const conversas = Array.isArray(item?.conversas) ? item.conversas : [];
  const idsConversas = new Set(conversas.map((c) => c?.followupId || c?.id).filter(Boolean));
  const followupsLegados = contatosDoOrcamento(item)
    .filter((contato) => !idsConversas.has(contato?.id))
    .map((contato) => ({
      id: contato?.id || `legado_${contato?.criadoEm || Math.random()}`,
      followupId: contato?.id || "",
      canal: contato?.canal || "Acompanhamento",
      direcao: contato?.direcao || "saida",
      tipo: contato?.tipo || "follow-up",
      mensagem: contato?.mensagem || contato?.conteudo || "",
      criadoEm: contato?.criadoEm || contato?.data || new Date().toISOString(),
      origem: contato?.origem || "legado",
      usuarioNome: contato?.usuarioNome || "",
    }));

  return [...conversas, ...followupsLegados].sort((a, b) => new Date(b?.criadoEm || 0) - new Date(a?.criadoEm || 0));
}

function ultimoContatoOrcamento(item) {
  const contatos = conversasDoOrcamento(item);
  return contatos.length ? contatos[0] : null;
}

function ultimaMensagemCliente(item) {
  return conversasDoOrcamento(item).find((msg) => msg?.direcao === "entrada") || null;
}

function avaliarPrioridadeOrcamento(item) {
  const status = normalizarStatusOrcamento(item);

  if (status === "Finalizado") {
    return { score: 0, nivel: "Fechado", cor: BRAND.green, motivos: ["Orçamento finalizado"], acao: "Arquivo comercial" };
  }

  let score = 0;
  const motivos = [];
  const diasContato = diasAte(item?.proximoContato);
  const valor = parseValorBR(item?.valorGlobal ?? item?.valor);
  const idade = diasDesde(item?.criadoEm);
  const contatos = conversasDoOrcamento(item);

  if (diasContato !== null && diasContato < 0) {
    score += 38;
    motivos.push("contato atrasado");
  } else if (!item?.proximoContato) {
    score += 26;
    motivos.push("sem próximo contato");
  } else if (diasContato === 0) {
    score += 24;
    motivos.push("contato hoje");
  } else if (diasContato <= 3) {
    score += 12;
    motivos.push("contato próximo");
  }

  if (status === "Aberto") {
    score += 14;
    motivos.push("em aberto");
  }
  if (status === "Andamento") {
    score += 10;
    motivos.push("em negociação");
  }
  if (valor >= 100000) {
    score += 18;
    motivos.push("alto valor");
  } else if (valor >= 50000) {
    score += 12;
    motivos.push("valor relevante");
  } else if (valor >= 10000) {
    score += 6;
    motivos.push("valor comercial");
  }
  if (idade >= 14) {
    score += 10;
    motivos.push("antigo");
  } else if (idade >= 7) {
    score += 6;
    motivos.push("aguardando retorno");
  }
  if (!contatos.length) {
    score += 8;
    motivos.push("sem contato registrado");
  }

  score = Math.min(100, score);

  if (score >= 70) return { score, nivel: "Crítica", cor: BRAND.danger, motivos, acao: "Cobrar hoje" };
  if (score >= 50) return { score, nivel: "Alta", cor: BRAND.warn, motivos, acao: "Fazer follow-up" };
  if (score >= 30) return { score, nivel: "Média", cor: BRAND.blue, motivos, acao: "Monitorar" };
  return { score, nivel: "Baixa", cor: BRAND.green, motivos, acao: "Acompanhar" };
}

function GestaoPage({ crm = [], setCrm, empresas = [], clientes = [], setClientes, meta = {}, pushToast, usuarioAtual, setView, abrirOrcamentoSalvo, baixarOrcamento, onAnexar, naraConfig = DEFAULT_NARA_CONFIG, setNaraConfig, radarPendente, setRadarPendente, exportarBackup }) {
  const [busca, setBusca] = useState("");
  const [statusFiltro, setStatusFiltro] = useState("Todos");
  const [empresaFiltro, setEmpresaFiltro] = useState("Todas");
  const [filtroRapido, setFiltroRapido] = useState("Todos");
  const [ordenacao, setOrdenacao] = useState("contatoAsc");
  const [porPagina, setPorPagina] = useState(15);
  const [pagina, setPagina] = useState(1);
  const [gerandoContato, setGerandoContato] = useState(null);
  const [historicoAberto, setHistoricoAberto] = useState(null);
  const [conversaDrafts, setConversaDrafts] = useState({});
  const [whats, setWhats] = useState("");
  const [auditoriaNara, setAuditoriaNara] = useState(null);
  const [backupSugerido, setBackupSugerido] = useState(false);
  const [orcamentosSelecionados, setOrcamentosSelecionados] = useState([]);
  const [lixeiraOrcamentos, setLixeiraOrcamentos] = useState([]);
  const [lixeiraAberta, setLixeiraAberta] = useState(false);
  const [auditoriaAcoes, setAuditoriaAcoes] = useState([]);
  const [auditoriaAcoesAberta, setAuditoriaAcoesAberta] = useState(false);
  const [clienteLinkDrafts, setClienteLinkDrafts] = useState({});

  const isAdmin = usuarioAtual?.tipo === "admin";
  const base = isAdmin ? crm : crm.filter((o) => o.userId === usuarioAtual?.id);
  const clientesVisiveis = isAdmin ? clientes : clientes.filter((item) => item.userId === usuarioAtual?.id);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const log = (await store.get(KEY_BACKUP_AUTO)) || {};
      if (ativo) setBackupSugerido(Boolean(naraConfig?.backupAssistidoAtivo && precisaBackupAssistido(log.ultimoBackupEm)));
    })();
    return () => {
      ativo = false;
    };
  }, [naraConfig?.backupAssistidoAtivo, crm.length, clientes.length]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const salvo = await store.get(KEY_WHATS_RELATORIO);
      if (!ativo) return;
      if (typeof salvo === "string" && salvo.trim()) setWhats(salvo);
      else setWhats(WHATS_REPORT_NUMBER);
    })();
    return () => {
      ativo = false;
    };
  }, []);

  useEffect(() => {
    let ativo = true;
    (async () => {
      const dados = await store.getMany([KEY_CRM_TRASH, KEY_AUDITORIA]);
      if (!ativo) return;
      setLixeiraOrcamentos(Array.isArray(dados[KEY_CRM_TRASH]) ? dados[KEY_CRM_TRASH] : []);
      setAuditoriaAcoes(Array.isArray(dados[KEY_AUDITORIA]) ? dados[KEY_AUDITORIA] : []);
    })();
    return () => {
      ativo = false;
    };
  }, [usuarioAtual?.id]);

  const draftConversa = (id) => conversaDrafts[id] || {
    canal: "WhatsApp",
    direcao: "saida",
    tipo: "Follow-up",
    mensagem: "",
  };

  const atualizarDraftConversa = (id, patch) => {
    setConversaDrafts((atual) => ({
      ...atual,
      [id]: {
        canal: "WhatsApp",
        direcao: "saida",
        tipo: "Follow-up",
        mensagem: "",
        ...(atual[id] || {}),
        ...patch,
      },
    }));
  };

  useEffect(() => {
    setPagina(1);
  }, [busca, statusFiltro, empresaFiltro, filtroRapido, ordenacao, porPagina]);

  useEffect(() => {
    setOrcamentosSelecionados((atuais) => {
      const idsPermitidos = new Set(base.map((item) => item.id));
      const filtrados = atuais.filter((id) => idsPermitidos.has(id));
      return filtrados.length === atuais.length ? atuais : filtrados;
    });
  }, [crm.length, usuarioAtual?.id, usuarioAtual?.tipo]);

  const statusColor = {
    Aberto: BRAND.blue,
    Andamento: BRAND.warn,
    Finalizado: BRAND.green,
    Atrasado: BRAND.danger,
  };

  const statusReal = (item) => {
    return statusFunilOrcamento(item);
  };

  const hojeISO = new Date().toISOString().slice(0, 10);

  const listaFiltrada = base.filter((o) => {
    const textoBusca = [
      o.cliente,
      o.empresaNome,
      o.empresa,
      o.numero,
      o.status,
      normalizarStatusOrcamento(o),
      o.lembreteIA,
      o.lembrete,
      o.descricaoArquivo,
      o.arquivoNome,
      o.empresaNomeDetectada,
      o.dataDocumento,
      ...conversasDoOrcamento(o).slice(0, 8).flatMap((msg) => [msg.canal, msg.tipo, msg.mensagem, msg.conteudo, msg.usuarioNome]),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const okBusca = !busca || textoBusca.includes(busca.toLowerCase());
    const statusNormal = normalizarStatusOrcamento(o);
    const okStatus = statusFiltro === "Todos" || statusNormal === statusFiltro;
    const okEmpresa = empresaFiltro === "Todas" || o.empresaId === empresaFiltro;
    const dias = diasAte(o.proximoContato);
    const okRapido =
      filtroRapido === "Todos" ||
      (filtroRapido === "Atrasados" && statusFunilOrcamento(o) === "Atrasado") ||
      (filtroRapido === "Hoje" && !isFinalizadoOrcamento(o) && (!o.proximoContato || o.proximoContato <= hojeISO)) ||
      (filtroRapido === "Sem contato" && !isFinalizadoOrcamento(o) && !o.proximoContato) ||
      (filtroRapido === "Em aberto" && !isFinalizadoOrcamento(o)) ||
      (filtroRapido === "Prioridade alta" && avaliarPrioridadeOrcamento(o).score >= 50) ||
      (filtroRapido === "Anexados" && o.anexado);

    return okBusca && okStatus && okEmpresa && okRapido;
  });

  const lista = [...listaFiltrada].sort((a, b) => {
    const valorA = parseValorBR(a.valorGlobal ?? a.valor);
    const valorB = parseValorBR(b.valorGlobal ?? b.valor);
    const contatoA = a.proximoContato || "9999-12-31";
    const contatoB = b.proximoContato || "9999-12-31";
    const criadoA = new Date(a.criadoEm || 0).getTime();
    const criadoB = new Date(b.criadoEm || 0).getTime();

    if (ordenacao === "contatoAsc") return contatoA.localeCompare(contatoB);
    if (ordenacao === "criadoDesc") return criadoB - criadoA;
    if (ordenacao === "valorDesc") return valorB - valorA;
    if (ordenacao === "valorAsc") return valorA - valorB;
    if (ordenacao === "clienteAsc") return String(a.cliente || "").localeCompare(String(b.cliente || ""));
    if (ordenacao === "status") return statusReal(a).localeCompare(statusReal(b));
    if (ordenacao === "prioridade") return avaliarPrioridadeOrcamento(b).score - avaliarPrioridadeOrcamento(a).score;
    return 0;
  });

  const totalPaginas = Math.max(1, Math.ceil(lista.length / porPagina));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const inicioPagina = (paginaAtual - 1) * porPagina;
  const paginaItens = lista.slice(inicioPagina, inicioPagina + porPagina);

  const total = base.length;
  const abertos = base.filter((o) => statusFunilOrcamento(o) === "Aberto").length;
  const andamento = base.filter((o) => statusFunilOrcamento(o) === "Andamento").length;
  const finalizados = base.filter((o) => statusFunilOrcamento(o) === "Finalizado").length;
  const atrasados = base.filter(
    (o) => statusFunilOrcamento(o) === "Atrasado"
  ).length;

  const valorTotal = base.reduce((soma, item) => soma + parseValorBR(item.valorGlobal ?? item.valor), 0);
  const valorPotencial = base
    .filter((item) => !isFinalizadoOrcamento(item))
    .reduce((soma, item) => soma + parseValorBR(item.valorGlobal ?? item.valor), 0);
  const ticketMedio = total ? valorTotal / total : 0;
  const taxaConversao = total ? Math.round((finalizados / total) * 100) : 0;
  const precisamContato = abertos + andamento + atrasados;
  const filaFollowup = [...base]
    .filter((item) => !isFinalizadoOrcamento(item))
    .map((item) => ({ item, prioridade: avaliarPrioridadeOrcamento(item) }))
    .filter(({ prioridade }) => prioridade.score >= 30)
    .sort((a, b) => b.prioridade.score - a.prioridade.score)
    .slice(0, 6);
  const lixeiraVisivel = (Array.isArray(lixeiraOrcamentos) ? lixeiraOrcamentos : [])
    .filter((item) => isAdmin || item.userId === usuarioAtual?.id || item.removidoPorId === usuarioAtual?.id)
    .slice(0, 80);
  const auditoriaVisivel = (Array.isArray(auditoriaAcoes) ? auditoriaAcoes : [])
    .filter((item) => isAdmin || item.usuarioId === usuarioAtual?.id)
    .slice(0, 40);
  const pipelineComercial = [
    { id: "total", label: "Total", qtd: total, valor: valorTotal, cor: BRAND.blue },
    { id: "aberto", label: "Aberto", qtd: abertos, valor: base.filter((o) => statusFunilOrcamento(o) === "Aberto").reduce((s, o) => s + parseValorBR(o.valorGlobal ?? o.valor), 0), cor: BRAND.blue },
    { id: "andamento", label: "Andamento", qtd: andamento, valor: base.filter((o) => statusFunilOrcamento(o) === "Andamento").reduce((s, o) => s + parseValorBR(o.valorGlobal ?? o.valor), 0), cor: BRAND.warn },
    { id: "atrasado", label: "Atrasado", qtd: atrasados, valor: base.filter((o) => statusFunilOrcamento(o) === "Atrasado").reduce((s, o) => s + parseValorBR(o.valorGlobal ?? o.valor), 0), cor: BRAND.danger },
    { id: "finalizado", label: "Finalizado", qtd: finalizados, valor: base.filter((o) => statusFunilOrcamento(o) === "Finalizado").reduce((s, o) => s + parseValorBR(o.valorGlobal ?? o.valor), 0), cor: BRAND.green },
  ];

  const salvarCRM = (novaLista) => {
    setCrm(novaLista);
    store.set(KEY_CRM, novaLista);
  };

  const salvarLixeira = (novaLista) => {
    setLixeiraOrcamentos(novaLista);
    store.set(KEY_CRM_TRASH, novaLista);
  };

  const salvarClientesCRM = (novaLista) => {
    if (typeof setClientes === "function") setClientes(novaLista);
    store.set(KEY_CLIENTES, novaLista);
  };

  const clienteVinculadoOrcamento = (item = {}) => {
    const id = item.clienteVinculadoId || item.clienteCRMId || "";
    return id ? clientesVisiveis.find((clienteItem) => clienteItem.id === id) || null : null;
  };

  const orcamentoParaVinculoCliente = (orc = {}, clienteItem = {}, registro = null) => ({
    id: `ocli_${orc.id}`,
    origem: orc.anexado ? (orc.origemImportacao || "anexo") : "sistema",
    orcamentoId: orc.id,
    numero: orc.numero || "",
    titulo: orc.cliente || orc.numero || "Orcamento do sistema",
    empresaNome: orc.empresaNome || orc.empresa || "",
    valor: orc.valorGlobal ?? orc.valor ?? "",
    status: orc.status || "Aberto",
    resumo: clean(orc.lembreteIA || orc.descricaoArquivo || orc.resumoConversas || "", 2200),
    arquivoNome: orc.arquivoNome || "",
    arquivoTipo: orc.arquivoTipo || "",
    arquivoTamanho: orc.arquivoTamanho || 0,
    historico: registro ? [registro] : [],
    userId: clienteItem.userId || orc.userId || usuarioAtual?.id || "admin",
    criadoEm: orc.criadoEm || new Date().toISOString(),
    anexadoEm: new Date().toISOString(),
    atualizadoEm: new Date().toISOString(),
  });

  const criarRegistroVinculoCliente = (orc = {}, clienteItem = {}) => ({
    id: `ct_link_${orc.id}_${Date.now()}`,
    canal: "Sistema",
    direcao: "Registro interno",
    tipo: "Orcamento vinculado",
    assunto: orc.numero || "Orcamento",
    mensagem: `Orcamento ${orc.numero || orc.id || ""} vinculado manualmente ao perfil ${clienteItem.nome || clienteItem.empresa || ""}. Valor: ${brl(orc.valorGlobal ?? orc.valor)}.`,
    orcamentoId: orc.id,
    orcamentoNumero: orc.numero || "",
    orcamentoTitulo: orc.cliente || "",
    criadoEm: new Date().toISOString(),
    userId: usuarioAtual?.id || "admin",
    origem: "vinculo_manual_gestao",
  });

  const vincularOrcamentoAoCliente = (orc = {}, clienteId = "") => {
    const clienteItem = clientes.find((item) => item.id === clienteId);
    if (!orc?.id || !clienteItem) {
      pushToast("Selecione um cliente valido para vincular.", "erro");
      return;
    }

    const registro = criarRegistroVinculoCliente(orc, clienteItem);
    const vinculo = orcamentoParaVinculoCliente(orc, clienteItem, registro);
    const novaCRM = crm.map((item) => item.id === orc.id ? {
      ...item,
      clienteVinculadoId: clienteItem.id,
      clienteVinculadoNome: clienteItem.nome || clienteItem.empresa || "",
      clienteCRMId: clienteItem.id,
      clienteSugeridoId: "",
      clienteSugeridoNome: "",
      clienteSugeridoScore: 0,
      conversas: [
        {
          id: `conv_${registro.id}`,
          followupId: registro.id,
          canal: "Sistema",
          direcao: "interna",
          tipo: "Orcamento vinculado",
          mensagem: registro.mensagem,
          criadoEm: registro.criadoEm,
          origem: "vinculo_manual_gestao",
          usuarioNome: nomeUsuarioSistema(usuarioAtual),
          clienteId: clienteItem.id,
        },
        ...(Array.isArray(item.conversas) ? item.conversas : []),
      ].slice(0, 120),
      atualizadoEm: new Date().toISOString(),
    } : item);

    const novaClientes = clientes.map((clienteAtual) => {
      if (clienteAtual.id !== clienteItem.id) return clienteAtual;
      const vinculados = Array.isArray(clienteAtual.orcamentosVinculados) ? clienteAtual.orcamentosVinculados : [];
      const semDuplicar = vinculados.filter((item) => item.orcamentoId !== orc.id);
      return {
        ...clienteAtual,
        valorPotencial: clienteAtual.valorPotencial || orc.valorGlobal || orc.valor || "",
        proximoContato: clienteAtual.proximoContato || orc.proximoContato || "",
        contatos: [registro, ...(Array.isArray(clienteAtual.contatos) ? clienteAtual.contatos : [])].slice(0, 160),
        orcamentosVinculados: [vinculo, ...semDuplicar].slice(0, 80),
        atualizadoEm: new Date().toISOString(),
      };
    });

    salvarCRM(novaCRM);
    salvarClientesCRM(novaClientes);
    registrarAuditoriaAcao("VINCULAR_CLIENTE_ORCAMENTO", [orc], { clienteId: clienteItem.id, clienteNome: clienteItem.nome || clienteItem.empresa || "" });
    setClienteLinkDrafts((atual) => ({ ...atual, [orc.id]: clienteItem.id }));
    pushToast("Orcamento vinculado ao perfil do cliente.", "ok");
  };

  const desvincularOrcamentoCliente = (orc = {}) => {
    const clienteId = orc.clienteVinculadoId || orc.clienteCRMId;
    if (!orc?.id || !clienteId) return;
    const clienteItem = clientes.find((item) => item.id === clienteId);
    const ok = window.confirm(`Remover o vinculo deste orcamento com ${clienteItem?.nome || clienteItem?.empresa || "o cliente"}?`);
    if (!ok) return;

    salvarCRM(crm.map((item) => item.id === orc.id ? {
      ...item,
      clienteVinculadoId: "",
      clienteVinculadoNome: "",
      clienteCRMId: "",
      atualizadoEm: new Date().toISOString(),
    } : item));
    salvarClientesCRM(clientes.map((clienteAtual) => clienteAtual.id === clienteId ? {
      ...clienteAtual,
      orcamentosVinculados: (Array.isArray(clienteAtual.orcamentosVinculados) ? clienteAtual.orcamentosVinculados : []).filter((v) => v.orcamentoId !== orc.id),
      atualizadoEm: new Date().toISOString(),
    } : clienteAtual));
    registrarAuditoriaAcao("DESVINCULAR_CLIENTE_ORCAMENTO", [orc], { clienteId });
    setClienteLinkDrafts((atual) => ({ ...atual, [orc.id]: "" }));
    pushToast("Vinculo removido. O orcamento continua na Gestao, sem cliente CRM.", "aviso");
  };

  const registrarAuditoriaAcao = (acao, itens = [], extra = {}) => {
    const lista = Array.isArray(itens) ? itens : [itens].filter(Boolean);
    const registro = {
      id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      acao,
      quantidade: lista.length,
      itens: lista.slice(0, 20).map((item) => ({
        id: item.id || "",
        numero: item.numero || "",
        cliente: item.cliente || "",
        empresaNome: item.empresaNome || item.empresa || "",
        valorGlobal: item.valorGlobal ?? item.valor ?? "",
      })),
      usuarioId: usuarioAtual?.id || "admin",
      usuarioNome: nomeUsuarioSistema(usuarioAtual),
      criadoEm: new Date().toISOString(),
      ...extra,
    };
    const novaAuditoria = [registro, ...auditoriaAcoes].slice(0, 500);
    setAuditoriaAcoes(novaAuditoria);
    store.set(KEY_AUDITORIA, novaAuditoria);
  };

  const idsSelecionados = new Set(orcamentosSelecionados);
  const idsPagina = paginaItens.map((item) => item.id).filter(Boolean);
  const todosPaginaSelecionados = idsPagina.length > 0 && idsPagina.every((id) => idsSelecionados.has(id));

  const alternarSelecaoOrcamento = (id) => {
    if (!id) return;
    setOrcamentosSelecionados((atuais) => (
      atuais.includes(id) ? atuais.filter((itemId) => itemId !== id) : [...atuais, id]
    ));
  };

  const alternarSelecaoPagina = () => {
    if (!idsPagina.length) return;
    setOrcamentosSelecionados((atuais) => {
      const set = new Set(atuais);
      if (todosPaginaSelecionados) {
        idsPagina.forEach((id) => set.delete(id));
      } else {
        idsPagina.forEach((id) => set.add(id));
      }
      return [...set];
    });
  };

  const limparSelecaoOrcamentos = () => {
    setOrcamentosSelecionados([]);
  };

  const excluirOrcamentos = (ids = []) => {
    const permitidos = new Set(base.map((item) => item.id));
    const idsParaExcluir = [...new Set(ids)].filter((id) => permitidos.has(id));

    if (!idsParaExcluir.length) {
      pushToast("Selecione pelo menos um orcamento para apagar.", "aviso");
      return;
    }

    const itens = base.filter((item) => idsParaExcluir.includes(item.id));
    const descricao = itens.length === 1
      ? `${itens[0].numero || "orcamento"} - ${itens[0].cliente || "cliente sem nome"}`
      : `${itens.length} orcamentos selecionados`;

    const ok = window.confirm(
      `Enviar para a lixeira: ${descricao}?\n\nO orcamento sai da Gestao, indicadores e filtros, mas podera ser restaurado pela lixeira.`
    );
    if (!ok) return;

    const idsSet = new Set(idsParaExcluir);
    const agora = new Date().toISOString();
    const itensLixeira = itens.map((item) => ({
      ...item,
      removidoDaGestaoEm: agora,
      removidoPorId: usuarioAtual?.id || "admin",
      removidoPorNome: nomeUsuarioSistema(usuarioAtual),
      origemLixeira: "gestao",
    }));
    salvarCRM(crm.filter((item) => !idsSet.has(item.id)));
    salvarLixeira([...itensLixeira, ...lixeiraOrcamentos.filter((item) => !idsSet.has(item.id))].slice(0, 500));
    registrarAuditoriaAcao("MOVER_LIXEIRA", itens);
    setOrcamentosSelecionados((atuais) => atuais.filter((id) => !idsSet.has(id)));
    if (historicoAberto && idsSet.has(historicoAberto)) setHistoricoAberto(null);
    pushToast(`${idsParaExcluir.length} orcamento(s) movido(s) para a lixeira.`, "ok");
  };

  const restaurarOrcamentos = (ids = []) => {
    const idsSet = new Set(ids);
    const restaurar = lixeiraOrcamentos.filter((item) => idsSet.has(item.id));
    if (!restaurar.length) {
      pushToast("Nenhum orcamento selecionado na lixeira.", "aviso");
      return;
    }
    const existentes = new Set(crm.map((item) => item.id));
    const restaurados = restaurar.map(({ removidoDaGestaoEm, removidoPorId, removidoPorNome, origemLixeira, ...item }) => ({
      ...item,
      restauradoEm: new Date().toISOString(),
      atualizadoEm: new Date().toISOString(),
    }));
    salvarCRM([...restaurados.filter((item) => !existentes.has(item.id)), ...crm]);
    salvarLixeira(lixeiraOrcamentos.filter((item) => !idsSet.has(item.id)));
    registrarAuditoriaAcao("RESTAURAR_LIXEIRA", restaurar);
    pushToast(`${restaurar.length} orcamento(s) restaurado(s) para a gestao.`, "ok");
  };

  const excluirDefinitivoLixeira = (ids = []) => {
    const idsSet = new Set(ids);
    const remover = lixeiraOrcamentos.filter((item) => idsSet.has(item.id));
    if (!remover.length) {
      pushToast("Nenhum orcamento selecionado na lixeira.", "aviso");
      return;
    }
    const ok = window.confirm(`Excluir definitivamente ${remover.length} orcamento(s) da lixeira?\n\nEsta acao nao pode ser desfeita.`);
    if (!ok) return;
    salvarLixeira(lixeiraOrcamentos.filter((item) => !idsSet.has(item.id)));
    registrarAuditoriaAcao("EXCLUIR_DEFINITIVO", remover);
    pushToast(`${remover.length} orcamento(s) excluido(s) definitivamente.`, "aviso");
  };

  const updateItem = (id, campo, valor) => {
    salvarCRM(
      crm.map((o) =>
        o.id === id
          ? {
              ...o,
              [campo]: valor,
              atualizadoEm: new Date().toISOString(),
            }
          : o
      )
    );
  };

  const atualizarOrcamento = (id, mutator) => {
    const atualizada = crm.map((item) => {
      if (item.id !== id) return item;
      return { ...mutator(item), atualizadoEm: new Date().toISOString() };
    });
    salvarCRM(atualizada);
  };

  const registrarConversa = (item, dados = {}) => {
    const texto = clean(dados.mensagem || "", 6000);

    if (!texto) {
      pushToast("Escreva a mensagem da conversa antes de registrar.", "erro");
      return null;
    }

    const direcao = dados.direcao || "saida";
    const conversa = {
      id: dados.id || `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      followupId: dados.followupId || "",
      canal: dados.canal || "WhatsApp",
      direcao,
      tipo: dados.tipo || "Follow-up",
      mensagem: texto,
      criadoEm: dados.criadoEm || new Date().toISOString(),
      origem: dados.origem || "manual",
      usuarioNome: nomeUsuarioSistema(usuarioAtual),
    };

    atualizarOrcamento(item.id, (atual) => ({
      ...atual,
      conversas: [conversa, ...(Array.isArray(atual.conversas) ? atual.conversas : [])].slice(0, 100),
      ultimoContatoEm: conversa.criadoEm,
      proximoContato: atual.proximoContato && atual.proximoContato > hojeISO ? atual.proximoContato : dataISOEmDias(direcao === "entrada" ? 1 : 3),
      lembreteIA: direcao === "entrada" ? `Responder ${atual.cliente || "cliente"}: ${clean(texto, 180)}` : atual.lembreteIA || texto,
    }));

    setConversaDrafts((atual) => ({
      ...atual,
      [item.id]: {
        canal: "WhatsApp",
        direcao: "saida",
        tipo: "Follow-up",
        ...(atual[item.id] || {}),
        mensagem: "",
      },
    }));
    pushToast("Conversa registrada no orçamento.", "ok");
    return conversa;
  };

  const registrarContato = (item, tipo = "manual", conteudo = "") => {
    const texto = clean(conteudo || item.lembreteIA || item.lembrete || `Contato registrado para acompanhar o orçamento ${item.numero || ""}.`);
    const criadoEm = new Date().toISOString();
    const contato = {
      id: `follow_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      tipo,
      canal: tipo === "whatsapp" ? "WhatsApp" : tipo === "email" ? "E-mail" : "Acompanhamento",
      conteudo: texto,
      criadoEm,
      origem: tipo === "manual" ? "manual" : "ia",
    };
    const conversa = {
      id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      followupId: contato.id,
      tipo,
      canal: contato.canal,
      direcao: "saida",
      mensagem: texto,
      criadoEm,
      origem: contato.origem,
      usuarioNome: nomeUsuarioSistema(usuarioAtual),
    };
    atualizarOrcamento(item.id, (atual) => ({
      ...atual,
      followups: [contato, ...contatosDoOrcamento(atual)].slice(0, 30),
      conversas: [conversa, ...(Array.isArray(atual.conversas) ? atual.conversas : [])].slice(0, 100),
      ultimoContatoEm: contato.criadoEm,
      proximoContato: atual.proximoContato && atual.proximoContato > hojeISO ? atual.proximoContato : dataISOEmDias(tipo === "cobranca" ? 2 : 3),
      lembreteIA: texto,
    }));
    pushToast("Contato registrado no histórico.", "ok");
    return contato;
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto);
      pushToast("Texto copiado.", "ok");
    } catch {
      pushToast("Não foi possível copiar.", "erro");
    }
  };

  const abrirWhatsItem = (item) => {
    const texto = item.lembreteIA || item.lembrete || `Olá, tudo bem? Gostaria de acompanhar o orçamento ${item.numero || ""}.`;
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank");
  };

  const abrirEmailItem = (item) => {
    const texto = item.lembreteIA || item.lembrete || `Olá,\n\nGostaria de acompanhar o orçamento ${item.numero || ""}.\n\nFico à disposição.`;
    const assunto = `Acompanhamento do orçamento ${item.numero || ""}`;
    window.location.href = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
  };

  const gerarMensagemIA = async (item, tipo = "cobranca") => {
    if (gerandoContato) return;
    setGerandoContato(`${item.id}_${tipo}`);
    const emp = empresas.find((e) => e.id === item.empresaId);
    const prioridade = avaliarPrioridadeOrcamento(item);

    const pedido = tipo === "email"
      ? `Gere um e-mail profissional de follow-up para o orçamento abaixo. Entregue assunto e corpo.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${statusFunilOrcamento(item)}\nPróximo contato: ${item.proximoContato || "não definido"}\nPrioridade: ${prioridade.nivel} (${prioridade.motivos.join(", ")})`
      : tipo === "whatsapp"
        ? `Gere uma mensagem curta de WhatsApp para acompanhar este orçamento.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${statusFunilOrcamento(item)}\nPrioridade: ${prioridade.nivel}`
        : `Gere uma mensagem de cobrança/follow-up firme, educada e comercial para este orçamento ainda sem retorno.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${statusFunilOrcamento(item)}\nPróximo contato: ${item.proximoContato || "não definido"}\nMotivos de prioridade: ${prioridade.motivos.join(", ")}`;

    try {
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode: tipo === "email" ? "email" : tipo === "whatsapp" ? "whatsapp" : "cobranca",
          messages: [{ role: "user", content: pedido }],
          context: { empresas, crm: base },
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta da IA veio inválida.");
      }

      if (!response.ok) throw new Error(data.error || "Erro ao gerar mensagem com IA.");

      registrarContato(item, tipo, data.answer || "");
      pushToast("IA gerou mensagem e salvou no histórico.", "ok");
    } catch (error) {
      console.error("Erro ao gerar follow-up:", error);
      pushToast(error.message || "Erro ao gerar follow-up com IA.", "erro");
    } finally {
      setGerandoContato(null);
    }
  };

  const gerarInsightConversa = async (item, tipo = "resumo") => {
    if (gerandoContato) return;

    const conversas = conversasDoOrcamento(item);
    if (!conversas.length) {
      pushToast("Registre pelo menos uma conversa antes de usar a IA.", "aviso");
      return;
    }

    setGerandoContato(`${item.id}_${tipo}`);
    const emp = empresas.find((e) => e.id === item.empresaId);
    const ultimaCliente = ultimaMensagemCliente(item);
    const linhaDoTempo = conversas
      .slice(0, 14)
      .reverse()
      .map((msg) => {
        const lado = msg.direcao === "entrada" ? "CLIENTE" : msg.direcao === "interna" ? "INTERNO" : "EMPRESA";
        return `${tsFmt(msg.criadoEm)} | ${msg.canal || "Canal"} | ${lado} | ${msg.tipo || "Conversa"}: ${clean(msg.mensagem || msg.conteudo || "", 900)}`;
      })
      .join("\n");

    const pedido = tipo === "resposta"
      ? `Leia o historico comercial deste orcamento e gere a melhor resposta para o cliente. Seja claro, cordial, comercial e objetivo. Nao invente dados.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNumero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal ?? item.valor)}\nStatus: ${statusFunilOrcamento(item)}\nUltima mensagem do cliente: ${ultimaCliente ? clean(ultimaCliente.mensagem || "", 1200) : "nao identificada"}\n\nHistorico:\n${linhaDoTempo}`
      : `Resuma o historico comercial deste orcamento para o vendedor. Entregue: 1) resumo em 3 linhas, 2) objeções ou pontos de atencao, 3) proxima acao recomendada, 4) sugestao de mensagem curta. Nao invente dados.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNumero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal ?? item.valor)}\nStatus: ${statusFunilOrcamento(item)}\n\nHistorico:\n${linhaDoTempo}`;

    try {
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode: tipo === "resposta" ? "resposta_cliente" : "geral",
          messages: [{ role: "user", content: pedido }],
          context: { empresas, crm: base },
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta da IA veio inválida.");
      }

      if (!response.ok) throw new Error(data.error || "Erro ao analisar conversa com IA.");

      const resposta = data.answer || "";
      if (tipo === "resposta") {
        atualizarDraftConversa(item.id, {
          canal: ultimaCliente?.canal || "WhatsApp",
          direcao: "saida",
          tipo: "Resposta IA",
          mensagem: resposta,
        });
        atualizarOrcamento(item.id, (atual) => ({
          ...atual,
          lembreteIA: resposta,
        }));
        pushToast("IA preparou a resposta no rascunho da conversa.", "ok");
      } else {
        const nota = {
          id: `conv_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          canal: "Nota IA",
          direcao: "interna",
          tipo: "Resumo IA",
          mensagem: resposta,
          criadoEm: new Date().toISOString(),
          origem: "ia",
          usuarioNome: nomeUsuarioSistema(usuarioAtual),
        };
        atualizarOrcamento(item.id, (atual) => ({
          ...atual,
          conversas: [nota, ...(Array.isArray(atual.conversas) ? atual.conversas : [])].slice(0, 100),
          resumoConversas: resposta,
          lembreteIA: resposta,
        }));
        pushToast("IA resumiu o histórico e salvou no orçamento.", "ok");
      }
    } catch (error) {
      console.error("Erro ao analisar conversa:", error);
      pushToast(error.message || "Erro ao analisar conversa com IA.", "erro");
    } finally {
      setGerandoContato(null);
    }
  };

  const criarLembretesIA = () => {
    const pendentes = crm.filter((o) => !isFinalizadoOrcamento(o));

    if (!pendentes.length) {
      pushToast("Nenhum orçamento pendente para gerar lembrete.", "aviso");
      return;
    }

    const atualizados = crm.map((item) => {
      if (isFinalizadoOrcamento(item)) return item;

      const prazo = diasAte(item.proximoContato);
      let lembrete = `Entrar em contato com ${item.cliente || "cliente"} para acompanhar o orçamento ${item.numero || ""}.`;

      if (prazo !== null && prazo < 0) {
        lembrete = `Cobrança urgente: orçamento ${item.numero || ""} de ${item.cliente || "cliente"} está com contato atrasado.`;
      } else if (prazo === 0) {
        lembrete = `Entrar em contato hoje com ${item.cliente || "cliente"} sobre o orçamento ${item.numero || ""}.`;
      } else if (normalizarStatusOrcamento(item) === "Andamento") {
        lembrete = `Retomar negociação com ${item.cliente || "cliente"} e registrar o próximo passo do orçamento ${item.numero || ""}.`;
      }

      return {
        ...item,
        lembreteIA: item.lembreteIA || lembrete,
        lembrete: item.lembrete || lembrete,
        atualizadoEm: new Date().toISOString(),
      };
    });

    salvarCRM(atualizados);
    pushToast("IA gerou lembretes para os orçamentos pendentes.", "ok");
  };

  const normalizarWhatsRelatorio = (valor) => {
    const numero = onlyDigits(valor);
    if (!numero) return "";
    return numero.startsWith("55") ? numero : `55${numero}`;
  };

  const abrirWhats = (listaRelatorio = base) => {
    let numero = normalizarWhatsRelatorio(whats);

    if (!numero || numero.length < 12) {
      const informado = window.prompt("Qual WhatsApp deve receber o resumo da Nara? Informe DDD + numero.", whats || "");
      numero = normalizarWhatsRelatorio(informado || "");
    }

    if (!numero || numero.length < 12) {
      pushToast("Informe um WhatsApp valido com DDD para receber o relatorio.", "erro");
      return false;
    }

    setWhats(numero);
    store.set(KEY_WHATS_RELATORIO, numero);

    const msg = gerarTextoWhatsPendencias(listaRelatorio, empresas);
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    pushToast("Relatorio de atencao aberto no WhatsApp.", "ok");
    return true;
  };

  const abrirRelatorioSemanal = () => {
    const numero = normalizarWhatsDestino(whats || WHATS_REPORT_NUMBER);
    setWhats(numero);
    store.set(KEY_WHATS_RELATORIO, numero);
    const texto = gerarRelatorioSemanalNara({
      crm: base,
      clientes,
      empresas,
      usuarioNome: nomeUsuarioSistema(usuarioAtual),
    });
    abrirWhatsRelatorio({ numero, texto });
    pushToast("Relatorio semanal da Nara aberto no WhatsApp.", "ok");
  };

  const salvarConfigNara = async (patch) => {
    const nova = { ...DEFAULT_NARA_CONFIG, ...(naraConfig || {}), ...patch };
    setNaraConfig?.(nova);
    await store.set(KEY_NARA_AUTO, nova);
    pushToast("Automacao da Nara atualizada.", "ok");
  };

  const gerarRadarAgora = async () => {
    const radar = gerarRadarDiarioNara({
      crm: base,
      clientes,
      empresas,
      usuarioNome: nomeUsuarioSistema(usuarioAtual),
    });
    const pendente = { ...radar, status: "pendente" };
    setRadarPendente?.(pendente);
    await store.set(KEY_NARA_RADAR, pendente);
    const hoje = new Date().toISOString().slice(0, 10);
    const novaConfig = {
      ...DEFAULT_NARA_CONFIG,
      ...(naraConfig || {}),
      ultimoRadar: { dia: hoje, geradoEm: new Date().toISOString() },
    };
    setNaraConfig?.(novaConfig);
    await store.set(KEY_NARA_AUTO, novaConfig);
    pushToast("Radar diario da Nara gerado.", "ok");
  };

  const abrirRadarWhats = () => {
    const texto = radarPendente?.texto;
    if (!texto) {
      pushToast("Gere o radar da Nara primeiro.", "aviso");
      return;
    }
    const numero = normalizarWhatsDestino(whats || WHATS_REPORT_NUMBER);
    setWhats(numero);
    store.set(KEY_WHATS_RELATORIO, numero);
    abrirWhatsRelatorio({ numero, texto });
    pushToast("Radar da Nara aberto no WhatsApp. O envio continua manual.", "ok");
  };

  const copiarRadar = async () => {
    if (!radarPendente?.texto) {
      pushToast("Gere o radar da Nara primeiro.", "aviso");
      return;
    }
    await copiarTexto(radarPendente.texto);
  };

  const dispensarRadar = async () => {
    const resolvido = { ...(radarPendente || {}), status: "resolvido", resolvidoEm: new Date().toISOString() };
    setRadarPendente?.(null);
    await store.set(KEY_NARA_RADAR, resolvido);
    pushToast("Radar diario marcado como resolvido.", "ok");
  };

  const rodarAuditoriaNara = () => {
    const auditoria = gerarAuditoriaEquipe({ crm: base, clientes });
    setAuditoriaNara(auditoria);
    pushToast(auditoria.total ? `Nara encontrou ${auditoria.total} ponto(s) para revisar.` : "Auditoria sem pontos criticos.", auditoria.total ? "aviso" : "ok");
  };

  const copiarAuditoria = async () => {
    if (!auditoriaNara?.texto) {
      pushToast("Rode a auditoria primeiro.", "aviso");
      return;
    }
    await copiarTexto(auditoriaNara.texto);
  };

  const executarBackupAssistido = async () => {
    exportarBackup?.();
    await store.set(KEY_BACKUP_AUTO, {
      ultimoBackupEm: new Date().toISOString(),
      usuario: usuarioAtual?.email || usuarioAtual?.nome || "",
    });
    setBackupSugerido(false);
    pushToast("Backup exportado e registrado pela Nara.", "ok");
  };

  const notificarPendentes = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const pendentesHoje = base.filter((o) => !isFinalizadoOrcamento(o) && (!o.proximoContato || o.proximoContato <= hoje));

    if (!pendentesHoje.length) {
      pushToast("Não há cobranças pendentes para hoje.", "aviso");
      return;
    }

    const abriuWhats = abrirWhats(pendentesHoje);
    if (!abriuWhats) return;

    if ("Notification" in window) {
      const permissao = await Notification.requestPermission();
      if (permissao === "granted") {
        new Notification("OrçaFlow Gestão", {
          body: `${pendentesHoje.length} orçamento(s) precisam de acompanhamento hoje.`,
        });
      }
    }

    pushToast(`${pendentesHoje.length} orçamento(s) pendente(s) para acompanhar.`, "ok");
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 22, position: "relative", zIndex: 2 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 14, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 14, color: BRAND.green, fontWeight: 900, letterSpacing: 2 }}>GESTÃO ORÇAFLOW AI</div>
          <h1 className="of-title-gradient" style={{ fontSize: 34, lineHeight: 1.1, margin: "8px 0 6px", fontWeight: 950 }}>Gestão Comercial Inteligente</h1>
          <div style={{ fontSize: 13, color: BRAND.muted }}>Dashboard, CRM, acompanhamento de orçamentos e follow-up com IA em uma única tela.</div>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="of-neon-btn" onClick={() => setView("orcamento")} style={{ padding: "12px 18px", borderRadius: 14, cursor: "pointer" }}>
            ✨ Novo orçamento
          </button>
          <button onClick={() => onAnexar?.()} style={{ padding: "12px 18px", borderRadius: 14, border: `1px solid ${BRAND.green2}66`, background: `${BRAND.green2}18`, color: BRAND.green, fontWeight: 900, cursor: "pointer" }}>
            📎 Anexar orçamento
          </button>
          <button onClick={criarLembretesIA} style={{ padding: "12px 18px", borderRadius: 14, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}18`, color: "#93C5FD", fontWeight: 900, cursor: "pointer" }}>
            🤖 IA criar lembretes
          </button>
          <button onClick={notificarPendentes} style={{ padding: "12px 18px", borderRadius: 14, border: `1px solid ${BRAND.warn}66`, background: `${BRAND.warn}18`, color: "#FBBF24", fontWeight: 900, cursor: "pointer" }}>
            🔔 Notificar pendentes
          </button>
        </div>
      </div>

      <div className="of-glass" style={{ borderRadius: 18, padding: 16, marginBottom: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 13, color: BRAND.green, fontWeight: 950, letterSpacing: 1.8 }}>AUTOMAÇÕES NARA</div>
            <div style={{ fontSize: 12, color: BRAND.muted, marginTop: 4 }}>Radar diário, auditoria de registros, backup assistido e follow-up comercial sem envio automático.</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button onClick={gerarRadarAgora} style={{ padding: "9px 12px", borderRadius: 11, border: `1px solid ${BRAND.green2}66`, background: `${BRAND.green2}18`, color: BRAND.green, cursor: "pointer", fontWeight: 900 }}>Radar agora</button>
            <button onClick={rodarAuditoriaNara} style={{ padding: "9px 12px", borderRadius: 11, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}18`, color: "#93C5FD", cursor: "pointer", fontWeight: 900 }}>Auditoria</button>
            <button onClick={executarBackupAssistido} style={{ padding: "9px 12px", borderRadius: 11, border: `1px solid ${backupSugerido ? BRAND.warn : BRAND.border2}`, background: backupSugerido ? `${BRAND.warn}18` : "transparent", color: backupSugerido ? "#FBBF24" : BRAND.muted, cursor: "pointer", fontWeight: 900 }}>
              {backupSugerido ? "Backup sugerido" : "Backup"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(130px,1fr))", gap: 8, marginBottom: radarPendente || auditoriaNara ? 12 : 0 }}>
          {[
            ["Radar diário", "radarDiarioAtivo"],
            ["Checklist geração", "checklistGeracaoAtivo"],
            ["Detector similar", "detectorSimilaridadeAtivo"],
            ["Auditoria equipe", "auditoriaContatosAtiva"],
            ["Backup assistido", "backupAssistidoAtivo"],
          ].map(([label, key]) => {
            const ativo = naraConfig?.[key] !== false;
            return (
              <button key={key} onClick={() => salvarConfigNara({ [key]: !ativo })} style={{ textAlign: "left", padding: "9px 10px", borderRadius: 12, border: `1px solid ${ativo ? BRAND.green2 : BRAND.border2}55`, background: ativo ? `${BRAND.green2}12` : BRAND.panel2, color: ativo ? BRAND.green : BRAND.dim, cursor: "pointer", fontWeight: 900 }}>
                <span style={{ display: "block", fontSize: 11 }}>{label}</span>
                <span style={{ display: "block", fontSize: 9, marginTop: 3, opacity: 0.8 }}>{ativo ? "ativo" : "pausado"}</span>
              </button>
            );
          })}
        </div>

        {radarPendente?.texto && (
          <div style={{ border: `1px solid ${BRAND.green2}33`, background: `${BRAND.green2}0d`, borderRadius: 14, padding: 12, marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 950 }}>Radar diário pronto</div>
                <div style={{ fontSize: 11, color: BRAND.dim }}>Nara encontrou {radarPendente.totalOrcamentos || 0} orçamento(s) e {radarPendente.totalClientes || 0} cliente(s) para acompanhamento.</div>
              </div>
              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                <button onClick={copiarRadar} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 850 }}>Copiar</button>
                <button onClick={abrirRadarWhats} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${BRAND.green2}55`, background: `${BRAND.green2}14`, color: BRAND.green, cursor: "pointer", fontWeight: 850 }}>WhatsApp</button>
                <button onClick={dispensarRadar} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, cursor: "pointer", fontWeight: 850 }}>Resolver</button>
              </div>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: BRAND.muted, fontSize: 11, lineHeight: 1.5, maxHeight: 180, overflowY: "auto", fontFamily: "inherit" }}>{radarPendente.texto}</pre>
          </div>
        )}

        {auditoriaNara?.texto && (
          <div style={{ border: `1px solid ${auditoriaNara.total ? BRAND.warn : BRAND.green2}33`, background: auditoriaNara.total ? `${BRAND.warn}0d` : `${BRAND.green2}0d`, borderRadius: 14, padding: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 950 }}>Auditoria de registros</div>
                <div style={{ fontSize: 11, color: BRAND.dim }}>{auditoriaNara.total} ponto(s) para revisar nos históricos.</div>
              </div>
              <button onClick={copiarAuditoria} style={{ padding: "7px 10px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 850 }}>Copiar auditoria</button>
            </div>
            <pre style={{ margin: 0, whiteSpace: "pre-wrap", color: BRAND.muted, fontSize: 11, lineHeight: 1.5, maxHeight: 150, overflowY: "auto", fontFamily: "inherit" }}>{auditoriaNara.texto}</pre>
          </div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <CardGestao titulo="Orçamentos cadastrados" valor={total} cor={BRAND.blue} icon={<FileText size={19} />} />
        <CardGestao titulo="Abertos" valor={abertos} cor={BRAND.blue} icon={<Search size={19} />} />
        <CardGestao titulo="Em andamento" valor={andamento} cor={BRAND.warn} icon={<Bot size={19} />} />
        <CardGestao titulo="Finalizados" valor={finalizados} cor={BRAND.green} icon={<Shield size={19} />} />
        <CardGestao titulo="Atrasados" valor={atrasados} cor={BRAND.danger} icon={<Bell size={19} />} />
        <CardGestao titulo="Valor potencial" valor={brl(valorPotencial)} cor={BRAND.green} icon={<Database size={19} />} />
        <CardGestao titulo="Ticket médio" valor={brl(ticketMedio)} cor={"#7C3AED"} icon={<Building2 size={19} />} />
        <CardGestao titulo="Conversão" valor={`${taxaConversao}%`} cor={BRAND.blue} icon={<Users size={19} />} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1.2fr .8fr", gap: 16, marginBottom: 18 }}>
        <div style={painelGestao}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 16 }}>
            <div>
              <h3 style={tituloPainel}>Funil de Orçamentos</h3>
              <div style={{ fontSize: 12, color: BRAND.muted }}>Distribuição por status e prioridade de acompanhamento.</div>
            </div>
            <span style={{ color: BRAND.green, fontSize: 12, fontWeight: 900 }}>{brl(valorPotencial)} em aberto</span>
          </div>

          {["Aberto", "Andamento", "Finalizado", "Atrasado"].map((s) => {
            const qtd = base.filter((i) => statusFunilOrcamento(i) === s).length;
            const pct = total ? Math.round((qtd / total) * 100) : 0;

            return (
              <div key={s} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                  <span style={{ fontWeight: 850 }}>{s}</span>
                  <span style={{ color: BRAND.muted }}>{qtd} orçamento(s)</span>
                </div>
                <div style={{ height: 10, background: "#07111F", borderRadius: 999, overflow: "hidden", marginTop: 6 }}>
                  <div style={{ width: `${pct}%`, height: "100%", background: statusColor[s], borderRadius: 999 }} />
                </div>
              </div>
            );
          })}
        </div>

        <div style={painelGestao}>
          <h3 style={tituloPainel}>OrçaFlow AI</h3>
          <p style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.6 }}>
            A IA identifica orçamentos abertos, clientes sem retorno, contatos atrasados e oportunidades que precisam de ação.
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
            <AlertaIA cor={BRAND.warn} titulo={`${precisamContato} acompanhamento(s)`} texto="Orçamentos que precisam de retorno ou próximo passo." />
            <AlertaIA cor={BRAND.danger} titulo={`${atrasados} atraso(s)`} texto="Priorizar cobrança e atualização de status." />
            <AlertaIA cor={BRAND.green} titulo={brl(ticketMedio)} texto="Ticket médio dos orçamentos cadastrados." />
          </div>

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${BRAND.border}` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 950, color: BRAND.text }}>Fila de follow-up</div>
              <button
                type="button"
                onClick={() => {
                  setFiltroRapido("Prioridade alta");
                  setOrdenacao("prioridade");
                }}
                style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12` }}
              >
                Ver altas
              </button>
            </div>

            {filaFollowup.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {filaFollowup.map(({ item, prioridade }) => {
                  const chaveCarga = `${item.id}_cobranca`;
                  return (
                    <div key={item.id} style={{ padding: 10, borderRadius: 12, background: "rgba(7,17,31,.72)", border: `1px solid ${BRAND.border}` }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "flex-start" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ color: BRAND.text, fontSize: 12, fontWeight: 900, overflowWrap: "anywhere" }}>{item.cliente || "Cliente sem nome"}</div>
                          <div style={{ color: BRAND.dim, fontSize: 10, marginTop: 2 }}>{item.numero || "orcamento"} - {brl(item.valorGlobal ?? item.valor)}</div>
                        </div>
                        <span style={{ flex: "0 0 auto", color: prioridade.cor, fontSize: 10, fontWeight: 950 }}>
                          {prioridade.nivel} {prioridade.score}
                        </span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginTop: 8 }}>
                        <div style={{ color: BRAND.muted, fontSize: 10, lineHeight: 1.4 }}>{prioridade.acao}</div>
                        <button
                          type="button"
                          disabled={gerandoContato === chaveCarga}
                          onClick={() => gerarMensagemIA(item, "cobranca")}
                          style={{ ...btnMiniGestao, color: "#93C5FD", borderColor: `${BRAND.blue2}66`, background: `${BRAND.blue2}12`, opacity: gerandoContato === chaveCarga ? 0.55 : 1 }}
                        >
                          {gerandoContato === chaveCarga ? "Gerando" : "IA cobrar"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ color: BRAND.dim, fontSize: 11, lineHeight: 1.5 }}>
                Nenhum orcamento entrou na fila de prioridade no momento.
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={painelGestao}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
          <div>
            <h3 style={tituloPainel}>Controle de orçamentos</h3>
            <div style={{ fontSize: 12, color: BRAND.muted }}>
              {lista.length} de {base.length} orçamento(s) filtrado(s). Página {paginaAtual} de {totalPaginas}.
            </div>
          </div>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
            {["Todos", "Prioridade alta", "Em aberto", "Atrasados", "Hoje", "Sem contato", "Anexados"].map((f) => (
              <button
                key={f}
                onClick={() => setFiltroRapido(f)}
                style={{
                  padding: "7px 10px",
                  borderRadius: 999,
                  border: `1px solid ${filtroRapido === f ? BRAND.green2 : BRAND.border2}`,
                  background: filtroRapido === f ? `${BRAND.green2}18` : "transparent",
                  color: filtroRapido === f ? BRAND.green : BRAND.muted,
                  cursor: "pointer",
                  fontWeight: 850,
                }}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
          {pipelineComercial.map((etapa) => (
            <button
              key={etapa.id}
              type="button"
              onClick={() => {
                if (etapa.id === "total") { setFiltroRapido("Todos"); setStatusFiltro("Todos"); }
                if (etapa.id === "aberto") { setFiltroRapido("Em aberto"); setStatusFiltro("Todos"); }
                if (etapa.id === "andamento") { setFiltroRapido("Todos"); setStatusFiltro("Andamento"); }
                if (etapa.id === "atrasado") { setFiltroRapido("Atrasados"); setStatusFiltro("Todos"); }
                if (etapa.id === "finalizado") { setFiltroRapido("Todos"); setStatusFiltro("Finalizado"); }
              }}
              style={{ textAlign: "left", padding: 12, borderRadius: 14, border: `1px solid ${etapa.cor}44`, background: `${etapa.cor}10`, color: BRAND.text, cursor: "pointer" }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                <strong style={{ color: etapa.cor, fontSize: 12 }}>{etapa.label}</strong>
                <span style={{ fontSize: 18, fontWeight: 950, color: etapa.cor }}>{etapa.qtd}</span>
              </div>
              <div style={{ color: BRAND.muted, fontSize: 11, marginTop: 7 }}>{brl(etapa.valor)}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 12, padding: "10px 12px", borderRadius: 12, border: `1px solid ${orcamentosSelecionados.length ? BRAND.danger : BRAND.border2}`, background: orcamentosSelecionados.length ? `${BRAND.danger}10` : "rgba(7,17,31,.42)" }}>
          <div style={{ fontSize: 12, color: orcamentosSelecionados.length ? BRAND.danger : BRAND.muted, fontWeight: 850 }}>
            {orcamentosSelecionados.length
              ? `${orcamentosSelecionados.length} orcamento(s) selecionado(s) para acao`
              : "Marque os orcamentos na primeira coluna para apagar em bloco."}
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" onClick={alternarSelecaoPagina} disabled={!idsPagina.length} style={{ ...btnMiniGestao, opacity: idsPagina.length ? 1 : 0.45 }}>
              {todosPaginaSelecionados ? "Desmarcar pagina" : "Selecionar pagina"}
            </button>
            <button type="button" onClick={limparSelecaoOrcamentos} disabled={!orcamentosSelecionados.length} style={{ ...btnMiniGestao, opacity: orcamentosSelecionados.length ? 1 : 0.45 }}>
              Limpar selecao
            </button>
            <button type="button" onClick={() => excluirOrcamentos(orcamentosSelecionados)} disabled={!orcamentosSelecionados.length} style={{ ...btnMiniGestao, color: BRAND.danger, borderColor: `${BRAND.danger}66`, background: `${BRAND.danger}12`, opacity: orcamentosSelecionados.length ? 1 : 0.45 }}>
              <Trash2 size={12} /> Mover p/ lixeira
            </button>
            <button type="button" onClick={() => setLixeiraAberta((v) => !v)} style={{ ...btnMiniGestao, color: lixeiraVisivel.length ? BRAND.warn : BRAND.muted, borderColor: lixeiraVisivel.length ? `${BRAND.warn}66` : BRAND.border2, background: lixeiraVisivel.length ? `${BRAND.warn}12` : "transparent" }}>
              Lixeira ({lixeiraVisivel.length})
            </button>
            <button type="button" onClick={() => setAuditoriaAcoesAberta((v) => !v)} style={{ ...btnMiniGestao, color: "#93C5FD", borderColor: `${BRAND.blue2}66`, background: `${BRAND.blue2}12` }}>
              Auditoria ({auditoriaVisivel.length})
            </button>
          </div>
        </div>

        {lixeiraAberta && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 14, border: `1px solid ${BRAND.warn}55`, background: `${BRAND.warn}0f` }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 950, color: BRAND.warn }}>Lixeira de orcamentos</div>
                <div style={{ fontSize: 11, color: BRAND.muted }}>Restaure orcamentos apagados por engano ou remova definitivamente.</div>
              </div>
              {!!lixeiraVisivel.length && (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" onClick={() => restaurarOrcamentos(lixeiraVisivel.map((item) => item.id))} style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12` }}>
                    Restaurar todos
                  </button>
                  <button type="button" onClick={() => excluirDefinitivoLixeira(lixeiraVisivel.map((item) => item.id))} style={{ ...btnMiniGestao, color: BRAND.danger, borderColor: `${BRAND.danger}66`, background: `${BRAND.danger}10` }}>
                    Esvaziar
                  </button>
                </div>
              )}
            </div>

            {lixeiraVisivel.length ? (
              <div style={{ display: "grid", gap: 8 }}>
                {lixeiraVisivel.slice(0, 10).map((item) => (
                  <div key={item.id} style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) minmax(110px,.7fr) auto", gap: 8, alignItems: "center", padding: 10, borderRadius: 12, border: `1px solid ${BRAND.border2}`, background: BRAND.panel2 }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 950, color: BRAND.text, overflowWrap: "anywhere" }}>{item.cliente || "Cliente sem nome"}</div>
                      <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3 }}>{item.numero || "orcamento"} - {item.empresaNome || item.empresa || "empresa"} - removido em {tsFmt(item.removidoDaGestaoEm)}</div>
                    </div>
                    <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 850 }}>{brl(item.valorGlobal ?? item.valor)}</div>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                      <button type="button" onClick={() => restaurarOrcamentos([item.id])} style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12` }}>Restaurar</button>
                      <button type="button" onClick={() => excluirDefinitivoLixeira([item.id])} style={{ ...btnMiniGestao, color: BRAND.danger, borderColor: `${BRAND.danger}66` }}>Excluir</button>
                    </div>
                  </div>
                ))}
                {lixeiraVisivel.length > 10 && <div style={{ color: BRAND.dim, fontSize: 11 }}>Mostrando os 10 itens mais recentes da lixeira.</div>}
              </div>
            ) : (
              <div style={{ color: BRAND.dim, fontSize: 12 }}>A lixeira esta vazia.</div>
            )}
          </div>
        )}

        {auditoriaAcoesAberta && (
          <div style={{ marginBottom: 12, padding: 12, borderRadius: 14, border: `1px solid ${BRAND.blue2}55`, background: `${BRAND.blue2}0f` }}>
            <div style={{ fontSize: 13, fontWeight: 950, color: "#93C5FD", marginBottom: 8 }}>Auditoria de acoes comerciais</div>
            {auditoriaVisivel.length ? (
              <div style={{ display: "grid", gap: 7 }}>
                {auditoriaVisivel.slice(0, 12).map((log) => (
                  <div key={log.id} style={{ display: "grid", gridTemplateColumns: "130px 1fr 150px", gap: 8, alignItems: "center", padding: 9, borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: BRAND.panel2 }}>
                    <strong style={{ color: log.acao === "MOVER_LIXEIRA" ? BRAND.warn : log.acao === "EXCLUIR_DEFINITIVO" ? BRAND.danger : BRAND.green, fontSize: 10 }}>{log.acao}</strong>
                    <div style={{ color: BRAND.muted, fontSize: 11, overflowWrap: "anywhere" }}>
                      {log.quantidade || 0} item(ns) - {log.itens?.[0]?.numero || "orcamento"} {log.itens?.[0]?.cliente ? `- ${log.itens[0].cliente}` : ""}
                    </div>
                    <div style={{ color: BRAND.dim, fontSize: 10, textAlign: "right" }}>{tsFmt(log.criadoEm)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ color: BRAND.dim, fontSize: 12 }}>Nenhuma acao registrada ainda.</div>
            )}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(220px,2fr) minmax(140px,1fr) minmax(170px,1fr) minmax(160px,1fr) 110px", gap: 12, marginBottom: 16 }}>
          <input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por cliente, orçamento, empresa, status ou lembrete..."
            style={inputGestao}
          />

          <select value={statusFiltro} onChange={(e) => setStatusFiltro(e.target.value)} style={inputGestao}>
            <option>Todos</option>
            <option>Aberto</option>
            <option>Andamento</option>
            <option>Finalizado</option>
          </select>

          <select value={empresaFiltro} onChange={(e) => setEmpresaFiltro(e.target.value)} style={inputGestao}>
            <option value="Todas">Todas as empresas</option>
            {empresas.map((e) => (
              <option key={e.id} value={e.id}>{e.nome}</option>
            ))}
          </select>

          <select value={ordenacao} onChange={(e) => setOrdenacao(e.target.value)} style={inputGestao}>
            <option value="contatoAsc">Próximo contato</option>
            <option value="criadoDesc">Mais recentes</option>
            <option value="valorDesc">Maior valor</option>
            <option value="valorAsc">Menor valor</option>
            <option value="clienteAsc">Cliente A-Z</option>
            <option value="status">Status</option>
            <option value="prioridade">Prioridade</option>
          </select>

          <select value={porPagina} onChange={(e) => setPorPagina(Number(e.target.value))} style={inputGestao}>
            {[10, 15, 25, 50].map((n) => <option key={n} value={n}>{n}/pág.</option>)}
          </select>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1280 }}>
            <thead>
              <tr style={{ color: BRAND.muted, textAlign: "left" }}>
                <th style={{ ...th, width: 44, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={todosPaginaSelecionados}
                    onChange={alternarSelecaoPagina}
                    title="Selecionar orcamentos desta pagina"
                    style={{ width: 16, height: 16, accentColor: BRAND.green2, cursor: "pointer" }}
                  />
                </th>
                <th style={th}>Cliente</th>
                <th style={th}>Empresa</th>
                <th style={th}>Valor</th>
                <th style={th}>Prioridade</th>
                <th style={th}>Status</th>
                <th style={th}>Próximo contato</th>
                <th style={th}>Lembrete IA</th>
                <th style={th}>Acoes</th>
              </tr>
            </thead>
            <tbody>
              {lista.length ? (
                paginaItens.map((item) => {
                  const st = statusReal(item);
                  const prioridade = avaliarPrioridadeOrcamento(item);
                  const conversas = conversasDoOrcamento(item);
                  const ultimoContato = ultimoContatoOrcamento(item);
                  const lembreteAtual = item.lembreteIA || item.lembrete || "";
                  const carregandoContato = String(gerandoContato || "").startsWith(`${item.id}_`);
                  const rascunhoConversa = draftConversa(item.id);
                  const clienteVinculado = clienteVinculadoOrcamento(item);
                  const sugestoesCliente = clienteVinculado ? [] : clientesCompativeisComOrcamento(item, clientesVisiveis, 3);
                  const clienteDraft = clienteLinkDrafts[item.id] || item.clienteSugeridoId || "";
                  const empresaItem = empresas.find((emp) => emp.id === item.empresaId || emp.nome === item.empresaNome || emp.nome === item.empresa);
                  const tituloVisivel = item.tituloResumo || resumoComercialOrcamento(
                    item.orcamentoCompleto || { campos: { cliente: item.cliente, escopo: item.descricaoArquivo || item.lembreteIA || item.resumoConversas || "" } },
                    empresaItem || {},
                    item.cliente,
                    item.descricaoArquivo || item.lembreteIA || item.resumoConversas || ""
                  );
                  const mostrarNumeroVisivel = documentoExibeCodigo(perfilVisualEmpresa(empresaItem || {}, item.orcamentoCompleto || {}));
                  return (
                    <React.Fragment key={item.id}>
                      <tr style={{ borderTop: `1px solid ${BRAND.border}` }}>
                        <td style={{ ...td, textAlign: "center", verticalAlign: "top" }}>
                          <input
                            type="checkbox"
                            checked={idsSelecionados.has(item.id)}
                            onChange={() => alternarSelecaoOrcamento(item.id)}
                            title="Selecionar este orcamento"
                            style={{ width: 16, height: 16, accentColor: BRAND.green2, cursor: "pointer" }}
                          />
                        </td>
                        <td style={td}>
                          {item.descricaoArquivo && (
                            <div style={{ fontSize: 10.5, color: "#B6C7DD", marginTop: 5, lineHeight: 1.45, maxWidth: 330 }}>
                              {item.descricaoArquivo}
                            </div>
                          )}
                          {(item.dataDocumento || item.empresaNomeDetectada) && (
                            <div style={{ fontSize: 9.5, color: BRAND.dim, marginTop: 4 }}>
                              {item.dataDocumento ? `Doc.: ${item.dataDocumento}` : ""}{item.dataDocumento && item.empresaNomeDetectada ? " · " : ""}{item.empresaNomeDetectada ? `IA: ${item.empresaNomeDetectada}` : ""}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => (baixarOrcamento || abrirOrcamentoSalvo)?.(item)}
                            title="Abrir / baixar o orçamento"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: BRAND.text,
                              padding: 0,
                              cursor: "pointer",
                              textAlign: "left",
                              fontSize: 12,
                              fontWeight: 900,
                              textDecoration: "underline",
                              textDecorationColor: BRAND.blue,
                              textUnderlineOffset: 3,
                            }}
                          >
                            {tituloVisivel || item.cliente || "—"}
                          </button>

                          <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3 }}>
                            {mostrarNumeroVisivel && item.numero ? `${item.numero} · ` : ""}{tsFmt(item.criadoEm)}
                            {item.anexado && <span style={{ marginLeft: 6, padding: "1px 6px", borderRadius: 8, background: `${BRAND.green2}1e`, color: BRAND.green, fontWeight: 800, fontSize: 9 }}>📎 anexado</span>}
                          </div>

                          <button
                            type="button"
                            onClick={() => (baixarOrcamento || abrirOrcamentoSalvo)?.(item)}
                            style={{
                              marginTop: 7,
                              padding: "5px 9px",
                              borderRadius: 8,
                              border: `1px solid ${(item.orcamentoCompleto || item.anexado) ? BRAND.blue2 : BRAND.border2}66`,
                              background: (item.orcamentoCompleto || item.anexado) ? `${BRAND.blue2}18` : "transparent",
                              color: (item.orcamentoCompleto || item.anexado) ? "#93C5FD" : BRAND.dim,
                              cursor: "pointer",
                              fontSize: 10,
                              fontWeight: 850,
                            }}
                          >
                            {item.anexado ? "⬇ Baixar PDF" : "👁 Abrir orçamento"}
                          </button>

                          {ultimoContato && (
                            <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 7 }}>
                              Último contato: {tsFmt(ultimoContato.criadoEm)}
                            </div>
                          )}
                          <div style={{ marginTop: 10, borderTop: `1px solid ${BRAND.border2}`, paddingTop: 8 }}>
                            {clienteVinculado ? (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                                  <span style={{ color: BRAND.green, fontSize: 10, fontWeight: 950 }}>Cliente CRM:</span>
                                  <span style={{ color: BRAND.text, fontSize: 10.5, fontWeight: 850 }}>{clienteVinculado.nome || clienteVinculado.empresa}</span>
                                </div>
                                <button type="button" onClick={() => desvincularOrcamentoCliente(item)} style={{ ...btnMiniGestao, width: "fit-content", color: BRAND.danger, borderColor: `${BRAND.danger}55`, background: `${BRAND.danger}10` }}>
                                  Desvincular cliente
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: "grid", gap: 6 }}>
                                <div style={{ color: BRAND.dim, fontSize: 10 }}>Sem cliente CRM vinculado</div>
                                {sugestoesCliente[0] && (
                                  <button
                                    type="button"
                                    onClick={() => vincularOrcamentoAoCliente(item, sugestoesCliente[0].cliente.id)}
                                    style={{ ...btnMiniGestao, width: "fit-content", color: BRAND.warn, borderColor: `${BRAND.warn}55`, background: `${BRAND.warn}10` }}
                                  >
                                    Sugestao: {sugestoesCliente[0].cliente.nome || sugestoesCliente[0].cliente.empresa} ({sugestoesCliente[0].score}%)
                                  </button>
                                )}
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6 }}>
                                  <select
                                    value={clienteDraft}
                                    onChange={(e) => setClienteLinkDrafts((atual) => ({ ...atual, [item.id]: e.target.value }))}
                                    style={{ ...inputGestao, padding: "7px 9px", fontSize: 10.5 }}
                                  >
                                    <option value="">Vincular cliente...</option>
                                    {clientesVisiveis.map((clienteItem) => (
                                      <option key={clienteItem.id} value={clienteItem.id}>{clienteItem.nome || clienteItem.empresa || clienteItem.email || "Cliente sem nome"}</option>
                                    ))}
                                  </select>
                                  <button type="button" onClick={() => vincularOrcamentoAoCliente(item, clienteDraft)} style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}55`, background: `${BRAND.green2}10` }}>
                                    Vincular
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td style={td}>{item.empresaNome || item.empresa || "—"}</td>
                        <td style={td}>
                          <ValorEditavel
                            valor={item.valorGlobal ?? item.valor ?? ""}
                            onSalvar={(n) => updateItem(item.id, "valorGlobal", n)}
                          />
                        </td>
                        <td style={td}>
                          <div style={{ display: "grid", gap: 7, minWidth: 118 }}>
                            <span style={{ display: "inline-flex", width: "fit-content", alignItems: "center", gap: 6, padding: "5px 9px", borderRadius: 999, color: prioridade.cor, border: `1px solid ${prioridade.cor}66`, background: `${prioridade.cor}12`, fontSize: 10, fontWeight: 950 }}>
                              {prioridade.nivel} {prioridade.score}
                            </span>
                            <div style={{ fontSize: 10, color: BRAND.muted, lineHeight: 1.45 }}>
                              {(prioridade.motivos || []).slice(0, 3).join(" - ") || prioridade.acao}
                            </div>
                          </div>
                        </td>
                        <td style={td}>
                          <select
                            value={normalizarStatusOrcamento(item)}
                            onChange={(e) => updateItem(item.id, "status", e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 999,
                              color: statusColor[normalizarStatusOrcamento(item)] || BRAND.text,
                              border: `1px solid ${statusColor[normalizarStatusOrcamento(item)] || BRAND.border}`,
                              background: BRAND.panel2,
                              fontWeight: 800,
                              outline: "none",
                            }}
                          >
                            <option>Aberto</option>
                            <option>Andamento</option>
                            <option>Finalizado</option>
                          </select>
                          {st === "Atrasado" && <div style={{ fontSize: 10, color: BRAND.danger, marginTop: 5 }}>Contato atrasado</div>}
                        </td>
                        <td style={td}>
                          <input
                            type="date"
                            value={item.proximoContato || ""}
                            onChange={(e) => updateItem(item.id, "proximoContato", e.target.value)}
                            style={{ ...inputGestao, padding: "8px 10px" }}
                          />
                        </td>
                        <td style={{ ...td, minWidth: 300 }}>
                          <textarea
                            value={lembreteAtual}
                            onChange={(e) => updateItem(item.id, "lembreteIA", e.target.value)}
                            placeholder="Lembrete de cobrança..."
                            rows={2}
                            style={{ ...inputGestao, resize: "vertical", minHeight: 42 }}
                          />

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 6, marginTop: 8 }}>
                            <button type="button" disabled={carregandoContato} onClick={() => gerarMensagemIA(item, "cobranca")} style={{ ...btnMiniGestao, color: BRAND.warn, borderColor: `${BRAND.warn}66`, background: `${BRAND.warn}12`, opacity: carregandoContato ? 0.55 : 1 }}>
                              <Bot size={12} /> Cobrar
                            </button>
                            <button type="button" disabled={carregandoContato} onClick={() => gerarMensagemIA(item, "email")} style={{ ...btnMiniGestao, color: "#93C5FD", borderColor: `${BRAND.blue2}66`, background: `${BRAND.blue2}12`, opacity: carregandoContato ? 0.55 : 1 }}>
                              <Mail size={12} /> E-mail
                            </button>
                            <button type="button" disabled={carregandoContato} onClick={() => gerarMensagemIA(item, "whatsapp")} style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12`, opacity: carregandoContato ? 0.55 : 1 }}>
                              <MessageSquareText size={12} /> Whats
                            </button>
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 6, marginTop: 6 }}>
                            <button type="button" onClick={() => copiarTexto(lembreteAtual || `Acompanhar orçamento ${item.numero || ""}.`)} style={btnMiniGestao}>
                              <Copy size={12} /> Copiar
                            </button>
                            <button type="button" onClick={() => abrirEmailItem(item)} style={btnMiniGestao}>
                              <Mail size={12} /> Abrir
                            </button>
                            <button type="button" onClick={() => abrirWhatsItem(item)} style={btnMiniGestao}>
                              <Send size={12} /> Enviar
                            </button>
                            <button type="button" onClick={() => setHistoricoAberto(historicoAberto === item.id ? null : item.id)} style={btnMiniGestao}>
                              <MessageSquareText size={12} /> {conversas.length}
                            </button>
                          </div>
                        </td>
                        <td style={{ ...td, minWidth: 82, verticalAlign: "top" }}>
                          <button
                            type="button"
                            onClick={() => excluirOrcamentos([item.id])}
                            title="Mover somente este orcamento para a lixeira"
                            style={{ ...btnMiniGestao, color: BRAND.danger, borderColor: `${BRAND.danger}66`, background: `${BRAND.danger}10`, width: "100%" }}
                          >
                            <Trash2 size={12} /> Lixeira
                          </button>
                        </td>
                      </tr>

                      {historicoAberto === item.id && (
                        <tr>
                          <td colSpan="9" style={{ padding: "0 8px 14px", borderTop: `1px solid ${BRAND.border}` }}>
                            <div style={{ border: `1px solid ${BRAND.border}`, background: "rgba(7,17,31,.64)", borderRadius: 14, padding: 12 }}>
                              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
                                <div>
                                  <div style={{ fontSize: 12, color: BRAND.text, fontWeight: 950 }}>Conversas do cliente</div>
                                  <div style={{ fontSize: 10, color: BRAND.dim }}>{item.numero || "orçamento"} - {item.cliente || "cliente"}</div>
                                </div>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                  <button type="button" disabled={carregandoContato} onClick={() => gerarInsightConversa(item, "resumo")} style={{ ...btnMiniGestao, color: "#93C5FD", borderColor: `${BRAND.blue2}66`, background: `${BRAND.blue2}12`, opacity: carregandoContato ? 0.55 : 1 }}>
                                    <Bot size={12} /> Resumir IA
                                  </button>
                                  <button type="button" disabled={carregandoContato} onClick={() => gerarInsightConversa(item, "resposta")} style={{ ...btnMiniGestao, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12`, opacity: carregandoContato ? 0.55 : 1 }}>
                                    <Bot size={12} /> Responder IA
                                  </button>
                                </div>
                              </div>

                              <div style={{ display: "grid", gridTemplateColumns: "minmax(120px,.7fr) minmax(120px,.7fr) minmax(130px,.8fr) minmax(240px,2fr) auto", gap: 8, alignItems: "start", marginBottom: 12 }}>
                                <select value={rascunhoConversa.canal} onChange={(e) => atualizarDraftConversa(item.id, { canal: e.target.value })} style={{ ...inputGestao, padding: "9px 10px" }}>
                                  <option>WhatsApp</option>
                                  <option>E-mail</option>
                                  <option>Ligação</option>
                                  <option>Reunião</option>
                                  <option>Presencial</option>
                                  <option>Observação</option>
                                </select>
                                <select value={rascunhoConversa.direcao} onChange={(e) => atualizarDraftConversa(item.id, { direcao: e.target.value })} style={{ ...inputGestao, padding: "9px 10px" }}>
                                  <option value="entrada">Cliente respondeu</option>
                                  <option value="saida">Empresa enviou</option>
                                  <option value="interna">Nota interna</option>
                                </select>
                                <select value={rascunhoConversa.tipo} onChange={(e) => atualizarDraftConversa(item.id, { tipo: e.target.value })} style={{ ...inputGestao, padding: "9px 10px" }}>
                                  <option>Follow-up</option>
                                  <option>Cobrança</option>
                                  <option>Resposta</option>
                                  <option>Objeção</option>
                                  <option>Negociação</option>
                                  <option>Aprovação</option>
                                  <option>Recusa</option>
                                  <option>Observação</option>
                                </select>
                                <textarea
                                  value={rascunhoConversa.mensagem}
                                  onChange={(e) => atualizarDraftConversa(item.id, { mensagem: e.target.value })}
                                  placeholder="Cole ou escreva a conversa feita com o cliente..."
                                  rows={3}
                                  style={{ ...inputGestao, resize: "vertical", minHeight: 76 }}
                                />
                                <button type="button" onClick={() => registrarConversa(item, rascunhoConversa)} style={{ ...btnMiniGestao, minHeight: 38, color: BRAND.green, borderColor: `${BRAND.green2}66`, background: `${BRAND.green2}12` }}>
                                  Salvar conversa
                                </button>
                              </div>

                              {item.resumoConversas && (
                                <div style={{ padding: 10, borderRadius: 10, background: `${BRAND.blue2}10`, border: `1px solid ${BRAND.blue2}33`, marginBottom: 10 }}>
                                  <div style={{ color: "#93C5FD", fontSize: 10, fontWeight: 950, marginBottom: 4 }}>Resumo IA</div>
                                  <div style={{ color: BRAND.text, fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{item.resumoConversas}</div>
                                </div>
                              )}

                              {conversas.length ? (
                                <div style={{ display: "grid", gap: 8 }}>
                                  {conversas.slice(0, 10).map((msg) => {
                                    const direcaoCor = msg.direcao === "entrada" ? BRAND.warn : msg.direcao === "interna" ? "#93C5FD" : BRAND.green;
                                    const direcaoTexto = msg.direcao === "entrada" ? "Cliente" : msg.direcao === "interna" ? "Interno" : "Empresa";
                                    return (
                                      <div key={msg.id || msg.criadoEm} style={{ padding: 10, borderRadius: 10, background: BRAND.panel2, border: `1px solid ${BRAND.border2}` }}>
                                        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: BRAND.muted, fontSize: 10, marginBottom: 5, flexWrap: "wrap" }}>
                                          <span>
                                            <strong style={{ color: direcaoCor }}>{direcaoTexto}</strong> - {msg.canal || "Canal"} - {msg.tipo || "Conversa"} {msg.origem === "ia" ? "- IA" : ""}
                                          </span>
                                          <span>{tsFmt(msg.criadoEm)}</span>
                                        </div>
                                        <div style={{ color: BRAND.text, fontSize: 11, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{msg.mensagem || msg.conteudo || "Conversa registrada."}</div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div style={{ color: BRAND.dim, fontSize: 11 }}>Ainda não existe conversa registrada para este orçamento.</div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="9" style={{ padding: 28, textAlign: "center", color: BRAND.dim }}>
                    Nenhum orçamento encontrado na gestão.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lista.length > 0 && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", borderTop: `1px solid ${BRAND.border}`, paddingTop: 14, marginTop: 12 }}>
            <div style={{ fontSize: 12, color: BRAND.muted }}>
              Mostrando {inicioPagina + 1}-{Math.min(inicioPagina + porPagina, lista.length)} de {lista.length}
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <button
                onClick={() => setPagina(1)}
                disabled={paginaAtual === 1}
                style={{ ...btnPagina, opacity: paginaAtual === 1 ? 0.45 : 1 }}
              >
                Primeira
              </button>
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={paginaAtual === 1}
                style={{ ...btnPagina, opacity: paginaAtual === 1 ? 0.45 : 1 }}
              >
                Anterior
              </button>
              <span style={{ fontSize: 12, color: BRAND.text, fontWeight: 900, minWidth: 74, textAlign: "center" }}>{paginaAtual} / {totalPaginas}</span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={paginaAtual === totalPaginas}
                style={{ ...btnPagina, opacity: paginaAtual === totalPaginas ? 0.45 : 1 }}
              >
                Próxima
              </button>
              <button
                onClick={() => setPagina(totalPaginas)}
                disabled={paginaAtual === totalPaginas}
                style={{ ...btnPagina, opacity: paginaAtual === totalPaginas ? 0.45 : 1 }}
              >
                Última
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...painelGestao, marginTop: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 6 }}>Resumo de atenção no WhatsApp</div>
        <div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 10 }}>
          Informe o WhatsApp que deve receber o resumo da Nara. O número fica salvo e o botão Notificar pendentes abre a mensagem pronta com os orçamentos que precisam de atenção.
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="Ex: 16999998888" style={{ ...inputGestao, flex: "1 1 240px" }} />
          <button onClick={abrirWhats} className="of-neon-btn" style={{ padding: "10px 16px", borderRadius: 12, cursor: "pointer" }}>
            Salvar e enviar resumo
          </button>
          <button onClick={abrirRelatorioSemanal} style={{ padding: "10px 16px", borderRadius: 12, border: `1px solid ${BRAND.green2}66`, background: `${BRAND.green2}18`, color: BRAND.green, cursor: "pointer", fontWeight: 900 }}>
            Enviar relatorio semanal Nara
          </button>
        </div>
        <div style={{ fontSize: 11, color: BRAND.dim, marginTop: 8 }}>
          Para envio automatico sem abrir o WhatsApp, sera necessario integrar a API oficial do WhatsApp Business.
        </div>
      </div>
    </div>
  );
}

function CardGestao({ titulo, valor, cor, icon }) {
  return (
    <div className="of-dashboard-card" style={{ borderColor: `${cor}55`, boxShadow: `0 0 24px ${cor}11` }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center" }}>
        <div style={{ fontSize: 12, color: BRAND.muted, fontWeight: 850 }}>{titulo}</div>
        <div style={{ width: 34, height: 34, borderRadius: 12, display: "grid", placeItems: "center", color: cor, background: `${cor}18`, border: `1px solid ${cor}44` }}>
          {icon}
        </div>
      </div>
      <div style={{ fontSize: 24, fontWeight: 950, color: cor, marginTop: 12, overflowWrap: "anywhere" }}>{valor}</div>
    </div>
  );
}

function AlertaIA({ cor, titulo, texto }) {
  return (
    <div style={{ padding: 12, borderRadius: 14, background: `${cor}12`, border: `1px solid ${cor}38` }}>
      <div style={{ fontSize: 13, fontWeight: 900, color: cor }}>{titulo}</div>
      <div style={{ fontSize: 11, color: BRAND.muted, marginTop: 3, lineHeight: 1.5 }}>{texto}</div>
    </div>
  );
}

const painelGestao = {
  background: "linear-gradient(145deg, rgba(15,23,42,.92), rgba(2,6,23,.84))",
  border: `1px solid ${BRAND.border}`,
  borderRadius: 18,
  padding: 18,
};

const tituloPainel = {
  margin: "0 0 4px",
  fontSize: 14,
  color: BRAND.text,
};

const inputGestao = {
  width: "100%",
  padding: "12px 14px",
  borderRadius: 12,
  border: `1px solid ${BRAND.border2}`,
  background: BRAND.panel2,
  color: BRAND.text,
  outline: "none",
  boxSizing: "border-box",
};

const btnPagina = {
  padding: "8px 11px",
  borderRadius: 9,
  border: `1px solid ${BRAND.border2}`,
  background: BRAND.panel2,
  color: BRAND.muted,
  cursor: "pointer",
  fontWeight: 850,
};

const btnMiniGestao = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 4,
  minHeight: 30,
  padding: "6px 7px",
  borderRadius: 8,
  border: `1px solid ${BRAND.border2}`,
  background: "rgba(7,17,31,.7)",
  color: BRAND.muted,
  cursor: "pointer",
  fontSize: 10,
  fontWeight: 850,
  lineHeight: 1,
  whiteSpace: "nowrap",
};

const th = {
  padding: "10px 8px",
  fontSize: 10,
  letterSpacing: 1.2,
  textTransform: "uppercase",
};

const td = {
  padding: "14px 8px",
  color: BRAND.text,
  verticalAlign: "top",
};

function UsuariosPanel({ usuarios, setUsuarios, usuarioAtual, setUsuarioAtual, pushToast }) {
  const [nome, setNome] = useState("");
  const [senha, setSenha] = useState("");
  const [solicitacoes, setSolicitacoes] = useState([]);
  const [acessos, setAcessos] = useState([]);
  const [carregandoAcessos, setCarregandoAcessos] = useState(false);
  const [encerrandoSessoes, setEncerrandoSessoes] = useState(false);
  const [perfilForm, setPerfilForm] = useState({ displayName: "", signatureName: "", phone: "", cargo: "" });
  const [salvandoPerfil, setSalvandoPerfil] = useState(false);
  const [resumoUsuarios, setResumoUsuarios] = useState({});
  const [transferencia, setTransferencia] = useState({ origem: "", destino: "", tipo: "empresas", modo: "copiar" });

  useEffect(() => {
    (async () => setSolicitacoes((await store.get(KEY_RESET)) || []))();
  }, []);

  useEffect(() => {
    setPerfilForm({
      displayName: usuarioAtual?.nomeTratamento || usuarioAtual?.nome || "",
      signatureName: usuarioAtual?.nomeAssinatura || usuarioAtual?.nomeTratamento || usuarioAtual?.nome || "",
      phone: usuarioAtual?.telefone || "",
      cargo: usuarioAtual?.cargo || "",
    });
  }, [usuarioAtual?.id, usuarioAtual?.nomeTratamento, usuarioAtual?.nomeAssinatura, usuarioAtual?.telefone, usuarioAtual?.cargo, usuarioAtual?.nome]);

  const resumirLinhasUsuario = (rows = []) => {
    const resumo = {};
    for (const row of rows) {
      const userId = row.user_id;
      if (!userId) continue;
      if (!resumo[userId]) resumo[userId] = { empresas: 0, orcamentos: 0, clientes: 0, agenda: 0, chat: 0, whatsapp: 0, atualizadoEm: "" };
      const qtd = Array.isArray(row.value) ? row.value.length : row.value ? 1 : 0;
      if (row.key === KEY_EMP) resumo[userId].empresas = qtd;
      if (row.key === KEY_CRM) resumo[userId].orcamentos = qtd;
      if (row.key === KEY_CLIENTES) resumo[userId].clientes = qtd;
      if (row.key === KEY_AGENDA) resumo[userId].agenda = qtd;
      if (row.key === KEY_CHAT) resumo[userId].chat = qtd;
      if (row.key === KEY_WHATSAPP_MONITOR) resumo[userId].whatsapp = qtd;
      if (!resumo[userId].atualizadoEm || new Date(row.updated_at) > new Date(resumo[userId].atualizadoEm)) {
        resumo[userId].atualizadoEm = row.updated_at;
      }
    }
    return resumo;
  };

  const carregarAcessos = useCallback(async () => {
    if (usuarioAtual?.tipo !== "admin") return;
    setCarregandoAcessos(true);
    const [{ data, error }, rowsEstado] = await Promise.all([
      supabase
        .from("app_users")
        .select("*")
        .order("requested_at", { ascending: false }),
      store.getAllUserRows(USER_TRANSFER_KEYS),
    ]);

    if (error) {
      console.error("Erro ao carregar acessos:", error);
      pushToast("Não foi possível carregar os cadastros. Rode o schema.sql atualizado.", "erro");
    } else {
      const lista = Array.isArray(data) ? data : [];
      setAcessos(lista);
      setResumoUsuarios(resumirLinhasUsuario(rowsEstado));
      setTransferencia((atual) => ({
        ...atual,
        origem: atual.origem || usuarioAtual?.id || lista[0]?.user_id || "",
        destino: atual.destino || lista.find((item) => item.user_id !== usuarioAtual?.id)?.user_id || lista[0]?.user_id || "",
      }));
    }
    setCarregandoAcessos(false);
  }, [pushToast, usuarioAtual?.id, usuarioAtual?.tipo]);

  useEffect(() => {
    carregarAcessos();
  }, [carregarAcessos]);

  const salvarPerfilProprio = async () => {
    setSalvandoPerfil(true);
    try {
      const payload = {
        p_display_name: clean(perfilForm.displayName, 90),
        p_signature_name: clean(perfilForm.signatureName, 120),
        p_phone: clean(perfilForm.phone, 40),
        p_cargo: clean(perfilForm.cargo, 90),
      };
      const { data, error } = await supabase.rpc("update_my_app_profile", payload);
      if (error) throw error;

      const atualizado = {
        ...usuarioAtual,
        nome: data?.display_name || data?.name || usuarioAtual?.nome || "",
        nomeTratamento: data?.display_name || data?.name || usuarioAtual?.nomeTratamento || "",
        nomeAssinatura: data?.signature_name || data?.display_name || data?.name || usuarioAtual?.nomeAssinatura || "",
        telefone: data?.phone || "",
        cargo: data?.cargo || "",
      };
      setUsuarioAtual(atualizado);
      pushToast("Perfil comercial atualizado. A Nara usara esse nome nas mensagens.", "ok");
      await carregarAcessos();
    } catch (error) {
      console.error("Erro ao salvar perfil:", error);
      pushToast(error?.message || "Nao foi possivel salvar seu perfil.", "erro");
    } finally {
      setSalvandoPerfil(false);
    }
  };

  const prepararValorTransferencia = (key, value, destinoId, origemId) => {
    if (!Array.isArray(value)) return value;
    return value.map((item) => ({
      ...item,
      userId: destinoId,
      origemUserId: item.origemUserId || item.userId || origemId,
      compartilhadoPor: usuarioAtual?.id || "",
      compartilhadoEm: new Date().toISOString(),
    }));
  };

  const mesclarLista = (atual = [], entrada = []) => {
    const mapa = new Map();
    for (const item of [...entrada, ...atual]) {
      const id = item?.id || item?.numero || item?.email || JSON.stringify(item).slice(0, 80);
      mapa.set(id, item);
    }
    return [...mapa.values()];
  };

  const transferirDados = async () => {
    if (usuarioAtual?.tipo !== "admin") return;
    const origem = transferencia.origem;
    const destino = transferencia.destino;
    const opcao = USER_TRANSFER_OPTIONS.find((item) => item.id === transferencia.tipo) || USER_TRANSFER_OPTIONS[0];

    if (!origem || !destino || origem === destino) {
      pushToast("Escolha usuarios diferentes para origem e destino.", "erro");
      return;
    }

    const mover = transferencia.modo === "mover";
    if (mover && !window.confirm("Mover dados remove esses registros da origem depois de copiar para o destino. Confirmar?")) return;

    setCarregandoAcessos(true);
    try {
      const origemDados = await store.getManyForUser(origem, opcao.keys);
      const destinoDados = await store.getManyForUser(destino, opcao.keys);
      const payloadDestino = {};
      const payloadOrigem = {};
      let total = 0;

      for (const key of opcao.keys) {
        const valorOrigem = origemDados[key];
        if (Array.isArray(valorOrigem)) {
          const entrada = prepararValorTransferencia(key, valorOrigem, destino, origem);
          payloadDestino[key] = mesclarLista(Array.isArray(destinoDados[key]) ? destinoDados[key] : [], entrada);
          payloadOrigem[key] = [];
          total += entrada.length;
        } else if (valorOrigem && typeof valorOrigem === "object") {
          payloadDestino[key] = { ...(destinoDados[key] || {}), ...valorOrigem, compartilhadoPor: usuarioAtual?.id || "", compartilhadoEm: new Date().toISOString() };
          payloadOrigem[key] = {};
          total += 1;
        } else if (typeof valorOrigem === "string" && valorOrigem.trim()) {
          payloadDestino[key] = valorOrigem;
          payloadOrigem[key] = "";
          total += 1;
        }
      }

      if (!total) {
        pushToast("Nao ha dados nesta origem para transferir.", "aviso");
        return;
      }

      const okDestino = await store.setManyForUser(destino, payloadDestino);
      if (!okDestino) throw new Error("Falha ao salvar dados no usuario destino.");

      if (mover) {
        const okOrigem = await store.setManyForUser(origem, payloadOrigem);
        if (!okOrigem) throw new Error("Dados copiados, mas nao foi possivel limpar a origem.");
      }

      pushToast(`${mover ? "Movidos" : "Copiados"} ${total} registro(s) de ${opcao.label}.`, "ok");
      await carregarAcessos();
    } catch (error) {
      console.error("Erro na transferencia:", error);
      pushToast(error?.message || "Nao foi possivel transferir dados.", "erro");
    } finally {
      setCarregandoAcessos(false);
    }
  };

  const atualizarAcesso = async (userId, patch) => {
    const payload = {
      ...patch,
      updated_at: new Date().toISOString(),
    };

    if (patch.status === "approved") {
      payload.approved_at = new Date().toISOString();
      payload.blocked_at = null;
    }
    if (patch.status === "blocked") {
      payload.blocked_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("app_users")
      .update(payload)
      .eq("user_id", userId);

    if (error) {
      console.error("Erro ao atualizar acesso:", error);
      pushToast(error.message || "Erro ao atualizar acesso.", "erro");
      return;
    }

    pushToast("Acesso atualizado.", "ok");
    await carregarAcessos();
  };

  const editarPerfilAcesso = async (acesso) => {
    const displayName = window.prompt("Como este usuario quer ser chamado pela Nara?", acesso.display_name || acesso.name || acesso.email || "");
    if (displayName === null) return;
    const signatureName = window.prompt("Nome/assinatura para mensagens ao cliente:", acesso.signature_name || displayName || acesso.name || acesso.email || "");
    if (signatureName === null) return;
    const cargo = window.prompt("Cargo/função comercial:", acesso.cargo || "");
    if (cargo === null) return;

    await atualizarAcesso(acesso.user_id, {
      display_name: clean(displayName, 90),
      signature_name: clean(signatureName, 120),
      cargo: clean(cargo, 90),
    });
  };

  const salvarSolicitacoes = (nova) => {
    setSolicitacoes(nova);
    store.set(KEY_RESET, nova);
  };

  const gerarNovaSenha = (sol) => {
    const novaSenha = String(Math.floor(100000 + Math.random() * 900000));
    const alvo = usuarios.find((u) => (u.nome || "").toLowerCase() === (sol.usuario || "").toLowerCase() || (u.email || "").toLowerCase() === (sol.usuario || "").toLowerCase());
    if (alvo) {
      salvarUsuarios(usuarios.map((u) => (u.id === alvo.id ? { ...u, senha: novaSenha } : u)));
    }
    salvarSolicitacoes(solicitacoes.map((s) => (s.id === sol.id ? { ...s, status: "resolvido", novaSenha, resolvidoEm: new Date().toISOString() } : s)));
    pushToast(`Nova senha gerada: ${novaSenha}`, "ok");
  };

  const salvarUsuarios = (nova) => {
    const normalizada = [...nova].map((u) => {
      if (isAdminProtegido(u)) {
        return {
          ...u,
          id: "admin-master",
          nome: "admin",
          tipo: "admin",
          perfil: "Administrador",
          ativo: true,
        };
      }

      return {
        ...u,
        tipo: u.tipo || "usuario",
        perfil: u.perfil || "Usuário",
        ativo: u.ativo !== false,
      };
    });

    const existeAdmin = normalizada.some((u) => isAdminProtegido(u));
    const final = existeAdmin ? normalizada : [ADMIN_PADRAO, ...normalizada];

    setUsuarios(final);
    store.set(KEY_USERS, final);
  };

  const criarUsuario = () => {
    if (!nome.trim() || !senha.trim()) {
      pushToast("Informe nome e senha para criar o perfil.", "erro");
      return;
    }

    if (String(nome).trim().toLowerCase() === "admin") {
      pushToast("O usuário administrador já existe e é protegido.", "erro");
      return;
    }

    const novo = {
      id: `user_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      nome: nome.trim(),
      senha,
      tipo: "usuario",
      perfil: "Usuário",
      ativo: true,
      criadoEm: new Date().toISOString(),
    };

    salvarUsuarios([...usuarios, novo]);
    setNome("");
    setSenha("");
    pushToast("Perfil criado com sucesso.", "ok");
  };

  const editarUsuario = (usuario) => {
    if (isAdminProtegido(usuario)) {
      pushToast("Usuário administrador protegido.", "erro");
      return false;
    }

    return true;
  };

  const alterar = (id, campo, valor) => {
    const usuario = usuarios.find((u) => u.id === id);

    if (!editarUsuario(usuario)) return;

    salvarUsuarios(usuarios.map((u) => (u.id === id ? { ...u, [campo]: valor } : u)));
  };

  const excluirUsuario = (id) => {
    const usuario = usuarios.find((u) => u.id === id);

    if (isAdminProtegido(usuario)) {
      pushToast("O usuário administrador não pode ser removido.", "erro");
      return;
    }

    const novaLista = usuarios.filter((u) => u.id !== id);
    salvarUsuarios(novaLista);
    pushToast("Usuário removido com sucesso.", "ok");
  };

  const entrarComo = (u) => {
    if (!u.ativo) {
      pushToast("Este perfil está cancelado/inativo.", "erro");
      return;
    }
    setUsuarioAtual(u);
    pushToast(`Perfil ativo: ${u.nome}`, "ok");
  };

  const deslogarOutrosAparelhos = async () => {
    const confirmou = window.confirm("Deslogar este usuário mestre de outros navegadores e aparelhos? Esta sessão atual continua ativa.");

    if (!confirmou) return;

    setEncerrandoSessoes(true);
    try {
      const { error } = await supabase.auth.signOut({ scope: "others" });
      if (error) throw error;
      pushToast("Outros aparelhos foram deslogados. Esta sessão continua ativa.", "ok");
    } catch (error) {
      console.error("Erro ao encerrar outras sessões:", error);
      pushToast(error?.message || "Não foi possível deslogar os outros aparelhos.", "erro");
    } finally {
      setEncerrandoSessoes(false);
    }
  };

  const perfilCard = (
    <div className="of-glass" style={{ borderRadius: 16, padding: 16, marginBottom: 16, maxWidth: usuarioAtual?.tipo === "admin" ? "none" : 720 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 950 }}>Meu perfil comercial</div>
          <div style={{ fontSize: 11, color: BRAND.dim, marginTop: 4 }}>
            A Nara usa estes dados para falar com voce pelo nome e para sugerir mensagens ao cliente com o responsavel correto.
          </div>
        </div>
        <div style={{ fontSize: 10, color: BRAND.muted, padding: "5px 8px", borderRadius: 999, border: `1px solid ${BRAND.border2}` }}>
          {usuarioAtual?.email || "Conta conectada"}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2,minmax(180px,1fr))", gap: 10 }}>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
          Como quer ser chamado
          <input value={perfilForm.displayName} onChange={(e) => setPerfilForm((f) => ({ ...f, displayName: e.target.value }))} placeholder="Ex: Deyverson" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12, textTransform: "none", letterSpacing: 0 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
          Nome/assinatura para contato
          <input value={perfilForm.signatureName} onChange={(e) => setPerfilForm((f) => ({ ...f, signatureName: e.target.value }))} placeholder="Ex: Deyverson - OrcaFlow" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12, textTransform: "none", letterSpacing: 0 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
          WhatsApp/telefone
          <input value={perfilForm.phone} onChange={(e) => setPerfilForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Ex: +55 17 99252-9930" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12, textTransform: "none", letterSpacing: 0 }} />
        </label>
        <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
          Cargo/funcao
          <input value={perfilForm.cargo} onChange={(e) => setPerfilForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Comercial / Orcamentos" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12, textTransform: "none", letterSpacing: 0 }} />
        </label>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 11, color: BRAND.muted }}>
          Exemplo: Nara vai tratar voce como <strong>{clean(perfilForm.displayName || usuarioAtual?.nome || "responsavel", 50)}</strong>.
        </div>
        <button onClick={salvarPerfilProprio} disabled={salvandoPerfil} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", fontWeight: 950, cursor: salvandoPerfil ? "wait" : "pointer" }}>
          {salvandoPerfil ? "Salvando..." : "Salvar perfil"}
        </button>
      </div>
    </div>
  );

  if (usuarioAtual?.tipo !== "admin") {
    return (
      <div style={{ padding: 24 }}>
        {perfilCard}
        <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 20, maxWidth: 520 }}>
          <div style={{ fontSize: 16, fontWeight: 950, marginBottom: 6 }}>Perfil do usuário</div>
          <div style={{ fontSize: 12, color: BRAND.muted }}>Usuário atual: {usuarioAtual?.nome || "—"}</div>
          <div style={{ fontSize: 12, color: BRAND.dim, marginTop: 10 }}>Somente o administrador pode criar, ativar ou cancelar perfis.</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: 18 }}>
      <div style={{ fontSize: 18, fontWeight: 950, marginBottom: 4 }}>Administrador de Usuários</div>
      <div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 16 }}>Controle total dos perfis, ativação, cancelamento e acesso aos orçamentos.</div>

      {perfilCard}

      <div className="of-glass" style={{ borderRadius: 16, padding: 14, marginBottom: 16, display: "grid", gridTemplateColumns: "minmax(260px,1fr) auto", gap: 12, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 950 }}>Segurança do usuário mestre</div>
          <div style={{ fontSize: 11, color: BRAND.dim, lineHeight: 1.55, marginTop: 4 }}>
            Use quando acessar em outro computador ou celular e quiser derrubar as outras sessões da sua conta. O navegador atual permanece conectado.
          </div>
          <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 6 }}>
            Conta atual: {usuarioAtual?.email || usuarioAtual?.nome || "admin"}
          </div>
        </div>
        <button
          onClick={deslogarOutrosAparelhos}
          disabled={encerrandoSessoes}
          style={{ padding: "10px 12px", borderRadius: 10, border: `1px solid ${BRAND.warn}66`, background: `${BRAND.warn}14`, color: BRAND.warn, cursor: encerrandoSessoes ? "wait" : "pointer", fontWeight: 950, minWidth: 210 }}
        >
          {encerrandoSessoes ? "Deslogando..." : "Deslogar outros aparelhos"}
        </button>
      </div>

      <div className="of-glass" style={{ borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Dados por usuario e compartilhamento</div>
            <div style={{ fontSize: 11, color: BRAND.dim, marginTop: 3 }}>Copie empresas, orcamentos, clientes e agenda entre contas sem misturar automaticamente os dados.</div>
          </div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,minmax(130px,1fr))", gap: 8, alignItems: "end" }}>
          <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
            Origem
            <select value={transferencia.origem} onChange={(e) => setTransferencia((t) => ({ ...t, origem: e.target.value }))} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 9, fontSize: 12 }}>
              {acessos.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name || a.name || a.email || a.user_id}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
            Destino
            <select value={transferencia.destino} onChange={(e) => setTransferencia((t) => ({ ...t, destino: e.target.value }))} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 9, fontSize: 12 }}>
              {acessos.map((a) => <option key={a.user_id} value={a.user_id}>{a.display_name || a.name || a.email || a.user_id}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
            Conteudo
            <select value={transferencia.tipo} onChange={(e) => setTransferencia((t) => ({ ...t, tipo: e.target.value }))} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 9, fontSize: 12 }}>
              {USER_TRANSFER_OPTIONS.map((op) => <option key={op.id} value={op.id}>{op.label}</option>)}
            </select>
          </label>
          <label style={{ display: "grid", gap: 5, fontSize: 10, color: BRAND.dim, fontWeight: 900, textTransform: "uppercase", letterSpacing: 1 }}>
            Acao
            <select value={transferencia.modo} onChange={(e) => setTransferencia((t) => ({ ...t, modo: e.target.value }))} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 9, fontSize: 12 }}>
              <option value="copiar">Copiar</option>
              <option value="mover">Mover</option>
            </select>
          </label>
          <button onClick={transferirDados} disabled={carregandoAcessos || acessos.length < 2} style={{ padding: "10px 12px", borderRadius: 10, border: 0, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", cursor: carregandoAcessos || acessos.length < 2 ? "not-allowed" : "pointer", fontWeight: 950 }}>
            Aplicar
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", gap: 8, marginTop: 12 }}>
          {acessos.map((a) => {
            const r = resumoUsuarios[a.user_id] || {};
            return (
              <div key={`resumo_${a.user_id}`} style={{ border: `1px solid ${BRAND.border2}`, background: BRAND.panel2, borderRadius: 12, padding: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 950, overflowWrap: "anywhere" }}>{a.display_name || a.name || a.email || "Usuario"}</div>
                <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3, overflowWrap: "anywhere" }}>{a.email || a.user_id}</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 5, marginTop: 8, fontSize: 10, color: BRAND.muted }}>
                  <span>Emp.: <strong style={{ color: BRAND.green }}>{r.empresas || 0}</strong></span>
                  <span>Orc.: <strong style={{ color: BRAND.blue }}>{r.orcamentos || 0}</strong></span>
                  <span>Clientes: <strong style={{ color: BRAND.warn }}>{r.clientes || 0}</strong></span>
                  <span>Agenda: <strong style={{ color: "#93C5FD" }}>{r.agenda || 0}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="of-glass" style={{ borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 900 }}>Controle de acesso ao sistema</div>
            <div style={{ fontSize: 11, color: BRAND.dim, marginTop: 3 }}>Aprove quem pode entrar, bloqueie cadastros e defina admin ou usuario.</div>
          </div>
          <button onClick={carregarAcessos} disabled={carregandoAcessos} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.blue2}55`, background: `${BRAND.blue2}12`, color: "#93C5FD", cursor: carregandoAcessos ? "wait" : "pointer", fontWeight: 850 }}>
            {carregandoAcessos ? "Atualizando..." : "Atualizar"}
          </button>
        </div>

        {acessos.length === 0 ? (
          <div style={{ fontSize: 12, color: BRAND.dim, padding: "12px 0" }}>
            Nenhum cadastro encontrado ainda. O primeiro login aprovado vira administrador automaticamente.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 8 }}>
            {acessos.map((a) => {
              const isSelf = a.user_id === usuarioAtual?.id;
              const statusCor = a.status === "approved" ? BRAND.green : a.status === "blocked" ? BRAND.danger : BRAND.warn;
              return (
                <div key={a.user_id} style={{ display: "grid", gridTemplateColumns: "minmax(220px,1.5fr) 130px 110px auto", gap: 8, alignItems: "center", padding: 10, borderRadius: 12, background: BRAND.panel2, border: `1px solid ${BRAND.border2}` }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 900, overflowWrap: "anywhere" }}>{a.email || a.name || "Usuário sem e-mail"}</div>
                    <div style={{ fontSize: 10, color: BRAND.muted, marginTop: 3 }}>
                      Chamado: {a.display_name || a.name || "nao definido"} {a.signature_name ? ` | Assina: ${a.signature_name}` : ""}
                    </div>
                    <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3 }}>
                      Solicitado: {tsFmt(a.requested_at)} {isSelf ? "· você" : ""}
                    </div>
                  </div>
                  <select
                    value={a.role || "usuario"}
                    disabled={isSelf}
                    onChange={(e) => atualizarAcesso(a.user_id, { role: e.target.value })}
                    style={{ background: BRAND.panel, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12 }}
                  >
                    <option value="admin">admin</option>
                    <option value="usuario">usuario</option>
                  </select>
                  <div style={{ color: statusCor, fontSize: 12, fontWeight: 950 }}>{a.status || "pending"}</div>
                  <div style={{ display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                    <button onClick={() => editarPerfilAcesso(a)} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.blue2}55`, background: `${BRAND.blue2}12`, color: "#93C5FD", cursor: "pointer", fontWeight: 850 }}>
                      Perfil
                    </button>
                    {a.status !== "approved" && (
                      <button onClick={() => atualizarAcesso(a.user_id, { status: "approved" })} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.green2}55`, background: `${BRAND.green2}16`, color: BRAND.green, cursor: "pointer", fontWeight: 850 }}>
                        Aprovar
                      </button>
                    )}
                    {a.status !== "blocked" && !isSelf && (
                      <button onClick={() => atualizarAcesso(a.user_id, { status: "blocked" })} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontWeight: 850 }}>
                        Bloquear
                      </button>
                    )}
                    {a.status === "blocked" && (
                      <button onClick={() => atualizarAcesso(a.user_id, { status: "pending" })} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.warn}55`, background: `${BRAND.warn}12`, color: BRAND.warn, cursor: "pointer", fontWeight: 850 }}>
                        Reabrir
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>Perfis internos opcionais</div>
        <div style={{ fontSize: 11, color: BRAND.dim, marginBottom: 10 }}>Use esta area apenas para alternar perfis operacionais dentro de uma conta ja aprovada.</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8 }}>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do usuário" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12 }} />
          <input value={senha} onChange={(e) => setSenha(e.target.value)} placeholder="Senha criada por você" style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "10px 12px", color: BRAND.text, fontSize: 12 }} />
          <button onClick={criarUsuario} style={{ padding: "10px 14px", borderRadius: 10, border: 0, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Criar</button>
        </div>
      </div>

      <div className="of-glass" style={{ borderRadius: 16, padding: 14, marginBottom: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 10 }}>Solicitações de nova senha</div>
        {solicitacoes.length === 0 ? (
          <div style={{ fontSize: 12, color: BRAND.dim }}>Nenhuma solicitação pendente.</div>
        ) : solicitacoes.map((s) => (
          <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1fr .7fr auto auto", gap: 8, alignItems: "center", padding: "9px 0", borderTop: `1px solid ${BRAND.border2}` }}>
            <div><strong>{s.usuario}</strong><div style={{ fontSize: 10, color: BRAND.dim }}>{tsFmt(s.criadoEm)}</div></div>
            <div style={{ fontSize: 12, color: s.status === "pendente" ? BRAND.warn : BRAND.green }}>{s.status}</div>
            <button onClick={() => gerarNovaSenha(s)} disabled={s.status !== "pendente"} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.green2}55`, background: `${BRAND.green2}16`, color: BRAND.green, cursor: s.status !== "pendente" ? "not-allowed" : "pointer", fontWeight: 850 }}>Gerar nova senha</button>
            <button onClick={() => salvarSolicitacoes(solicitacoes.filter((x) => x.id !== s.id))} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontWeight: 850 }}>Cancelar</button>
          </div>
        ))}
      </div>

      <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 16, overflow: "hidden" }}>
        {usuarios.map((u) => (
          <div key={u.id} style={{ display: "grid", gridTemplateColumns: "1fr .7fr .7fr .7fr .55fr", gap: 8, alignItems: "center", padding: "11px 14px", borderBottom: `1px solid ${BRAND.border2}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 900 }}>{u.nome}</div>
              <div style={{ fontSize: 10, color: BRAND.dim }}>{u.perfil || u.tipo} · {u.ativo ? "ativo" : "cancelado"}</div>
            </div>
            <select value={u.tipo} disabled={isAdminProtegido(u)} onChange={(e) => alterar(u.id, "tipo", e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12 }}>
              <option value="admin">admin</option>
              <option value="usuario">usuario</option>
            </select>
            <button disabled={isAdminProtegido(u)} onClick={() => alterar(u.id, "ativo", !u.ativo)} style={{ padding: 8, borderRadius: 9, border: `1px solid ${u.ativo ? BRAND.danger : BRAND.green2}55`, background: "transparent", color: u.ativo ? BRAND.danger : BRAND.green, fontWeight: 850, cursor: isAdminProtegido(u) ? "not-allowed" : "pointer" }}>{u.ativo ? "Cancelar" : "Ativar"}</button>
            <button onClick={() => entrarComo(u)} style={{ padding: 8, borderRadius: 9, border: `1px solid ${BRAND.blue2}55`, background: `${BRAND.blue2}12`, color: "#93C5FD", fontWeight: 850, cursor: "pointer" }}>Usar perfil</button>
            <button disabled={isAdminProtegido(u)} onClick={() => excluirUsuario(u.id)} style={{ padding: 8, borderRadius: 9, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, fontWeight: 850, cursor: isAdminProtegido(u) ? "not-allowed" : "pointer" }}>Excluir</button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: BRAND.warn, lineHeight: 1.6 }}>
        Banco online ativo: os acessos e dados operacionais devem ficar vinculados ao Supabase Auth, com isolamento por usuario e sincronizacao em nuvem.
      </div>
    </div>
  );
}

export default function App() {
  const { empresas, status, meta, setMeta, toast, salvarEmpresa, excluirEmpresa, exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast } = useDB();
  const [view, setView] = useState("gestao");
  const [autenticado, setAutenticado] = useState(false);
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [anexarOpen, setAnexarOpen] = useState(false);
  const [logData, setLogData] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const refImport = useRef(null);

  const [crm, setCrm] = useState([]);
  const [clientesCRM, setClientesCRM] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [acessoPerfil, setAcessoPerfil] = useState(null);
  const [relatorioPendente, setRelatorioPendente] = useState(null);
  const [naraConfig, setNaraConfig] = useState(DEFAULT_NARA_CONFIG);
  const [radarPendente, setRadarPendente] = useState(null);
  const radarAutoRef = useRef("");

  useEffect(() => {
    const onBackupImported = (event) => {
      const detail = event.detail || {};
      if (Array.isArray(detail.crm)) setCrm(detail.crm);
      if (Array.isArray(detail.clientes)) setClientesCRM(detail.clientes);
    };
    const onClientesImported = (event) => {
      const detail = event.detail || {};
      if (Array.isArray(detail.clientes)) setClientesCRM(detail.clientes);
    };
    window.addEventListener("orcaflow:backup-imported", onBackupImported);
    window.addEventListener("orcaflow:clientes-imported", onClientesImported);
    return () => {
      window.removeEventListener("orcaflow:backup-imported", onBackupImported);
      window.removeEventListener("orcaflow:clientes-imported", onClientesImported);
    };
  }, []);

  useEffect(() => {
    const applyUser = async (user) => {
      if (!user) {
        setAutenticado(false);
        setUsuarioAtual(null);
        setAcessoPerfil(null);
        setClientesCRM([]);
        setRelatorioPendente(null);
        setRadarPendente(null);
        return;
      }

      const { data: perfilAcesso, error: perfilErro } = await supabase.rpc("ensure_app_user");

      if (perfilErro) {
        console.error("Erro ao validar acesso:", perfilErro);
        setAutenticado(false);
        setUsuarioAtual(null);
        setAcessoPerfil({
          email: user.email,
          status: "blocked",
          name: user.email,
        });
        pushToast("Não foi possível validar seu acesso. Confira o schema do Supabase.", "erro");
        return;
      }

      if (perfilAcesso?.status !== "approved") {
        setAutenticado(false);
        setUsuarioAtual(null);
        setAcessoPerfil(perfilAcesso);
        return;
      }

      setAcessoPerfil(null);
      setUsuarioAtual({
        id: user.id,
        nome: perfilAcesso?.name || user.email || "Usuário",
        nomeTratamento: perfilAcesso?.display_name || perfilAcesso?.name || user.email || "Usuario",
        nomeAssinatura: perfilAcesso?.signature_name || perfilAcesso?.display_name || perfilAcesso?.name || user.email || "",
        cargo: perfilAcesso?.cargo || "",
        telefone: perfilAcesso?.phone || "",
        email: user.email,
        tipo: perfilAcesso?.role === "admin" ? "admin" : "usuario",
        perfil: perfilAcesso?.role === "admin" ? "Administrador" : "Usuário",
        ativo: true,
      });
      setAutenticado(true);
      const dados = await store.getMany([KEY_EMP, KEY_LOG, KEY_META, KEY_CRM, KEY_CHAT, KEY_CLIENTES, KEY_AGENDA, KEY_WHATS_RELATORIO, KEY_WEEKLY_REPORT_PENDING, KEY_WHATSAPP_MONITOR, KEY_NARA_AUTO, KEY_NARA_RADAR, KEY_BACKUP_AUTO]);
      setCrm(dados[KEY_CRM] || []);
      setClientesCRM(dados[KEY_CLIENTES] || []);
      const configNara = { ...DEFAULT_NARA_CONFIG, ...(dados[KEY_NARA_AUTO] || {}) };
      setNaraConfig(configNara);
      const radarSalvo = dados[KEY_NARA_RADAR];
      if (radarSalvo?.status === "pendente" && radarSalvo?.texto) {
        setRadarPendente(radarSalvo);
      } else {
        setRadarPendente(null);
      }
      const pendente = dados[KEY_WEEKLY_REPORT_PENDING];
      if (pendente?.status === "pendente" && pendente?.texto) {
        setRelatorioPendente(pendente);
        pushToast("Nara deixou um relatorio semanal pronto para envio assistido.", "aviso");
      } else {
        setRelatorioPendente(null);
      }
    };

    supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!autenticado || !naraConfig?.radarDiarioAtivo) return;
    if (!crm.length && !clientesCRM.length) return;

    const hoje = new Date().toISOString().slice(0, 10);
    if (radarAutoRef.current === hoje) return;
    radarAutoRef.current = hoje;

    (async () => {
      const configSalva = { ...DEFAULT_NARA_CONFIG, ...((await store.get(KEY_NARA_AUTO)) || {}), ...(naraConfig || {}) };
      if (configSalva?.ultimoRadar?.dia === hoje) return;

      const radar = gerarRadarDiarioNara({
        crm,
        clientes: clientesCRM,
        empresas,
        usuarioNome: nomeUsuarioSistema(usuarioAtual),
      });
      const pendente = { ...radar, status: "pendente" };
      const novaConfig = {
        ...configSalva,
        ultimoRadar: { dia: hoje, geradoEm: new Date().toISOString() },
      };

      setRadarPendente(pendente);
      setNaraConfig(novaConfig);
      await store.set(KEY_NARA_RADAR, pendente);
      await store.set(KEY_NARA_AUTO, novaConfig);
      pushToast("Nara preparou o radar diario de acompanhamento.", "aviso");
    })();
  }, [autenticado, naraConfig?.radarDiarioAtivo, crm.length, clientesCRM.length, empresas.length, usuarioAtual?.id]);

  const [cliente, setCliente] = useState("");
  const [texto, setTexto] = useState("");
  const [obs, setObs] = useState("");
  const [selecao, setSelecao] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [iaStatus, setIaStatus] = useState("");
  const [erroGeracao, setErroGeracao] = useState("");
  const [orcamentos, setOrcamentos] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [editando, setEditando] = useState(false);
  const [step, setStep] = useState("montagem");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const [lendoAnexoServico, setLendoAnexoServico] = useState(false);
  const refAudio = useRef(null);
  const refAnexoServico = useRef(null);
  const MAX = 12;

  const handleSalvar = async (form) => {
    setSalvando(true);
    const ok = await salvarEmpresa(form);
    setSalvando(false);
    if (ok) setModal(null);
  };

  const handleExcluir = async () => {
    if (!confirmar) return;
    await excluirEmpresa(confirmar.id);
    setSelecao((prev) => prev.filter((s) => s.empId !== confirmar.id));
    setConfirmar(null);
  };

  const abrirLog = async () => {
    const logs = (await store.get(KEY_LOG)) || [];
    setLogData(logs);
    setLogOpen(true);
  };

  const limparBaseComercialMantendoEmpresas = async () => {
    if (usuarioAtual?.tipo !== "admin") {
      pushToast("Apenas administrador pode limpar a base comercial.", "erro");
      return;
    }

    const confirmacao = window.prompt(
      "Esta acao limpa orcamentos, clientes, agenda, historicos comerciais, inbox WhatsApp, lixeira e contadores. Empresas, usuarios e acessos serao mantidos. Digite LIMPAR para confirmar."
    );
    if ((confirmacao || "").trim().toUpperCase() !== "LIMPAR") {
      pushToast("Limpeza cancelada.", "aviso");
      return;
    }

    const payloadLimpo = {
      [KEY_CRM]: [],
      [KEY_CRM_TRASH]: [],
      [KEY_AUDITORIA]: [],
      [KEY_META]: { totalOrcamentos: 0 },
      [KEY_CHAT]: [],
      [KEY_CLIENTES]: [],
      [KEY_AGENDA]: [],
      [KEY_WEEKLY_REPORT_PENDING]: {},
      [KEY_WHATSAPP_MONITOR]: [],
      [KEY_NARA_RADAR]: {},
      [KEY_BACKUP_AUTO]: [],
    };

    try {
      const rows = await store.getAllUserRows(BACKUP_KEYS);
      const userIds = [...new Set((rows || []).map((row) => row.user_id).filter(Boolean))];
      if (usuarioAtual?.id && !userIds.includes(usuarioAtual.id)) userIds.push(usuarioAtual.id);

      const resultados = await Promise.all(
        userIds.map((userId) => (
          userId === usuarioAtual?.id
            ? store.setMany(payloadLimpo)
            : store.setManyForUser(userId, payloadLimpo)
        ))
      );

      if (!resultados.every(Boolean)) {
        throw new Error("Nao foi possivel zerar todos os registros no banco.");
      }

      setCrm([]);
      setClientesCRM([]);
      setRelatorioPendente(null);
      setRadarPendente(null);
      setMeta({ totalOrcamentos: 0 });
      window.dispatchEvent(new CustomEvent("orcaflow:backup-imported", { detail: { crm: [], clientes: [] } }));
      window.dispatchEvent(new CustomEvent("orcaflow:clientes-imported", { detail: { clientes: [] } }));
      await logOp("RESET", `Base comercial zerada mantendo empresas (${userIds.length || 1} usuario(s))`, "comercial");
      pushToast("Base comercial zerada. Cadastros de empresas mantidos.", "ok");
    } catch (error) {
      console.error("Falha ao limpar base comercial:", error);
      pushToast(error.message || "Falha ao limpar base comercial.", "erro");
    }
  };

  const sincronizarOrcamentosNosClientes = async (orcamentosNovos = []) => {
    const itens = (Array.isArray(orcamentosNovos) ? orcamentosNovos : [orcamentosNovos]).filter(Boolean);
    if (!itens.length) return false;

    const listaClientes = Array.isArray(clientesCRM) ? clientesCRM : [];
    const crmBase = (await store.get(KEY_CRM)) || crm;
    let alterou = false;
    const idsNovos = new Set(itens.map((item) => item.id).filter(Boolean));

    const novaCRM = (Array.isArray(crmBase) ? crmBase : []).map((orc) => {
      if (!idsNovos.has(orc.id) || orc.clienteVinculadoId) return orc;
      const sugestao = clientesCompativeisComOrcamento(orc, listaClientes, 1)[0];
      const patch = sugestao
        ? {
            clienteSugeridoId: sugestao.cliente.id,
            clienteSugeridoNome: sugestao.cliente.nome || sugestao.cliente.empresa || "",
            clienteSugeridoScore: sugestao.score,
          }
        : {
            clienteSugeridoId: "",
            clienteSugeridoNome: "",
            clienteSugeridoScore: 0,
          };
      const igual = (orc.clienteSugeridoId || "") === (patch.clienteSugeridoId || "") && Number(orc.clienteSugeridoScore || 0) === Number(patch.clienteSugeridoScore || 0);
      if (igual) return orc;
      alterou = true;
      return { ...orc, ...patch, atualizadoEm: new Date().toISOString() };
    });

    if (!alterou) return false;
    setCrm(novaCRM);
    const ok = await store.set(KEY_CRM, novaCRM);
    if (!ok) pushToast("Orcamento salvo, mas nao foi possivel salvar a sugestao de cliente na nuvem.", "erro");
    return ok;
  };

  const abrirRelatorioPendente = async () => {
    if (!relatorioPendente?.texto) return;
    const numero = normalizarWhatsDestino(relatorioPendente.destinoPadrao || WHATS_REPORT_NUMBER);
    await store.set(KEY_WHATS_RELATORIO, numero);
    abrirWhatsRelatorio({ numero, texto: relatorioPendente.texto });
    pushToast("WhatsApp aberto com o relatorio da Nara. O envio continua manual.", "ok");
  };

  const copiarRelatorioPendente = async () => {
    if (!relatorioPendente?.texto) return;
    try {
      await navigator.clipboard.writeText(relatorioPendente.texto);
      pushToast("Relatorio da Nara copiado.", "ok");
    } catch {
      pushToast("Nao foi possivel copiar o relatorio.", "erro");
    }
  };

  const dispensarRelatorioPendente = async () => {
    if (!relatorioPendente) return;
    const atualizado = { ...relatorioPendente, status: "resolvido", resolvidoEm: new Date().toISOString() };
    await store.set(KEY_WEEKLY_REPORT_PENDING, atualizado);
    setRelatorioPendente(null);
    pushToast("Relatorio semanal marcado como resolvido.", "ok");
  };

  const toggleSel = (id) =>
    setSelecao((prev) => {
      if (prev.find((s) => s.empId === id)) return prev.filter((s) => s.empId !== id);
      if (prev.length >= MAX) return prev;
      return [...prev, { empId: id, valorGlobal: "" }];
    });

  const setValor = (id, v) => setSelecao((prev) => prev.map((s) => (s.empId === id ? { ...s, valorGlobal: v } : s)));
  const empsSel = selecao.map((s) => empresas.find((e) => e.id === s.empId)).filter(Boolean);
  const canGerar = cliente.trim() && texto.trim() && selecao.length > 0;

  const resetInicio = () => {
    setView("gestao");
    setStep("montagem");
    setOrcamentos({});
    setActiveTab(null);
    setEditando(false);
    setErroGeracao("");
  };

  const resetOrcamento = () => {
    resetInicio();
    setSelecao([]);
    setCliente("");
    setTexto("");
    setObs("");
  };

  const gerarItens = (txt) => {
    const linhas = txt
      .split(/[\n.;•-]+/)
      .map((l) => clean(l))
      .filter((l) => l.length > 15)
      .slice(0, 6);
    return linhas.length >= 3 ? linhas : ["Levantamento e alinhamento das necessidades", "Execução dos serviços descritos", "Fornecimento de recursos operacionais necessários", "Testes, validação e entrega final"];
  };

  const anexarAudioTranscrever = async (file) => {
    if (!file) return;

    const nome = (file.name || "").toLowerCase();
    const formatosPermitidos = [".ogg", ".opus", ".mp3", ".wav", ".m4a", ".mp4", ".webm"];
    const formatoValido = formatosPermitidos.some((ext) => nome.endsWith(ext));

    if (!formatoValido) {
      pushToast("Formato inválido. Envie .ogg, .opus, .mp3, .wav, .m4a, .mp4 ou .webm.", "erro");
      return;
    }

    const limiteMB = 25;
    if (file.size > limiteMB * 1024 * 1024) {
      pushToast(`Arquivo muito grande. Limite máximo: ${limiteMB} MB.`, "erro");
      return;
    }

    setTranscrevendo(true);
    setIaStatus("Transcrevendo áudio...");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/transcribe", {
        method: "POST",
        headers: await authHeaders(),
        body: formData,
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta da transcrição veio inválida.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Falha ao transcrever o arquivo.");
      }

      const textoTranscrito = String(data.text || "").trim();

      if (!textoTranscrito) {
        throw new Error("A transcrição voltou vazia.");
      }

      setTexto((atual) => {
        const textoAtual = String(atual || "").trim();
        if (!textoAtual) return textoTranscrito;
        return `${textoAtual}\n\n${textoTranscrito}`;
      });

      pushToast("Áudio transcrito com sucesso. Revise o texto antes de gerar o orçamento.", "ok");
    } catch (error) {
      console.error("Erro na transcrição:", error);
      pushToast(error.message || "Erro ao transcrever áudio.", "erro");
    } finally {
      setTranscrevendo(false);
      setIaStatus("");
    }
  };

  const anexarDocumentoServico = async (file) => {
    if (!file) return;

    const nome = (file.name || "").toLowerCase();
    const isPdf = nome.endsWith(".pdf") || file.type === "application/pdf";
    const isImagem =
      [".png", ".jpg", ".jpeg", ".webp"].some((ext) => nome.endsWith(ext)) ||
      /^image\/(?:png|jpe?g|webp)$/i.test(file.type || "");

    if (!isPdf && !isImagem) {
      pushToast("Formato invalido. Envie PDF, PNG, JPG, JPEG ou WEBP.", "erro");
      return;
    }

    const limiteMB = 15;
    if (file.size > limiteMB * 1024 * 1024) {
      pushToast(`Arquivo muito grande. Limite maximo: ${limiteMB} MB.`, "erro");
      return;
    }

    setLendoAnexoServico(true);
    setIaStatus("Lendo PDF/imagem com IA...");

    try {
      let textoExtraido = "";
      let imagem = "";

      if (isPdf) {
        try {
          textoExtraido = await lerTextoPDF(file, { maxPages: 12, maxChars: 50000 });
        } catch (error) {
          console.warn("Falha ao extrair texto do PDF:", error);
        }

        if (clean(textoExtraido).length < 80) {
          try {
            imagem = await pdfParaImagemCartaoCNPJ(file);
          } catch (error) {
            console.warn("Falha ao renderizar PDF para OCR:", error);
          }
        }
      } else {
        imagem = await imagemParaLeitura(file);
      }

      if (!clean(textoExtraido) && !imagem) {
        throw new Error("Nao consegui ler texto nem imagem deste arquivo.");
      }

      const response = await fetch("/api/read-service-attachment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          filename: file.name || "anexo",
          mimeType: file.type || "",
          texto: textoCurto(textoExtraido, 50000),
          imagem,
        }),
      });

      let data = {};
      try {
        data = await response.json();
      } catch {
        throw new Error("A resposta da leitura veio invalida.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Falha ao ler anexo com IA.");
      }

      const dados = data.dados || {};
      const partes = [];
      if (dados.descricaoServico) partes.push(clean(dados.descricaoServico, 2200));
      if (dados.materiaisTexto) partes.push(`Itens/materiais identificados:\n${clean(dados.materiaisTexto, 2200)}`);
      if (Number(dados.valorGlobalIdentificado || 0) > 0) {
        partes.push(`Valor identificado no anexo: ${brl(dados.valorGlobalIdentificado)}`);
      }
      if (dados.observacoes) partes.push(`Observacoes do anexo:\n${clean(dados.observacoes, 700)}`);

      const bloco = partes.filter(Boolean).join("\n\n").trim();
      if (!bloco) {
        throw new Error("A IA nao encontrou informacoes uteis no anexo.");
      }

      if (!cliente.trim() && dados.cliente) {
        setCliente(clean(dados.cliente, 180));
      }

      setTexto((atual) => {
        const textoAtual = String(atual || "").trim();
        const novoBloco = `Leitura do anexo (${file.name || "arquivo"}):\n${bloco}`;
        if (!textoAtual) return novoBloco;
        return `${textoAtual}\n\n${novoBloco}`;
      });

      pushToast("PDF/imagem lido com IA. Revise a descricao antes de gerar.", "ok");
    } catch (error) {
      console.error("Erro ao ler anexo:", error);
      pushToast(error.message || "Erro ao ler PDF/imagem.", "erro");
    } finally {
      setLendoAnexoServico(false);
      setIaStatus("");
    }
  };

  const handleGerar = async () => {
    if (!canGerar || gerando) return;

    const checklistGeracao = naraConfig?.checklistGeracaoAtivo === false
      ? { ok: true, bloqueios: [], avisos: [], acoes: [], parecidos: [] }
      : gerarChecklistPreGeracao({
          cliente,
          texto,
          obs,
          selecao,
          empresas,
          crm,
        });

    if (!checklistGeracao.ok) {
      const mensagem = `Checklist da Nara bloqueou a geracao: ${checklistGeracao.bloqueios.join(" | ")}`;
      setErroGeracao(mensagem);
      pushToast(mensagem, "erro");
      return;
    }

    if (checklistGeracao.avisos?.length) {
      pushToast(`Nara ajustou ${checklistGeracao.avisos.length} ponto(s) antes de gerar.`, "aviso");
    }

    setGerando(true);
    setIaStatus("Gerando orçamentos com IA...");
    setErroGeracao("");

    try {
      const payload = {
        cliente: textoCurto(cliente, 280),
        texto: textoCurto(texto, 16000),
        obs: textoCurto(obs, 5000),
        empresas: empresasCompactasParaGeracao(empresas, selecao),
        selecao,
        automacaoNara: checklistGeracao,
      };

      const response = await fetch("/api/generate-budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      const raw = await response.text();

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        data = {
          error: raw ? textoCurto(raw, 500) : "A API retornou uma resposta vazia.",
          code: "INVALID_API_RESPONSE",
        };
      }

      if (!response.ok) {
        const sufixo = data.code ? ` (${data.code})` : "";
        throw new Error(`${data.error || "Erro ao gerar orçamento com IA."}${sufixo}`);
      }

      const novos = {};

      for (const s of selecao) {
        const ed = data.empresas?.[s.empId] || {};
        const empAtual = empresas.find((e) => e.id === s.empId) || {};

        const documentoBase = {
          numero: orcNum(),
          empresaId: s.empId,
          valorGlobal: s.valorGlobal || "",
          criadoEm: new Date().toISOString(),
          itensIA: Array.isArray(data.itens) ? data.itens : [],
          identidadeDocumento: ed.identidadeDocumento || {},
          materiaisTabela: Array.isArray(ed.materiaisTabela) ? ed.materiaisTabela : [],
          precificacao: ed.precificacao || {},
          checklistNara: checklistGeracao,
          retornoIA: ed,
          campos: {
            cliente,
            intro: ed.intro || "",
            objetivo: ed.objetivo || "",
            escopo: ed.escopo || texto,
            materiais: ed.materiais || "",
            consideracoes: ed.consideracoes || "",
            recursos: ed.recursos || "",
            fechamento: ed.fechamento || "",
          },
        };
        const documentoGerado = normalizarDocumentoPublico(documentoBase, empAtual);
        documentoGerado.assuntoResumo = assuntoResumoDocumento(documentoGerado, texto);
        documentoGerado.tituloResumo = resumoComercialOrcamento(documentoGerado, empAtual, cliente, texto);
        novos[s.empId] = documentoGerado;
      }

      setOrcamentos(novos);
      const novosCRM = selecao.map((s) => {
        const emp = empresas.find((e) => e.id === s.empId);
        return {
          id: `crm_${Date.now()}_${s.empId}`,
          numero: novos[s.empId]?.numero || orcNum(),
          empresaId: s.empId,
          empresaNome: emp?.nome || "",
          cliente,
          tituloResumo: novos[s.empId]?.tituloResumo || resumoComercialOrcamento(novos[s.empId], emp, cliente, texto),
          assuntoResumo: novos[s.empId]?.assuntoResumo || assuntoResumoDocumento(novos[s.empId], texto),
          valorGlobal: s.valorGlobal || "",
          status: "Aberto",
          proximoContato: "",
          lembreteIA: "",
          checklistNara: checklistGeracao,
          orcamentosParecidosNara: checklistGeracao.parecidos || [],
          userId: usuarioAtual?.id || "admin",
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          conversas: [{
            id: `conv_gerado_${Date.now()}_${s.empId}`,
            canal: "Sistema",
            direcao: "interna",
            tipo: "Orcamento gerado",
            mensagem: checklistGeracao.avisos?.length
              ? `Orcamento gerado com checklist da Nara. Avisos tratados: ${checklistGeracao.avisos.join(" | ")}`
              : "Orcamento gerado no sistema e aguardando tratativa comercial real.",
            criadoEm: new Date().toISOString(),
            origem: "sistema",
            usuarioNome: nomeUsuarioSistema(usuarioAtual),
          }],
          orcamentoCompleto: novos[s.empId],
        };
      });
      const crmAtual = (await store.get(KEY_CRM)) || crm;
      const atualizadoCRM = [...novosCRM, ...crmAtual];
      setCrm(atualizadoCRM);
      await store.set(KEY_CRM, atualizadoCRM);
      await sincronizarOrcamentosNosClientes(novosCRM);


      if (selecao.length > 0) {
        setActiveTab(selecao[0].empId);
      }

      await incOrcamentos(selecao.length);

      pushToast("Orçamentos gerados com IA. Revise antes de exportar.", "ok");
      setStep("preview");
    } catch (error) {
      console.error("Erro ao gerar orçamento:", error);
      const mensagem = error.message || "Erro ao gerar orçamento com IA.";
      setErroGeracao(mensagem);
      pushToast(mensagem, "erro");
    } finally {
      setGerando(false);
      setIaStatus("");
    }
  };

  const fieldChange = (empId, campo, val) => setOrcamentos((prev) => ({ ...prev, [empId]: { ...prev[empId], campos: { ...prev[empId].campos, [campo]: val } } }));

  const baixarPDF = async (empId) => {
    const emp = empresas.find((e) => e.id === empId);
    let dados = orcamentos[empId];

    if (!emp || !dados) {
      pushToast("Orçamento não encontrado para exportação.", "erro");
      return;
    }

    try {
      dados = normalizarDocumentoPublico(dados, emp);

      // Quando há timbrado, a PÁGINA do PDF é criada com as MESMAS dimensões
      // do arquivo enviado. Assim o timbrado entra inteiro (sem corte e sem
      // distorção) e o cabeçalho/rodapé dele nunca são cortados.
      const jsPDF = await getJsPdf();
      const temTimbrado = Boolean(emp.papelTimbrado);
      const tW = Number(emp.timbradoLarguraPt) || 595.28;
      const tH = Number(emp.timbradoAlturaPt) || 841.89;
      const orientacao = temTimbrado && tW > tH ? "landscape" : "portrait";

      const pdf = temTimbrado
        ? new jsPDF({ orientation: orientacao, unit: "pt", format: [tW, tH] })
        : new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const perfil = perfilVisualEmpresa(emp, dados);
      const exibirCodigoDocumento = documentoExibeCodigo(perfil);
      const corPrimariaDoc = corDocumento(emp, perfil, "primaria");
      const corSecundariaDoc = corDocumento(emp, perfil, "secundaria");
      const titleFont = mapPdfFont(emp.fonteTitulo);
      const bodyFont = mapPdfFont(emp.fonteCorpo);
      const titleSize = Number(emp.tamanhoTitulo) || 14;
      const bodySize = Number(emp.tamanhoCorpo) || 12;

      const marginX = perfil.tipo === "varejo-eletrico" ? 68 : 48;
      const maxW = pageW - marginX * 2;

      // Margens calculadas a partir das zonas detectadas do timbrado (em pt).
      // Uma folga extra garante que o corpo NUNCA sobreponha o cabeçalho/rodapé.
      const folgaTopo = 14;
      const folgaBase = 14;
      const topMargin = temTimbrado
        ? Math.max(Number(emp.altoCabecalho) || Math.round(pageH * 0.18), 40) + folgaTopo + (perfil.extraTopo || 0)
        : 122;
      const bottomMargin = temTimbrado
        ? Math.max(Number(emp.altoRodape) || Math.round(pageH * 0.12), 24) + folgaBase + 14
        : 78;
      let y = topMargin;

      const addBase = () => {
        let timbradoAplicado = false;

        if (emp.papelTimbrado) {
          try {
            pdf.addImage(
              emp.papelTimbrado,
              imageTypeFromDataUrl(emp.papelTimbrado),
              0,
              0,
              pageW,
              pageH,
              undefined,
              "FAST"
            );

            timbradoAplicado = true;
          } catch (e) {
            console.warn("Timbrado falhou. Aplicando cabeçalho padrão:", e);
          }
        }

        if (!timbradoAplicado) {
          pdf.setFillColor(255, 255, 255);
          pdf.rect(0, 0, pageW, pageH, "F");

          if (emp.logo) {
            try {
              pdf.addImage(
                emp.logo,
                imageTypeFromDataUrl(emp.logo),
                marginX,
                28,
                95,
                48,
                undefined,
                "FAST"
              );
            } catch (e) {
              console.warn("Não foi possível aplicar a logo:", e);
            }
          }

          pdf.setFont(titleFont, "bold");
          pdf.setFontSize(13);
          pdf.setTextColor(0, 0, 0);
          pdf.text(
            emp.nome || "Proposta Comercial",
            emp.logo ? marginX + 110 : marginX,
            52
          );

          if (exibirCodigoDocumento) {
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(10);
            pdf.setTextColor(0, 0, 0);
            pdf.text(dados.numero || orcNum(), pageW - marginX, 52, {
              align: "right",
            });
          }

          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.6);
          pdf.line(marginX, 92, pageW - marginX, 92);
        }

        y = topMargin;
      };

      const ensure = (h = 60) => {
        if (y + h > pageH - bottomMargin) {
          pdf.addPage();
          addBase();
        }
      };

      const writeSection = (titulo, conteudo) => {
        const valor = String(conteudo || "").trim();
        if (!valor) return;

        ensure(70);
        if (String(titulo || "").trim()) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(perfil.tipo === "consultoria" ? 9 : perfil.tipo === "operacional" ? 9.5 : 10);
          pdf.setTextColor(0, 0, 0);
          if (perfil.tipo === "consultoria") {
            pdf.text(String(titulo).toUpperCase(), marginX, y);
            pdf.setDrawColor(17, 24, 39);
            pdf.setLineWidth(0.35);
            pdf.line(marginX, y + 5, marginX + maxW * 0.38, y + 5);
            y += 20;
          } else if (perfil.tipo === "operacional") {
            const [sr, sg, sb] = hexToRgb(corPrimariaDoc);
            pdf.setFillColor(sr, sg, sb);
            pdf.rect(marginX, y - 8, 4, 13, "F");
            pdf.text(String(titulo).toUpperCase(), marginX + 10, y);
            y += 18;
          } else if (perfil.tipo === "varejo-eletrico") {
            pdf.setFont(titleFont, "bold");
            pdf.setFontSize(10.5);
            pdf.text(String(titulo).toUpperCase(), marginX, y);
            y += 17;
          } else {
            pdf.text(String(titulo).toUpperCase(), marginX, y);
            y += 18;
          }
        }

        pdf.setFont(bodyFont, "normal");
        pdf.setFontSize(bodySize);
        pdf.setTextColor(0, 0, 0);

        const linhas = pdf.splitTextToSize(valor, maxW);
        for (const linha of linhas) {
          ensure(bodySize + 8);
          pdf.text(linha, marginX, y);
          y += bodySize + 5;
        }
        y += 12;
      };

      const writeMaterialsTable = () => {
        const rows = materialRows(dados);
        if (!rows.length) return;

        ensure(100);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(getSectionLabel(dados, "materiais"), marginX, y);
        y += 16;

        const [r, g, b] = hexToRgb(corPrimariaDoc);
        const drawText = (text, x, width, lineY, align = "left", size = 7.5) => {
          pdf.setFontSize(size);
          const lines = pdf.splitTextToSize(String(text || ""), width - 6);
          const tx = align === "right" ? x + width - 3 : x + 3;
          pdf.text(lines, tx, lineY, { align });
          return lines.length;
        };

        if (perfil.tipo === "operacional") {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.setTextColor(r, g, b);
          pdf.text("ITEM / EXECUCAO", marginX + 8, y);
          pdf.text("QTD", marginX + maxW - 172, y, { align: "right" });
          pdf.text("VALOR FINAL", marginX + maxW, y, { align: "right" });
          y += 8;

          rows.forEach((item, index) => {
            const descW = maxW - 188;
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), descW);
            const rowHeight = Math.max(30, descLines.length * 9 + (item.observacao ? 14 : 8));
            ensure(rowHeight + 10);

            pdf.setFillColor(index % 2 === 0 ? 248 : 255, index % 2 === 0 ? 250 : 255, index % 2 === 0 ? 252 : 255);
            pdf.rect(marginX, y, maxW, rowHeight, "F");
            pdf.setFillColor(r, g, b);
            pdf.rect(marginX, y, 4, rowHeight, "F");
            pdf.setDrawColor(226, 232, 240);
            pdf.line(marginX, y + rowHeight, marginX + maxW, y + rowHeight);

            pdf.setTextColor(0, 0, 0);
            pdf.setFont(bodyFont, "bold");
            pdf.setFontSize(7.5);
            pdf.text(String(index + 1).padStart(2, "0"), marginX + 10, y + 13);
            pdf.setFont(bodyFont, "normal");
            pdf.text(descLines, marginX + 30, y + 13);

            if (item.observacao) {
              pdf.setFontSize(6.8);
              pdf.setTextColor(70, 85, 105);
              pdf.text(pdf.splitTextToSize(String(item.observacao), descW), marginX + 30, y + 13 + descLines.length * 9);
            }

            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.2);
            pdf.setTextColor(0, 0, 0);
            pdf.text(`${item.quantidade || 1} ${item.unidade || "un"}`, marginX + maxW - 156, y + 14, { align: "right" });
            pdf.text(brl(item.subtotal), marginX + maxW, y + 14, { align: "right" });
            y += rowHeight;
          });

          ensure(24);
          pdf.setDrawColor(r, g, b);
          pdf.setLineWidth(0.8);
          pdf.line(marginX + maxW - 210, y + 6, marginX + maxW, y + 6);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(0, 0, 0);
          pdf.text("TOTAL DOS ITENS", marginX + maxW - 92, y + 20, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 20, { align: "right" });
          y += 34;
          return;
        }

        if (perfil.tipo === "consultoria") {
          const widths = [maxW - 208, 34, 30, 64, 80];
          const labels = ["DESCRICAO", "QTD", "UN", "VALOR UNIT.", "VALOR FINAL"];
          const aligns = ["left", "right", "right", "right", "right"];

          ensure(24);
          pdf.setDrawColor(17, 24, 39);
          pdf.setLineWidth(0.8);
          pdf.line(marginX, y, marginX + maxW, y);
          y += 13;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(17, 24, 39);
          let x = marginX;
          labels.forEach((label, i) => {
            drawText(label, x, widths[i], y, aligns[i], 6.8);
            x += widths[i];
          });
          y += 10;
          pdf.setDrawColor(203, 213, 225);
          pdf.line(marginX, y, marginX + maxW, y);

          rows.forEach((item) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), widths[0] - 6);
            const rowHeight = Math.max(22, descLines.length * 9 + 7);
            ensure(rowHeight + 8);
            y += 2;

            pdf.setTextColor(0, 0, 0);
            x = marginX;
            pdf.setFont(bodyFont, "normal");
            pdf.setFontSize(7.4);
            pdf.text(descLines, x + 3, y + 11);
            x += widths[0];
            drawText(item.quantidade || 1, x, widths[1], y + 11, "right", 7.1); x += widths[1];
            drawText(item.unidade || "un", x, widths[2], y + 11, "right", 7.1); x += widths[2];
            drawText(brl(item.valorUnitario), x, widths[3], y + 11, "right", 7.1); x += widths[3];
            pdf.setFont(bodyFont, "bold");
            drawText(brl(item.subtotal), x, widths[4], y + 11, "right", 7.1);

            y += rowHeight;
            pdf.setDrawColor(226, 232, 240);
            pdf.line(marginX, y, marginX + maxW, y);
          });

          ensure(24);
          y += 4;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.2);
          pdf.setTextColor(0, 0, 0);
          pdf.text("VALOR CONSOLIDADO DOS ITENS", marginX + maxW - 105, y + 14, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 14, { align: "right" });
          y += 34;
          return;
        }

        if (perfil.tipo === "varejo-eletrico") {
          const widths = [maxW - 164, 36, 34, 94];
          ensure(30);
          pdf.setDrawColor(17, 24, 39);
          pdf.setLineWidth(1.2);
          pdf.line(marginX, y, marginX + maxW, y);
          y += 13;
          pdf.setFont("helvetica", "bold");
          pdf.setTextColor(17, 24, 39);
          ["PRODUTO / MATERIAL", "QTD", "UN", "TOTAL FINAL"].forEach((label, i) => {
            const x = marginX + widths.slice(0, i).reduce((acc, w) => acc + w, 0);
            drawText(label, x, widths[i], y, i === 0 ? "left" : "right", 7.2);
          });
          y += 10;
          pdf.setDrawColor(17, 24, 39);
          pdf.line(marginX, y, marginX + maxW, y);

          rows.forEach((item, index) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), widths[0] - 28);
            const rowHeight = Math.max(24, descLines.length * 9 + 8);
            ensure(rowHeight + 8);
            y += 2;
            pdf.setFont(bodyFont, "bold");
            pdf.setFontSize(6.8);
            pdf.setTextColor(100, 116, 139);
            pdf.text(String(index + 1).padStart(3, "0"), marginX + 3, y + 11);
            pdf.setFont(bodyFont, "normal");
            pdf.setFontSize(7.6);
            pdf.setTextColor(0, 0, 0);
            pdf.text(descLines, marginX + 24, y + 11);
            let x = marginX + widths[0];
            drawText(item.quantidade || 1, x, widths[1], y + 11, "right", 7.3); x += widths[1];
            drawText(item.unidade || "un", x, widths[2], y + 11, "right", 7.3); x += widths[2];
            pdf.setFont(bodyFont, "bold");
            drawText(brl(item.subtotal), x, widths[3], y + 11, "right", 7.6);
            y += rowHeight;
            pdf.setDrawColor(226, 232, 240);
            pdf.line(marginX, y, marginX + maxW, y);
          });

          ensure(24);
          y += 6;
          pdf.setDrawColor(17, 24, 39);
          pdf.setLineWidth(0.9);
          pdf.line(marginX + maxW - 210, y, marginX + maxW, y);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.8);
          pdf.text("TOTAL DA COTACAO", marginX + maxW - 92, y + 16, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 16, { align: "right" });
          y += 34;
          return;
        }

        if (perfil.tipo === "eventos") {
          const [er, eg, eb] = hexToRgb(corPrimariaDoc);
          rows.forEach((item, index) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), maxW - 170);
            const rowHeight = Math.max(34, descLines.length * 9 + 14);
            ensure(rowHeight + 10);
            pdf.setFillColor(index % 2 === 0 ? 255 : 254, index % 2 === 0 ? 247 : 242, index % 2 === 0 ? 237 : 242);
            pdf.rect(marginX, y, maxW, rowHeight, "F");
            pdf.setDrawColor(er, eg, eb);
            pdf.setLineWidth(0.45);
            pdf.rect(marginX, y, maxW, rowHeight);
            pdf.setFillColor(er, eg, eb);
            pdf.rect(marginX, y, 32, rowHeight, "F");
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(8);
            pdf.setTextColor(255, 255, 255);
            pdf.text(String(index + 1).padStart(2, "0"), marginX + 16, y + 20, { align: "center" });
            pdf.setFont(bodyFont, "normal");
            pdf.setFontSize(7.8);
            pdf.setTextColor(0, 0, 0);
            pdf.text(descLines, marginX + 44, y + 13);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.2);
            pdf.text(`${item.quantidade || 1} ${item.unidade || "un"}`, marginX + maxW - 104, y + 13, { align: "right" });
            pdf.setFontSize(8.1);
            pdf.text(brl(item.subtotal), marginX + maxW - 10, y + 13, { align: "right" });
            y += rowHeight + 7;
          });

          ensure(24);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.6);
          pdf.setTextColor(er, eg, eb);
          pdf.text("VALOR DO ATENDIMENTO", marginX + maxW - 104, y + 12, { align: "right" });
          pdf.setTextColor(0, 0, 0);
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 12, { align: "right" });
          y += 32;
          return;
        }

        if (perfil.tipo === "orlovic") {
          const widths = [42, maxW - 206, 42, 42, 80];
          const labels = ["ITEM", "ESCOPO", "QTD", "UN", "VALOR"];
          ensure(26);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.2);
          pdf.setTextColor(55, 65, 81);
          pdf.setDrawColor(148, 163, 184);
          pdf.rect(marginX, y, maxW, 19);
          let x = marginX;
          labels.forEach((label, i) => {
            drawText(label, x, widths[i], y + 12, i <= 1 ? "left" : "right", 6.8);
            if (i < labels.length - 1) pdf.line(x + widths[i], y, x + widths[i], y + 19);
            x += widths[i];
          });
          y += 19;

          rows.forEach((item, index) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), widths[1] - 8);
            const rowHeight = Math.max(24, descLines.length * 9 + 8);
            ensure(rowHeight + 8);
            x = marginX;
            pdf.setDrawColor(226, 232, 240);
            pdf.rect(marginX, y, maxW, rowHeight);
            pdf.setFont(bodyFont, "bold");
            pdf.setFontSize(7.3);
            pdf.setTextColor(0, 0, 0);
            drawText(String(index + 1).padStart(2, "0"), x, widths[0], y + 12, "left", 7.2); x += widths[0];
            pdf.setFont(bodyFont, "normal");
            pdf.text(descLines, x + 3, y + 12); x += widths[1];
            drawText(item.quantidade || 1, x, widths[2], y + 12, "right", 7.2); x += widths[2];
            drawText(item.unidade || "un", x, widths[3], y + 12, "right", 7.2); x += widths[3];
            pdf.setFont(bodyFont, "bold");
            drawText(brl(item.subtotal), x, widths[4], y + 12, "right", 7.2);
            y += rowHeight;
          });

          ensure(24);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.2);
          pdf.text("INVESTIMENTO DOS ITENS", marginX + maxW - 112, y + 15, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 15, { align: "right" });
          y += 34;
          return;
        }

        if (perfil.tipo === "construcao") {
          rows.forEach((item, index) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), maxW - 146);
            const rowHeight = Math.max(30, descLines.length * 9 + 12);
            ensure(rowHeight + 8);
            pdf.setFillColor(255, 251, 235);
            pdf.rect(marginX, y, maxW, rowHeight, "F");
            pdf.setDrawColor(245, 158, 11);
            pdf.setLineWidth(0.35);
            pdf.line(marginX, y, marginX + maxW, y);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7);
            pdf.setTextColor(146, 64, 14);
            pdf.text(`ETAPA ${String(index + 1).padStart(2, "0")}`, marginX + 8, y + 13);
            pdf.setFont(bodyFont, "normal");
            pdf.setFontSize(7.7);
            pdf.setTextColor(0, 0, 0);
            pdf.text(descLines, marginX + 80, y + 13);
            pdf.setFont("helvetica", "bold");
            pdf.setFontSize(7.5);
            pdf.text(brl(item.subtotal), marginX + maxW - 8, y + 13, { align: "right" });
            y += rowHeight + 5;
          });

          ensure(24);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(0, 0, 0);
          pdf.text("INVESTIMENTO CONSOLIDADO", marginX + maxW - 116, y + 14, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 14, { align: "right" });
          y += 34;
          return;
        }

        if (perfil.tipo === "engenharia") {
          const widths = [maxW - 192, 36, 36, 56, 64];
          const labels = ["DESCRICAO TECNICA", "QTD", "UN", "UNIT.", "TOTAL"];
          const [tr, tg, tb] = hexToRgb(corPrimariaDoc);
          ensure(24);
          pdf.setDrawColor(tr, tg, tb);
          pdf.setLineWidth(0.8);
          pdf.line(marginX, y, marginX + maxW, y);
          y += 12;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.8);
          pdf.setTextColor(tr, tg, tb);
          let x = marginX;
          labels.forEach((label, i) => {
            drawText(label, x, widths[i], y, i === 0 ? "left" : "right", 6.8);
            x += widths[i];
          });
          y += 10;
          rows.forEach((item) => {
            const descLines = pdf.splitTextToSize(String(item.descricao || ""), widths[0] - 6);
            const rowHeight = Math.max(22, descLines.length * 8.5 + 7);
            ensure(rowHeight + 6);
            x = marginX;
            pdf.setDrawColor(203, 213, 225);
            pdf.line(marginX, y + rowHeight, marginX + maxW, y + rowHeight);
            pdf.setFont(bodyFont, "normal");
            pdf.setFontSize(7.2);
            pdf.setTextColor(0, 0, 0);
            pdf.text(descLines, x + 3, y + 11); x += widths[0];
            drawText(item.quantidade || 1, x, widths[1], y + 11, "right", 7.1); x += widths[1];
            drawText(item.unidade || "un", x, widths[2], y + 11, "right", 7.1); x += widths[2];
            drawText(brl(item.valorUnitario), x, widths[3], y + 11, "right", 7.1); x += widths[3];
            pdf.setFont(bodyFont, "bold");
            drawText(brl(item.subtotal), x, widths[4], y + 11, "right", 7.1);
            y += rowHeight;
          });

          ensure(24);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.4);
          pdf.setTextColor(0, 0, 0);
          pdf.text("TOTAL TECNICO DOS ITENS", marginX + maxW - 106, y + 15, { align: "right" });
          pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 15, { align: "right" });
          y += 34;
          return;
        }

        const widths = [maxW - 208, 34, 30, 64, 80];
        const labels = ["ITEM", "QTD", "UN", "VALOR UNIT.", "VALOR FINAL"];
        const aligns = ["left", "right", "right", "right", "right"];
        const headerColor = perfil.tipo === "varejo-eletrico"
          ? [17, 24, 39]
          : perfil.tipo === "orlovic"
            ? [55, 65, 81]
            : perfil.tipo === "eventos"
              ? hexToRgb(corSecundariaDoc || corPrimariaDoc)
              : [r, g, b];

        ensure(22);
        pdf.setFillColor(headerColor[0], headerColor[1], headerColor[2]);
        pdf.rect(marginX, y, maxW, 18, "F");
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(255, 255, 255);
        let x = marginX;
        labels.forEach((label, i) => {
          drawText(label, x, widths[i], y + 12, aligns[i], 6.8);
          x += widths[i];
        });
        y += 18;

        pdf.setFont(bodyFont, "normal");
        rows.forEach((item, index) => {
          const descLines = pdf.splitTextToSize(String(item.descricao || ""), widths[0] - 6);
          const rowHeight = Math.max(22, descLines.length * 9 + (item.observacao ? 12 : 6));
          ensure(rowHeight + 8);

          if (index % 2 === 0) {
            pdf.setFillColor(245, 248, 250);
            pdf.rect(marginX, y, maxW, rowHeight, "F");
          }
          pdf.setDrawColor(220, 226, 235);
          pdf.line(marginX, y + rowHeight, marginX + maxW, y + rowHeight);

          pdf.setTextColor(0, 0, 0);
          x = marginX;
          pdf.setFont(bodyFont, "normal");
          pdf.setFontSize(7.5);
          pdf.text(descLines, x + 3, y + 11);
          if (item.observacao) {
            pdf.setFontSize(6.8);
            pdf.setTextColor(70, 85, 105);
            pdf.text(pdf.splitTextToSize(String(item.observacao), widths[0] - 6), x + 3, y + 11 + descLines.length * 9);
          }

          x += widths[0];
          pdf.setTextColor(0, 0, 0);
          pdf.setFontSize(7.2);
          drawText(item.quantidade || 1, x, widths[1], y + 12, "right", 7.2); x += widths[1];
          drawText(item.unidade || "un", x, widths[2], y + 12, "right", 7.2); x += widths[2];
          drawText(brl(item.valorUnitario), x, widths[3], y + 12, "right", 7.2); x += widths[3];
          pdf.setFont(bodyFont, "bold");
          drawText(brl(item.subtotal), x, widths[4], y + 12, "right", 7.2);

          y += rowHeight;
        });

        ensure(26);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(8.5);
        pdf.setTextColor(0, 0, 0);
        pdf.text("TOTAL DA TABELA", marginX + maxW - 170, y + 14, { align: "right" });
        pdf.text(brl(materialTotal(rows)), marginX + maxW, y + 14, { align: "right" });
        y += 32;
      };

      const writeOrderedSection = (key) => {
        if (key === "materiais") {
          if (dados.campos?.materiais) writeSection(getSectionLabel(dados, "materiais"), dados.campos.materiais);
          writeMaterialsTable();
          return;
        }
        if (key === "itens") {
          if (Array.isArray(dados.itensIA) && dados.itensIA.length) {
            writeSection(getSectionLabel(dados, "itens"), dados.itensIA.map((item, i) => `${i + 1}. ${item}`).join("\n"));
          }
          return;
        }
        writeSection(getSectionLabel(dados, key), dados.campos?.[key]);
      };

      const fitTitle = (texto, width) => {
        let size = Math.min(titleSize, perfil.tituloMaxSize || 24);
        const minSize = perfil.tituloMinSize || 12;
        let lines = [];
        pdf.setFont(titleFont, "bold");
        while (size >= minSize) {
          pdf.setFontSize(size);
          lines = pdf.splitTextToSize(String(texto || "").toUpperCase(), width);
          if (lines.length <= (perfil.tituloMaxLinhas || 2)) break;
          size -= 1;
        }
        return { size, lines };
      };

      const writeOpening = () => {
        ensure(90);
        const numero = dados.numero || orcNum();
        const titulo = getDocTitle(dados, perfil).toUpperCase();
        const titleWidth = exibirCodigoDocumento ? maxW * 0.74 : maxW;
        const fitted = fitTitle(titulo, titleWidth);

        if (exibirCodigoDocumento) {
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(0, 0, 0);
          pdf.text(String(perfil.numeroLabel || "Cotacao").toUpperCase(), pageW - marginX, y, { align: "right" });
          pdf.setFontSize(9);
          pdf.text(numero, pageW - marginX, y + 13, { align: "right" });
        }

        pdf.setFont(titleFont, "bold");
        pdf.setFontSize(fitted.size);
        pdf.setTextColor(0, 0, 0);
        pdf.text(fitted.lines, marginX, y);
        y += Math.max(34, fitted.lines.length * (fitted.size + 5)) + 12;

        if (perfil.tipo === "consultoria") {
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.4);
          pdf.line(marginX, y, marginX + maxW * 0.42, y);
          y += 16;
        }
      };

      const writeValorGlobal = () => {
        if (!dados.valorGlobal) return;
        ensure(72);
        if (perfil.tipo === "consultoria") {
          pdf.setDrawColor(17, 24, 39);
          pdf.setLineWidth(0.6);
          pdf.line(marginX, y, marginX + maxW, y);
          y += 18;
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(8.5);
          pdf.setTextColor(0, 0, 0);
          pdf.text(String(perfil.valorLabel || "Valor global").toUpperCase(), marginX, y);
          pdf.setFont(titleFont, "bold");
          pdf.setFontSize(17);
          pdf.text(brl(dados.valorGlobal), marginX + maxW, y, { align: "right" });
          y += 28;
          return;
        }

        if (perfil.tipo === "operacional") {
          const [vr, vg, vb] = hexToRgb(corPrimariaDoc);
          pdf.setFillColor(vr, vg, vb);
          pdf.rect(marginX + maxW - 210, y - 2, 210, 46, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7.5);
          pdf.setTextColor(255, 255, 255);
          pdf.text(String(perfil.valorLabel || "Valor global").toUpperCase(), marginX + maxW - 12, y + 13, { align: "right" });
          pdf.setFont(titleFont, "bold");
          pdf.setFontSize(18);
          pdf.text(brl(dados.valorGlobal), marginX + maxW - 12, y + 34, { align: "right" });
          y += 62;
          return;
        }

        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10.5);
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(perfil.valorLabel || "Valor global").toUpperCase(), marginX, y);
        y += 19;
        pdf.setFont(titleFont, "bold");
        pdf.setFontSize(Math.max(16, Math.min(titleSize, perfil.tipo === "varejo-eletrico" ? 22 : 24)));
        pdf.setTextColor(0, 0, 0);
        pdf.text(brl(dados.valorGlobal), marginX, y);
        y += 30;
      };

      const buildRodapeLines = () => {
        const parts = rodapeDocumento(emp).split("|").map((p) => p.trim()).filter(Boolean);
        if (!parts.length) return [];
        if (perfil.rodape === "compacto") {
          return [parts.slice(0, 2).join(" | "), parts.slice(2).join(" | ")].filter(Boolean);
        }
        return [parts.slice(0, 2).join(" | "), parts.slice(2, 4).join(" | "), parts.slice(4).join(" | ")].filter(Boolean);
      };

      const writeSignature = () => {
        if (perfil.assinatura === "fornecedor-compacto") return;
        ensure(86);
        pdf.setFont(bodyFont, "normal");
        pdf.setFontSize(Math.max(8, bodySize - 1));
        pdf.setTextColor(0, 0, 0);
        const assinaturaTexto = assinaturaDocumento(emp, perfil);
        const assinaturaLines = pdf.splitTextToSize(assinaturaTexto, Math.min(260, maxW * 0.72));

        if (perfil.assinatura === "eventos") {
          pdf.setFont(bodyFont, "normal");
          pdf.text("Atenciosamente,", marginX, y);
          pdf.setFont(bodyFont, "bold");
          pdf.text(assinaturaLines, marginX, y + 16);
          y += 24 + assinaturaLines.length * 10;
          return;
        }

        if (perfil.assinatura === "tecnica") {
          pdf.setDrawColor(0, 0, 0);
          pdf.setLineWidth(0.4);
          const boxW = Math.min(290, maxW);
          const boxH = Math.max(42, 24 + assinaturaLines.length * 10);
          pdf.rect(marginX, y, boxW, boxH);
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(6.8);
          pdf.text("RESPONSAVEL PELO DOCUMENTO", marginX + 10, y + 12);
          pdf.setFont(bodyFont, "bold");
          pdf.setFontSize(Math.max(8, bodySize - 2));
          pdf.text(assinaturaLines, marginX + 10, y + 27);
          y += boxH + 16;
          return;
        }

        if (perfil.assinatura === "operacional") {
          const [sr, sg, sb] = hexToRgb(corPrimariaDoc);
          pdf.setFillColor(sr, sg, sb);
          pdf.rect(marginX, y - 2, 4, 44, "F");
          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(7);
          pdf.text("ATENDIMENTO OPERACIONAL", marginX + 12, y + 8);
          pdf.setFont(bodyFont, "bold");
          pdf.setFontSize(Math.max(8, bodySize - 1));
          pdf.text(assinaturaLines, marginX + 12, y + 24);
          y += 58;
          return;
        }

        if (perfil.assinatura === "institucional-direita") {
          pdf.setFont(bodyFont, "bold");
          const rightLines = pdf.splitTextToSize(assinaturaTexto, Math.min(260, maxW * 0.65));
          pdf.text(rightLines, pageW - marginX, y, { align: "right" });
          y += 12 + rightLines.length * 10;
          return;
        }

        pdf.setDrawColor(0, 0, 0);
        pdf.setLineWidth(0.5);
        pdf.line(marginX, y + 10, marginX + 180, y + 10);
        y += 28;
        pdf.setFont(bodyFont, "bold");
        pdf.setFontSize(bodySize);
        pdf.text(assinaturaLines, marginX, y);
        y += 12 + assinaturaLines.length * 10;
      };

      const writeRodape = () => {
        if (emp.papelTimbrado) return;
        const lines = buildRodapeLines();
        if (!lines.length) return;
        pdf.setFont(bodyFont, "normal");
        pdf.setFontSize(7.5);
        pdf.setTextColor(0, 0, 0);
        const wrapped = lines.flatMap((line) => pdf.splitTextToSize(line, pageW - 110));
        const startY = pageH - 24 - Math.max(0, wrapped.length - 1) * 9;
        pdf.text(wrapped, pageW / 2, startY, { align: "center" });
      };

      addBase();

      writeOpening();

      writeSection(perfil.clienteLabel || "Destinatario", dados.campos?.cliente || cliente);
      if (dados.identidadeDocumento?.subtitulo) {
        writeSection("", dados.identidadeDocumento.subtitulo);
      }
      getSectionOrder(dados, perfil).forEach(writeOrderedSection);

      writeValorGlobal();

      writeSignature();
      writeRodape();

      pdf.save(nomeArquivoPDFOrcamento(emp, dados, cliente, texto));
      pushToast("PDF baixado com sucesso.", "ok");
    } catch (error) {
      console.error("Erro ao exportar PDF:", error);
      pushToast(error.message || "Erro ao baixar PDF.", "erro");
    }
  };


  const baixarTodosPDF = async () => {
    for (const emp of empsSel) {
      // Pequena pausa para evitar bloqueio de múltiplos downloads no navegador.
      await baixarPDF(emp.id);
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
  };

  // Baixa/abre o orçamento: se for anexado, abre o PDF salvo; se for gerado,
  // re-renderiza o PDF a partir do conteúdo salvo.
  const baixarOrcamento = (item) => {
    if (item?.anexado && item?.arquivoPdf) {
      const ok = baixarDataUrl(item.arquivoPdf, item.arquivoNome || `${safeFileName(item.cliente)}.pdf`);
      pushToast(ok ? "PDF do orçamento anexado baixado." : "Não foi possível abrir o PDF anexado.", ok ? "ok" : "erro");
      return;
    }
    abrirOrcamentoSalvo(item);
  };

  const abrirOrcamentoSalvo = (item) => {
    // Orçamento anexado (PDF externo): baixa o arquivo salvo.
    if (item?.anexado && item?.arquivoPdf) {
      const ok = baixarDataUrl(item.arquivoPdf, item.arquivoNome || `${safeFileName(item.cliente)}.pdf`);
      pushToast(ok ? "PDF do orçamento anexado baixado." : "Não foi possível abrir o PDF anexado.", ok ? "ok" : "erro");
      return;
    }

    if (!item?.orcamentoCompleto || !item?.empresaId) {
      pushToast("Este orçamento antigo não possui visualização salva. Gere novamente para salvar o conteúdo completo.", "aviso");
      return;
    }

    const empSalva = empresas.find((emp) => emp.id === item.empresaId) || {};
    const orcamentoNormalizado = normalizarDocumentoPublico(item.orcamentoCompleto, empSalva);
    setView("orcamento");
    setStep("preview");
    setOrcamentos({
      [item.empresaId]: orcamentoNormalizado,
    });
    setActiveTab(item.empresaId);
    setEditando(false);
    setSelecao([
      {
        empId: item.empresaId,
        valorGlobal: item.valorGlobal || orcamentoNormalizado.valorGlobal || "",
      },
    ]);
    setCliente(item.cliente || orcamentoNormalizado?.campos?.cliente || "");
    pushToast("Orçamento aberto para visualização e novo download.", "ok");
  };

  // Salva no CRM/Gestão um orçamento anexado externamente.
  const salvarOrcamentoAnexado = async (item, options = {}) => {
    const crmAtual = (await store.get(KEY_CRM)) || crm;
    const atualizado = [item, ...crmAtual.filter((orc) => orc.id !== item.id)];
    setCrm(atualizado);
    await store.set(KEY_CRM, atualizado);
    await sincronizarOrcamentosNosClientes([item]);
    await incOrcamentos(1);
    if (!options.keepOpen) setAnexarOpen(false);
    pushToast("Orçamento anexado e adicionado ao acompanhamento.", "ok");
  };


  const tituloCardExportacao = (emp) => {
    const dados = orcamentos[emp.id] || {};
    return dados.tituloResumo || resumoComercialOrcamento(dados, emp, cliente, texto);
  };

  const detalheCardExportacao = (emp) => {
    const dados = orcamentos[emp.id] || {};
    const perfil = perfilVisualEmpresa(emp, dados);
    return [
      emp.nome,
      dados.valorGlobal ? brl(dados.valorGlobal) : "",
      documentoExibeCodigo(perfil) && dados.numero ? dados.numero : "",
    ].filter(Boolean).join(" · ");
  };

  const INP = { background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "11px 14px", color: BRAND.text, fontSize: UI.text, outline: "none", width: "100%", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit", transition: "all .22s ease" };
  const corDB = { ok: BRAND.green, erro: BRAND.danger, carregando: BRAND.warn };

  if (!autenticado && acessoPerfil) {
    return (
      <>
        <Toast toast={toast} />
        <AccessStatusScreen
          perfil={acessoPerfil}
          onSignOut={async () => {
            await supabase.auth.signOut({ scope: "local" });
            setAcessoPerfil(null);
            setUsuarioAtual(null);
            setAutenticado(false);
          }}
        />
      </>
    );
  }

  if (!autenticado) {
    return (
      <>
        <Toast toast={toast} />
        <LoginScreen
          pushToast={pushToast}
          onLogin={(u) => {
            pushToast(`Bem-vindo, ${u.email || u.nome}. Sincronizando dados...`, "ok");
            window.location.reload();
          }}
        />
      </>
    );
  }

  return (
    <div className="of-app-shell" style={{ minHeight: "100vh", background: `radial-gradient(circle at 0% 0%, ${BRAND.green2}12, transparent 28%), radial-gradient(circle at 100% 5%, ${BRAND.blue2}12, transparent 28%), ${BRAND.bg}`, color: BRAND.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        :root {
          --of-bg: #030712;
          --of-panel: rgba(10, 21, 37, 0.82);
          --of-card: rgba(15, 23, 42, 0.76);
          --of-border: rgba(0, 176, 255, 0.22);
          --of-green: #00e676;
          --of-blue: #00b0ff;
          --of-purple: #7c3aed;
          --of-text: #f8fafc;
          --of-muted: #94a3b8;
        }
        @keyframes ofModalIn { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ofCardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        .of-glass { background: linear-gradient(145deg, rgba(15,23,42,.86), rgba(3,7,18,.78)); border: 1px solid rgba(0,176,255,.22); box-shadow: 0 0 35px rgba(0,230,118,.08), inset 0 1px 0 rgba(255,255,255,.05); backdrop-filter: blur(18px); }
        .of-neon-btn { background: linear-gradient(135deg, #00e676, #00b0ff); color: #02111f; border: none; font-weight: 900; box-shadow: 0 0 28px rgba(0,230,118,.32); }
        .of-dashboard-card { background: linear-gradient(145deg, rgba(15,23,42,.92), rgba(2,6,23,.84)); border: 1px solid rgba(0,176,255,.2); border-radius: 18px; padding: 18px; transition: .25s ease; }
        .of-dashboard-card:hover { transform: translateY(-3px); border-color: rgba(0,230,118,.45); box-shadow: 0 0 32px rgba(0,230,118,.12); }
        .of-title-gradient { background: linear-gradient(90deg, #fff, #00e676, #00b0ff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; }
        .of-watermark { position: fixed; right: 35px; bottom: 25px; width: min(620px, 45vw); opacity: .045; pointer-events: none; z-index: 0; }
        button { font-size: 12px; transition: all .22s ease; }
        button:hover { filter: brightness(1.1); transform: translateY(-1px); }
        button:active { transform: translateY(0); }
        input:focus, textarea:focus, select:focus { border-color: ${BRAND.green2} !important; box-shadow: 0 0 0 3px ${BRAND.green2}18; }
        img, canvas, svg, video { max-width: 100%; }
        .of-app-shell { min-height: 100vh; min-height: 100dvh; overflow-x: hidden; }
        .of-topbar { isolation: isolate; }
        .of-main-nav { scrollbar-width: none; }
        .of-main-nav::-webkit-scrollbar { display: none; }
        @media (max-width: 1180px) {
          .of-app-shell [style*="repeat(4"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
          .of-app-shell [style*="repeat(5"] { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; }
        }
        @media (max-width: 820px) {
          body { overscroll-behavior-y: contain; }
          .of-app-shell { min-height: 100dvh !important; width: 100vw !important; }
          .of-topbar {
            position: sticky !important;
            top: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            padding: max(8px, env(safe-area-inset-top)) 10px 8px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 8px !important;
            z-index: 1000 !important;
          }
          .of-topbar > div { width: 100% !important; min-width: 0 !important; }
          .of-topbar-identity { justify-content: space-between !important; gap: 8px !important; }
          .of-topbar-actions { align-items: stretch !important; gap: 8px !important; }
          .of-main-nav {
            width: 100% !important;
            max-width: 100% !important;
            overflow-x: auto !important;
            overflow-y: hidden !important;
            justify-content: flex-start !important;
            border-radius: 14px !important;
            padding: 5px !important;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }
          .of-main-nav button {
            flex: 0 0 auto !important;
            min-height: 40px !important;
            padding: 9px 11px !important;
            font-size: 11px !important;
            white-space: nowrap !important;
            scroll-snap-align: start;
          }
          .of-app-shell > img[aria-hidden="true"] { display: none !important; }
          .of-watermark { display: none !important; }
          .of-app-shell [style*="display: grid"][style*="overflow: hidden"] { overflow: visible !important; }
          .of-app-shell [style*="display: flex"][style*="overflow: hidden"] { overflow: visible !important; flex-direction: column !important; }
          .of-app-shell [style*="grid-template-columns"] { grid-template-columns: minmax(0, 1fr) !important; }
          .of-app-shell [style*="width: 262px"] { width: 100% !important; max-height: 42dvh !important; border-right: 0 !important; border-bottom: 1px solid var(--of-border) !important; }
          .of-app-shell [style*="padding: 22px"], .of-app-shell [style*="padding: 18px"], .of-app-shell [style*="padding: 24px"] { padding: 12px !important; }
          .of-app-shell [style*="border-radius: 18px"], .of-app-shell [style*="border-radius: 16px"] { border-radius: 14px !important; }
          .of-app-shell [style*="minmax(290px"] { grid-template-columns: minmax(0, 1fr) !important; }
          .of-app-shell [style*="white-space: nowrap"] { white-space: normal !important; overflow-wrap: anywhere !important; }
          .of-app-shell input, .of-app-shell textarea, .of-app-shell select {
            font-size: 16px !important;
            min-height: 44px;
            max-width: 100%;
          }
          .of-app-shell textarea { line-height: 1.45 !important; }
          .of-app-shell button {
            min-height: 40px;
            touch-action: manipulation;
          }
          .of-app-shell table {
            display: block;
            max-width: 100%;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .of-app-shell * {
            min-width: 0;
          }
        }
        @media (max-width: 520px) {
          .of-topbar-identity { flex-wrap: wrap !important; }
          .of-topbar-actions { flex-direction: column !important; }
          .of-topbar-actions > button { width: 100% !important; }
          .of-main-nav { border-radius: 12px !important; }
          .of-main-nav button { padding: 8px 10px !important; }
          .of-app-shell [style*="font-size: 44px"], .of-app-shell [style*="font-size: 48px"] { font-size: 34px !important; }
          .of-app-shell [style*="font-size: 28px"], .of-app-shell [style*="font-size: 30px"] { font-size: 23px !important; }
        }
      `}</style>
      <Toast toast={toast} />

      <img
        src="/logo-orcaflow.png"
        alt=""
        aria-hidden="true"
        style={{
          position: "fixed",
          right: 32,
          bottom: 28,
          width: "min(520px, 42vw)",
          maxHeight: "55vh",
          objectFit: "contain",
          opacity: 0.055,
          pointerEvents: "none",
          userSelect: "none",
          zIndex: 0,
          filter: "saturate(1.1)",
        }}
      />

      <RelatorioPendenteNara
        relatorio={relatorioPendente}
        onEnviar={abrirRelatorioPendente}
        onCopiar={copiarRelatorioPendente}
        onDispensar={dispensarRelatorioPendente}
      />

      <div className="of-topbar" style={{ position: "relative", zIndex: 2, background: "rgba(10,20,32,.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BRAND.border}`, padding: "0 16px", height: 84, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div className="of-topbar-identity" style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <OrcaFlowLogo onClick={resetInicio} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: status === "ok" ? `${BRAND.green2}14` : BRAND.border2, border: `1px solid ${status === "ok" ? `${BRAND.green2}33` : BRAND.border2}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: corDB[status] || BRAND.warn }} />
            <span style={{ fontSize: 10, color: corDB[status] || BRAND.warn, fontWeight: 850 }}>{status === "carregando" ? "DB…" : status === "ok" ? `${empresas.length} emp.` : "ERRO"}</span>
          </div>
          <div style={{ fontSize: 10, color: BRAND.muted, border: `1px solid ${BRAND.border2}`, borderRadius: 20, padding: "4px 9px" }}>
            {usuarioAtual?.tipo === "admin" ? "Admin" : "Usuário"}: {usuarioAtual?.nome || "—"}
          </div>
        </div>

        <div className="of-topbar-actions" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div className="of-main-nav" style={{ display: "flex", gap: 3, background: BRAND.bg, borderRadius: 10, padding: 4, border: `1px solid ${BRAND.border2}` }}>
            {[
              ["gestao", "📊 Gestão"],
              ["clientes", "👥 Clientes"],
              ["orcamento", "✦ Orçamento"],
              ["agenda", "Agenda"],
              ["whatsapp", "WhatsApp"],
              ["chat", "Nara"],
              ["perfil", "Meu Perfil"],
              ["empresas", "🏢 Empresas"],
              ...(usuarioAtual?.tipo === "admin" ? [["usuarios", "🔐 Acessos"]] : []),
              ["banco", "🗄 Banco"],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 850, background: view === v ? `linear-gradient(135deg, ${BRAND.green2}, #15803D)` : "transparent", color: view === v ? "#fff" : BRAND.dim, transition: "all .22s ease" }}>{l}</button>
            ))}
          </div>
          <button onClick={async () => { await supabase.auth.signOut({ scope: "local" }); setAutenticado(false); setUsuarioAtual(null); setAcessoPerfil(null); setClientesCRM([]); }} title="Sair" style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 900 }}>Sair</button>
        </div>
      </div>

      {view === "gestao" && (
        <GestaoPage
          crm={crm}
          setCrm={setCrm}
          empresas={empresas}
          clientes={clientesCRM}
          setClientes={setClientesCRM}
          meta={meta}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
          setView={setView}
          abrirOrcamentoSalvo={abrirOrcamentoSalvo}
          baixarOrcamento={baixarOrcamento}
          onAnexar={() => setAnexarOpen(true)}
          naraConfig={naraConfig}
          setNaraConfig={setNaraConfig}
          radarPendente={radarPendente}
          setRadarPendente={setRadarPendente}
          exportarBackup={exportarBackup}
        />
      )}

      {view === "clientes" && (
        <ClientesCRMPanel
          clientes={clientesCRM}
          setClientes={setClientesCRM}
          crm={crm}
          setCrm={setCrm}
          empresas={empresas}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
          lerTextoPDF={lerTextoPDF}
          imagemParaLeitura={imagemParaLeitura}
        />
      )}

      {view === "agenda" && (
        <AgendaClientesPanel
          clientes={clientesCRM}
          setClientes={setClientesCRM}
          crm={crm}
          setCrm={setCrm}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
        />
      )}

      {view === "whatsapp" && (
        <WhatsAppInboxPanel
          crm={crm}
          clientes={clientesCRM}
          setClientes={setClientesCRM}
          empresas={empresas}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
        />
      )}

      {view === "chat" && (
        <ChatIAPanel
          empresas={empresas}
          crm={crm}
          clientes={clientesCRM}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
        />
      )}

      {view === "usuarios" && (
        <UsuariosPanel usuarios={usuarios} setUsuarios={setUsuarios} usuarioAtual={usuarioAtual} setUsuarioAtual={setUsuarioAtual} pushToast={pushToast} />
      )}

      {view === "perfil" && (
        <UsuariosPanel usuarios={usuarios} setUsuarios={setUsuarios} usuarioAtual={usuarioAtual} setUsuarioAtual={setUsuarioAtual} pushToast={pushToast} />
      )}

      {view === "banco" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 16px", maxWidth: 980, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, gap: 10, flexWrap: "wrap" }}>
            <div><div style={{ fontSize: 18, fontWeight: 900 }}>🗄 Banco de Dados</div><div style={{ fontSize: 12, color: BRAND.dim, marginTop: 3 }}>Gerenciamento, auditoria e backup</div></div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={abrirLog} style={{ padding: "8px 13px", borderRadius: 8, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 12, fontWeight: 800 }}>📋 Log</button>
              <button onClick={() => refImport.current.click()} style={{ padding: "8px 13px", borderRadius: 8, border: `1px solid ${BRAND.blue2}55`, background: `${BRAND.blue2}14`, color: "#93C5FD", cursor: "pointer", fontSize: 12, fontWeight: 800 }}>📥 Importar</button>
              <button onClick={exportarBackup} style={{ padding: "8px 15px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${BRAND.green2}, #15803D)`, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 900 }}>📤 Backup</button>
              <input ref={refImport} type="file" accept=".json" style={{ display: "none" }} onChange={(e) => { if (e.target.files[0]) importarBackup(e.target.files[0]); e.target.value = ""; }} />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(2,1fr)", gap: 12, marginBottom: 18 }}>
            {[{ icon: "🏢", label: "Empresas", valor: empresas.length, cor: BRAND.blue }, { icon: "📄", label: "Orçamentos", valor: meta.totalOrcamentos || 0, cor: BRAND.green }, { icon: "💾", label: "Banco", valor: `${kbUsados()} KB`, cor: "#A78BFA" }, { icon: "🕐", label: "Última geração", valor: meta.ultimaGeracao ? new Date(meta.ultimaGeracao).toLocaleDateString("pt-BR") : "—", cor: BRAND.warn }].map((c) => (
              <div key={c.label} style={{ background: BRAND.panel, border: `1px solid ${c.cor}24`, borderRadius: 14, padding: "15px 17px", animation: "ofCardIn .28s ease both" }}><div style={{ fontSize: 22, marginBottom: 6 }}>{c.icon}</div><div style={{ fontSize: 22, fontWeight: 900, color: c.cor, marginBottom: 2 }}>{c.valor}</div><div style={{ fontSize: 11, color: BRAND.dim }}>{c.label}</div></div>
            ))}
          </div>
          {usuarioAtual?.tipo === "admin" && (
            <div style={{ background: "rgba(127,29,29,.16)", border: `1px solid ${BRAND.danger}55`, borderRadius: 14, padding: 16, marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <div>
                  <div style={{ color: "#FCA5A5", fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>Zerar base comercial</div>
                  <div style={{ color: BRAND.muted, fontSize: 12, lineHeight: 1.55, marginTop: 5, maxWidth: 650 }}>
                    Limpa clientes, orcamentos, agenda, historicos comerciais, WhatsApp, Nara e contadores. Mantem empresas, usuarios, acessos e configuracoes essenciais.
                  </div>
                </div>
                <button
                  onClick={limparBaseComercialMantendoEmpresas}
                  style={{ padding: "9px 16px", borderRadius: 10, border: `1px solid ${BRAND.danger}88`, background: `${BRAND.danger}20`, color: "#FCA5A5", cursor: "pointer", fontSize: 12, fontWeight: 900 }}
                >
                  Limpar clientes e orcamentos
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {view === "empresas" && (
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 16px", maxWidth: 1060, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <div><div style={{ fontSize: 18, fontWeight: 900 }}>🏢 Empresas</div><div style={{ fontSize: 12, color: BRAND.dim, marginTop: 3 }}>{empresas.length} cadastrada{empresas.length !== 1 ? "s" : ""}</div></div>
            <button onClick={() => setModal(empVazio())} style={{ padding: "9px 19px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BRAND.green2}, #15803D)`, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 900, boxShadow: `0 8px 22px ${BRAND.green2}35` }}>+ Nova Empresa</button>
          </div>

          {empresas.length === 0 ? (
            <div style={{ textAlign: "center", padding: "70px 16px" }}><div style={{ fontSize: 44, marginBottom: 12, opacity: 0.25 }}>🏢</div><div style={{ fontSize: 15, fontWeight: 800, color: BRAND.dim, marginBottom: 18 }}>Cadastre a primeira empresa para começar</div><button onClick={() => setModal(empVazio())} style={{ padding: "10px 24px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${BRAND.green2}, #15803D)`, color: "#fff", cursor: "pointer", fontSize: 13, fontWeight: 900 }}>Cadastrar empresa</button></div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 14 }}>
              {empresas.map((emp) => (
                <div key={emp.id} style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, overflow: "hidden", transition: "all .22s ease", animation: "ofCardIn .28s ease both" }} onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-3px)")} onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}>
                  <div style={{ height: 66, position: "relative", overflow: "hidden", background: emp.papelTimbrado ? "transparent" : `linear-gradient(135deg, ${emp.corPrimaria || BRAND.green2}, ${emp.corSecundaria || BRAND.blue2})` }}>{emp.papelTimbrado && <img src={emp.papelTimbrado} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} alt="" />}{emp.logo ? <img src={emp.logo} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", maxHeight: 36, maxWidth: 90, objectFit: "contain" }} alt="" /> : !emp.papelTimbrado && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", padding: "0 14px" }}><span style={{ fontFamily: emp.fonteTitulo, fontSize: 15, fontWeight: 900, color: "#fff" }}>{emp.nome}</span></div>}</div>
                  <div style={{ padding: "13px 15px" }}><div style={{ fontSize: 14, fontWeight: 850, color: BRAND.text, marginBottom: 3 }}>{emp.nome}</div><div style={{ fontSize: 10.5, color: BRAND.dim, marginBottom: 10 }}>{emp.cnpj || "—"} · {emp.email || "—"}</div><div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 11 }}><span style={{ padding: "3px 8px", background: `${emp.corPrimaria || BRAND.green2}20`, color: emp.corPrimaria || BRAND.green2, borderRadius: 10, fontSize: 9, fontWeight: 800 }}>{emp.tom}</span>{(emp.dnaLinguagem || "").length > 50 && <span style={{ padding: "3px 8px", background: `${BRAND.green2}14`, color: BRAND.green, borderRadius: 10, fontSize: 9, fontWeight: 700 }}>✍️ DNA</span>}{emp.papelTimbrado && <span style={{ padding: "3px 8px", background: `${BRAND.green2}14`, color: BRAND.green, borderRadius: 10, fontSize: 9, fontWeight: 700 }}>📄 Timbrado</span>}</div><div style={{ display: "flex", gap: 7 }}><button onClick={() => setModal({ ...emp })} style={{ flex: 1, padding: "7px", borderRadius: 8, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 11.5, fontWeight: 800 }}>✏ Editar</button><button onClick={() => setConfirmar(emp)} style={{ padding: "7px 11px", borderRadius: 8, border: `1px solid ${BRAND.danger}40`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontSize: 11.5 }}>🗑</button></div></div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === "orcamento" && (
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
          <div style={{ width: 262, background: "rgba(10,20,32,.94)", borderRight: `1px solid ${BRAND.border}`, display: "flex", flexDirection: "column", flexShrink: 0 }}>
            <div style={{ padding: "12px 13px 8px", borderBottom: `1px solid ${BRAND.border}` }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2 }}>SELECIONAR EMPRESAS</div><div style={{ fontSize: 10, color: BRAND.dim, marginTop: 2 }}>Até {MAX} · valor individual</div></div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px" }}>
              {empresas.length === 0 ? <div style={{ padding: "22px 8px", textAlign: "center" }}><div style={{ fontSize: 26, opacity: 0.2, marginBottom: 8 }}>🏢</div><div style={{ fontSize: 11, color: BRAND.dim, lineHeight: 1.6, marginBottom: 11 }}>Nenhuma empresa cadastrada</div><button onClick={() => setView("empresas")} style={{ padding: "6px 13px", borderRadius: 7, border: `1px solid ${BRAND.green2}55`, background: "transparent", color: BRAND.green, cursor: "pointer", fontSize: 11, fontWeight: 850 }}>Cadastrar →</button></div> : empresas.map((emp) => {
                const s = selecao.find((x) => x.empId === emp.id);
                const isSel = !!s;
                const bloq = !isSel && selecao.length >= MAX;
                const ord = selecao.findIndex((x) => x.empId === emp.id) + 1;
                return (
                  <div key={emp.id} style={{ marginBottom: 8, borderRadius: 11, overflow: "hidden", border: `2px solid ${isSel ? emp.corPrimaria || BRAND.green2 : BRAND.border2}`, opacity: bloq ? 0.4 : 1, transition: "all .22s ease" }}>
                    <div onClick={() => !bloq && toggleSel(emp.id)} style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 10px", background: isSel ? `${emp.corPrimaria || BRAND.green2}18` : BRAND.panel2, cursor: bloq ? "not-allowed" : "pointer" }}>
                      <div style={{ width: 28, height: 28, borderRadius: 8, background: emp.corPrimaria || BRAND.green2, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", flexShrink: 0 }}>{emp.logo ? <img src={emp.logo} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" /> : <span style={{ color: "#fff", fontSize: 9, fontWeight: 900 }}>{emp.nome.slice(0, 2).toUpperCase()}</span>}</div>
                      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 12, fontWeight: 800, color: BRAND.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{emp.nome}</div><div style={{ fontSize: 9.5, color: BRAND.dim }}>{emp.tom}</div></div>
                      <div style={{ width: 18, height: 18, borderRadius: "50%", border: `2px solid ${isSel ? emp.corPrimaria || BRAND.green2 : BRAND.dim}`, background: isSel ? emp.corPrimaria || BRAND.green2 : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 8.5, color: "#fff", fontWeight: 900 }}>{isSel ? ord : ""}</div>
                    </div>
                    {isSel && <div style={{ padding: "8px 10px", background: `${emp.corPrimaria || BRAND.green2}0c`, borderTop: `1px solid ${emp.corPrimaria || BRAND.green2}22` }}><div style={{ fontSize: 8, fontWeight: 900, color: emp.corPrimaria || BRAND.green2, letterSpacing: 1.3, marginBottom: 5 }}>VALOR GLOBAL (R$)</div><input type="number" value={s.valorGlobal} onChange={(e) => setValor(emp.id, e.target.value)} placeholder="0,00" style={{ width: "100%", background: BRAND.bg, border: `1px solid ${emp.corPrimaria || BRAND.green2}55`, borderRadius: 6, padding: "6px 8px", color: BRAND.text, fontSize: 13, fontWeight: 900, outline: "none", boxSizing: "border-box" }} />{s.valorGlobal && parseFloat(s.valorGlobal) > 0 && <div style={{ fontSize: 10.5, color: emp.corPrimaria || BRAND.green2, marginTop: 4, fontWeight: 800 }}>→ {brl(s.valorGlobal)}</div>}</div>}
                  </div>
                );
              })}
            </div>
            <div style={{ padding: "10px 9px", borderTop: `1px solid ${BRAND.border}` }}>
              {step === "montagem" && <button onClick={handleGerar} disabled={!canGerar || gerando} style={{ width: "100%", padding: "11px 7px", borderRadius: 10, border: "none", cursor: !canGerar || gerando ? "not-allowed" : "pointer", background: canGerar && !gerando ? `linear-gradient(135deg, ${BRAND.green2}, #15803D)` : BRAND.border2, color: canGerar && !gerando ? "#fff" : BRAND.dim, fontSize: 12, fontWeight: 900, boxShadow: canGerar && !gerando ? `0 8px 22px ${BRAND.green2}35` : "none" }}>{gerando ? `⚙ ${iaStatus}` : `✨ Gerar ${selecao.length > 0 ? selecao.length : ""} Orçamento${selecao.length !== 1 ? "s" : ""}`}</button>}
              {step === "preview" && <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><button onClick={() => setStep("exportacao")} style={{ width: "100%", padding: "10px", borderRadius: 10, border: "none", cursor: "pointer", background: `linear-gradient(135deg, ${BRAND.green2}, #15803D)`, color: "#fff", fontSize: 12, fontWeight: 900 }}>✅ Aprovar e Exportar</button><button onClick={() => { setStep("montagem"); setOrcamentos({}); setActiveTab(null); setEditando(false); }} style={{ width: "100%", padding: "7px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, cursor: "pointer", fontSize: 11 }}>← Voltar</button></div>}
            </div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
            {step === "montagem" && <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}>{erroGeracao && <div style={{ background: `${BRAND.danger}12`, border: `1px solid ${BRAND.danger}88`, borderRadius: 12, padding: "11px 13px", color: "#FCA5A5", fontSize: 12, fontWeight: 800, lineHeight: 1.55, whiteSpace: "normal" }}>Falha ao gerar: {erroGeracao}</div>}<div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 10 }}>📋 DADOS DO ORÇAMENTO</div><div style={{ fontSize: 9, color: BRAND.dim, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>CLIENTE / EMPRESA DESTINATÁRIA *</div><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex: Grupo Industrial Martins S.A." style={INP} /></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 6 }}>✍️ DESCRIÇÃO DO SERVIÇO *</div><div style={{ fontSize: 11, color: BRAND.dim, marginBottom: 10, lineHeight: 1.6 }}>Descreva o serviço com detalhes para montar o orçamento.</div><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder="Descreva o serviço completo aqui..." style={{ ...INP, resize: "vertical", minHeight: 160, lineHeight: 1.75 }} />
                <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
                  <input
                    ref={refAudio}
                    type="file"
                    accept=".ogg,.opus,.mp3,.wav,.m4a,.mp4,.webm,audio/*,video/mp4,video/webm"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      anexarAudioTranscrever(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => refAudio.current?.click()}
                    disabled={transcrevendo}
                    style={{
                      padding: "8px 13px",
                      borderRadius: 9,
                      border: `1px solid ${BRAND.blue2}55`,
                      background: transcrevendo ? BRAND.border2 : `${BRAND.blue2}18`,
                      color: transcrevendo ? BRAND.dim : "#93C5FD",
                      cursor: transcrevendo ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 850,
                    }}
                  >
                    {transcrevendo ? "Transcrevendo áudio..." : "📎 Anexar áudio/vídeo"}
                  </button>
                  <input
                    ref={refAnexoServico}
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,application/pdf,image/png,image/jpeg,image/webp"
                    style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      anexarDocumentoServico(file);
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => refAnexoServico.current?.click()}
                    disabled={lendoAnexoServico}
                    style={{
                      padding: "8px 13px",
                      borderRadius: 9,
                      border: `1px solid ${BRAND.green2}55`,
                      background: lendoAnexoServico ? BRAND.border2 : `${BRAND.green2}16`,
                      color: lendoAnexoServico ? BRAND.dim : "#86EFAC",
                      cursor: lendoAnexoServico ? "not-allowed" : "pointer",
                      fontSize: 12,
                      fontWeight: 850,
                    }}
                  >
                    {lendoAnexoServico ? "Lendo PDF/imagem..." : "Anexar PDF/imagem"}
                  </button>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 10, color: texto.length > 60 ? BRAND.green : BRAND.dim }}>{texto.length > 60 ? "✓ Suficiente para análise" : "⚠ Adicione mais detalhes"}</span><span style={{ fontSize: 10, color: BRAND.dim }}>{texto.length} chars</span></div></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.dim, letterSpacing: 2, marginBottom: 8 }}>📌 OBSERVAÇÕES OPCIONAIS</div><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Condições especiais, restrições ou observações complementares..." style={{ ...INP, resize: "vertical" }} /></div></div>}

            {step === "preview" && <div style={{ padding: "16px 18px" }}><div style={{ display: "flex", gap: 6, marginBottom: 13, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{empsSel.map((emp) => <button key={emp.id} onClick={() => setActiveTab(emp.id)} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `2px solid ${activeTab === emp.id ? emp.corPrimaria || BRAND.green2 : BRAND.border2}`, background: activeTab === emp.id ? `${emp.corPrimaria || BRAND.green2}1e` : BRAND.panel, color: activeTab === emp.id ? "#fff" : BRAND.dim }}>{emp.nome}</button>)}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => activeTab && baixarPDF(activeTab)} style={{ padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 900, border: `1px solid ${BRAND.green2}66`, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", boxShadow: `0 8px 22px ${BRAND.green2}28` }}>⬇ Baixar PDF</button>
              <button onClick={() => setEditando((v) => !v)} style={{ padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `1px solid ${editando ? BRAND.warn : BRAND.border2}`, background: editando ? `${BRAND.warn}14` : "transparent", color: editando ? "#FBBF24" : BRAND.dim }}>{editando ? "✏ Editando" : "✏ Editar"}</button>
            </div></div>{activeTab && orcamentos[activeTab] && (() => { const emp = empresas.find((e) => e.id === activeTab); return emp ? <OrcamentoDoc emp={emp} dados={orcamentos[activeTab]} editando={editando} onChange={(c, v) => fieldChange(activeTab, c, v)} /> : null; })()}</div>}

            {step === "exportacao" && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px" }}><div style={{ width: "100%", maxWidth: 540, textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 10 }}>✅</div><div style={{ fontSize: 19, fontWeight: 900, marginBottom: 5 }}>Propostas Aprovadas!</div><div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 20 }}>{empsSel.length} proposta{empsSel.length !== 1 ? "s" : ""} pronta{empsSel.length !== 1 ? "s" : ""}</div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, padding: 16, marginBottom: 15 }}>{empsSel.map((emp) => <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "10px 12px", background: BRAND.panel2, borderRadius: 10, border: `1px solid ${emp.corPrimaria || BRAND.green2}20`, marginBottom: 8 }}><div style={{ textAlign: "left", minWidth: 0 }}><div title={tituloCardExportacao(emp)} style={{ fontSize: 13, fontWeight: 850, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 330 }}>{tituloCardExportacao(emp)}</div><div style={{ fontSize: 10, color: BRAND.dim }}>{detalheCardExportacao(emp)}</div></div><button onClick={() => baixarPDF(emp.id)} style={{ padding: "6px 12px", borderRadius: 14, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, border: `1px solid ${BRAND.green2}66`, fontSize: 11, color: "#fff", fontWeight: 900, cursor: "pointer", whiteSpace: "nowrap" }}>Baixar PDF</button></div>)}</div><button onClick={baixarTodosPDF} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${BRAND.green2}66`, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 900, marginBottom: 9 }}>⬇ Baixar todos os PDFs</button><button onClick={resetOrcamento} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, cursor: "pointer", fontSize: 12 }}>← Criar nova proposta</button></div></div>}
          </div>
        </div>
      )}

      {modal && <ModalEmpresa empresa={modal} onSave={handleSalvar} onCancel={() => setModal(null)} salvando={salvando} pushToast={pushToast} />}

      {anexarOpen && (
        <ModalAnexarOrcamento
          empresas={empresas}
          usuarioAtual={usuarioAtual}
          onSave={salvarOrcamentoAnexado}
          onCancel={() => setAnexarOpen(false)}
          pushToast={pushToast}
        />
      )}

      {confirmar && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.danger}55`, borderRadius: 15, padding: "25px 27px", maxWidth: 390, width: "100%", textAlign: "center" }}><div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div><div style={{ fontSize: 15, fontWeight: 900, color: BRAND.danger, marginBottom: 7 }}>Excluir empresa?</div><div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 21 }}>"{confirmar.nome}"</div><div style={{ display: "flex", gap: 10, justifyContent: "center" }}><button onClick={() => setConfirmar(null)} style={{ padding: "9px 19px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 12.5, fontWeight: 800 }}>Cancelar</button><button onClick={handleExcluir} style={{ padding: "9px 19px", borderRadius: 9, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 900 }}>Excluir</button></div></div></div>}

      {logOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, width: "100%", maxWidth: 620, maxHeight: "78vh", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ padding: "14px 18px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 14, fontWeight: 900 }}>📋 Log de Auditoria</div><button onClick={() => setLogOpen(false)} style={{ background: "transparent", border: `1px solid ${BRAND.border2}`, color: BRAND.muted, width: 28, height: 28, borderRadius: 7, cursor: "pointer" }}>✕</button></div><div style={{ overflowY: "auto", padding: "13px 18px", flex: 1 }}>{logData.length === 0 ? <div style={{ textAlign: "center", color: BRAND.dim, padding: 24, fontSize: 13 }}>Nenhuma operação registrada</div> : logData.map((log, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: i % 2 === 0 ? BRAND.panel2 : "transparent", borderRadius: 8, marginBottom: 3 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: { INSERT: BRAND.green2, UPDATE: BRAND.blue2, DELETE: "#DC2626", IMPORT: "#7C3AED" }[log.acao] || BRAND.dim }} /><span style={{ width: 60, fontSize: 9.5, fontWeight: 900, color: BRAND.muted, letterSpacing: 1 }}>{log.acao}</span><span style={{ flex: 1, fontSize: 12, color: BRAND.muted }}>{log.nome}</span><span style={{ fontSize: 9.5, color: BRAND.dim, fontFamily: "monospace" }}>{tsFmt(log.ts)}</span></div>)}</div></div></div>}
    </div>
  );
}
