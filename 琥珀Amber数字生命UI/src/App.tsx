import { useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";
import { useI18n } from "@/lib/i18n";
import LoginPage from "@/pages/Login";
import ChatPage from "@/pages/Chat";
import RechargePage from "@/pages/Recharge";
import CreatePersonaPage from "@/pages/CreatePersona";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  if (!initialized) {
    return (
      <div className="grid h-screen w-screen place-items-center bg-background text-muted-foreground text-sm">
        {t("boot.waking")}
      </div>
    );
  }
  return user ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  const bootstrap = useAuthStore((s) => s.bootstrap);
  useEffect(() => { bootstrap(); }, [bootstrap]);

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<RequireAuth><ChatPage /></RequireAuth>} />
        <Route path="/recharge" element={<RequireAuth><RechargePage /></RequireAuth>} />
        <Route path="/create" element={<RequireAuth><CreatePersonaPage /></RequireAuth>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  );
}
