#!/usr/bin/env python3
"""
trafilatura_extract.py
======================
Batch web-page text extractor using trafilatura.

Usage:
    echo '["https://example.com", "https://other.com"]' | python trafilatura_extract.py

Input  (stdin): JSON array of URLs  ->  ["url1", "url2", ...]
Output (stdout): JSON object         ->  {"url1": "clean text...", "url2": "...", ...}

Each value is the main article text extracted from the page (ads, navigation,
comments etc. are removed).  If a URL fails or returns no useful content,
its value is an empty string "".
"""

import sys
import io
import json

# Force UTF-8 on Windows (avoids charmap codec errors when piping)
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')
if hasattr(sys.stdin, 'buffer'):
    sys.stdin = io.TextIOWrapper(sys.stdin.buffer, encoding='utf-8', errors='replace')

# ── trafilatura (main extractor) ────────────────────────────────────────
try:
    import trafilatura
    from trafilatura.settings import use_config
    HAS_TRAFILATURA = True
except ImportError:
    HAS_TRAFILATURA = False

# ── requests as fallback fetcher ─────────────────────────────────────────
try:
    import requests
    HAS_REQUESTS = True
except ImportError:
    HAS_REQUESTS = False

# ── timeout handling (SIGALRM not available on Windows; use per-url timeout) ─

FETCH_TIMEOUT = 8   # seconds per URL
MAX_TEXT_CHARS = 50_000   # cap text returned per page

TRAFILATURA_CONFIG = None
if HAS_TRAFILATURA:
    cfg = use_config()
    cfg.set("DEFAULT", "EXTRACTION_TIMEOUT", "0")  # disable internal timeout
    TRAFILATURA_CONFIG = cfg


def fetch_and_extract(url: str) -> str:
    """Fetch URL and return clean main-body text using trafilatura."""
    if not url or not url.startswith(("http://", "https://")):
        return ""

    html_content = None

    # ── 1. Try trafilatura's own fetcher first ────────────────────────
    if HAS_TRAFILATURA:
        try:
            html_content = trafilatura.fetch_url(url)
        except Exception:
            html_content = None

    # ── 2. Fall back to requests if trafilatura fetch failed ───────────
    if not html_content and HAS_REQUESTS:
        try:
            resp = requests.get(
                url,
                timeout=FETCH_TIMEOUT,
                headers={
                    "User-Agent": (
                        "Mozilla/5.0 (compatible; AcademicBot/1.0; "
                        "+https://github.com/adbar/trafilatura)"
                    )
                },
                allow_redirects=True,
            )
            if resp.ok:
                html_content = resp.text
        except Exception:
            html_content = None

    if not html_content:
        return ""

    # ── 3. Extract main text with trafilatura ──────────────────────────
    if HAS_TRAFILATURA:
        try:
            text = trafilatura.extract(
                html_content,
                config=TRAFILATURA_CONFIG,
                include_comments=False,
                include_tables=True,
                no_fallback=False,
                favor_precision=False,
            )
            if text:
                return text[:MAX_TEXT_CHARS]
        except Exception:
            pass

    # ── 4. Last-resort: naïve tag stripping ────────────────────────────
    import re
    text = re.sub(r"<script[\s\S]*?</script>", " ", html_content, flags=re.I)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s{2,}", " ", text).strip()
    return text[:MAX_TEXT_CHARS]


def main():
    raw = sys.stdin.read().strip()
    if not raw:
        print("{}", flush=True)
        return

    try:
        urls = json.loads(raw)
    except json.JSONDecodeError as exc:
        sys.stderr.write(f"[trafilatura_extract] Invalid JSON input: {exc}\n")
        print("{}", flush=True)
        return

    if not isinstance(urls, list):
        sys.stderr.write("[trafilatura_extract] Input must be a JSON array of URLs\n")
        print("{}", flush=True)
        return

    result: dict[str, str] = {}
    for url in urls:
        if not isinstance(url, str):
            continue
        try:
            text = fetch_and_extract(url)
            result[url] = text
            char_count = len(text)
            word_count = len(text.split()) if text else 0
            sys.stderr.write(
                f"[trafilatura_extract] {url[:60]!r}  →  {char_count} chars / {word_count} words\n"
            )
        except Exception as exc:
            sys.stderr.write(f"[trafilatura_extract] ERROR for {url}: {exc}\n")
            result[url] = ""

    print(json.dumps(result, ensure_ascii=False), flush=True)


if __name__ == "__main__":
    main()
