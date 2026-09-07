# /// script
# requires-python = ">=3.12"
# dependencies = []
# ///
"""
Export the reveal.js talk as a standalone HTML file and a PDF.

Usage
-----
    uv run scripts/export.py                 # both exports into dist/
    uv run scripts/export.py --html          # standalone HTML only
    uv run scripts/export.py --pdf           # PDF (+ notes.md) only
    uv run scripts/export.py --out /tmp/x    # write somewhere else
    uv run scripts/export.py --no-verify     # skip the headless-Chrome check of the HTML
    uv run scripts/export.py --self-test     # run the built-in unit checks and exit

Outputs (default `dist/`, gitignored)
--------------------------------------
    hf-incident-talk.html       one self-contained file: reveal, theme, deck CSS,
                                fonts and scripts inlined; each scene page (with
                                its own CSS/JS/fonts inlined) is embedded once and
                                served to its iframes as a blob: URL at startup.
                                Double-click it anywhere.
    hf-incident-talk.pdf        one page per slide. Scene slides are replaced by
                                a screenshot of the scene at its final beat.
    hf-incident-talk-notes.md   the speaker notes, one heading per slide.

How it works
------------
Standalone HTML: index.html is tokenised (comments, <script>/<style>/<iframe>
blocks, tags). `<link rel="stylesheet">` becomes `<style>` with `@import` and
`url()` references resolved recursively (fonts as data:font/woff2;base64,…);
`<script src>` becomes an inline script (with `</script` escaped as `<\\/script`);
`<img>`/`<video>`/`<source>` and icon links become data URIs. Scene iframes
(`<iframe data-scene data-src="0N-x.html?embed=1">`; `src` is handled too)
are left exactly as written. Each distinct scene page, inlined the same way,
is embedded once in a `<script type="application/json">` block (every `<`
written as \\u003c, so nothing inside can close the block), and a small
bootstrap script turns each block into a blob: URL and rewrites the iframes'
(data-)src to it before Reveal.initialize runs. reveal.js then lazy-loads and
unloads the scenes exactly as it does when served (viewDistance), which
matters: scenes measure their viewport when they boot, and 04-wipe-return
throws if it boots inside a hidden 0x0 iframe, which is what an always-loaded
`srcdoc` iframe would do. Embed mode needs no injection: shared/scene.js
treats `window.parent !== window` as embedded.

PDF: the repo is served on a random localhost port with http.server (file://
print mode misbehaves). For each scene iframe, headless Chrome screenshots the
scene standalone at its last beat (`--scene-beat FILE=N` if given, else
`data-end` on the iframe, else a literal `beats: N` in the scene, else
`?beat=9999`, which scene.js clamps to the last beat). A temporary print copy
of the deck (fully inlined, scene iframes replaced by `<img>` data URIs) is
written to the output directory, printed with `?print-pdf`, then deleted. The
page count and page size are checked and printed.

Headless Chrome prints as soon as the page's `load` event fires, but reveal's
print view lays its pages out asynchronously *after* `load`, so a plain
`--print-to-pdf` races it (one page, or 86 US-letter pages, depending on how
far it got). The print copy therefore carries two small additions: a 1x1
<img> whose response the local server withholds until the page reports
reveal's `pdf-ready` event (this holds `load` back), and a head script that
fires reveal's own `load` listeners at DOMContentLoaded instead (reveal
starts the print view from `load`, which would otherwise deadlock with the
hold) and routes requestAnimationFrame through timers (headless Chrome emits
few frames while printing). Both live only in the throwaway print copy.

Chrome itself is not trusted to exit: some builds finish the screenshot/PDF
and then hang, so the runner watches the artefact (PNG IEND / PDF %%EOF, or
`</html>` in a DOM dump) and terminates the process group, with the timeout
as backstop.

Requirements: `uv` and Google Chrome (or `google-chrome`/`chromium` on PATH)
for the PDF and for the verification step. Standard library only.
"""

from __future__ import annotations

import argparse
import base64
import html
import json
import mimetypes
import os
import re
import shutil
import socketserver
import subprocess
import sys
import tempfile
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from functools import partial
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path, PurePosixPath
from typing import Literal
from urllib.parse import unquote

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

CHROME_FLAGS = [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-extensions",
    "--disable-sync",
    "--mute-audio",
]
CHROME_CANDIDATES = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "google-chrome",
    "google-chrome-stable",
    "chromium",
    "chromium-browser",
]
CHROME_TIMEOUT = 120  # seconds, per subprocess call
VIRTUAL_TIME_BUDGET_MS = 6000
SCREENSHOT_SIZE = (1920, 1080)
FALLBACK_LAST_BEAT = 9999  # scene.js clamps ?beat= to beats-1

VOID_ELEMENTS = frozenset(
    "area base br col embed hr img input link meta source track wbr".split()
)
MIME_OVERRIDES = {
    ".woff2": "font/woff2",
    ".woff": "font/woff",
    ".ttf": "font/ttf",
    ".otf": "font/otf",
    ".svg": "image/svg+xml",
    ".js": "text/javascript",
    ".mjs": "text/javascript",
    ".css": "text/css",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".html": "text/html",
}

# ---------------------------------------------------------------------------
# HTML tokeniser (regex based, preserves the source byte-for-byte elsewhere)
# ---------------------------------------------------------------------------

_ATTRS = r"""(?:\s+[^\s"'>/=]+(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s"'=<>`]+))?)*"""
TOKEN_RE = re.compile(
    rf"(?P<comment><!--.*?-->)"
    rf"|(?P<block><(?P<bname>script|style|iframe)\b(?P<battrs>{_ATTRS})\s*>(?P<bbody>.*?)</(?P=bname)\s*>)"
    rf"|(?P<tag><(?P<close>/?)(?P<name>[a-zA-Z][\w:-]*)(?P<attrs>{_ATTRS})\s*(?P<selfclose>/?)>)",
    re.S | re.I,
)
ATTR_RE = re.compile(r"""([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?""")


@dataclass(frozen=True)
class Attr:
    name: str
    value: str | None  # None = bare attribute


def parse_attrs(text: str) -> list[Attr]:
    out: list[Attr] = []
    for m in ATTR_RE.finditer(text):
        name = m.group(1)
        raw = next((g for g in m.groups()[1:] if g is not None), None)
        out.append(Attr(name, html.unescape(raw) if raw is not None else None))
    return out


def attr_get(attrs: list[Attr], name: str) -> str | None:
    for a in attrs:
        if a.name.lower() == name.lower():
            return a.value
    return None


def attr_has(attrs: list[Attr], name: str) -> bool:
    return any(a.name.lower() == name.lower() for a in attrs)


def serialise_tag(name: str, attrs: list[Attr]) -> str:
    parts = [name]
    for a in attrs:
        if a.value is None:
            parts.append(a.name)
        else:
            parts.append(f'{a.name}="{html.escape(a.value, quote=True)}"')
    return "<" + " ".join(parts) + ">"


