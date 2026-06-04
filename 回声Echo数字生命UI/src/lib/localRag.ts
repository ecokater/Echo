import { corpusStore, messageStore } from "./localdb";
import type { InferenceContext, InferenceMessage } from "@/types/skill";

const STRIP = /[\s，。？！,.?!]/g;

/**
 * Local RAG: score corpus entries by character overlap with the query,
 * weighted by entry weight; pinned "钢印记忆" get a boost. Mirrors the
 * legacy server-side recall so prompt quality stays consistent.
 */
export async function retrieveMemories(personaId: string, query: string, topK = 5): Promise<string[]> {
  const corpus = await corpusStore.list(personaId);
  if (corpus.length === 0) return [];

  const qChars = new Set(query.replace(STRIP, "").split(""));
  const scored = corpus.map((c) => {
    const cChars = new Set(c.content.split(""));
    let overlap = 0;
    qChars.forEach((ch) => { if (cChars.has(ch)) overlap++; });
    const pinBoost = c.is_pinned ? 2 : 1;
    return { content: c.content, score: overlap * c.weight * pinBoost };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored.filter((s) => s.score > 0).slice(0, topK).map((s) => s.content);
}

/** Assemble the inference context: recent messages (last N) + RAG memories. */
export async function buildContext(personaId: string, query: string, recentN = 12): Promise<InferenceContext> {
  const msgs = await messageStore.list(personaId);
  const recent: InferenceMessage[] = msgs.slice(-recentN).map((m) => ({ role: m.role, content: m.content }));
  const retrieved = await retrieveMemories(personaId, query);
  return { recent_messages: recent, retrieved_memories: retrieved };
}
