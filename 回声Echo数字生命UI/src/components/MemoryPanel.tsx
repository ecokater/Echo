import { useEffect, useState } from "react";
import { Search, Pin, PinOff, Trash2, Plus, ChevronLeft, Brain, Sparkles } from "lucide-react";
import { corpusStore } from "@/lib/localdb";
import { organizeMemory } from "@/lib/janitor";
import { useI18n } from "@/lib/i18n";
import type { LocalCorpus } from "@/types/skill";

/** Local memory (corpus) manager — view / search / pin / delete. All local. */
export default function MemoryPanel({
  personaId, personaName, onClose,
}: { personaId: string | null; personaName?: string; onClose?: () => void }) {
  const { t } = useI18n();
  const [items, setItems] = useState<LocalCorpus[]>([]);
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [organizing, setOrganizing] = useState(false);
  const [note, setNote] = useState("");

  const reload = () => {
    if (!personaId) { setItems([]); return; }
    corpusStore.list(personaId).then(setItems).catch(() => setItems([]));
  };
  useEffect(reload, [personaId]);

  const kw = q.trim().toLowerCase();
  const filtered = kw ? items.filter((i) => i.content.toLowerCase().includes(kw)) : items;
  const pinnedCount = items.filter((i) => i.is_pinned).length;

  const togglePin = async (it: LocalCorpus) => { await corpusStore.setPinned(it.id, !it.is_pinned); reload(); };
  const del = async (it: LocalCorpus) => { if (confirm(t("mem.del.confirm"))) { await corpusStore.remove(it.id); reload(); } };
  const add = async () => {
    const text = draft.trim();
    if (!text || !personaId || busy) return;
    setBusy(true);
    try { await corpusStore.add(personaId, text, true); setDraft(""); reload(); }
    finally { setBusy(false); }
  };
  const organize = async () => {
    if (!personaId || organizing) return;
    setOrganizing(true); setNote("");
    try {
      const summary = await organizeMemory(personaId, personaName || t("side.persona"));
      setNote(summary ? t("mem.note.ok") : t("mem.note.few"));
      reload();
    } catch { setNote(t("mem.note.fail")); }
    finally { setOrganizing(false); setTimeout(() => setNote(""), 2600); }
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-4 py-3">
        {onClose && <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/60"><ChevronLeft size={18} /></button>}
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"><Brain size={16} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t("mem.title")}{personaName ? ` · ${personaName}` : ""}</p>
          <p className="text-[11px] text-muted-foreground">{t("mem.meta", { n: items.length, p: pinnedCount })}</p>
        </div>
        <button onClick={organize} disabled={organizing || !personaId}
          title={t("mem.organize.title")}
          className="flex shrink-0 items-center gap-1 rounded-xl glass px-2.5 py-1.5 text-xs text-accent transition-transform active:scale-95 disabled:opacity-40">
          <Sparkles size={14} /> {organizing ? t("mem.organizing") : t("mem.organize")}
        </button>
      </header>
      {note && <p className="px-4 pb-1 text-[11px] text-accent">{note}</p>}

      <div className="px-4">
        <div className="flex items-center gap-2 rounded-xl glass px-3 py-2">
          <Search size={15} className="text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("mem.search")}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
        </div>
      </div>

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {!personaId && <div className="grid h-full place-items-center text-sm text-muted-foreground">{t("common.pick_persona")}</div>}
        {personaId && filtered.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            {items.length === 0 ? t("mem.empty") : t("mem.nomatch")}
          </div>
        )}
        {filtered.map((it) => (
          <div key={it.id} className={`rounded-2xl p-3.5 ${it.is_pinned ? "glass-strong bubble-echo-rim" : "glass"}`}>
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-sm leading-relaxed">{it.content}</p>
              <div className="flex shrink-0 gap-1">
                <button onClick={() => togglePin(it)} title={it.is_pinned ? t("mem.unpin") : t("mem.pin")}
                  className={`rounded-lg p-1.5 hover:bg-muted/60 ${it.is_pinned ? "text-accent" : "text-muted-foreground"}`}>
                  {it.is_pinned ? <Pin size={15} /> : <PinOff size={15} />}
                </button>
                <button onClick={() => del(it)} title={t("mem.del")} className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/15 hover:text-destructive">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
              {it.is_pinned && <span className="rounded-full bg-accent/15 px-1.5 py-0.5 text-accent">{t("mem.seal")}</span>}
              <span>{new Date(it.timestamp).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </div>
        ))}
      </div>

      {personaId && (
        <div className="px-4 pb-4">
          <div className="flex items-end gap-2 rounded-2xl glass-strong p-2">
            <textarea rows={1} value={draft} onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }}
              placeholder={t("mem.add")} className="max-h-24 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
            <button onClick={add} disabled={busy || !draft.trim()}
              className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