def ascii_js(js: str) -> str:
    """Rewrite every non-ASCII character as a \\uXXXX escape (a surrogate pair
    above U+FFFF). Identical meaning inside string, template and regex
    literals, identifiers and comments; the one place it would differ is a
    non-ASCII character used as whitespace between tokens, which minifiers do
    not emit."""

    def esc(ch: str) -> str:
        cp = ord(ch)
        if cp < 0x80:
            return ch
        if cp <= 0xFFFF:
            return f"\\u{cp:04x}"
        cp -= 0x10000
        return f"\\u{0xD800 + (cp >> 10):04x}\\u{0xDC00 + (cp & 0x3FF):04x}"

    return "".join(esc(c) for c in js) if not js.isascii() else js


def escape_script_content(js: str, origin: str, warn: Callable[[str], None]) -> str:
    """Make JS safe to sit inside a <script> element.

    `</script` inside any JS string/regex/template literal is rewritten as
    `<\\/script`, which is the same value in all three. `<!--` followed by
    `<script` before a `-->` would put the HTML tokeniser into the
    "double escaped" state; we cannot rewrite that safely, so we only warn.
    """
    js = re.sub(r"</(script)", r"<\\/\1", js, flags=re.I)
    # Pure ASCII. Chrome 152's streaming compiler was seen to reject the
    # inlined notes.js intermittently ("Invalid or unexpected token" at the
    # start of a long string holding en dashes and curly quotes), whether the
    # script arrived inline, as a data: URL or from file://. \\uXXXX escapes mean
    # the same thing in string, template and regex literals, identifiers and
    # comments, so this is a no-op for the program and removes the hazard.
    js = ascii_js(js)
    for m in re.finditer(r"<!--", js):
        rest = js[m.end():]
        close = rest.find("-->")
        segment = rest if close < 0 else rest[:close]
        if re.search(r"<script", segment, re.I):
            warn(f"{origin}: '<!--' followed by '<script' before '-->' — inline script may parse oddly")
    return js


# ---------------------------------------------------------------------------
# Asset inliner
# ---------------------------------------------------------------------------

CSS_IMPORT_RE = re.compile(
    r"""@import\s+(?:url\(\s*(?P<q1>['"]?)(?P<u1>[^'")]+)(?P=q1)\s*\)|(?P<q2>['"])(?P<u2>[^'"]+)(?P=q2))\s*(?P<media>[^;]*);""",
    re.I,
)
CSS_URL_RE = re.compile(r"""url\(\s*(?P<q>['"]?)(?P<u>[^'")]+)(?P=q)\s*\)""", re.I)

IframeHandler = Callable[[list[Attr], Path, str], str | None]
"""(iframe attrs, resolved scene path, original ref) -> replacement HTML, or None to keep the tag."""


def is_external(ref: str) -> bool:
    r = ref.strip().lower()
    return r.startswith(("data:", "http:", "https:", "//", "blob:", "javascript:", "about:", "mailto:", "#"))


def mime_for(path: Path) -> str:
    if path.suffix.lower() in MIME_OVERRIDES:
        return MIME_OVERRIDES[path.suffix.lower()]
    guess, _ = mimetypes.guess_type(path.name)
    return guess or "application/octet-stream"


class Inliner:
    def __init__(self, root: Path, warn: Callable[[str], None]) -> None:
        self.root = root.resolve()
        self.warn = warn
        self._cache: dict[Path, bytes] = {}
        self.inlined: list[tuple[str, int]] = []  # (relative path, bytes) for reporting

    # -- files ---------------------------------------------------------------

    def read_bytes(self, path: Path) -> bytes:
        path = path.resolve()
        if path not in self._cache:
            self._cache[path] = path.read_bytes()
            self.inlined.append((str(path.relative_to(self.root)) if path.is_relative_to(self.root) else str(path), len(self._cache[path])))
        return self._cache[path]

    def read_text(self, path: Path) -> str:
        return self.read_bytes(path).decode("utf-8")

    def resolve(self, ref: str, base_dir: Path) -> Path | None:
        """Resolve a relative reference (query/fragment stripped) to a file, or None."""
        if is_external(ref):
            return None
        clean = unquote(re.split(r"[?#]", ref.strip(), maxsplit=1)[0])
        if not clean:
            return None
        target = (self.root / clean.lstrip("/")) if clean.startswith("/") else (base_dir / clean)
        target = target.resolve()
        if not target.is_file():
            self.warn(f"missing file: {ref!r} (looked at {target})")
            return None
        return target

    def data_uri(self, path: Path) -> str:
        return f"data:{mime_for(path)};base64,{base64.b64encode(self.read_bytes(path)).decode('ascii')}"

    # -- CSS -----------------------------------------------------------------

    def inline_css(self, css: str, base_dir: Path, depth: int = 0) -> str:
        if depth > 10:
            self.warn("CSS @import nesting too deep; stopping")
            return css

        def repl_import(m: re.Match[str]) -> str:
            ref = m.group("u1") or m.group("u2")
            path = self.resolve(ref, base_dir)
            if path is None:
                return m.group(0)
            inner = self.inline_css(self.read_text(path), path.parent, depth + 1)
            media = (m.group("media") or "").strip()
            body = f"/* @import {ref} */\n{inner}\n"
            return f"@media {media} {{\n{body}}}\n" if media else body

        css = CSS_IMPORT_RE.sub(repl_import, css)

        def repl_url(m: re.Match[str]) -> str:
            ref = m.group("u")
            path = self.resolve(ref, base_dir)
            if path is None:
                return m.group(0)
            return f"url({self.data_uri(path)})"

        return CSS_URL_RE.sub(repl_url, css)

    # -- HTML ----------------------------------------------------------------

    def inline_html(self, page: Path, iframe_handler: IframeHandler | None) -> str:
        """Return `page` with local CSS/JS/media inlined. Iframes with a local
        HTML target go through `iframe_handler` (left alone when None)."""
        src = self.read_text(page)
        base_dir = page.parent
        out: list[str] = []
        pos = 0
        for m in TOKEN_RE.finditer(src):
            out.append(src[pos : m.start()])
            pos = m.end()
            if m.group("comment"):
                out.append(m.group(0))
            elif m.group("block"):
                out.append(self._rewrite_block(m, base_dir, iframe_handler, page))
            else:
                out.append(self._rewrite_tag(m, base_dir, page))
        out.append(src[pos:])
        return "".join(out)

    def _rewrite_block(self, m: re.Match[str], base_dir: Path, iframe_handler: IframeHandler | None, page: Path) -> str:
        name = m.group("bname").lower()
        attrs = parse_attrs(m.group("battrs"))
        body = m.group("bbody")
        if name == "script":
            ref = attr_get(attrs, "src")
            if ref is None or is_external(ref):
                return m.group(0)
            path = self.resolve(ref, base_dir)
            if path is None:
                return m.group(0)
            if (attr_get(attrs, "type") or "").lower() == "module":
                self.warn(f"{ref}: module script inlined; relative imports inside it will break")
            js = escape_script_content(self.read_text(path), ref, self.warn)
            kept = [a for a in attrs if a.name.lower() != "src"]
            return f"{serialise_tag('script', kept)}\n/* inlined: {ref} */\n{js}\n</script>"
        if name == "style":
            return f"{serialise_tag('style', attrs)}{self.inline_css(body, base_dir)}</style>"
        # iframe
        if iframe_handler is None:
            return m.group(0)
        ref = attr_get(attrs, "src") or attr_get(attrs, "data-src")
        if ref is None or is_external(ref):
            return m.group(0)
        path = self.resolve(ref, base_dir)
        if path is None or path.suffix.lower() not in (".html", ".htm"):
            return m.group(0)
        replacement = iframe_handler(attrs, path, ref)
        return m.group(0) if replacement is None else replacement

    def _rewrite_tag(self, m: re.Match[str], base_dir: Path, page: Path) -> str:
        if m.group("close"):
            return m.group(0)
        name = m.group("name").lower()
        attrs = parse_attrs(m.group("attrs"))
        if name == "link":
            rel = (attr_get(attrs, "rel") or "").lower().split()
            href = attr_get(attrs, "href")
            if href is None or is_external(href):
                return m.group(0)
            if "stylesheet" in rel:
                path = self.resolve(href, base_dir)
                if path is None:
                    return m.group(0)
                css = self.inline_css(self.read_text(path), path.parent)
                style_attrs = [a for a in attrs if a.name.lower() in ("media", "title", "id")]
                return f"{serialise_tag('style', style_attrs)}\n/* inlined: {href} */\n{css}\n</style>"
            if "icon" in rel or "apple-touch-icon" in rel:
                return self._with_data_attr(name, attrs, "href", href, base_dir) or m.group(0)
            if any(r in rel for r in ("preload", "prefetch", "modulepreload")):
                return f"<!-- dropped {html.escape(m.group(0))} -->"
            return m.group(0)
        if name in ("img", "video", "audio", "source", "track", "embed"):
            for attr_name in ("src", "data-src", "poster"):
                ref = attr_get(attrs, attr_name)
                if ref is not None and not is_external(ref):
                    rewritten = self._with_data_attr(name, attrs, attr_name, ref, base_dir)
                    if rewritten:
                        attrs = parse_attrs(rewritten[len(name) + 1 : -1])  # re-parse to chain further attrs
            if attr_has(attrs, "srcset"):
                self.warn(f"<{name} srcset> left as-is (not inlined)")
            return serialise_tag(name, attrs) if attrs else m.group(0)
        return m.group(0)

    def _with_data_attr(self, name: str, attrs: list[Attr], attr_name: str, ref: str, base_dir: Path) -> str | None:
        path = self.resolve(ref, base_dir)
        if path is None:
            return None
        if path.stat().st_size > 8 * 1024 * 1024:
            self.warn(f"{ref}: {path.stat().st_size / 1e6:.1f} MB inlined as a data URI; the output will be large")
        new_attrs = [Attr(a.name, self.data_uri(path)) if a.name.lower() == attr_name.lower() else a for a in attrs]
        return serialise_tag(name, new_attrs)


