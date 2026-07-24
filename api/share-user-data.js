import { createClient } from "@supabase/supabase-js";
import {
  enforceSameOrigin,
  rateLimit,
  rejectOversizedRequest,
  requireSession,
} from "./_security.js";

const TABLE = "user_state";
const INTERNAL_LOGIN_DOMAIN = "usuarios.orcaflow.local";

const KEY_EMP = "orcaflow_empresas";
const KEY_CRM = "orcaflow_crm_orcamentos";
const KEY_CRM_TRASH = "orcaflow_crm_lixeira";
const KEY_AUDITORIA = "orcaflow_auditoria_acoes";
const KEY_CHAT = "orcaflow_chat_ia";
const KEY_CLIENTES = "orcaflow_clientes_crm";
const KEY_AGENDA = "orcaflow_agenda_clientes";
const KEY_WHATSAPP_MONITOR = "orcaflow_whatsapp_inbox";

const USER_TRANSFER_KEYS = [
  KEY_EMP,
  KEY_CRM,
  KEY_CRM_TRASH,
  KEY_AUDITORIA,
  KEY_CLIENTES,
  KEY_AGENDA,
  KEY_CHAT,
  KEY_WHATSAPP_MONITOR,
];

const USER_TRANSFER_OPTIONS = {
  empresas: { label: "Empresas cadastradas", keys: [KEY_EMP] },
  orcamentos: { label: "Orcamentos/gestao", keys: [KEY_CRM, KEY_CRM_TRASH, KEY_AUDITORIA] },
  clientes: { label: "Clientes CRM", keys: [KEY_CLIENTES] },
  agenda: { label: "Agenda de contatos", keys: [KEY_AGENDA] },
  chat: { label: "Historico da Nara", keys: [KEY_CHAT] },
  whatsapp: { label: "Caixa WhatsApp", keys: [KEY_WHATSAPP_MONITOR] },
  comercial: { label: "Tudo comercial", keys: [KEY_EMP, KEY_CRM, KEY_CRM_TRASH, KEY_CLIENTES, KEY_AGENDA] },
};

function json(res, status, body) {
  res.status(status).json(body);
}

function getSupabaseUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
}

function parseBody(req) {
  if (!req.body) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req.body;
}

function clean(valor = "", limite = 240) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function isInternalEmail(email = "") {
  return String(email || "").toLowerCase().endsWith(`@${INTERNAL_LOGIN_DOMAIN}`);
}

function publicUser(row = {}) {
  const displayName = clean(row.display_name || row.name || row.signature_name || row.email || "Usuario", 90);
  return {
    user_id: row.user_id,
    email: row.email || "",
    email_tecnico: isInternalEmail(row.email),
    name: row.name || "",
    display_name: displayName,
    signature_name: row.signature_name || displayName,
    role: row.role || "usuario",
    status: row.status || "pending",
    requested_at: row.requested_at || "",
    approved_at: row.approved_at || "",
    blocked_at: row.blocked_at || "",
    updated_at: row.updated_at || "",
    phone: row.phone || "",
    cargo: row.cargo || "",
  };
}

function uniqueKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : []).filter(Boolean))];
}

