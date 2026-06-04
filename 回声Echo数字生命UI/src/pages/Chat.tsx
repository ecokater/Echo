import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  Sun, Moon, Plus, Send, Image as ImageIcon, Scissors, Sparkles, Brain,
  Settings, Search, Menu, MessageCircle, Compass, User as UserIcon,
  Heart, Activity, Gauge, ChevronRight, X, Gem, Zap, PanelRightClose,
  PanelRightOpen, Cpu, LogOut, Wallet, ReceiptText, Info,
  ShieldCheck, History, Headphones, FileText, Ticket,
} from "lucide-react";
import { getBalance, getLedger, type LedgerEntry } from "@/api/wallet";
import { listOrders, type BillingOrder } from "@/api/billing";
import { getUsageEvents, type UsageEvent } from "@/api/system";
import { redeemCode, type RedeemResult } from "@/api/redeem";
import { personaStore, messageStore, corpusStore } from "@/lib/localdb";
import { inferenceApi, modelFromSettings } from "@/api/inference";
import { buildContext } from "@/lib/localRag";
import { annealAll, maybeAutoOrganize } from "@/lib/janitor";
import { isClean } from "@/lib/moderation";
import { useI18n } from "@/lib/i18n";

type TFn = (key: string, vars?: Record<string, string | number>) => string;
import type { LocalPersona, LocalMessage } from "@/types/skill";
import { useAuthStore } from "@/stores/auth";
import { colorFromName } from "@/lib/avatar";
import SettingsModal from "@/components/SettingsModal";
import MemoryPanel from "@/components/MemoryPanel";
import ExplorePanel from "@/components/ExplorePanel";
import ChatImportModal from "@/components/ChatImportModal";
import { useThemePreference } from "@/lib/theme";

/** Circular persona avatar: image if set, else initial on a name-derived color. */
function PersonaAvatar({ name, avatar, size = 40 }: { name: string; avatar?: string | null; size?: number }) {
  return (
    <div
      className="shrink-0 overflow-hidden rounded-full grid place-items-center text-white font-medium"
      style={{ width: size, height: size, background: avatar ? undefined : colorFromName(name || "?"), fontSize: size * 0.42 }}
    >
      {avatar ? <img src={avatar} alt={name} className="h-full w-full object-cover" /> : (name || "?").slice(0, 1)}
    </div>
  );
}

type Msg = { id: string; role: "user" | "echo"; text: string; time: string; kind?: "normal" | "checkin" | "outburst" };

function toMsg(m: LocalMessage): Msg {
  return {
    id: m.id,
    role: m.role === "user" ? "user" : "echo",
    text: m.content,
    time: new Date(m.timestamp).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }),
    kind: "normal",
  };
}

function FragmentBadge({ value }: { value: number }) {
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const step = value > display ? Math.ceil((value - display) / 8) : Math.floor((value - display) / 8);
    const t = setTimeout(() => setDisplay((d) => (Math.abs(value - d) <= Math.abs(step) ? value : d + step)), 28);
    return () => clearTimeout(t);
  }, [value, display]);
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 fragment-glow animate-fragment-pulse" title="记忆碎片余额">
      <Gem size={13} className="shrink-0" />
      <span className="font-mono text-xs font-semibold tabular-nums">{display.toLocaleString()}</span>
    </div>
  );
}

function Bubble({ m }: { m: Msg }) {
  const isUser = m.role === "user";
  const special = m.kind === "checkin" || m.kind === "outburst";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"} gap-2.5`}>
      {!isUser && (
        <div className="mt-1 h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-accent to-primary grid place-items-center text-primary-foreground shadow-sm">
          <Sparkles size={15} />
        </div>
      )}
      <div className="max-w-[78%] space-y-1">
        {special && (
          <span className="flex items-center gap-1 text-[10px] font-medium text-accent">
            {m.kind === "outburst" ? <Heart size={10} /> : <Activity size={10} />}
            {m.kind === "outburst" ? "情绪共鸣" : "主动查岗"}
          </span>
        )}
        <div className={["rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser ? "bg-primary text-primary-foreground rounded-br-md shadow-sm"
            : special ? "glass-strong bubble-echo-rim rounded-bl-md" : "glass rounded-bl-md"].join(" ")}>
          {m.text}
        </div>
        <span className={`block text-[10px] text-muted-foreground ${isUser ? "text-right" : ""}`}>{m.time}</span>
      </div>
    </div>
  );
}

function EmotionMeter({ label, value, hue }: { label: string; value: number; hue: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono text-foreground/80">{Math.round(value)}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${value}%`, background: hue }} />
      </div>
    </div>
  );
}