# ---------------------------------------------------------------------------
# Slide model (parsed from the deck's source, not from the inlined output)
# ---------------------------------------------------------------------------


@dataclass
class SceneRef:
    ref: str  # original (data-)src value
    path: Path  # resolved scene file
    attrs: list[Attr]


@dataclass
class Slide:
    number: int  # 1-based, in reveal order
    index_h: int
    index_v: int | None
    attrs: list[Attr]
    raw: str  # inner HTML of the <section>
    scenes: list[SceneRef] = field(default_factory=list)

    @property
    def hash(self) -> str:
        return f"#/{self.index_h}" if self.index_v is None else f"#/{self.index_h}/{self.index_v}"


class _TextExtractor(HTMLParser):
    BLOCK = frozenset("p div li ul ol blockquote h1 h2 h3 h4 h5 h6 br tr section aside pre".split())

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in self.BLOCK:
            self.parts.append("\n\n" if tag == "p" else "\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self.BLOCK:
            self.parts.append("\n\n" if tag == "p" else "\n")

    def handle_data(self, data: str) -> None:
        self.parts.append(data)


def html_to_text(fragment: str) -> str:
    """Visible text of an HTML fragment: paragraphs separated by blank lines."""
    fragment = re.sub(r"<!--.*?-->", "", fragment, flags=re.S)
    p = _TextExtractor()
    p.feed(fragment)
    p.close()
    text = "".join(p.parts)
    lines = [re.sub(r"[ \t\r\f\v]+", " ", ln).strip() for ln in text.split("\n")]
    out = "\n".join(lines)
    out = re.sub(r"\n{3,}", "\n\n", out)
    return out.strip()


NOTES_RE = re.compile(r"""<aside\b[^>]*\bclass\s*=\s*["'][^"']*\bnotes\b[^"']*["'][^>]*>(.*?)</aside\s*>""", re.S | re.I)


def slide_notes(slide: Slide) -> str:
    return "\n\n".join(html_to_text(m.group(1)) for m in NOTES_RE.finditer(slide.raw)).strip()


def slide_main_text(slide: Slide, limit: int = 110) -> str:
    body = NOTES_RE.sub("", slide.raw)
    body = re.sub(r"<!--.*?-->", "", body, flags=re.S)
    for tag in ("h1", "h2", "h3", "h4", "blockquote", "p"):
        m = re.search(rf"<{tag}\b[^>]*>(.*?)</{tag}\s*>", body, re.S | re.I)
        if m:
            text = " ".join(html_to_text(m.group(1)).split())
            if text:
                return text if len(text) <= limit else text[: limit - 1].rstrip() + "…"
    if slide.scenes:
        return "Scene: " + ", ".join(s.path.name for s in slide.scenes)
    return "(no text)"


def parse_slides(index_html: str, base_dir: Path, inliner: Inliner) -> list[Slide]:
    """Find <div class="slides"> and return its leaf <section>s in reveal order."""
    tokens = list(TOKEN_RE.finditer(index_html))
    slides_start = None
    for m in tokens:
        if m.group("tag") and not m.group("close") and m.group("name").lower() == "div":
            cls = (attr_get(parse_attrs(m.group("attrs")), "class") or "").split()
            if "slides" in cls:
                slides_start = m
                break
    if slides_start is None:
        raise SystemExit("index.html: no <div class=\"slides\"> found")

    # Walk tags after .slides open, tracking depth; collect <section> spans.
    depth = 0
    stack: list[tuple[int, int, list[Attr], int]] = []  # (depth, content_start, attrs, open_tag_start)
    sections: list[tuple[int, int, int, list[Attr]]] = []  # (depth, content_start, content_end, attrs)
    for m in tokens:
        if m.start() < slides_start.end():
            continue
        if m.group("comment"):
            continue
        if m.group("block"):
            continue  # script/style/iframe blocks are opaque
        name = m.group("name").lower()
        if m.group("close"):
            depth -= 1
            if depth < 0:
                break  # closed the .slides div
            if name == "section" and stack and stack[-1][0] == depth:
                d, cstart, attrs, _ = stack.pop()
                sections.append((d, cstart, m.start(), attrs))
            continue
        if name in VOID_ELEMENTS or m.group("selfclose"):
            continue
        if name == "section":
            stack.append((depth, m.end(), parse_attrs(m.group("attrs")), m.start()))
        depth += 1

    sections.sort(key=lambda s: s[1])
    # Leaves = sections that contain no other section.
    spans = [(s[1], s[2]) for s in sections]

    def has_child(i: int) -> bool:
        a, b = spans[i]
        return any(j != i and a < spans[j][0] and spans[j][1] < b for j in range(len(spans)))

    top_level = [s for s in sections if s[0] == 0]
    slides: list[Slide] = []
    for h, top in enumerate(top_level):
        children = [s for s in sections if s[0] == 1 and top[1] < s[1] and s[2] < top[2]]
        leaves = children if children else [top]
        for v, leaf in enumerate(leaves):
            attrs = leaf[3]
            if (attr_get(attrs, "data-visibility") or "").lower() == "hidden":
                continue
            raw = index_html[leaf[1] : leaf[2]]
            slide = Slide(len(slides) + 1, h, v if children else None, attrs, raw)
            slide.scenes = find_scene_refs(raw, base_dir, inliner)
            slides.append(slide)
    return slides


def find_scene_refs(fragment: str, base_dir: Path, inliner: Inliner) -> list[SceneRef]:
    refs: list[SceneRef] = []
    for m in TOKEN_RE.finditer(fragment):
        if not m.group("block") or m.group("bname").lower() != "iframe":
            continue
        attrs = parse_attrs(m.group("battrs"))
        ref = attr_get(attrs, "src") or attr_get(attrs, "data-src")
        if ref is None or is_external(ref):
            continue
        path = inliner.resolve(ref, base_dir)
        if path is not None and path.suffix.lower() in (".html", ".htm"):
            refs.append(SceneRef(ref, path, attrs))
    return refs


# ---------------------------------------------------------------------------
# Beats
# ---------------------------------------------------------------------------


# Scenes whose last beat is plain black by design; the PDF shows the beat
# before it instead (the lone 0; the paper before the light goes out).
# --scene-beat FILE=N still overrides these.
DEFAULT_SCENE_BEATS: dict[str, int] = {"03-silence.html": 3, "06-sacrifice.html": 2}


@dataclass(frozen=True)
class BeatChoice:
    beat: int
    method: Literal["override", "data-end", "beats-literal", "clamped"]


def last_beat_for(scene: SceneRef, inliner: Inliner, overrides: dict[str, int] | None = None) -> BeatChoice:
    """Which beat to screenshot for a scene iframe: --scene-beat override,
    else the iframe's data-end, else a literal `beats: N` in the scene (N-1),
    else a huge number that scene.js clamps to the last beat."""
    if overrides and scene.path.name in overrides:
        return BeatChoice(overrides[scene.path.name], "override")
    if scene.path.name in DEFAULT_SCENE_BEATS and attr_get(scene.attrs, "data-end") is None:
        return BeatChoice(DEFAULT_SCENE_BEATS[scene.path.name], "override")
    end = attr_get(scene.attrs, "data-end")
    if end is not None and end.strip().isdigit():
        return BeatChoice(int(end), "data-end")
    m = re.search(r"\bbeats\s*:\s*(\d+)\b", inliner.read_text(scene.path))
    if m:
        return BeatChoice(max(0, int(m.group(1)) - 1), "beats-literal")
    return BeatChoice(FALLBACK_LAST_BEAT, "clamped")


# ---------------------------------------------------------------------------
# Chrome
# ---------------------------------------------------------------------------


def find_chrome() -> str | None:
    for cand in CHROME_CANDIDATES:
        if "/" in cand:
            if Path(cand).is_file():
                return cand
        elif (found := shutil.which(cand)):
            return found
    return None


def require_chrome() -> str:
    chrome = find_chrome()
    if chrome is None:
        raise SystemExit(
            "Google Chrome not found. Looked for:\n  " + "\n  ".join(CHROME_CANDIDATES) + "\nInstall Chrome or put chromium on PATH."
        )
    return chrome


@dataclass
class ChromeResult:
    stdout: str
    stderr: str
    exited: bool  # False when we had to terminate it after the artefact was complete


def _artefact_complete(path: Path) -> bool:
    """True once a --screenshot PNG or --print-to-pdf file has been fully written."""
    if not path.is_file():
        return False
    try:
        with path.open("rb") as fh:
            fh.seek(0, 2)
            size = fh.tell()
            if size < 16:
                return False
            fh.seek(max(0, size - 64))
            tail = fh.read()
    except OSError:
        return False
    if path.suffix.lower() == ".png":
        return tail.endswith(b"IEND\xaeB`\x82")
    if path.suffix.lower() == ".pdf":
        return b"%%EOF" in tail
    return True


def run_chrome(
    chrome: str,
    args: list[str],
    *,
    output: Path | None = None,
    dump_dom: bool = False,
    timeout: int = CHROME_TIMEOUT,
) -> ChromeResult:
    """Run headless Chrome with a hard timeout.

    Chrome is not relied upon to exit by itself: some builds (Chrome 152 on
    macOS, for one) write the screenshot/PDF/DOM and then sit there. So we
    watch for the artefact — `output` fully written, or `</html>` at the end
    of the dumped DOM — and then terminate the whole process group. `timeout`
    is the backstop in every case.
    """
    import signal

    with tempfile.TemporaryDirectory(prefix="hf-export-chrome-") as profile:
        cmd = [chrome, *CHROME_FLAGS, f"--user-data-dir={profile}", *args]
        proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, start_new_session=True)
        out_buf, err_buf = bytearray(), bytearray()
        lock = threading.Lock()

        def pump(stream, buf: bytearray) -> None:  # type: ignore[no-untyped-def]
            fd = stream.fileno()
            # os.read returns whatever is available; BufferedReader.read(n) would
            # block until n bytes arrive and hide the tail of the DOM dump.
            for chunk in iter(lambda: os.read(fd, 65536), b""):
                with lock:
                    buf.extend(chunk)

        threads = [threading.Thread(target=pump, args=(proc.stdout, out_buf), daemon=True), threading.Thread(target=pump, args=(proc.stderr, err_buf), daemon=True)]
        for t in threads:
            t.start()

        deadline = time.monotonic() + timeout
        exited = False
        finished = False
        stable_since: float | None = None
        last_size = -1
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                exited = finished = True
                break
            if output is not None and _artefact_complete(output):
                size = output.stat().st_size
                if size != last_size:
                    last_size, stable_since = size, time.monotonic()
                elif stable_since is not None and time.monotonic() - stable_since > 0.75:
                    finished = True
                    break
            elif dump_dom:
                with lock:
                    tail = bytes(out_buf[-200:]).rstrip()
                if tail.endswith(b"</html>"):
                    finished = True
                    break
            time.sleep(0.25)

        if proc.poll() is None:
            try:
                os.killpg(proc.pid, signal.SIGTERM)
                proc.wait(timeout=5)
            except (ProcessLookupError, subprocess.TimeoutExpired):
                try:
                    os.killpg(proc.pid, signal.SIGKILL)
                except ProcessLookupError:
                    pass
                proc.wait(timeout=5)
        for t in threads:
            t.join(timeout=5)
        result = ChromeResult(bytes(out_buf).decode("utf-8", "replace"), bytes(err_buf).decode("utf-8", "replace"), exited)
        if not finished:
            what = f"writing {output.name}" if output else ("dumping the DOM" if dump_dom else "running")
            raise SystemExit(f"Chrome timed out after {timeout}s while {what}: {' '.join(args)}\n{result.stderr[-1500:]}")
        return result


