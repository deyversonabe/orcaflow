import React, { useCallback, useEffect, useRef, useState } from "react";

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

const store = {
  async get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  async set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error("Erro no localStorage:", error);
      return false;
    }
  },
};

async function logOp(acao, nome, id) {
  try {
    const logs = (await store.get(KEY_LOG)) || [];
    logs.unshift({ acao, nome, id, ts: new Date().toISOString() });
    await store.set(KEY_LOG, logs.slice(0, 120));
  } catch {}
}

const uid = () => `emp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
const orcNum = () => `ORC-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 9000) + 1000)}`;
const brl = (v) => (parseFloat(v) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
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
  { id: "Georgia", label: "Georgia", cat: "Serif" },
  { id: "Palatino Linotype", label: "Palatino", cat: "Serif" },
  { id: "Times New Roman", label: "Times New Roman", cat: "Serif" },
  { id: "Trebuchet MS", label: "Trebuchet MS", cat: "Sans" },
  { id: "Verdana", label: "Verdana", cat: "Sans" },
  { id: "Tahoma", label: "Tahoma", cat: "Sans" },
  { id: "Century Gothic", label: "Century Gothic", cat: "Sans" },
  { id: "Courier New", label: "Courier New", cat: "Mono" },
];
const T_TITULO = [18, 20, 22, 24, 26, 28, 32, 36];
const T_CORPO = [10, 11, 12, 13, 14, 15, 16];

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
    altoCabecalho: 120,
    altoRodape: 60,
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
  const pdfjsLib = await import(/* @vite-ignore */ "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  let texto = "";
  for (let i = 1; i <= pdf.numPages; i += 1) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += content.items.map((item) => item.str).join("\n") + "\n";
  }
  return texto;
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
      const logs = (await store.get(KEY_LOG)) || [];
      const m = (await store.get(KEY_META)) || {};
      const blob = new Blob(
        [JSON.stringify({ geradoEm: new Date().toISOString(), versao: "2.0", meta: m, empresas: empresasRef.current, log: logs }, null, 2)],
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
        if (!Array.isArray(parsed.empresas)) throw new Error("Arquivo inválido");
        const ok = await store.set(KEY_EMP, parsed.empresas);
        if (ok) {
          setEmpresas(parsed.empresas);
          await logOp("IMPORT", `${parsed.empresas.length} empresas`, "batch");
          pushToast(`✓ ${parsed.empresas.length} empresa(s) importada(s)`, "ok");
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
        gap: 10,
        background: "transparent",
        border: 0,
        color: BRAND.text,
        cursor: "pointer",
        padding: 0,
        transition: "all .25s ease",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-1px)")}
      onMouseLeave={(e) => (e.currentTarget.style.transform = "none")}
    >
      <span
        style={{
          width: 34,
          height: 34,
          borderRadius: 12,
          background: `linear-gradient(135deg, ${BRAND.green}, ${BRAND.blue2})`,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: `0 0 22px ${BRAND.green2}44`,
          transform: "rotate(45deg)",
          flexShrink: 0,
        }}
      >
        <span style={{ transform: "rotate(-45deg)", fontWeight: 900, fontSize: 15 }}>📄</span>
      </span>
      <span style={{ display: "flex", alignItems: "baseline", gap: 2 }}>
        <span style={{ color: "#fff", fontSize: 19, fontWeight: 950, letterSpacing: "-.8px" }}>Orça</span>
        <span style={{ color: BRAND.green, fontSize: 19, fontWeight: 950, letterSpacing: "-.8px" }}>Flow</span>
        <span style={{ color: BRAND.blue, fontSize: 10, fontWeight: 800, marginLeft: 3 }}>AI</span>
      </span>
    </button>
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
      const dados = extrairDadosCartaoCNPJ(texto);
      setForm((prev) => {
        const next = { ...prev };
        const put = (campo, valor) => {
          if (valor && !String(next[campo] || "").trim()) next[campo] = valor;
        };
        put("nome", dados.nome);
        put("nomeFantasia", dados.nomeFantasia);
        put("cnpj", dados.cnpj);
        put("email", dados.email);
        put("telefone", dados.telefone);
        put("site", dados.site);
        put("endereco", dados.endereco);
        if (!next.assinatura && (dados.nome || prev.nome)) next.assinatura = `Departamento Comercial · ${dados.nome || prev.nome}`;
        if (!next.rodape) {
          const parts = [dados.nome || prev.nome, dados.cnpj, dados.email, dados.telefone].filter(Boolean);
          next.rodape = parts.join(" | ");
        }
        return next;
      });
      pushToast("Dados do Cartão CNPJ importados com sucesso. Confira antes de salvar.", "ok");
    } catch (error) {
      console.error(error);
      pushToast("Não foi possível ler o PDF. Se for escaneado como imagem, será necessário OCR.", "erro");
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
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
    transition: "all .22s ease",
  };
  const TXT = { ...INP, resize: "vertical", lineHeight: 1.65 };

  const Lbl = ({ c, err }) => (
    <div style={{ fontSize: 10, fontWeight: 800, color: err ? BRAND.danger : "#6B7A90", letterSpacing: 1.15, marginBottom: 6 }}>
      {c}
      {err && ` — ${err}`}
    </div>
  );
  const Sec = ({ t, children, action }) => (
    <div style={{ marginBottom: 21 }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 10,
          fontSize: 10,
          fontWeight: 900,
          color: BRAND.green,
          letterSpacing: 2,
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
  const Row = ({ children }) => <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>{children}</div>;

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
                    {importandoCNPJ ? "Lendo PDF…" : "📎 Anexar Cartão CNPJ"}
                  </button>
                }
              >
                <input ref={refCNPJ} type="file" accept="application/pdf,.pdf" style={{ display: "none" }} onChange={importarCartao} />
                <div style={{ padding: "12px 14px", background: `${BRAND.blue2}12`, border: `1px solid ${BRAND.blue2}2a`, borderRadius: 10, color: "#A7C7FF", fontSize: 12.2, lineHeight: 1.6 }}>
                  Envie o PDF oficial do Cartão CNPJ. O sistema tenta preencher razão social, CNPJ, telefone, e-mail e endereço automaticamente. PDFs escaneados como imagem precisam de OCR.
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
                          <div style={{ fontSize: 10, color: BRAND.dim, marginTop: 2 }}>PNG · JPG · A4 · max 2 MB</div>
                        </>
                      )}
                    </div>
                    <input ref={refPapel} type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => uploadImagem("papelTimbrado", "papelTimbradoNome", e)} />
                    {form.papelTimbrado && (
                      <>
                        <button onClick={() => { set("papelTimbrado", null); set("papelTimbradoNome", ""); }} style={{ marginTop: 7, width: "100%", padding: "6px", borderRadius: 8, border: `1px solid ${BRAND.danger}55`, background: "transparent", color: BRAND.danger, cursor: "pointer", fontSize: 11 }}>Remover timbrado</button>
                        <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                          <div>
                            <Lbl c={`CABEÇALHO: ${form.altoCabecalho}px`} />
                            <input type="range" min={60} max={240} value={form.altoCabecalho} onChange={(e) => set("altoCabecalho", Number(e.target.value))} style={{ width: "100%", accentColor: BRAND.green }} />
                          </div>
                          <div>
                            <Lbl c={`RODAPÉ: ${form.altoRodape}px`} />
                            <input type="range" min={30} max={140} value={form.altoRodape} onChange={(e) => set("altoRodape", Number(e.target.value))} style={{ width: "100%", accentColor: BRAND.green }} />
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

function OrcamentoDoc({ emp, dados, editando, onChange }) {
  const hoje = new Date().toLocaleDateString("pt-BR");
  const validade = new Date(Date.now() + 30 * 86400000).toLocaleDateString("pt-BR");
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
      color: emp.corTexto || "#0F172A",
      background: emp.corFundo || "#fff",
      outline: "none",
      lineHeight: 1.75,
      boxSizing: "border-box",
    };
    if (!editando) return <span style={{ fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: emp.corTexto || "#0F172A" }}>{val}</span>;
    return multiline ? <textarea value={val} rows={3} onChange={(e) => onChange(campo, e.target.value)} style={{ ...base, resize: "vertical", minHeight: 58 }} /> : <input value={val} onChange={(e) => onChange(campo, e.target.value)} style={base} />;
  };

  const secLbl = { fontSize: 9, fontWeight: 900, color: emp.corPrimaria || BRAND.green2, letterSpacing: 2.2, fontFamily: "sans-serif", marginBottom: 7, display: "block" };

  return (
    <div style={{ background: emp.corFundo || "#fff", border: "1px solid #E2E8F0", borderRadius: 14, overflow: "hidden", boxShadow: "0 10px 44px rgba(0,0,0,.2)", animation: "ofCardIn .28s ease both" }}>
      {emp.papelTimbrado ? (
        <div style={{ position: "relative", minHeight: emp.altoCabecalho || 120, overflow: "hidden" }}>
          <img src={emp.papelTimbrado} style={{ width: "100%", height: emp.altoCabecalho || 120, objectFit: "cover", objectPosition: "top", display: "block" }} alt="" />
          <div style={{ position: "absolute", top: 10, right: 18, background: "rgba(0,0,0,.58)", backdropFilter: "blur(4px)", borderRadius: 9, padding: "8px 13px", textAlign: "right" }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.72)", letterSpacing: 1.5 }}>PROPOSTA COMERCIAL</div>
            <div style={{ fontSize: 13, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.65)" }}>{hoje} · válido até {validade}</div>
          </div>
        </div>
      ) : (
        <div style={{ background: `linear-gradient(135deg, ${emp.corPrimaria || BRAND.green2}, ${emp.corSecundaria || BRAND.blue2})`, padding: "22px 28px", minHeight: emp.altoCabecalho || 120, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {emp.logo ? <img src={emp.logo} style={{ maxHeight: 48, maxWidth: 150, objectFit: "contain", display: "block", marginBottom: 6 }} alt="" /> : <div style={{ fontFamily: emp.fonteTitulo, fontSize: Number(emp.tamanhoTitulo) || 24, fontWeight: 900, color: "#fff", marginBottom: 4 }}>{emp.nome}</div>}
            {emp.assinatura && <div style={{ fontSize: 10.5, color: "rgba(255,255,255,.78)", fontFamily: "sans-serif" }}>{emp.assinatura}</div>}
          </div>
          <div style={{ textAlign: "right", background: "rgba(0,0,0,.18)", borderRadius: 10, padding: "11px 16px" }}>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.65)", letterSpacing: 1.5 }}>PROPOSTA COMERCIAL</div>
            <div style={{ fontSize: 15, fontWeight: 900, color: "#fff", fontFamily: "monospace" }}>{dados.numero}</div>
            <div style={{ fontSize: 8, color: "rgba(255,255,255,.6)" }}>Emitido: {hoje} · Válido: {validade}</div>
          </div>
        </div>
      )}

      <div style={{ padding: "25px 30px" }}>
        <div style={{ marginBottom: 18, padding: "12px 15px", background: `${emp.corPrimaria || BRAND.green2}14`, borderRadius: 9, borderLeft: `4px solid ${emp.corPrimaria || BRAND.green2}` }}>
          <span style={secLbl}>DESTINATÁRIO</span>
          <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) + 1, fontWeight: 800, color: emp.corTexto || "#0F172A" }}><F campo="cliente" /></div>
        </div>

        <div style={{ marginBottom: 18 }}><span style={secLbl}>APRESENTAÇÃO</span><div style={{ lineHeight: 1.85 }}><F campo="intro" multiline /></div></div>
        <div style={{ marginBottom: 18 }}><span style={secLbl}>ESCOPO DO SERVIÇO</span><div style={{ lineHeight: 1.85 }}><F campo="escopo" multiline /></div></div>

        {dados.itensIA?.length > 0 && (
          <div style={{ marginBottom: 18 }}>
            <span style={secLbl}>ITENS INCLUÍDOS</span>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: emp.corPrimaria || BRAND.green2 }}><th style={{ padding: "9px 13px", color: "#fff", textAlign: "left", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900 }}>DESCRIÇÃO DA ETAPA / ITEM</th><th style={{ padding: "9px 13px", color: "#fff", textAlign: "center", fontFamily: "sans-serif", fontSize: 8, letterSpacing: 1.5, fontWeight: 900, width: 86 }}>STATUS</th></tr></thead>
              <tbody>
                {dados.itensIA.map((it, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? `${emp.corPrimaria || BRAND.green2}0a` : emp.corFundo || "#fff", borderBottom: `1px solid ${emp.corPrimaria || BRAND.green2}18` }}>
                    <td style={{ padding: "10px 13px", fontFamily: emp.fonteCorpo, fontSize: Number(emp.tamanhoCorpo) || 12, color: emp.corTexto || "#0F172A" }}>{it}</td>
                    <td style={{ padding: "10px 13px", textAlign: "center" }}><span style={{ padding: "3px 9px", borderRadius: 12, background: `${emp.corPrimaria || BRAND.green2}18`, color: emp.corSecundaria || BRAND.blue2, fontSize: 8.5, fontWeight: 800 }}>Incluído</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div style={{ marginBottom: 18, display: "flex", justifyContent: "flex-end" }}>
          <div style={{ background: `linear-gradient(135deg, ${emp.corPrimaria || BRAND.green2}, ${emp.corSecundaria || BRAND.blue2})`, borderRadius: 11, padding: "15px 23px", color: "#fff", textAlign: "right", minWidth: 210 }}>
            <div style={{ fontSize: 8, opacity: 0.82, letterSpacing: 2, marginBottom: 4 }}>VALOR GLOBAL DO SERVIÇO</div>
            <div style={{ fontFamily: emp.fonteTitulo, fontSize: Math.round((Number(emp.tamanhoTitulo) || 24) * 0.82), fontWeight: 950 }}>{brl(dados.valorGlobal)}</div>
          </div>
        </div>

        {difs.length > 0 && <div style={{ marginBottom: 18 }}><span style={secLbl}>DIFERENCIAIS</span><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{difs.map((d, i) => <span key={i} style={{ padding: "5px 12px", background: `${emp.corPrimaria || BRAND.green2}12`, border: `1px solid ${emp.corPrimaria || BRAND.green2}30`, borderRadius: 20, fontSize: 10, color: emp.corSecundaria || BRAND.blue2, fontWeight: 800 }}>{d}</span>)}</div></div>}

        <div style={{ marginBottom: 22, padding: "13px 15px", borderRadius: 9, background: `${emp.corPrimaria || BRAND.green2}0a`, borderLeft: `4px solid ${emp.corPrimaria || BRAND.green2}` }}><div style={{ lineHeight: 1.85, fontStyle: "italic" }}><F campo="fechamento" multiline /></div></div>

        <div style={{ borderTop: `2px solid ${emp.corPrimaria || BRAND.green2}`, paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div>
            <div style={{ width: 170, borderBottom: `1px solid ${emp.corPrimaria || BRAND.green2}44`, marginBottom: 7 }} />
            <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) - 1, fontWeight: 800, color: emp.corTexto || "#0F172A" }}>{emp.assinatura || emp.nome}</div>
            <div style={{ fontFamily: emp.fonteCorpo, fontSize: (Number(emp.tamanhoCorpo) || 12) - 2, color: "#64748B" }}>Data: {hoje}</div>
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

export default function App() {
  const { empresas, status, meta, toast, salvarEmpresa, excluirEmpresa, exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast } = useDB();
  const [view, setView] = useState("orcamento");
  const [modal, setModal] = useState(null);
  const [salvando, setSalvando] = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [logData, setLogData] = useState([]);
  const [logOpen, setLogOpen] = useState(false);
  const refImport = useRef(null);

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
  const MAX = 3;

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
    setView("orcamento");
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

  const handleGerar = async () => {
    if (!canGerar || gerando) return;
    setGerando(true);
    setIaStatus("Montando orçamentos…");
    const itens = gerarItens(texto);
    const novos = {};
    for (const s of selecao) {
      const e = empresas.find((x) => x.id === s.empId);
      novos[s.empId] = {
        numero: orcNum(),
        valorGlobal: s.valorGlobal,
        itensIA: itens,
        campos: {
          cliente,
          intro: `Apresentamos a presente proposta comercial para ${cliente}, elaborada conforme as informações fornecidas e alinhada ao perfil ${e?.tom || "profissional"} da empresa ${e?.nome || "selecionada"}.`,
          escopo: texto,
          fechamento: obs || "Permanecemos à disposição para eventuais esclarecimentos e alinhamentos necessários para continuidade do processo.",
        },
      };
    }
    await incOrcamentos(selecao.length);
    setOrcamentos(novos);
    setActiveTab(selecao[0].empId);
    setGerando(false);
    setIaStatus("");
    setStep("preview");
  };

  const fieldChange = (empId, campo, val) => setOrcamentos((prev) => ({ ...prev, [empId]: { ...prev[empId], campos: { ...prev[empId].campos, [campo]: val } } }));

  const INP = { background: BRAND.panel2, border: `1px solid ${BRAND.border2}`, borderRadius: 10, padding: "11px 14px", color: BRAND.text, fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box", lineHeight: 1.6, fontFamily: "inherit", transition: "all .22s ease" };
  const corDB = { ok: BRAND.green, erro: BRAND.danger, carregando: BRAND.warn };

  return (
    <div style={{ minHeight: "100vh", background: `radial-gradient(circle at 0% 0%, ${BRAND.green2}12, transparent 28%), radial-gradient(circle at 100% 5%, ${BRAND.blue2}12, transparent 28%), ${BRAND.bg}`, color: BRAND.text, fontFamily: "'Segoe UI', system-ui, sans-serif", display: "flex", flexDirection: "column" }}>
      <style>{`
        @keyframes ofModalIn { from { opacity: 0; transform: translateY(14px) scale(.985); } to { opacity: 1; transform: translateY(0) scale(1); } }
        @keyframes ofCardIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        button:hover { filter: brightness(1.08); }
        input:focus, textarea:focus, select:focus { border-color: ${BRAND.green2} !important; box-shadow: 0 0 0 3px ${BRAND.green2}18; }
      `}</style>
      <Toast toast={toast} />

      <div style={{ background: "rgba(10,20,32,.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${BRAND.border}`, padding: "0 16px", height: 58, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <OrcaFlowLogo onClick={resetInicio} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "3px 9px", borderRadius: 20, background: status === "ok" ? `${BRAND.green2}14` : BRAND.border2, border: `1px solid ${status === "ok" ? `${BRAND.green2}33` : BRAND.border2}` }}>
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: corDB[status] || BRAND.warn }} />
            <span style={{ fontSize: 10, color: corDB[status] || BRAND.warn, fontWeight: 850 }}>{status === "carregando" ? "DB…" : status === "ok" ? `${empresas.length} emp.` : "ERRO"}</span>
          </div>
        </div>

        <div style={{ display: "flex", gap: 3, background: BRAND.bg, borderRadius: 10, padding: 4, border: `1px solid ${BRAND.border2}` }}>
          {[["orcamento", "✦ Orçamento"], ["empresas", "🏢 Empresas"], ["banco", "🗄 Banco"]].map(([v, l]) => (
            <button key={v} onClick={() => setView(v)} style={{ padding: "7px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 850, background: view === v ? `linear-gradient(135deg, ${BRAND.green2}, #15803D)` : "transparent", color: view === v ? "#fff" : BRAND.dim, transition: "all .22s ease" }}>{l}</button>
          ))}
        </div>
      </div>

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
            {step === "montagem" && <div style={{ padding: 18, display: "flex", flexDirection: "column", gap: 14, maxWidth: 820 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 10 }}>📋 DADOS DO ORÇAMENTO</div><div style={{ fontSize: 9, color: BRAND.dim, fontWeight: 800, letterSpacing: 1, marginBottom: 6 }}>CLIENTE / EMPRESA DESTINATÁRIA *</div><input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Ex: Grupo Industrial Martins S.A." style={INP} /></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "15px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.green, letterSpacing: 2, marginBottom: 6 }}>✍️ DESCRIÇÃO DO SERVIÇO *</div><div style={{ fontSize: 11, color: BRAND.dim, marginBottom: 10, lineHeight: 1.6 }}>Descreva o serviço com detalhes para montar o orçamento.</div><textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={8} placeholder="Descreva o serviço completo aqui..." style={{ ...INP, resize: "vertical", minHeight: 160, lineHeight: 1.75 }} /><div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span style={{ fontSize: 10, color: texto.length > 60 ? BRAND.green : BRAND.dim }}>{texto.length > 60 ? "✓ Suficiente para análise" : "⚠ Adicione mais detalhes"}</span><span style={{ fontSize: 10, color: BRAND.dim }}>{texto.length} chars</span></div></div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 14, padding: "14px 17px" }}><div style={{ fontSize: 9, fontWeight: 900, color: BRAND.dim, letterSpacing: 2, marginBottom: 8 }}>📌 OBSERVAÇÕES OPCIONAIS</div><textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={2} placeholder="Prazos, condições especiais, restrições..." style={{ ...INP, resize: "vertical" }} /></div></div>}

            {step === "preview" && <div style={{ padding: "16px 18px" }}><div style={{ display: "flex", gap: 6, marginBottom: 13, flexWrap: "wrap", alignItems: "center", justifyContent: "space-between" }}><div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{empsSel.map((emp) => <button key={emp.id} onClick={() => setActiveTab(emp.id)} style={{ padding: "7px 14px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `2px solid ${activeTab === emp.id ? emp.corPrimaria || BRAND.green2 : BRAND.border2}`, background: activeTab === emp.id ? `${emp.corPrimaria || BRAND.green2}1e` : BRAND.panel, color: activeTab === emp.id ? "#fff" : BRAND.dim }}>{emp.nome}</button>)}</div><button onClick={() => setEditando((v) => !v)} style={{ padding: "7px 13px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 850, border: `1px solid ${editando ? BRAND.warn : BRAND.border2}`, background: editando ? `${BRAND.warn}14` : "transparent", color: editando ? "#FBBF24" : BRAND.dim }}>{editando ? "✏ Editando" : "✏ Editar"}</button></div>{activeTab && orcamentos[activeTab] && (() => { const emp = empresas.find((e) => e.id === activeTab); return emp ? <OrcamentoDoc emp={emp} dados={orcamentos[activeTab]} editando={editando} onChange={(c, v) => fieldChange(activeTab, c, v)} /> : null; })()}</div>}

            {step === "exportacao" && <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "28px 16px" }}><div style={{ width: "100%", maxWidth: 540, textAlign: "center" }}><div style={{ fontSize: 48, marginBottom: 10 }}>✅</div><div style={{ fontSize: 19, fontWeight: 900, marginBottom: 5 }}>Orçamentos Aprovados!</div><div style={{ fontSize: 12, color: BRAND.dim, marginBottom: 20 }}>{empsSel.length} proposta{empsSel.length !== 1 ? "s" : ""} pronta{empsSel.length !== 1 ? "s" : ""}</div><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, padding: 16, marginBottom: 15 }}>{empsSel.map((emp) => <div key={emp.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: BRAND.panel2, borderRadius: 10, border: `1px solid ${emp.corPrimaria || BRAND.green2}20`, marginBottom: 8 }}><div style={{ textAlign: "left" }}><div style={{ fontSize: 13, fontWeight: 850 }}>{emp.nome}</div><div style={{ fontSize: 10, color: BRAND.dim }}>{orcamentos[emp.id]?.numero}{orcamentos[emp.id]?.valorGlobal ? ` · ${brl(orcamentos[emp.id].valorGlobal)}` : ""}</div></div><span style={{ padding: "4px 10px", borderRadius: 14, background: `${BRAND.green2}18`, border: `1px solid ${BRAND.green2}33`, fontSize: 10, color: BRAND.green, fontWeight: 850 }}>Pronto</span></div>)}</div><button onClick={resetOrcamento} style={{ width: "100%", padding: 10, borderRadius: 10, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.dim, cursor: "pointer", fontSize: 12 }}>← Criar novo orçamento</button></div></div>}
          </div>
        </div>
      )}

      {modal && <ModalEmpresa empresa={modal} onSave={handleSalvar} onCancel={() => setModal(null)} salvando={salvando} pushToast={pushToast} />}

      {confirmar && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.danger}55`, borderRadius: 15, padding: "25px 27px", maxWidth: 390, width: "100%", textAlign: "center" }}><div style={{ fontSize: 34, marginBottom: 10 }}>⚠️</div><div style={{ fontSize: 15, fontWeight: 900, color: BRAND.danger, marginBottom: 7 }}>Excluir empresa?</div><div style={{ fontSize: 13.5, fontWeight: 800, marginBottom: 21 }}>"{confirmar.nome}"</div><div style={{ display: "flex", gap: 10, justifyContent: "center" }}><button onClick={() => setConfirmar(null)} style={{ padding: "9px 19px", borderRadius: 9, border: `1px solid ${BRAND.border2}`, background: "transparent", color: BRAND.muted, cursor: "pointer", fontSize: 12.5, fontWeight: 800 }}>Cancelar</button><button onClick={handleExcluir} style={{ padding: "9px 19px", borderRadius: 9, border: "none", background: "#DC2626", color: "#fff", cursor: "pointer", fontSize: 12.5, fontWeight: 900 }}>Excluir</button></div></div></div>}

      {logOpen && <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.9)", zIndex: 3000, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}><div style={{ background: BRAND.panel, border: `1px solid ${BRAND.border}`, borderRadius: 15, width: "100%", maxWidth: 620, maxHeight: "78vh", overflow: "hidden", display: "flex", flexDirection: "column" }}><div style={{ padding: "14px 18px", borderBottom: `1px solid ${BRAND.border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ fontSize: 14, fontWeight: 900 }}>📋 Log de Auditoria</div><button onClick={() => setLogOpen(false)} style={{ background: "transparent", border: `1px solid ${BRAND.border2}`, color: BRAND.muted, width: 28, height: 28, borderRadius: 7, cursor: "pointer" }}>✕</button></div><div style={{ overflowY: "auto", padding: "13px 18px", flex: 1 }}>{logData.length === 0 ? <div style={{ textAlign: "center", color: BRAND.dim, padding: 24, fontSize: 13 }}>Nenhuma operação registrada</div> : logData.map((log, i) => <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 11px", background: i % 2 === 0 ? BRAND.panel2 : "transparent", borderRadius: 8, marginBottom: 3 }}><span style={{ width: 7, height: 7, borderRadius: "50%", background: { INSERT: BRAND.green2, UPDATE: BRAND.blue2, DELETE: "#DC2626", IMPORT: "#7C3AED" }[log.acao] || BRAND.dim }} /><span style={{ width: 60, fontSize: 9.5, fontWeight: 900, color: BRAND.muted, letterSpacing: 1 }}>{log.acao}</span><span style={{ flex: 1, fontSize: 12, color: BRAND.muted }}>{log.nome}</span><span style={{ fontSize: 9.5, color: BRAND.dim, fontFamily: "monospace" }}>{tsFmt(log.ts)}</span></div>)}</div></div></div>}
    </div>
  );
}
