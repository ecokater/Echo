import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { LocalPersona, LocalMessage, LocalCorpus } from "@/types/skill";

// Local-first storage. Works on Web/Electron/Capacitor WebView (all ship IndexedDB).
// Keyed per logged-in user so multiple accounts on one device stay isolated.

interface AmberDB extends DBSchema {
  personas: { key: string; value: LocalPersona; indexes: { by_user: string } };
  messages: { key: string; value: LocalMessage; indexes: { by_persona: string } };
  corpus: { key: string; value: LocalCorpus; indexes: { by_persona: string } };
  meta: { key: string; value: unknown };
}

let _db: IDBPDatabase<AmberDB> | null = null;

async function db(): Promise<IDBPDatabase<AmberDB>> {
  if (_db) return _db;
  _db = await openDB<AmberDB>("amber-local", 1, {
    upgrade(d) {
      const p = d.createObjectStore("personas", { keyPath: "id" });
      p.createIndex("by_user", "user_scope" as never);
      const m = d.createObjectStore("messages", { keyPath: "id" });
      m.createIndex("by_persona", "persona_id");
      const c = d.createObjectStore("corpus", { keyPath: "id" });
      c.createIndex("by_persona", "persona_id");
      d.createObjectStore("meta");
    },
  });
  return _db;
}

const uid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
const now = () => new Date().toISOString();

// ---- Personas ----
export const personaStore = {
  async list(): Promise<LocalPersona[]> {
    return (await db()).getAll("personas");
  },
  async get(id: string): Promise<LocalPersona | undefined> {
    return (await db()).get("personas", id);
  },
  async create(input: Omit<LocalPersona, "id" | "created_at" | "updated_at">): Promise<LocalPersona> {
    const p: LocalPersona = { ...input, id: uid(), created_at: now(), updated_at: now() };
    await (await db()).put("personas", p);
    return p;
  },
  async update(id: string, patch: Partial<LocalPersona>): Promise<LocalPersona | undefined> {
    const d = await db();
    const cur = await d.get("personas", id);
    if (!cur) return undefined;
    const next = { ...cur, ...patch, updated_at: now() };
    await d.put("personas", next);
    return next;
  },
  async remove(id: string): Promise<void> {
    const d = await db();
    await d.delete("personas", id);
    for (const m of await d.getAllFromIndex("messages", "by_persona", id)) await d.delete("messages", m.id);
    for (const c of await d.getAllFromIndex("corpus", "by_persona", id)) await d.delete("corpus", c.id);
  },
};

// ---- Messages ----
export const messageStore = {
  async list(personaId: string): Promise<LocalMessage[]> {
    const all = await (await db()).getAllFromIndex("messages", "by_persona", personaId);
    return all.sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  },
  async add(personaId: string, role: "user" | "assistant", content: string): Promise<LocalMessage> {
    const m: LocalMessage = { id: uid(), persona_id: personaId, role, content, timestamp: now() };
    await (await db()).put("messages", m);
    return m;
  },
  async clear(personaId: string): Promise<void> {
    const d = await db();
    for (const m of await d.getAllFromIndex("messages", "by_persona", personaId)) await d.delete("messages", m.id);
  },
};

// ---- Corpus (long-term memory) ----
export const corpusStore = {
  async list(personaId: string): Promise<LocalCorpus[]> {
    const all = await (await db()).getAllFromIndex("corpus", "by_persona", personaId);
    return all.sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned) || b.weight - a.weight);
  },
  async add(personaId: string, content: string, isPinned = false): Promise<LocalCorpus> {
    const c: LocalCorpus = { id: uid(), persona_id: personaId, content, weight: 1.0, is_pinned: isPinned, timestamp: now() };
    await (await db()).put("corpus", c);
    return c;
  },
  async bulkAdd(personaId: string, contents: string[], isPinned = false): Promise<void> {
    const d = await db();
    const tx = d.transaction("corpus", "readwrite");
    for (const content of contents) {
      if (!content.trim()) continue;
      await tx.store.put({ id: uid(), persona_id: personaId, content: content.trim(), weight: 1.0, is_pinned: isPinned, timestamp: now() });
    }
    await tx.done;
  },
  async setPinned(id: string, pinned: boolean): Promise<void> {
    const d = await db();
    const c = await d.get("corpus", id);
    if (c) { c.is_pinned = pinned; if (pinned) c.weight = 1.0; await d.put("corpus", c); }
  },
  async remove(id: string): Promise<void> {
    await (await db()).delete("corpus", id);
  },
};

/** Wipe all local data (e.g. on logout / account switch). */
export async function clearAllLocal(): Promise<void> {
  const d = await db();
  await Promise.all([d.clear("personas"), d.clear("messages"), d.clear("corpus")]);
}
