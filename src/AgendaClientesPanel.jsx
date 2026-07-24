import React, { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "./supabase.js";
import { store } from "./store.js";
import { Bot, BriefcaseBusiness, Copy, Edit3, Mail, MessageCircle, Phone, Plus, RefreshCw, Search, Trash2, Upload, UserRound, Users } from "lucide-react";

export const KEY_AGENDA_CLIENTES = "orcaflow_agenda_clientes";

const KEY_CLIENTES = "orcaflow_clientes_crm";

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
  blue: "#00B7FF",
  blue2: "#2563EB",
  warn: "#F59E0B",
  danger: "#FB7185",
  purple: "#A78BFA",
};

const ALFABETO_CONTATOS = ["Todos", "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z", "#"];

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

function formatPhone(valor = "") {
  const d = onlyDigits(valor).slice(0, 13);
  if (!d) return "";
  const n = d.startsWith("55") && d.length > 11 ? d.slice(2) : d;
  if (n.length <= 2) return `(${n}`;
  if (n.length <= 6) return `(${n.slice(0, 2)}) ${n.slice(2)}`;
  if (n.length <= 10) return `(${n.slice(0, 2)}) ${n.slice(2, 6)}-${n.slice(6)}`;
  return `(${n.slice(0, 2)}) ${n.slice(2, 7)}-${n.slice(7, 11)}`;
}

