import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Sparkles, Gem } from "lucide-react";
import { useAuthStore } from "@/stores/auth";
import { useApplySavedTheme } from "@/lib/theme";

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, register, loading, user } = useAuthStore();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [nickname, setNickname] = useState("");
  const [error, setError] = useState("");

  useApplySavedTheme(true);

  useEffect(() => {
    if (user) navigate("/", { replace: true });
  }, [user, navigate]);

  const submit = async () => {
    setError("");
    if (!/^\d{6,}$/.test(phone)) { setError("请输入有效手机号"); return; }
    if (password.length < 6) { setError("密码至少 6 位"); return; }
    try {
      if (mode === "login") await login(phone, password);
      else await register(phone, password, nickname || undefined);
      navigate("/", { replace: true });
    } catch (e: any) {
      setError(e?.response?.data?.detail || "操作失败，请重试");
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
            <h1 className="text-xl font-semibold">琥珀 Amber</h1>
            <p className="mt-1 text-xs text-muted-foreground">{mode === "login" ? "唤醒你的数字生命" : "创建你的数字生命"}</p>
          </div>
        </div>

        <div className="space-y-3">
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="手机号"
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="密码（至少 6 位）"
            onKeyDown={(e) => e.key === "Enter" && submit()}
            className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          {mode === "register" && (
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="昵称（可选）"
              className="w-full rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          )}
        </div>

        {error && <p className="mt-3 text-center text-xs text-destructive">{error}</p>}

        {mode === "register" && (
          <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-fragment">
            <Gem size={12} /> 注册即赠 100 记忆碎片
          </div>
        )}

        <button onClick={submit} disabled={loading}
          className="mt-5 w-full rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
          {loading ? "处理中…" : mode === "login" ? "登录" : "注册并进入"}
        </button>

        <button onClick={() => { setMode(mode === "login" ? "register" : "login"); setError(""); }}
          className="mt-3 w-full text-center text-xs text-muted-foreground hover:text-foreground transition-colors">
          {mode === "login" ? "还没有账号？立即注册" : "已有账号？返回登录"}
        </button>
      </div>
    </div>
  );
}
