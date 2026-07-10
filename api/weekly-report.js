import { createClient } from "@supabase/supabase-js";
import { gerarRelatorioSemanalNara, WEEKLY_REPORT_PENDING_KEY } from "../src/weeklyReport.js";

const STATE_KEYS = ["orcaflow_crm_orcamentos", "orcaflow_clientes_crm", "orcaflow_empresas"];

function json(res, status, body) {
  res.status(status).json(body);
}

function authCron(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  return req.headers.authorization === `Bearer ${secret}`;
}

function getEnvUrl() {
  return process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
}

function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
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
  if (error) throw new Error(`Falha ao localizar admin do relatorio: ${error.message}`);
  return data?.user_id || "";
}

async function readState(supabase, userId) {
  const { data, error } = await supabase
    .from("user_state")
    .select("key,value")
    .eq("user_id", userId)
    .in("key", STATE_KEYS);
  if (error) throw new Error(`Falha ao ler dados do OrcaFlow: ${error.message}`);
  const map = Object.fromEntries((data || []).map((row) => [row.key, row.value]));
  return {
    crm: Array.isArray(map.orcaflow_crm_orcamentos) ? map.orcaflow_crm_orcamentos : [],
    clientes: Array.isArray(map.orcaflow_clientes_crm) ? map.orcaflow_clientes_crm : [],
    empresas: Array.isArray(map.orcaflow_empresas) ? map.orcaflow_empresas : [],
  };
}

async function savePendingReport(supabase, userId, texto) {
  const value = {
    id: `nara_weekly_${Date.now()}`,
    modo: "assistido",
    status: "pendente",
    titulo: "Relatorio semanal da Nara",
    texto,
    geradoEm: new Date().toISOString(),
    destinoPadrao: "5517992529930",
    observacao: "Modo assistido: a Nara gerou o relatorio, mas o envio pelo WhatsApp depende de clique humano.",
  };
  const { error } = await supabase
    .from("user_state")
    .upsert(
      { user_id: userId, key: WEEKLY_REPORT_PENDING_KEY, value, updated_at: new Date().toISOString() },
      { onConflict: "user_id,key" }
    );
  if (error) throw new Error(`Falha ao salvar relatorio pendente: ${error.message}`);
  return value;
}

export default async function handler(req, res) {
  if (!authCron(req)) return json(res, 401, { ok: false, error: "Cron nao autorizado." });
  if (!["GET", "POST"].includes(req.method)) return json(res, 405, { ok: false, error: "Metodo nao permitido." });

  try {
    const supabaseUrl = getEnvUrl();
    const serviceKey = getServiceKey();
    if (!supabaseUrl || !serviceKey) {
      return json(res, 500, {
        ok: false,
        error: "Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para gerar o relatorio assistido.",
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userId = await resolveUserId(supabase);
    if (!userId) return json(res, 404, { ok: false, error: "Nenhum admin aprovado encontrado para gerar o relatorio." });

    const dados = await readState(supabase, userId);
    const texto = gerarRelatorioSemanalNara({
      crm: dados.crm,
      clientes: dados.clientes,
      empresas: dados.empresas,
      usuarioNome: "Nara",
      agora: new Date(),
    });
    const pendente = await savePendingReport(supabase, userId, texto);

    return json(res, 200, {
      ok: true,
      mode: "assistido",
      scheduled: "sexta-feira 17:00 America/Sao_Paulo",
      userId,
      sent: false,
      pendingReportId: pendente.id,
      message: "Relatorio salvo como pendente. O envio pelo WhatsApp so acontece quando o usuario clicar no sistema.",
      preview: texto.slice(0, 1200),
    });
  } catch (error) {
    console.error("[weekly-report]", error);
    return json(res, 500, { ok: false, error: error.message || "Erro ao gerar relatorio semanal." });
  }
}
