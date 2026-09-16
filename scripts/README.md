# scripts/

## export.py — standalone HTML and PDF

```sh
uv run scripts/export.py            # dist/hf-incident-talk.html + .pdf
uv run scripts/export.py --html     # just the standalone HTML
uv run scripts/export.py --pdf      # just the PDF
uv run scripts/export.py --pdf --scene-beat 03-silence.html=3 --scene-beat 06-sacrifice.html=1
uv run scripts/export.py --help     # all options (--out, --keep-pngs, --no-verify, --self-test)
```

Needs `uv` and Google Chrome (the PDF and the verification step run headless
Chrome; the HTML build alone needs neither). Output goes to `dist/`, which is
gitignored. The script reads whatever `index.html` and the scene pages contain
at run time; there is nothing to keep in sync when slides change. A full run
takes about a minute, most of it the 17 scene screenshots.

**Standalone HTML.** One file with reveal, the theme, `deck/deck.css`, the
fonts and all scripts inlined. Each scene page is embedded once (with its own
CSS, JS and fonts inlined) and handed to its iframes as a `blob:` URL when the
file opens, so reveal's lazy loading of scenes works exactly as it does when
served. Open it from a USB stick by double-clicking; `#/12` hash links and the scene
keys all work.
After building, the script opens the file in headless Chrome on the first
scene slide and checks for console errors, the slide count, and that the scene
booted and reported its beat to the deck.

**PDF.** One page per slide, 1920×1080. Scene slides are replaced by a
screenshot of the scene at its last beat: `--scene-beat FILE=N` if given,
else the iframe's `data-end`, else the scene's `beats:` count, else
`?beat=9999`, which scene.js clamps to the last beat. Two scenes end on a
deliberately black frame (03-silence beat 4, 06-sacrifice beat 3); pass
`--scene-beat` for those if you want a picture on the page. The persistent
timeline band along the bottom of the slides is not in the PDF: it is a
`position: fixed` element that reveal's print layout does not place. The page
count and page size are checked and printed. (The manual "open
`index.html?print-pdf` and print" route still works in a normal Chrome window;
the script exists because headless Chrome prints before reveal has laid the
pages out, and it adds a small synchronisation shim to a throwaway print copy
to get round that.)

`uv run scripts/export.py --self-test` runs the built-in checks (escaping of
embedded scene documents, CSS resolution, slide parsing, print-copy shims,
PDF page counting).