function summarizeRows(rows = []) {
  const resumo = {};
  for (const row of rows) {
    const userId = row.user_id;
    if (!userId) continue;
    if (!resumo[userId]) {
      resumo[userId] = { empresas: 0, orcamentos: 0, clientes: 0, agenda: 0, chat: 0, whatsapp: 0, atualizadoEm: "" };
    }
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
}

async function getCallerAccess(supabase, userId) {
  const { data, error } = await supabase
    .from("app_users")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao validar acesso: ${error.message}`);
  return data;
}

async function readRows(supabase, userId, keys) {
  const keysList = uniqueKeys(keys);
  const result = Object.fromEntries(keysList.map((key) => [key, null]));
  if (!userId || !keysList.length) return result;

  const { data, error } = await supabase
    .from(TABLE)
    .select("key,value,updated_at")
    .eq("user_id", userId)
    .in("key", keysList);

  if (error) throw new Error(`Falha ao ler dados do usuario: ${error.message}`);
  for (const row of data || []) result[row.key] = row.value;
  return result;
}

function listIdentity(item = {}) {
  return clean(item.id || item.numero || item.email || item.telefone || item.whatsapp || item.nome || item.cliente || JSON.stringify(item).slice(0, 120), 160);
}

function mergeList(current = [], incoming = []) {
  const map = new Map();
  for (const item of [...incoming, ...current]) {
    map.set(listIdentity(item), item);
  }
  return [...map.values()];
}

function markSharedValue(value, key, destinoId, origemId, actorId) {
  const sharedAt = new Date().toISOString();
  if (Array.isArray(value)) {
    return value.map((item) => ({
      ...item,
      userId: destinoId,
      origemUserId: item?.origemUserId || item?.userId || origemId,
      compartilhadoPor: actorId,
      compartilhadoEm: sharedAt,
      compartilhamento: {
        origemUserId: origemId,
        destinoUserId: destinoId,
        por: actorId,
        em: sharedAt,
        conteudo: key,
      },
    }));
  }

  if (value && typeof value === "object") {
    return {
      ...value,
      compartilhadoPor: actorId,
      compartilhadoEm: sharedAt,
      compartilhamento: {
        origemUserId: origemId,
        destinoUserId: destinoId,
        por: actorId,
        em: sharedAt,
        conteudo: key,
      },
    };
  }

  return value;
}

function buildTransferPayload({ origemDados, destinoDados, keys, origemId, destinoId, actorId }) {
  const payloadDestino = {};
  const payloadOrigem = {};
  let total = 0;

  for (const key of keys) {
    const value = origemDados[key];
    if (Array.isArray(value)) {
      const incoming = markSharedValue(value, key, destinoId, origemId, actorId);
      payloadDestino[key] = mergeList(Array.isArray(destinoDados[key]) ? destinoDados[key] : [], incoming);
      payloadOrigem[key] = [];
      total += incoming.length;
    } else if (value && typeof value === "object") {
      payloadDestino[key] = {
        ...(destinoDados[key] && typeof destinoDados[key] === "object" ? destinoDados[key] : {}),
        ...markSharedValue(value, key, destinoId, origemId, actorId),
      };
      payloadOrigem[key] = {};
      total += 1;
    } else if (typeof value === "string" && value.trim()) {
      payloadDestino[key] = value;
      payloadOrigem[key] = "";
      total += 1;
    }
  }

  return { payloadDestino, payloadOrigem, total };
}

async function upsertState(supabase, userId, values) {
  const entries = Object.entries(values || {});
  if (!entries.length) return;
  const updatedAt = new Date().toISOString();
  const { error } = await supabase
    .from(TABLE)
    .upsert(
      entries.map(([key, value]) => ({ user_id: userId, key, value, updated_at: updatedAt })),
      { onConflict: "user_id,key" },
    );
  if (error) throw new Error(`Falha ao salvar dados na nuvem: ${error.message}`);
}

async function handleGet({ req, res, supabase, caller, callerAccess }) {
  const isAdmin = callerAccess?.role === "admin" && callerAccess?.status === "approved";
  const { data: users, error: usersError } = await supabase
    .from("app_users")
    .select("*")
    .order("requested_at", { ascending: false });

  if (usersError) throw new Error(`Falha ao listar usuarios: ${usersError.message}`);

  const userRows = Array.isArray(users) ? users : [];
  const visibleUsers = isAdmin
    ? userRows
    : userRows.filter((row) => row.status === "approved" || row.user_id === caller.id);

  const userIdsForState = isAdmin ? userRows.map((row) => row.user_id).filter(Boolean) : [caller.id];
  let stateRows = [];
  if (userIdsForState.length) {
    const { data, error } = await supabase
      .from(TABLE)
      .select("user_id,key,value,updated_at")
      .in("user_id", userIdsForState)
      .in("key", USER_TRANSFER_KEYS)
      .order("updated_at", { ascending: false });
    if (error) throw new Error(`Falha ao resumir dados dos usuarios: ${error.message}`);
    stateRows = Array.isArray(data) ? data : [];
  }

  return json(res, 200, {
    ok: true,
    isAdmin,
    currentUserId: caller.id,
    acessos: visibleUsers.map(publicUser),
    resumoUsuarios: summarizeRows(stateRows),
  });
}

async function handlePost({ req, res, supabase, caller, callerAccess }) {
  const body = parseBody(req);
  const isAdmin = callerAccess?.role === "admin" && callerAccess?.status === "approved";
  const option = USER_TRANSFER_OPTIONS[body.tipo] || USER_TRANSFER_OPTIONS.empresas;

  let origemId = clean(body.origem, 80);
  const destinoId = clean(body.destino, 80);
  let modo = body.modo === "mover" ? "mover" : "copiar";

  if (!isAdmin) {
    origemId = caller.id;
    modo = "copiar";
  }

  if (callerAccess?.status !== "approved") {
    return json(res, 403, { ok: false, error: "Seu acesso ainda nao esta aprovado para compartilhar dados." });
  }

  if (!origemId || !destinoId || origemId === destinoId) {
    return json(res, 400, { ok: false, error: "Escolha usuarios diferentes para origem e destino." });
  }

  if (!isAdmin && body.origem && body.origem !== caller.id) {
    return json(res, 403, { ok: false, error: "Usuario comum so pode compartilhar dados criados por ele." });
  }

  if (!isAdmin && body.modo === "mover") {
    return json(res, 403, { ok: false, error: "Mover dados entre usuarios e uma acao exclusiva do administrador." });
  }

  const { data: destino, error: destinoError } = await supabase
    .from("app_users")
    .select("user_id,status,role")
    .eq("user_id", destinoId)
    .maybeSingle();

  if (destinoError) throw new Error(`Falha ao validar usuario destino: ${destinoError.message}`);
  if (!destino?.user_id || destino.status !== "approved") {
    return json(res, 400, { ok: false, error: "O usuario destino precisa existir e estar aprovado." });
  }

  if (!isAdmin) {
    const { data: origem, error: origemError } = await supabase
      .from("app_users")
      .select("user_id,status")
      .eq("user_id", origemId)
      .maybeSingle();
    if (origemError) throw new Error(`Falha ao validar usuario origem: ${origemError.message}`);
    if (!origem?.user_id || origem.status !== "approved") {
      return json(res, 403, { ok: false, error: "Usuario origem sem acesso aprovado." });
    }
  }

  const origemDados = await readRows(supabase, origemId, option.keys);
  const destinoDados = await readRows(supabase, destinoId, option.keys);
  const { payloadDestino, payloadOrigem, total } = buildTransferPayload({
    origemDados,
    destinoDados,
    keys: option.keys,
    origemId,
    destinoId,
    actorId: caller.id,
  });

  if (!total) {
    return json(res, 400, { ok: false, error: "Nao ha dados nesta origem para compartilhar." });
  }

  await upsertState(supabase, destinoId, payloadDestino);
  if (modo === "mover") await upsertState(supabase, origemId, payloadOrigem);

  return json(res, 200, {
    ok: true,
    total,
    modo,
    tipo: body.tipo || "empresas",
    label: option.label,
  });
}

export default async function handler(req, res) {
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, { id: "share-user-data", limit: 80, windowMs: 60 * 1000 })) return;
  if (req.method === "POST" && rejectOversizedRequest(req, res, 64 * 1024)) return;

  const caller = await requireSession(req, res);
  if (!caller) return;

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, {
      ok: false,
      code: "SERVICE_ROLE_REQUIRED",
      error: "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para habilitar compartilhamento seguro entre usuarios.",
    });
  }

  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  try {
    const callerAccess = await getCallerAccess(adminClient, caller.id);
    if (!callerAccess?.user_id) {
      return json(res, 403, { ok: false, error: "Cadastro do usuario nao encontrado no controle de acesso." });
    }

    if (req.method === "GET") {
      return await handleGet({ req, res, supabase: adminClient, caller, callerAccess });
    }

    return await handlePost({ req, res, supabase: adminClient, caller, callerAccess });
  } catch (error) {
    console.error("[share-user-data]", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Nao foi possivel processar o compartilhamento.",
    });
  }
}
