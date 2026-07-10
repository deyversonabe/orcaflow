import { createClient } from "@supabase/supabase-js";
import { enforceSameOrigin, rateLimit, rejectOversizedRequest } from "./_security.js";

const KEY_CLIENTES = "orcaflow_clientes_crm";
const MAX_CLIENTES = 4000;

function json(res, status, body) {
  res.status(status).json(body);
}

function getEnvUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
}

function clean(valor = "", limite = 400) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function onlyDigits(valor = "") {
  return String(valor || "").replace(/\D/g, "");
}

function emailValido(valor = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(valor || "").trim());
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

function encontrarClienteExistente(clientes = [], { whatsapp, email }) {
  const numero = onlyDigits(whatsapp);
  const mail = clean(email, 180).toLowerCase();
  return clientes.find((cliente) => {
    const phones = [cliente.whatsapp, cliente.telefone, cliente.telefone2].map(onlyDigits).filter(Boolean);
    const matchTelefone = numero && phones.some((p) => p && (p.endsWith(numero.slice(-8)) || numero.endsWith(p.slice(-8))));
    const matchEmail = mail && [cliente.email, cliente.email2].map((e) => clean(e, 180).toLowerCase()).includes(mail);
    return matchTelefone || matchEmail;
  });
}

function criarLead(userId, dados) {
  const agora = new Date().toISOString();
  return {
    id: `cli_lead_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    nome: dados.nome,
    empresa: dados.empresa || dados.nome,
    cargo: "",
    email: dados.email || "",
    email2: "",
    telefone: dados.whatsapp || "",
    whatsapp: dados.whatsapp || "",
    telefone2: "",
    documento: "",
    endereco: "",
    cidadeUf: dados.cidadeUf || "",
    segmento: "",
    decisor: "",
    origem: dados.origem || "Formulario do site",
    perfil: "Lead criado automaticamente pelo formulario publico de captacao.",
    status: "Novo",
    temperatura: "Morno",
    proximoContato: "",
    valorPotencial: "",
    observacoes: dados.mensagem ? `Mensagem do formulario: ${dados.mensagem}` : "",
    proximoPasso: "Fazer o primeiro contato com este lead recebido pelo site.",
    lembreteJade: "Novo lead recebido pelo formulario do site. Priorizar primeiro contato.",
    jade: null,
    contatos: [{
      id: `ct_lead_${Date.now()}`,
      canal: "Formulario",
      direcao: "Cliente respondeu",
      tipo: "Novo lead",
      assunto: "Formulario de captacao",
      mensagem: dados.mensagem ? clean(dados.mensagem, 3000) : "Lead preencheu o formulario de captacao do site.",
      orcamentoId: "",
      orcamentoNumero: "",
      criadoEm: agora,
      userId,
      origem: "lead_capture_form",
    }],
    userId,
    criadoEm: agora,
    atualizadoEm: agora,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  }

try {
  if (!enforceSameOrigin(req, res)) return;
  if (rejectOversizedRequest(req, res, 60000)) return;
  if (!rateLimit(req, res, { id: "lead-capture", limit: 8, windowMs: 60 * 1000 })) return;

  const supabaseUrl = getEnvUrl();
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, { ok: false, error: "Configuracao do servidor incompleta." });
  }

  const body = req.body || {};

  if (clean(body.website, 200)) {
    return json(res, 200, { ok: true });
  }

  const nome = clean(body.nome, 160);
  const empresa = clean(body.empresa, 160);
  const whatsapp = onlyDigits(body.whatsapp || body.telefone);
  const email = clean(body.email, 180);
  const mensagem = clean(body.mensagem, 3000);
  const origem = clean(body.origem, 120);
  const cidadeUf = clean(body.cidadeUf, 120);

  if (!nome && !empresa) {
    return json(res, 400, { ok: false, error: "Informe ao menos o nome ou a empresa." });
  }
  if (!whatsapp && !email) {
    return json(res, 400, { ok: false, error: "Informe um WhatsApp ou e-mail para contato." });
  }
  if (email && !emailValido(email)) {
    return json(res, 400, { ok: false, error: "E-mail invalido." });
  }
  if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 13)) {
    return json(res, 400, { ok: false, error: "WhatsApp invalido." });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const userId = await resolveUserId(supabase);
  if (!userId) return json(res, 404, { ok: false, error: "Nenhum administrador aprovado encontrado." });

  const atuais = await readState(supabase, userId, KEY_CLIENTES, []);
  let clientes = Array.isArray(atuais) ? atuais : [];

  const existente = encontrarClienteExistente(clientes, { whatsapp, email });
  if (existente) {
    const contatoNovo = {
      id: `ct_lead_${Date.now()}`,
      canal: "Formulario",
      direcao: "Cliente respondeu",
      tipo: "Novo contato via formulario",
      assunto: "Formulario de captacao",
      mensagem: mensagem ? mensagem : "Lead preencheu o formulario de captacao novamente.",
      orcamentoId: "",
      orcamentoNumero: "",
      criadoEm: new Date().toISOString(),
      userId,
      origem: "lead_capture_form",
    };
    clientes = clientes.map((item) => item.id === existente.id ? {
      ...item,
      contatos: [contatoNovo, ...(Array.isArray(item.contatos) ? item.contatos : [])].slice(0, 180),
      atualizadoEm: new Date().toISOString(),
    } : item);
    await writeState(supabase, userId, KEY_CLIENTES, clientes);
    return json(res, 200, { ok: true, novo: false });
  }

  const lead = criarLead(userId, { nome: nome || empresa, empresa, whatsapp, email, mensagem, origem, cidadeUf });
  clientes = [lead, ...clientes].slice(0, MAX_CLIENTES);
  await writeState(supabase, userId, KEY_CLIENTES, clientes);

  return json(res, 200, { ok: true, novo: true });
} catch (error) {
  console.error("[lead-capture]", error);
  return json(res, 500, { ok: false, error: "Erro ao registrar lead." });
}
}
