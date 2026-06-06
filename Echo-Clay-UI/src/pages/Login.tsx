import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Gem } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useApplySavedTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

export default function LoginPage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const { login, register, loading, user } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  useApplySavedTheme(false);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async () => {
    setError("");
    if (!/^\d{6,}$/.test(phone)) { setError(t("login.err.phone")); return; }
    if (password.length < 6) { setError(t("login.err.password")); return; }
    try {
      if (mode === "login") await login(phone, password);
      else await register(phone, password, nickname || undefined);
      navigate("/", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail || t("common.retry_failed"));
    }
  };

  const ambient = "radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 16%, transparent), transparent 60%), radial-gradient(900px 500px at 100% 110%, color-mix(in srgb, var(--primary) 14%, transparent), transparent 55%)";

  return (
    <div className="grid h-screen w-screen place-items-center text-foreground" style={{ backgroundImage: ambient }}>
      <div className="w-full max-w-sm rounded-3xl glass-strong p-8 shadow-2xl">
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-fragment to-accent text-fragment-foreground shadow-sm">
            <Sparkles size={26} />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-semibold">{t("brand")}</h1>
            <p className="mt-1 text-xs text-muted-foreground">{t(mode === "login" ? "login.tagline.login" : "login.tagline.register")}</p>
          </div>
        </div>

        <div className="space-y-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder={t("login.phone")}
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t("login.password")}
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          {mode === "register" && (
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder={t("login.nickname")}
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          )}
        </div>

        {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}

        {mode === "register" && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fragment">
            <Gem size={12} /> {t("login.gift")}
          </div>
        )}

        <button onClick={submit} disabled={loading}
          className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
          {loading ? t("common.processing") : t(mode === "login" ? "login.submit.login" : "login.submit.register")}
        </button>

        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
          {t(mode === "login" ? "login.switch.toRegister" : "login.switch.toLogin")}
        </button>
      </div>
    </div>
  );
}
