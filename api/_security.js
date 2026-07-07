const buckets = globalThis.__orcaflowRateLimit || new Map();
globalThis.__orcaflowRateLimit = buckets;

function getClientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "unknown")
    .split(",")[0]
    .trim();
}

export async function requireSession(req, res) {
  const token = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!token || !url || !anonKey) {
    res.status(401).json({ error: "Sessão inválida ou expirada.", code: "AUTH_SESSION_INVALID" });
    return null;
  }

  try {
    const response = await fetch(`${url}/auth/v1/user`, {
      headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      res.status(401).json({ error: "Sessão inválida ou expirada.", code: "AUTH_SESSION_INVALID" });
      return null;
    }
    return response.json();
  } catch {
    res.status(503).json({ error: "Serviço de autenticação indisponível.", code: "AUTH_SERVICE_UNAVAILABLE" });
    return null;
  }
}

export function enforceSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;

  const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
  const forwardedProto =
    req.headers["x-forwarded-proto"] ||
    (String(forwardedHost).startsWith("localhost") || String(forwardedHost).startsWith("127.0.0.1")
      ? "http"
      : "https");
  const expected = `${forwardedProto}://${forwardedHost}`;

  if (origin !== expected) {
    res.status(403).json({ error: "Origem não autorizada.", code: "ORIGIN_NOT_ALLOWED" });
    return false;
  }
  return true;
}

export function rateLimit(req, res, { id, limit, windowMs }) {
  const now = Date.now();
  const key = `${id}:${getClientIp(req)}`;
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  current.count += 1;
  if (current.count > limit) {
    res.setHeader("Retry-After", Math.ceil((current.resetAt - now) / 1000));
    res.status(429).json({ error: "Muitas solicitações. Aguarde e tente novamente.", code: "RATE_LIMITED" });
    return false;
  }

  return true;
}

export function rejectOversizedRequest(req, res, maxBytes) {
  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > maxBytes) {
    res.status(413).json({ error: "Solicitação maior que o limite permitido.", code: "REQUEST_TOO_LARGE" });
    return true;
  }
  return false;
}
