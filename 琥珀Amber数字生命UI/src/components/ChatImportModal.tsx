import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Upload, FileText, Check, Loader2 } from "lucide-react";
import { parseChatExport, chunkText, importChatToPersona, pickChatFile } from "@/lib/chatImport";

/** Import WeChat/QQ chat export (.txt or pasted) into a persona's local memory. */
export default function ChatImportModal({
  open, onClose, personaId, personaName, onDone,
}: { open: boolean; onClose: () => void; personaId: string | null; personaName?: string; onDone?: () => void }) {
  const [raw, setRaw] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(0);

  const cleaned = raw.trim() ? parseChatExport(raw) : "";
  const chunkCount = cleaned ? chunkText(cleaned).length : 0;

  const loadFile = async () => { const t = await pickChatFile(); if (t) setRaw(t); };
  const run = async () => {
    if (!personaId || !raw.trim() || busy) return;
    setBusy(true);
    try {
      const n = await importChatToPersona(personaId, raw, true);
      setDone(n);
      onDone?.();
      setTimeout(() => { setRaw(""); setDone(0); onClose(); }, 1200);
    } finally { setBusy(false); }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 grid place-items-center p-6"
          style={{ background: "color-mix(in srgb, var(--background) 55%, transparent)", backdropFilter: "blur(8px)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}
          onClick={onClose}>
          <motion.div className="w-full max-w-md rounded-3xl glass-strong p-6 shadow-2xl"
            initial={{ opacity: 0, y: 34, scale: 0.94 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.86 }}
            onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-semibold"><FileText size={15} className="text-accent" /> 导入聊天记录{personaName ? ` · ${personaName}` : ""}</h3>
              <button onClick={onClose} className="rounded-lg p-1.5 hover:bg-muted/60"><X size={16} /></button>
            </div>
            <p className="mb-3 text-xs leading-relaxed text-muted-foreground">
              从微信/QQ 导出聊天记录为 .txt，上传或粘贴到下方。自动清洗时间戳与系统消息，分块固化为该分身的本地记忆（不上传服务器）。
            </p>

            <button onClick={loadFile}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-xl glass px-3 py-2.5 text-sm transition-transform active:scale-[0.98]">
              <Upload size={15} className="text-accent" /> 选择 .txt 文件
            </button>

            <textarea value={raw} onChange={(e) => setRaw(e.target.value)} rows={6}
              placeholder="或直接粘贴聊天记录文本…"
              className="w-full resize-none rounded-xl glass px-4 py-2.5 text-sm outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />

            {raw.trim() && <p className="mt-2 text-[11px] text-muted-foreground">清洗后约可生成 <span className="text-accent">{chunkCount}</span> 条记忆碎片</p>}

            <button onClick={run} disabled={busy || !personaId || chunkCount === 0}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold fragment-glow transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50">
              {busy ? <Loader2 size={16} className="animate-spin" /> : done > 0 ? <Check size={16} /> : null}
              {busy ? "导入中…" : done > 0 ? `已导入 ${done} 条` : "导入为记忆"}
            </button>
            {!personaId && <p className="mt-2 text-center text-[11px] text-muted-foreground">请先选择一个数字生命</p>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
