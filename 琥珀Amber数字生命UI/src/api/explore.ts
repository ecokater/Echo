import { api } from "./client";
import type { LocalPersona } from "@/types/skill";

/** Persona card as listed in the Explore marketplace (summary view). */
export interface SharedPersonaCard {
  id: string;
  owner_id: string;
  owner_nickname: string | null;
  name: string;
  gender: string | null;
  relationship_desc: string | null;
  impression: string | null;
  avatar: string | null;
  tags: string | null;
  install_count: number;
  like_count: number;
  created_at: string | null;
}

/** Full template returned on detail / install — enough to recreate locally. */
export interface SharedPersonaDetail extends SharedPersonaCard {
  core_memory: string | null;
  traits: string | null;
  catchphrases: string | null;
}

/** Fields a local persona contributes when published to the cloud. */
export interface PublishInput {
  name: string;
  gender?: string | null;
  relationship_desc?: string | null;
  impression?: string | null;
  avatar?: string | null;
  core_memory?: string | null;
  traits?: string | null;
  catchphrases?: string | null;
  tags?: string | null;
}

export const exploreApi = {
  publish: async (input: PublishInput): Promise<SharedPersonaDetail> => {
    const { data } = await api.post<SharedPersonaDetail>("/api/explore/publish", input);
    return data;
  },

  list: async (params: { q?: string; sort?: "hot" | "new"; limit?: number; offset?: number } = {}): Promise<SharedPersonaCard[]> => {
    const { data } = await api.get<SharedPersonaCard[]>("/api/explore/list", { params });
    return data;
  },

  mine: async (): Promise<SharedPersonaCard[]> => {
    const { data } = await api.get<SharedPersonaCard[]>("/api/explore/mine");
    return data;
  },

  get: async (id: string): Promise<SharedPersonaDetail> => {
    const { data } = await api.get<SharedPersonaDetail>(`/api/explore/${id}`);
    return data;
  },

  /** Bump install count and fetch the full template for local import. */
  install: async (id: string): Promise<SharedPersonaDetail> => {
    const { data } = await api.post<SharedPersonaDetail>(`/api/explore/${id}/install`);
    return data;
  },

  unpublish: async (id: string): Promise<void> => {
    await api.delete(`/api/explore/${id}`);
  },
};

/** Parse a JSON-string-or-plain field into a string[] (backend stores traits/
 *  catchphrases as JSON text; local persona uses arrays). */
function toStringArray(raw: string | null): string[] {
  if (!raw) return [];
  const s = raw.trim();
  if (s.startsWith("[")) {
    try {
      const parsed = JSON.parse(s);
      if (Array.isArray(parsed)) return parsed.map((x) => String(x));
    } catch { /* fall through */ }
  }
  return [s];
}

/** Map a shared template into the local persona shape for `personaStore.create`.
 *  Emotion axes start at baseline — a freshly imported persona has no history. */
export function detailToLocalPersona(
  d: SharedPersonaDetail,
): Omit<LocalPersona, "id" | "created_at" | "updated_at"> {
  return {
    name: d.name,
    gender: d.gender ?? "",
    relationship_desc: d.relationship_desc ?? "",
    impression: d.impression ?? "",
    avatar: d.avatar ?? null,
    core_memory: d.core_memory ?? "",
    traits: toStringArray(d.traits),
    catchphrases: toStringArray(d.catchphrases),
    stability: 85,
    synchronization: 90,
    happiness: 50,
    anger: 0,
    anxiety: 0,
  };
}
