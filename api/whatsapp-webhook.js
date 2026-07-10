import { createClient } from "@supabase/supabase-js";

const KEY_INBOX = "orcaflow_whatsapp_inbox";
const KEY_CLIENTES = "orcaflow_clientes_crm";
const MAX_INBOX = 1200;
const MAX_CLIENT_CONTACTS = 180;

function json(res, status, body) {
  res.status(status).json(body);
}

function getEnvUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
}

function onlyDigits(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function clean(valor = "", limite = 4000) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function textoMensagem(message = {}) {
  if (message.type === "text") return clean(message.text?.body || "", 4000);
  if (message.type === "button") return clean(message.button?.text || message.button?.payload || "", 1200);
  if (message.type === "interactive") {
    return clean(
      message.interactive?.button_reply?.title ||
        message.interactive?.button_reply?.id ||
        message.interactive?.list_reply?.title ||
        message.interactive?.list_reply?.id ||
        "",
      1200
    );
  }
  if (message.type === "image") return clean(message.image?.caption || "Imagem recebida pelo WhatsApp.", 1200);
  if (message.type === "document") return clean(message.document?.caption || message.document?.filename || "Documento recebido pelo WhatsApp.", 1200);
  if (message.type === "audio") return "Audio recebido pelo WhatsApp.";
  if (message.type === "video") return clean(message.video?.caption || "Video recebido pelo WhatsApp.", 1200);
  if (message.type === "sticker") return "Sticker recebido pelo WhatsApp.";
  if (message.type === "location") return "Localizacao recebida pelo WhatsApp.";
  return clean(`Mensagem WhatsApp recebida (${message.type || "tipo desconhecido"}).`, 1200);
}

function mediaInfo(message = {}) {
  const src = message.image || message.document || message.audio || message.video || message.sticker || null;
  if (!src) return {};
  return {
    mediaId: src.id || "",
    mimeType: src.mime_type || "",
    sha256: src.sha256 || "",
    fileName: src.filename || "",
  };
}

async function resolveUserId(supabase) {
  if (process.env.ORCAFLOW_REPORT_USER_ID) return process.env.ORCAFLOW_REPORT_USER_ID;
  const { data, error } = await supabase
    .from("app_users")
    .select("user_id,email")
    .eq("role", "admin")
    .eq("status", "approved")
    .order("approved_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Falha ao localizar admin: ${error.message}`);
  return data?.user_id || "";
}

async function readState(supabase, userId, key, fallback) {
  const { data, error } = await supabase
    .from("user_state")
    .select("value")
    .eq("user_id", userId)
    .eq("key", key)
    .maybeSingle();
  if (error) throw new Error(`Falha ao ler ${key}: ${error.message}`);
  return data?.value ?? fallback;
}

async function writeState(supabase, userId, key, value) {
  const { error } = await supabase
    .from("user_state")
    .upsert(
      { user_id: userId, key, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
  if (error) throw new Error(`Falha ao salvar ${key}: ${error.message}`);
}

function findCliente(clientes = [], phone = "", profileName = "") {
  const numero = onlyDigits(phone);
  const nome = clean(profileName, 120).toLowerCase();
  return clientes.find((cliente) => {
    const phones = [cliente.whatsapp, cliente.telefone, cliente.telefone2].map(onlyDigits).filter(Boolean);
    if (numero && phones.some((p) => p.endsWith(numero.slice(-8)) || numero.endsWith(p.slice(-8)))) return true;
    const nomeCliente = clean(cliente.nome || cliente.empresa, 120).toLowerCase();
    return nome && nomeCliente && nomeCliente === nome;
  });
}

function criarCliente(userId, phone, profileName) {
  const agora = new Date().toISOString();
  const nome = clean(profileName, 120) || `Contato WhatsApp ${phone}`;
  return {
    id: `cli_whats_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome,
    empresa: nome,
    cargo: "",
    email: "",
    email2: "",
    telefone: "",
    whatsapp: phone,
    telefone2: "",
    documento: "",
    endereco: "",
    cidadeUf: "",
    segmento: "",
    decisor: "",
    origem: "WhatsApp recebido automaticamente",
    perfil: "Lead criado automaticamente a partir de mensagem real recebida pelo WhatsApp.",
    status: "Novo",
    temperatura: "Morno",
    proximoContato: "",
    valorPotencial: "",
    observacoes: "",
    proximoPasso: "Nara deve analisar a conversa recebida e sugerir o proximo passo.",
    lembreteJade: "Mensagem real recebida pelo WhatsApp. Responder em modo assistido.",
    jade: null,
    contatos: [],
    userId,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

function appendContatoCliente(cliente, inboxItem, userId) {
  const contatos = Array.isArray(cliente.contatos) ? cliente.contatos : [];
  if (contatos.some((msg) => msg.waMessageId === inboxItem.waMessageId)) return cliente;
  const registro = {
    id: `ct_whats_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    canal: "WhatsApp",
    direcao: "Cliente respondeu",
    tipo: "Entrada automatica",
    assunto: "Mensagem recebida pelo WhatsApp",
    mensagem: inboxItem.text || "",
    orcamentoId: "",
    orcamentoNumero: "",
    arquivoResumo: inboxItem.mediaId ? `Midia recebida: ${inboxItem.type || ""} ${inboxItem.fileName || inboxItem.mediaId}` : "",
    criadoEm: inboxItem.receivedAt,
    userId,
    origem: "whatsapp_webhook",
    waMessageId: inboxItem.waMessageId,
    auditavel: true,
  };
  return {
    ...cliente,
    contatos: [registro, ...contatos].slice(0, MAX_CLIENT_CONTACTS),
    status: cliente.status === "Fechado" ? cliente.status : "Em acompanhamento",
    temperatura: cliente.temperatura === "Quente" ? "Quente" : "Morno",
    proximoPasso: "Responder mensagem recebida pelo WhatsApp em modo assistido.",
    lembreteJade: "Cliente respondeu no WhatsApp. Nara deve orientar a resposta.",
    atualizadoEm: new Date().toISOString(),
  };
}

function parseWebhook(body = {}) {
  const recebidas = [];
  const entries = Array.isArray(body.entry) ? body.entry : [];
  for (const entry of entries) {
    for (const change of Array.isArray(entry.changes) ? entry.changes : []) {
      const value = change.value || {};
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      const metadata = value.metadata || {};
      for (const message of Array.isArray(value.messages) ? value.messages : []) {
        const contact = contacts.find((item) => item.wa_id === message.from) || contacts[0] || {};
        const receivedAt = message.timestamp
          ? new Date(Number(message.timestamp) * 1000).toISOString()
          : new Date().toISOString();
        recebidas.push({
          id: `wa_${message.id || Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          waMessageId: message.id || "",
          direction: "entrada",
          from: onlyDigits(message.from || contact.wa_id || ""),
          to: onlyDigits(metadata.display_phone_number || metadata.phone_number_id || ""),
          phoneNumberId: metadata.phone_number_id || "",
          profileName: clean(contact.profile?.name || "", 160),
          type: message.type || "unknown",
          text: textoMensagem(message),
          receivedAt,
          timestamp: message.timestamp || "",
          status: "novo",
          origem: "whatsapp_webhook",
          auditavel: true,
          ...mediaInfo(message),
        });
      }
    }
  }
  return recebidas.filter((item) => item.from && item.waMessageId);
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];
    if (mode === "subscribe" && token && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
    return res.status(403).send("Webhook nao verificado.");
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  }

  try {
    const supabaseUrl = getEnvUrl();
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) {
      return json(res, 500, { ok: false, error: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY." });
    }

    const recebidas = parseWebhook(req.body || {});
    if (!recebidas.length) return json(res, 200, { ok: true, saved: 0 });

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = await resolveUserId(supabase);
    if (!userId) return json(res, 404, { ok: false, error: "Nenhum admin aprovado encontrado." });

    const inboxAtual = await readState(supabase, userId, KEY_INBOX, []);
    const clientesAtual = await readState(supabase, userId, KEY_CLIENTES, []);
    const inbox = Array.isArray(inboxAtual) ? inboxAtual : [];
    let clientes = Array.isArray(clientesAtual) ? clientesAtual : [];
    const idsInbox = new Set(inbox.map((item) => item.waMessageId).filter(Boolean));
    const novas = [];

    for (const msg of recebidas) {
      if (idsInbox.has(msg.waMessageId)) continue;
      let cliente = findCliente(clientes, msg.from, msg.profileName);
      if (!cliente) {
        cliente = criarCliente(userId, msg.from, msg.profileName);
        clientes = [cliente, ...clientes];
      }
      const inboxItem = {
        ...msg,
        clienteId: cliente.id,
        clienteNome: cliente.nome || cliente.empresa || msg.profileName || msg.from,
      };
      novas.push(inboxItem);
      clientes = clientes.map((item) => item.id === cliente.id ? appendContatoCliente(item, inboxItem, userId) : item);
    }

    if (novas.length) {
      await writeState(supabase, userId, KEY_INBOX, [...novas, ...inbox].slice(0, MAX_INBOX));
      await writeState(supabase, userId, KEY_CLIENTES, clientes);
    }

    return json(res, 200, { ok: true, saved: novas.length });
  } catch (error) {
    console.error("[whatsapp-webhook]", error);
    return json(res, 500, { ok: false, error: error.message || "Erro ao processar webhook do WhatsApp." });
  }
}
