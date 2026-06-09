// ─────────────────────────────────────────────────────────────
// src/store.js — ARMAZENAMENTO NA NUVEM (Supabase) COM CACHE LOCAL
//
// Substitui o objeto `store` (localStorage) do App.jsx mantendo a MESMA
// interface: store.get(key) / store.set(key, value), ambos async.
//
// Como funciona:
//  1. LÊ primeiro do Supabase (fonte da verdade, igual em todo dispositivo).
//  2. Mantém cache em memória + cópia no localStorage (modo offline).
//  3. ESCREVE com debounce (junta digitação rápida em 1 gravação só) →
//     menos requisições, mais desempenho.
//  4. REALTIME: quando outro dispositivo grava, este recebe o dado na hora.
// ─────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

const TABLE = "app_state";
const DEBOUNCE_MS = 700;

const cache = new Map();          // key -> value (memória)
const pending = new Map();        // key -> timeout de gravação
const listeners = new Set();      // callbacks (key, value) p/ sync ao vivo

// ---------- helpers de fallback local (offline) ----------
function localGet(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function localSet(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// ---------- gravação real no Supabase ----------
async function flushToCloud(key) {
  pending.delete(key);
  const value = cache.get(key);
  try {
    const { error } = await supabase
      .from(TABLE)
      .upsert({ key, value }, { onConflict: "key" });
    if (error) throw error;
    return true;
  } catch (e) {
    console.warn(`[store] Falha ao gravar "${key}" na nuvem (mantido local):`, e?.message || e);
    return false;
  }
}

export const store = {
  /** Lê um valor. Nuvem primeiro; cai para cache/localStorage se offline. */
  async get(key) {
    // Se acabou de digitar e ainda não subiu, o cache é o mais novo.
    if (pending.has(key) && cache.has(key)) return cache.get(key);

    try {
      const { data, error } = await supabase
        .from(TABLE)
        .select("value")
        .eq("key", key)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        cache.set(key, data.value);
        localSet(key, data.value);
        return data.value;
      }
      // Não existe na nuvem ainda → migra automaticamente o que houver local
      const local = localGet(key);
      if (local !== null) {
        cache.set(key, local);
        await supabase.from(TABLE).upsert({ key, value: local }, { onConflict: "key" });
        return local;
      }
      return null;
    } catch (e) {
      console.warn(`[store] Offline ou erro lendo "${key}", usando cópia local.`, e?.message || e);
      if (cache.has(key)) return cache.get(key);
      return localGet(key);
    }
  },

  /** Grava um valor. Resposta imediata (cache) + envio à nuvem com debounce. */
  async set(key, value) {
    cache.set(key, value);
    localSet(key, value); // garante que nada se perde nem offline

    clearTimeout(pending.get(key));
    pending.set(key, setTimeout(() => flushToCloud(key), DEBOUNCE_MS));
    return true;
  },

  /** Força envio imediato de tudo que está pendente (use antes de sair/logout). */
  async flushAll() {
    const keys = [...pending.keys()];
    for (const k of keys) {
      clearTimeout(pending.get(k));
      // eslint-disable-next-line no-await-in-loop
      await flushToCloud(k);
    }
  },

  /** Registra callback (key, value) chamado quando OUTRO dispositivo grava. */
  onRemoteChange(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },
};

// ---------- Realtime: sincronização ao vivo entre dispositivos ----------
try {
  supabase
    .channel("orcaflow_app_state")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: TABLE },
      (payload) => {
        const key = payload.new?.key ?? payload.old?.key;
        const value = payload.new?.value ?? null;
        if (!key) return;
        // Ignora eco de uma gravação que este próprio dispositivo acabou de fazer
        if (pending.has(key)) return;
        cache.set(key, value);
        localSet(key, value);
        listeners.forEach((cb) => {
          try { cb(key, value); } catch {}
        });
      }
    )
    .subscribe();
} catch (e) {
  console.warn("[store] Realtime indisponível:", e?.message || e);
}

// Garante que edições recentes subam mesmo se o usuário fechar a aba
if (typeof window !== "undefined") {
  window.addEventListener("beforeunload", () => {
    for (const k of pending.keys()) {
      clearTimeout(pending.get(k));
      flushToCloud(k); // best-effort
    }
  });
}
