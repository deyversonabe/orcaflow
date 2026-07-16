import { createClient } from "@supabase/supabase-js";
import {
  enforceSameOrigin,
  rateLimit,
  rejectOversizedRequest,
  requireSession,
} from "./_security.js";

const INTERNAL_LOGIN_DOMAIN = "usuarios.orcaflow.local";

function json(res, status, body) {
  res.status(status).json(body);
}

function clean(valor = "", limite = 240) {
  return String(valor || "").replace(/\s+/g, " ").trim().slice(0, limite);
}

function slugLoginInterno(valor = "") {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "")
    .slice(0, 70);
}

function emailParaLoginOrcaflow(valor = "") {
  const login = clean(valor, 140).toLowerCase();
  if (!login) return "";
  if (login.includes("@")) return login;
  const slug = slugLoginInterno(login);
  return slug ? `${slug}@${INTERNAL_LOGIN_DOMAIN}` : "";
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

async function assertAdmin(supabase, userId) {
  const { data, error } = await supabase
    .from("app_users")
    .select("role,status")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw new Error(`Falha ao validar administrador: ${error.message}`);
  return data?.role === "admin" && data?.status === "approved";
}

async function findAuthUserByEmail(supabase, email) {
  const target = String(email || "").toLowerCase();
  for (let page = 1; page <= 5; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const found = (data?.users || []).find((user) => String(user.email || "").toLowerCase() === target);
    if (found) return found;
    if ((data?.users || []).length < 1000) break;
  }
  return null;
}

async function upsertAccess(supabase, user, payload) {
  const now = new Date().toISOString();
  const row = {
    user_id: user.id,
    email: user.email,
    name: payload.displayName || payload.nome,
    display_name: payload.displayName || payload.nome,
    signature_name: payload.signatureName || payload.displayName || payload.nome,
    phone: payload.phone || null,
    cargo: payload.cargo || null,
    role: payload.role,
    status: "approved",
    requested_at: now,
    approved_at: now,
    blocked_at: null,
    updated_at: now,
  };

  const { error } = await supabase
    .from("app_users")
    .upsert(row, { onConflict: "user_id" });

  if (error) throw new Error(`Usuario criado, mas falhou ao aprovar acesso: ${error.message}`);
  return row;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { ok: false, error: "Metodo nao permitido." });
  if (!enforceSameOrigin(req, res)) return;
  if (!rateLimit(req, res, { id: "create-auth-user", limit: 20, windowMs: 60 * 1000 })) return;
  if (rejectOversizedRequest(req, res, 40 * 1024)) return;

  const caller = await requireSession(req, res);
  if (!caller) return;

  const supabaseUrl = getSupabaseUrl();
  const serviceKey = getServiceKey();
  if (!supabaseUrl || !serviceKey) {
    return json(res, 500, {
      ok: false,
      code: "SERVICE_ROLE_REQUIRED",
      error: "Configure SUPABASE_SERVICE_ROLE_KEY na Vercel para criar acessos internos reais.",
    });
  }

  try {
    const body = parseBody(req);
    const nome = clean(body.nome || body.name, 90);
    const senha = String(body.senha || body.password || "");
    const role = body.tipo === "admin" || body.role === "admin" ? "admin" : "usuario";
    const displayName = clean(body.displayName || body.display_name || nome, 90);
    const signatureName = clean(body.signatureName || body.signature_name || displayName || nome, 120);
    const phone = clean(body.phone || body.telefone || "", 40);
    const cargo = clean(body.cargo || "", 90);
    const loginEmail = emailParaLoginOrcaflow(body.loginEmail || body.email || nome);

    if (!nome) return json(res, 400, { ok: false, error: "Informe o nome do usuario." });
    if (!loginEmail || !loginEmail.includes("@")) return json(res, 400, { ok: false, error: "Login interno invalido." });
    if (senha.length < 6) return json(res, 400, { ok: false, error: "A senha precisa ter pelo menos 6 caracteres." });

    const adminClient = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const isAdmin = await assertAdmin(adminClient, caller.id);
    if (!isAdmin) return json(res, 403, { ok: false, error: "Apenas administrador aprovado pode criar acessos internos." });

    let authUser = null;
    const { data: accessByEmail, error: accessError } = await adminClient
      .from("app_users")
      .select("user_id,email")
      .eq("email", loginEmail)
      .maybeSingle();
    if (accessError) throw new Error(`Falha ao verificar acesso existente: ${accessError.message}`);

    if (accessByEmail?.user_id) {
      const { data, error } = await adminClient.auth.admin.updateUserById(accessByEmail.user_id, {
        password: senha,
        email_confirm: true,
        user_metadata: { name: displayName || nome, internal_login: nome },
      });
      if (error) throw error;
      authUser = data.user;
    } else {
      const { data, error } = await adminClient.auth.admin.createUser({
        email: loginEmail,
        password: senha,
        email_confirm: true,
        user_metadata: { name: displayName || nome, internal_login: nome },
      });

      if (error) {
        const duplicate = /already|registered|exists/i.test(error.message || "");
        if (!duplicate) throw error;
        const found = await findAuthUserByEmail(adminClient, loginEmail);
        if (!found) throw error;
        const updated = await adminClient.auth.admin.updateUserById(found.id, {
          password: senha,
          email_confirm: true,
          user_metadata: { name: displayName || nome, internal_login: nome },
        });
        if (updated.error) throw updated.error;
        authUser = updated.data.user;
      } else {
        authUser = data.user;
      }
    }

    if (!authUser?.id) throw new Error("Supabase nao retornou o usuario criado.");

    const acesso = await upsertAccess(adminClient, authUser, {
      nome,
      displayName,
      signatureName,
      phone,
      cargo,
      role,
    });

    return json(res, 200, {
      ok: true,
      user: {
        user_id: authUser.id,
        email: authUser.email,
        login: nome,
        role: acesso.role,
        status: acesso.status,
        display_name: acesso.display_name,
      },
    });
  } catch (error) {
    console.error("[create-auth-user]", error);
    return json(res, 500, {
      ok: false,
      error: error?.message || "Nao foi possivel criar o acesso interno.",
    });
  }
}
