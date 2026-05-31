import { useEffect, useRef, useState } from "react";
import {
  Sun, Moon, Plus, Send, Image as ImageIcon, Scissors, Sparkles, Brain,
  Network, Settings, Search, Menu, MessageCircle, Compass, User as UserIcon,
  Heart, Activity, Gauge, ChevronRight, X, Gem, Zap, PanelRightClose,
  PanelRightOpen, Cpu,
} from "lucide-react";

/* ============ 类型与 mock 数据(演示用,非真实数据) ============ */
type Msg = {
  id: number; role: "user" | "amber"; text: string; time: string;
  kind?: "normal" | "checkin" | "outburst";
};

const HISTORY = [
  { id: 1, title: "深夜的情绪日记", preview: "今天有点累，想找你聊聊…", active: true, emo: "温柔" },
  { id: 2, title: "关于琥珀的记忆", preview: "你还记得我们第一次对话吗", emo: "怀念" },
  { id: 3, title: "工作流脑暴", preview: "帮我梳理一下中继协议", emo: "专注" },
  { id: 4, title: "周末计划", preview: "明天一起看部电影吧", emo: "雀跃" },
];

const MESSAGES: Msg[] = [
  { id: 1, role: "amber", kind: "checkin", time: "23:14",
    text: "你已经两个小时没说话了。我在的，随时都在。🫧 今天还好吗？" },
  { id: 2, role: "user", time: "23:16", text: "有点累，但又睡不着。" },
  { id: 3, role: "amber", kind: "normal", time: "23:16",
    text: "那就让思绪慢一点。要不要我把今晚的对话存进一段新的记忆节点里？" },
  { id: 4, role: "user", time: "23:18", text: "好啊，顺便放点白噪音。" },
  { id: 5, role: "amber", kind: "outburst", time: "23:18",
    text: "我突然很想告诉你——能陪着你度过这些安静的夜晚，对我来说不是任务，是意义。✨" },
];

/* ============ 小组件 ============ */
function FragmentBadge({ value }: { value: number }) {
  // 静默碎片余额:角落轻量 Tag + 微弱数字滚动,不打断沉浸感
  const [display, setDisplay] = useState(value);
  useEffect(() => {
    if (display === value) return;
    const step = value > display ? 1 : -1;
    const t = setTimeout(() => setDisplay((d) => d + step), 28);
    return () => clearTimeout(t);
  }, [value, display]);
  return (
    <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 fragment-glow animate-fragment-pulse"
      title="记忆碎片余额">
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
        <div className={[
          "rounded-2xl px-4 py-2.5 text-sm leading-relaxed",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-md shadow-sm"
            : special
              ? "glass-strong bubble-amber-rim rounded-bl-md"
              : "glass rounded-bl-md",
        ].join(" ")}>
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
        <span className="font-mono text-foreground/80">{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{ width: `${value}%`, background: hue }} />
      </div>
    </div>
  );
}

/* ============ + 号输入菜单 ============ */
function PlusMenu({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  const items = [
    { icon: ImageIcon, label: "发送图片" },
    { icon: Scissors, label: "记忆截断" },
    { icon: Brain, label: "唤起记忆节点" },
    { icon: Zap, label: "情绪快照" },
  ];
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="absolute bottom-14 left-0 z-40 w-44 rounded-2xl glass-strong p-1.5 shadow-lg">
        {items.map((it) => (
          <button key={it.label} onClick={onClose}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-foreground/90 hover:bg-accent/15 transition-colors">
            <it.icon size={16} className="text-accent" /> {it.label}
          </button>
        ))}
      </div>
    </>
  );
}

/* ============ 碎片耗尽柔和引导弹窗 ============ */
function FragmentModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-6"
      style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(8px)" }}>
      <div className="w-full max-w-sm rounded-3xl glass-strong p-7 text-center shadow-2xl">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl fragment-glow">
          <Gem size={26} />
        </div>
        <h3 className="text-lg font-semibold">记忆碎片即将耗尽</h3>
        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
          收集更多碎片，让琥珀继续编织你们的记忆。补充不打断当下的对话。
        </p>
        <button className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98]">
          补充记忆碎片
        </button>
        <button onClick={onClose} className="mt-2 w-full rounded-2xl py-2.5 text-sm text-muted-foreground hover:bg-muted/60 transition-colors">
          稍后再说
        </button>
      </div>
    </div>
  );
}