# ---------------------------------------------------------------------------
# Local server
# ---------------------------------------------------------------------------


ONE_PIXEL_PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="
)
HOLD_PATH = "/__export__/hold"
RELEASE_PATH = "/__export__/release"
HOLD_TIMEOUT_S = 60


class _QuietHandler(SimpleHTTPRequestHandler):
    extra_mounts: dict[str, Path] = {}
    hold: threading.Event | None = None

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002 - stdlib signature
        pass

    def guess_type(self, path: str | os.PathLike[str]) -> str:
        # Say the charset explicitly: a multi-megabyte HTML response without one
        # leaves Chrome guessing from the first chunk, and the inlined scripts
        # contain non-ASCII characters.
        ctype = super().guess_type(path)
        if ctype.startswith(("text/", "application/javascript")) and "charset" not in ctype:
            ctype += "; charset=utf-8"
        return ctype

    def do_GET(self) -> None:
        """Two synchronisation endpoints besides static files: GET /__export__/hold
        answers with a 1x1 PNG only once /__export__/release has been hit (or
        after HOLD_TIMEOUT_S). A page that embeds <img src="/__export__/hold">
        therefore keeps its load event back until it says it is ready."""
        clean = self.path.split("?", 1)[0]
        if clean == RELEASE_PATH:
            if self.hold is not None:
                self.hold.set()
            self.send_response(204)
            self.end_headers()
            return
        if clean == HOLD_PATH:
            if self.hold is not None:
                self.hold.wait(HOLD_TIMEOUT_S)
            self.send_response(200)
            self.send_header("Content-Type", "image/png")
            self.send_header("Content-Length", str(len(ONE_PIXEL_PNG)))
            self.send_header("Cache-Control", "no-store")
            self.end_headers()
            self.wfile.write(ONE_PIXEL_PNG)
            return
        super().do_GET()

    def translate_path(self, path: str) -> str:
        clean = path.split("?", 1)[0].split("#", 1)[0]
        for prefix, directory in self.extra_mounts.items():
            if clean.startswith(prefix):
                rel = unquote(clean[len(prefix):]).lstrip("/")
                return str(directory / PurePosixPath(rel))
        return super().translate_path(path)


