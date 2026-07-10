import React, { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, Copy, MessageCircle, RefreshCw, ShieldCheck } from "lucide-react";
import { authHeaders } from "./supabase.js";
import { store } from "./store.js";

export const KEY_WHATSAPP_INBOX = "orcaflow_whatsapp_inbox";
const KEY_CLIENTES_CRM = "orcaflow_clientes_crm";

const C = {
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

function clean(valor = "", limite = 3000) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function onlyDigits(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function tsFmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function brl(valor) {
  const n = Number(String(valor ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
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

function agruparPorContato(inbox = []) {
  const map = new Map();
  for (const msg of inbox) {
    const key = msg.from || msg.clienteId || "sem_numero";
    const atual = map.get(key) || {
      key,
      phone: msg.from || "",
      clienteId: msg.clienteId || "",
      clienteNome: msg.clienteNome || msg.profileName || msg.from || "Contato WhatsApp",
      profileName: msg.profileName || "",
      mensagens: [],
      naoLidas: 0,
      ultimo: null,
    };
    atual.mensagens.push(msg);
    if (msg.status === "novo") atual.naoLidas += 1;
    if (!atual.ultimo || new Date(msg.receivedAt || 0) > new Date(atual.ultimo.receivedAt || 0)) atual.ultimo = msg;
    map.set(key, atual);
  }
  return [...map.values()]
    .map((grupo) => ({
      ...grupo,
      mensagens: grupo.mensagens.sort((a, b) => new Date(a.receivedAt || 0) - new Date(b.receivedAt || 0)),
    }))
    .sort((a, b) => new Date(b.ultimo?.receivedAt || 0) - new Date(a.ultimo?.receivedAt || 0));
}

function orcamentosDoCliente(grupo, crm = []) {
  const alvo = clean(grupo?.clienteNome || grupo?.profileName || "", 160).toLowerCase();
  const phone = onlyDigits(grupo?.phone || "");
  return (Array.isArray(crm) ? crm : []).filter((orc) => {
    const texto = [orc.cliente, orc.numero, orc.empresaNome, orc.lembreteIA, orc.resumoConversas].filter(Boolean).join(" ").toLowerCase();
    return (alvo && texto.includes(alvo)) || (phone && texto.includes(phone.slice(-8)));
  });
}

export function WhatsAppInboxPanel({
  crm = [],
  clientes = [],
  setClientes,
  empresas = [],
  pushToast,
  usuarioAtual,
}) {
  const [inbox, setInbox] = useState([]);
  const [busca, setBusca] = useState("");
  const [ativoKey, setAtivoKey] = useState("");
  const [resposta, setResposta] = useState("");
  const [loading, setLoading] = useState(false);
  const [atualizando, setAtualizando] = useState(false);

  const carregar = async (silencioso = false) => {
    if (!silencioso) setAtualizando(true);
    try {
      const dados = await store.get(KEY_WHATSAPP_INBOX);
      setInbox(Array.isArray(dados) ? dados : []);
      const clientesAtualizados = await store.get(KEY_CLIENTES_CRM);
      if (typeof setClientes === "function" && Array.isArray(clientesAtualizados)) {
        setClientes(clientesAtualizados);
      }
    } finally {
      setAtualizando(false);
    }
  };

  useEffect(() => {
    carregar(true);
    const id = setInterval(() => carregar(true), 30000);
    return () => clearInterval(id);
  }, []);

  const grupos = useMemo(() => agruparPorContato(inbox), [inbox]);
  const filtrados = useMemo(() => {
    const q = busca.toLowerCase().trim();
    if (!q) return grupos;
    return grupos.filter((grupo) => [grupo.clienteNome, grupo.profileName, grupo.phone, grupo.ultimo?.text].filter(Boolean).join(" ").toLowerCase().includes(q));
  }, [grupos, busca]);
  const ativo = grupos.find((grupo) => grupo.key === ativoKey) || filtrados[0] || null;
  const mensagens = ativo?.mensagens || [];
  const relacionados = useMemo(() => ativo ? orcamentosDoCliente(ativo, crm) : [], [ativo, crm]);
  const clienteCRM = ativo?.clienteId ? clientes.find((item) => item.id === ativo.clienteId) : null;

  useEffect(() => {
    if (!ativoKey && filtrados[0]?.key) setAtivoKey(filtrados[0].key);
  }, [ativoKey, filtrados]);

  const salvarInbox = async (lista) => {
    setInbox(lista);
    const ok = await store.set(KEY_WHATSAPP_INBOX, lista);
    if (!ok) pushToast("Nao foi possivel salvar a caixa WhatsApp na nuvem.", "erro");
    return ok;
  };

  const marcarComoLido = async () => {
    if (!ativo) return;
    const atualizada = inbox.map((msg) => msg.from === ativo.phone ? { ...msg, status: "lido" } : msg);
    await salvarInbox(atualizada);
    pushToast("Conversa marcada como acompanhada.", "ok");
  };

  const copiar = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      pushToast("Resposta copiada.", "ok");
    } catch {
      pushToast("Nao foi possivel copiar.", "erro");
    }
  };

  const abrirWhats = (texto = resposta) => {
    const numero = onlyDigits(ativo?.phone || "");
    if (!numero) {
      pushToast("Contato sem numero de WhatsApp.", "erro");
      return;
    }
    window.open(`https://wa.me/${numero}?text=${encodeURIComponent(texto || "")}`, "_blank", "noopener,noreferrer");
    pushToast("WhatsApp externo aberto. Revise e clique em enviar manualmente.", "ok");
  };

  const gerarResposta = async () => {
    if (!ativo || loading) return;
    setLoading(true);
    try {
      const linha = mensagens.slice(-12).map((msg) => {
        const lado = msg.direction === "entrada" ? "CLIENTE" : "EMPRESA";
        return `${tsFmt(msg.receivedAt)} | ${lado}: ${clean(msg.text, 900)}`;
      }).join("\n");
      const orcs = relacionados.slice(0, 5).map((orc) => `${orc.numero || "sem numero"} - ${orc.cliente || ""} - ${brl(orc.valorGlobal || orc.valor)} - ${orc.status || "Aberto"}`).join("\n");
      const pedido = [
        "Nara, gere uma resposta curta de WhatsApp para este cliente.",
        "Regras: nao diga que enviou; nao invente prazo, desconto, garantia ou condicao; seja humana, comercial e objetiva.",
        "Se faltar alguma informacao, faca uma pergunta clara ao cliente.",
        "",
        `Cliente: ${ativo.clienteNome || ativo.profileName || ativo.phone}`,
        `Telefone: ${ativo.phone}`,
        clienteCRM ? `Perfil CRM: ${clienteCRM.perfil || clienteCRM.observacoes || ""}` : "",
        orcs ? `Orcamentos relacionados:\n${orcs}` : "Sem orcamento relacionado identificado.",
        "",
        `Historico real recebido pelo WhatsApp:\n${linha}`,
      ].filter(Boolean).join("\n");

      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode: "whatsapp",
          messages: [{ role: "user", content: pedido }],
          context: { empresas, crm, clientesCRM: clientes },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao consultar a Nara.");
      setResposta(data.answer || "");
      pushToast("Nara preparou uma resposta assistida.", "ok");
    } catch (error) {
      console.error("Erro WhatsApp/Nara:", error);
      pushToast(error.message || "Erro ao gerar resposta.", "erro");
    } finally {
      setLoading(false);
    }
  };

  const INP = inputStyle();

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "330px 1fr", minHeight: 0, overflow: "hidden" }}>
      <aside style={{ borderRight: `1px solid ${C.border}`, background: "rgba(7,17,31,.72)", padding: 14, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 950 }}>WhatsApp CRM</div>
            <div style={{ color: C.dim, fontSize: 11 }}>{grupos.length} conversa(s) monitorada(s)</div>
          </div>
          <button onClick={() => carregar(false)} disabled={atualizando} style={{ border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 10px", background: "transparent", color: C.muted, cursor: atualizando ? "not-allowed" : "pointer", fontWeight: 900 }}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div style={{ border: `1px solid ${C.green2}44`, background: `${C.green2}10`, color: C.green, borderRadius: 12, padding: 10, fontSize: 11, lineHeight: 1.5, marginBottom: 10 }}>
          <ShieldCheck size={14} /> Historico auditado: mensagens recebidas via webhook oficial nao dependem de registro manual do funcionario.
        </div>

        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar contato, telefone ou mensagem..." style={{ ...INP, marginBottom: 10 }} />

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map((grupo) => {
            const selected = grupo.key === ativo?.key;
            return (
              <button key={grupo.key} onClick={() => setAtivoKey(grupo.key)} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}14` : C.panel2, color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 12.5 }}>{grupo.clienteNome || grupo.phone}</strong>
                  {grupo.naoLidas > 0 && <span style={{ color: C.green, fontSize: 10, fontWeight: 950 }}>{grupo.naoLidas} nova(s)</span>}
                </div>
                <div style={{ color: C.dim, fontSize: 10.5, marginTop: 3 }}>{grupo.phone}</div>
                <div style={{ color: "#93C5FD", fontSize: 10.5, marginTop: 6 }}>{clean(grupo.ultimo?.text, 130) || "Mensagem sem texto"}</div>
                <div style={{ color: C.dim, fontSize: 10, marginTop: 5 }}>{tsFmt(grupo.ultimo?.receivedAt)}</div>
              </button>
            );
          })}
          {!filtrados.length && <div style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: 20 }}>Nenhuma mensagem recebida ainda.</div>}
        </div>
      </aside>

      <main style={{ overflowY: "auto", padding: 18 }}>
        {!ativo ? (
          <div style={{ minHeight: 420, display: "grid", placeItems: "center", color: C.dim, textAlign: "center" }}>
            <div><MessageCircle size={44} style={{ opacity: 0.55 }} /><div style={{ marginTop: 10, fontWeight: 900 }}>Aguardando mensagens do WhatsApp.</div></div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(420px, 1fr) minmax(360px, .8fr)", gap: 16, alignItems: "start" }}>
            <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "flex-start", marginBottom: 14 }}>
                <div>
                  <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>CONVERSA REAL RECEBIDA</div>
                  <div style={{ fontSize: 20, fontWeight: 950 }}>{ativo.clienteNome || ativo.profileName || ativo.phone}</div>
                  <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>{ativo.phone}</div>
                </div>
                <button onClick={marcarComoLido} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 900 }}>
                  <CheckCircle2 size={14} /> Acompanhado
                </button>
              </div>

              <div style={{ display: "grid", gap: 9 }}>
                {mensagens.map((msg) => (
                  <div key={msg.waMessageId || msg.id} style={{ background: C.panel2, border: `1px solid ${msg.status === "novo" ? C.green2 : C.border2}55`, borderRadius: 12, padding: 11 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: 8, color: C.dim, fontSize: 10, marginBottom: 6 }}>
                      <span>WhatsApp recebido | {msg.type}</span>
                      <span>{tsFmt(msg.receivedAt)}</span>
                    </div>
                    <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 12.5 }}>{msg.text || "Mensagem sem texto pesquisavel."}</div>
                    {msg.mediaId && <div style={{ marginTop: 8, color: "#93C5FD", fontSize: 11 }}>Midia registrada: {msg.fileName || msg.mediaId}</div>}
                    <div style={{ marginTop: 8, color: C.green, fontSize: 10, fontWeight: 900 }}>Registro automatico auditavel</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ display: "grid", gap: 14 }}>
              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", marginBottom: 10 }}>
                  <div>
                    <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>NARA WHATSAPP</div>
                    <div style={{ color: C.dim, fontSize: 12 }}>Sugestao assistida, sem envio automatico.</div>
                  </div>
                  <button onClick={gerarResposta} disabled={loading} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: loading ? "not-allowed" : "pointer", fontWeight: 900 }}>
                    <Bot size={14} /> {loading ? "Pensando..." : "Sugerir resposta"}
                  </button>
                </div>
                <textarea value={resposta} onChange={(e) => setResposta(e.target.value)} rows={8} placeholder="A resposta da Nara aparece aqui. Voce pode editar antes de copiar ou abrir o WhatsApp..." style={{ ...INP, resize: "vertical", marginBottom: 10 }} />
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button onClick={() => copiar(resposta)} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 900 }}><Copy size={14} /> Copiar</button>
                  <button onClick={() => abrirWhats(resposta)} style={{ padding: "9px 12px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 900 }}><MessageCircle size={14} /> Abrir WhatsApp externo</button>
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>ORCAMENTOS RELACIONADOS</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {relacionados.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum orcamento relacionado identificado automaticamente.</div>}
                  {relacionados.slice(0, 6).map((orc) => (
                    <div key={orc.id || orc.numero} style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: 10 }}>
                      <div style={{ fontWeight: 900, fontSize: 12 }}>{orc.numero || "Orcamento"} - {orc.cliente || ativo.clienteNome}</div>
                      <div style={{ color: C.dim, fontSize: 11, marginTop: 3 }}>{orc.empresaNome || "Empresa"} | {brl(orc.valorGlobal || orc.valor)}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16, color: C.muted, fontSize: 12, lineHeight: 1.6 }}>
                <strong style={{ color: C.text }}>Como funciona:</strong> mensagens recebidas chegam pelo webhook oficial e ficam salvas como registro real. A resposta e assistida: a Nara sugere, voce revisa e envia pelo WhatsApp externo.
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