function PlusMenu({ open, onClose, onImport }: { open: boolean; onClose: () => void; onImport: () => void }) {
  const items = [
    { icon: FileText, label: "导入聊天记录", action: onImport },
    { icon: ImageIcon, label: "发送图片" }, { icon: Scissors, label: "记忆截断" },
    { icon: Brain, label: "唤起记忆节点" }, { icon: Zap, label: "情绪快照" },
  ];
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={onClose}
          />
          <motion.div
            className="absolute bottom-14 left-0 z-40 w-44 rounded-2xl glass-strong p-1.5 shadow-lg"
            initial={{ opacity: 0, y: 14, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 520, damping: 36, mass: 0.75 }}
          >
            {items.map((it, index) => (
              <motion.button
                key={it.label}
                onClick={() => { it.action?.(); onClose(); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/90 hover:bg-accent/15 transition-colors"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.025, duration: 0.16 }}
              >
                <it.icon size={16} className="text-accent" /> {it.label}
              </motion.button>
            ))}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function FragmentModal({ open, onClose, onRecharge }: { open: boolean; onClose: () => void; onRecharge: () => void }) {
  const { t } = useI18n();
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center p-6"
          style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            className="w-full max-w-sm rounded-3xl glass-strong p-7 text-center shadow-2xl"
            initial={{ opacity: 0, y: 34, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 430, damping: 34, mass: 0.82 }}
          >
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl fragment-glow"><Gem size={26} /></div>
            <h3 className="text-lg font-semibold">{t("chat.frag.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t("chat.frag.desc")}</p>
            <button onClick={onRecharge}
              className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98]">{t("chat.frag.recharge")}</button>
            <button onClick={onClose} className="mt-2 w-full rounded-2xl py-2.5 text-sm text-muted-foreground hover:bg-muted/60 transition-colors">{t("chat.frag.later")}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

type MePanel = "overview" | "redeem" | "usage" | "orders" | "help" | "about";

function formatDate(value?: string | null) {
  if (!value) return "未记录";
  return new Date(value).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function usageLabel(t: TFn, type: string) {
  if (type.includes("distill")) return t("usage.distill");
  if (type.includes("memory")) return t("usage.memory");
  if (type.includes("chat")) return t("usage.chat");
  return t("usage.default");
}

// status.* / ledger.* fall back to the raw token when no translation exists.
function statusLabel(t: TFn, status: string) {
  const v = t(`status.${status}`);
  return v === `status.${status}` ? status : v;
}

function ledgerLabel(t: TFn, type: string) {
  const v = t(`ledger.${type}`);
  return v === `ledger.${type}` ? type : v;
}

function errorMessage(t: TFn, err: unknown) {
  const maybe = err as { response?: { data?: { detail?: string }; status?: number } };
  const detail = maybe.response?.data?.detail;
  if (detail) return detail;
  if (maybe.response?.status === 401) return t("redeem.err.login");
  if (maybe.response?.status === 409) return t("redeem.err.used");
  if (maybe.response?.status === 404) return t("redeem.err.notfound");
  return t("redeem.err.generic");
}

export default function ChatPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const logoutFn = useAuthStore((s) => s.logout);
  const [dark, setDark] = useThemePreference(true);
  const [mobile, setMobile] = useState(false);
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [plus, setPlus] = useState(false);
  const [fragModal, setFragModal] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [exploreOpen, setExploreOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [tab, setTab] = useState("chat");
  const [mePanel, setMePanel] = useState<MePanel>("overview");
  const [fragments, setFragments] = useState(0);
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [usageEvents, setUsageEvents] = useState<UsageEvent[]>([]);
  const [orders, setOrders] = useState<BillingOrder[]>([]);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemResult, setRedeemResult] = useState<RedeemResult | null>(null);
  const [redeemError, setRedeemError] = useState("");
  const [input, setInput] = useState("");
  const [sendError, setSendError] = useState("");
  const [sending, setSending] = useState(false);
  const [personas, setPersonas] = useState<LocalPersona[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const meScrollRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 767px)");
    const syncMobile = () => setMobile(query.matches);
    syncMobile();
    query.addEventListener("change", syncMobile);
    return () => query.removeEventListener("change", syncMobile);
  }, []);

  const refreshBalance = () => getBalance().then((b) => setFragments(b.balance)).catch(() => {});

  const reloadPersonas = () =>
    personaStore.list().then((ps) => {
      setPersonas(ps);
      setActiveId((cur) => cur ?? ps[0]?.id ?? null);
    }).catch(() => {});

  // Personas now live in local IndexedDB (Local-first). Balance still from server.
  useEffect(() => {
    refreshBalance();
    reloadPersonas();
  }, []);

  // Chat history from local store. No WebSocket: replies are synchronous via inference proxy.
  useEffect(() => {
    if (!activeId) { setMessages([]); return; }
    messageStore.list(activeId).then((h) => setMessages(h.map(toMsg))).catch(() => {});
  }, [activeId]);

  // Local Janitor: emotion annealing toward baseline over idle time (free, local).
  useEffect(() => {
    let alive = true;
    const run = () => annealAll().then((changed) => { if (changed && alive) reloadPersonas(); }).catch(() => {});
    run();
    const t = setInterval(run, 5 * 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages]);

  useEffect(() => {
    if (tab !== "me") return;
    refreshBalance();
    getLedger(20).then(setLedger).catch(() => setLedger([]));
    getUsageEvents(20).then(setUsageEvents).catch(() => setUsageEvents([]));
    listOrders(20).then(setOrders).catch(() => setOrders([]));
  }, [tab]);

  useEffect(() => {
    meScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [mePanel]);

  const active = personas.find((p) => p.id === activeId) ?? null;
  const userAvatar = typeof window !== "undefined" ? window.localStorage.getItem("echo_user_avatar") : null;
  const totalUsageCost = usageEvents.reduce((sum, e) => sum + e.cost_fragments - e.refunded_fragments, 0);
  const rechargeCount = orders.filter((o) => o.status === "paid").length;

  const handleRedeem = async () => {
    const code = redeemInput.trim();
    if (!code || redeemLoading) return;
    setRedeemLoading(true);
    setRedeemError("");
    setRedeemResult(null);
    try {
      const result = await redeemCode(code);
      setRedeemResult(result);
      setRedeemInput("");
      setFragments(result.balance);
      getLedger(20).then(setLedger).catch(() => {});
    } catch (err) {
      setRedeemError(errorMessage(t, err));
    } finally {
      setRedeemLoading(false);
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || !activeId || sending || !active) return;
    if (!isClean(text)) { setSendError("内容包含敏感词，请修改后再试"); return; }
    setSendError("");
    setInput("");
    setSending(true);
    // 1. persist + render user message locally
    const userMsg = await messageStore.add(activeId, "user", text);
    setMessages((prev) => [...prev, toMsg(userMsg)]);
    try {
      // 2. assemble ephemeral context locally (recent messages + RAG memories)
      const context = await buildContext(activeId, text);
      // 3. stateless cloud inference
      const res = await inferenceApi.chat({
        persona: {
          id: active.id, name: active.name, traits: active.traits,
          core_memory: active.core_memory,
          mood: { happiness: active.happiness, anger: active.anger, anxiety: active.anxiety },
        },
        context,
        input: { content: text },
        model: modelFromSettings(),
      });
      // 4. persist assistant reply locally
      const aiMsg = await messageStore.add(activeId, "assistant", res.reply);
      setMessages((prev) => [...prev, toMsg(aiMsg)]);
      // 5. apply mood delta to local persona
      const d = res.mood_delta;
      const updated = await personaStore.update(activeId, {
        happiness: Math.max(0, Math.min(100, active.happiness + d.happiness)),
        anger: Math.max(0, Math.min(100, active.anger + d.anger)),
        anxiety: Math.max(0, Math.min(100, active.anxiety + d.anxiety)),
      });
      if (updated) setPersonas((prev) => prev.map((p) => (p.id === activeId ? updated : p)));
      // 6. persist memory candidates (e.g. 钢印记忆) locally
      if (res.memory_candidates?.length) await corpusStore.bulkAdd(activeId, res.memory_candidates, true);
      refreshBalance();
      // 7. background memory crystallization (throttled, never blocks chat)
      void maybeAutoOrganize(activeId, active.name);
    } catch (e: any) {
      if (e?.response?.status === 402) setFragModal(true);
      else setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "echo", text: t("chat.err.network"), time: "" }]);
    } finally {
      setSending(false);
    }
  };

  const ambient = "radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%), radial-gradient(900px 500px at 100% 110%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 55%)";

  const LeftNav = (
    <aside className="flex h-full w-[280px] shrink-0 flex-col gap-3 p-3">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground shadow-sm"><Sparkles size={18} /></div>
        <div><p className="text-sm font-semibold leading-none">回声 Echo</p><p className="mt-0.5 text-[10px] text-muted-foreground">{t("side.online")}</p></div>
      </div>
      <div className="flex items-center gap-2 rounded-xl glass px-3 py-2">
        <Search size={15} className="text-muted-foreground" />
        <input placeholder={t("side.search")} className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        <div className="flex items-center justify-between px-2 pb-1 pt-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{t("side.mine")}</p>
          <button onClick={() => navigate("/create")} title={t("create.title")}
            className="flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] text-accent hover:bg-accent/15 transition-colors">
            <Plus size={12} /> {t("side.distill")}
          </button>
        </div>
        {personas.length === 0 && (
          <button onClick={() => navigate("/create")}
            className="mx-1 my-1 w-[calc(100%-0.5rem)] rounded-xl border border-dashed border-border/60 px-3 py-3 text-xs text-muted-foreground hover:border-accent/50 hover:text-accent transition-colors">
            {t("side.empty")}
          </button>
        )}
        {personas.map((p) => (
          <button key={p.id} onClick={() => { setActiveId(p.id); setDrawer(false); }}
            className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors ${activeId === p.id ? "glass" : "hover:bg-muted/50"}`}>
            <PersonaAvatar name={p.name} avatar={p.avatar} size={36} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="truncate text-sm font-medium">{p.name}</span>
                <span className="ml-2 shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">{p.relationship_desc || t("side.persona")}</span>
              </div>
              <span className="block truncate text-xs text-muted-foreground">{p.impression || t("side.ready")}</span>
            </div>
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <button onClick={() => setExploreOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl glass px-3 py-2.5 text-sm transition-transform hover:scale-[1.02]">
          <Compass size={16} className="text-accent" /> {t("nav.explore")}
        </button>
        <button onClick={() => setMemoryOpen(true)}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl glass px-3 py-2.5 text-sm transition-transform hover:scale-[1.02]">
          <Brain size={16} className="text-accent" /> {t("nav.memory")}
        </button>
      </div>
      <button onClick={() => navigate("/recharge")}
        className="flex items-center gap-2.5 rounded-xl glass px-3 py-2.5 text-sm transition-transform hover:scale-[1.01]">
        <Gem size={16} className="text-fragment" /><span className="flex-1 text-left">{t("side.recharge")}</span>
        <span className="font-mono text-xs text-fragment">{fragments}</span>
      </button>
      <button onClick={async () => { const { clearAllLocal } = await import("@/lib/localdb"); await clearAllLocal(); logoutFn(); navigate("/login"); }}
        className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
        <LogOut size={16} /> {t("side.logout")}
      </button>
    </aside>
  );

  const Console = (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={15} className="text-accent" /> {t("console.title")}</h3>
      </div>
      <div className="rounded-2xl glass p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">{t("console.mood")}</p>
        <div className="mb-4 flex items-center gap-3">
          {active ? <PersonaAvatar name={active.name} avatar={active.avatar} size={48} />
            : <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground bubble-echo-rim"><Heart size={20} /></div>}
          <div><p className="text-sm font-semibold">{active?.name ?? t("console.unselected")} · {t("console.attach")}</p><p className="text-[11px] text-muted-foreground">{t("console.dominant")}</p></div>
        </div>
        <div className="space-y-3">
          <EmotionMeter label={t("console.happiness")} value={active?.happiness ?? 50} hue="linear-gradient(90deg,var(--accent),var(--primary))" />
          <EmotionMeter label={t("console.intimacy")} value={active?.intimacy ?? 50} hue="linear-gradient(90deg,var(--chart-2),var(--accent))" />
          <EmotionMeter label={t("console.curiosity")} value={active?.curiosity ?? 50} hue="linear-gradient(90deg,var(--chart-3),var(--primary))" />
        </div>
      </div>
      <div className="rounded-2xl glass p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Gauge size={13} /> {t("console.tune")}</p>
        {[[t("console.temp"), active?.response_temp ?? 70], [t("console.proactivity"), active?.proactivity ?? 55], [t("console.depth"), active?.memory_depth ?? 88]].map(([l, v]) => (
          <div key={l as string} className="mb-3 last:mb-0">
            <div className="mb-1 flex justify-between text-xs"><span>{l}</span><span className="font-mono text-muted-foreground">{Math.round(v as number)}</span></div>
            <input type="range" defaultValue={v as number} className="w-full accent-[var(--accent)]" />
          </div>
        ))}
      </div>
    </aside>
  );

  const TopNav = (
    <header className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {mobile && <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 hover:bg-muted/60"><Menu size={18} /></button>}
        <div><p className="text-sm font-semibold">回声 Echo</p><p className="text-[11px] text-accent">● {t("chat.subtitle")}</p></div>
      </div>
      <div className="flex items-center gap-2">
        <FragmentBadge value={fragments} />
        <button onClick={() => setDark((d) => !d)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="明暗切换">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
        <button onClick={() => setSettingsOpen(true)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="模型设置"><Settings size={16} /></button>
        {!mobile && <button onClick={() => setConsoleOpen((c) => !c)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="控制台">{consoleOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}</button>}
      </div>
    </header>
  );

  const ChatArea = (
    <div className="flex h-full flex-1 flex-col">
      {TopNav}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 md:px-8">
        {messages.length === 0 && <div className="grid h-full place-items-center text-sm text-muted-foreground">{t("chat.empty", { name: active?.name ?? "回声" })}</div>}
        {messages.map((m) => <Bubble key={m.id} m={m} />)}
        {sending && <div className="text-xs text-muted-foreground pl-11">{t("chat.thinking", { name: active?.name ?? "回声" })}</div>}
      </div>
      <div className="px-4 pb-4 md:px-8">
        {sendError && <p className="mb-2 px-1 text-xs text-destructive">{sendError}</p>}
        <div className="relative flex items-end gap-2 rounded-2xl glass-strong p-2">
          <div className="relative">
            <button onClick={() => setPlus((p) => !p)} className="grid h-9 w-9 place-items-center rounded-xl text-accent hover:bg-accent/15 transition-colors">
              <Plus size={20} className={plus ? "rotate-45 transition-transform" : "transition-transform"} />
            </button>
            <PlusMenu open={plus} onClose={() => setPlus(false)} onImport={() => setImportOpen(true)} />
          </div>
          <textarea rows={1} value={input} onChange={(e) => { setInput(e.target.value); if (sendError) setSendError(""); }}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            placeholder={t("chat.input", { name: active?.name ?? "回声" })} className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
          <button onClick={handleSend} disabled={sending || !input.trim()}
            className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95 disabled:opacity-40">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  const MeRow = ({ icon: Icon, title, desc, value, onClick }: {
    icon: typeof UserIcon;
    title: string;
    desc: string;
    value?: string;
    onClick: () => void;
  }) => (
    <button onClick={onClick} className="flex w-full items-center gap-3 rounded-2xl glass px-4 py-3 text-left transition-transform active:scale-[0.99]">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent"><Icon size={19} /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{title}</span>
        <span className="block truncate text-xs text-muted-foreground">{desc}</span>
      </span>
      {value && <span className="shrink-0 rounded-full bg-muted px-2 py-1 text-[10px] text-muted-foreground">{value}</span>}
      <ChevronRight size={16} className="shrink-0 text-muted-foreground" />
    </button>
  );

  const MeOverview = (
    <div className="space-y-4">
      <section className="rounded-3xl glass-strong p-5">
        <div className="flex items-center gap-3">
          {userAvatar ? (
            <img src={userAvatar} alt="" className="h-14 w-14 shrink-0 rounded-full object-cover" />
          ) : (
            <div className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-gradient-to-br from-fragment to-accent text-lg font-semibold text-fragment-foreground">
              {(user?.nickname || user?.phone || "A").slice(0, 1)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{user?.nickname || t("me.guest")}</p>
            <p className="truncate text-xs text-muted-foreground">{user?.phone || user?.email || t("me.account")}</p>
          </div>
          <button onClick={() => setSettingsOpen(true)} className="rounded-xl p-2 hover:bg-muted/60" title="设置"><Settings size={18} /></button>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] text-muted-foreground">{t("me.stat.balance")}</p>
            <p className="mt-1 font-mono text-sm font-semibold">{fragments.toLocaleString()}</p>
          </div>
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] text-muted-foreground">{t("me.stat.personas")}</p>
            <p className="mt-1 font-mono text-sm font-semibold">{personas.length}</p>
          </div>
          <div className="rounded-2xl glass p-3">
            <p className="text-[10px] text-muted-foreground">{t("me.stat.orders")}</p>
            <p className="mt-1 font-mono text-sm font-semibold">{rechargeCount}</p>
          </div>
        </div>
      </section>

      <button onClick={() => navigate("/recharge")} className="flex w-full items-center gap-3 rounded-3xl fragment-glow px-5 py-4 text-left transition-transform active:scale-[0.99]">
        <Wallet size={22} />
        <span className="flex-1">
          <span className="block text-sm font-semibold">{t("me.recharge.title")}</span>
          <span className="block text-xs opacity-80">{t("me.recharge.desc")}</span>
        </span>
        <ChevronRight size={18} />
      </button>

      <section className="space-y-2">
        <MeRow icon={Ticket} title={t("me.row.redeem")} desc={t("me.row.redeem.desc")} onClick={() => setMePanel("redeem")} />
        <MeRow icon={History} title={t("me.row.usage")} desc={t("me.row.usage.desc")} value={`${usageEvents.length} ${t("me.unit.count")}`} onClick={() => setMePanel("usage")} />
        <MeRow icon={ReceiptText} title={t("me.row.orders")} desc={t("me.row.orders.desc")} value={`${orders.length} ${t("me.unit.order")}`} onClick={() => setMePanel("orders")} />
        <MeRow icon={Headphones} title={t("me.row.help")} desc={t("me.row.help.desc")} onClick={() => setMePanel("help")} />
        <MeRow icon={Info} title={t("me.row.about")} desc={t("me.row.about.desc")} onClick={() => setMePanel("about")} />
      </section>

      <section className="rounded-3xl glass-strong p-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold">{t("me.ledger.title")}</p>
          <span className="text-[10px] text-muted-foreground">{ledger.length} {t("me.unit.count")}</span>
        </div>
        {ledger.length === 0 ? (
          <p className="py-3 text-center text-xs text-muted-foreground">{t("me.ledger.empty")}</p>
        ) : ledger.slice(0, 3).map((entry) => (
          <div key={entry.id} className="flex items-center justify-between border-t border-border/40 py-2 first:border-t-0">
            <div>
              <p className="text-xs font-medium">{ledgerLabel(t, entry.type)}</p>
              <p className="text-[10px] text-muted-foreground">{formatDate(entry.created_at)}</p>
            </div>
            <span className={`font-mono text-xs font-semibold ${entry.delta >= 0 ? "text-accent" : "text-foreground"}`}>
              {entry.delta >= 0 ? "+" : ""}{entry.delta}
            </span>
          </div>
        ))}
      </section>
    </div>
  );

  const RedeemPanel = (
    <div className="space-y-4">
      <section className="rounded-3xl fragment-glow px-5 py-5">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-background/20"><Ticket size={22} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold">{t("redeem.title")}</p>
            <p className="mt-1 text-xs leading-relaxed opacity-80">{t("redeem.desc")}</p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl glass-strong p-4">
        <label className="text-xs font-medium text-muted-foreground">{t("redeem.label")}</label>
        <input
          value={redeemInput}
          onChange={(e) => {
            setRedeemInput(e.target.value.toUpperCase());
            if (redeemError) setRedeemError("");
          }}
          onKeyDown={(e) => { if (e.key === "Enter") handleRedeem(); }}
          placeholder={t("redeem.placeholder")}
          className="mt-2 w-full rounded-2xl border border-border/70 bg-background/70 px-4 py-3 font-mono text-sm outline-none transition-colors focus:border-accent"
          autoCapitalize="characters"
          autoCorrect="off"
        />
        {redeemError && <p className="mt-3 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive">{redeemError}</p>}
        {redeemResult && (
          <div className="mt-3 rounded-2xl bg-accent/10 px-3 py-3 text-sm text-accent">
            <p className="font-semibold">{t("redeem.ok", { n: redeemResult.fragments.toLocaleString() })}</p>
            <p className="mt-1 text-xs opacity-80">{t("redeem.balance", { n: redeemResult.balance.toLocaleString() })} · {formatDate(redeemResult.redeemed_at)}</p>
          </div>
        )}
        <button
          onClick={handleRedeem}
          disabled={!redeemInput.trim() || redeemLoading}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {redeemLoading ? t("redeem.submitting") : t("redeem.submit")}
        </button>
      </section>

      <section className="rounded-3xl glass p-4">
        <p className="text-sm font-medium">{t("redeem.note.title")}</p>
        <div className="mt-3 space-y-2 text-xs leading-relaxed text-muted-foreground">
          <p>{t("redeem.note1")}</p>
          <p>{t("redeem.note2")}</p>
          <p>{t("redeem.note3")}</p>
        </div>
      </section>
    </div>
  );

  const UsagePanel = (
    <div className="space-y-3">
      <div className="rounded-3xl glass-strong p-4">
        <p className="text-xs text-muted-foreground">{t("usage.net")}</p>
        <p className="mt-1 font-mono text-2xl font-semibold">{totalUsageCost.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{t("usage.unit")}</span></p>
      </div>
      {usageEvents.length === 0 ? (
        <div className="rounded-2xl glass p-5 text-center text-sm text-muted-foreground">{t("usage.empty")}</div>
      ) : usageEvents.map((event) => (
        <div key={event.id} className="rounded-2xl glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{usageLabel(t, event.event_type)}</p>
              <p className="mt-1 text-xs text-muted-foreground">{event.model_id || t("usage.default_model")} · {formatDate(event.created_at)}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] ${event.status === "success" ? "bg-accent/15 text-accent" : "bg-destructive/15 text-destructive"}`}>
              {statusLabel(t, event.status)}
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
            <span className="rounded-xl bg-muted/60 px-2 py-1">{t("usage.cost", { n: event.cost_fragments })}</span>
            <span className="rounded-xl bg-muted/60 px-2 py-1">{t("usage.refund", { n: event.refunded_fragments })}</span>
            <span className="rounded-xl bg-muted/60 px-2 py-1">{event.latency_ms}ms</span>
          </div>
          {event.error_code && <p className="mt-2 text-xs text-destructive">{event.error_code}</p>}
        </div>
      ))}
    </div>
  );

  const OrdersPanel = (
    <div className="space-y-3">
      {orders.length === 0 ? (
        <div className="rounded-2xl glass p-5 text-center text-sm text-muted-foreground">{t("orders.empty")}</div>
      ) : orders.map((order) => (
        <div key={order.order_id} className="rounded-2xl glass p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium">{t("orders.frag", { n: order.fragments.toLocaleString() })}</p>
              <p className="mt-1 text-xs text-muted-foreground">{order.amount_display} · {order.channel}</p>
            </div>
            <span className={`rounded-full px-2 py-1 text-[10px] ${order.status === "paid" ? "bg-accent/15 text-accent" : "bg-muted text-muted-foreground"}`}>
              {statusLabel(t, order.status)}
            </span>
          </div>
          <p className="mt-3 truncate font-mono text-[10px] text-muted-foreground">{order.out_trade_no}</p>
          <p className="mt-1 text-[10px] text-muted-foreground">{t("orders.created", { t: formatDate(order.created_at) })} · {t("orders.paid", { t: formatDate(order.paid_at) })}</p>
        </div>
      ))}
    </div>
  );

  const HelpPanel = (
    <div className="space-y-3">
      {[
        [t("help.q1"), t("help.a1")],
        [t("help.q2"), t("help.a2")],
        [t("help.q3"), t("help.a3")],
      ].map(([title, desc]) => (
        <div key={title} className="rounded-2xl glass p-4">
          <p className="text-sm font-medium">{title}</p>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{desc}</p>
        </div>
      ))}
    </div>
  );

  const AboutPanel = (
    <div className="space-y-3">
      <div className="rounded-3xl glass-strong p-5 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground"><Sparkles size={26} /></div>
        <p className="mt-3 text-base font-semibold">回声 Echo</p>
        <p className="mt-1 text-xs text-muted-foreground">{t("about.tagline")}</p>
      </div>
      <div className="rounded-2xl glass p-4">
        <p className="flex items-center gap-2 text-sm font-medium"><ShieldCheck size={16} className="text-accent" /> {t("about.privacy")}</p>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{t("about.privacy.desc")}</p>
      </div>
      <div className="rounded-2xl glass p-4">
        <p className="text-sm font-medium">{t("about.version")}</p>
        <p className="mt-2 text-xs text-muted-foreground">{t("about.version.desc")}</p>
      </div>
    </div>
  );

  const MeArea = (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2.5">
          {mePanel !== "overview" && <button onClick={() => setMePanel("overview")} className="rounded-lg p-1.5 hover:bg-muted/60"><ChevronRight size={18} className="rotate-180" /></button>}
          <div><p className="text-sm font-semibold">{mePanel === "overview" ? t("nav.me") : mePanel === "redeem" ? t("me.row.redeem") : mePanel === "usage" ? t("me.row.usage") : mePanel === "orders" ? t("me.row.orders") : mePanel === "help" ? t("me.row.help") : t("me.row.about")}</p><p className="text-[11px] text-muted-foreground">{t("me.subtitle")}</p></div>
        </div>
        <button onClick={() => setDark((d) => !d)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="明暗切换">{dark ? <Sun size={16} /> : <Moon size={16} />}</button>
      </header>
      <main ref={meScrollRef} className="flex-1 overflow-y-auto px-4 pb-4 pt-2">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={mePanel}
            initial={{ opacity: 0, x: mePanel === "overview" ? -18 : 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: mePanel === "overview" ? 18 : -18 }}
            transition={{ type: "spring", stiffness: 430, damping: 38, mass: 0.85 }}
          >
            {mePanel === "overview" && MeOverview}
            {mePanel === "redeem" && RedeemPanel}
            {mePanel === "usage" && UsagePanel}
            {mePanel === "orders" && OrdersPanel}
            {mePanel === "help" && HelpPanel}
            {mePanel === "about" && AboutPanel}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );

  const TABS = [
    { id: "chat", icon: MessageCircle, label: t("nav.chat") }, { id: "explore", icon: Compass, label: t("nav.explore") },
    { id: "memory", icon: Brain, label: t("nav.memory") }, { id: "me", icon: UserIcon, label: t("nav.me") },
  ];
  const BottomTabs = (
    <nav className="flex shrink-0 items-center justify-around glass-strong px-2 py-2">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`relative flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${tab === t.id ? "text-accent" : "text-muted-foreground"}`}>
          {tab === t.id && <motion.span layoutId="mobile-tab-pill" className="absolute inset-1 rounded-xl bg-accent/10" transition={{ type: "spring", stiffness: 520, damping: 42 }} />}
          <t.icon size={20} className="relative z-10" /><span className="relative z-10 text-[10px]">{t.label}</span>
        </button>
      ))}
    </nav>
  );

  return (
    <div className="h-[100dvh] w-screen overflow-hidden text-foreground" style={{ backgroundImage: ambient }}>
      {!mobile && (
        <div className="flex h-full gap-3 p-3">
          <div className="rounded-3xl glass">{LeftNav}</div>
          <div className="flex flex-1 overflow-hidden rounded-3xl glass">{ChatArea}</div>
          <AnimatePresence>
            {consoleOpen && (
              <motion.div
                className="rounded-3xl glass"
                initial={{ opacity: 0, x: 28, scale: 0.98 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 24, scale: 0.98 }}
                transition={{ type: "spring", stiffness: 380, damping: 36, mass: 0.9 }}
              >
                {Console}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      {mobile && (
        <div className="mx-auto flex h-full w-full max-w-[420px] flex-col overflow-hidden border-x border-border/40">
          <div className="flex flex-1 overflow-hidden">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={tab}
                className="flex h-full w-full"
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={{ type: "spring", stiffness: 420, damping: 38, mass: 0.86 }}
              >
                {tab === "me" ? MeArea
                  : tab === "memory" ? <MemoryPanel personaId={activeId} personaName={active?.name} />
                  : tab === "explore" ? <ExplorePanel personas={personas} onInstalled={reloadPersonas} />
                  : ChatArea}
              </motion.div>
            </AnimatePresence>
          </div>
          {BottomTabs}
          <AnimatePresence>
            {drawer && (
              <motion.div className="fixed inset-0 z-40">
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(6px)" }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  onClick={() => setDrawer(false)}
                />
                <motion.div
                  className="absolute left-0 top-0 h-full w-[82%] max-w-[320px] glass-strong"
                  initial={{ x: "-102%", opacity: 0.8 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: "-102%", opacity: 0.9 }}
                  transition={{ type: "spring", stiffness: 390, damping: 36, mass: 0.9 }}
                >
                  <div className="flex justify-end p-3"><button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 hover:bg-muted/60"><X size={18} /></button></div>
                  {LeftNav}
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
      <FragmentModal open={fragModal} onClose={() => setFragModal(false)} onRecharge={() => { setFragModal(false); navigate("/recharge"); }} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <ChatImportModal open={importOpen} onClose={() => setImportOpen(false)} personaId={activeId} personaName={active?.name} />

      <AnimatePresence>
        {exploreOpen && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4 md:p-6"
            style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => setExploreOpen(false)}>
            <motion.div className="flex h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl glass-strong shadow-2xl"
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.86 }}
              onClick={(e) => e.stopPropagation()}>
              <ExplorePanel personas={personas} onInstalled={reloadPersonas} onClose={() => setExploreOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {memoryOpen && (
          <motion.div className="fixed inset-0 z-50 grid place-items-center p-4 md:p-6"
            style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(8px)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
            onClick={() => setMemoryOpen(false)}>
            <motion.div className="flex h-[82vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl glass-strong shadow-2xl"
              initial={{ opacity: 0, y: 30, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 20, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.86 }}
              onClick={(e) => e.stopPropagation()}>
              <MemoryPanel personaId={activeId} personaName={active?.name} onClose={() => setMemoryOpen(false)} />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