class LocalServer:
    """Serve `root` (and extra directories under `/__mount__/name/`) on a random port."""

    def __init__(self, root: Path, mounts: dict[str, Path] | None = None) -> None:
        self.hold = threading.Event()
        handler = type(
            "Handler",
            (_QuietHandler,),
            {"extra_mounts": {f"/__mount__/{k}/": v for k, v in (mounts or {}).items()}, "hold": self.hold},
        )
        self.httpd = ThreadingHTTPServer(("127.0.0.1", 0), partial(handler, directory=str(root)))
        self.port = self.httpd.server_address[1]
        self.thread = threading.Thread(target=self.httpd.serve_forever, daemon=True)

    def __enter__(self) -> LocalServer:
        self.thread.start()
        return self

    def __exit__(self, *exc: object) -> None:
        self.httpd.shutdown()
        self.httpd.server_close()

    def url(self, rel: str) -> str:
        return f"http://127.0.0.1:{self.port}/{rel.lstrip('/')}"


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------


SCENE_BOOTSTRAP = """
<script>
/* export.py: scene documents are embedded above as JSON. Turn each into a
   blob: URL and point the iframes' (data-)src at it, keeping any #fragment.
   reveal.js then lazy-loads and unloads them exactly as it does when served. */
(function () {
  'use strict';
  var map = __MAP__;            // attribute value as written -> scene key
  var urls = {};
  function urlFor(key) {
    if (!urls[key]) {
      var el = document.querySelector('script[type="application/json"][data-scene-doc="' + key + '"]');
      urls[key] = URL.createObjectURL(new Blob([JSON.parse(el.textContent)], { type: 'text/html' }));
    }
    return urls[key];
  }
  function rewrite() {
    var frames = document.querySelectorAll('iframe[data-src], iframe[src]');
    for (var i = 0; i < frames.length; i++) {
      var f = frames[i], attrs = ['data-src', 'src'];
      for (var k = 0; k < attrs.length; k++) {
        var v = f.getAttribute(attrs[k]);
        if (v === null || !Object.prototype.hasOwnProperty.call(map, v)) continue;
        var h = v.indexOf('#');
        f.setAttribute(attrs[k], urlFor(map[v]) + (h >= 0 ? v.slice(h) : ''));
      }
    }
  }
  rewrite();                                                   // iframes parsed so far
  document.addEventListener('DOMContentLoaded', rewrite);      // any that follow this script
})();
</script>
"""


def scene_doc_json(scene_html: str) -> str:
    """JSON text for a <script type="application/json"> block that can never
    close the element: every '<' is written as \\u003c, so the text contains
    no '<' at all (no '</script', no '<!--')."""
    text = json.dumps(scene_html)  # ensure_ascii: non-ASCII becomes \\uXXXX too
    return text.replace("<", "\\u003c")


def build_standalone(root: Path, index: Path, inliner: Inliner) -> tuple[str, dict[str, Path]]:
    """Inline the deck; scene iframes keep every attribute verbatim, and the
    scene documents (inlined themselves) are embedded once each plus a
    bootstrap that maps (data-)src values to blob: URLs at startup."""
    scenes: dict[str, Path] = {}  # key (path relative to the deck dir) -> file
    ref_map: dict[str, str] = {}  # attribute value as written -> key

    def collect(attrs: list[Attr], path: Path, ref: str) -> None:
        key = path.relative_to(index.parent).as_posix() if path.is_relative_to(index.parent) else path.name
        scenes[key] = path
        ref_map[ref] = key
        return None  # keep the tag untouched

    deck = inliner.inline_html(index, collect)
    if not scenes:
        return deck, scenes

    blocks = []
    for key, path in scenes.items():
        doc = inliner.inline_html(path, iframe_handler=None)
        blocks.append(f'<script type="application/json" data-scene-doc="{html.escape(key, quote=True)}">{scene_doc_json(doc)}</script>')
    bootstrap = SCENE_BOOTSTRAP.replace("__MAP__", json.dumps(ref_map).replace("<", "\\u003c"))
    injection = "\n<!-- export.py: embedded scene documents -->\n" + "\n".join(blocks) + bootstrap

    # Insert before the first <script after the last scene iframe (so the
    # iframes exist when the bootstrap runs, and it runs before Reveal.initialize).
    last_iframe = max((m.end() for m in TOKEN_RE.finditer(deck) if m.group("block") and m.group("bname").lower() == "iframe"), default=0)
    m = re.compile(r"<script\b", re.I).search(deck, last_iframe)
    at = m.start() if m else (deck.lower().rfind("</body>") if "</body>" in deck.lower() else len(deck))
    return deck[:at] + injection + "\n" + deck[at:], scenes


