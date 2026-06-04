import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Check, Camera, User as UserIcon, Sparkles, ChevronDown } from "lucide-react";
import { pickAvatar } from "@/lib/avatar";
import { useI18n } from "@/lib/i18n";
import { useLocaleStore } from "@/stores/locale";

const KEY = "echo_global_api";
const AVATAR_KEY = "echo_user_avatar";
const CUSTOM_FLAG = "echo_use_custom_api";

interface Cfg { apiKey?: string; baseUrl?: string; modelId?: string }

const PRESETS = [
  { name: "OpenAI", baseUrl: "https://api.openai.com/v1", modelId: "gpt-4o-mini" },
  { name: "DeepSeek", baseUrl: "https://api.deepseek.com/v1", modelId: "deepseek-chat" },
  { name: "Moonshot", baseUrl: "https://api.moonshot.cn/v1", modelId: "moonshot-v1-8k" },
];

export default function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [useCustom, setUseCustom] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [modelId, setModelId] = useState("gpt-4o-mini");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!open) return;
    setUserAvatar(localStorage.getItem(AVATAR_KEY));
    const custom = localStorage.getItem(CUSTOM_FLAG) === "1";
    setUseCustom(custom);
    setShowAdvanced(custom);
    try {
      const c: Cfg = JSON.parse(localStorage.getItem(KEY) || "{}");
      if (c.apiKey) setApiKey(c.apiKey);
      if (c.baseUrl) setBaseUrl(c.baseUrl);
      if (c.modelId) setModelId(c.modelId);
    } catch { /* ignore */ }
  }, [open]);

  const save = () => {
    if (userAvatar) localStorage.setItem(AVATAR_KEY, userAvatar);
    localStorage.setItem(CUSTOM_FLAG, useCustom ? "1" : "0");
    if (useCustom) localStorage.setItem(KEY, JSON.stringify({ apiKey, baseUrl, modelId }));
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
              <h3 className="flex items-center gap-2 text-sm font-semibold"><UserIcon size={15} className="text-accent" /> {t("settings.title")}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/60"><X size={16} /></button>
            </div>

            <div className="mb-4 flex items-center gap-3">
              <button type="button" title={t("settings.avatar")}
                onClick={async () => { const a = await pickAvatar(); if (a) setUserAvatar(a); }}
                className="group relative grid h-14 w-14 shrink-0 place-items-center overflow-hidden rounded-full bg-gradient-to-br from-fragment to-accent text-fragment-foreground">
                {userAvatar ? <img src={userAvatar} alt="" className="h-full w-full object-cover" /> : <UserIcon size={22} />}
                <span className="absolute inset-0 hidden place-items-center bg-black/40 group-hover:grid"><Camera size={16} className="text-white" /></span>
              </button>
              <div className="text-xs text-muted-foreground">{t("settings.avatar")}<br /><span className="text-[10px]">{t("settings.avatar.hint")}</span></div>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-2xl glass px-4 py-2.5">
              <span className="text-xs text-muted-foreground">{t("settings.language")}</span>
              <div className="flex gap-1 rounded-xl bg-muted/40 p-0.5">
                {(["zh", "en"] as const).map((l) => (
                  <button key={l} onClick={() => setLocale(l)}
                    className={`rounded-lg px-3 py-1 text-xs transition-colors ${locale === l ? "glass-strong text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                    {l === "zh" ? "中文" : "English"}
                  </button>
                ))}
              </div>
            </div>

            {/* 主版本：平台统一供模，无需配置 */}
            <div className="flex items-start gap-3 rounded-2xl glass p-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent to-primary text-primary-foreground"><Sparkles size={16} /></div>
              <div className="text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">{t("settings.model.ready")}</span><br />
                {t("settings.model.ready.desc")}
              </div>
            </div>

            {/* 高级：保留「自带 API」能力，默认折叠 */}
            <button onClick={() => setShowAdvanced((v) => !v)}
              className="mt-3 flex w-full items-center justify-between rounded-xl px-1 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <span>{t("settings.advanced")}</span>
              <ChevronDown size={15} className={`transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence initial={false}>
              {showAdvanced && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.22 }}
                  className="overflow-hidden"
                >
                  <label className="mb-3 mt-1 flex items-center gap-2 text-xs text-foreground/90">
                    <input type="checkbox" checked={useCustom} onChange={(e) => setUseCustom(e.target.checked)} className="accent-[var(--accent)]" />
                    {t("settings.custom.enable")}
                  </label>
                  <div className={useCustom ? "" : "pointer-events-none opacity-50"}>
                    <div className="mb-3 flex gap-2">
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
                    <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">
                      {t("settings.custom.hint")}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <button onClick={save}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98]">
              {saved ? <><Check size={16} /> {t("common.saved")}</> : t("common.save")}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
