import { supabase } from "./supabase.js";

const TABLE = "user_state";
let cachedUser = null;
let cachedUserLoaded = false;
let cachedUserPromise = null;

supabase.auth.onAuthStateChange((_event, session) => {
  cachedUser = session?.user || null;
  cachedUserLoaded = true;
});

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

function uniqueKeys(keys = []) {
  return [...new Set((Array.isArray(keys) ? keys : []).filter(Boolean))];
}

async function currentUser() {
  if (cachedUserLoaded) return cachedUser;
  if (!cachedUserPromise) {
    cachedUserPromise = supabase.auth.getSession()
      .then(({ data }) => {
        cachedUser = data.session?.user || null;
        cachedUserLoaded = true;
        return cachedUser;
      })
      .catch(() => {
        cachedUser = null;
        cachedUserLoaded = true;
        return null;
      })
      .finally(() => {
        cachedUserPromise = null;
      });
  }
  return cachedUserPromise;
}

export const store = {
  async getMany(keys = []) {
    const keysList = uniqueKeys(keys);
    const result = Object.fromEntries(keysList.map((key) => [key, null]));
    if (!keysList.length) return result;

    const user = await currentUser();
    if (!user) {
      for (const key of keysList) result[key] = localGet(key);
      return result;
    }

    const { data, error } = await supabase
      .from(TABLE)
      .select("key,value")
      .eq("user_id", user.id)
      .in("key", keysList);

    if (error) {
      console.warn("[store] Falha ao ler lote na nuvem:", error.message);
      for (const key of keysList) result[key] = localGet(key, user.id) ?? localGet(key);
      return result;
    }

    const found = new Set();
    for (const row of data || []) {
      found.add(row.key);
      result[row.key] = row.value;
      localSet(row.key, row.value, user.id);
    }

    const migrations = [];
    const legacyOwner = localStorage.getItem("orcaflow_legacy_owner");
    for (const key of keysList) {
      if (found.has(key)) continue;
      let local = localGet(key, user.id);
      if (local === null && (!legacyOwner || legacyOwner === user.id)) {
        local = localGet(key);
        if (local !== null && !legacyOwner) {
          localStorage.setItem("orcaflow_legacy_owner", user.id);
        }
      }
      if (local !== null) {
        result[key] = local;
        migrations.push({ user_id: user.id, key, value: local, updated_at: new Date().toISOString() });
      }
    }

    if (migrations.length) {
      const { error: migrationError } = await supabase
        .from(TABLE)
        .upsert(migrations, { onConflict: "user_id,key" });
      if (migrationError) {
        console.warn("[store] Falha ao migrar lote:", migrationError.message);
      }
    }

    return result;
  },

  async getManyForUser(userId, keys = []) {
    const keysList = uniqueKeys(keys);
    const result = Object.fromEntries(keysList.map((key) => [key, null]));
    if (!userId || !keysList.length) return result;

    const { data, error } = await supabase
      .from(TABLE)
      .select("key,value,updated_at")
      .eq("user_id", userId)
      .in("key", keysList);

    if (error) {
      console.warn("[store] Falha ao ler dados do usuario:", error.message);
      return result;
    }

    for (const row of data || []) {
      result[row.key] = row.value;
    }
    return result;
  },

  async getAllUserRows(keys = []) {
    const keysList = uniqueKeys(keys);
    if (!keysList.length) return [];

    const { data, error } = await supabase
      .from(TABLE)
      .select("user_id,key,value,updated_at")
      .in("key", keysList)
      .order("updated_at", { ascending: false });

    if (error) {
      console.warn("[store] Falha ao ler dados gerais:", error.message);
      return [];
    }
    return Array.isArray(data) ? data : [];
  },

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

  async setMany(values = {}) {
    const entries = Object.entries(values || {});
    const user = await currentUser();
    if (!user) return false;
    const updatedAt = new Date().toISOString();

    for (const [key, value] of entries) {
      localSet(key, value, user.id);
    }

    if (!entries.length) return true;

    const { error } = await supabase
      .from(TABLE)
      .upsert(
        entries.map(([key, value]) => ({ user_id: user.id, key, value, updated_at: updatedAt })),
        { onConflict: "user_id,key" }
      );

    if (error) {
      console.error("[store] Falha ao salvar lote na nuvem:", error.message);
      return false;
    }
    return true;
  },

  async setManyForUser(userId, values = {}) {
    const entries = Object.entries(values || {});
    if (!userId || !entries.length) return false;
    const updatedAt = new Date().toISOString();

    const { error } = await supabase
      .from(TABLE)
      .upsert(
        entries.map(([key, value]) => ({ user_id: userId, key, value, updated_at: updatedAt })),
        { onConflict: "user_id,key" }
      );

    if (error) {
      console.error("[store] Falha ao salvar dados para usuario:", error.message);
      return false;
    }
    return true;
  },

  async migrate(keys) {
    const result = await this.getMany(keys);
    return Object.keys(result).length;
  },
};
