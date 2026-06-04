import React from 'react';
import { useState, useRef, useEffect, useCallback } from "react";

// ─── STORAGE ──────────────────────────────────────────────────────────────────
const KEY_EMP  = "orcaflow_empresas";
const KEY_LOG  = "orcaflow_log";
const KEY_META = "orcaflow_meta";

const store = {
  async get(key) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : null;
    } catch { return null; }
  },
  async set(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
      return true;
    } catch(e) {
      console.error('Storage error:', e);
      return false;
    }
  },
};

async function logOp(acao, nome, id) {
  try {
    const logs = (await store.get(KEY_LOG)) || [];
    logs.unshift({ acao, nome, id, ts: new Date().toISOString() });
    await store.set(KEY_LOG, logs.slice(0, 100));
  } catch {}
}

// ─── CONSTANTES ───────────────────────────────────────────────────────────────
const FONTES = [
  { id: "Georgia",           label: "Georgia",         cat: "Serif" },
  { id: "Palatino Linotype", label: "Palatino",        cat: "Serif" },
  { id: "Times New Roman",   label: "Times New Roman", cat: "Serif" },
  { id: "Trebuchet MS",      label: "Trebuchet MS",    cat: "Sans"  },
  { id: "Verdana",           label: "Verdana",         cat: "Sans"  },
  { id: "Tahoma",            label: "Tahoma",          cat: "Sans"  },
  { id: "Century Gothic",    label: "Century Gothic",  cat: "Sans"  },
  { id: "Courier New",       label: "Courier New",     cat: "Mono"  },
];
const T_TITULO = [18, 20, 22, 24, 26, 28, 32, 36];
const T_CORPO  = [10, 11, 12, 13, 14, 15, 16];
const TONS = [
  "profissional", "técnico e preciso", "corporativo e elegante",
  "criativo e persuasivo", "direto e objetivo",
  "premium e sofisticado", "amigável e acessível",
];

// ─── HELPERS ──────────────────────────────────────────────────────────────────
const uid    = () => `emp_${Date.now()}_${Math.random().toString(36).slice(2,7)}`;
const orcNum = () => `ORC-${new Date().getFullYear()}-${String(Math.floor(Math.random()*9000)+1000)}`;
const brl    = (v) => (parseFloat(v)||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const tsFmt  = (iso) => { try { return iso ? new Date(iso).toLocaleString("pt-BR") : "—"; } catch { return "—"; } };
const sz     = (n, min=8) => Math.max(Number(n)||min, min);
const jus    = (pos) => pos==="centro"?"center":pos==="direita"?"flex-end":"flex-start";

const empVazio = () => ({
  id: uid(),
  criadaEm: new Date().toISOString(),
  atualizadaEm: new Date().toISOString(),
  // dados
  nome:"", cnpj:"", email:"", telefone:"", site:"", endereco:"",
  assinatura:"", rodape:"", diferenciais:"", tom:"profissional",
  // DNA de linguagem — novo campo
  dnaLinguagem:"",
  // visual
  corPrimaria:"#2563EB", corSecundaria:"#1E40AF", corTexto:"#0f172a", corFundo:"#ffffff",
  // tipografia
  fonteTitulo:"Georgia", tamanhoTitulo:24, fonteCorpo:"Trebuchet MS", tamanhoCorpo:12,
  // documento
  logo:null, logoNome:"", posicaoLogo:"esquerda",
  papelTimbrado:null, papelTimbradoNome:"",
  altoCabecalho:120, altoRodape:60,
});

// ─── HOOK: BANCO DE DADOS ─────────────────────────────────────────────────────
function useDB() {
  const [empresas, setEmpresas] = useState([]);
  const [status,   setStatus]   = useState("carregando");
  const [meta,     setMeta]     = useState({ totalOrcamentos:0 });
  const [toast,    setToast]    = useState(null);
  const timer       = useRef(null);
  const empresasRef = useRef([]);

  useEffect(() => { empresasRef.current = empresas; }, [empresas]);

  const pushToast = useCallback((msg, tipo="ok") => {
    clearTimeout(timer.current);
    setToast({ msg, tipo });
    timer.current = setTimeout(() => setToast(null), 3500);
  }, []);

  useEffect(() => {
    (async () => {
      const [lista, m] = await Promise.all([store.get(KEY_EMP), store.get(KEY_META)]);
      setEmpresas(lista || []);
      setMeta(m || { totalOrcamentos:0 });
      setStatus("ok");
    })();
  }, []);

  const salvarEmpresa = useCallback(async (form) => {
    const prev  = empresasRef.current;
    const existe = prev.find(e => e.id === form.id);
    const upd   = { ...form, atualizadaEm: new Date().toISOString(),
      criadaEm: existe ? (form.criadaEm || new Date().toISOString()) : new Date().toISOString() };
    const nova  = existe ? prev.map(e => e.id===form.id ? upd : e) : [...prev, upd];
    if (JSON.stringify(nova).length > 4_800_000) {
      pushToast("✗ Limite de 5 MB atingido. Reduza o tamanho das imagens.", "erro"); return false;
    }
    const ok = await store.set(KEY_EMP, nova);
    if (ok) { setEmpresas(nova); await logOp(existe?"UPDATE":"INSERT", upd.nome, upd.id);
      pushToast(existe ? `✓ "${upd.nome}" atualizada` : `✓ "${upd.nome}" cadastrada`, "ok"); }
    else pushToast("✗ Falha ao salvar no banco", "erro");
    return ok;
  }, [pushToast]);

  const excluirEmpresa = useCallback(async (id) => {
    const prev = empresasRef.current;
    const emp  = prev.find(e => e.id===id);
    const nova = prev.filter(e => e.id!==id);
    const ok   = await store.set(KEY_EMP, nova);
    if (ok) { setEmpresas(nova); await logOp("DELETE", emp?.nome||"?", id);
      pushToast(`🗑 "${emp?.nome}" removida`, "aviso"); }
    else pushToast("✗ Falha ao excluir", "erro");
  }, [pushToast]);

  const exportarBackup = useCallback(async () => {
    try {
      const logs = (await store.get(KEY_LOG)) || [];
      const m    = (await store.get(KEY_META)) || {};
      const blob = new Blob([JSON.stringify({ geradoEm:new Date().toISOString(), versao:"1.3",
        meta:m, empresas:empresasRef.current, log:logs }, null, 2)], { type:"application/json" });
      const url = URL.createObjectURL(blob);
      const a   = document.createElement("a");
      a.href = url; a.download = `orcaflow_backup_${Date.now()}.json`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1500);
      pushToast("✓ Backup exportado", "ok");
    } catch(e) { pushToast(`✗ Erro: ${e.message}`, "erro"); }
  }, [pushToast]);

  const importarBackup = useCallback(async (file) => {
    try {
      const parsed = JSON.parse(await file.text());
      if (!Array.isArray(parsed.empresas)) throw new Error("Arquivo inválido");
      const ok = await store.set(KEY_EMP, parsed.empresas);
      if (ok) { setEmpresas(parsed.empresas);
        await logOp("IMPORT", `${parsed.empresas.length} empresas`, "batch");
        pushToast(`✓ ${parsed.empresas.length} empresa(s) importada(s)`, "ok"); }
      else pushToast("✗ Falha ao importar", "erro");
    } catch(e) { pushToast(`✗ ${e.message}`, "erro"); }
  }, [pushToast]);

  const incOrcamentos = useCallback(async (n=1) => {
    const m = (await store.get(KEY_META)) || { totalOrcamentos:0 };
    m.totalOrcamentos = (m.totalOrcamentos||0) + n;
    m.ultimaGeracao   = new Date().toISOString();
    await store.set(KEY_META, m); setMeta({...m});
  }, []);

  const kbUsados = () => { try { return Math.round(JSON.stringify(empresasRef.current).length/1024); } catch { return 0; } };

  return { empresas, status, meta, toast, salvarEmpresa, excluirEmpresa,
    exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast };
}

// ─── TOAST ────────────────────────────────────────────────────────────────────
function Toast({ toast }) {
  if (!toast) return null;
  const C = { ok:"#16A34A", erro:"#dc2626", aviso:"#d97706" };
  return (
    <div style={{ position:"fixed", bottom:20, left:"50%", transform:"translateX(-50%)", zIndex:9999,
      padding:"10px 18px", borderRadius:10, background:"#0c1628",
      border:`1.5px solid ${C[toast.tipo]||"#334155"}`, color:"#e2e8f0",
      fontSize:13, fontWeight:600, boxShadow:"0 8px 32px rgba(0,0,0,.6)",
      maxWidth:"90vw", display:"flex", alignItems:"center", gap:9, whiteSpace:"nowrap" }}>
      <div style={{ width:7, height:7, borderRadius:"50%", background:C[toast.tipo], flexShrink:0 }} />
      {toast.msg}
    </div>
  );
}

