import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Gem, Check, Loader2 } from "lucide-react";
import { listSkus, createOrder, settleDev, type Sku } from "@/api/billing";
import { getBalance } from "@/api/wallet";
import { useApplySavedTheme } from "@/lib/theme";
import { useI18n } from "@/lib/i18n";

const CHANNELS = [{ id: "wechat" }, { id: "alipay" }, { id: "dev" }];

export default function RechargePage() {
  const navigate = useNavigate();
  const { t } = useI18n();
  const [skus, setSkus] = useState<Sku[]>([]);
  const [balance, setBalance] = useState(0);
  const [selected, setSelected] = useState<string | null>(null);
  const [channel, setChannel] = useState("dev");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  useApplySavedTheme(true);
  const refresh = () => getBalance().then((b) => setBalance(b.balance)).catch(() => {});
  useEffect(() => {
    listSkus().then((s) => { setSkus(s); if (s.length) setSelected(s[0].sku); }).catch(() => {});
    refresh();
  }, []);

  const pay = async () => {
    if (!selected || busy) return;
    setBusy(true);
    setToast("");
    try {
      const order = await createOrder(selected, channel);
      if (channel === "dev") {
        const res = await settleDev(order.out_trade_no);
        setBalance(res.balance);
        setToast(t("recharge.ok", { n: order.fragments }));
      } else {
        setToast(t("recharge.skeleton"));
      }
    } catch (e: any) {
      setToast(e?.response?.data?.detail || t("recharge.order_failed"));
    } finally {
      setBusy(false);
    }
  };

  const ambient = "radial-gradient(1200px 600px at 20% -10%, color-mix(in srgb, var(--accent) 14%, transparent), transparent 60%)";

  return (
    <div className="h-screen w-screen overflow-y-auto text-foreground" style={{ backgroundImage: ambient }}>
      <div className="mx-auto max-w-md p-5">
        <div className="mb-5 flex items-center gap-3">
          <button onClick={() => navigate("/")} className="rounded-lg p-1.5 hover:bg-muted/60"><ArrowLeft size={18} /></button>
          <h1 className="text-base font-semibold">{t("recharge.title")}</h1>
          <div className="ml-auto flex items-center gap-1.5 rounded-full px-2.5 py-1 fragment-glow">
            <Gem size={13} /><span className="font-mono text-xs font-semibold">{balance.toLocaleString()}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {skus.map((s) => (
            <button key={s.sku} onClick={() => setSelected(s.sku)}
              className={`relative rounded-2xl p-4 text-left transition-all ${selected === s.sku ? "glass-strong bubble-echo-rim" : "glass hover:scale-[1.01]"}`}>
              {selected === s.sku && <Check size={16} className="absolute right-3 top-3 text-accent" />}
              <div className="flex items-center gap-1.5 text-fragment"><Gem size={16} /><span className="font-mono text-lg font-bold">{s.fragments}</span></div>
              <p className="mt-1 text-xs text-muted-foreground">{s.title}</p>
              <p className="mt-2 text-sm font-semibold">{s.price_display}</p>
            </button>
          ))}
        </div>

        <p className="mb-2 mt-6 text-xs font-medium text-muted-foreground">{t("recharge.method")}</p>
        <div className="space-y-2">
          {CHANNELS.map((c) => (
            <button key={c.id} onClick={() => setChannel(c.id)}
              className={`flex w-full items-center gap-2.5 rounded-xl px-4 py-3 text-sm transition-colors ${channel === c.id ? "glass-strong" : "glass hover:bg-muted/40"}`}>
              <span className={`grid h-4 w-4 place-items-center rounded-full border ${channel === c.id ? "border-accent" : "border-muted-foreground/40"}`}>
                {channel === c.id && <span className="h-2 w-2 rounded-full bg-accent" />}
              </span>
              {t(`recharge.ch.${c.id}`)}
            </button>
          ))}
        </div>

        {toast && <p className="mt-4 text-center text-xs text-accent">{toast}</p>}

        <button onClick={pay} disabled={busy || !selected}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
          {busy && <Loader2 size={16} className="animate-spin" />}{busy ? t("common.processing") : t("recharge.confirm")}
        </button>

        <p className="mt-4 text-center text-[10px] leading-relaxed text-muted-foreground">
          {t("recharge.disclaimer")}<br />{t("recharge.ios")}
        </p>
      </div>
    </div>
  );
}
