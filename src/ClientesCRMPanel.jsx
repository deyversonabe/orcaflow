import React, { useEffect, useMemo, useRef, useState } from "react";
import { authHeaders } from "./supabase.js";
import { store } from "./store.js";
import { AlertTriangle, CalendarClock, Copy, FileText, Mail, MessageCircle, Send, Target, Upload, Users } from "lucide-react";
import { abrirWhatsRelatorio, gerarRelatorioSemanalNara, normalizarWhatsDestino, WHATS_REPORT_NUMBER, WHATS_REPORT_STORAGE_KEY } from "./weeklyReport.js";

const KEY_CLIENTES = "orcaflow_clientes_crm";

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

function valorNumerico(valor) {
  const n = Number(String(valor ?? 0).replace(/\./g, "").replace(",", ".").replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

function formatTelefone(valor = "") {
  const d = String(valor || "").replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

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
    userId: dados.userId || usuarioAtual?.id || "admin",
    criadoEm: dados.criadoEm || agora,
    atualizadoEm: agora,
  };
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

function orcamentosDoCliente(cliente = {}, crm = []) {
  const alvo = alvoCliente(cliente);
  if (!alvo) return [];
  return (Array.isArray(crm) ? crm : []).filter((item) => {
    const clienteOrc = textoBusca(item?.cliente || "");
    const texto = textoBusca([item?.cliente, item?.empresaNome, item?.numero, item?.lembreteIA].filter(Boolean).join(" "));
    return texto.includes(alvo) || (clienteOrc && alvo.includes(clienteOrc));
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
  empresas = [],
  pushToast,
  usuarioAtual,
  abrirOrcamentoSalvo,
  baixarOrcamento,
  lerTextoPDF,
  imagemParaLeitura,
}) {
  const isAdmin = usuarioAtual?.tipo === "admin";
  const base = useMemo(
    () => (isAdmin ? clientes : clientes.filter((item) => item.userId === usuarioAtual?.id)),
    [clientes, isAdmin, usuarioAtual?.id]
  );
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState("todos");
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
  });
  const [anexo, setAnexo] = useState(null);
  const [lendoArquivo, setLendoArquivo] = useState(false);
  const [jadeLoading, setJadeLoading] = useState(false);
  const [pedidoJade, setPedidoJade] = useState("Nara, leia este cliente e me diga o melhor proximo passo para aumentar a chance de fechamento.");
  const [whatsRelatorio, setWhatsRelatorio] = useState(WHATS_REPORT_NUMBER);
  const refArquivo = useRef(null);

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
      const vinculados = orcamentosDoCliente(item, crm);
      const score = scoreCliente(item, vinculados);
      return {
        ...item,
        _orcamentos: vinculados,
        _score: score,
        _nivel: nivelCliente(score),
      };
    }).sort((a, b) => b._score - a._score);
  }, [base, crm]);

  const kpis = useMemo(() => {
    const abertos = enriquecidos.filter((item) => !/fechad|perdid/i.test(textoBusca(item.status))).length;
    const quentes = enriquecidos.filter((item) => item.temperatura === "Quente").length;
    const atrasados = enriquecidos.filter(isAtrasado).length;
    const semContato = enriquecidos.filter((item) => !item.proximoContato).length;
    const valor = enriquecidos.reduce((soma, item) => {
      const valorCliente = valorNumerico(item.valorPotencial);
      const valorOrcamentos = item._orcamentos?.reduce((acc, orc) => acc + valorNumerico(orc.valorGlobal || orc.valor), 0) || 0;
      return soma + (valorCliente || valorOrcamentos);
    }, 0);
    return { abertos, quentes, atrasados, semContato, valor };
  }, [enriquecidos]);

  const filtrados = useMemo(() => {
    const q = textoBusca(busca);
    return enriquecidos.filter((item) => {
      const texto = textoBusca([item.nome, item.empresa, item.email, item.email2, item.telefone, item.whatsapp, item.documento, item.cidadeUf, item.status, item.proximoPasso, item.lembreteJade].join(" "));
      const matchBusca = !q || texto.includes(q);
      const matchFiltro =
        filtro === "todos" ||
        (filtro === "quentes" && item.temperatura === "Quente") ||
        (filtro === "atrasados" && isAtrasado(item)) ||
        (filtro === "hoje" && isHoje(item)) ||
        (filtro === "sem-contato" && !item.proximoContato);
      return matchBusca && matchFiltro;
    });
  }, [enriquecidos, busca, filtro]);

  const ativo = enriquecidos.find((item) => item.id === ativoId) || filtrados[0] || null;
  const relacionados = useMemo(() => (ativo ? orcamentosDoCliente(ativo, crm) : []), [ativo, crm]);
  const contatosAtivo = Array.isArray(ativo?.contatos) ? ativo.contatos : [];

  useEffect(() => {
    if (!ativoId && filtrados[0]?.id) setAtivoId(filtrados[0].id);
  }, [ativoId, filtrados]);

  useEffect(() => {
    if (ativo && !editando) setForm(criarCliente(usuarioAtual, ativo));
  }, [ativo?.id, editando, usuarioAtual]);

  const salvarLista = async (nova) => {
    setClientes(nova);
    const ok = await store.set(KEY_CLIENTES, nova);
    if (!ok) pushToast("Nao foi possivel salvar clientes na nuvem.", "erro");
    return ok;
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
    const pronto = criarCliente(usuarioAtual, { ...form, nome });
    const existe = clientes.some((item) => item.id === pronto.id);
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
    const { _orcamentos, _score, _nivel, ...persistivel } = ativo;
    const atualizado = { ...persistivel, ...patch, atualizadoEm: new Date().toISOString() };
    await salvarLista(clientes.map((item) => (item.id === ativo.id ? atualizado : item)));
    setForm(criarCliente(usuarioAtual, atualizado));
    return atualizado;
  };

  const sincronizarOrcamentos = async () => {
    const existentes = new Set(clientes.map((item) => textoBusca(item.nome || item.empresa)));
    const novos = [];
    for (const item of crm) {
      const nome = clean(item?.cliente, 180);
      if (!nome || existentes.has(textoBusca(nome))) continue;
      existentes.add(textoBusca(nome));
      novos.push(criarCliente(usuarioAtual, {
        nome,
        empresa: nome,
        origem: `Orcamento ${item.numero || ""}`.trim(),
        status: statusFunil(item),
        temperatura: isAtrasado(item) ? "Quente" : "Morno",
        proximoContato: item.proximoContato || "",
        valorPotencial: item.valorGlobal || item.valor || "",
        observacoes: item.lembreteIA || item.resumoConversas || "",
        proximoPasso: item.proximoContato ? `Retomar contato em ${item.proximoContato}` : "Avaliar retorno comercial do orcamento.",
        contatos: [{
          id: `ct_${Date.now()}_${item.id}`,
          canal: "Sistema",
          direcao: "Registro interno",
          tipo: "Orcamento vinculado",
          assunto: item.numero || "Orcamento",
          mensagem: `Orcamento ${item.numero || ""} vinculado ao cliente. Valor: ${brl(item.valorGlobal || item.valor)}.`,
          orcamentoId: item.id,
          orcamentoNumero: item.numero || "",
          criadoEm: item.criadoEm || new Date().toISOString(),
          userId: usuarioAtual?.id || "admin",
        }],
      }));
    }
    if (!novos.length) {
      pushToast("Nenhum novo cliente encontrado nos orcamentos.", "aviso");
      return;
    }
    await salvarLista([...novos, ...clientes]);
    setAtivoId(novos[0].id);
    pushToast(`${novos.length} cliente(s) criado(s) a partir dos orcamentos.`, "ok");
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
        textoArquivo = lerTextoPDF ? clean(await lerTextoPDF(file), 9000) : "";
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

    const orc = crm.find((item) => item.id === contato.orcamentoId);
    const registro = {
      id: `ct_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      canal: contato.canal,
      direcao: contato.direcao,
      tipo: contato.tipo,
      assunto: contato.assunto,
      mensagem: clean(contato.mensagem, 5000),
      orcamentoId: contato.orcamentoId || "",
      orcamentoNumero: orc?.numero || "",
      ...anexo,
      criadoEm: new Date().toISOString(),
      userId: usuarioAtual?.id || "admin",
    };

    await atualizarCliente({
      contatos: [registro, ...contatosAtivo].slice(0, 140),
      proximoPasso: ativo.proximoPasso || "Nara pode analisar este historico e sugerir o proximo passo.",
    });
    setContato({ canal: "WhatsApp", direcao: "Cliente respondeu", tipo: "Follow-up", assunto: "", mensagem: "", orcamentoId: "" });
    setAnexo(null);
    pushToast("Contato salvo no historico do cliente.", "ok");
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
          usuarioNome: usuarioAtual?.nome || usuarioAtual?.email || "responsavel",
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
            orcamentoId: msg.orcamentoId,
            orcamentoNumero: msg.orcamentoNumero,
            arquivoNome: msg.arquivoNome,
            arquivoTipo: msg.arquivoTipo,
            arquivoTamanho: msg.arquivoTamanho,
            arquivoResumo: clean(msg.arquivoResumo || msg.arquivoTexto, 1600),
            criadoEm: msg.criadoEm,
          })),
          orcamentos: relacionados,
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
      await atualizarCliente({
        jade: { ...analise, atualizadoEm: new Date().toISOString(), pedido },
        proximoPasso: analise.proximoPasso || ativo.proximoPasso,
        lembreteJade: analise.lembreteSugerido || ativo.lembreteJade,
        proximoContato: dataSugerida,
        temperatura: analise.prioridade === "critica" || analise.prioridade === "alta" ? "Quente" : ativo.temperatura,
      });
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
    const numero = String(contatoWhats).replace(/\D/g, "");
    if (!numero) {
      pushToast("Telefone do cliente invalido.", "erro");
      return;
    }
    window.open(`https://wa.me/55${numero}?text=${encodeURIComponent(texto || ativo?.jade?.mensagemSugerida || "")}`, "_blank", "noopener,noreferrer");
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
            ["Potencial", brl(kpis.valor), C.green],
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
          ].map(([id, label]) => (
            <button key={id} onClick={() => setFiltro(id)} style={{ padding: "6px 9px", borderRadius: 999, border: `1px solid ${filtro === id ? C.green2 : C.border2}`, background: filtro === id ? `${C.green2}18` : "transparent", color: filtro === id ? C.green : C.muted, cursor: "pointer", fontSize: 10.5, fontWeight: 850 }}>{label}</button>
          ))}
        </div>
        <button onClick={sincronizarOrcamentos} style={{ width: "100%", marginBottom: 12, padding: "9px 10px", borderRadius: 10, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", fontWeight: 850, cursor: "pointer" }}>Criar clientes dos orcamentos</button>
        <button onClick={abrirRelatorioSemanal} style={{ width: "100%", marginBottom: 12, padding: "9px 10px", borderRadius: 10, border: `1px solid ${C.green2}66`, background: `${C.green2}16`, color: C.green, fontWeight: 900, cursor: "pointer" }}>Enviar relatorio semanal Nara</button>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtrados.map((item) => {
            const selected = item.id === ativo?.id;
            return (
              <button key={item.id} onClick={() => { setAtivoId(item.id); setEditando(false); }} style={{ textAlign: "left", borderRadius: 12, padding: 11, border: `1px solid ${selected ? C.green2 : C.border2}`, background: selected ? `${C.green2}14` : C.panel2, color: C.text, cursor: "pointer" }}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <strong style={{ fontSize: 12.5 }}>{item.nome || item.empresa || "Cliente sem nome"}</strong>
                  <span style={{ color: item.temperatura === "Quente" ? C.warn : C.green, fontSize: 10, fontWeight: 900 }}>{item.temperatura}</span>
                </div>
                <div style={{ color: C.dim, fontSize: 10.5, marginTop: 3 }}>{item.empresa || item.email || item.email2 || item.whatsapp || item.telefone || "Sem dados de contato"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginTop: 6, alignItems: "center" }}>
                  <span style={{ color: item._score >= 78 ? C.danger : item._score >= 58 ? C.warn : "#93C5FD", fontSize: 10, fontWeight: 950 }}>Nara: {item._nivel} {item._score}</span>
                  <span style={{ color: isAtrasado(item) ? C.danger : isHoje(item) ? C.warn : C.dim, fontSize: 10 }}>{item.proximoContato || "sem data"}</span>
                </div>
                <div style={{ color: "#93C5FD", fontSize: 10, marginTop: 5 }}>{item.proximoPasso || item.lembreteJade || "Sem proximo passo definido"}</div>
              </button>
            );
          })}
        </div>
      </aside>

      <main style={{ overflowY: "auto", padding: 18 }}>
        {enriquecidos.length > 0 && (
          <div style={{ background: "linear-gradient(135deg, rgba(22,163,74,.16), rgba(37,99,235,.12))", border: `1px solid ${C.green2}33`, borderRadius: 16, padding: 14, marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 10 }}>
              <div>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950 }}>RADAR DA NARA</div>
                <div style={{ color: C.muted, fontSize: 12 }}>Clientes priorizados por atraso, temperatura, historico e potencial.</div>
              </div>
              <Target size={20} color={C.green} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 10 }}>
              {enriquecidos.slice(0, 3).map((item) => (
                <button key={item.id} onClick={() => { setAtivoId(item.id); setEditando(false); }} style={{ textAlign: "left", border: `1px solid ${item._score >= 78 ? C.danger : item._score >= 58 ? C.warn : C.border2}`, background: C.panel2, borderRadius: 13, padding: 11, color: C.text, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
                    {item._score >= 78 ? <AlertTriangle size={15} color={C.danger} /> : <CalendarClock size={15} color={item._score >= 58 ? C.warn : C.green} />}
                    <strong style={{ fontSize: 12 }}>{item.nome || item.empresa}</strong>
                  </div>
                  <div style={{ color: item._score >= 78 ? C.danger : item._score >= 58 ? C.warn : C.green, fontWeight: 950, fontSize: 12 }}>Prioridade {item._nivel} - {item._score}</div>
                  <div style={{ color: C.dim, fontSize: 10.5, marginTop: 4 }}>{item.proximoPasso || item.lembreteJade || "Definir proximo passo"}</div>
                </button>
              ))}
            </div>
          </div>
        )}
        {!ativo && !editando ? (
          <div style={{ height: "100%", minHeight: 420, display: "grid", placeItems: "center", color: C.dim, textAlign: "center" }}>
            <div><Users size={42} style={{ opacity: 0.55 }} /><div style={{ marginTop: 10, fontWeight: 900 }}>Crie um cliente para iniciar o acompanhamento.</div></div>
          </div>
        ) : (
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
                      <div style={{ color: C.dim, fontSize: 10 }}>Potencial</div>
                      <div style={{ color: C.green, fontWeight: 950 }}>{brl(ativo.valorPotencial || relacionados.reduce((acc, o) => acc + valorNumerico(o.valorGlobal || o.valor), 0))}</div>
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
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>NOVO REGISTRO DE CONTATO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <select value={contato.canal} onChange={(e) => setContato((c) => ({ ...c, canal: e.target.value }))} style={INP}>{["WhatsApp", "E-mail", "Ligacao", "Reuniao", "Visita", "Sistema"].map((op) => <option key={op}>{op}</option>)}</select>
                  <select value={contato.direcao} onChange={(e) => setContato((c) => ({ ...c, direcao: e.target.value }))} style={INP}>{["Cliente respondeu", "Empresa enviou", "Registro interno"].map((op) => <option key={op}>{op}</option>)}</select>
                  <select value={contato.tipo} onChange={(e) => setContato((c) => ({ ...c, tipo: e.target.value }))} style={INP}>{["Follow-up", "Cobranca", "Duvida", "Negociacao", "Envio de arquivo", "Retorno"].map((op) => <option key={op}>{op}</option>)}</select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                  <input value={contato.assunto} onChange={(e) => setContato((c) => ({ ...c, assunto: e.target.value }))} placeholder="Assunto do contato" style={INP} />
                  <select value={contato.orcamentoId} onChange={(e) => setContato((c) => ({ ...c, orcamentoId: e.target.value }))} style={INP}>
                    <option value="">Sem orcamento vinculado</option>
                    {relacionados.map((orc) => <option key={orc.id} value={orc.id}>{orc.numero || "Orcamento"} - {brl(orc.valorGlobal || orc.valor)}</option>)}
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
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>ORCAMENTOS RELACIONADOS</div>
                <div style={{ display: "grid", gap: 8 }}>
                  {relacionados.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum orcamento relacionado encontrado pelo nome do cliente.</div>}
                  {relacionados.slice(0, 8).map((orc) => (
                    <div key={orc.id} style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center", background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 10, padding: 10 }}>
                      <div><div style={{ fontWeight: 900, fontSize: 12 }}>{orc.numero || "Orcamento"} - {orc.empresaNome}</div><div style={{ color: C.dim, fontSize: 11 }}>{brl(orc.valorGlobal || orc.valor)} | {statusFunil(orc)}</div></div>
                      <div style={{ display: "flex", gap: 6 }}><button onClick={() => abrirOrcamentoSalvo?.(orc)} style={{ padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.border2}`, background: "transparent", color: C.muted, cursor: "pointer" }}><FileText size={13} /> Abrir</button><button onClick={() => baixarOrcamento?.(orc)} style={{ padding: "7px 9px", borderRadius: 8, border: `1px solid ${C.blue2}55`, background: `${C.blue2}12`, color: "#93C5FD", cursor: "pointer" }}>PDF</button></div>
                    </div>
                  ))}
                </div>
              </div>

              <div style={{ background: C.panel, border: `1px solid ${C.border}`, borderRadius: 16, padding: 16 }}>
                <div style={{ color: C.green, fontSize: 10, letterSpacing: 2, fontWeight: 950, marginBottom: 10 }}>HISTORICO DO CLIENTE</div>
                <div style={{ display: "grid", gap: 9 }}>
                  {contatosAtivo.length === 0 && <div style={{ color: C.dim, fontSize: 12 }}>Nenhum contato registrado ainda.</div>}
                  {contatosAtivo.slice(0, 30).map((msg) => (
                    <div key={msg.id} style={{ background: C.panel2, border: `1px solid ${C.border2}`, borderRadius: 12, padding: 11 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 5 }}><strong style={{ fontSize: 12 }}>{msg.canal} | {msg.tipo}</strong><span style={{ color: C.dim, fontSize: 10 }}>{tsFmt(msg.criadoEm)}</span></div>
                      <div style={{ color: C.dim, fontSize: 11, marginBottom: 6 }}>{msg.direcao}{msg.orcamentoNumero ? ` | ${msg.orcamentoNumero}` : ""}</div>
                      {msg.mensagem && <div style={{ whiteSpace: "pre-wrap", lineHeight: 1.55, fontSize: 12 }}>{msg.mensagem}</div>}
                      {msg.arquivoNome && <div style={{ marginTop: 8, color: "#93C5FD", fontSize: 11 }}>Anexo: {msg.arquivoNome} - {msg.arquivoResumo}</div>}
                      {msg.arquivoPreview && <img src={msg.arquivoPreview} alt="" style={{ marginTop: 8, maxHeight: 120, maxWidth: "100%", borderRadius: 8, border: `1px solid ${C.border2}` }} />}
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        )}
      </main>
    </div>
  );
}
