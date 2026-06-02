import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Cpu, Check, Camera, User as UserIcon } from "lucide-react";
import { pickAvatar } from "@/lib/avatar";

const KEY = "amber_global_api";
const AVATAR_KEY = "amber_user_avatar";

interface Cfg { apiKey?: string; baseUrl?: string; modelId?: string }

const PRESETS = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4o-mini" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-chat" },
  { name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", modelId: "moonshot-v1-8k" },
];

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    try {
      const c: Cfg = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (c.apiKey) setApiKey(c.apiKey);
      if (c.baseUrl) setBaseUrl(c.baseUrl);
      if (c.modelId) setModelId(c.modelId);
    } catch { /* ignore */ }
    setUserAvatar(localStorage.getItem(AVATAR_KEY));
  }, [open]);

  const save = () => {
    localStorage.setItem(KEY, JSON.stringify({ apiKey, baseUrl, modelId }));
    if (userAvatar) localStorage.setItem(AVATAR_KEY, userAvatar);
    setSaved(true);
    setTimeout(() => { setSaved(false); onClose(); }, 700);
  };

  const field = "w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30";

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
            className="w-full max-w-md rounded-3xl glass-strong p-6 shadow-2xl"
            initial={{ opacity: 0, y: 36, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.86 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><Cpu size={15} className="text-accent" /> 模型连接设置</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/60"><X size={16} /></button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <button type="button" title="设置我的头像"
                onClick={async () => { const a = await pickAvatar(); if (a) setUserAvatar(a); }}
                className="group relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-fragment to-accent text-fragment-foreground">
                {userAvatar ? <img src={userAvatar} alt="" className="h-full w-full object-cover" /> : <UserIcon size={22} />}
                <span className="absolute inset-0 hidden place-items-center bg-black/40 group-hover:grid"><Camera size={16} className="text-white" /></span>
              </button>
              <div className="text-xs text-muted-foreground">我的头像<br /><span className="text-[10px]">点击更换 · 仅保存在本地</span></div>
            </div>

            <div className="mb-4 flex gap-2">
              {PRESETS.map((p) => (
                <button key={p.name} onClick={() => { setBaseUrl(p.baseUrl); setModelId(p.modelId); }}
                  className="flex-1 rounded-xl glass px-2 py-1.5 text-xs hover:bg-muted/40 transition-colors">{p.name}</button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">API Key</label>
                <input type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="sk-..." className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Base URL</label>
                <input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} className={field} />
              </div>
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">模型 ID</label>
                <input value={modelId} onChange={(e) => setModelId(e.target.value)} className={field} />
              </div>
            </div>

            <button onClick={save}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98]">
              {saved ? <><Check size={16} /> 已保存</> : "保存配置"}
            </button>
            <p className="mt-3 text-center text-[10px] leading-relaxed text-muted-foreground">
              密钥仅存储在本地浏览器，对话时随请求发送至你自己的模型服务。
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
