// Local "Janitor": background metabolism for the Local-first architecture.
//  - Emotion annealing: moods drift back toward baseline over idle time (free, local).
//  - Memory crystallization: distil recent chat into a long-term corpus entry via
//    the inference proxy (costs fragments). Throttled auto + manual trigger.
// Never blocks chat; a failed organize only skips (never corrupts existing data).

import { personaStore, messageStore, corpusStore } from "@/lib/localdb";
import { inferenceApi, modelFromSettings } from "@/api/inference";
import type { LocalPersona } from "@/types/skill";

const BASELINE = { happiness: 50, anger: 0, anxiety: 0 };

/** Compute an emotion patch decaying toward baseline by idle time. null = no change. */
export function annealMoodPatch(p: LocalPersona): Partial<LocalPersona> | null {
  const hours = (Date.now() - new Date(p.updated_at).getTime()) / 3.6e6;
  if (hours < 0.05) return null; // actively interacting (<3 min) — leave as is
  const rate = Math.min(1, hours * 0.15); // ~converges over several idle hours
  const toward = (cur: number, base: number) => Math.round(cur + (base - cur) * rate);
  const patch = {
    happiness: toward(p.happiness, BASELINE.happiness),
    anger: toward(p.anger, BASELINE.anger),
    anxiety: toward(p.anxiety, BASELINE.anxiety),
  };
  if (patch.happiness === Math.round(p.happiness) && patch.anger === Math.round(p.anger) && patch.anxiety === Math.round(p.anxiety)) {
    return null;
  }
  return patch;
}

/** Anneal every persona's mood toward baseline. Local only, no network/cost. */
export async function annealAll(): Promise<boolean> {
  const personas = await personaStore.list();
  let changed = false;
  for (const p of personas) {
    const patch = annealMoodPatch(p);
    if (patch) { await personaStore.update(p.id, patch); changed = true; }
  }
  return changed;
}

/** Distil recent chat into one long-term memory entry. Throws on failure (caller ignores). */
export async function organizeMemory(personaId: string, personaName: string): Promise<string | null> {
  const history = await messageStore.list(personaId);
  if (history.length < 4) return null; // not enough to summarize
  const recent = history.slice(-24).map((m) => ({ role: m.role, content: m.content }));
  const res = await inferenceApi.memorySummary({
    persona_name: personaName,
    messages: recent,
    model: modelFromSettings(),
  });
  const summary = (res.summary || "").trim();
  if (summary) await corpusStore.add(personaId, summary, false);
  markOrganized(personaId, history.length);
  return summary || null;
}

const ORG_KEY = (id: string) => `amber_lastorg_${id}`;
const AUTO_THRESHOLD = 24; // new messages since last organize before auto-running

function markOrganized(personaId: string, msgCount: number) {
  try { localStorage.setItem(ORG_KEY(personaId), String(msgCount)); } catch { /* ignore */ }
}

/** Auto-crystallize only when enough new messages accumulated. Fire-and-forget. */
export async function maybeAutoOrganize(personaId: string, personaName: string): Promise<void> {
  try {
    const history = await messageStore.list(personaId);
    const last = Number(localStorage.getItem(ORG_KEY(personaId)) || "0");
    if (history.length - last < AUTO_THRESHOLD) return;
    await organizeMemory(personaId, personaName);
  } catch { /* organize is best-effort; never disrupt chat */ }
}
