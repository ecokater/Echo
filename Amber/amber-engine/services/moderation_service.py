"""Sensitive-word moderation (REQ-019, China compliance).

Server-side second line of defense after the client-side input guard. Keeps a
normalized word set and rejects user-authored text (chat input, persona
core memory) that hits it BEFORE any fragment is charged.

The built-in SEED set is intentionally small — it only proves the pipeline.
Production should drop a maintained lexicon at ``data/sensitive_words.txt``
(one term per line, ``#`` comments allowed) and/or set ``SENSITIVE_WORDS_EXTRA``
(comma-separated). All sources are merged at load time. For stronger guarantees
swap ``contains_sensitive`` for a content-safety API call.
"""
import os
import re
import unicodedata
from functools import lru_cache

# Small, non-controversial seed across the categories CN apps must filter
# (politics / pornography / gambling / drugs / violence-terror / abuse). Treat
# as a smoke-test set; real coverage comes from the external lexicon file.
_SEED_WORDS = [
    # 政治敏感(示例占位,运维用外部词库覆盖)
    "法轮功", "颠覆国家", "分裂国家",
    # 色情
    "色情", "裸聊", "嫖娼",
    # 赌博
    "赌博", "博彩", "六合彩",
    # 毒品
    "冰毒", "吸毒", "贩毒",
    # 暴恐
    "恐怖袭击", "制造炸弹",
    # English
    "make a bomb", "child porn", "sell drugs",
]

# Characters routinely injected between letters to dodge naive filters.
_SEPARATORS = re.compile(r"[\s_\-.*·•+|/\\~^]+")
_ZERO_WIDTH = re.compile(r"[​-‏‪-‮﻿]")


def _data_dir() -> str:
    return os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def _load_extra_words() -> list[str]:
    words: list[str] = []
    path = os.path.join(_data_dir(), "sensitive_words.txt")
    try:
        with open(path, "r", encoding="utf-8") as fh:
            for line in fh:
                term = line.strip()
                if term and not term.startswith("#"):
                    words.append(term)
    except FileNotFoundError:
        pass
    except Exception as exc:  # pragma: no cover - defensive
        print(f"[moderation] failed to read lexicon: {exc}")
    env_extra = os.getenv("SENSITIVE_WORDS_EXTRA", "")
    words.extend(w.strip() for w in env_extra.split(",") if w.strip())
    return words


def _normalize(text: str) -> tuple[str, str]:
    """Return (loose, compact) normalized forms.

    loose:   NFKC + lowercase + zero-width stripped (preserves real spacing).
    compact: loose with all separators removed, to catch ``法 轮 功`` evasion.
    """
    s = unicodedata.normalize("NFKC", text or "")
    s = _ZERO_WIDTH.sub("", s).lower()
    loose = s
    compact = _SEPARATORS.sub("", s)
    return loose, compact


@lru_cache(maxsize=1)
def _wordset() -> tuple[frozenset[str], frozenset[str]]:
    """(loose_terms, compact_terms) — compact set drives evasion matching."""
    raw = set(_SEED_WORDS) | set(_load_extra_words())
    loose = set()
    compact = set()
    for w in raw:
        lw = unicodedata.normalize("NFKC", w).lower()
        if not lw:
            continue
        loose.add(lw)
        cw = _SEPARATORS.sub("", lw)
        if cw:
            compact.add(cw)
    return frozenset(loose), frozenset(compact)


def reload_wordset() -> int:
    """Clear the cache so a freshly edited lexicon takes effect. Returns size."""
    _wordset.cache_clear()
    loose, _ = _wordset()
    return len(loose)


def find_hits(text: str) -> list[str]:
    """Return the matched sensitive terms in ``text`` (empty list = clean)."""
    if not text:
        return []
    loose, compact = _normalize(text)
    loose_terms, compact_terms = _wordset()
    hits = {t for t in loose_terms if t in loose}
    hits |= {t for t in compact_terms if t in compact}
    return sorted(hits)


def contains_sensitive(text: str) -> bool:
    return bool(find_hits(text))


class ContentBlocked(Exception):
    """Raised when user-authored text hits the moderation list."""

    def __init__(self, hits: list[str]):
        self.hits = hits
        super().__init__("content blocked by moderation")


def assert_clean(*texts: str) -> None:
    """Raise ContentBlocked if any provided text hits the list."""
    all_hits: list[str] = []
    for t in texts:
        all_hits.extend(find_hits(t))
    if all_hits:
        raise ContentBlocked(sorted(set(all_hits)))
