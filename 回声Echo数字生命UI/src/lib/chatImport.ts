// Tolerant importer for WeChat / QQ chat-log exports (plain .txt).
// Strips timestamps, headers and placeholder noise, then chunks the remaining
// conversational text into local corpus entries. Fully local — never uploaded.

import { corpusStore } from "@/lib/localdb";

// Lines that are pure metadata/noise rather than conversation content.
const NOISE: RegExp[] = [
  /撤回了一条消息|拍了拍|以下为新消息|消息记录|聊天记录|^-{3,}$|^={3,}$/,
  /^\[(图片|表情|动画表情|语音|视频|文件|位置|转账|红包|链接|引用|回复)\]?\]?$/,
  /^\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?$/, // bare date separator
];
// "昵称 2023-01-01 12:00:00" / "昵称(12345) 2023/1/1 12:00" header lines.
const HEADER = /^.{1,48}?[\s(（].*?\d{4}[-/]\d{1,2}[-/]\d{1,2}\s+\d{1,2}:\d{2}/;
const LEADING_NICK = /^[^\s:：]{1,24}[：:]\s*/; // strip "昵称：" prefix on a content line

/** Clean a raw export into newline-joined conversational text. */
export function parseChatExport(raw: string): string {
  const out: string[] = [];
  for (let line of raw.split(/\r?\n/)) {
    line = line.trim();
    if (!line) continue;
    if (HEADER.test(line)) continue;
    if (NOISE.some((re) => re.test(line))) continue;
    line = line.replace(LEADING_NICK, "").trim();
    if (line) out.push(line);
  }
  return out.join("\n");
}

/** Chunk text into ~maxLen-char blocks on line boundaries (matches CreatePersona). */
export function chunkText(text: string, maxLen = 500): string[] {
  const chunks: string[] = [];
  let cur = "";
  for (const line of text.split("\n")) {
    const t = line.trim();
    if (!t) continue;
    if (cur.length + t.length > maxLen) { if (cur) chunks.push(cur.trim()); cur = t + "\n"; }
    else cur += t + "\n";
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

/** Parse + chunk + persist to a persona's local corpus. Returns #chunks written. */
export async function importChatToPersona(personaId: string, raw: string, pinned = true): Promise<number> {
  const cleaned = parseChatExport(raw);
  const chunks = chunkText(cleaned);
  if (chunks.length) await corpusStore.bulkAdd(personaId, chunks, pinned);
  return chunks.length;
}

/** Read a user-picked .txt file as text (UTF-8). */
export function pickChatFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".txt,text/plain";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return resolve(null);
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsText(file, "utf-8");
    };
    input.click();
  });
}
