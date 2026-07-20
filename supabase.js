import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const sessionOnlyStorage = {
  getItem: (key) => {
    try {
      return window.sessionStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem: (key, value) => {
    try {
      window.sessionStorage.setItem(key, value);
    } catch {
      // Sem armazenamento de sessao, o usuario precisara autenticar novamente.
    }
  },
  removeItem: (key) => {
    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Nada para remover.
    }
  },
};

if (!url || !anonKey) {
  throw new Error("Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    storage: sessionOnlyStorage,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export async function authHeaders() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
