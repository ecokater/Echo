// REQ-019 client-side sensitive-word guard. First line of defense; the backend
// re-checks before charging. Mirrors services/moderation_service.py logic
// (NFKC + lowercase + separator-stripped compact form for evasion).
//
// Keep this seed small; the authoritative/maintained list lives server-side.

const SEED: string[] = [
  // 政治敏感(示例占位)
  "法轮功", "颠覆国家", "分裂国家",
  // 色情
  "色情", "裸聊", "嫖娼",
  // 赌博
  "赌博", "博彩", "六合彩",
  // 毒品
  "冰毒", "吸毒", "贩毒",
  // 暴恐
  "恐怖袭击", "制造炸弹",
  // English
  "make a bomb", "child porn", "sell drugs",
];

const SEP = /[\s_\-.*·•+|/\\~^]+/g;
const ZERO_WIDTH = /[​-‏‪-‮﻿]/g;

function normalize(text: string): { loose: string; compact: string } {
  const s = (text || "").normalize("NFKC").replace(ZERO_WIDTH, "").toLowerCase();
  return { loose: s, compact: s.replace(SEP, "") };
}

const LOOSE = SEED.map((w) => w.normalize("NFKC").toLowerCase()).filter(Boolean);
const COMPACT = LOOSE.map((w) => w.replace(SEP, "")).filter(Boolean);

export function findSensitive(text: string): string[] {
  if (!text) return [];
  const { loose, compact } = normalize(text);
  const hits = new Set<string>();
  LOOSE.forEach((t) => { if (loose.includes(t)) hits.add(t); });
  COMPACT.forEach((t) => { if (compact.includes(t)) hits.add(t); });
  return [...hits];
}

export function isClean(...texts: (string | undefined | null)[]): boolean {
  return texts.every((t) => findSensitive(t || "").length === 0);
}
