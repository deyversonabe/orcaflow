import React, { useEffect, useMemo, useState } from "react";
import { authHeaders } from "./supabase.js";
import { store } from "./store.js";
import { Bot, CalendarClock, CheckCircle2, Copy, MessageCircle, Plus, RefreshCw, Search, Trash2 } from "lucide-react";

export const KEY_AGENDA_CLIENTES = "orcaflow_agenda_clientes";

const KEY_CLIENTES = "orcaflow_clientes_crm";
const KEY_CRM = "orcaflow_crm_orcamentos";

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
  purple: "#A78BFA",
};

function clean(valor = "", limite = 3000) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function textoBusca(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function onlyDigits(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function dataISOEmDias(dias = 0) {
  const d = new Date();
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

function diasAte(data) {
  if (!data) return null;
  const d = new Date(`${data}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - hoje) / 86400000);
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

function clienteNome(cliente = {}) {
  return clean(cliente.nome || cliente.empresa || "Cliente sem nome", 120);
}

function clienteContato(cliente = {}) {
  return cliente.whatsapp || cliente.telefone || cliente.telefone2 || cliente.email || cliente.email2 || "";
}

function orcamentosDoCliente(cliente = {}, crm = []) {
  const alvo = textoBusca([cliente.nome, cliente.empresa, cliente.documento, cliente.email, cliente.whatsapp, cliente.telefone].filter(Boolean).join(" "));
  if (!alvo) return [];
  return (Array.isArray(crm) ? crm : []).filter((item) => {
    const texto = textoBusca([item?.cliente, item?.empresaNome, item?.numero, item?.lembreteIA].filter(Boolean).join(" "));
    const clienteOrc = textoBusca(item?.cliente || "");
    return texto.includes(alvo) || (clienteOrc && alvo.includes(clienteOrc));
  });
}

function criarAgenda(usuarioAtual, dados = {}) {
  const agora = new Date().toISOString();
  return {
    id: dados.id || `ag_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    clienteId: dados.clienteId || "",
    orcamentoId: dados.orcamentoId || "",
    data: dados.data || hojeISO(),
    hora: dados.hora || "09:00",
    canal: dados.canal || "WhatsApp",
    tipo: dados.tipo || "Follow-up",
    prioridade: dados.prioridade || "Media",
    status: dados.status || "Pendente",
    assunto: dados.assunto || "",
    objetivo: dados.objetivo || "",
    resultado: dados.resultado || "",
    nara: dados.nara || "",
    origem: dados.origem || "Agenda manual",
    userId: dados.userId || usuarioAtual?.id || "admin",
    criadoEm: dados.criadoEm || agora,
    atualizadoEm: agora,
  };
}

function statusAgenda(item = {}) {
  if (item.status === "Concluido") return "Concluido";
  const dif = diasAte(item.data);
  if (dif !== null && dif < 0) return "Atrasado";
  if (dif === 0) return "Hoje";
  return "Proximo";
}

function corStatus(status) {
  if (status === "Atrasado") return C.danger;
  if (status === "Hoje") return C.warn;
  if (status === "Concluido") return C.green;
  return "#93C5FD";
}

function proximaMensagemPadrao(cliente, item, orcamento) {
  const nome = clienteNome(cliente).split(" ")[0];
  const ref = orcamento?.numero ? ` sobre o orcamento ${orcamento.numero}` : "";
  return clean(`Ola, ${nome}. Tudo bem? Estou fazendo um acompanhamento${ref}. Pode me confirmar se ficou alguma duvida ou se existe algum ponto que precisamos ajustar para dar andamento?`, 700);
}

function registroAgendaParaConversa(registro = {}, usuarioAtual) {
  return {
    id: `conv_${registro.id}`,
    followupId: registro.id,
    canal: registro.canal || "Agenda",
    direcao: "interna",
    tipo: registro.tipo || "Agenda",
    mensagem: clean(registro.mensagem || "", 6000),
    criadoEm: registro.criadoEm || new Date().toISOString(),
    origem: "agenda_clientes",
    usuarioNome: usuarioAtual?.nome || usuarioAtual?.email || "",
  };
}

function registroAgendaParaFollowup(registro = {}) {
  return {
    id: registro.id,
    tipo: registro.tipo || "Agenda",
    canal: registro.canal || "Agenda",
    conteudo: clean(registro.mensagem || registro.assunto || "Contato concluido pela agenda.", 6000),
    criadoEm: registro.criadoEm || new Date().toISOString(),
    origem: "agenda_clientes",
  };
}

export function AgendaClientesPanel({
  clientes = [],
  setClientes,
  crm = [],
  setCrm,
  pushToast,
  usuarioAtual,
}) {
  const [agenda, setAgenda] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("hoje");
  const [form, setForm] = useState(criarAgenda(usuarioAtual));
  const [selecionadoId, setSelecionadoId] = useState("");
  const [loadingNara, setLoadingNara] = useState("");
  const isAdmin = usuarioAtual?.tipo === "admin";

  const carregar = async () => {
    const dados = await store.get(KEY_AGENDA_CLIENTES);
    setAgenda(Array.isArray(dados) ? dados : []);
  };

  useEffect(() => {
    carregar();
  }, []);

  const clientesVisiveis = useMemo(
    () => (isAdmin ? clientes : clientes.filter((item) => item.userId === usuarioAtual?.id)),
    [clientes, isAdmin, usuarioAtual?.id]
  );

  useEffect(() => {
    if (!form.clienteId && clientesVisiveis[0]?.id) {
      setForm((f) => ({ ...f, clienteId: clientesVisiveis[0].id }));
    }
  }, [form.clienteId, clientesVisiveis]);

  const clienteForm = clientes.find((item) => item.id === form.clienteId) || null;
  const orcsForm = clienteForm ? orcamentosDoCliente(clienteForm, crm) : [];

  const enriquecida = useMemo(() => {
    return agenda
      .filter((item) => isAdmin || item.userId === usuarioAtual?.id)
      .map((item) => {
        const cliente = clientes.find((c) => c.id === item.clienteId) || {};
        const orcamento = crm.find((orc) => orc.id === item.orcamentoId) || null;
        return { ...item, _cliente: cliente, _orcamento: orcamento, _statusAgenda: statusAgenda(item) };
      })
      .sort((a, b) => `${a.data || "9999-12-31"} ${a.hora || "99:99"}`.localeCompare(`${b.data || "9999-12-31"} ${b.hora || "99:99"}`));
  }, [agenda, clientes, crm, isAdmin, usuarioAtual?.id]);

  const filtrada = useMemo(() => {
    const q = textoBusca(busca);
    return enriquecida.filter((item) => {
      const texto = textoBusca([item.assunto, item.objetivo, item.resultado, item.nara, clienteNome(item._cliente), clienteContato(item._cliente), item._orcamento?.numero].filter(Boolean).join(" "));
      const st = item._statusAgenda;
      const dif = diasAte(item.data);
      const matchFiltro =
        filtro === "todos" ||
        (filtro === "hoje" && st === "Hoje") ||
        (filtro === "atrasados" && st === "Atrasado") ||
        (filtro === "proximos" && st === "Proximo" && dif !== null && dif <= 7) ||
        (filtro === "concluidos" && st === "Concluido");
      return (!q || texto.includes(q)) && matchFiltro;
    });
  }, [enriquecida, busca, filtro]);

  const kpis = useMemo(() => ({
    hoje: enriquecida.filter((item) => item._statusAgenda === "Hoje").length,
    atrasados: enriquecida.filter((item) => item._statusAgenda === "Atrasado").length,
    proximos: enriquecida.filter((item) => item._statusAgenda === "Proximo" && diasAte(item.data) <= 7).length,
    concluidos: enriquecida.filter((item) => item._statusAgenda === "Concluido").length,
  }), [enriquecida]);

  const selecionado = enriquecida.find((item) => item.id === selecionadoId) || filtrada[0] || null;

  useEffect(() => {
    if (!selecionadoId && filtrada[0]?.id) setSelecionadoId(filtrada[0].id);
  }, [filtrada, selecionadoId]);

  const salvarAgenda = async (lista) => {
    setAgenda(lista);
    const ok = await store.set(KEY_AGENDA_CLIENTES, lista);
    if (!ok) pushToast("Nao foi possivel salvar a agenda na nuvem.", "erro");
    return ok;
  };

  const salvarClientes = async (lista) => {
    setClientes(lista);
    const ok = await store.set(KEY_CLIENTES, lista);
    if (!ok) pushToast("Nao foi possivel atualizar o CRM na nuvem.", "erro");
    return ok;
  };

  const salvarCrm = async (lista) => {
    if (typeof setCrm === "function") setCrm(lista);
    const ok = await store.set(KEY_CRM, lista);
    if (!ok) pushToast("Nao foi possivel atualizar o historico do orcamento na nuvem.", "erro");
    return ok;
  };

  const registrarNoOrcamento = async (orcamentoId, registro) => {
    if (!orcamentoId || !registro) return false;
    let mudou = false;
    const nova = (Array.isArray(crm) ? crm : []).map((orc) => {
      if (orc.id !== orcamentoId) return orc;
      const conversas = Array.isArray(orc.conversas) ? orc.conversas : [];
      const followups = Array.isArray(orc.followups) ? orc.followups : [];
      const existeConversa = conversas.some((msg) => msg.followupId === registro.id || msg.id === `conv_${registro.id}`);
      const existeFollowup = followups.some((msg) => msg.id === registro.id);
      if (existeConversa && existeFollowup) return orc;
      mudou = true;
      return {
        ...orc,
        conversas: existeConversa ? conversas : [registroAgendaParaConversa(registro, usuarioAtual), ...conversas].slice(0, 120),
        followups: existeFollowup ? followups : [registroAgendaParaFollowup(registro), ...followups].slice(0, 60),
        ultimoContatoEm: registro.criadoEm || new Date().toISOString(),
        lembreteIA: registro.mensagem ? clean(registro.mensagem, 260) : orc.lembreteIA,
        atualizadoEm: new Date().toISOString(),
      };
    });
    if (mudou) await salvarCrm(nova);
    return mudou;
  };

  const agendar = async () => {
    if (!form.clienteId) {
      pushToast("Selecione um cliente para agendar.", "erro");
      return;
    }
    if (!form.data) {
      pushToast("Informe a data do contato.", "erro");
      return;
    }
    const item = criarAgenda(usuarioAtual, form);
    await salvarAgenda([item, ...agenda]);
    const cliente = clientes.find((c) => c.id === item.clienteId);
    if (cliente) {
      const atualizados = clientes.map((c) => c.id === cliente.id ? {
        ...c,
        proximoContato: item.data,
        proximoPasso: item.objetivo || item.assunto || `Contato agendado por ${item.canal}`,
        atualizadoEm: new Date().toISOString(),
      } : c);
      await salvarClientes(atualizados);
    }
    setSelecionadoId(item.id);
    setForm(criarAgenda(usuarioAtual, { clienteId: item.clienteId, data: dataISOEmDias(1), hora: item.hora }));
    pushToast("Contato agendado e vinculado ao CRM.", "ok");
  };

  const atualizarItem = async (id, patch) => {
    const nova = agenda.map((item) => item.id === id ? { ...item, ...patch, atualizadoEm: new Date().toISOString() } : item);
    await salvarAgenda(nova);
  };

  const excluirItem = async (id) => {
    await salvarAgenda(agenda.filter((item) => item.id !== id));
    setSelecionadoId("");
    pushToast("Item removido da agenda.", "aviso");
  };

  const reagendar = async (item, dias) => {
    const novaData = dataISOEmDias(dias);
    await atualizarItem(item.id, { data: novaData, status: "Pendente" });
    if (item.clienteId) {
      await salvarClientes(clientes.map((c) => c.id === item.clienteId ? { ...c, proximoContato: novaData, atualizadoEm: new Date().toISOString() } : c));
    }
    pushToast(`Contato reagendado para ${novaData}.`, "ok");
  };

  const concluir = async (item) => {
    const cliente = clientes.find((c) => c.id === item.clienteId);
    if (!cliente) {
      pushToast("Cliente nao encontrado no CRM.", "erro");
      return;
    }
    const resultado = clean(window.prompt("Resultado do contato:", item.resultado || "") || item.resultado || "Contato realizado conforme agenda.", 2000);
    const orcamento = crm.find((orc) => orc.id === item.orcamentoId);
    const registro = {
      id: `ct_ag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      canal: item.canal,
      direcao: "Registro interno",
      tipo: item.tipo,
      assunto: item.assunto || "Contato da agenda",
      mensagem: resultado,
      orcamentoId: item.orcamentoId || "",
      orcamentoNumero: orcamento?.numero || "",
      criadoEm: new Date().toISOString(),
      userId: usuarioAtual?.id || "admin",
      origem: "agenda_clientes",
    };
    const atualizados = clientes.map((c) => c.id === cliente.id ? {
      ...c,
      contatos: [registro, ...(Array.isArray(c.contatos) ? c.contatos : [])].slice(0, 160),
      proximoPasso: "Contato concluido. Nara pode avaliar o proximo movimento.",
      atualizadoEm: new Date().toISOString(),
    } : c);
    await salvarClientes(atualizados);
    if (item.orcamentoId) {
      await registrarNoOrcamento(item.orcamentoId, registro);
    }
    await atualizarItem(item.id, { status: "Concluido", resultado });
    pushToast(item.orcamentoId ? "Contato concluido e gravado no cliente e no orcamento." : "Contato concluido e gravado no historico do CRM.", "ok");
  };

  const importarProximosDoCRM = async () => {
    const existentes = new Set(agenda.map((item) => `${item.clienteId}|${item.data}|${item.tipo}|${item.status}`).filter(Boolean));
    const novos = [];
    for (const cliente of clientesVisiveis) {
      if (!cliente.proximoContato) continue;
      const key = `${cliente.id}|${cliente.proximoContato}|Follow-up|Pendente`;
      if (existentes.has(key)) continue;
      novos.push(criarAgenda(usuarioAtual, {
        clienteId: cliente.id,
        data: cliente.proximoContato,
        hora: "09:00",
        canal: cliente.whatsapp ? "WhatsApp" : cliente.email ? "E-mail" : "Ligacao",
        tipo: "Follow-up",
        prioridade: diasAte(cliente.proximoContato) <= 0 ? "Alta" : "Media",
        assunto: "Retorno comercial CRM",
        objetivo: cliente.proximoPasso || cliente.lembreteJade || "Retomar contato conforme CRM.",
        origem: "CRM",
      }));
    }
    if (!novos.length) {
      pushToast("Nao ha novos proximos contatos do CRM para importar.", "aviso");
      return;
    }
    await salvarAgenda([...novos, ...agenda]);
    pushToast(`${novos.length} contato(s) do CRM entraram na agenda.`, "ok");
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      pushToast("Texto copiado.", "ok");
    } catch {
      pushToast("Nao foi possivel copiar.", "erro");
    }
  };

  const abrirWhats = (item, texto = "") => {
    const cliente = item._cliente || clientes.find((c) => c.id === item.clienteId) || {};
    const numero = onlyDigits(cliente.whatsapp || cliente.telefone || cliente.telefone2 || "");
    if (!numero) {
      pushToast("Cliente sem WhatsApp/telefone cadastrado.", "erro");
      return;
    }
    const orcamento = item._orcamento || crm.find((orc) => orc.id === item.orcamentoId);
    const msg = texto || item.nara || proximaMensagemPadrao(cliente, item, orcamento);
    window.open(`https://wa.me/55${numero.replace(/^55/, "")}?text=${encodeURIComponent(msg)}`, "_blank", "noopener,noreferrer");
    pushToast("WhatsApp externo aberto com mensagem pronta.", "ok");
  };

  const pedirNara = async (item) => {
    if (!item || loadingNara) return;
    setLoadingNara(item.id);
    try {
      const cliente = item._cliente || clientes.find((c) => c.id === item.clienteId) || {};
      const orcamento = item._orcamento || crm.find((orc) => orc.id === item.orcamentoId) || null;
      const historico = (Array.isArray(cliente.contatos) ? cliente.contatos : []).slice(0, 12).map((msg) => `${msg.canal || "Contato"} | ${msg.tipo || ""}: ${clean(msg.mensagem, 700)}`).join("\n");
      const pedido = [
        "Nara, prepare uma abordagem comercial para este contato de agenda.",
        "Seja humana, direta e estrategica. Nao invente prazo, desconto, garantia ou condicao.",
        "Entregue uma mensagem pronta de WhatsApp e um objetivo do contato.",
        "",
        `Usuario do sistema: ${usuarioAtual?.nomeTratamento || usuarioAtual?.nome || usuarioAtual?.email || "responsavel"}`,
        `Cliente: ${clienteNome(cliente)}`,
        `Contato: ${clienteContato(cliente) || "nao informado"}`,
        `Agenda: ${item.data} ${item.hora} | ${item.canal} | ${item.tipo} | prioridade ${item.prioridade}`,
        `Objetivo atual: ${item.objetivo || item.assunto || "sem objetivo informado"}`,
        orcamento ? `Orcamento vinculado: ${orcamento.numero || ""} | ${brl(orcamento.valorGlobal || orcamento.valor)} | ${orcamento.status || ""}` : "Sem orcamento vinculado.",
        cliente.perfil ? `Perfil do cliente: ${clean(cliente.perfil, 1000)}` : "",
        historico ? `Historico recente:\n${historico}` : "Sem historico recente.",
      ].filter(Boolean).join("\n");
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode: "agenda",
          messages: [{ role: "user", content: pedido }],
          context: {
            clientesCRM: clientes,
            crm,
            usuarioSistema: {
              nomeTratamento: usuarioAtual?.nomeTratamento || usuarioAtual?.nome || usuarioAtual?.email || "responsavel",
              assinatura: usuarioAtual?.nomeAssinatura || usuarioAtual?.nomeTratamento || usuarioAtual?.nome || "",
              cargo: usuarioAtual?.cargo || "",
              telefone: usuarioAtual?.telefone || "",
            },
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao consultar a Nara.");
      await atualizarItem(item.id, { nara: clean(data.answer || "", 3000) });
      pushToast("Nara preparou a abordagem da agenda.", "ok");
    } catch (error) {
      console.error("Erro Agenda/Nara:", error);
      pushToast(error.message || "Erro ao gerar abordagem.", "erro");
    } finally {
      setLoadingNara("");
    }
  };

  const INP = inputStyle();
  const LBL = { color: C.dim, fontSize: 10, fontWeight: 900, letterSpacing: 1.1, marginBottom: 6 };

  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "360px 1fr", minHeight: 0, overflow: "hidden" }}>
      <aside style={{ borderRight: `1px solid ${C.border}`, background: "rgba(7,17,31,.72)", padding: 14, overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 950 }}>Agenda de Clientes</div>
            <div style={{ color: C.dim, fontSize: 11 }}>Contatos vinculados ao CRM</div>
          </div>
          <button onClick={carregar} style={{ border: `1px solid ${C.border2}`, borderRadius: 10, padding: "8px 10px", background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 900 }}>
            <RefreshCw size={14} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {[
            ["Hoje", kpis.hoje, C.warn],
            ["Atrasados", kpis.atrasados, C.danger],
            ["7 dias", kpis.proximos, "#93C5FD"],
            ["Concluidos", kpis.concluidos, C.green],
          ].map(([label, valor, cor]) => (
            <button key={label} onClick={() => setFiltro(label === "Hoje" ? "hoje" : label === "Atrasados" ? "atrasados" : label === "7 dias" ? "proximos" : "concluidos")} style={{ textAlign: "left", border: `1px solid ${cor}44`, borderRadius: 12, padding: 10, background: `${cor}12`, color: C.text, cursor: "pointer" }}>
              <div style={{ color: cor, fontSize: 20, fontWeight: 950 }}>{valor}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{label}</div>
            </button>
          ))}
        </div>

        <button onClick={importarProximosDoCRM} style={{ width: "100%", marginBottom: 10, padding: "10px 12px", borderRadius: 11, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 950 }}>
          Importar proximos contatos do CRM
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8, ...INP, marginBottom: 10 }}>
          <Search size={14} color={C.dim} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, assunto, telefone..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontFamily: "inherit", fontSize: 12 }} />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            ["hoje", "Hoje"],
            ["atrasados", "Atrasados"],
            ["proximos", "7 dias"],
            ["concluidos", "Concluidos"],
            ["todos", "Todos"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{ padding: "7px 9px", borderRadius: 999, border: `1px solid ${filtro === id ? C.green2 : C.border2}`, background: filtro === id ? `${C.green2}18` : "transparent", color: filtro === id ? C.green : C.muted, cursor: "pointer", fontWeight: 850, fontSize: 11 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {filtrada.map((item) => {
            const selected = item.id === selecionado?.id;
            const st = item._statusAgenda;
            return (
              <button key={item.id} onClick={() => setSelecionadoId(item.id)} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}14` : C.panel2, color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 12.5 }}>{clienteNome(item._cliente)}</strong>
                  <span style={{ color: corStatus(st), fontSize: 10, fontWeight: 950 }}>{st}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 10.5, marginTop: 4 }}>{item.data} {item.hora} | {item.canal}</div>
                <div style={{ color: "#93C5FD", fontSize: 11, marginTop: 6 }}>{item.assunto || item.objetivo || item.tipo}</div>
              </button>
            );
          })}
          {!filtrada.length && <div style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: 22 }}>Nenhum contato na agenda para este filtro.</div>}
        </div>
      </aside>

      <main style={{ overflowY: "auto", padding: 18 }}>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(380px, .85fr) minmax(420px, 1.15fr)", gap: 16, alignItems: "start" }}>
          <section style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 14 }}>
              <div>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>NOVO CONTATO AGENDADO</div>
                <div style={{ color: C.dim, fontSize: 12 }}>Ao salvar, o CRM do cliente recebe o proximo contato.</div>
              </div>
              <Plus size={20} color={C.green} />
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <div>
                <div style={LBL}>CLIENTE</div>
                <select value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value, orcamentoId: "" }))} style={INP}>
                  <option value="">Selecione...</option>
                  {clientesVisiveis.map((cliente) => <option key={cliente.id} value={cliente.id}>{clienteNome(cliente)} - {clienteContato(cliente) || "sem contato"}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 110px", gap: 8 }}>
                <div>
                  <div style={LBL}>DATA</div>
                  <input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} style={INP} />
                </div>
                <div>
                  <div style={LBL}>HORA</div>
                  <input type="time" value={form.hora} onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))} style={INP} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <div style={LBL}>CANAL</div>
                  <select value={form.canal} onChange={(e) => setForm((f) => ({ ...f, canal: e.target.value }))} style={INP}>{["WhatsApp", "E-mail", "Ligacao", "Reuniao", "Visita"].map((op) => <option key={op}>{op}</option>)}</select>
                </div>
                <div>
                  <div style={LBL}>TIPO</div>
                  <select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))} style={INP}>{["Follow-up", "Cobranca", "Proposta", "Reuniao", "Pos-venda", "Retorno"].map((op) => <option key={op}>{op}</option>)}</select>
                </div>
                <div>
                  <div style={LBL}>PRIORIDADE</div>
                  <select value={form.prioridade} onChange={(e) => setForm((f) => ({ ...f, prioridade: e.target.value }))} style={INP}>{["Baixa", "Media", "Alta", "Critica"].map((op) => <option key={op}>{op}</option>)}</select>
                </div>
              </div>

              <div>
                <div style={LBL}>ORCAMENTO VINCULADO</div>
                <select value={form.orcamentoId} onChange={(e) => setForm((f) => ({ ...f, orcamentoId: e.target.value }))} style={INP}>
                  <option value="">Sem orcamento vinculado</option>
                  {orcsForm.map((orc) => <option key={orc.id} value={orc.id}>{orc.numero || "Orcamento"} - {brl(orc.valorGlobal || orc.valor)}</option>)}
                </select>
              </div>

              <div>
                <div style={LBL}>ASSUNTO</div>
                <input value={form.assunto} onChange={(e) => setForm((f) => ({ ...f, assunto: e.target.value }))} placeholder="Ex: retorno do orcamento, cobranca, confirmacao..." style={INP} />
              </div>

              <div>
                <div style={LBL}>OBJETIVO DO CONTATO</div>
                <textarea value={form.objetivo} onChange={(e) => setForm((f) => ({ ...f, objetivo: e.target.value }))} rows={4} placeholder="O que precisa acontecer nesse contato? O que a Nara deve considerar?" style={{ ...INP, resize: "vertical" }} />
              </div>

              <button onClick={agendar} style={{ padding: "11px 14px", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", cursor: "pointer", fontWeight: 950 }}>
                Salvar na agenda
              </button>
            </div>
          </section>

          <section style={{ display: "grid", gap: 14 }}>
            {!selecionado ? (
              <div style={{ minHeight: 360, display: "grid", placeItems: "center", background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, color: C.dim }}>
                <div style={{ textAlign: "center" }}><CalendarClock size={44} /><div style={{ marginTop: 10, fontWeight: 900 }}>Selecione ou crie um contato agendado.</div></div>
              </div>
            ) : (
              <>
                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
                    <div>
                      <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>COMPROMISSO COMERCIAL</div>
                      <div style={{ fontSize: 21, fontWeight: 950 }}>{clienteNome(selecionado._cliente)}</div>
                      <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>{clienteContato(selecionado._cliente) || "Contato nao informado"}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: corStatus(selecionado._statusAgenda), fontWeight: 950 }}>{selecionado._statusAgenda}</div>
                      <div style={{ color: C.muted, fontSize: 12 }}>{selecionado.data} {selecionado.hora}</div>
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8, marginBottom: 12 }}>
                    {[
                      ["Canal", selecionado.canal],
                      ["Tipo", selecionado.tipo],
                      ["Prioridade", selecionado.prioridade],
                      ["Origem", selecionado.origem],
                    ].map(([label, valor]) => (
                      <div key={label} style={{ border: `1px solid ${C.border2}`, borderRadius: 11, padding: 10, background: C.panel2 }}>
                        <div style={{ color: C.dim, fontSize: 10 }}>{label}</div>
                        <div style={{ color: C.text, fontWeight: 900, marginTop: 3 }}>{valor || "-"}</div>
                      </div>
                    ))}
                  </div>

                  <div style={{ color: C.muted, lineHeight: 1.6, fontSize: 12 }}>
                    <strong style={{ color: C.text }}>Assunto:</strong> {selecionado.assunto || "Sem assunto"}<br />
                    <strong style={{ color: C.text }}>Objetivo:</strong> {selecionado.objetivo || "Sem objetivo detalhado"}<br />
                    {selecionado._orcamento && <><strong style={{ color: C.text }}>Orcamento:</strong> {selecionado._orcamento.numero || "Orcamento"} | {brl(selecionado._orcamento.valorGlobal || selecionado._orcamento.valor)}<br /></>}
                    {selecionado.resultado && <><strong style={{ color: C.text }}>Resultado:</strong> {selecionado.resultado}</>}
                  </div>

                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 14 }}>
                    <button onClick={() => concluir(selecionado)} disabled={selecionado.status === "Concluido"} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: selecionado.status === "Concluido" ? "not-allowed" : "pointer", fontWeight: 900 }}><CheckCircle2 size={14} /> Concluir</button>
                    <button onClick={() => pedirNara(selecionado)} disabled={!!loadingNara} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.purple}55`, background: `${C.purple}14`, color: C.purple, cursor: loadingNara ? "not-allowed" : "pointer", fontWeight: 900 }}><Bot size={14} /> {loadingNara === selecionado.id ? "Nara pensando..." : "Nara abordagem"}</button>
                    <button onClick={() => abrirWhats(selecionado)} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.green2}55`, background: "transparent", color: C.green, cursor: "pointer", fontWeight: 900 }}><MessageCircle size={14} /> WhatsApp</button>
                    <button onClick={() => copiarTexto(selecionado.nara || proximaMensagemPadrao(selecionado._cliente, selecionado, selecionado._orcamento))} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 900 }}><Copy size={14} /> Copiar</button>
                    <button onClick={() => reagendar(selecionado, 1)} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: "pointer", fontWeight: 900 }}>+1 dia</button>
                    <button onClick={() => reagendar(selecionado, 3)} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: "pointer", fontWeight: 900 }}>+3 dias</button>
                    <button onClick={() => excluirItem(selecionado.id)} style={{ padding: "9px 11px", borderRadius: 10, border: `1px solid ${C.danger}55`, background: "transparent", color: C.danger, cursor: "pointer", fontWeight: 900 }}><Trash2 size={14} /></button>
                  </div>
                </div>

                <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                  <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>NARA PARA ESTE CONTATO</div>
                  {selecionado.nara ? (
                    <div style={{ display: "grid", gap: 10 }}>
                      <div style={{ whiteSpace: "pre-wrap", color: C.text, fontSize: 12.5, lineHeight: 1.65, background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12 }}>{selecionado.nara}</div>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button onClick={() => copiarTexto(selecionado.nara)} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer", fontWeight: 850 }}>Copiar</button>
                        <button onClick={() => abrirWhats(selecionado, selecionado.nara)} style={{ padding: "8px 10px", borderRadius: 9, border: `1px solid ${C.green2}55`, background: `${C.green2}12`, color: C.green, cursor: "pointer", fontWeight: 850 }}>Abrir WhatsApp</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ color: C.dim, fontSize: 12, lineHeight: 1.6 }}>Clique em <strong>Nara abordagem</strong> para gerar uma orientacao e uma mensagem personalizada antes do contato.</div>
                  )}
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
