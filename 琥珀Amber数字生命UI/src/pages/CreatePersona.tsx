import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sparkles, Loader2, Wand2, Camera } from "lucide-react";
import { personaStore, corpusStore } from "@/lib/localdb";
import { inferenceApi, modelFromSettings } from "@/api/inference";
import { pickAvatar } from "@/lib/avatar";
import { useApplySavedTheme } from "@/lib/theme";

const GENDERS = [
  { id: "female", label: "女性" },
  { id: "male", label: "男性" },
  { id: "other", label: "非线性" },
];

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

  const submit = async () => {
    setError("");
    if (!name.trim()) { setError("请填写分身名称"); return; }
    if (!coreMemory.trim()) { setError("请填写核心记忆"); return; }
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
      setError(e?.message || "创建失败，请重试");
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
          <h1 className="flex items-center gap-2 text-base font-semibold"><Wand2 size={16} className="text-accent" /> 蒸馏新的数字生命</h1>
        </div>

        <div className="space-y-4 rounded-3xl glass-strong p-6">
          <div className="flex items-center gap-3">
            <button type="button" title="设置头像"
              onClick={async () => { const a = await pickAvatar(); if (a) setAvatar(a); }}
              className="group relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground">
              {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : <Sparkles size={22} />}
              <span className="absolute inset-0 hidden place-items-center bg-black/40 group-hover:grid"><Camera size={16} className="text-white" /></span>
            </button>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="分身名称" className={field} />
          </div>

          <div className="flex gap-2">
            {GENDERS.map((g) => (
              <button key={g.id} onClick={() => setGender(g.id)}
                className={`flex-1 rounded-xl py-2 text-sm transition-colors ${gender === g.id ? "glass-strong bubble-amber-rim" : "glass hover:bg-muted/40"}`}>{g.label}</button>
            ))}
          </div>

          <input value={relationship} onChange={(e) => setRelationship(e.target.value)} placeholder="与你的关系（如：恋人 / 挚友 / 助手）" className={field} />
          <input value={impression} onChange={(e) => setImpression(e.target.value)} placeholder="第一印象 / 核心特质一句话" className={field} />
          <textarea value={coreMemory} onChange={(e) => setCoreMemory(e.target.value)} rows={4}
            placeholder="核心记忆：描述这个数字生命的身份、经历、与你的羁绊…" className={field + " resize-none"} />

          <div className="space-y-3 rounded-2xl glass p-4">
            <p className="text-xs font-medium text-muted-foreground">性格阈值</p>
            <Slider label="易怒" value={anger} onChange={setAnger} />
            <Slider label="幽默" value={humor} onChange={setHumor} />
            <Slider label="共情" value={empathy} onChange={setEmpathy} />
          </div>

          <textarea value={corpus} onChange={(e) => setCorpus(e.target.value)} rows={3}
            placeholder="（可选）原始语料：粘贴对话记录 / 人设文本，作为出厂记忆固化" className={field + " resize-none"} />

          {error && <p className="text-center text-xs text-destructive">{error}</p>}

          <button onClick={submit} disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
            {busy && <Loader2 size={16} className="animate-spin" />}{busy ? "结晶中…" : "固化并唤醒"}
          </button>
        </div>
      </div>
    </div>
  );
}