function brl(valor) {
  const n = Number(String(valor ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number.isFinite(n) ? n : 0);
}

function tsFmt(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function usuarioNome(usuario = {}) {
  return clean(usuario.nomeTratamento || usuario.displayName || usuario.nome || usuario.email || "responsavel", 80);
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

function inicialContato(contato = {}) {
  const base = textoBusca(contato.nome || contato.empresa || contato.email || "");
  const primeira = base.charAt(0).toUpperCase();
  return /^[A-Z]$/.test(primeira) ? primeira : "#";
}

function contatoVazio(usuarioAtual) {
  const agora = new Date().toISOString();
  return {
    id: `agct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    clienteId: "",
    nome: "",
    empresa: "",
    cargo: "",
    decisor: "",
    whatsapp: "",
    telefone: "",
    email: "",
    endereco: "",
    cidadeUf: "",
    segmento: "",
    observacoes: "",
    origem: "agenda_manual",
    userId: usuarioAtual?.id || "admin",
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function nomeCliente(cliente = {}) {
  return clean(cliente.nome || cliente.empresa || cliente.cliente || "Cliente sem nome", 140);
}

function contatoPrincipal(cliente = {}) {
  return clean(cliente.contato || cliente.responsavel || cliente.decisor || "", 140);
}

function empresaCliente(cliente = {}) {
  return clean(cliente.empresa || cliente.nome || cliente.cliente || "", 160);
}

function contatoFromCliente(cliente = {}, usuarioAtual) {
  const agora = new Date().toISOString();
  return {
    id: `crm_${cliente.id || Math.random().toString(36).slice(2, 7)}`,
    clienteId: cliente.id || "",
    nome: contatoPrincipal(cliente) || nomeCliente(cliente),
    empresa: empresaCliente(cliente),
    cargo: clean(cliente.cargo || cliente.funcao || ""),
    decisor: clean(cliente.decisor || cliente.responsavel || ""),
    whatsapp: formatPhone(cliente.whatsapp || ""),
    telefone: formatPhone(cliente.telefone || cliente.telefone2 || ""),
    email: clean(cliente.email || cliente.email2 || "", 180),
    endereco: clean(cliente.endereco || ""),
    cidadeUf: clean(cliente.cidadeUf || cliente.cidade || ""),
    segmento: clean(cliente.segmento || ""),
    observacoes: clean(cliente.perfil || cliente.observacoes || cliente.proximoPasso || ""),
    origem: "crm",
    userId: cliente.userId || usuarioAtual?.id || "admin",
    criadoEm: cliente.criadoEm || agora,
    atualizadoEm: cliente.atualizadoEm || agora,
    _cliente: cliente,
  };
}

function normalizarContato(usuarioAtual, dados = {}, cliente = null) {
  const base = cliente ? contatoFromCliente(cliente, usuarioAtual) : contatoVazio(usuarioAtual);
  const agora = new Date().toISOString();
  const nome = dados.nome || dados.contatoNome || dados.contato || dados.responsavel || base.nome || "";
  const empresa = dados.empresa || dados.empresaNome || dados.clienteNome || dados.cliente || base.empresa || "";
  return {
    ...base,
    ...dados,
    id: dados.id || base.id,
    clienteId: dados.clienteId || base.clienteId || "",
    nome: clean(nome, 160),
    empresa: clean(empresa, 180),
    cargo: clean(dados.cargo || dados.funcao || base.cargo || "", 120),
    decisor: clean(dados.decisor || base.decisor || "", 120),
    whatsapp: formatPhone(dados.whatsapp || base.whatsapp || ""),
    telefone: formatPhone(dados.telefone || dados.telefone2 || base.telefone || ""),
    email: clean(dados.email || dados.email2 || base.email || "", 180),
    endereco: clean(dados.endereco || base.endereco || ""),
    cidadeUf: clean(dados.cidadeUf || dados.cidade || base.cidadeUf || ""),
    segmento: clean(dados.segmento || base.segmento || ""),
    observacoes: clean(dados.observacoes || dados.objetivo || dados.assunto || dados.perfil || base.observacoes || "", 3000),
    origem: dados.origem || base.origem || "agenda_manual",
    userId: dados.userId || base.userId || usuarioAtual?.id || "admin",
    criadoEm: dados.criadoEm || base.criadoEm || agora,
    atualizadoEm: dados.atualizadoEm || agora,
    _cliente: cliente || base._cliente || null,
  };
}

function contatoParaCliente(contato, clienteAtual = {}) {
  const agora = new Date().toISOString();
  return {
    ...clienteAtual,
    id: clienteAtual.id || contato.clienteId || `cli_ag_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    nome: clean(clienteAtual.nome || contato.empresa || contato.nome, 180),
    empresa: clean(contato.empresa || clienteAtual.empresa || clienteAtual.nome || "", 180),
    contato: clean(contato.nome || clienteAtual.contato || "", 160),
    cargo: clean(contato.cargo || clienteAtual.cargo || "", 120),
    decisor: clean(contato.decisor || clienteAtual.decisor || "", 120),
    whatsapp: formatPhone(contato.whatsapp || clienteAtual.whatsapp || ""),
    telefone: formatPhone(contato.telefone || clienteAtual.telefone || ""),
    email: clean(contato.email || clienteAtual.email || "", 180),
    endereco: clean(contato.endereco || clienteAtual.endereco || ""),
    cidadeUf: clean(contato.cidadeUf || clienteAtual.cidadeUf || ""),
    segmento: clean(contato.segmento || clienteAtual.segmento || ""),
    perfil: clean(contato.observacoes || clienteAtual.perfil || "", 3000),
    userId: clienteAtual.userId || contato.userId,
    criadoEm: clienteAtual.criadoEm || contato.criadoEm || agora,
    atualizadoEm: agora,
  };
}

function contatoTextoBusca(contato = {}) {
  return textoBusca([
    contato.nome,
    contato.empresa,
    contato.cargo,
    contato.decisor,
    contato.whatsapp,
    contato.telefone,
    contato.email,
    contato.segmento,
    contato.observacoes,
  ].filter(Boolean).join(" "));
}

function whatsUrl(numero = "", mensagem = "") {
  const d = onlyDigits(numero);
  if (!d) return "";
  const normalizado = d.startsWith("55") ? d : `55${d}`;
  return `https://wa.me/${normalizado}?text=${encodeURIComponent(mensagem || "")}`;
}

function telUrl(numero = "") {
  const d = onlyDigits(numero);
  if (!d) return "";
  const normalizado = d.startsWith("55") ? d : `55${d}`;
  return `tel:+${normalizado}`;
}

function orcamentosDoContato(contato = {}, crm = []) {
  contato = contato || {};
  const clienteId = contato.clienteId || "";
  if (!clienteId) return [];
  return (Array.isArray(crm) ? crm : []).filter((orc) => {
    if (clienteId && (orc.clienteId === clienteId || orc.crmClienteId === clienteId)) return true;
    return false;
  });
}

function resumoHistoricoCliente(cliente = {}) {
  return Array.isArray(cliente?.contatos) ? cliente.contatos.slice(0, 12) : [];
}

function contatoPersistente(contato = {}) {
  const { _cliente, _orcamentos, _historico, ...resto } = contato;
  return resto;
}

function parseVCard(texto = "", usuarioAtual) {
  const contatos = [];
  const blocos = String(texto || "").split(/BEGIN:VCARD/i).slice(1);
  for (const bloco of blocos) {
    const linhas = bloco.split(/\r?\n/);
    const getLinha = (prefixos) => {
      const achada = linhas.find((linha) => prefixos.some((p) => linha.toUpperCase().startsWith(p)));
      return clean((achada || "").split(":").slice(1).join(":"));
    };
    const nome = getLinha(["FN:", "N:"]).replace(/;/g, " ").trim();
    const org = getLinha(["ORG:"]);
    const tel = getLinha(["TEL", "ITEM1.TEL"]);
    const email = getLinha(["EMAIL", "ITEM1.EMAIL"]);
    if (nome || tel || email) {
      contatos.push(normalizarContato(usuarioAtual, {
        nome,
        empresa: org,
        whatsapp: tel,
        telefone: tel,
        email,
        origem: "importacao_vcf",
      }));
    }
  }
  return contatos;
}

function parseCsvContatos(texto = "", usuarioAtual) {
  const linhas = String(texto || "").split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
  if (!linhas.length) return [];
  const separador = linhas[0].includes(";") ? ";" : ",";
  const cab = linhas[0].split(separador).map((item) => textoBusca(item));
  const idx = (...nomes) => cab.findIndex((col) => nomes.some((n) => col.includes(n)));
  const iNome = idx("nome", "name", "contato");
  const iEmpresa = idx("empresa", "company", "org");
  const iTelefone = idx("telefone", "phone", "celular", "whatsapp");
  const iEmail = idx("email", "e-mail", "mail");
  const iCargo = idx("cargo", "funcao", "role");
  return linhas.slice(1).map((linha) => {
    const cols = linha.split(separador).map((item) => clean(item.replace(/^"|"$/g, "")));
    return normalizarContato(usuarioAtual, {
      nome: cols[iNome] || "",
      empresa: cols[iEmpresa] || "",
      whatsapp: cols[iTelefone] || "",
      telefone: cols[iTelefone] || "",
      email: cols[iEmail] || "",
      cargo: cols[iCargo] || "",
      origem: "importacao_csv",
    });
  }).filter((item) => item.nome || item.telefone || item.email);
}

export function AgendaClientesPanel({
  clientes = [],
  setClientes,
  crm = [],
  pushToast,
  usuarioAtual,
}) {
  const [agenda, setAgenda] = useState([]);
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
  const [letraAtiva, setLetraAtiva] = useState("Todos");
  const [selecionadoId, setSelecionadoId] = useState("");
  const [form, setForm] = useState(contatoVazio(usuarioAtual));
  const [editando, setEditando] = useState(false);
  const [loadingNara, setLoadingNara] = useState(false);
  const fileRef = useRef(null);
  const isAdmin = usuarioAtual?.tipo === "admin";

  const notify = (msg, tipo = "ok") => {
    if (typeof pushToast === "function") pushToast(msg, tipo);
  };

  const carregar = async () => {
    const dados = await store.get(KEY_AGENDA_CLIENTES);
    setAgenda(Array.isArray(dados) ? dados.map((item) => normalizarContato(usuarioAtual, item)) : []);
  };

  useEffect(() => {
    carregar();
  }, [usuarioAtual?.id]);

  useEffect(() => {
    setForm(contatoVazio(usuarioAtual));
    setEditando(false);
    setSelecionadoId("");
  }, [usuarioAtual?.id]);

  const clientesVisiveis = useMemo(
    () => (isAdmin ? clientes : clientes.filter((item) => item.userId === usuarioAtual?.id)),
    [clientes, isAdmin, usuarioAtual?.id]
  );

  const contatos = useMemo(() => {
    const agendaVisivel = agenda.filter((item) => isAdmin || item.userId === usuarioAtual?.id);
    return agendaVisivel.map((item) => {
      const cliente = clientes.find((c) => c.id === item.clienteId) || null;
      return normalizarContato(usuarioAtual, item, cliente);
    }).sort((a, b) => (a.nome || a.empresa).localeCompare(b.nome || b.empresa, "pt-BR"));
  }, [agenda, clientes, isAdmin, usuarioAtual]);

  const filtrados = useMemo(() => {
    const q = textoBusca(busca);
    return contatos.filter((contato) => {
      const temWhats = !!onlyDigits(contato.whatsapp);
      const temTel = !!onlyDigits(contato.whatsapp || contato.telefone);
      const temEmail = !!contato.email;
      const okFiltro =
        filtro === "todos" ||
        (filtro === "whatsapp" && temWhats) ||
        (filtro === "email" && temEmail) ||
        (filtro === "semTelefone" && !temTel) ||
        (filtro === "crm" && contato.clienteId);
      const okLetra = letraAtiva === "Todos" || inicialContato(contato) === letraAtiva;
      return okFiltro && okLetra && (!q || contatoTextoBusca(contato).includes(q));
    });
  }, [busca, contatos, filtro, letraAtiva]);

  const letrasDisponiveis = useMemo(() => {
    const mapa = new Map(ALFABETO_CONTATOS.map((letra) => [letra, letra === "Todos" ? contatos.length : 0]));
    for (const contato of contatos) {
      const inicial = inicialContato(contato);
      mapa.set(inicial, (mapa.get(inicial) || 0) + 1);
    }
    return mapa;
  }, [contatos]);

  const selecionado = contatos.find((item) => item.id === selecionadoId) || filtrados[0] || null;
  const orcamentosSelecionado = useMemo(() => orcamentosDoContato(selecionado, crm).slice(0, 20), [selecionado, crm]);
  const historicoSelecionado = resumoHistoricoCliente(selecionado?._cliente);

  useEffect(() => {
    if (!selecionadoId && filtrados[0]?.id) setSelecionadoId(filtrados[0].id);
  }, [filtrados, selecionadoId]);

  const kpis = useMemo(() => ({
    total: contatos.length,
    whatsapp: contatos.filter((item) => onlyDigits(item.whatsapp)).length,
    email: contatos.filter((item) => item.email).length,
    vinculados: contatos.filter((item) => item.clienteId).length,
  }), [contatos]);

  const salvarAgenda = async (lista) => {
    const limpa = (Array.isArray(lista) ? lista : []).map(contatoPersistente);
    setAgenda(limpa);
    const ok = await store.set(KEY_AGENDA_CLIENTES, limpa);
    if (!ok) notify("Nao foi possivel salvar a agenda na nuvem.", "erro");
    return ok;
  };

  const salvarClientes = async (lista) => {
    if (typeof setClientes === "function") setClientes(lista);
    const ok = await store.set(KEY_CLIENTES, lista);
    if (!ok) notify("Nao foi possivel atualizar o cliente na nuvem.", "erro");
    return ok;
  };

  const selecionarParaEditar = (contato) => {
    const normalizado = normalizarContato(usuarioAtual, contato, contato?._cliente || null);
    setForm({ ...normalizado, id: contato.origem === "crm" ? `agct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` : normalizado.id });
    setEditando(contato.origem !== "crm");
    setSelecionadoId(contato.id);
  };

  const novoContato = () => {
    setForm(contatoVazio(usuarioAtual));
    setEditando(false);
  };

  const salvarContato = async () => {
    const item = normalizarContato(usuarioAtual, form);
    if (!item.nome && !item.empresa && !item.whatsapp && !item.telefone && !item.email) {
      notify("Informe pelo menos nome, empresa, telefone ou e-mail.", "erro");
      return;
    }

    let clienteId = item.clienteId;
    let clientesAtualizados = Array.isArray(clientes) ? [...clientes] : [];
    if (clienteId) {
      clientesAtualizados = clientesAtualizados.map((cliente) => (
        cliente.id === clienteId ? contatoParaCliente({ ...item, clienteId }, cliente) : cliente
      ));
      await salvarClientes(clientesAtualizados);
    }

    const itemFinal = { ...item, clienteId, atualizadoEm: new Date().toISOString() };
    const existe = agenda.some((contato) => contato.id === itemFinal.id);
    const novaAgenda = existe
      ? agenda.map((contato) => contato.id === itemFinal.id ? itemFinal : contato)
      : [itemFinal, ...agenda];

    await salvarAgenda(novaAgenda);
    setSelecionadoId(itemFinal.id);
    setForm(itemFinal);
    setEditando(true);
    notify(existe ? "Contato atualizado na agenda telefonica." : "Contato salvo na agenda telefonica.", "ok");
  };

  const vincularContatoAoCRM = async (contato) => {
    if (!contato) return;
    if (contato.clienteId) {
      notify("Este contato ja esta vinculado ao CRM.", "aviso");
      return;
    }
    const item = normalizarContato(usuarioAtual, contato);
    const novoCliente = contatoParaCliente({
      ...item,
      origem: item.origem || "agenda_telefonica",
      perfil: clean(item.observacoes || "", 3000),
    });
    const clientesAtualizados = [novoCliente, ...(Array.isArray(clientes) ? clientes : [])];
    await salvarClientes(clientesAtualizados);
    const itemFinal = { ...item, clienteId: novoCliente.id, origem: item.origem || "agenda_telefonica", atualizadoEm: new Date().toISOString() };
    const novaAgenda = agenda.some((agendaItem) => agendaItem.id === itemFinal.id)
      ? agenda.map((agendaItem) => agendaItem.id === itemFinal.id ? itemFinal : agendaItem)
      : [itemFinal, ...agenda];
    await salvarAgenda(novaAgenda);
    setSelecionadoId(itemFinal.id);
    setForm(itemFinal);
    setEditando(true);
    notify("Contato vinculado ao CRM. Agora ele pode receber historico e acompanhamento.", "ok");
  };

  const excluirContato = async (contato) => {
    if (!contato || contato.origem === "crm") {
      notify("Este contato veio do CRM. Edite ou remova pelo cadastro do cliente.", "aviso");
      return;
    }
    const ok = window.confirm("Remover este contato da agenda telefonica?");
    if (!ok) return;
    await salvarAgenda(agenda.filter((item) => item.id !== contato.id));
    setSelecionadoId("");
    novoContato();
    notify("Contato removido da agenda.", "aviso");
  };

  const importarContatosDoCRM = async () => {
    const existentes = new Set(agenda.map((item) => item.clienteId).filter(Boolean));
    const novos = clientesVisiveis
      .filter((cliente) => !existentes.has(cliente.id))
      .map((cliente) => ({ ...contatoFromCliente(cliente, usuarioAtual), id: `agct_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, origem: "crm_importado" }));
    if (!novos.length) {
      notify("Todos os clientes do CRM ja estao disponiveis na agenda.", "aviso");
      return;
    }
    await salvarAgenda([...novos, ...agenda]);
    notify(`${novos.length} contato(s) importado(s) do CRM.`, "ok");
  };

  const importarArquivo = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const texto = await file.text();
      const nome = String(file.name || "").toLowerCase();
      const novos = nome.endsWith(".vcf") || textoBusca(texto).includes("begin:vcard")
        ? parseVCard(texto, usuarioAtual)
        : parseCsvContatos(texto, usuarioAtual);
      if (!novos.length) {
        notify("Nao encontrei contatos nesse arquivo. Use .vcf ou .csv.", "erro");
        return;
      }
      await salvarAgenda([...novos, ...agenda]);
      notify(`${novos.length} contato(s) importado(s) para a agenda.`, "ok");
    } catch (error) {
      console.error("Erro ao importar contatos:", error);
      notify("Erro ao importar contatos.", "erro");
    }
  };

  const copiarTexto = async (texto) => {
    try {
      await navigator.clipboard.writeText(texto || "");
      notify("Copiado.", "ok");
    } catch {
      notify("Nao foi possivel copiar.", "erro");
    }
  };

  const abrirWhats = (contato, texto = "") => {
    const numero = contato?.whatsapp || contato?.telefone || "";
    const url = whatsUrl(numero, texto);
    if (!url) {
      notify("Contato sem WhatsApp/telefone cadastrado.", "erro");
      return;
    }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const ligar = (contato) => {
    const url = telUrl(contato?.telefone || contato?.whatsapp || "");
    if (!url) {
      notify("Contato sem telefone cadastrado.", "erro");
      return;
    }
    window.location.href = url;
  };

  const enviarEmail = (contato) => {
    if (!contato?.email) {
      notify("Contato sem e-mail cadastrado.", "erro");
      return;
    }
    window.location.href = `mailto:${contato.email}`;
  };

  const mensagemBaseContato = (contato) => {
    const primeiroNome = clean((contato?.nome || contato?.empresa || "tudo bem").split(" ")[0], 40);
    return `Ola, ${primeiroNome}. Tudo bem? Estou entrando em contato para dar continuidade ao atendimento e confirmar se posso ajudar em mais algum ponto.`;
  };

  const pedirNara = async (contato) => {
    if (!contato || loadingNara) return;
    setLoadingNara(true);
    try {
      const historico = resumoHistoricoCliente(contato._cliente)
        .slice(0, 10)
        .map((msg) => `${tsFmt(msg.criadoEm)} | ${msg.canal || "Contato"} | ${msg.tipo || ""}: ${clean(msg.mensagem || msg.conteudo || "", 700)}`)
        .join("\n");
      const orcs = orcamentosDoContato(contato, crm).slice(0, 8).map((orc) => `${orc.numero || "orcamento"} | ${orc.empresaNome || ""} | ${brl(orc.valorGlobal || orc.valor)} | ${orc.status || ""}`).join("\n");
      const pedido = [
        "Nara, voce e a assistente comercial do OrcaFlow.",
        "Analise este contato da agenda telefonica e gere uma abordagem personalizada, humana e objetiva.",
        "Nao invente informacoes, prazo, desconto, condicao comercial, garantia ou historico que nao esteja abaixo.",
        "Entregue: 1) melhor proximo movimento; 2) mensagem curta para WhatsApp; 3) se faltar algum dado, diga exatamente o que pedir.",
        "",
        `Usuario do sistema: ${usuarioNome(usuarioAtual)}`,
        `Contato: ${contato.nome || "nao informado"}`,
        `Empresa/cliente: ${contato.empresa || "nao informado"}`,
        `Cargo: ${contato.cargo || "nao informado"}`,
        `Decisor: ${contato.decisor || "nao informado"}`,
        `Segmento: ${contato.segmento || "nao informado"}`,
        `Observacoes: ${contato.observacoes || "sem observacoes"}`,
        orcs ? `Orcamentos relacionados:\n${orcs}` : "Sem orcamentos relacionados.",
        historico ? `Historico real registrado:\n${historico}` : "Sem historico real registrado.",
      ].join("\n");
      const response = await fetch("/api/chat-assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await authHeaders()),
        },
        body: JSON.stringify({
          mode: "crm_contact",
          messages: [{ role: "user", content: pedido }],
          context: { usuarioSistema: { nomeTratamento: usuarioNome(usuarioAtual) }, crm, clientesCRM: clientes },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Erro ao consultar a Nara.");
      const texto = clean(data.answer || "", 3000);
      const novo = { ...normalizarContato(usuarioAtual, contato), nara: texto, atualizadoEm: new Date().toISOString() };
      const existe = agenda.some((item) => item.id === novo.id);
      await salvarAgenda(existe ? agenda.map((item) => item.id === novo.id ? novo : item) : [novo, ...agenda]);
      setSelecionadoId(novo.id);
      notify("Nara analisou este contato.", "ok");
    } catch (error) {
      console.error("Erro Agenda/Nara:", error);
      notify(error.message || "Erro ao gerar analise da Nara.", "erro");
    } finally {
      setLoadingNara(false);
    }
  };

  const INP = inputStyle();
  const LBL = { color: C.dim, fontSize: 10, fontWeight: 900, letterSpacing: 1.2, marginBottom: 6 };

  return (
    <div className="agenda-phonebook">
      <style>{`
        .agenda-phonebook { flex: 1; display: grid; grid-template-columns: 340px minmax(360px, .9fr) minmax(380px, 1.1fr); min-height: 0; overflow: hidden; }
        .agenda-side, .agenda-main, .agenda-detail { min-width: 0; overflow-y: auto; }
        .agenda-side { border-right: 1px solid ${C.border}; background: rgba(7,17,31,.72); padding: 14px; }
        .agenda-main, .agenda-detail { padding: 18px; }
        .agenda-detail { padding-left: 0; }
        .agenda-card { background: ${C.panel}; border: 1px solid ${C.border}; border-radius: 16px; padding: 16px; }
        .agenda-btn { display: inline-flex; align-items: center; justify-content: center; gap: 7px; border-radius: 10px; padding: 9px 11px; font-size: 12px; font-weight: 900; cursor: pointer; border: 1px solid ${C.border2}; background: transparent; color: ${C.muted}; }
        .agenda-contact-row { transition: transform .18s ease, border-color .18s ease, background .18s ease, box-shadow .18s ease; }
        .agenda-contact-row:hover { transform: translateX(4px); border-color: ${C.blue2}; box-shadow: 0 10px 26px rgba(0,183,255,.08); }
        .agenda-alpha { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; margin: 0 0 12px; }
        .agenda-alpha button { border-radius: 9px; border: 1px solid ${C.border2}; background: rgba(15, 35, 62, .45); color: ${C.muted}; font-size: 10px; font-weight: 950; padding: 6px 0; cursor: pointer; transition: transform .16s ease, background .16s ease, color .16s ease; }
        .agenda-alpha button:hover:not(:disabled) { transform: translateY(-1px); color: ${C.green}; border-color: ${C.green2}; }
        .agenda-alpha button.active { background: linear-gradient(135deg, ${C.green2}, ${C.blue2}); border-color: transparent; color: #fff; }
        .agenda-alpha button:disabled { opacity: .28; cursor: not-allowed; }
        @media (max-width: 1120px) {
          .agenda-phonebook { grid-template-columns: 320px 1fr; overflow-y: auto; }
          .agenda-side { min-height: 100%; }
          .agenda-detail { grid-column: 1 / -1; padding: 0 18px 18px; }
        }
        @media (max-width: 760px) {
          .agenda-phonebook { display: block; overflow-y: auto; }
          .agenda-side, .agenda-main, .agenda-detail { border-right: 0; padding: 12px; overflow: visible; }
          .agenda-card { border-radius: 12px; }
        }
      `}</style>

      <aside className="agenda-side">
        <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 950 }}>Agenda Telefonica</div>
            <div style={{ color: C.dim, fontSize: 11 }}>Lista premium de contatos. Sem cobranca automatica.</div>
          </div>
          <button onClick={carregar} className="agenda-btn" title="Recarregar agenda"><RefreshCw size={14} /></button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          {[
            ["Contatos", kpis.total, C.blue, "todos"],
            ["WhatsApp", kpis.whatsapp, C.green, "whatsapp"],
            ["E-mails", kpis.email, C.purple, "email"],
            ["No CRM", kpis.vinculados, C.warn, "crm"],
          ].map(([label, valor, cor, id]) => (
            <button key={label} onClick={() => setFiltro(id)} style={{ textAlign: "left", border: `1px solid ${cor}44`, borderRadius: 12, padding: 10, background: filtro === id ? `${cor}1f` : `${cor}10`, color: C.text, cursor: "pointer" }}>
              <div style={{ color: cor, fontSize: 20, fontWeight: 950 }}>{valor}</div>
              <div style={{ color: C.muted, fontSize: 11 }}>{label}</div>
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8, marginBottom: 10 }}>
          <button onClick={novoContato} style={{ padding: "10px 12px", borderRadius: 11, border: 0, background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", cursor: "pointer", fontWeight: 950 }}>
            <Plus size={14} /> Novo contato
          </button>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button onClick={importarContatosDoCRM} className="agenda-btn" style={{ color: C.green, borderColor: `${C.green2}66`, background: `${C.green2}10` }}>
              <Users size={14} /> Do CRM
            </button>
            <button onClick={() => fileRef.current?.click()} className="agenda-btn" style={{ color: "#93C5FD", borderColor: `${C.blue2}66`, background: `${C.blue2}12` }}>
              <Upload size={14} /> VCF/CSV
            </button>
          </div>
          <input ref={fileRef} type="file" accept=".vcf,.csv,text/vcard,text/csv" onChange={importarArquivo} style={{ display: "none" }} />
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, ...INP, marginBottom: 10 }}>
          <Search size={14} color={C.dim} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar nome, empresa, telefone, e-mail..." style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontFamily: "inherit", fontSize: 12 }} />
        </div>

        <div className="agenda-alpha" aria-label="Filtro alfabetico">
          {ALFABETO_CONTATOS.map((letra) => {
            const total = letrasDisponiveis.get(letra) || 0;
            const disabled = letra !== "Todos" && total === 0;
            return (
              <button
                key={letra}
                type="button"
                disabled={disabled}
                className={letraAtiva === letra ? "active" : ""}
                title={letra === "Todos" ? "Mostrar todos" : `${total} contato(s) com inicial ${letra}`}
                onClick={() => setLetraAtiva(letra)}
              >
                {letra === "Todos" ? "Todos" : letra}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {[
            ["todos", "Todos"],
            ["crm", "Vinculados"],
            ["whatsapp", "WhatsApp"],
            ["email", "E-mail"],
            ["semTelefone", "Sem telefone"],
          ].map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{ padding: "7px 9px", borderRadius: 999, border: `1px solid ${filtro === id ? C.green2 : C.border2}`, background: filtro === id ? `${C.green2}18` : "transparent", color: filtro === id ? C.green : C.muted, cursor: "pointer", fontWeight: 850, fontSize: 11 }}>
              {label}
            </button>
          ))}
        </div>

        <div style={{ display: "grid", gap: 8 }}>
          {filtrados.map((contato) => {
            const selected = contato.id === selecionado?.id;
            return (
              <button key={contato.id} className="agenda-contact-row" onClick={() => setSelecionadoId(contato.id)} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}14` : C.panel2, color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                  <strong style={{ fontSize: 12.5, overflowWrap: "anywhere" }}>{contato.nome || contato.empresa || "Contato sem nome"}</strong>
                  <span style={{ color: contato.clienteId ? "#93C5FD" : C.green, fontSize: 9.5, fontWeight: 950 }}>{contato.clienteId ? "CRM" : "Agenda"}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 10.5, marginTop: 4, overflowWrap: "anywhere" }}>{contato.empresa || "Empresa nao informada"}</div>
                <div style={{ color: C.muted, fontSize: 11, marginTop: 6, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {contato.whatsapp && <span>{contato.whatsapp}</span>}
                  {contato.email && <span>{contato.email}</span>}
                  {!contato.whatsapp && !contato.email && <span>Sem contato cadastrado</span>}
                </div>
              </button>
            );
          })}
          {!filtrados.length && <div style={{ color: C.dim, fontSize: 12, textAlign: "center", padding: 22 }}>Nenhum contato encontrado.</div>}
        </div>
      </aside>

      <main className="agenda-main">
        <section className="agenda-card">
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "start", marginBottom: 14 }}>
            <div>
              <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>{editando ? "EDITAR CONTATO" : "NOVO CONTATO"}</div>
              <div style={{ color: C.dim, fontSize: 12 }}>Cadastro telefonico independente. Vire CRM somente quando houver relacionamento real.</div>
            </div>
            <UserRound size={20} color={C.green} />
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <div>
              <div style={LBL}>VINCULO CRM (OPCIONAL)</div>
              <select value={form.clienteId} onChange={(e) => setForm((f) => ({ ...f, clienteId: e.target.value }))} style={INP}>
                <option value="">Agenda apenas - sem acompanhamento</option>
                {clientesVisiveis.map((cliente) => <option key={cliente.id} value={cliente.id}>{nomeCliente(cliente)}</option>)}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={LBL}>NOME DO CONTATO</div>
                <input value={form.nome} onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Ex: Joao Silva" style={INP} />
              </div>
              <div>
                <div style={LBL}>EMPRESA / ORGAO</div>
                <input value={form.empresa} onChange={(e) => setForm((f) => ({ ...f, empresa: e.target.value }))} placeholder="Ex: Prefeitura Municipal" style={INP} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={LBL}>CARGO / FUNCAO</div>
                <input value={form.cargo} onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))} placeholder="Ex: Compras, engenheiro, diretor..." style={INP} />
              </div>
              <div>
                <div style={LBL}>DECISOR / RESPONSAVEL</div>
                <input value={form.decisor} onChange={(e) => setForm((f) => ({ ...f, decisor: e.target.value }))} placeholder="Quem decide ou influencia?" style={INP} />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={LBL}>WHATSAPP</div>
                <input value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: formatPhone(e.target.value) }))} placeholder="(17) 99999-9999" style={INP} />
              </div>
              <div>
                <div style={LBL}>TELEFONE</div>
                <input value={form.telefone} onChange={(e) => setForm((f) => ({ ...f, telefone: formatPhone(e.target.value) }))} placeholder="(17) 3333-3333" style={INP} />
              </div>
            </div>

            <div>
              <div style={LBL}>E-MAIL</div>
              <input value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="contato@cliente.com.br" style={INP} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <div style={LBL}>ENDERECO</div>
                <input value={form.endereco} onChange={(e) => setForm((f) => ({ ...f, endereco: e.target.value }))} placeholder="Rua, numero, bairro..." style={INP} />
              </div>
              <div>
                <div style={LBL}>CIDADE / UF</div>
                <input value={form.cidadeUf} onChange={(e) => setForm((f) => ({ ...f, cidadeUf: e.target.value }))} placeholder="Barretos/SP" style={INP} />
              </div>
            </div>

            <div>
              <div style={LBL}>SEGMENTO</div>
              <input value={form.segmento} onChange={(e) => setForm((f) => ({ ...f, segmento: e.target.value }))} placeholder="Publico, industria, comercio, condominio..." style={INP} />
            </div>

            <div>
              <div style={LBL}>OBSERVACOES DO CONTATO</div>
              <textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={5} placeholder="Preferencias, melhor horario, perfil do cliente, detalhes reais do relacionamento..." style={{ ...INP, resize: "vertical" }} />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <button onClick={salvarContato} style={{ padding: "11px 14px", borderRadius: 11, border: "none", background: `linear-gradient(135deg, ${C.green2}, ${C.blue2})`, color: "#fff", cursor: "pointer", fontWeight: 950 }}>
                {editando ? "Atualizar contato" : "Salvar contato"}
              </button>
              <button onClick={novoContato} className="agenda-btn">Limpar</button>
            </div>
          </div>
        </section>
      </main>

      <section className="agenda-detail">
        {!selecionado ? (
          <div className="agenda-card" style={{ minHeight: 360, display: "grid", placeItems: "center", color: C.dim }}>
            <div style={{ textAlign: "center" }}><Users size={44} /><div style={{ marginTop: 10, fontWeight: 900 }}>Selecione ou crie um contato.</div></div>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 14 }}>
            <div className="agenda-card">
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "start", marginBottom: 12 }}>
                <div>
                  <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>FICHA DO CONTATO</div>
                  <div style={{ fontSize: 22, fontWeight: 950, overflowWrap: "anywhere" }}>{selecionado.nome || "Contato sem nome"}</div>
                  <div style={{ color: C.muted, fontSize: 12, marginTop: 4, overflowWrap: "anywhere" }}>{selecionado.empresa || "Empresa nao informada"}</div>
                </div>
                <BriefcaseBusiness size={22} color={C.green} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
                {[
                  ["Cargo", selecionado.cargo],
                  ["Decisor", selecionado.decisor],
                  ["Segmento", selecionado.segmento],
                  ["Vinculo", selecionado.clienteId ? "CRM ativo" : "Agenda apenas"],
                ].map(([label, valor]) => (
                  <div key={label} style={{ border: `1px solid ${C.border2}`, borderRadius: 11, padding: 10, background: C.panel2 }}>
                    <div style={{ color: C.dim, fontSize: 10 }}>{label}</div>
                    <div style={{ color: C.text, fontWeight: 900, marginTop: 3, overflowWrap: "anywhere" }}>{valor || "-"}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: "grid", gap: 7, color: C.muted, fontSize: 12, lineHeight: 1.55, marginBottom: 14 }}>
                <div><strong style={{ color: C.text }}>WhatsApp:</strong> {selecionado.whatsapp || "Nao informado"}</div>
                <div><strong style={{ color: C.text }}>Telefone:</strong> {selecionado.telefone || "Nao informado"}</div>
                <div><strong style={{ color: C.text }}>E-mail:</strong> {selecionado.email || "Nao informado"}</div>
                <div><strong style={{ color: C.text }}>Endereco:</strong> {[selecionado.endereco, selecionado.cidadeUf].filter(Boolean).join(" - ") || "Nao informado"}</div>
              </div>

              {selecionado.observacoes && (
                <div style={{ whiteSpace: "pre-wrap", background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12, color: C.muted, fontSize: 12, lineHeight: 1.6, marginBottom: 14 }}>
                  {selecionado.observacoes}
                </div>
              )}

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => selecionarParaEditar(selecionado)} className="agenda-btn" style={{ color: "#93C5FD", borderColor: `${C.blue2}66`, background: `${C.blue2}12` }}><Edit3 size={14} /> Editar</button>
                <button onClick={() => abrirWhats(selecionado, mensagemBaseContato(selecionado))} className="agenda-btn" style={{ color: C.green, borderColor: `${C.green2}66`, background: `${C.green2}12` }}><MessageCircle size={14} /> WhatsApp</button>
                <button onClick={() => ligar(selecionado)} className="agenda-btn"><Phone size={14} /> Ligar</button>
                <button onClick={() => enviarEmail(selecionado)} className="agenda-btn"><Mail size={14} /> E-mail</button>
                <button onClick={() => copiarTexto([selecionado.nome, selecionado.empresa, selecionado.whatsapp || selecionado.telefone, selecionado.email].filter(Boolean).join(" | "))} className="agenda-btn"><Copy size={14} /> Copiar</button>
                {!selecionado.clienteId && <button onClick={() => vincularContatoAoCRM(selecionado)} className="agenda-btn" style={{ color: C.warn, borderColor: `${C.warn}66`, background: `${C.warn}12` }}><Users size={14} /> Vincular CRM</button>}
                <button onClick={() => pedirNara(selecionado)} disabled={loadingNara} className="agenda-btn" style={{ color: C.purple, borderColor: `${C.purple}66`, background: `${C.purple}12`, opacity: loadingNara ? 0.6 : 1 }}><Bot size={14} /> {loadingNara ? "Nara analisando..." : "Nara"}</button>
                <button onClick={() => excluirContato(selecionado)} className="agenda-btn" style={{ color: C.danger, borderColor: `${C.danger}66` }}><Trash2 size={14} /></button>
              </div>
            </div>

            {selecionado.nara && (
              <div className="agenda-card">
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>NARA SOBRE ESTE CONTATO</div>
                <div style={{ whiteSpace: "pre-wrap", color: C.text, background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 12, fontSize: 12.5, lineHeight: 1.65 }}>{selecionado.nara}</div>
              </div>
            )}

            <div className="agenda-card">
              <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>ORCAMENTOS RELACIONADOS</div>
              <div style={{ display: "grid", gap: 8 }}>
                {orcamentosSelecionado.map((orc) => (
                  <div key={orc.id || orc.numero} style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                    <div style={{ fontWeight: 950, fontSize: 12 }}>{orc.numero || "Orcamento"} - {orc.empresaNome || "Empresa"}</div>
                    <div style={{ color: C.muted, fontSize: 11, marginTop: 3 }}>{brl(orc.valorGlobal || orc.valor)} | {orc.status || "Sem status"} | {tsFmt(orc.criadoEm)}</div>
                    {orc.lembreteIA && <div style={{ color: C.dim, fontSize: 11, marginTop: 6, lineHeight: 1.5 }}>{clean(orc.lembreteIA, 180)}</div>}
                  </div>
                ))}
                {!orcamentosSelecionado.length && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum orcamento relacionado encontrado para este contato.</div>}
              </div>
            </div>

            <div className="agenda-card">
              <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>HISTORICO REAL DO CLIENTE</div>
              <div style={{ display: "grid", gap: 8 }}>
                {historicoSelecionado.map((msg) => (
                  <div key={msg.id || msg.criadoEm} style={{ border: `1px solid ${C.border2}`, borderRadius: 12, padding: 10, background: C.panel2 }}>
                    <div style={{ color: C.muted, fontSize: 11, marginBottom: 4 }}>{tsFmt(msg.criadoEm)} | {msg.canal || "Contato"} | {msg.tipo || ""}</div>
                    <div style={{ color: C.text, fontSize: 12, lineHeight: 1.5 }}>{clean(msg.mensagem || msg.conteudo || "", 500)}</div>
                  </div>
                ))}
                {!historicoSelecionado.length && <div style={{ color: C.dim, fontSize: 12 }}>Sem historico real registrado para este cliente.</div>}
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
