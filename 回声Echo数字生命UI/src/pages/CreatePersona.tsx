import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Wand2, Camera, Upload } from "lucide-react";
import { personaStore, corpusStore } from "@/lib/localdb";
import { inferenceApi, modelFromSettings } from "@/api/inference";
import { pickAvatar } from "@/lib/avatar";
import { parseChatExport, pickChatFile } from "@/lib/chatImport";
import { useApplySavedTheme } from "@/lib/theme";
import { PERSONA_PRESETS, type PersonaPreset } from "@/lib/presets";
import { isClean } from "@/lib/moderation";
import { useI18n } from "@/lib/i18n";

const GENDER_IDS = ["female", "male", "other"] as const;

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground/80">{value}%</span>
      </div>
      <input type="range" min={0} max={100} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-[var(--accent)]" />
    </div>
  );
}

export default function CreatePersonaPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [gender, setGender] = useState("female");
  const [relationship, setRelationship] = useState("");
  const [impression, setImpression] = useState("");
  const [coreMemory, setCoreMemory] = useState("");
  const [corpus, setCorpus] = useState("");
  const [anger, setAnger] = useState(30);
  const [humor, setHumor] = useState(60);
  const [empathy, setEmpathy] = useState(70);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useApplySavedTheme(true);

  const importChat = async () => {
    const t = await pickChatFile();
    if (!t) return;
    const cleaned = parseChatExport(t);
    if (cleaned) setCorpus((prev) => (prev.trim() ? prev.trimEnd() + "\n" : "") + cleaned);
  };

  const applyPreset = (p: PersonaPreset) => {
    setName(p.name); setGender(p.gender); setRelationship(p.relationship);
    setImpression(p.impression); setCoreMemory(p.coreMemory);
    setAnger(p.anger); setHumor(p.humor); setEmpathy(p.empathy);
    setError("");
  };

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError(t("create.err.name")); return; }
    if (!coreMemory.trim()) { setError(t("create.err.core")); return; }
    if (!isClean(name, impression, relationship, coreMemory, corpus)) {
      setError(t("moderation.blocked")); return;
    }
    setBusy(true);
    try {
      let traitStr = `[核心特质]: ${impression || name} [情绪阈值]: 易怒(${anger}%) 幽默(${humor}%) 共情(${empathy}%)`;
      let core = coreMemory.trim();
      let stability = 85, synchronization = 90;

      // Optional cloud distill to refine the core memory (best-effort, non-blocking)
      try {
        const d = await inferenceApi.distill({
          name: name.trim(), core_memory: core,
          traits_map: { anger, humor, empathy }, model: modelFromSettings(),
        });
        core = d.core_memory || core;
        stability = d.stability ?? stability;
        synchronization = d.synchronization ?? synchronization;
        if (d.refined_traits?.length) traitStr = d.refined_traits[0];
      } catch { /* no key / network → keep raw inputs */ }

      // Persist persona to local IndexedDB (Local-first)
      const p = await personaStore.create({
        name: name.trim(), gender,
        relationship_desc: relationship.trim() || "分身",
        impression: impression.trim(), avatar,
        core_memory: core, traits: [traitStr], catchphrases: [],
        stability, synchronization, happiness: 50, anger: 0, anxiety: 0,
      });

      // Chunk raw corpus into pinned local memories
      if (corpus.trim()) {
        const chunks: string[] = [];
        let cur = "";
        for (const line of corpus.split("\n")) {
          const t = line.trim();
          if (!t) continue;
          if (cur.length + t.length > 500) { chunks.push(cur); cur = t + "\n"; }
          else cur += t + "\n";
        }
        if (cur) chunks.push(cur);
        await corpusStore.bulkAdd(p.id, chunks, true);
      }

      navigate("/", { replace: true });
    } catch (e: any) {
      setError(e?.message || t("create.err.failed"));
    } finally {
      setBusy(false);
    }
  };

  const ambient = "radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%)";
  const field = "w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30";

  return (
    <div className="h-screen w-screen overflow-y-auto text-foreground" style={{ backgroundImage: ambient }}>
      <div className="mx-auto max-w-lg p-5">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="rounded-lg p-1.5 hover:bg-muted/60"><ArrowLeft size={18} /></button>
          <h1 className="flex items-center gap-2 text-base font-semibold"><Wand2 size={16} className="text-accent" /> {t("create.title")}</h1>
        </div>

        <div className="space-y-4 rounded-3xl glass-strong p-6">
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">{t("create.preset")}</p>
            <div className="flex flex-wrap gap-2">
              {PERSONA_PRESETS.map((p) => (
                <button key={p.id} type="button" onClick={() => applyPreset(p)}
                  className="rounded-xl glass px-3 py-1.5 text-xs transition-colors hover:bg-accent/15 active:scale-[0.97]">
                  {p.emoji} {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button type="button" title="设置头像"
              onClick={async () => { const a = await pickAvatar(); if (a) setAvatar(a); }}
              className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <Sparkles size={22} />}
              <span className="absolute inset-0 hidden place-items-center bg-black/40 group-hover:grid"><Camera size={16} className="text-white" /></span>
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("create.name")} className={field} />
          </div>

          <div className="flex gap-2">
            {GENDER_IDS.map((id) => (
              <button key={id} onClick={() => setGender(id)}
                className={`flex-1 rounded-xl py-2 text-sm transition-colors ${gender === id ? "glass-strong bubble-echo-rim" : "glass hover:bg-muted/40"}`}>{t(`create.gender.${id}`)}</button>
            ))}
          </div>

          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder={t("create.relationship")} className={field} />
          <input value={impression} onChange={(e) => setImpression(e.target.value)} placeholder={t("create.impression")} className={field} />
          <textarea value={coreMemory} onChange={(e) => setCoreMemory(e.target.value)} rows={4}
            placeholder={t("create.core")} className={field + " resize-none"} />

          <div className="space-y-3 rounded-2xl glass p-4">
            <p className="text-xs font-medium text-muted-foreground">{t("create.traits")}</p>
            <Slider label={t("create.anger")} value={anger} onChange={setAnger} />
            <Slider label={t("create.humor")} value={humor} onChange={setHumor} />
            <Slider label={t("create.empathy")} value={empathy} onChange={setEmpathy} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">{t("create.corpus.label")}</span>
              <button type="button" onClick={importChat}
                className="flex items-center gap-1 rounded-lg glass px-2.5 py-1 text-xs text-accent transition-colors hover:bg-accent/15">
                <Upload size={13} /> {t("create.corpus.import")}
              </button>
            </div>
            <textarea value={corpus} onChange={(e) => setCorpus(e.target.value)} rows={3}
              placeholder={t("create.corpus.placeholder")} className={field + " resize-none"} />
          </div>

          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <button onClick={submit} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}{busy ? t("create.submitting") : t("create.submit")}
          </button>
        </div>
      </div>
    </div>
  );
}