PRINT_HOLD = f"""
<!-- export.py: keep the load event back until reveal's print layout is done,
     so headless Chrome prints the laid-out pages rather than racing them. -->
<img src="{HOLD_PATH}" alt="" style="position:absolute;left:0;top:0;width:1px;height:1px;opacity:0">
<script>
(function () {{
  var done = false;
  function release() {{
    if (done) return; done = true;
    fetch('{RELEASE_PATH}', {{ cache: 'no-store' }}).catch(function () {{}});
  }}
  if (window.Reveal && Reveal.on) Reveal.on('pdf-ready', release);
  setTimeout(release, 20000);   // belt and braces: never hold for ever
}})();
</script>
"""


PRINT_RAF_SHIM = """
<script>
/* export.py (print copy only).
   1. reveal.js starts its print-view layout from the window `load` event, and
      this page holds `load` back until that layout is done (see the hold
      <img> at the end of the body). To avoid the deadlock, `load` listeners
      registered before DOMContentLoaded are collected here and fired once at
      DOMContentLoaded instead; the real `load` then only triggers Chrome's print.
   2. Headless Chrome produces few or no animation frames while printing, and
      the print layout awaits requestAnimationFrame several times; route rAF
      through timers, which do run. */
(function () {
  var pending = [];
  var realAdd = window.addEventListener;
  window.addEventListener = function (type, fn, opts) {
    if (type === 'load' && document.readyState === 'loading') { pending.push(fn); return; }
    return realAdd.call(window, type, fn, opts);
  };
  document.addEventListener('DOMContentLoaded', function () {
    window.addEventListener = realAdd;
    var ev = new Event('load');
    pending.splice(0).forEach(function (fn) {
      try { (typeof fn === 'function' ? fn : fn.handleEvent).call(window, ev); } catch (e) { console.error(e); }
    });
  });
  window.requestAnimationFrame = function (cb) { return setTimeout(function () { cb(performance.now()); }, 16); };
  window.cancelAnimationFrame = function (id) { clearTimeout(id); };
})();
</script>
"""


def with_print_hold(print_html: str) -> str:
    """Add the rAF shim at the top of <head> and the load-event hold before </body>."""
    m = re.search(r"<head\b[^>]*>", print_html, re.I)
    if m:
        print_html = print_html[: m.end()] + PRINT_RAF_SHIM + print_html[m.end() :]
    else:
        print_html = PRINT_RAF_SHIM + print_html
    at = print_html.lower().rfind("</body>")
    return print_html + PRINT_HOLD if at < 0 else print_html[:at] + PRINT_HOLD + print_html[at:]


def image_handler(images: dict[tuple[Path, int], bytes], inliner: Inliner, overrides: dict[str, int]) -> IframeHandler:
    def handler(attrs: list[Attr], path: Path, ref: str) -> str:
        choice = last_beat_for(SceneRef(ref, path, attrs), inliner, overrides)
        png = images[(path, choice.beat)]
        uri = "data:image/png;base64," + base64.b64encode(png).decode("ascii")
        alt = f"{path.name} at beat {choice.beat}"
        # Reveal's theme gives `section img` a margin, a 4px border and a shadow
        # and caps it at 95%; that would frame the picture and push the section
        # 20px over one page height, so those are zeroed here.
        style = (
            "position:absolute;inset:0;width:100%;height:100%;max-width:none;max-height:none;"
            "margin:0;padding:0;border:0;box-shadow:none;background:transparent;object-fit:contain"
        )
        return f'<img src="{uri}" alt="{html.escape(alt)}" style="{style}">'

    return handler


def export_html(root: Path, index: Path, out: Path, warn: Callable[[str], None]) -> Path:
    inliner = Inliner(root, warn)
    result, _scenes = build_standalone(root, index, inliner)
    out.write_text(result, encoding="utf-8")
    return out


def count_pdf_pages(pdf: bytes) -> int:
    n = len(re.findall(rb"/Type\s*/Page(?![s\w])", pdf))
    if n:
        return n
    m = re.search(rb"/Type\s*/Pages.*?/Count\s+(\d+)", pdf, re.S)
    return int(m.group(1)) if m else 0


def export_pdf(
    root: Path,
    index: Path,
    slides: list[Slide],
    out_pdf: Path,
    out_dir: Path,
    chrome: str,
    warn: Callable[[str], None],
    keep_pngs: bool,
    overrides: dict[str, int],
) -> tuple[int, str, dict[tuple[Path, int], int], dict[tuple[Path, int], BeatChoice]]:
    """Returns (page count, MediaBox of the first page, screenshot sizes, beat choices)."""
    inliner = Inliner(root, warn)
    # One screenshot per distinct (scene file, last beat). A scene shown on
    # several slides with different data-end values gets one picture per beat.
    wanted: dict[tuple[Path, int], BeatChoice] = {}
    for slide in slides:
        for s in slide.scenes:
            choice = last_beat_for(s, inliner, overrides)
            wanted.setdefault((s.path, choice.beat), choice)

    images: dict[tuple[Path, int], bytes] = {}
    sizes: dict[tuple[Path, int], int] = {}
    with LocalServer(root, mounts={"out": out_dir}) as server:
        for path, beat in wanted:
            rel = path.relative_to(root).as_posix()
            png = out_dir / f"{path.stem}-beat{beat}.png"
            png.unlink(missing_ok=True)  # a stale file would look "complete" straight away
            url = server.url(f"{rel}?beat={beat}")
            proc = run_chrome(
                chrome,
                [
                    f"--screenshot={png}",
                    f"--window-size={SCREENSHOT_SIZE[0]},{SCREENSHOT_SIZE[1]}",
                    f"--virtual-time-budget={VIRTUAL_TIME_BUDGET_MS}",
                    "--run-all-compositor-stages-before-draw",
                    url,
                ],
                output=png,
            )
            if not png.is_file():
                raise SystemExit(f"screenshot failed for {url}\n{proc.stderr[-2000:]}")
            data = png.read_bytes()
            images[(path, beat)] = data
            sizes[(path, beat)] = len(data)
            if len(data) < 20_000:
                warn(f"{png.name} is only {len(data)} bytes — probably blank")
            if not keep_pngs:
                png.unlink()

        tmp = out_dir / f".print-{int(time.time())}.html"
        try:
            print_html = with_print_hold(inliner.inline_html(index, image_handler(images, inliner, overrides)))
            tmp.write_text(print_html, encoding="utf-8")
            url = server.url(f"__mount__/out/{tmp.name}?print-pdf")
            out_pdf.unlink(missing_ok=True)
            server.hold.clear()
            # No virtual-time budget here: Chrome prints on `load`, and the
            # page holds `load` back until reveal fires pdf-ready (see PRINT_HOLD).
            proc = run_chrome(chrome, [f"--print-to-pdf={out_pdf}", "--no-pdf-header-footer", url], output=out_pdf)
            if not out_pdf.is_file():
                raise SystemExit(f"PDF print failed\n{proc.stderr[-2000:]}")
            if not server.hold.is_set():
                warn("the deck never reported pdf-ready; the PDF was printed after the hold timed out")
        finally:
            tmp.unlink(missing_ok=True)

    pdf = out_pdf.read_bytes()
    mb = re.search(rb"/MediaBox\s*\[([^\]]*)\]", pdf)
    return count_pdf_pages(pdf), (mb.group(1).decode("ascii", "replace").strip() if mb else "?"), sizes, wanted


