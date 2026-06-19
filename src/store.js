import { supabase } from "./supabase.js";

const TABLE = "user_state";

function localKey(key, userId) {
  return userId ? `${key}::${userId}` : key;
}

function localGet(key, userId = null) {
  try {
    const raw = localStorage.getItem(localKey(key, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function localSet(key, value, userId = null) {
  try {
    localStorage.setItem(localKey(key, userId), JSON.stringify(value));
  } catch {
    // A nuvem continua sendo a fonte principal quando o armazenamento local lota.
  }
}

async function currentUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return null;
  return data.user;
}

export const store = {
  async get(key) {
    const user = await currentUser();
    if (!user) return localGet(key);

    const { data, error } = await supabase
      .from(TABLE)
      .select("value")
      .eq("user_id", user.id)
      .eq("key", key)
      .maybeSingle();

    if (error) {
      console.warn(`[store] Falha ao ler ${key} na nuvem:`, error.message);
      return localGet(key);
    }

    if (data) {
      localSet(key, data.value, user.id);
      return data.value;
    }

    let local = localGet(key, user.id);
    const legacyOwner = localStorage.getItem("orcaflow_legacy_owner");
    if (local === null && (!legacyOwner || legacyOwner === user.id)) {
      local = localGet(key);
      if (local !== null && !legacyOwner) {
        localStorage.setItem("orcaflow_legacy_owner", user.id);
      }
    }
    if (local !== null) {
      const { error: migrationError } = await supabase
        .from(TABLE)
        .upsert(
          { user_id: user.id, key, value: local, updated_at: new Date().toISOString() },
          { onConflict: "user_id,key" }
        );
      if (migrationError) {
        console.warn(`[store] Falha ao migrar ${key}:`, migrationError.message);
      }
    }
    return local;
  },

  async set(key, value) {
    const user = await currentUser();
    if (!user) return false;
    localSet(key, value, user.id);

    const { error } = await supabase
      .from(TABLE)
      .upsert(
        { user_id: user.id, key, value, updated_at: new Date().toISOString() },
        { onConflict: "user_id,key" }
      );

    if (error) {
      console.error(`[store] Falha ao salvar ${key} na nuvem:`, error.message);
      return false;
    }
    return true;
  },

  async migrate(keys) {
    const results = await Promise.all(keys.map(async (key) => {
      await this.get(key);
      return key;
    }));
    return results.length;
  },
};
