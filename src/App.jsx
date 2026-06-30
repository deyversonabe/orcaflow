import React, { useCallback, useEffect, useRef, useState } from "react";
import { authHeaders, supabase } from "./supabase.js";
import { store } from "./store.js";

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
const KEY_USERS = "orcaflow_users";
const KEY_RESET = "orcaflow_reset_senha";
const KEY_CHAT = "orcaflow_chat_ia";
const BACKUP_KEYS = [KEY_EMP, KEY_CRM, KEY_META, KEY_LOG, KEY_USERS, KEY_RESET, KEY_CHAT];

const ADMIN_PADRAO = {
  id: "admin-master",
  nome: "admin",
  tipo: "admin",
  perfil: "Administrador",
  ativo: true,
  criadoEm: new Date().toISOString(),
};

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
  const pendentes = lista.filter((o) => o.status !== "Finalizado");
  if (!pendentes.length) return "Não há orçamentos pendentes no momento.";
  const linhas = pendentes.map((o, i) => {
    const emp = empresas.find((e) => e.id === o.empresaId)?.nome || o.empresaNome || "Empresa";
    const dt = o.proximoContato ? ` | próximo contato: ${new Date(o.proximoContato + "T00:00:00").toLocaleDateString("pt-BR")}` : "";
    return `${i + 1}. ${o.cliente || "Cliente"} — ${emp} — ${o.numero || "sem número"} — ${brl(o.valorGlobal)} — ${o.status}${dt}`;
  });
  return `Relatório de orçamentos pendentes\n\n${linhas.join("\n")}\n\nOrçaFlow CRM`;
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

function getDocTitle(dados) {
  return clean(dados?.identidadeDocumento?.tituloDocumento || "PROPOSTA COMERCIAL");
}

function getSectionLabel(dados, key) {
  return clean(dados?.identidadeDocumento?.rotulos?.[key] || SECTION_FALLBACK_LABELS[key] || key).toUpperCase();
}

function getSectionOrder(dados) {
  const received = Array.isArray(dados?.identidadeDocumento?.ordemSecoes)
    ? dados.identidadeDocumento.ordemSecoes
    : [];
  const allowed = new Set(DEFAULT_SECTION_ORDER);
  const ordered = received.map((item) => clean(item)).filter((item) => allowed.has(item));
  for (const item of DEFAULT_SECTION_ORDER) {
    if (!ordered.includes(item)) ordered.push(item);
  }
  return ordered;
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

async function lerTextoPDF(file) {
  const buffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;

  let texto = "";

  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((item) => item.str).join("\n") + "\n";
  }

  return texto;
}