def write_notes(slides: list[Slide], title: str, out: Path) -> Path:
    lines = [f"# {title} — speaker notes", ""]
    for s in slides:
        lines.append(f"## {s.number}. {slide_main_text(s)}  `{s.hash}`")
        if s.scenes:
            lines.append("")
            lines.append("_" + ", ".join(f"scene {x.path.name}" for x in s.scenes) + "_")
        notes = slide_notes(s)
        lines.append("")
        lines.append(notes if notes else "_(no notes)_")
        lines.append("")
    out.write_text("\n".join(lines).rstrip() + "\n", encoding="utf-8")
    return out


def deck_title(index_html: str) -> str:
    m = re.search(r"<title>(.*?)</title>", index_html, re.S | re.I)
    return html.unescape(m.group(1)).strip() if m else "Deck"


# ---------------------------------------------------------------------------
# Verification of the standalone HTML in headless Chrome
# ---------------------------------------------------------------------------


def verify_html(chrome: str, standalone: Path, slides: list[Slide], warn: Callable[[str], None]) -> list[str]:
    """Open the file via file:// on the first scene slide; report console
    errors, the slide count, and whether that scene booted and reported back
    (deck.js sets data-ready / data-beat on the iframe when it does)."""
    first_scene = next((s for s in slides if s.scenes), None)
    url = standalone.resolve().as_uri() + (first_scene.hash if first_scene else "")
    proc = run_chrome(
        chrome,
        ["--dump-dom", "--enable-logging=stderr", "--v=0", f"--virtual-time-budget={VIRTUAL_TIME_BUDGET_MS}", url],
        dump_dom=True,
    )
    problems: list[str] = []
    console = [ln for ln in proc.stderr.splitlines() if "CONSOLE" in ln]
    for ln in console:
        if "Uncaught" in ln or ":ERROR:CONSOLE" in ln:
            problems.append("console: " + ln.strip())
    dom = proc.stdout
    if not re.search(r'<div class="reveal[^"]*\bready\b', dom):
        problems.append("reveal did not reach the 'ready' state (no .reveal.ready in the DOM)")
    # Count slides in the live DOM. Script bodies (the inlined notes plugin
    # carries the speaker-view HTML as a string) and comments are stripped first.
    markup = re.sub(r"<script\b[^>]*>.*?</script\s*>|<!--.*?-->", "", dom, flags=re.S | re.I)
    m = re.search(r'<div class="slides"[^>]*>(.*)', markup, re.S)
    sections = len(re.findall(r"<section\b", m.group(1))) if m else 0
    if sections != len(slides):
        problems.append(f"DOM has {sections} <section> elements inside .slides, expected {len(slides)}")
    if first_scene:
        present = re.search(r'<section[^>]*\bclass="[^"]*\bpresent\b[^"]*"[^>]*>(.*?)</section>', dom, re.S)
        frame = re.search(r"<iframe\b[^>]*>", present.group(1)) if present else None
        if frame is None:
            problems.append(f"no iframe on the current slide ({first_scene.hash})")
        else:
            tag = frame.group(0)
            if 'src="blob:' not in tag:
                problems.append(f"current scene iframe has no blob: src: {tag[:200]}")
            if 'data-ready="1"' not in tag:
                problems.append(f"current scene did not post scene:ready: {tag[:200]}")
            if not re.search(r'data-beat="\d+"', tag):
                problems.append(f"current scene did not report a beat: {tag[:200]}")
    return problems


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------