// ─── MODAL DE EMPRESA ─────────────────────────────────────────────────────────
function ModalEmpresa({ empresa, onSave, onCancel, salvando }) {
  const [form, setForm] = useState({ ...empresa });
  const [aba,  setAba]  = useState("dados");
  const [erros, setErros] = useState({});
  const refLogo  = useRef();
  const refPapel = useRef();

  const set = (k, v) => setForm(p => ({ ...p, [k]:v }));

  const upload = (key, nomeKey, e) => {
    const file = e.target.files[0]; e.target.value = "";
    if (!file) return;
    if (file.size > 2_097_152) { alert("Máximo 2 MB por imagem."); return; }
    const r = new FileReader();
    r.onload  = ev => { set(key, ev.target.result); set(nomeKey, file.name); };
    r.onerror = () => alert("Erro ao ler arquivo.");
    r.readAsDataURL(file);
  };

  const validar = () => {
    const e = {};
    if (!form.nome.trim()) e.nome = "obrigatório";
    setErros(e);
    return !Object.keys(e).length;
  };

  // estilos base
  const INP = { width:"100%", background:"#060d18", border:"1px solid #1e293b", borderRadius:7,
    padding:"9px 12px", color:"#e2e8f0", fontSize:13, outline:"none",
    boxSizing:"border-box", fontFamily:"inherit", transition:"border .15s" };
  const SEL = { ...INP };
  const TXT = { ...INP, resize:"vertical", lineHeight:1.65 };

  const Lbl = ({ c, err }) => (
    <div style={{ fontSize:10, fontWeight:700, color:err?"#f87171":"#64748b",
      letterSpacing:1.2, marginBottom:5 }}>{c}{err && ` — ${err}`}</div>
  );
  const Sec = ({ t, children }) => (
    <div style={{ marginBottom:20 }}>
      <div style={{ fontSize:9.5, fontWeight:700, color:"#4ade80", letterSpacing:2,
        marginBottom:11, paddingBottom:6, borderBottom:"1px solid #1a2332" }}>{t}</div>
      {children}
    </div>
  );
  const Row = ({ children }) => (
    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>{children}</div>
  );

  const ABAS = [["dados","📋 Dados"],["linguagem","✍️ Linguagem"],["visual","🎨 Visual"],["tipografia","🔤 Tipografia"],["documento","📄 Documento"]];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.92)", backdropFilter:"blur(8px)",
      zIndex:2000, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }}>
      <div style={{ background:"#0a1525", border:"1px solid #1e2d3d", borderRadius:14, width:"100%",
        maxWidth:860, maxHeight:"92vh", overflow:"hidden", display:"flex", flexDirection:"column",
        boxShadow:"0 24px 80px rgba(0,0,0,.8)" }}>

        {/* Header */}
        <div style={{ padding:"14px 20px", borderBottom:"1px solid #1a2332",
          display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
          <div>
            <div style={{ fontSize:14, fontWeight:800, color:"#e2e8f0" }}>
              {!empresa.nome ? "Nova Empresa" : `Editando: ${form.nome||"—"}`}
            </div>
            <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>
              {empresa.criadaEm ? `Criada ${tsFmt(empresa.criadaEm)}` : "Novo cadastro"} · …{form.id.slice(-6)}
            </div>
          </div>
          <button onClick={onCancel} style={{ background:"transparent", border:"1px solid #334155",
            color:"#64748b", width:28, height:28, borderRadius:7, cursor:"pointer", fontSize:14,
            display:"flex", alignItems:"center", justifyContent:"center" }}>✕</button>
        </div>

        {/* Abas */}
        <div style={{ display:"flex", background:"#060d18", borderBottom:"1px solid #1a2332",
          flexShrink:0, overflowX:"auto" }}>
          {ABAS.map(([id,lbl]) => (
            <button key={id} onClick={() => setAba(id)} style={{
              padding:"9px 14px", border:"none", background:"transparent", cursor:"pointer",
              fontSize:11.5, fontWeight:700, whiteSpace:"nowrap",
              color:aba===id?"#4ade80":"#334155",
              borderBottom:`2px solid ${aba===id?"#16A34A":"transparent"}`,
              transition:"all .15s", flexShrink:0 }}>{lbl}</button>
          ))}
        </div>

        {/* Corpo */}
        <div style={{ overflowY:"auto", padding:"18px 20px", flex:1 }}>

          {/* ── DADOS ── */}
          {aba==="dados" && (
            <>
              <Sec t="IDENTIFICAÇÃO">
                <Row>
                  <div>
                    <Lbl c="RAZÃO SOCIAL *" err={erros.nome} />
                    <input style={{ ...INP, borderColor:erros.nome?"#dc2626":"#1e293b" }}
                      value={form.nome} onChange={e=>set("nome",e.target.value)}
                      placeholder="Nome completo da empresa"
                      onFocus={e=>e.target.style.borderColor="#16A34A"}
                      onBlur={e=>e.target.style.borderColor=erros.nome?"#dc2626":"#1e293b"} />
                  </div>
                  <div><Lbl c="CNPJ" /><input style={INP} value={form.cnpj} onChange={e=>set("cnpj",e.target.value)} placeholder="00.000.000/0001-00" /></div>
                  <div><Lbl c="E-MAIL" /><input style={INP} value={form.email} onChange={e=>set("email",e.target.value)} placeholder="contato@empresa.com.br" /></div>
                  <div><Lbl c="TELEFONE" /><input style={INP} value={form.telefone} onChange={e=>set("telefone",e.target.value)} placeholder="(00) 00000-0000" /></div>
                  <div><Lbl c="SITE" /><input style={INP} value={form.site} onChange={e=>set("site",e.target.value)} placeholder="www.empresa.com.br" /></div>
                  <div><Lbl c="ENDEREÇO" /><input style={INP} value={form.endereco} onChange={e=>set("endereco",e.target.value)} placeholder="Rua, Nº — Cidade/UF" /></div>
                </Row>
              </Sec>
              <Sec t="PERFIL COMERCIAL">
                <div style={{ marginBottom:11 }}><Lbl c="ASSINATURA DO DOCUMENTO" /><input style={INP} value={form.assinatura} onChange={e=>set("assinatura",e.target.value)} placeholder="Ex: Depto Comercial · Empresa S.A." /></div>
                <div style={{ marginBottom:11 }}><Lbl c="RODAPÉ DO DOCUMENTO" /><input style={INP} value={form.rodape} onChange={e=>set("rodape",e.target.value)} placeholder="Ex: Empresa S.A. | CNPJ | E-mail | Tel" /></div>
                <div style={{ marginBottom:11 }}><Lbl c="DIFERENCIAIS (separe por vírgula)" /><input style={INP} value={form.diferenciais} onChange={e=>set("diferenciais",e.target.value)} placeholder="Ex: Suporte 24/7, SLA garantido, Equipe certificada" /></div>
                <div><Lbl c="TOM DE VOZ" />
                  <select style={SEL} value={form.tom} onChange={e=>set("tom",e.target.value)}>
                    {TONS.map(t=><option key={t}>{t}</option>)}
                  </select>
                </div>
              </Sec>
            </>
          )}

          {/* ── LINGUAGEM (DNA) ── */}
          {aba==="linguagem" && (
            <>
              <Sec t="DNA DE LINGUAGEM DA EMPRESA">
                <div style={{ marginBottom:14, padding:"12px 14px", background:"#2563EB0e",
                  border:"1px solid #2563EB25", borderRadius:9, fontSize:12, color:"#93c5fd", lineHeight:1.7 }}>
                  <strong>Como funciona:</strong> Cole aqui textos reais da empresa — e-mails enviados, propostas anteriores, apresentações, site institucional, qualquer material escrito. A IA aprende a estrutura, o vocabulário e o estilo e replica fielmente em todos os orçamentos gerados por esta empresa.
                </div>
                <Lbl c="EXEMPLOS DE TEXTO / MATERIAL DE REFERÊNCIA" />
                <textarea
                  value={form.dnaLinguagem||""}
                  onChange={e=>set("dnaLinguagem",e.target.value)}
                  rows={12}
                  placeholder={`Cole aqui exemplos reais de comunicação desta empresa:\n\n— Trechos de e-mails comerciais enviados\n— Parágrafos de propostas anteriores\n— Texto do site institucional\n— Apresentações e materiais de marketing\n— Qualquer conteúdo que represente o estilo de escrita da empresa\n\nQuanto mais exemplos você fornecer, mais fiel será a linguagem gerada nos orçamentos.`}
                  style={{ ...TXT, minHeight:220, fontSize:13 }}
                  onFocus={e=>e.target.style.borderColor="#2563EB"}
                  onBlur={e=>e.target.style.borderColor="#1e293b"}
                />
                <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                  <span style={{ fontSize:10, color:(form.dnaLinguagem||"").length>100?"#4ade80":"#475569" }}>
                    {(form.dnaLinguagem||"").length>100 ? "✓ DNA suficiente para a IA aprender o estilo" : "⚠ Adicione mais exemplos para melhor resultado"}
                  </span>
                  <span style={{ fontSize:10, color:"#334155" }}>{(form.dnaLinguagem||"").length} chars</span>
                </div>
              </Sec>

              <Sec t="ESTRUTURA DO ORÇAMENTO">
                <div style={{ marginBottom:8, fontSize:11.5, color:"#475569", lineHeight:1.6 }}>
                  Opcionalmente, descreva como os orçamentos desta empresa devem ser estruturados — quais seções incluir, qual ordem, que tipo de linguagem usar em cada parte.
                </div>
                <Lbl c="INSTRUÇÕES DE ESTRUTURA (opcional)" />
                <textarea
                  value={form.estruturaOrcamento||""}
                  onChange={e=>set("estruturaOrcamento",e.target.value)}
                  rows={5}
                  placeholder={`Ex:\n- Começar sempre com agradecimento pela oportunidade\n- Destacar o diferencial técnico antes do preço\n- Usar linguagem formal mas próxima\n- Incluir sempre prazo de execução no escopo\n- Fechar com convite para reunião de alinhamento`}
                  style={{ ...TXT, fontSize:13 }}
                  onFocus={e=>e.target.style.borderColor="#2563EB"}
                  onBlur={e=>e.target.style.borderColor="#1e293b"}
                />
              </Sec>
            </>
          )}

          {/* ── VISUAL ── */}
          {aba==="visual" && (
            <Sec t="PALETA DE CORES">
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                {[["corPrimaria","COR PRIMÁRIA"],["corSecundaria","COR SECUNDÁRIA"],
                  ["corTexto","COR DO TEXTO"],["corFundo","COR DE FUNDO"]].map(([k,l]) => (
                  <div key={k}>
                    <Lbl c={l} />
                    <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                      <input type="color" value={form[k]} onChange={e=>set(k,e.target.value)}
                        style={{ width:36, height:34, border:"none", borderRadius:6, cursor:"pointer", padding:2, background:"none", flexShrink:0 }} />
                      <input value={form[k]} onChange={e=>set(k,e.target.value)}
                        style={{ ...INP, padding:"7px 8px", fontSize:11 }} />
                    </div>
                  </div>
                ))}
              </div>
              {/* Preview */}
              <div style={{ marginTop:14, borderRadius:9, overflow:"hidden", border:"1px solid #1e293b" }}>
                <div style={{ background:`linear-gradient(135deg,${form.corPrimaria},${form.corSecundaria})`,
                  padding:"12px 16px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ color:"#fff", fontWeight:700, fontSize:13 }}>Cabeçalho da Proposta</span>
                  <span style={{ background:"rgba(0,0,0,.25)", color:"#fff", padding:"3px 8px", borderRadius:5, fontSize:10 }}>ORC-2025-0001</span>
                </div>
                <div style={{ background:form.corFundo, padding:"12px 16px" }}>
                  <div style={{ color:form.corPrimaria, fontWeight:700, fontSize:10, marginBottom:4, letterSpacing:1 }}>APRESENTAÇÃO</div>
                  <div style={{ color:form.corTexto, fontSize:12, lineHeight:1.6 }}>Texto com as cores configuradas para <strong>{form.nome||"sua empresa"}</strong>.</div>
                </div>
              </div>
            </Sec>
          )}

          {/* ── TIPOGRAFIA ── */}
          {aba==="tipografia" && (
            <>
              <Sec t="FONTE DO TÍTULO">
                <Row>
                  <div><Lbl c="FAMÍLIA" />
                    <select style={SEL} value={form.fonteTitulo} onChange={e=>set("fonteTitulo",e.target.value)}>
                      {FONTES.map(f=><option key={f.id} value={f.id}>[{f.cat}] {f.label}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="TAMANHO (px)" />
                    <select style={SEL} value={form.tamanhoTitulo} onChange={e=>set("tamanhoTitulo",Number(e.target.value))}>
                      {T_TITULO.map(t=><option key={t} value={t}>{t}px</option>)}
                    </select>
                  </div>
                </Row>
                <div style={{ marginTop:9, padding:"12px 16px", background:"#060d18", borderRadius:7, border:"1px solid #1e293b" }}>
                  <span style={{ fontFamily:form.fonteTitulo, fontSize:sz(form.tamanhoTitulo), color:form.corPrimaria, fontWeight:700 }}>
                    Título — {form.nome||"Empresa"}
                  </span>
                </div>
              </Sec>
              <Sec t="FONTE DO CORPO">
                <Row>
                  <div><Lbl c="FAMÍLIA" />
                    <select style={SEL} value={form.fonteCorpo} onChange={e=>set("fonteCorpo",e.target.value)}>
                      {FONTES.map(f=><option key={f.id} value={f.id}>[{f.cat}] {f.label}</option>)}
                    </select>
                  </div>
                  <div><Lbl c="TAMANHO (px)" />
                    <select style={SEL} value={form.tamanhoCorpo} onChange={e=>set("tamanhoCorpo",Number(e.target.value))}>
                      {T_CORPO.map(t=><option key={t} value={t}>{t}px</option>)}
                    </select>
                  </div>
                </Row>
                <div style={{ marginTop:9, padding:"12px 16px", background:"#060d18", borderRadius:7, border:"1px solid #1e293b" }}>
                  <span style={{ fontFamily:form.fonteCorpo, fontSize:sz(form.tamanhoCorpo), color:form.corTexto, lineHeight:1.75 }}>
                    Texto do corpo — apresentação, escopo, itens e fechamento usarão esta fonte.
                  </span>
                </div>
              </Sec>
              {/* Preview combinado */}
              <Sec t="PREVIEW COMBINADO">
                <div style={{ background:form.corFundo, borderRadius:9, padding:"16px 20px", border:"1px solid #1e293b" }}>
                  <div style={{ fontFamily:form.fonteTitulo, fontSize:sz(Math.round(form.tamanhoTitulo*.7)), color:form.corPrimaria, fontWeight:700, marginBottom:6 }}>
                    PROPOSTA COMERCIAL · {(form.nome||"EMPRESA").toUpperCase()}
                  </div>
                  <div style={{ height:2, background:form.corPrimaria, marginBottom:8, width:44 }} />
                  <div style={{ fontFamily:form.fonteCorpo, fontSize:sz(form.tamanhoCorpo), color:form.corTexto, lineHeight:1.75 }}>
                    {form.nome||"Nossa empresa"} apresenta esta proposta com tom "{form.tom}".
                  </div>
                </div>
              </Sec>
            </>
          )}

          {/* ── DOCUMENTO ── */}
          {aba==="documento" && (
            <>
              <Sec t="LOGO E PAPEL TIMBRADO">
                <Row>
                  {/* Logo */}
                  <div>
                    <Lbl c="LOGO DA EMPRESA" />
                    <div onClick={()=>refLogo.current.click()}
                      style={{ border:"2px dashed #1e293b", borderRadius:9, padding:"16px 12px",
                        textAlign:"center", cursor:"pointer", background:"#060d18", minHeight:84,
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        transition:"border .2s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="#2563EB88"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                      {form.logo
                        ? <><img src={form.logo} alt="logo" style={{ maxHeight:56, maxWidth:"100%", objectFit:"contain" }} />
                            <div style={{ fontSize:10, color:"#4ade80", marginTop:6 }}>✓ {form.logoNome}</div></>
                        : <><div style={{ fontSize:26, opacity:.3, marginBottom:5 }}>🖼</div>
                            <div style={{ fontSize:11, color:"#475569" }}>Clique para enviar</div>
                            <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>PNG · JPG · SVG · max 2 MB</div></>}
                    </div>
                    <input ref={refLogo} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>upload("logo","logoNome",e)} />
                    {form.logo && (
                      <>
                        <button onClick={()=>{set("logo",null);set("logoNome","");}}
                          style={{ marginTop:6, width:"100%", padding:"5px", borderRadius:6,
                            border:"1px solid #7f1d1d55", background:"transparent", color:"#f87171", cursor:"pointer", fontSize:11 }}>
                          Remover logo
                        </button>
                        <div style={{ marginTop:10 }}>
                          <Lbl c="POSIÇÃO" />
                          <div style={{ display:"flex", gap:5 }}>
                            {["esquerda","centro","direita"].map(p=>(
                              <button key={p} onClick={()=>set("posicaoLogo",p)}
                                style={{ flex:1, padding:"6px 4px", borderRadius:6,
                                  border:`1.5px solid ${form.posicaoLogo===p?"#16A34A":"#1e293b"}`,
                                  background:form.posicaoLogo===p?"#16A34A1a":"transparent",
                                  color:form.posicaoLogo===p?"#4ade80":"#475569",
                                  cursor:"pointer", fontSize:10.5, fontWeight:form.posicaoLogo===p?700:400 }}>
                                {p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Papel timbrado */}
                  <div>
                    <Lbl c="PAPEL TIMBRADO" />
                    <div onClick={()=>refPapel.current.click()}
                      style={{ border:"2px dashed #1e293b", borderRadius:9, padding:"16px 12px",
                        textAlign:"center", cursor:"pointer", background:"#060d18", minHeight:84,
                        display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                        transition:"border .2s" }}
                      onMouseEnter={e=>e.currentTarget.style.borderColor="#16A34A88"}
                      onMouseLeave={e=>e.currentTarget.style.borderColor="#1e293b"}>
                      {form.papelTimbrado
                        ? <><img src={form.papelTimbrado} alt="timbrado" style={{ maxHeight:56, maxWidth:"100%", objectFit:"contain", opacity:.85 }} />
                            <div style={{ fontSize:10, color:"#4ade80", marginTop:6 }}>✓ {form.papelTimbradoNome}</div></>
                        : <><div style={{ fontSize:26, opacity:.3, marginBottom:5 }}>📑</div>
                            <div style={{ fontSize:11, color:"#475569" }}>Enviar timbrado</div>
                            <div style={{ fontSize:10, color:"#334155", marginTop:2 }}>PNG · JPG · A4 · max 2 MB</div></>}
                    </div>
                    <input ref={refPapel} type="file" accept="image/*" style={{ display:"none" }} onChange={e=>upload("papelTimbrado","papelTimbradoNome",e)} />
                    {form.papelTimbrado && (
                      <>
                        <button onClick={()=>{set("papelTimbrado",null);set("papelTimbradoNome","");}}
                          style={{ marginTop:6, width:"100%", padding:"5px", borderRadius:6,
                            border:"1px solid #7f1d1d55", background:"transparent", color:"#f87171", cursor:"pointer", fontSize:11 }}>
                          Remover timbrado
                        </button>
                        <div style={{ marginTop:10, display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                          <div><Lbl c={`CABEÇALHO: ${form.altoCabecalho}px`} />
                            <input type="range" min={60} max={220} value={form.altoCabecalho}
                              onChange={e=>set("altoCabecalho",Number(e.target.value))} style={{ width:"100%", accentColor:"#16A34A" }} /></div>
                          <div><Lbl c={`RODAPÉ: ${form.altoRodape}px`} />
                            <input type="range" min={30} max={120} value={form.altoRodape}
                              onChange={e=>set("altoRodape",Number(e.target.value))} style={{ width:"100%", accentColor:"#16A34A" }} /></div>
                        </div>
                      </>
                    )}
                  </div>
                </Row>
              </Sec>

              {/* Preview documento */}
              <Sec t="PREVIEW DO DOCUMENTO">
                <div style={{ border:"1px solid #1e293b", borderRadius:9, overflow:"hidden",
                  background:form.corFundo, maxWidth:420, margin:"0 auto", boxShadow:"0 6px 24px rgba(0,0,0,.4)" }}>
                  {form.papelTimbrado
                    ? <div style={{ position:"relative", minHeight:form.altoCabecalho, overflow:"hidden" }}>
                        <img src={form.papelTimbrado} style={{ width:"100%", height:form.altoCabecalho,
                          objectFit:"cover", objectPosition:"top", display:"block" }} alt="" />
                        {form.logo && (
                          <div style={{ position:"absolute", inset:0, display:"flex",
                            alignItems:"flex-end", justifyContent:jus(form.posicaoLogo), padding:"0 14px 8px" }}>
                            <img src={form.logo} style={{ maxHeight:28, maxWidth:90, objectFit:"contain" }} alt="" />
                          </div>
                        )}
                      </div>
                    : <div style={{ background:`linear-gradient(135deg,${form.corPrimaria},${form.corSecundaria})`,
                        minHeight:68, display:"flex", alignItems:"center",
                        justifyContent:jus(form.posicaoLogo), padding:"10px 16px" }}>
                        {form.logo
                          ? <img src={form.logo} style={{ maxHeight:38, maxWidth:120, objectFit:"contain" }} alt="" />
                          : <span style={{ fontFamily:form.fonteTitulo, fontSize:sz(form.tamanhoTitulo*.52,11), fontWeight:900, color:"#fff" }}>{form.nome||"EMPRESA"}</span>}
                      </div>}
                  <div style={{ padding:"12px 16px", background:form.corFundo }}>
                    <div style={{ fontFamily:form.fonteTitulo, fontSize:sz(form.tamanhoTitulo*.48,10), color:form.corPrimaria, fontWeight:700, marginBottom:5 }}>PROPOSTA COMERCIAL</div>
                    <div style={{ fontFamily:form.fonteCorpo, fontSize:sz(form.tamanhoCorpo*.88,9), color:form.corTexto, lineHeight:1.6 }}>
                      Texto de exemplo com a identidade visual configurada.
                    </div>
                    <div style={{ marginTop:7, height:3, background:`linear-gradient(90deg,${form.corPrimaria},${form.corSecundaria}44)`, borderRadius:2 }} />
                  </div>
                  <div style={{ background:"#0f172a", padding:"6px 16px", textAlign:"center" }}>
                    <div style={{ fontFamily:form.fonteCorpo, fontSize:9, color:"#475569" }}>
                      {form.rodape||`${form.nome||"Empresa"} | ${form.email||"email"} | ${form.telefone||"tel"}`}
                    </div>
                  </div>
                </div>
              </Sec>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding:"12px 20px", borderTop:"1px solid #1a2332",
          display:"flex", justifyContent:"space-between", alignItems:"center",
          flexShrink:0, background:"#060d18" }}>
          <div style={{ fontSize:9.5, color:"#1e293b", fontFamily:"monospace" }}>ID: {form.id.slice(-10)}</div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={onCancel} style={{ padding:"8px 16px", borderRadius:8, border:"1px solid #334155",
              background:"transparent", color:"#64748b", cursor:"pointer", fontSize:12.5, fontWeight:600 }}>Cancelar</button>
            <button onClick={()=>validar()&&onSave(form)} disabled={salvando}
              style={{ padding:"8px 22px", borderRadius:8, border:"none",
                background:salvando?"#1e293b":"linear-gradient(135deg,#16A34A,#15803D)",
                color:salvando?"#334155":"#fff", cursor:salvando?"not-allowed":"pointer",
                fontSize:12.5, fontWeight:800, boxShadow:salvando?"none":"0 4px 14px #16A34A40" }}>
              {salvando?"Salvando…":"💾 Salvar no Banco"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ORÇAMENTO RENDERIZADO ────────────────────────────────────────────────────
function OrcamentoDoc({ emp, dados, editando, onChange }) {
  const hoje     = new Date().toLocaleDateString("pt-BR");
  const validade = new Date(Date.now()+30*86400000).toLocaleDateString("pt-BR");
  const difs     = (emp.diferenciais||"").split(",").map(d=>d.trim()).filter(Boolean);
  const logoPos  = jus(emp.posicaoLogo);

  const secLbl = { fontSize:9, fontWeight:700, color:emp.corPrimaria,
    letterSpacing:2.2, fontFamily:"sans-serif", marginBottom:7, display:"block" };

  const F = ({ campo, multiline }) => {
    const val = dados.campos?.[campo]??"";
    const base = { width:"100%", border:`1.5px dashed ${emp.corPrimaria}`,
      borderRadius:5, padding:"6px 10px", fontFamily:emp.fonteCorpo,
      fontSize:sz(emp.tamanhoCorpo), color:emp.corTexto, background:emp.corFundo,
      outline:"none", lineHeight:1.75, boxSizing:"border-box" };
    if (!editando) return <span style={{ fontFamily:emp.fonteCorpo, fontSize:sz(emp.tamanhoCorpo), color:emp.corTexto }}>{val}</span>;
    return multiline
      ? <textarea value={val} rows={3} onChange={e=>onChange(campo,e.target.value)} style={{ ...base, resize:"vertical", minHeight:52 }} />
      : <input value={val} onChange={e=>onChange(campo,e.target.value)} style={base} />;
  };

  return (
    <div style={{ background:emp.corFundo, border:"1px solid #e2e8f0",
      borderRadius:12, overflow:"hidden", boxShadow:"0 8px 40px rgba(0,0,0,.12)" }}>

      {/* Cabeçalho */}
      {emp.papelTimbrado
        ? <div style={{ position:"relative", minHeight:emp.altoCabecalho, overflow:"hidden" }}>
            <img src={emp.papelTimbrado} style={{ width:"100%", height:emp.altoCabecalho,
              objectFit:"cover", objectPosition:"top", display:"block" }} alt="" />
            {emp.logo && (
              <div style={{ position:"absolute", inset:0, display:"flex",
                alignItems:"flex-end", justifyContent:logoPos, padding:"0 20px 10px" }}>
                <img src={emp.logo} style={{ maxHeight:34, maxWidth:110, objectFit:"contain" }} alt="" />
              </div>
            )}
            <div style={{ position:"absolute", top:10, right:18, background:"rgba(0,0,0,.55)",
              backdropFilter:"blur(4px)", borderRadius:8, padding:"7px 13px", textAlign:"right" }}>
              <div style={{ fontSize:7.5, color:"rgba(255,255,255,.7)", letterSpacing:1.5 }}>PROPOSTA COMERCIAL</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#fff", fontFamily:"monospace" }}>{dados.numero}</div>
              <div style={{ fontSize:7.5, color:"rgba(255,255,255,.6)" }}>{hoje} · válido até {validade}</div>
            </div>
          </div>
        : <div style={{ background:`linear-gradient(135deg,${emp.corPrimaria},${emp.corSecundaria})`,
            padding:"22px 28px", minHeight:emp.altoCabecalho,
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div>
              {emp.logo
                ? <img src={emp.logo} style={{ maxHeight:46, maxWidth:140, objectFit:"contain", display:"block", marginBottom:5 }} alt="" />
                : <div style={{ fontFamily:emp.fonteTitulo, fontSize:sz(Math.round(emp.tamanhoTitulo*.88)), fontWeight:900, color:"#fff", marginBottom:4 }}>{emp.nome}</div>}
              {emp.assinatura && <div style={{ fontSize:10.5, color:"rgba(255,255,255,.7)", fontFamily:"sans-serif" }}>{emp.assinatura}</div>}
            </div>
            <div style={{ textAlign:"right", background:"rgba(0,0,0,.18)", borderRadius:9, padding:"11px 16px" }}>
              <div style={{ fontSize:7.5, color:"rgba(255,255,255,.65)", letterSpacing:1.5 }}>PROPOSTA COMERCIAL</div>
              <div style={{ fontSize:15, fontWeight:800, color:"#fff", fontFamily:"monospace" }}>{dados.numero}</div>
              <div style={{ fontSize:7.5, color:"rgba(255,255,255,.6)" }}>Emitido: {hoje} · Válido: {validade}</div>
            </div>
          </div>}

      <div style={{ height:4, background:`linear-gradient(90deg,${emp.corPrimaria},${emp.corSecundaria},${emp.corFundo})` }} />

      <div style={{ padding:"24px 28px" }}>
        {/* Destinatário */}
        <div style={{ marginBottom:18, padding:"11px 15px", background:emp.corPrimaria+"14",
          borderRadius:8, borderLeft:`4px solid ${emp.corPrimaria}` }}>
          <span style={secLbl}>DESTINATÁRIO</span>
          <div style={{ fontFamily:emp.fonteCorpo, fontSize:sz(emp.tamanhoCorpo+1), fontWeight:700, color:emp.corTexto }}>
            <F campo="cliente" />
          </div>
        </div>

        {/* Apresentação */}
        <div style={{ marginBottom:18 }}>
          <span style={secLbl}>APRESENTAÇÃO</span>
          <div style={{ lineHeight:1.85 }}><F campo="intro" multiline /></div>
        </div>

        {/* Escopo */}
        <div style={{ marginBottom:18 }}>
          <span style={secLbl}>ESCOPO DO SERVIÇO</span>
          <div style={{ lineHeight:1.85 }}><F campo="escopo" multiline /></div>
        </div>

        {/* Itens */}
        {dados.itensIA?.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <span style={secLbl}>ITENS INCLUÍDOS</span>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:emp.corPrimaria }}>
                  <th style={{ padding:"8px 13px", color:"#fff", textAlign:"left",
                    fontFamily:"sans-serif", fontSize:8, letterSpacing:1.5, fontWeight:700 }}>DESCRIÇÃO DA ETAPA / ITEM</th>
                  <th style={{ padding:"8px 13px", color:"#fff", textAlign:"center",
                    fontFamily:"sans-serif", fontSize:8, letterSpacing:1.5, fontWeight:700, width:80 }}>STATUS</th>
                </tr>
              </thead>
              <tbody>
                {dados.itensIA.map((it,i) => (
                  <tr key={i} style={{ background:i%2===0?emp.corPrimaria+"0a":emp.corFundo,
                    borderBottom:`1px solid ${emp.corPrimaria}18` }}>
                    <td style={{ padding:"9px 13px", fontFamily:emp.fonteCorpo,
                      fontSize:sz(emp.tamanhoCorpo), color:emp.corTexto }}>{it}</td>
                    <td style={{ padding:"9px 13px", textAlign:"center" }}>
                      <span style={{ padding:"2px 9px", borderRadius:12, background:emp.corPrimaria+"18",
                        color:emp.corSecundaria, fontSize:8.5, fontWeight:700 }}>Incluído</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Valor global */}
        <div style={{ marginBottom:18, display:"flex", justifyContent:"flex-end" }}>
          <div style={{ background:`linear-gradient(135deg,${emp.corPrimaria},${emp.corSecundaria})`,
            borderRadius:10, padding:"14px 22px", color:"#fff", textAlign:"right", minWidth:200 }}>
            <div style={{ fontSize:7.5, opacity:.8, letterSpacing:2, marginBottom:3 }}>VALOR GLOBAL DO SERVIÇO</div>
            <div style={{ fontFamily:emp.fonteTitulo, fontSize:sz(Math.round(emp.tamanhoTitulo*.82)), fontWeight:900 }}>{brl(dados.valorGlobal)}</div>
          </div>
        </div>

        {/* Condições */}
        <div style={{ marginBottom:18, padding:"12px 15px", background:emp.corPrimaria+"09",
          borderRadius:8, border:`1px solid ${emp.corPrimaria}1a` }}>
          <span style={secLbl}>CONDIÇÕES COMERCIAIS</span>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"5px 20px",
            fontFamily:emp.fonteCorpo, fontSize:sz(emp.tamanhoCorpo-1), color:emp.corTexto }}>
            <div>• Validade: <strong>30 dias</strong></div>
            <div>• Pagamento: <strong>À combinar</strong></div>
            <div>• Prazo: <strong>Conforme cronograma</strong></div>
            <div>• Impostos: <strong>Inclusos</strong></div>
          </div>
        </div>

        {/* Diferenciais */}
        {difs.length > 0 && (
          <div style={{ marginBottom:18 }}>
            <span style={secLbl}>DIFERENCIAIS</span>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
              {difs.map((d,i) => (
                <div key={i} style={{ padding:"4px 12px", background:emp.corPrimaria+"12",
                  border:`1px solid ${emp.corPrimaria}30`, borderRadius:20,
                  fontSize:sz(emp.tamanhoCorpo-2), color:emp.corSecundaria, fontWeight:600 }}>{d}</div>
              ))}
            </div>
          </div>
        )}

        {/* Fechamento */}
        <div style={{ marginBottom:22, padding:"12px 15px", borderRadius:8,
          background:emp.corPrimaria+"0a", borderLeft:`4px solid ${emp.corPrimaria}` }}>
          <div style={{ lineHeight:1.85, fontStyle:"italic" }}><F campo="fechamento" multiline /></div>
        </div>

        {/* Assinatura */}
        <div style={{ borderTop:`2px solid ${emp.corPrimaria}`, paddingTop:16,
          display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
          <div>
            <div style={{ width:160, borderBottom:`1px solid ${emp.corPrimaria}44`, marginBottom:6 }} />
            <div style={{ fontFamily:emp.fonteCorpo, fontSize:sz(emp.tamanhoCorpo-1), fontWeight:700, color:emp.corTexto }}>{emp.assinatura||emp.nome}</div>
            <div style={{ fontFamily:emp.fonteCorpo, fontSize:sz(emp.tamanhoCorpo-2), color:emp.corTexto+"77" }}>Data: {hoje}</div>
          </div>
          {emp.logo && <img src={emp.logo} style={{ maxHeight:34, maxWidth:100, objectFit:"contain", opacity:.14 }} alt="" />}
        </div>
      </div>

      {/* Rodapé */}
      {emp.papelTimbrado
        ? <div style={{ background:emp.corPrimaria+"14", borderTop:`1px solid ${emp.corPrimaria}22`, padding:"8px 28px", textAlign:"center" }}>
            <div style={{ fontFamily:emp.fonteCorpo, fontSize:9.5, color:emp.corTexto+"99" }}>
              {emp.rodape||`${emp.nome} | ${emp.email||""} | ${emp.telefone||""}`}
            </div>
          </div>
        : <div style={{ background:"#0f172a", padding:"9px 28px", textAlign:"center" }}>
            <div style={{ fontFamily:emp.fonteCorpo, fontSize:9.5, color:"#475569" }}>
              {emp.rodape||`${emp.nome}${emp.cnpj?` | ${emp.cnpj}`:""}${emp.email?` | ${emp.email}`:""}${emp.telefone?` | ${emp.telefone}`:""}`}
            </div>
          </div>}
    </div>
  );
}

// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────
export default function App() {
  const { empresas, status, meta, toast, salvarEmpresa, excluirEmpresa,
    exportarBackup, importarBackup, incOrcamentos, kbUsados, pushToast } = useDB();

  const [view,      setView]      = useState("orcamento");
  const [modal,     setModal]     = useState(null);
  const [salvando,  setSalvando]  = useState(false);
  const [confirmar, setConfirmar] = useState(null);
  const [logData,   setLogData]   = useState([]);
  const [logOpen,   setLogOpen]   = useState(false);
  const refImport = useRef();

  // Orçamento
  const [cliente,    setCliente]    = useState("");
  const [texto,      setTexto]      = useState("");
  const [obs,        setObs]        = useState("");
  const [selecao,    setSelecao]    = useState([]);
  const [gerando,    setGerando]    = useState(false);
  const [iaStatus,   setIaStatus]   = useState("");
  const [orcamentos, setOrcamentos] = useState({});
  const [activeTab,  setActiveTab]  = useState(null);
  const [editando,   setEditando]   = useState(false);
  const [step,       setStep]       = useState("montagem");
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
    setSelecao(prev => prev.filter(s => s.empId !== confirmar.id));
    setConfirmar(null);
  };

  const abrirLog = async () => {
    const logs = (await store.get(KEY_LOG)) || [];
    setLogData(logs); setLogOpen(true);
  };

  const toggleSel = (id) => setSelecao(prev => {
    if (prev.find(s=>s.empId===id)) return prev.filter(s=>s.empId!==id);
    if (prev.length >= MAX) return prev;
    return [...prev, { empId:id, valorGlobal:"" }];
  });

  const setValor = (id,v) => setSelecao(prev => prev.map(s=>s.empId===id?{...s,valorGlobal:v}:s));

  const empsSel  = selecao.map(s=>empresas.find(e=>e.id===s.empId)).filter(Boolean);
  const canGerar = cliente.trim() && texto.trim() && selecao.length > 0;

  const resetOrcamento = () => {
    setStep("montagem"); setOrcamentos({}); setSelecao([]);
    setCliente(""); setTexto(""); setObs(""); setActiveTab(null); setEditando(false);
  };

  const handleGerar = async () => {
    if (!canGerar || gerando) return;
    setGerando(true); setIaStatus("Analisando o serviço…");

    const empsInfo = selecao.map(s => {
      const e = empresas.find(x=>x.id===s.empId);
      const dna = (e.dnaLinguagem||"").slice(0,600);
      const estrutura = (e.estruturaOrcamento||"").slice(0,300);
      return `- ID "${s.empId}": ${e.nome}\n  Tom: ${e.tom}\n  DNA de linguagem: ${dna||"não fornecido"}\n  Estrutura: ${estrutura||"padrão"}`;
    }).join("\n\n");

    const prompt = `Você é especialista em propostas comerciais. Analise e gere conteúdo estruturado.

CLIENTE: ${cliente}
TEXTO DO SERVIÇO: ${texto}
${obs?`OBSERVAÇÕES: ${obs}`:""}

EMPRESAS EMISSORAS (com DNA de linguagem e estrutura):
${empsInfo}

INSTRUÇÕES CRÍTICAS:
- Para cada empresa, analise cuidadosamente o DNA de linguagem fornecido
- Replique o vocabulário, o tom, os padrões de frase e o estilo presentes no DNA
- Se a empresa forneceu instruções de estrutura, siga-as à risca
- Extraia os itens do serviço do texto fornecido (mínimo 4, máximo 6 itens)
- Cada empresa deve ter textos visivelmente diferentes entre si

Retorne APENAS JSON válido, sem markdown:
{
  "itens": ["item 1","item 2","item 3","item 4","item 5"],
  "empresas": {
    ${selecao.map(s=>{const e=empresas.find(x=>x.id===s.empId);return `"${s.empId}": {
      "intro": "Introdução de 2-3 frases fielmente no estilo e vocabulário do DNA de ${e.nome}, mencionando ${cliente} e o serviço",
      "escopo": "Escopo de 2-3 frases no estilo do DNA de ${e.nome}, baseado no texto fornecido",
      "fechamento": "Fechamento de 1-2 frases com o vocabulário e tom típicos de ${e.nome}"
    }`;}).join(",\n    ")}
  }
}`;

    try {
      setIaStatus("Personalizando por empresa…");
      const res  = await fetch("https://api.anthropic.com/v1/messages", {
        method:"POST", headers:{"Content-Type":"application/json"},
        body: JSON.stringify({ model:"claude-sonnet-4-20250514", max_tokens:1200,
          messages:[{ role:"user", content:prompt }] }),
      });
      const data = await res.json();
      const raw  = data.content?.find(b=>b.type==="text")?.text || "{}";
      const parsed = JSON.parse(raw.replace(/```json|```/g,"").trim());

      const novos = {};
      for (const s of selecao) {
        const ed = parsed.empresas?.[s.empId] || {};
        novos[s.empId] = {
          numero: orcNum(), valorGlobal: s.valorGlobal,
          itensIA: parsed.itens || [],
          campos: { cliente, intro:ed.intro||"", escopo:ed.escopo||texto, fechamento:ed.fechamento||"" },
        };
      }
      setOrcamentos(novos); setActiveTab(selecao[0].empId);
      await incOrcamentos(selecao.length);
    } catch {
      const novos = {};
      for (const s of selecao)
        novos[s.empId] = { numero:orcNum(), valorGlobal:s.valorGlobal, itensIA:[],
          campos:{ cliente, intro:texto, escopo:texto, fechamento:"" } };
      setOrcamentos(novos); setActiveTab(selecao[0].empId);
      pushToast("IA indisponível — orçamento gerado sem personalização", "aviso");
    }
    setGerando(false); setIaStatus(""); setStep("preview");
  };

  const fieldChange = (empId,campo,val) =>
    setOrcamentos(prev => ({...prev,[empId]:{...prev[empId],campos:{...prev[empId].campos,[campo]:val}}}));

  // ── ESTILOS GLOBAIS ──
  const INP = { background:"#060d18", border:"1px solid #1e293b", borderRadius:8,
    padding:"10px 14px", color:"#e2e8f0", fontSize:14, outline:"none", width:"100%",
    boxSizing:"border-box", lineHeight:1.6, fontFamily:"inherit", transition:"border .15s" };

  const corDB = { ok:"#4ade80", erro:"#f87171", carregando:"#f59e0b" };

  return (
    <div style={{ minHeight:"100vh", background:"#050b14", color:"#f0f4f8",
      fontFamily:"'Segoe UI',system-ui,sans-serif", display:"flex", flexDirection:"column" }}>

      <Toast toast={toast} />

      {/* ══ TOPBAR ══ */}
      <div style={{ background:"#0a1420", borderBottom:"1px solid #1a2840",
        padding:"0 16px", flexShrink:0, height:52,
        display:"flex", alignItems:"center", justifyContent:"space-between", gap:8 }}>

        {/* Logo + DB */}
        <div style={{ display:"flex", alignItems:"center", gap:8, flexShrink:0 }}>
          <div style={{ width:30, height:30, borderRadius:8,
            background:"linear-gradient(135deg,#16A34A,#2563EB)",
            display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:900 }}>◈</div>
          <div style={{ display:"flex", alignItems:"baseline", gap:4 }}>
            <span style={{ fontSize:15, fontWeight:900 }}>
              <span style={{ color:"#e2e8f0" }}>Orça</span><span style={{ color:"#4ade80" }}>Flow</span>
            </span>
            <span style={{ color:"#1e293b", fontSize:10, fontWeight:300 }}>AI</span>
          </div>
          {/* Pill de status DB */}
          <div style={{ display:"flex", alignItems:"center", gap:4, padding:"2px 8px",
            borderRadius:20, background:status==="ok"?"#16A34A14":"#1e293b",
            border:`1px solid ${status==="ok"?"#16A34A28":"#334155"}` }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:corDB[status]||"#f59e0b" }} />
            <span style={{ fontSize:9.5, color:corDB[status]||"#f59e0b", fontWeight:700, whiteSpace:"nowrap" }}>
              {status==="carregando"?"DB…":status==="ok"?`${empresas.length} emp.`:"ERRO"}
            </span>
          </div>
        </div>

        {/* Nav */}
        <div style={{ display:"flex", gap:2, background:"#050b14", borderRadius:8,
          padding:3, border:"1px solid #1e293b", flexShrink:0 }}>
          {[["orcamento","✦ Orçamento"],["empresas","🏢"],["banco","🗄"]].map(([v,l]) => (
            <button key={v} onClick={()=>setView(v)} style={{
              padding:"5px 10px", borderRadius:6, border:"none", cursor:"pointer",
              fontSize:11.5, fontWeight:700,
              background:view===v?"linear-gradient(135deg,#16A34A,#15803D)":"transparent",
              color:view===v?"#fff":"#334155", whiteSpace:"nowrap" }}>{l}</button>
          ))}
        </div>

        {/* Steps */}
        {view==="orcamento" && (
          <div style={{ display:"flex", alignItems:"center", gap:2, flexShrink:0 }}>
            {[["montagem","1","Mont."],["preview","2","Rev."],["exportacao","3","Export."]].map(([s,n,l],i) => {
              const done=(s==="montagem"&&["preview","exportacao"].includes(step))||(s==="preview"&&step==="exportacao");
              const act=step===s;
              return (
                <div key={s} style={{ display:"flex", alignItems:"center" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:4, padding:"3px 8px",
                    borderRadius:14, background:act?"#16A34A18":"transparent",
                    border:act?"1px solid #16A34A40":"1px solid transparent" }}>
                    <div style={{ width:15, height:15, borderRadius:"50%",
                      background:done?"#166534":act?"#16A34A":"#1e293b",
                      display:"flex", alignItems:"center", justifyContent:"center",
                      fontSize:7.5, fontWeight:700, color:"#fff" }}>{done?"✓":n}</div>
                    <span style={{ fontSize:10, color:act?"#4ade80":"#334155", fontWeight:act?700:400 }}>{l}</span>
                  </div>
                  {i<2&&<div style={{ width:8, height:1, background:"#1a2332" }} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ══ VIEW: BANCO ══ */}
      {view==="banco" && (
        <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", maxWidth:980, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18, gap:10, flexWrap:"wrap" }}>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:"#e2e8f0" }}>🗄 Banco de Dados</div>
              <div style={{ fontSize:11, color:"#334155", marginTop:2 }}>Gerenciamento, auditoria e backup</div>
            </div>
            <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
              <button onClick={abrirLog} style={{ padding:"7px 12px", borderRadius:7, border:"1px solid #334155", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:11.5, fontWeight:600 }}>📋 Log</button>
              <button onClick={()=>refImport.current.click()} style={{ padding:"7px 12px", borderRadius:7, border:"1px solid #2563EB40", background:"#2563EB14", color:"#93c5fd", cursor:"pointer", fontSize:11.5, fontWeight:600 }}>📥 Importar</button>
              <button onClick={exportarBackup} style={{ padding:"7px 14px", borderRadius:7, border:"none", background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff", cursor:"pointer", fontSize:11.5, fontWeight:700 }}>📤 Backup</button>
              <input ref={refImport} type="file" accept=".json" style={{ display:"none" }}
                onChange={e=>{ if(e.target.files[0]) importarBackup(e.target.files[0]); e.target.value=""; }} />
            </div>
          </div>

          {/* Stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:10, marginBottom:18 }}>
            {[
              { icon:"🏢", label:"Empresas",           valor:empresas.length,                                    cor:"#2563EB" },
              { icon:"📄", label:"Orçamentos",          valor:meta.totalOrcamentos||0,                           cor:"#16A34A" },
              { icon:"💾", label:"Banco",               valor:`${kbUsados()} KB`,                                cor:"#7c3aed" },
              { icon:"🕐", label:"Última geração",      valor:meta.ultimaGeracao?new Date(meta.ultimaGeracao).toLocaleDateString("pt-BR"):"—", cor:"#d97706" },
            ].map(c=>(
              <div key={c.label} style={{ background:"#0a1420", border:`1px solid ${c.cor}22`, borderRadius:11, padding:"14px 16px" }}>
                <div style={{ fontSize:20, marginBottom:6 }}>{c.icon}</div>
                <div style={{ fontSize:20, fontWeight:800, color:c.cor, marginBottom:2 }}>{c.valor}</div>
                <div style={{ fontSize:10.5, color:"#334155" }}>{c.label}</div>
              </div>
            ))}
          </div>

          {/* Tabela */}
          <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"12px 16px", borderBottom:"1px solid #1a2840", display:"flex", justifyContent:"space-between" }}>
              <div style={{ fontSize:9.5, fontWeight:700, color:"#4ade80", letterSpacing:2 }}>REGISTROS</div>
              <div style={{ fontSize:10.5, color:"#334155" }}>{empresas.length} empresa{empresas.length!==1?"s":""}</div>
            </div>
            {empresas.length===0
              ? <div style={{ padding:"30px", textAlign:"center", color:"#1e293b", fontSize:13 }}>Nenhum registro</div>
              : <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", minWidth:600 }}>
                    <thead>
                      <tr style={{ background:"#060d18" }}>
                        {["Empresa","CNPJ","Tom","DNA","Timbrado","Logo","Criada",""].map(h=>(
                          <th key={h} style={{ padding:"8px 12px", textAlign:"left", fontSize:8.5, fontWeight:700, color:"#334155", letterSpacing:1.3, whiteSpace:"nowrap" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {empresas.map((emp,i)=>(
                        <tr key={emp.id} style={{ background:i%2===0?"#0a1420":"#050b14", borderBottom:"1px solid #1a2840" }}>
                          <td style={{ padding:"8px 12px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                              <div style={{ width:6, height:6, borderRadius:"50%", background:emp.corPrimaria }} />
                              <span style={{ fontSize:12.5, fontWeight:700, color:"#e2e8f0" }}>{emp.nome}</span>
                            </div>
                          </td>
                          <td style={{ padding:"8px 12px", fontSize:11, color:"#475569", fontFamily:"monospace" }}>{emp.cnpj||"—"}</td>
                          <td style={{ padding:"8px 12px" }}>
                            <span style={{ padding:"2px 6px", background:emp.corPrimaria+"18", color:emp.corPrimaria, borderRadius:10, fontSize:9, fontWeight:700 }}>{emp.tom}</span>
                          </td>
                          <td style={{ padding:"8px 12px", textAlign:"center", fontSize:12 }}>
                            {(emp.dnaLinguagem||"").length>50 ? <span style={{ color:"#4ade80", fontWeight:700 }}>✓</span> : <span style={{ color:"#334155" }}>—</span>}
                          </td>
                          <td style={{ padding:"8px 12px", textAlign:"center", fontSize:12 }}>{emp.papelTimbrado?"✅":"—"}</td>
                          <td style={{ padding:"8px 12px", textAlign:"center", fontSize:12 }}>{emp.logo?"✅":"—"}</td>
                          <td style={{ padding:"8px 12px", fontSize:10, color:"#334155", whiteSpace:"nowrap" }}>{tsFmt(emp.criadaEm)}</td>
                          <td style={{ padding:"8px 12px" }}>
                            <div style={{ display:"flex", gap:4 }}>
                              <button onClick={()=>setModal({...emp})} style={{ padding:"3px 8px", borderRadius:5, border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:11 }}>✏</button>
                              <button onClick={()=>setConfirmar(emp)} style={{ padding:"3px 8px", borderRadius:5, border:"1px solid #7f1d1d30", background:"transparent", color:"#f87171", cursor:"pointer", fontSize:11 }}>🗑</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>}
          </div>
        </div>
      )}

      {/* ══ VIEW: EMPRESAS ══ */}
      {view==="empresas" && (
        <div style={{ flex:1, overflowY:"auto", padding:"20px 16px", maxWidth:1000, margin:"0 auto", width:"100%", boxSizing:"border-box" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:18 }}>
            <div>
              <div style={{ fontSize:17, fontWeight:800, color:"#e2e8f0" }}>🏢 Empresas</div>
              <div style={{ fontSize:11, color:"#334155", marginTop:2 }}>{empresas.length} cadastrada{empresas.length!==1?"s":""}</div>
            </div>
            <button onClick={()=>setModal(empVazio())}
              style={{ padding:"8px 18px", borderRadius:9, border:"none",
                background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff",
                cursor:"pointer", fontSize:13, fontWeight:800, boxShadow:"0 4px 14px #16A34A40" }}>
              + Nova Empresa
            </button>
          </div>

          {empresas.length===0
            ? <div style={{ textAlign:"center", padding:"60px 16px" }}>
                <div style={{ fontSize:42, marginBottom:12, opacity:.22 }}>🏢</div>
                <div style={{ fontSize:14, fontWeight:700, color:"#1e293b", marginBottom:6 }}>Banco vazio</div>
                <div style={{ fontSize:11.5, color:"#1e293b", marginBottom:18 }}>Cadastre a primeira empresa para começar</div>
                <button onClick={()=>setModal(empVazio())} style={{ padding:"9px 22px", borderRadius:9, border:"none",
                  background:"linear-gradient(135deg,#16A34A,#15803D)", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:800 }}>
                  Cadastrar empresa
                </button>
              </div>
            : <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(280px,1fr))", gap:12 }}>
                {empresas.map(emp=>(
                  <div key={emp.id}
                    style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:12, overflow:"hidden", transition:"transform .18s" }}
                    onMouseEnter={e=>e.currentTarget.style.transform="translateY(-2px)"}
                    onMouseLeave={e=>e.currentTarget.style.transform="none"}>
                    <div style={{ height:60, position:"relative", overflow:"hidden",
                      background:emp.papelTimbrado?"transparent":`linear-gradient(135deg,${emp.corPrimaria},${emp.corSecundaria})` }}>
                      {emp.papelTimbrado&&<img src={emp.papelTimbrado} style={{ width:"100%", height:"100%", objectFit:"cover", objectPosition:"top" }} alt="" />}
                      {emp.logo
                        ? <img src={emp.logo} style={{ position:"absolute", [emp.posicaoLogo==="direita"?"right":"left"]:10,
                            top:"50%", transform:"translateY(-50%)", maxHeight:32, maxWidth:80, objectFit:"contain" }} alt="" />
                        : !emp.papelTimbrado&&<div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", padding:"0 12px" }}>
                            <span style={{ fontFamily:emp.fonteTitulo, fontSize:14, fontWeight:900, color:"#fff" }}>{emp.nome}</span>
                          </div>}
                    </div>
                    <div style={{ padding:"11px 14px" }}>
                      <div style={{ fontSize:13, fontWeight:700, color:"#e2e8f0", marginBottom:2 }}>{emp.nome}</div>
                      <div style={{ fontSize:10, color:"#334155", marginBottom:8 }}>{emp.cnpj||"—"} · {emp.email||"—"}</div>
                      <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:10 }}>
                        <span style={{ padding:"2px 7px", background:emp.corPrimaria+"20", color:emp.corPrimaria,
                          borderRadius:10, fontSize:9, fontWeight:700, border:`1px solid ${emp.corPrimaria}33` }}>{emp.tom}</span>
                        {(emp.dnaLinguagem||"").length>50&&<span style={{ padding:"2px 7px", background:"#16A34A14", color:"#4ade80", borderRadius:10, fontSize:9, fontWeight:600 }}>✍️ DNA</span>}
                        {emp.papelTimbrado&&<span style={{ padding:"2px 7px", background:"#16A34A14", color:"#4ade80", borderRadius:10, fontSize:9, fontWeight:600 }}>📄</span>}
                        {emp.logo&&<span style={{ padding:"2px 7px", background:"#2563EB14", color:"#93c5fd", borderRadius:10, fontSize:9, fontWeight:600 }}>🖼</span>}
                      </div>
                      <div style={{ display:"flex", gap:6 }}>
                        <button onClick={()=>setModal({...emp})} style={{ flex:1, padding:"6px", borderRadius:6,
                          border:"1px solid #1e293b", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:11, fontWeight:600 }}>✏ Editar</button>
                        <button onClick={()=>setConfirmar(emp)} style={{ padding:"6px 10px", borderRadius:6,
                          border:"1px solid #7f1d1d30", background:"transparent", color:"#f87171", cursor:"pointer", fontSize:11 }}>🗑</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>}
        </div>
      )}

      {/* ══ VIEW: ORÇAMENTO ══ */}
      {view==="orcamento" && (
        <div style={{ flex:1, display:"flex", overflow:"hidden" }}>

          {/* SIDEBAR */}
          <div style={{ width:252, background:"#0a1420", borderRight:"1px solid #1a2840",
            display:"flex", flexDirection:"column", flexShrink:0 }}>

            <div style={{ padding:"11px 12px 7px", borderBottom:"1px solid #1a2840", flexShrink:0 }}>
              <div style={{ fontSize:8.5, fontWeight:700, color:"#4ade80", letterSpacing:2 }}>SELECIONAR EMPRESAS</div>
              <div style={{ fontSize:10, color:"#1e293b", marginTop:1 }}>Até {MAX} · valor individual</div>
            </div>

            {/* Lista de empresas */}
            <div style={{ flex:1, overflowY:"auto", padding:"7px 8px" }}>
              {empresas.length===0
                ? <div style={{ padding:"20px 8px", textAlign:"center" }}>
                    <div style={{ fontSize:24, opacity:.18, marginBottom:7 }}>🏢</div>
                    <div style={{ fontSize:10.5, color:"#1e293b", lineHeight:1.6, marginBottom:10 }}>Nenhuma empresa cadastrada</div>
                    <button onClick={()=>setView("empresas")} style={{ padding:"5px 12px", borderRadius:6,
                      border:"1px solid #16A34A40", background:"transparent", color:"#4ade80",
                      cursor:"pointer", fontSize:11, fontWeight:700 }}>Cadastrar →</button>
                  </div>
                : empresas.map(emp=>{
                    const s     = selecao.find(x=>x.empId===emp.id);
                    const isSel = !!s;
                    const bloq  = !isSel && selecao.length>=MAX;
                    const ord   = selecao.findIndex(x=>x.empId===emp.id)+1;
                    return (
                      <div key={emp.id} style={{ marginBottom:7, borderRadius:9, overflow:"hidden",
                        border:`2px solid ${isSel?emp.corPrimaria:"#1e293b"}`,
                        opacity:bloq?.35:1, transition:"all .18s" }}>

                        {/* Linha da empresa */}
                        <div onClick={()=>!bloq&&toggleSel(emp.id)}
                          style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 10px",
                            background:isSel?emp.corPrimaria+"18":"#050b14",
                            cursor:bloq?"not-allowed":"pointer" }}>
                          <div style={{ width:26, height:26, borderRadius:6, background:emp.corPrimaria,
                            display:"flex", alignItems:"center", justifyContent:"center",
                            flexShrink:0, overflow:"hidden" }}>
                            {emp.logo
                              ? <img src={emp.logo} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt="" />
                              : <span style={{ color:"#fff", fontSize:9, fontWeight:900 }}>{emp.nome.slice(0,2).toUpperCase()}</span>}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:11.5, fontWeight:700, color:"#e2e8f0",
                              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{emp.nome}</div>
                            <div style={{ fontSize:9, color:"#334155", display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{emp.tom}</span>
                              {(emp.dnaLinguagem||"").length>50&&<span style={{ color:"#4ade80", flexShrink:0 }}>✍️</span>}
                            </div>
                          </div>
                          <div style={{ width:17, height:17, borderRadius:"50%",
                            border:`2px solid ${isSel?emp.corPrimaria:"#334155"}`,
                            background:isSel?emp.corPrimaria:"transparent",
                            display:"flex", alignItems:"center", justifyContent:"center",
                            fontSize:8.5, color:"#fff", fontWeight:800, flexShrink:0 }}>
                            {isSel?ord:""}
                          </div>
                        </div>

                        {/* Campo de valor */}
                        {isSel && (
                          <div style={{ padding:"8px 10px", background:emp.corPrimaria+"0c",
                            borderTop:`1px solid ${emp.corPrimaria}22` }}>
                            <div style={{ fontSize:8, fontWeight:700, color:emp.corPrimaria,
                              letterSpacing:1.3, marginBottom:4 }}>VALOR GLOBAL (R$)</div>
                            <div style={{ display:"flex", alignItems:"center", gap:4 }}>
                              <span style={{ fontSize:11, color:"#475569", fontWeight:700, flexShrink:0 }}>R$</span>
                              <input type="number" value={s.valorGlobal}
                                onChange={e=>setValor(emp.id,e.target.value)}
                                placeholder="0,00" onClick={e=>e.stopPropagation()}
                                style={{ flex:1, background:"#050b14",
                                  border:`1px solid ${emp.corPrimaria}44`, borderRadius:5,
                                  padding:"5px 7px", color:"#f0f4f8", fontSize:13,
                                  fontWeight:800, outline:"none", boxSizing:"border-box", width:"100%" }}
                                onFocus={e=>{e.stopPropagation();e.target.style.borderColor=emp.corPrimaria;}}
                                onBlur={e=>e.target.style.borderColor=emp.corPrimaria+"44"}
                              />
                            </div>
                            {s.valorGlobal&&parseFloat(s.valorGlobal)>0&&(
                              <div style={{ fontSize:10.5, color:emp.corPrimaria, marginTop:3, fontWeight:700 }}>→ {brl(s.valorGlobal)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
            </div>

            {/* Footer sidebar */}
            <div style={{ padding:"9px 8px", borderTop:"1px solid #1a2840", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:7 }}>
                <div style={{ fontSize:9.5, color:selecao.length===MAX?"#f59e0b":"#334155" }}>
                  {selecao.length}/{MAX} selecionadas
                </div>
                <div style={{ display:"flex", gap:3 }}>
                  {[0,1,2].map(i=><div key={i} style={{ width:5, height:5, borderRadius:"50%",
                    background:i<selecao.length?"#16A34A":"#1e293b" }} />)}
                </div>
              </div>

              {step==="montagem" && (
                <button onClick={handleGerar} disabled={!canGerar||gerando}
                  style={{ width:"100%", padding:"10px 6px", borderRadius:8, border:"none",
                    cursor:(!canGerar||gerando)?"not-allowed":"pointer",
                    background:canGerar&&!gerando?"linear-gradient(135deg,#16A34A,#15803D)":"#1e293b",
                    color:canGerar&&!gerando?"#fff":"#334155",
                    fontSize:12, fontWeight:800, lineHeight:1.4,
                    boxShadow:canGerar&&!gerando?"0 4px 14px #16A34A40":"none", transition:"all .2s" }}>
                  {gerando ? `⚙ ${iaStatus}` : `✨ Gerar ${selecao.length>0?selecao.length:""} Orçamento${selecao.length!==1?"s":""}`}
                </button>
              )}
              {step==="preview" && (
                <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                  <button onClick={()=>setStep("exportacao")}
                    style={{ width:"100%", padding:"9px", borderRadius:8, border:"none",
                      cursor:"pointer", background:"linear-gradient(135deg,#16A34A,#15803D)",
                      color:"#fff", fontSize:11.5, fontWeight:800, boxShadow:"0 4px 12px #16A34A40" }}>
                    ✅ Aprovar e Exportar
                  </button>
                  <button onClick={()=>{setStep("montagem");setOrcamentos({});setActiveTab(null);setEditando(false);}}
                    style={{ width:"100%", padding:"6px", borderRadius:8, border:"1px solid #334155",
                      background:"transparent", color:"#475569", cursor:"pointer", fontSize:10.5 }}>
                    ← Voltar
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ÁREA CENTRAL */}
          <div style={{ flex:1, overflowY:"auto", display:"flex", flexDirection:"column" }}>

            {/* ─ MONTAGEM ─ */}
            {step==="montagem" && (
              <div style={{ padding:"16px", display:"flex", flexDirection:"column", gap:13, maxWidth:780 }}>

                {/* Cliente */}
                <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:11, padding:"14px 16px" }}>
                  <div style={{ fontSize:8.5, fontWeight:700, color:"#4ade80", letterSpacing:2, marginBottom:10 }}>📋 DADOS DO ORÇAMENTO</div>
                  <div style={{ fontSize:9, color:"#475569", fontWeight:700, letterSpacing:1, marginBottom:5 }}>CLIENTE / EMPRESA DESTINATÁRIA *</div>
                  <input value={cliente} onChange={e=>setCliente(e.target.value)}
                    placeholder="Ex: Grupo Industrial Martins S.A." style={INP}
                    onFocus={e=>e.target.style.borderColor="#16A34A"}
                    onBlur={e=>e.target.style.borderColor="#1e293b"} />
                </div>

                {/* Texto do serviço */}
                <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:11, padding:"14px 16px" }}>
                  <div style={{ fontSize:8.5, fontWeight:700, color:"#4ade80", letterSpacing:2, marginBottom:5 }}>✍️ DESCRIÇÃO DO SERVIÇO *</div>
                  <div style={{ fontSize:11, color:"#334155", marginBottom:10, lineHeight:1.6 }}>
                    Descreva o serviço com detalhes. A IA lê o texto, extrai os itens e personaliza cada orçamento com a linguagem de cada empresa.
                  </div>
                  <textarea value={texto} onChange={e=>setTexto(e.target.value)} rows={8}
                    placeholder={"Descreva o serviço completo aqui...\n\nEx: Desenvolvimento de sistema web para gestão de estoque, incluindo levantamento de requisitos, prototipação, front-end, back-end, integração com ERP, testes, treinamento e suporte pós-implantação."}
                    style={{ ...INP, resize:"vertical", minHeight:150, lineHeight:1.75 }}
                    onFocus={e=>e.target.style.borderColor="#16A34A"}
                    onBlur={e=>e.target.style.borderColor="#1e293b"} />
                  <div style={{ display:"flex", justifyContent:"space-between", marginTop:5 }}>
                    <span style={{ fontSize:10, color:texto.length>60?"#4ade80":"#334155" }}>
                      {texto.length>60?"✓ Suficiente para análise":"⚠ Adicione mais detalhes"}
                    </span>
                    <span style={{ fontSize:10, color:"#1e293b" }}>{texto.length} chars</span>
                  </div>
                </div>

                {/* Observações */}
                <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:11, padding:"13px 16px" }}>
                  <div style={{ fontSize:8.5, fontWeight:700, color:"#334155", letterSpacing:2, marginBottom:8 }}>📌 OBSERVAÇÕES OPCIONAIS</div>
                  <textarea value={obs} onChange={e=>setObs(e.target.value)} rows={2}
                    placeholder="Prazos, condições especiais, restrições..."
                    style={{ ...INP, resize:"vertical" }}
                    onFocus={e=>e.target.style.borderColor="#47556960"}
                    onBlur={e=>e.target.style.borderColor="#1e293b"} />
                </div>

                {/* Resumo */}
                {selecao.length>0 && (
                  <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:11, padding:"13px 16px" }}>
                    <div style={{ fontSize:8.5, fontWeight:700, color:"#4ade80", letterSpacing:2, marginBottom:10 }}>📊 RESUMO DA GERAÇÃO</div>
                    <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                      {selecao.map((s,i)=>{
                        const emp=empresas.find(e=>e.id===s.empId);
                        if (!emp) return null;
                        return (
                          <div key={s.empId} style={{ padding:"9px 12px", background:emp.corPrimaria+"10",
                            border:`1px solid ${emp.corPrimaria}28`, borderRadius:8,
                            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                            <div>
                              <div style={{ fontSize:12, fontWeight:700, color:"#e2e8f0" }}>
                                <span style={{ opacity:.45, marginRight:5 }}>#{i+1}</span>{emp.nome}
                              </div>
                              {(emp.dnaLinguagem||"").length>50&&(
                                <div style={{ fontSize:9.5, color:"#4ade80", marginTop:2 }}>✍️ DNA de linguagem configurado</div>
                              )}
                            </div>
                            <div style={{ fontSize:13, fontWeight:800, color:emp.corPrimaria }}>
                              {s.valorGlobal&&parseFloat(s.valorGlobal)>0 ? brl(s.valorGlobal) : <span style={{ color:"#1e293b", fontWeight:400, fontSize:11 }}>sem valor</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ─ PREVIEW ─ */}
            {step==="preview" && (
              <div style={{ padding:"14px 16px" }}>
                {/* Tabs */}
                <div style={{ display:"flex", gap:6, marginBottom:12, flexWrap:"wrap",
                  alignItems:"center", justifyContent:"space-between" }}>
                  <div style={{ display:"flex", gap:5, flexWrap:"wrap" }}>
                    {empsSel.map(emp=>(
                      <button key={emp.id} onClick={()=>setActiveTab(emp.id)}
                        style={{ padding:"6px 13px", borderRadius:7, cursor:"pointer", fontSize:12,
                          fontWeight:700, border:`2px solid ${activeTab===emp.id?emp.corPrimaria:"#1e293b"}`,
                          background:activeTab===emp.id?emp.corPrimaria+"1e":"#0a1420",
                          color:activeTab===emp.id?"#fff":"#475569", transition:"all .15s" }}>
                        {emp.nome}
                        {orcamentos[emp.id]?.valorGlobal&&parseFloat(orcamentos[emp.id].valorGlobal)>0&&(
                          <span style={{ marginLeft:6, fontSize:10, opacity:.75 }}>{brl(orcamentos[emp.id].valorGlobal)}</span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button onClick={()=>setEditando(v=>!v)}
                    style={{ padding:"6px 12px", borderRadius:7, cursor:"pointer", fontSize:11.5,
                      fontWeight:700, border:`1px solid ${editando?"#f59e0b":"#334155"}`,
                      background:editando?"#f59e0b14":"transparent",
                      color:editando?"#fbbf24":"#475569", flexShrink:0 }}>
                    {editando?"✏ Editando":"✏ Editar"}
                  </button>
                </div>

                {/* Banner IA */}
                <div style={{ marginBottom:12, padding:"7px 13px", background:"#2563EB12",
                  border:"1px solid #2563EB22", borderRadius:8, fontSize:11, color:"#93c5fd",
                  display:"flex", gap:7, alignItems:"flex-start" }}>
                  <span style={{ flexShrink:0 }}>✨</span>
                  <span>Conteúdo gerado com DNA de linguagem de cada empresa · identidade visual aplicada · ative <strong>Editar</strong> para ajustes.</span>
                </div>

                {/* Orçamento */}
                {activeTab && orcamentos[activeTab] && (()=>{
                  const emp=empresas.find(e=>e.id===activeTab);
                  if (!emp) return <div style={{ color:"#334155", padding:16 }}>Empresa não encontrada.</div>;
                  return <OrcamentoDoc emp={emp} dados={orcamentos[activeTab]}
                    editando={editando} onChange={(c,v)=>fieldChange(activeTab,c,v)} />;
                })()}
              </div>
            )}

            {/* ─ EXPORTAÇÃO ─ */}
            {step==="exportacao" && (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"28px 16px" }}>
                <div style={{ width:"100%", maxWidth:520 }}>
                  <div style={{ textAlign:"center", marginBottom:24 }}>
                    <div style={{ fontSize:44, marginBottom:10 }}>✅</div>
                    <div style={{ fontSize:18, fontWeight:800, color:"#e2e8f0", marginBottom:4 }}>Orçamentos Aprovados!</div>
                    <div style={{ fontSize:11.5, color:"#334155" }}>{empsSel.length} proposta{empsSel.length!==1?"s":""} prontas</div>
                  </div>

                  {/* Documentos */}
                  <div style={{ background:"#0a1420", border:"1px solid #1a2840", borderRadius:12, padding:14, marginBottom:14 }}>
                    <div style={{ fontSize:8.5, fontWeight:700, color:"#4ade80", letterSpacing:2, marginBottom:12 }}>DOCUMENTOS GERADOS</div>
                    {empsSel.map(emp=>(
                      <div key={emp.id} style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                        padding:"9px 12px", background:"#050b14", borderRadius:8,
                        border:`1px solid ${emp.corPrimaria}18`, marginBottom:7 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:9 }}>
                          <div style={{ width:28, height:28, borderRadius:7, background:emp.corPrimaria,
                            display:"flex", alignItems:"center", justifyContent:"center", overflow:"hidden", flexShrink:0 }}>
                            {emp.logo?<img src={emp.logo} style={{ width:"100%", height:"100%", objectFit:"contain" }} alt="" />
                              :<span style={{ color:"#fff", fontSize:9.5, fontWeight:900 }}>{emp.nome.slice(0,2)}</span>}
                          </div>
                          <div>
                            <div style={{ fontSize:12.5, fontWeight:700, color:"#e2e8f0" }}>{emp.nome}</div>
                            <div style={{ fontSize:9.5, color:"#334155" }}>
                              {orcamentos[emp.id]?.numero}
                              {orcamentos[emp.id]?.valorGlobal&&parseFloat(orcamentos[emp.id].valorGlobal)>0?` · ${brl(orcamentos[emp.id].valorGlobal)}`:""}
                              {emp.papelTimbrado?" · 📄":""}
                            </div>
                          </div>
                        </div>
                        <div style={{ padding:"3px 10px", borderRadius:14, background:"#16A34A18",
                          border:"1px solid #16A34A30", fontSize:9.5, color:"#4ade80", fontWeight:700 }}>Pronto</div>
                      </div>
                    ))}
                  </div>

                  {/* Opções */}
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
                    {[["📄","PDF por Empresa","#2563EB"],["📦","ZIP — Todos","#16A34A"],
                      ["📝","Word (.docx)","#7c3aed"],["🔗","Link Compartilhável","#dc2626"]].map(([ic,lb,cor])=>(
                      <div key={lb} style={{ background:"#0a1420", border:`1px solid ${cor}20`,
                        borderRadius:10, padding:"12px 14px", cursor:"pointer", transition:"all .18s" }}
                        onMouseEnter={e=>{e.currentTarget.style.background=cor+"0e";e.currentTarget.style.borderColor=cor+"55";}}
                        onMouseLeave={e=>{e.currentTarget.style.background="#0a1420";e.currentTarget.style.borderColor=cor+"20";}}>
                        <div style={{ fontSize:20, marginBottom:5 }}>{ic}</div>
                        <div style={{ fontSize:12.5, fontWeight:700, color:"#e2e8f0" }}>{lb}</div>
                      </div>
                    ))}
                  </div>

                  <button onClick={resetOrcamento}
                    style={{ width:"100%", padding:"9px", borderRadius:8, border:"1px solid #1e293b",
                      background:"transparent", color:"#334155", cursor:"pointer", fontSize:11.5 }}>
                    ← Criar novo orçamento
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ══ MODAL EMPRESA ══ */}
      {modal && <ModalEmpresa empresa={modal} onSave={handleSalvar} onCancel={()=>setModal(null)} salvando={salvando} />}

      {/* ══ CONFIRMAR EXCLUSÃO ══ */}
      {confirmar && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", zIndex:3000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#0a1525", border:"1px solid #7f1d1d40", borderRadius:13,
            padding:"24px 26px", maxWidth:380, width:"100%", textAlign:"center",
            boxShadow:"0 16px 60px rgba(0,0,0,.8)" }}>
            <div style={{ fontSize:32, marginBottom:10 }}>⚠️</div>
            <div style={{ fontSize:14, fontWeight:800, color:"#f87171", marginBottom:6 }}>Excluir empresa?</div>
            <div style={{ fontSize:12, color:"#64748b", marginBottom:4 }}>Esta ação é permanente.</div>
            <div style={{ fontSize:13.5, fontWeight:700, color:"#e2e8f0", marginBottom:20 }}>"{confirmar.nome}"</div>
            <div style={{ display:"flex", gap:9, justifyContent:"center" }}>
              <button onClick={()=>setConfirmar(null)} style={{ padding:"8px 18px", borderRadius:8,
                border:"1px solid #334155", background:"transparent", color:"#64748b", cursor:"pointer", fontSize:12.5, fontWeight:600 }}>Cancelar</button>
              <button onClick={handleExcluir} style={{ padding:"8px 18px", borderRadius:8,
                border:"none", background:"#dc2626", color:"#fff", cursor:"pointer", fontSize:12.5, fontWeight:800 }}>Excluir</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ LOG AUDITORIA ══ */}
      {logOpen && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.9)", zIndex:3000,
          display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#0a1525", border:"1px solid #1e2d3d", borderRadius:13,
            width:"100%", maxWidth:600, maxHeight:"78vh", overflow:"hidden",
            display:"flex", flexDirection:"column" }}>
            <div style={{ padding:"13px 18px", borderBottom:"1px solid #1a2332",
              display:"flex", justifyContent:"space-between", alignItems:"center", flexShrink:0 }}>
              <div style={{ fontSize:13.5, fontWeight:800, color:"#e2e8f0" }}>📋 Log de Auditoria</div>
              <button onClick={()=>setLogOpen(false)} style={{ background:"transparent", border:"1px solid #334155",
                color:"#64748b", width:26, height:26, borderRadius:6, cursor:"pointer", fontSize:13 }}>✕</button>
            </div>
            <div style={{ overflowY:"auto", padding:"12px 18px", flex:1 }}>
              {logData.length===0
                ? <div style={{ textAlign:"center", color:"#334155", padding:"24px", fontSize:13 }}>Nenhuma operação registrada</div>
                : logData.map((log,i)=>{
                    const C={INSERT:"#16A34A",UPDATE:"#2563EB",DELETE:"#dc2626",IMPORT:"#7c3aed"};
                    return (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:10,
                        padding:"8px 11px", background:i%2===0?"#060d18":"transparent",
                        borderRadius:7, marginBottom:3 }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:C[log.acao]||"#475569", flexShrink:0 }} />
                        <div style={{ width:58, fontSize:9, fontWeight:700, color:C[log.acao]||"#475569", letterSpacing:1 }}>{log.acao}</div>
                        <div style={{ flex:1, fontSize:12, color:"#94a3b8" }}>{log.nome}</div>
                        <div style={{ fontSize:9.5, color:"#334155", fontFamily:"monospace" }}>{tsFmt(log.ts)}</div>
                      </div>
                    );
                  })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