async function pdfParaImagemCartaoCNPJ(file) {
  const buffer = await file.arrayBuffer();
  const pdfjsLib = await getPdfJs();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const page = await pdf.getPage(1);

  const base = page.getViewport({ scale: 1 });
  const maiorLado = Math.max(base.width, base.height);
  const escala = Math.max(1.4, Math.min(2.4, 1700 / maiorLado));
  const viewport = page.getViewport({ scale: escala });

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  canvas.width = Math.floor(viewport.width);
  canvas.height = Math.floor(viewport.height);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  await page.render({ canvasContext: ctx, viewport }).promise;
  return canvas.toDataURL("image/jpeg", 0.88);
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

  return {
    imagem: canvas.toDataURL("image/png", 1),
    larguraPt,
    alturaPt,
    altoCabecalho: zonas.altoCabecalho,
    altoRodape: zonas.altoRodape,
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
          resolve({ imagem: dataUrl, larguraPt, alturaPt, altoCabecalho: zonas.altoCabecalho, altoRodape: zonas.altoRodape });
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
            texto = await lerTextoPDF(file);
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
      const [lista, m] = await Promise.all([store.get(KEY_EMP), store.get(KEY_META)]);
      setEmpresas(lista || []);
      setMeta(m || { totalOrcamentos: 0 });
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
      const dados = {};
      await Promise.all(
        BACKUP_KEYS.map(async (key) => {
          dados[key] = (await store.get(key)) || (key === KEY_META ? {} : []);
        })
      );
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

        const payload = {
          [KEY_EMP]: empresasImport,
          [KEY_CRM]: Array.isArray(crmImport) ? crmImport : [],
          [KEY_META]: metaImport && typeof metaImport === "object" ? metaImport : { totalOrcamentos: 0 },
          [KEY_LOG]: Array.isArray(logImport) ? logImport : [],
          [KEY_USERS]: Array.isArray(usersImport) ? usersImport : [],
          [KEY_RESET]: Array.isArray(resetImport) ? resetImport : [],
          [KEY_CHAT]: Array.isArray(chatImport) ? chatImport : [],
        };

        const results = await Promise.all(BACKUP_KEYS.map((key) => store.set(key, payload[key])));
        if (results.every(Boolean)) {
          setEmpresas(payload[KEY_EMP]);
          setMeta(payload[KEY_META]);
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

  return { empresas, status, meta, toast, salvarEmpresa, excluirEmpresa, exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast };
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
        whiteSpace: "nowrap",
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

      pushToast(
        `Timbrado anexado. Cabeçalho ~${resultado.altoCabecalho}pt e rodapé ~${resultado.altoRodape}pt detectados.`,
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
      const texto = await lerTextoPDF(file);
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
        if (!next.assinatura && (dados.nome || prev.nome)) next.assinatura = `Departamento Comercial · ${dados.nome || prev.nome}`;
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

function MateriaisTabela({ emp, dados }) {
  const rows = materialRows(dados);
  if (!rows.length) return null;

  const total = materialTotal(rows);
  const precificacao = dados?.precificacao || {};
  const cor = emp.corPrimaria || BRAND.green2;

  return (
    <div style={{ marginTop: 10, overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr style={{ background: cor }}>
            {["ITEM", "QTD", "UN", "ORIGINAL", "ACRESC.", "UNITARIO", "SUBTOTAL"].map((h, i) => (
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
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{parseValorBR(item.valorOriginal) > 0 ? brl(item.valorOriginal) : "-"}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{parseValorBR(item.acrescimoPercentual) ? `${Number(item.acrescimoPercentual).toFixed(2)}%` : "-"}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11 }}>{brl(item.valorUnitario)}</td>
              <td style={{ padding: "9px 10px", textAlign: "right", color: "#000", fontSize: 11, fontWeight: 850 }}>{brl(item.subtotal)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={5} style={{ padding: "10px", textAlign: "right", color: "#000", fontSize: 10, fontWeight: 850 }}>
              {precificacao.criterio ? `Criterio: ${precificacao.criterio.replace(/_/g, " ")}` : "Total da tabela"}
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

  const F = ({ campo, multiline }) => {
    const val = dados.campos?.[campo] || "";
    const base = {
      width: "100%",
      border: `1.5px dashed ${emp.corPrimaria || BRAND.green2}`,
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
  const docTitle = getDocTitle(dados).toUpperCase();

  const renderItens = () => {
    if (!dados.itensIA?.length) return null;
    return (
      <div key="itens" style={{ marginBottom: 18 }}>
        <span style={secLbl}>{getSectionLabel(dados, "itens")}</span>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead><tr style={{ background: emp.corPrimaria || BRAND.green2 }}><th style={{ padding: "9px 13px", color: "#fff", textAlign: "left", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900 }}>DESCRICAO DA ETAPA / ITEM</th><th style={{ padding: "9px 13px", color: "#fff", textAlign: "center", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900, width: 86 }}>STATUS</th></tr></thead>
          <tbody>
            {dados.itensIA.map((it, i) => (
              <tr key={i} style={{ background: i % 2 === 0 ? `${emp.corPrimaria || BRAND.green2}0a` : emp.corFundo || "#fff", borderBottom: `1px solid ${emp.corPrimaria || BRAND.green2}18` }}>
                <td style={{ padding: "10px 13px", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: "#000000" }}>{it}</td>
                <td style={{ padding: "10px 13px", textAlign: "center" }}><span style={{ padding: "3px 9px", borderRadius: 12, background: `${emp.corPrimaria || BRAND.green2}18`, color: emp.corSecundaria || BRAND.blue2, fontSize: 8.5, fontWeight: 800 }}>Incluido</span></td>
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
          <MateriaisTabela emp={emp} dados={dados} />
        </div>
      );
    }

    const val = dados.campos?.[key] || "";
    const required = key === "intro" || key === "escopo";
    if (!required && !val && !editando) return null;

    const content = <div style={{ lineHeight: 1.85 }}><F campo={key} multiline /></div>;
    if (key === "fechamento") {
      return (
        <div key={key} style={{ marginBottom: 22, padding: "13px 15px", borderRadius: 9, background: `${emp.corPrimaria || BRAND.green2}0a`, borderLeft: `4px solid ${emp.corPrimaria || BRAND.green2}` }}>
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
          <div style={{ position: "absolute", top: 10, right: 18, background: "rgba(0,0,0,.58)", backdropFilter: "blur(4px)", borderRadius: 9, padding: "8px 13px", textAlign: "right" }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.72)", letterSpacing: 1.5 }}>{docTitle}</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            
          </div>
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${emp.corPrimaria || BRAND.green2}, ${emp.corSecundaria || BRAND.blue2})`, padding: "22px 28px", minHeight: emp.altoCabecalho || 120, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {emp.logo ? <img src={emp.logo} style={{ maxHeight: 48, maxWidth: 150, objectFit: "contain", display: "block", marginBottom: 6 }} alt="" /> : <div style={{ fontFamily: emp.fonteTitulo, fontSize: Number(emp.tamanhoTitulo) || 24, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{emp.nome}</div>}
            {emp.assinatura && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.78)", fontFamily: "sans-serif" }}>{emp.assinatura}</div>}
          </div>
          <div style={{ textAlign: "right", background: "rgba(0,0,0,.18)", borderRadius: 10, padding: "11px 16px" }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.65)", letterSpacing: 1.5 }}>{docTitle}</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            
          </div>
        </div>
      )}

      <div style={{ padding: "25px 30px" }}>
        <div style={{ marginBottom: 18, padding: "12px 15px", background: `${emp.corPrimaria || BRAND.green2}14`, borderRadius: 9, borderLeft: `4px solid ${emp.corPrimaria || BRAND.green2}` }}>
          <span style={secLbl}>DESTINATÁRIO</span>
          <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) + 1, fontWeight: 800, color: "#000000" }}><F campo="cliente" /></div>
        </div>

        {dados.identidadeDocumento?.subtitulo && (
          <div style={{ marginBottom: 18, color: "#475569", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, fontStyle: "italic" }}>
            {dados.identidadeDocumento.subtitulo}
          </div>
        )}

        {getSectionOrder(dados).map(renderSection)}

        <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: `linear-gradient(135deg, ${emp.corPrimaria || BRAND.green2}, ${emp.corSecundaria || BRAND.blue2})`, borderRadius: 11, padding: "15px 23px", color: "#fff", textAlign: "right", minWidth: 210 }}>
            <div style={{ fontSize: 8, opacity: 0.82, letterSpacing: 2, marginBottom: 4 }}>VALOR GLOBAL DO SERVIÇO</div>
            <div style={{ fontFamily: emp.fonteTitulo, fontSize: Math.round((Number(emp.tamanhoTitulo) || 24) * 0.82), fontWeight: 950 }}>{brl(dados.valorGlobal)}</div>
          </div>
        </div>

        {difs.length > 0 && <div style={{ marginBottom: 18 }}><span style={secLbl}>DIFERENCIAIS</span><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{difs.map((d, i) => <span key={i} style={{ padding: "5px 12px", background: `${emp.corPrimaria || BRAND.green2}12`, border: `1px solid ${emp.corPrimaria || BRAND.green2}30`, borderRadius: 20, fontSize: 10, color: emp.corSecundaria || BRAND.blue2, fontWeight: 800 }}>{d}</span>)}</div></div>}

        <div style={{ borderTop: `2px solid ${emp.corPrimaria || BRAND.green2}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ width: 170, borderBottom: `1px solid ${emp.corPrimaria || BRAND.green2}44`, marginBottom: 7 }} />
            <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) - 1, fontWeight: 800, color: "#000000" }}>{emp.assinatura || emp.nome}</div>
            
          </div>
          {emp.logo && <img src={emp.logo} style={{ maxHeight: 36, maxWidth: 110, objectFit: "contain", opacity: 0.18 }} alt="" />}
        </div>
      </div>

      <div style={{ background: emp.papelTimbrado ? `${emp.corPrimaria || BRAND.green2}14` : "#0F172A", borderTop: `1px solid ${emp.corPrimaria || BRAND.green2}22`, padding: "9px 28px", textAlign: "center" }}>
        <div style={{ fontFamily: emp.fonteCorpo, fontSize: 9.5, color: emp.papelTimbrado ? "#475569" : "#94A3B8" }}>{emp.rodape || `${emp.nome}${emp.cnpj ? ` | ${emp.cnpj}` : ""}${emp.email ? ` | ${emp.email}` : ""}${emp.telefone ? ` | ${emp.telefone}` : ""}`}</div>
      </div>
    </div>
  );
}
function textoCurto(valor, limite = 900) {
  return clean(valor || "").slice(0, limite);
}

function contextoCompactoChat(empresas = [], crm = []) {
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
  };
}

function ChatIAPanel({ empresas = [], crm = [], pushToast }) {
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
          context: contextoCompactoChat(empresas, crm),
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
          <div style={{ fontSize: 18, fontWeight: 950, color: BRAND.text }}>Chat IA Comercial</div>
          <div style={{ fontSize: 12, color: BRAND.dim, marginTop: 3 }}>E-mails, cobrancas, respostas, follow-up e apoio para orcamentos.</div>
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
              <div style={{ fontSize: 15, fontWeight: 900, color: BRAND.muted, marginBottom: 6 }}>Pronto para escrever com voce</div>
              <div style={{ fontSize: 12, lineHeight: 1.6, maxWidth: 520 }}>Selecione um atalho ou digite diretamente o que precisa gerar.</div>
            </div>
          </div>
        )}
        {messages.map(bubble)}
        {loading && (
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 12 }}>
            <div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "12px 14px", color: BRAND.muted, fontSize: 13 }}>IA escrevendo...</div>
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
  const abertos = lista.filter((o) => o.status === "Aberto").length;
  const andamento = lista.filter((o) => o.status === "Andamento").length;
  const finalizados = lista.filter((o) => o.status === "Finalizado").length;
  const atrasados = lista.filter((o) => o.status !== "Finalizado" && diasAte(o.proximoContato) !== null && diasAte(o.proximoContato) < 0).length;
  const valorPotencial = lista.filter((o) => o.status !== "Finalizado").reduce((acc, o) => acc + (parseFloat(o.valorGlobal) || 0), 0);
  const totalValor = lista.reduce((acc, o) => acc + (parseFloat(o.valorGlobal) || 0), 0);
  const ticketMedio = lista.length ? totalValor / lista.length : 0;
  const conversao = lista.length ? Math.round((finalizados / lista.length) * 100) : 0;
  const proximos = lista.filter((o) => o.status !== "Finalizado" && o.proximoContato).sort((a,b) => String(a.proximoContato).localeCompare(String(b.proximoContato))).slice(0, 5);

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
        {kpi("Orçamentos gerados", meta.totalOrcamentos || lista.length, `${empresas.length} empresa(s) cadastrada(s)`, BRAND.blue, "📄")}
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
          <button onClick={() => setView("crm")} style={{ marginTop: 14, width: "100%", padding: "10px 14px", borderRadius: 12, border: `1px solid ${BRAND.blue2}66`, background: `${BRAND.blue2}18`, color: "#93C5FD", fontWeight: 900, cursor: "pointer" }}>Abrir CRM</button>
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
  const [usuario, setUsuario] = useState("");
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
      const result = criandoConta
        ? await supabase.auth.signUp({ email, password: senha })
        : await supabase.auth.signInWithPassword({ email, password: senha });
      if (result.error) throw result.error;
      if (criandoConta && !result.data.session) {
        pushToast("Conta criada. Confirme o e-mail antes de entrar.", "ok");
        setCriandoConta(false);
        return;
      }
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
            <input type="email" value={usuario} onChange={(e) => setUsuario(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="voce@empresa.com" style={{ width: "100%", boxSizing: "border-box", background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 13, padding: "13px 14px", color: BRAND.text, outline: "none" }} />
          </div>
          <div>
            <div style={{ fontSize: 10, color: BRAND.muted, fontWeight: 900, letterSpacing: 1.5, marginBottom: 6 }}>SENHA</div>
            <div style={{ display: "flex", background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 13, overflow: "hidden" }}>
              <input type={mostrar ? "text" : "password"} value={senha} onChange={(e) => setSenha(e.target.value)} onKeyDown={(e) => e.key === "Enter" && entrar()} placeholder="Digite sua senha" style={{ flex: 1, background: "transparent", border: 0, padding: "13px 14px", color: BRAND.text, outline: "none" }} />
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
    const alvo = `${o.cliente || ""} ${o.empresaNome || ""} ${o.numero || ""} ${o.status || ""}`.toLowerCase();
    const okBusca = !busca || alvo.includes(busca.toLowerCase());
    const okStatus = statusFiltro === "Todos" || o.status === statusFiltro;
    const okEmpresa = empresaFiltro === "Todas" || o.empresaId === empresaFiltro;
    return okBusca && okStatus && okEmpresa;
  });

  const totais = {
    aberto: visiveisPorUsuario.filter((o) => o.status === "Aberto").length,
    andamento: visiveisPorUsuario.filter((o) => o.status === "Andamento").length,
    finalizado: visiveisPorUsuario.filter((o) => o.status === "Finalizado").length,
    vencidos: visiveisPorUsuario.filter((o) => o.status !== "Finalizado" && diasAte(o.proximoContato) !== null && diasAte(o.proximoContato) < 0).length,
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
      if (o.status === "Finalizado") return o;
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
    const vencidosHoje = visiveisPorUsuario.filter((o) => o.status !== "Finalizado" && (!o.proximoContato || o.proximoContato <= hoje));
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
            <select value={o.status || "Aberto"} onChange={(e) => updateItem(o.id, "status", e.target.value)} style={{ background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, color: BRAND.text, borderRadius: 9, padding: 8, fontSize: 12 }}>
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
  if ((item?.status || "Aberto") === "Finalizado") {
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

  if ((item?.status || "Aberto") === "Aberto") {
    score += 14;
    motivos.push("em aberto");
  }
  if (item?.status === "Andamento") {
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

function GestaoPage({ crm = [], setCrm, empresas = [], meta = {}, pushToast, usuarioAtual, setView, abrirOrcamentoSalvo, baixarOrcamento, onAnexar }) {
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

  const isAdmin = usuarioAtual?.tipo === "admin";
  const base = isAdmin ? crm : crm.filter((o) => o.userId === usuarioAtual?.id);

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

  const statusColor = {
    Aberto: BRAND.blue,
    Andamento: BRAND.warn,
    Finalizado: BRAND.green,
    Atrasado: BRAND.danger,
  };

  const statusReal = (item) => {
    if (item.status !== "Finalizado" && diasAte(item.proximoContato) !== null && diasAte(item.proximoContato) < 0) {
      return "Atrasado";
    }
    return item.status || "Aberto";
  };

  const hojeISO = new Date().toISOString().slice(0, 10);

  const listaFiltrada = base.filter((o) => {
    const textoBusca = [
      o.cliente,
      o.empresaNome,
      o.empresa,
      o.numero,
      o.status,
      o.lembreteIA,
      o.lembrete,
      o.descricaoArquivo,
      o.arquivoNome,
      o.empresaNomeDetectada,
      o.dataDocumento,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const okBusca = !busca || textoBusca.includes(busca.toLowerCase());
    const okStatus = statusFiltro === "Todos" || (o.status || "Aberto") === statusFiltro;
    const okEmpresa = empresaFiltro === "Todas" || o.empresaId === empresaFiltro;
    const dias = diasAte(o.proximoContato);
    const okRapido =
      filtroRapido === "Todos" ||
      (filtroRapido === "Atrasados" && o.status !== "Finalizado" && dias !== null && dias < 0) ||
      (filtroRapido === "Hoje" && o.status !== "Finalizado" && (!o.proximoContato || o.proximoContato <= hojeISO)) ||
      (filtroRapido === "Sem contato" && o.status !== "Finalizado" && !o.proximoContato) ||
      (filtroRapido === "Em aberto" && o.status !== "Finalizado") ||
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
  const abertos = base.filter((o) => (o.status || "Aberto") === "Aberto").length;
  const andamento = base.filter((o) => o.status === "Andamento").length;
  const finalizados = base.filter((o) => o.status === "Finalizado").length;
  const atrasados = base.filter(
    (o) => o.status !== "Finalizado" && diasAte(o.proximoContato) !== null && diasAte(o.proximoContato) < 0
  ).length;

  const valorTotal = base.reduce((soma, item) => soma + parseValorBR(item.valorGlobal ?? item.valor), 0);
  const valorPotencial = base
    .filter((item) => item.status !== "Finalizado")
    .reduce((soma, item) => soma + parseValorBR(item.valorGlobal ?? item.valor), 0);
  const ticketMedio = total ? valorTotal / total : 0;
  const taxaConversao = total ? Math.round((finalizados / total) * 100) : 0;
  const precisamContato = abertos + andamento + atrasados;
  const filaFollowup = [...base]
    .filter((item) => (item.status || "Aberto") !== "Finalizado")
    .map((item) => ({ item, prioridade: avaliarPrioridadeOrcamento(item) }))
    .filter(({ prioridade }) => prioridade.score >= 30)
    .sort((a, b) => b.prioridade.score - a.prioridade.score)
    .slice(0, 6);

  const salvarCRM = (novaLista) => {
    setCrm(novaLista);
    store.set(KEY_CRM, novaLista);
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
      usuarioNome: usuarioAtual?.nome || "",
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
      usuarioNome: usuarioAtual?.nome || "",
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
      ? `Gere um e-mail profissional de follow-up para o orçamento abaixo. Entregue assunto e corpo.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${item.status || "Aberto"}\nPróximo contato: ${item.proximoContato || "não definido"}\nPrioridade: ${prioridade.nivel} (${prioridade.motivos.join(", ")})`
      : tipo === "whatsapp"
        ? `Gere uma mensagem curta de WhatsApp para acompanhar este orçamento.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${item.status || "Aberto"}\nPrioridade: ${prioridade.nivel}`
        : `Gere uma mensagem de cobrança/follow-up firme, educada e comercial para este orçamento ainda sem retorno.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNúmero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal)}\nStatus: ${item.status || "Aberto"}\nPróximo contato: ${item.proximoContato || "não definido"}\nMotivos de prioridade: ${prioridade.motivos.join(", ")}`;

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
      ? `Leia o historico comercial deste orcamento e gere a melhor resposta para o cliente. Seja claro, cordial, comercial e objetivo. Nao invente dados.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNumero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal ?? item.valor)}\nStatus: ${item.status || "Aberto"}\nUltima mensagem do cliente: ${ultimaCliente ? clean(ultimaCliente.mensagem || "", 1200) : "nao identificada"}\n\nHistorico:\n${linhaDoTempo}`
      : `Resuma o historico comercial deste orcamento para o vendedor. Entregue: 1) resumo em 3 linhas, 2) objeções ou pontos de atencao, 3) proxima acao recomendada, 4) sugestao de mensagem curta. Nao invente dados.\n\nCliente: ${item.cliente || ""}\nEmpresa proponente: ${item.empresaNome || emp?.nome || ""}\nNumero: ${item.numero || ""}\nValor: ${brl(item.valorGlobal ?? item.valor)}\nStatus: ${item.status || "Aberto"}\n\nHistorico:\n${linhaDoTempo}`;

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
          usuarioNome: usuarioAtual?.nome || "",
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
    const pendentes = crm.filter((o) => o.status !== "Finalizado");

    if (!pendentes.length) {
      pushToast("Nenhum orçamento pendente para gerar lembrete.", "aviso");
      return;
    }

    const atualizados = crm.map((item) => {
      if (item.status === "Finalizado") return item;

      const prazo = diasAte(item.proximoContato);
      let lembrete = `Entrar em contato com ${item.cliente || "cliente"} para acompanhar o orçamento ${item.numero || ""}.`;

      if (prazo !== null && prazo < 0) {
        lembrete = `Cobrança urgente: orçamento ${item.numero || ""} de ${item.cliente || "cliente"} está com contato atrasado.`;
      } else if (prazo === 0) {
        lembrete = `Entrar em contato hoje com ${item.cliente || "cliente"} sobre o orçamento ${item.numero || ""}.`;
      } else if (item.status === "Andamento") {
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

  const notificarPendentes = async () => {
    const hoje = new Date().toISOString().slice(0, 10);
    const pendentesHoje = base.filter((o) => o.status !== "Finalizado" && (!o.proximoContato || o.proximoContato <= hoje));

    if (!pendentesHoje.length) {
      pushToast("Não há cobranças pendentes para hoje.", "aviso");
      return;
    }

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

  const abrirWhats = () => {
    const numero = onlyDigits(whats);

    if (!numero || numero.length < 10) {
      pushToast("Informe o WhatsApp com DDD para enviar o relatório.", "erro");
      return;
    }

    const msg = gerarTextoWhatsPendencias(base, empresas);
    window.open(`https://wa.me/55${numero.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`, "_blank");
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

      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,minmax(150px,1fr))", gap: 14, marginBottom: 18 }}>
        <CardGestao titulo="Orçamentos gerados" valor={meta.totalOrcamentos || total} cor={BRAND.blue} icon={<FileText size={19} />} />
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
            const qtd = s === "Atrasado" ? atrasados : base.filter((i) => (i.status || "Aberto") === s).length;
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
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, minWidth: 1180 }}>
            <thead>
              <tr style={{ color: BRAND.muted, textAlign: "left" }}>
                <th style={th}>Cliente</th>
                <th style={th}>Empresa</th>
                <th style={th}>Valor</th>
                <th style={th}>Prioridade</th>
                <th style={th}>Status</th>
                <th style={th}>Próximo contato</th>
                <th style={th}>Lembrete IA</th>
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
                  return (
                    <React.Fragment key={item.id}>
                      <tr style={{ borderTop: `1px solid ${BRAND.border}` }}>
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
                            {item.cliente || "—"}
                          </button>

                          <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 3 }}>
                            {item.numero || "—"} · {tsFmt(item.criadoEm)}
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
                            value={item.status || "Aberto"}
                            onChange={(e) => updateItem(item.id, "status", e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: 999,
                              color: statusColor[item.status || "Aberto"] || BRAND.text,
                              border: `1px solid ${statusColor[item.status || "Aberto"] || BRAND.border}`,
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
                      </tr>

                      {historicoAberto === item.id && (
                        <tr>
                          <td colSpan="7" style={{ padding: "0 8px 14px", borderTop: `1px solid ${BRAND.border}` }}>
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
                  <td colSpan="7" style={{ padding: 28, textAlign: "center", color: BRAND.dim }}>
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
        <div style={{ fontSize: 14, fontWeight: 950, marginBottom: 6 }}>Relatório para WhatsApp</div>
        <div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 10 }}>
          O navegador não envia WhatsApp agendado sozinho. Este botão abre o WhatsApp com o relatório pronto. Para envio automático programado, será necessário backend com API oficial da Meta/WhatsApp.
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={whats} onChange={(e) => setWhats(e.target.value)} placeholder="DDD + número do WhatsApp do usuário" style={{ ...inputGestao, flex: 1 }} />
          <button onClick={abrirWhats} className="of-neon-btn" style={{ padding: "10px 16px", borderRadius: 12, cursor: "pointer" }}>
            Enviar relatório
          </button>
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

  useEffect(() => {
    (async () => setSolicitacoes((await store.get(KEY_RESET)) || []))();
  }, []);

  const carregarAcessos = useCallback(async () => {
    if (usuarioAtual?.tipo !== "admin") return;
    setCarregandoAcessos(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .order("requested_at", { ascending: false });

    if (error) {
      console.error("Erro ao carregar acessos:", error);
      pushToast("Não foi possível carregar os cadastros. Rode o schema.sql atualizado.", "erro");
    } else {
      setAcessos(Array.isArray(data) ? data : []);
    }
    setCarregandoAcessos(false);
  }, [pushToast, usuarioAtual?.tipo]);

  useEffect(() => {
    carregarAcessos();
  }, [carregarAcessos]);

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

  if (usuarioAtual?.tipo !== "admin") {
    return (
      <div style={{ padding: 24 }}>
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
  const { empresas, status, meta, toast, salvarEmpresa, excluirEmpresa, exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast } = useDB();
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
  const [usuarios, setUsuarios] = useState([]);
  const [usuarioAtual, setUsuarioAtual] = useState(null);
  const [acessoPerfil, setAcessoPerfil] = useState(null);

  useEffect(() => {
    const onBackupImported = (event) => {
      const detail = event.detail || {};
      if (Array.isArray(detail.crm)) setCrm(detail.crm);
    };
    window.addEventListener("orcaflow:backup-imported", onBackupImported);
    return () => window.removeEventListener("orcaflow:backup-imported", onBackupImported);
  }, []);

  useEffect(() => {
    const applyUser = async (user) => {
      if (!user) {
        setAutenticado(false);
        setUsuarioAtual(null);
        setAcessoPerfil(null);
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
        email: user.email,
        tipo: perfilAcesso?.role === "admin" ? "admin" : "usuario",
        perfil: perfilAcesso?.role === "admin" ? "Administrador" : "Usuário",
        ativo: true,
      });
      setAutenticado(true);
      await store.migrate([KEY_EMP, KEY_LOG, KEY_META, KEY_CRM, KEY_CHAT]);
      setCrm((await store.get(KEY_CRM)) || []);
    };

    supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user || null));
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user || null);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  const [cliente, setCliente] = useState("");
  const [texto, setTexto] = useState("");
  const [obs, setObs] = useState("");
  const [selecao, setSelecao] = useState([]);
  const [gerando, setGerando] = useState(false);
  const [iaStatus, setIaStatus] = useState("");
  const [orcamentos, setOrcamentos] = useState({});
  const [activeTab, setActiveTab] = useState(null);
  const [editando, setEditando] = useState(false);
  const [step, setStep] = useState("montagem");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const refAudio = useRef(null);
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

  const handleGerar = async () => {
    if (!canGerar || gerando) return;

    setGerando(true);
    setIaStatus("Gerando orçamentos com IA...");

    try {
      const response = await fetch("/api/generate-budget", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          cliente,
          texto,
          obs,
          empresas,
          selecao,
        }),
      });

      let data = {};

      try {
        data = await response.json();
      } catch {
        throw new Error("A IA retornou uma resposta inválida.");
      }

      if (!response.ok) {
        throw new Error(data.error || "Erro ao gerar orçamento com IA.");
      }

      const novos = {};

      for (const s of selecao) {
        const ed = data.empresas?.[s.empId] || {};

        novos[s.empId] = {
          numero: orcNum(),
          empresaId: s.empId,
          valorGlobal: s.valorGlobal || "",
          criadoEm: new Date().toISOString(),
          itensIA: Array.isArray(data.itens) ? data.itens : [],
          identidadeDocumento: ed.identidadeDocumento || {},
          materiaisTabela: Array.isArray(ed.materiaisTabela) ? ed.materiaisTabela : [],
          precificacao: ed.precificacao || {},
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
          valorGlobal: s.valorGlobal || "",
          status: "Aberto",
          proximoContato: "",
          lembreteIA: "",
          userId: usuarioAtual?.id || "admin",
          criadoEm: new Date().toISOString(),
          atualizadoEm: new Date().toISOString(),
          orcamentoCompleto: novos[s.empId],
        };
      });
      setCrm((prev) => {
        const atualizado = [...novosCRM, ...prev];
        store.set(KEY_CRM, atualizado);
        return atualizado;
      });


      if (selecao.length > 0) {
        setActiveTab(selecao[0].empId);
      }

      await incOrcamentos(selecao.length);

      pushToast("Orçamentos gerados com IA. Revise antes de exportar.", "ok");
      setStep("preview");
    } catch (error) {
      console.error("Erro ao gerar orçamento:", error);
      pushToast(error.message || "Erro ao gerar orçamento com IA.", "erro");
    } finally {
      setGerando(false);
      setIaStatus("");
    }
  };

  const fieldChange = (empId, campo, val) => setOrcamentos((prev) => ({ ...prev, [empId]: { ...prev[empId], campos: { ...prev[empId].campos, [campo]: val } } }));

  const baixarPDF = async (empId) => {
    const emp = empresas.find((e) => e.id === empId);
    const dados = orcamentos[empId];

    if (!emp || !dados) {
      pushToast("Orçamento não encontrado para exportação.", "erro");
      return;
    }

    try {
      const { jsPDF } = await import("jspdf");

      // Quando há timbrado, a PÁGINA do PDF é criada com as MESMAS dimensões
      // do arquivo enviado. Assim o timbrado entra inteiro (sem corte e sem
      // distorção) e o cabeçalho/rodapé dele nunca são cortados.
      const temTimbrado = Boolean(emp.papelTimbrado);
      const tW = Number(emp.timbradoLarguraPt) || 595.28;
      const tH = Number(emp.timbradoAlturaPt) || 841.89;
      const orientacao = temTimbrado && tW > tH ? "landscape" : "portrait";

      const pdf = temTimbrado
        ? new jsPDF({ orientation: orientacao, unit: "pt", format: [tW, tH] })
        : new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });

      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();

      const titleFont = mapPdfFont(emp.fonteTitulo);
      const bodyFont = mapPdfFont(emp.fonteCorpo);
      const titleSize = Number(emp.tamanhoTitulo) || 14;
      const bodySize = Number(emp.tamanhoCorpo) || 12;

      const marginX = 48;
      const maxW = pageW - marginX * 2;

      // Margens calculadas a partir das zonas detectadas do timbrado (em pt).
      // Uma folga extra garante que o corpo NUNCA sobreponha o cabeçalho/rodapé.
      const folgaTopo = 14;
      const folgaBase = 14;
      const topMargin = temTimbrado
        ? Math.max(Number(emp.altoCabecalho) || Math.round(pageH * 0.18), 40) + folgaTopo
        : 122;
      const bottomMargin = temTimbrado
        ? Math.max(Number(emp.altoRodape) || Math.round(pageH * 0.12), 24) + folgaBase
        : 64;
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

          pdf.setFont("helvetica", "bold");
          pdf.setFontSize(10);
          pdf.setTextColor(0, 0, 0);
          pdf.text(dados.numero || orcNum(), pageW - marginX, 52, {
            align: "right",
          });

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
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.setTextColor(0, 0, 0);
        pdf.text(String(titulo).toUpperCase(), marginX, y);
        y += 18;

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

        const [r, g, b] = hexToRgb(emp.corPrimaria || BRAND.green2);
        const widths = [180, 34, 30, 66, 48, 64, maxW - 422];
        const labels = ["ITEM", "QTD", "UN", "ORIGINAL", "ACRESC.", "UNIT.", "SUBTOTAL"];
        const aligns = ["left", "right", "right", "right", "right", "right", "right"];

        const drawText = (text, x, width, lineY, align = "left", size = 7.5) => {
          pdf.setFontSize(size);
          const lines = pdf.splitTextToSize(String(text || ""), width - 6);
          const tx = align === "right" ? x + width - 3 : x + 3;
          pdf.text(lines, tx, lineY, { align });
          return lines.length;
        };

        ensure(22);
        pdf.setFillColor(r, g, b);
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
          drawText(parseValorBR(item.valorOriginal) > 0 ? brl(item.valorOriginal) : "-", x, widths[3], y + 12, "right", 7.2); x += widths[3];
          drawText(parseValorBR(item.acrescimoPercentual) ? `${Number(item.acrescimoPercentual).toFixed(2)}%` : "-", x, widths[4], y + 12, "right", 7.2); x += widths[4];
          drawText(brl(item.valorUnitario), x, widths[5], y + 12, "right", 7.2); x += widths[5];
          pdf.setFont(bodyFont, "bold");
          drawText(brl(item.subtotal), x, widths[6], y + 12, "right", 7.2);

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

      addBase();

      pdf.setFont(titleFont, "bold");
      pdf.setFontSize(titleSize);
      pdf.setTextColor(0, 0, 0);
      pdf.text(pdf.splitTextToSize(getDocTitle(dados).toUpperCase(), maxW - 120), marginX, y);

      // Número da proposta sempre dentro da área segura (nunca sobre o timbrado).
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(10);
      pdf.setTextColor(0, 0, 0);
      pdf.text(dados.numero || orcNum(), pageW - marginX, y, { align: "right" });
      y += 28;

      writeSection("Destinatário", dados.campos?.cliente || cliente);
      if (dados.identidadeDocumento?.subtitulo) {
        writeSection("", dados.identidadeDocumento.subtitulo);
      }
      getSectionOrder(dados).forEach(writeOrderedSection);

      if (dados.valorGlobal) {
        ensure(72);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(11);
        pdf.setTextColor(0, 0, 0);
        pdf.text("VALOR GLOBAL", marginX, y);
        y += 20;
        pdf.setFont(titleFont, "bold");
        pdf.setFontSize(Math.max(16, Math.min(titleSize, 24)));
        pdf.setTextColor(0, 0, 0);
        pdf.text(brl(dados.valorGlobal), marginX, y);
        y += 28;
      }

      ensure(70);
      pdf.setDrawColor(0, 0, 0);
      pdf.setLineWidth(0.5);
      pdf.line(marginX, y + 10, marginX + 180, y + 10);
      y += 28;
      pdf.setFont(bodyFont, "bold");
      pdf.setFontSize(bodySize);
      pdf.setTextColor(0, 0, 0);
      pdf.text(emp.assinatura || emp.nome || "Responsável", marginX, y);

      const rodape = emp.rodape || `${emp.nome || ""}${emp.cnpj ? ` | ${emp.cnpj}` : ""}${emp.email ? ` | ${emp.email}` : ""}${emp.telefone ? ` | ${emp.telefone}` : ""}`;
      if (rodape && !emp.papelTimbrado) {
        pdf.setFont(bodyFont, "normal");
        pdf.setFontSize(8);
        pdf.setTextColor(0, 0, 0);
        pdf.text(pdf.splitTextToSize(rodape, pageW - 70), pageW / 2, pageH - 28, { align: "center" });
      }

      pdf.save(`${safeFileName(emp.nome)}-${safeFileName(dados.numero || "orcamento")}.pdf`);
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

    setView("orcamento");
    setStep("preview");
    setOrcamentos({
      [item.empresaId]: item.orcamentoCompleto,
    });
    setActiveTab(item.empresaId);
    setEditando(false);
    setSelecao([
      {
        empId: item.empresaId,
        valorGlobal: item.valorGlobal || item.orcamentoCompleto.valorGlobal || "",
      },
    ]);
    setCliente(item.cliente || item.orcamentoCompleto?.campos?.cliente || "");
    pushToast("Orçamento aberto para visualização e novo download.", "ok");
  };

  // Salva no CRM/Gestão um orçamento anexado externamente.
  const salvarOrcamentoAnexado = async (item, options = {}) => {
    setCrm((prev) => {
      const atualizado = [item, ...prev];
      store.set(KEY_CRM, atualizado);
      return atualizado;
    });
    await incOrcamentos(1);
    if (!options.keepOpen) setAnexarOpen(false);
    pushToast("Orçamento anexado e adicionado ao acompanhamento.", "ok");
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
            await supabase.auth.signOut();
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
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 0% 0%, ${BRAND.green2}12, transparent 28%), radial-gradient(circle at 100% 5%, ${BRAND.blue2}12, transparent 28%), ${BRAND.bg}`, color: BRAND.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
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

      <div style={{ position: "relative", zIndex: 2, background: "rgba(10,20,32,.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BRAND.border}`, padding: "0 16px", height: 84, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <OrcaFlowLogo onClick={resetInicio} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: status === "ok" ? `${BRAND.green2}14` : BRAND.border2, border: `1px solid ${status === "ok" ? `${BRAND.green2}33` : BRAND.border2}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: corDB[status] || BRAND.warn }} />
            <span style={{ fontSize: 10, color: corDB[status] || BRAND.warn, fontWeight: 850 }}>{status === "carregando" ? "DB…" : status === "ok" ? `${empresas.length} emp.` : "ERRO"}</span>
          </div>
          <div style={{ fontSize: 10, color: BRAND.muted, border: `1px solid ${BRAND.border2}`, borderRadius: 20, padding: "4px 9px" }}>
            {usuarioAtual?.tipo === "admin" ? "Admin" : "Usuário"}: {usuarioAtual?.nome || "—"}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ display: "flex", gap: 3, background: BRAND.bg, borderRadius: 10, padding: 4, border: `1px solid ${BRAND.border2}` }}>
            {[
              ["gestao", "📊 Gestão"],
              ["orcamento", "✦ Orçamento"],
              ["chat", "IA Chat"],
              ["empresas", "🏢 Empresas"],
              ...(usuarioAtual?.tipo === "admin" ? [["usuarios", "🔐 Acessos"]] : []),
              ["banco", "🗄 Banco"],
            ].map(([v, l]) => (
              <button key={v} onClick={() => setView(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 850, background: view === v ? `linear-gradient(135deg, ${BRAND.green2}, #15803D)` : "transparent", color: view === v ? "#fff" : BRAND.dim, transition: "all .22s ease" }}>{l}</button>
            ))}
          </div>
          <button onClick={async () => { await supabase.auth.signOut(); setAutenticado(false); setUsuarioAtual(null); setAcessoPerfil(null); }} title="Sair" style={{ padding: "8px 10px", borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontWeight: 900 }}>Sair</button>
        </div>
      </div>

      {view === "gestao" && (
        <GestaoPage
          crm={crm}
          setCrm={setCrm}
          empresas={empresas}
          meta={meta}
          pushToast={pushToast}
          usuarioAtual={usuarioAtual}
          setView={setView}
          abrirOrcamentoSalvo={abrirOrcamentoSalvo}
          baixarOrcamento={baixarOrcamento}
          onAnexar={() => setAnexarOpen(true)}
        />
      )}

      {view === "chat" && (
        <ChatIAPanel
          empresas={empresas}
          crm={crm}
          pushToast={pushToast}
        />
      )}

      {view === "usuarios" && (
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
            {step === "montagem" && <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 10 }}>📋 DADOS DO ORÇAMENTO</div><div style={{ fontSize: 9, color: BRAND.dim, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>CLIENTE / EMPRESA DESTINATÁRIA *</div><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex: Grupo Industrial Martins S.A." style={INP} /></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 6 }}>✍️ DESCRIÇÃO DO SERVIÇO *</div><div style={{ fontSize: 11, color: BRAND.dim, marginBottom: 10, lineHeight: 1.6 }}>Descreva o serviço com detalhes para montar o orçamento.</div><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder="Descreva o serviço completo aqui..." style={{ ...INP, resize: "vertical", minHeight: 160, lineHeight: 1.75 }} />
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
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 10, color: texto.length > 60 ? BRAND.green : BRAND.dim }}>{texto.length > 60 ? "✓ Suficiente para análise" : "⚠ Adicione mais detalhes"}</span><span style={{ fontSize: 10, color: BRAND.dim }}>{texto.length} chars</span></div></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.dim, letterSpacing: 2, marginBottom: 8 }}>📌 OBSERVAÇÕES OPCIONAIS</div><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Condições especiais, restrições ou observações complementares..." style={{ ...INP, resize: "vertical" }} /></div></div>}

            {step === "preview" && <div style={{ padding: "16px 18px" }}><div style={{ display: "flex", gap: 6, marginBottom: 13, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{empsSel.map((emp) => <button key={emp.id} onClick={() => setActiveTab(emp.id)} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `2px solid ${activeTab === emp.id ? emp.corPrimaria || BRAND.green2 : BRAND.border2}`, background: activeTab === emp.id ? `${emp.corPrimaria || BRAND.green2}1e` : BRAND.panel, color: activeTab === emp.id ? "#fff" : BRAND.dim }}>{emp.nome}</button>)}</div><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => activeTab && baixarPDF(activeTab)} style={{ padding: "8px 14px", borderRadius: 9, cursor: "pointer", fontSize: 12, fontWeight: 900, border: `1px solid ${BRAND.green2}66`, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", boxShadow: `0 8px 22px ${BRAND.green2}28` }}>⬇ Baixar PDF</button>
              <button onClick={() => setEditando((v) => !v)} style={{ padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `1px solid ${editando ? BRAND.warn : BRAND.border2}`, background: editando ? `${BRAND.warn}14` : "transparent", color: editando ? "#FBBF24" : BRAND.dim }}>{editando ? "✏ Editando" : "✏ Editar"}</button>
            </div></div>{activeTab && orcamentos[activeTab] && (() => { const emp = empresas.find((e) => e.id === activeTab); return emp ? <OrcamentoDoc emp={emp} dados={orcamentos[activeTab]} editando={editando} onChange={(c, v) => fieldChange(activeTab, c, v)} /> : null; })()}</div>}

            {step === "exportacao" && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px" }}><div style={{ width: "100%", maxWidth: 540, textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 10 }}>✅</div><div style={{ fontSize: 19, fontWeight: 900, marginBottom: 5 }}>Orçamentos Aprovados!</div><div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 20 }}>{empsSel.length} proposta{empsSel.length !== 1 ? "s" : ""} pronta{empsSel.length !== 1 ? "s" : ""}</div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, padding: 16, marginBottom: 15 }}>{empsSel.map((emp) => <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: BRAND.panel2, borderRadius: 10, border: `1px solid ${emp.corPrimaria || BRAND.green2}20`, marginBottom: 8 }}><div style={{ textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 850 }}>{emp.nome}</div><div style={{ fontSize: 10, color: BRAND.dim }}>{orcamentos[emp.id]?.numero}{orcamentos[emp.id]?.valorGlobal ? ` · ${brl(orcamentos[emp.id].valorGlobal)}` : ""}</div></div><button onClick={() => baixarPDF(emp.id)} style={{ padding: "6px 12px", borderRadius: 14, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, border: `1px solid ${BRAND.green2}66`, fontSize: 11, color: "#fff", fontWeight: 900, cursor: "pointer" }}>Baixar PDF</button></div>)}</div><button onClick={baixarTodosPDF} style={{ width: "100%", padding: 11, borderRadius: 10, border: `1px solid ${BRAND.green2}66`, background: `linear-gradient(135deg, ${BRAND.green2}, ${BRAND.blue2})`, color: "#fff", cursor: "pointer", fontSize: 12, fontWeight: 900, marginBottom: 9 }}>⬇ Baixar todos os PDFs</button><button onClick={resetOrcamento} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, cursor: "pointer", fontSize: 12 }}>← Criar novo orçamento</button></div></div>}
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