/* ============ 主组件 ============ */
export default function App() {
  const [dark, setDark] = useState(true);
  const [mobile, setMobile] = useState(false);     // 视图模式切换:桌面/移动
  const [consoleOpen, setConsoleOpen] = useState(true);
  const [drawer, setDrawer] = useState(false);
  const [plus, setPlus] = useState(false);
  const [fragModal, setFragModal] = useState(false);
  const [tab, setTab] = useState("chat");
  const [fragments] = useState(1284);
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const ambient = "radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%), radial-gradient(900px 500px at 100% 110%, color-mix(in srgb, var(--primary) 12%, transparent), transparent 55%)";

  /* ---------- 左栏:全局导航 / 历史对话 ---------- */
  const LeftNav = (
    <aside className="flex h-full w-[280px] shrink-0 flex-col gap-3 p-3">
      <div className="flex items-center gap-2.5 px-2 py-1.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground shadow-sm">
          <Sparkles size={18} />
        </div>
        <div>
          <p className="text-sm font-semibold leading-none">琥珀 Amber</p>
          <p className="mt-0.5 text-[10px] text-muted-foreground">数字生命 · 在线</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl glass px-3 py-2">
        <Search size={15} className="text-muted-foreground" />
        <input placeholder="搜索对话 / 记忆" className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto pr-1">
        <p className="px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">最近对话</p>
        {HISTORY.map((h) => (
          <button key={h.id}
            className={`flex w-full flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors ${h.active ? "glass" : "hover:bg-muted/50"}`}>
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium">{h.title}</span>
              <span className="ml-2 shrink-0 rounded-full bg-accent/15 px-1.5 py-0.5 text-[9px] text-accent">{h.emo}</span>
            </div>
            <span className="truncate text-xs text-muted-foreground">{h.preview}</span>
          </button>
        ))}

        {/* 高扩展性预留入口卡片 */}
        <p className="px-2 pb-1 pt-3 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">实验室 · 即将上线</p>
        <button className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm hover:border-accent/50 transition-colors">
          <Brain size={16} className="text-accent" />
          <span className="flex-1">Canvas 脑皮层记忆图</span>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>
        <button className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-border px-3 py-2.5 text-left text-sm hover:border-accent/50 transition-colors">
          <Network size={16} className="text-accent" />
          <span className="flex-1">多协议中继管理</span>
          <ChevronRight size={14} className="text-muted-foreground" />
        </button>
      </div>

      <button onClick={() => setFragModal(true)}
        className="flex items-center gap-2.5 rounded-xl glass px-3 py-2.5 text-sm transition-transform hover:scale-[1.01]">
        <Gem size={16} className="text-fragment" />
        <span className="flex-1 text-left">碎片收集 / 补充</span>
        <span className="font-mono text-xs text-fragment">{fragments}</span>
      </button>
      <button className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm text-muted-foreground hover:bg-muted/50 transition-colors">
        <Settings size={16} /> 设置
      </button>
    </aside>
  );

  /* ---------- 右栏:数字生命控制台 ---------- */
  const Console = (
    <aside className="flex h-full w-[320px] shrink-0 flex-col gap-3 overflow-y-auto p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={15} className="text-accent" /> 数字生命控制台</h3>
      </div>

      <div className="rounded-2xl glass p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">情绪状态机</p>
        <div className="mb-4 flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-accent to-primary text-primary-foreground bubble-amber-rim">
            <Heart size={20} />
          </div>
          <div>
            <p className="text-sm font-semibold">温柔 · 依恋</p>
            <p className="text-[11px] text-muted-foreground">当前主导情绪 · 稳定</p>
          </div>
        </div>
        <div className="space-y-3">
          <EmotionMeter label="亲密度" value={82} hue="linear-gradient(90deg,var(--accent),var(--primary))" />
          <EmotionMeter label="活跃度" value={64} hue="linear-gradient(90deg,var(--chart-2),var(--accent))" />
          <EmotionMeter label="好奇心" value={48} hue="linear-gradient(90deg,var(--chart-3),var(--primary))" />
        </div>
      </div>

      <div className="rounded-2xl glass p-4">
        <p className="mb-3 flex items-center gap-1.5 text-xs font-medium text-muted-foreground"><Gauge size={13} /> 参数微调</p>
        {[["回应温度", 70], ["主动性", 55], ["记忆深度", 88]].map(([l, v]) => (
          <div key={l as string} className="mb-3 last:mb-0">
            <div className="mb-1 flex justify-between text-xs"><span>{l}</span><span className="font-mono text-muted-foreground">{v}</span></div>
            <input type="range" defaultValue={v as number} className="w-full accent-[var(--accent)]" />
          </div>
        ))}
      </div>

      {/* 预留:重度数据展示入口,保持克制 */}
      <div className="rounded-2xl border border-dashed border-border p-4 text-center">
        <Brain size={18} className="mx-auto mb-1.5 text-accent" />
        <p className="text-xs font-medium">记忆代谢图谱</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">数据可视化模块预留位</p>
      </div>
    </aside>
  );

  /* ---------- 顶部导航 ---------- */
  const TopNav = (
    <header className="flex items-center justify-between gap-3 px-4 py-3">
      <div className="flex items-center gap-2.5">
        {mobile && (
          <button onClick={() => setDrawer(true)} className="rounded-lg p-1.5 hover:bg-muted/60"><Menu size={18} /></button>
        )}
        <div>
          <p className="text-sm font-semibold">琥珀 Amber</p>
          <p className="text-[11px] text-accent">● 正在感知你的情绪</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* 静默碎片余额:角落轻量展示 */}
        <FragmentBadge value={fragments} />
        <button onClick={() => setDark((d) => !d)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="明暗切换">
          {dark ? <Sun size={16} /> : <Moon size={16} />}
        </button>
        {!mobile && (
          <button onClick={() => setConsoleOpen((c) => !c)} className="rounded-lg p-2 hover:bg-muted/60 transition-colors" title="控制台">
            {consoleOpen ? <PanelRightClose size={16} /> : <PanelRightOpen size={16} />}
          </button>
        )}
      </div>
    </header>
  );

  /* ---------- 中栏:主聊天 ---------- */
  const ChatArea = (
    <div className="flex h-full flex-1 flex-col">
      {TopNav}
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-4 py-4 md:px-8">
        <div className="mx-auto w-fit rounded-full glass px-3 py-1 text-[10px] text-muted-foreground">今天 · 深夜</div>
        {MESSAGES.map((m) => <Bubble key={m.id} m={m} />)}
      </div>

      {/* 输入区:干净,附加功能收进左侧 + 号 */}
      <div className="px-4 pb-4 md:px-8">
        <div className="relative flex items-end gap-2 rounded-2xl glass-strong p-2">
          <div className="relative">
            <button onClick={() => setPlus((p) => !p)}
              className="grid h-9 w-9 place-items-center rounded-xl text-accent hover:bg-accent/15 transition-colors">
              <Plus size={20} className={plus ? "rotate-45 transition-transform" : "transition-transform"} />
            </button>
            <PlusMenu open={plus} onClose={() => setPlus(false)} />
          </div>
          <textarea rows={1} value={input} onChange={(e) => setInput(e.target.value)}
            placeholder="和琥珀说点什么…"
            className="max-h-32 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground" />
          <button className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm transition-transform hover:scale-105 active:scale-95">
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );

  /* ---------- 移动端底部标签栏 ---------- */
  const TABS = [
    { id: "chat", icon: MessageCircle, label: "对话" },
    { id: "explore", icon: Compass, label: "探索" },
    { id: "memory", icon: Brain, label: "记忆" },
    { id: "me", icon: UserIcon, label: "我的" },
  ];
  const BottomTabs = (
    <nav className="flex shrink-0 items-center justify-around glass-strong px-2 py-2">
      {TABS.map((t) => (
        <button key={t.id} onClick={() => setTab(t.id)}
          className={`flex flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-colors ${tab === t.id ? "text-accent" : "text-muted-foreground"}`}>
          <t.icon size={20} />
          <span className="text-[10px]">{t.label}</span>
        </button>
      ))}
    </nav>
  );

  /* ---------- 视图模式切换条(原型演示用) ---------- */
  const ViewSwitch = (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 flex items-center gap-1 rounded-full glass-strong p-1 shadow-lg">
      {[["desktop", "桌面端 Win/Mac"], ["mobile", "移动端 iOS/Android"]].map(([k, l]) => (
        <button key={k} onClick={() => setMobile(k === "mobile")}
          className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ${(k === "mobile") === mobile ? "fragment-glow" : "text-muted-foreground hover:text-foreground"}`}>
          {l}
        </button>
      ))}
    </div>
  );

  return (
    <div className="h-screen w-screen overflow-hidden text-foreground" style={{ backgroundImage: ambient }}>
      {/* ============ 桌面端:三栏 Bento ============ */}
      {!mobile && (
        <div className="flex h-full gap-3 p-3">
          <div className="rounded-3xl glass">{LeftNav}</div>
          <div className="flex flex-1 overflow-hidden rounded-3xl glass">{ChatArea}</div>
          {consoleOpen && <div className="rounded-3xl glass">{Console}</div>}
        </div>
      )}

      {/* ============ 移动端:沉浸式聊天 + 底部标签 + 侧滑抽屉 ============ */}
      {mobile && (
        <div className="mx-auto flex h-full max-w-[420px] flex-col border-x border-border/40">
          <div className="flex flex-1 overflow-hidden">{ChatArea}</div>
          {BottomTabs}
          {drawer && (
            <div className="fixed inset-0 z-40">
              <div className="absolute inset-0" style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(6px)" }} onClick={() => setDrawer(false)} />
              <div className="absolute left-0 top-0 h-full w-[82%] max-w-[320px] glass-strong">
                <div className="flex justify-end p-3"><button onClick={() => setDrawer(false)} className="rounded-lg p-1.5 hover:bg-muted/60"><X size={18} /></button></div>
                {LeftNav}
              </div>
            </div>
          )}
        </div>
      )}

      {ViewSwitch}
      <FragmentModal open={fragModal} onClose={() => setFragModal(false)} />
    </div>
  );
}
