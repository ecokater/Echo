import { useEffect, useState } from "react";
import { Search, Compass, Download, Share2, Trash2, ChevronLeft, Check, Flame, Clock } from "lucide-react";
import { exploreApi, detailToLocalPersona, type SharedPersonaCard } from "@/api/explore";
import { personaStore } from "@/lib/localdb";
import { colorFromName } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n";
import type { LocalPersona } from "@/types/skill";

function Avatar({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) {
  return (
    <div className="shrink-0 overflow-hidden rounded-full grid place-items-center text-white font-medium"
      style={{ width: size, height: size, background: avatar ? undefined : colorFromName(name || "?"), fontSize: size * 0.42 }}>
      {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : (name || "?").slice(0, 1)}
    </div>
  );
}

/** Explore marketplace: browse / search / install shared personas + publish own. */
export default function ExplorePanel({
  personas, onInstalled, onClose,
}: { personas: LocalPersona[]; onInstalled?: () => void; onClose?: () => void }) {
  const { t } = useI18n();
  const [view, setView] = useState<"plaza" | "mine">("plaza");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"hot" | "new">("hot");
  const [list, setList] = useState<SharedPersonaCard[]>([]);
  const [mine, setMine] = useState<SharedPersonaCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [publishId, setPublishId] = useState("");

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 1800); };

  const loadPlaza = () => {
    setLoading(true);
    exploreApi.list({ q: q.trim() || undefined, sort }).then(setList).catch(() => setList([])).finally(() => setLoading(false));
  };
  const loadMine = () => { exploreApi.mine().then(setMine).catch(() => setMine([])); };

  useEffect(() => { if (view === "plaza") loadPlaza(); else loadMine(); /* eslint-disable-next-line */ }, [view, sort]);

  const install = async (id: string) => {
    setBusyId(id);
    try {
      const detail = await exploreApi.install(id);
      await personaStore.create(detailToLocalPersona(detail));
      flash(t("exp.installed", { name: detail.name }));
      onInstalled?.();
    } catch { flash(t("exp.install_fail")); }
    finally { setBusyId(null); }
  };

  const publish = async () => {
    const p = personas.find((x) => x.id === publishId);
    if (!p) return;
    setBusyId("publish");
    try {
      await exploreApi.publish({
        name: p.name, gender: p.gender, relationship_desc: p.relationship_desc,
        impression: p.impression, avatar: p.avatar, core_memory: p.core_memory,
        traits: JSON.stringify(p.traits || []), catchphrases: JSON.stringify(p.catchphrases || []),
      });
      flash(t("exp.published", { name: p.name }));
      setPublishId("");
      if (view === "mine") loadMine();
    } catch { flash(t("exp.publish_fail")); }
    finally { setBusyId(null); }
  };

  const unpublish = async (id: string) => {
    if (!confirm(t("exp.unpublish_confirm"))) return;
    setBusyId(id);
    try { await exploreApi.unpublish(id); loadMine(); flash(t("exp.unpublished")); }
    catch { flash(t("exp.unpublish_fail")); }
    finally { setBusyId(null); }
  };

  const Card = ({ c, owned }: { c: SharedPersonaCard; owned?: boolean }) => (
    <div className="rounded-2xl glass p-3.5">
      <div className="flex items-center gap-2.5">
        <Avatar name={c.name} avatar={c.avatar} size={40} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{c.name}</p>
          <p className="truncate text-[11px] text-muted-foreground">{c.owner_nickname || t("exp.anon")} · {t("exp.installs", { n: c.install_count })}</p>
        </div>
        {owned ? (
          <button onClick={() => unpublish(c.id)} disabled={busyId === c.id}
            className="flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-destructive/15 hover:text-destructive disabled:opacity-40">
            <Trash2 size={14} /> {t("exp.unpublish")}
          </button>
        ) : (
          <button onClick={() => install(c.id)} disabled={busyId === c.id}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-transform hover:scale-[1.03] active:scale-95 disabled:opacity-40">
            <Download size={14} /> {busyId === c.id ? t("exp.getting") : t("exp.get")}
          </button>
        )}
      </div>
      {c.impression && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.impression}</p>}
      {c.tags && <p className="mt-1.5 text-[10px] text-accent">{c.tags.split(",").map((t) => `#${t.trim()}`).join(" ")}</p>}
    </div>
  );

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-4 py-3">
        {onClose && <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/60"><ChevronLeft size={18} /></button>}
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent/15 text-accent"><Compass size={16} /></span>
        <p className="flex-1 text-sm font-semibold">{t("exp.title")}</p>
        <div className="flex rounded-xl glass p-0.5 text-xs">
          <button onClick={() => setView("plaza")} className={`rounded-lg px-3 py-1 ${view === "plaza" ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}>{t("exp.plaza")}</button>
          <button onClick={() => setView("mine")} className={`rounded-lg px-3 py-1 ${view === "mine" ? "bg-accent/15 text-accent" : "text-muted-foreground"}`}>{t("exp.mine")}</button>
        </div>
      </header>

      {view === "plaza" && (
        <div className="flex items-center gap-2 px-4">
          <div className="flex flex-1 items-center gap-2 rounded-xl glass px-3 py-2">
            <Search size={15} className="text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && loadPlaza()}
              placeholder={t("exp.search")} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </div>
          <button onClick={() => setSort((s) => (s === "hot" ? "new" : "hot"))} title={t("exp.sort")}
            className="flex items-center gap-1 rounded-xl glass px-2.5 py-2 text-xs text-muted-foreground">
            {sort === "hot" ? <><Flame size={14} className="text-accent" /> {t("exp.hot")}</> : <><Clock size={14} className="text-accent" /> {t("exp.new")}</>}
          </button>
        </div>
      )}

      {view === "mine" && (
        <div className="flex items-center gap-2 px-4">
          <select value={publishId} onChange={(e) => setPublishId(e.target.value)}
            className="flex-1 rounded-xl glass px-3 py-2 text-sm outline-none">
            <option value="">{t("exp.select")}</option>
            {personas.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <button onClick={publish} disabled={!publishId || busyId === "publish"}
            className="flex items-center gap-1 rounded-xl bg-primary px-3 py-2 text-xs font-medium text-primary-foreground transition-transform active:scale-95 disabled:opacity-40">
            <Share2 size={14} /> {t("exp.publish")}
          </button>
        </div>
      )}

      <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
        {loading && <div className="grid h-full place-items-center text-sm text-muted-foreground">{t("common.loading")}</div>}
        {!loading && view === "plaza" && list.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">{t("exp.empty_plaza")}</div>
        )}
        {!loading && view === "plaza" && list.map((c) => <Card key={c.id} c={c} />)}
        {view === "mine" && mine.length === 0 && (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">{t("exp.empty_mine")}</div>
        )}
        {view === "mine" && mine.map((c) => <Card key={c.id} c={c} owned />)}
      </div>

      {toast && (
        <div className="pointer-events-none absolute inset-x-0 bottom-20 z-50 mx-auto flex w-fit items-center gap-1.5 rounded-full glass-strong px-4 py-2 text-xs shadow-lg">
          <Check size={14} className="text-accent" /> {toast}
        </div>
      )}
    </div>
  );
}