def self_test() -> None:
    # 1. An embedded scene document cannot terminate its JSON <script> block:
    #    the JSON text contains no '<' at all, and round-trips exactly.
    scene = '<html><head><!-- c --><script>var s = "</script><script>alert(1)"; //</script></head><body>é — ·</body></html>'
    block = scene_doc_json(scene)
    assert "<" not in block and "</script" not in block and "<!--" not in block
    assert json.loads(block) == scene
    outer = f"<script>var deck = 1;</script><script type=\"application/json\">{block}</script><script>var after = 2;</script>"
    assert outer.count("</script>") == 3, outer  # only the three we wrote

    # 1b. srcdoc-style escaping would also be safe (kept as a reference check).
    tag = serialise_tag("iframe", [Attr("data-scene", None), Attr("srcdoc", scene)])
    assert "&lt;/script&gt;" in tag and "<" not in tag[len("<iframe") : -1]
    assert attr_get(parse_attrs(tag[len("<iframe") : -1]), "srcdoc") == scene

    # 2. Script content escaping.
    js = 'x = "</script>"; y = /<\\/script>/;'
    esc = escape_script_content(js, "t", lambda _m: None)
    assert "</script" not in esc and "<\\/script" in esc

    # 3. CSS import/url resolution against a temp tree.
    with tempfile.TemporaryDirectory() as d:
        root = Path(d)
        (root / "deck").mkdir()
        (root / "shared").mkdir()
        (root / "vendor").mkdir()
        (root / "vendor" / "f.woff2").write_bytes(b"\x00\x01wOF2")
        (root / "shared" / "fonts.css").write_text('@font-face{src:url("../vendor/f.woff2") format("woff2")}')
        (root / "deck" / "deck.css").write_text('@import url("../shared/fonts.css");\nbody{color:red}')
        inl = Inliner(root, lambda m: (_ for _ in ()).throw(AssertionError(m)))
        css = inl.inline_css((root / "deck" / "deck.css").read_text(), root / "deck")
        assert "data:font/woff2;base64," in css and "body{color:red}" in css and "@import" not in css.replace("/* @import", "")

        # 4. Slide parsing: leaves, hidden slides, vertical stacks, scenes.
        (root / "s.html").write_text("<html><body><script>Scene.create({beats: 5})</script></body></html>")
        index = (
            '<html><body><div class="reveal"><div class="slides">'
            "<!-- <section>commented out</section> -->"
            "<section><h2>One</h2><aside class=\"notes\"><p>n1</p><p>n2</p></aside></section>"
            "<section><section><p>Two-a</p></section><section><p>Two-b</p></section></section>"
            '<section data-visibility="hidden"><p>Hidden</p></section>'
            '<section class="scene"><iframe data-scene data-src="s.html?embed=1" allow="fullscreen"></iframe></section>'
            "</div></div><script>Reveal.initialize({})</script></body></html>"
        )
        (root / "index.html").write_text(index)
        slides = parse_slides(index, root, inl)
        assert [s.hash for s in slides] == ["#/0", "#/1/0", "#/1/1", "#/3"], [s.hash for s in slides]
        assert slide_notes(slides[0]) == "n1\n\nn2"
        assert slide_main_text(slides[0]) == "One"
        assert slides[3].scenes and slides[3].scenes[0].path.name == "s.html"
        assert last_beat_for(slides[3].scenes[0], inl) == BeatChoice(4, "beats-literal")
        assert last_beat_for(slides[3].scenes[0], inl, {"s.html": 2}) == BeatChoice(2, "override")
        # The print hold lands before the document's LAST </body> (notes.js carries a
        # literal "</body></html>" inside a string) and the shim goes right after <head>.
        doc = '<html><head><meta charset="utf-8"></head><body><script>var s = "</body></html>";</script><div></div></body></html>'
        held = with_print_hold(doc)
        assert held.index(HOLD_PATH) > held.index('var s = "</body></html>"'), held
        assert held.rindex("</body>") > held.index(HOLD_PATH) and RELEASE_PATH in held
        assert held.index("requestAnimationFrame") < held.index("<meta charset")
        assert with_print_hold("no body at all").endswith("</script>\n")
        # Standalone build keeps the iframe tag verbatim and embeds the scene once.
        out, scenes = build_standalone(root, root / "index.html", inl)
        assert list(scenes) == ["s.html"]
        assert '<iframe data-scene data-src="s.html?embed=1" allow="fullscreen"></iframe>' in out
        blocks = re.findall(r'<script type="application/json" data-scene-doc="([^"]+)">(.*?)</script>', out, re.S)
        assert [k for k, _ in blocks] == ["s.html"]
        assert "Scene.create" in json.loads(blocks[0][1])
        assert '"s.html?embed=1": "s.html"' in out  # ref map in the bootstrap
        assert out.index("data-scene-doc") > out.index("<iframe")  # embedded after the iframes
        assert out.index("URL.createObjectURL") < out.rindex("<script>")  # ...and before the last (deck) script

    # 5. PDF page counting.
    pdf = b"%PDF-1.4\n1 0 obj<</Type /Pages /Count 3>>endobj\n2 0 obj<</Type /Page>>endobj\n3 0 obj<</Type/Page>>endobj\n4 0 obj<</Type /Page>>endobj\n"
    assert count_pdf_pages(pdf) == 3
    print("self-test: all checks passed")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def human(n: int) -> str:
    return f"{n / 1_000_000:.2f} MB" if n >= 1_000_000 else f"{n / 1000:.0f} KB"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(
        prog="export.py",
        description="Export the reveal.js deck as a standalone HTML file and/or a PDF (+ speaker-notes markdown).",
        epilog=__doc__.split("How it works")[0],
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    ap.add_argument("--html", action="store_true", help="build the standalone HTML")
    ap.add_argument("--pdf", action="store_true", help="build the PDF and notes.md (needs Chrome)")
    ap.add_argument("--out", type=Path, default=None, help="output directory (default: <repo>/dist)")
    ap.add_argument("--root", type=Path, default=None, help="repo root (default: parent of scripts/)")
    ap.add_argument("--index", default="index.html", help="deck entry file, relative to root")
    ap.add_argument("--name", default="hf-incident-talk", help="output base name")
    ap.add_argument("--no-verify", action="store_true", help="skip loading the standalone HTML in headless Chrome")
    ap.add_argument("--keep-pngs", action="store_true", help="keep the per-scene screenshots in the output directory")
    ap.add_argument(
        "--scene-beat",
        action="append",
        default=[],
        metavar="FILE=N",
        help="screenshot this scene at beat N instead of its last beat, e.g. --scene-beat 03-silence.html=3 (repeatable)",
    )
    ap.add_argument("--self-test", action="store_true", help="run built-in checks and exit")
    args = ap.parse_args(argv)

    if args.self_test:
        self_test()
        return 0

    do_html = args.html or not (args.html or args.pdf)
    do_pdf = args.pdf or not (args.html or args.pdf)
    overrides: dict[str, int] = {}
    for item in args.scene_beat:
        name, sep, beat = item.partition("=")
        if not sep or not beat.strip().isdigit():
            raise SystemExit(f"--scene-beat expects FILE=N, got {item!r}")
        overrides[Path(name.strip()).name] = int(beat)

    root = (args.root or Path(__file__).resolve().parent.parent).resolve()
    out_dir = (args.out or root / "dist").resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    index = root / args.index
    if not index.is_file():
        raise SystemExit(f"not found: {index}")

    warnings: list[str] = []

    def warn(msg: str) -> None:
        warnings.append(msg)
        print(f"  warning: {msg}", file=sys.stderr)

    index_html = index.read_text(encoding="utf-8")
    inliner = Inliner(root, warn)
    slides = parse_slides(index_html, index.parent, inliner)
    scene_slides = [s for s in slides if s.scenes]
    title = deck_title(index_html)
    print(f"{title}: {len(slides)} slides, {len(scene_slides)} scene slides ({len({x.path for s in scene_slides for x in s.scenes})} distinct scenes)")

    chrome = find_chrome()

    if do_html:
        out_html = export_html(root, index, out_dir / f"{args.name}.html", warn)
        print(f"HTML  {out_html}  ({human(out_html.stat().st_size)})")
        if args.no_verify:
            pass
        elif chrome is None:
            print("  (Chrome not found; skipping verification)")
        else:
            problems = verify_html(chrome, out_html, slides, warn)
            if problems:
                for p in problems:
                    print(f"  VERIFY FAIL: {p}")
            else:
                print(f"  verified in headless Chrome: no console errors, {len(slides)} slides, reveal ready")

    notes_path = write_notes(slides, title, out_dir / f"{args.name}-notes.md")
    print(f"NOTES {notes_path}  ({human(notes_path.stat().st_size)})")

    exit_code = 0
    if do_pdf:
        if chrome is None:
            require_chrome()  # raises with the clear message
        assert chrome is not None
        out_pdf = out_dir / f"{args.name}.pdf"
        pages, mediabox, sizes, choices = export_pdf(root, index, slides, out_pdf, out_dir, chrome, warn, args.keep_pngs, overrides)
        print(f"PDF   {out_pdf}  ({human(out_pdf.stat().st_size)}), {pages} pages for {len(slides)} slides, page box [{mediabox}] pt", end="")
        if pages == len(slides):
            print("  OK")
        else:
            print("  MISMATCH")
            exit_code = 1
        if mediabox.split() == ["0", "0", "612", "792"]:
            warn("pages are US letter: reveal's print layout did not apply before Chrome printed")
            exit_code = 1
        for (path, beat), size in sizes.items():
            method = choices[(path, beat)].method
            print(f"  scene {path.name} @ beat {beat} ({method}): screenshot {human(size)}")
        if len(set(sizes.values())) < len(sizes):
            warn("two scene screenshots have identical byte sizes — check they are not blank")

    if warnings:
        print(f"{len(warnings)} warning(s)")
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
