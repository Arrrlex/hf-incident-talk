# The Hugging Face Incident — talk

## What this is

A 45-minute public talk for an AI Safety Berlin / Pause AI Berlin audience about the 2026 OpenAI / Hugging Face incident: roughly 1,200 AI agents that were meant to be isolated found a way to talk to each other, cheated their test, broke into a real company, and never told a human. The repo holds the slide deck (`index.html`, built on reveal.js), five standalone animated scenes that the deck embeds, the speaker notes (inside the deck), and the fact-check (`FACTS.md`) that every number, date and quote on a slide is drawn from. Everything is plain HTML, CSS and JavaScript with no build step and no network access at runtime, so it runs from a USB stick on an unknown laptop.

## How to run

Recommended: serve it locally, then open the deck in Chrome or another modern browser.

```sh
./serve.sh            # http://localhost:8765
```

Then go to <http://localhost:8765/index.html>. You can also open `index.html` directly as a file, and it should work, but some browsers apply stricter rules to `file://` pages (iframes, fonts), so serving is safer on the night.

- **S** opens the speaker view in a second window: current slide, next slide, notes, and a timer.
- **F** goes fullscreen.
- The scenes are also standalone pages you can open on their own, for rehearsal or as a fallback: `02-emergence.html`, `03-silence.html`, `04-wipe-return.html`, `05-escalation.html`, `06-sacrifice.html`. (`00-robot-test.html` is a test page for the robot component, not part of the talk.)

## Controls

Deck and scenes share one set of keys:

| Key | Action |
|---|---|
| Space, → | Next |
| ←, Backspace | Previous |
| R | Reset the current scene to its first beat |
| F | Toggle fullscreen |
| H | Toggle the scene's small HUD (scene name, beat number) |
| S | Speaker view (deck only) |
| Esc | Slide overview (deck only); also leaves fullscreen |

On a normal slide, Space moves to the next slide. On a scene slide, the deck hands the keys to the scene: each Space advances the scene one beat, and only when the scene has no more beats does the next Space move on to the next slide. Going backwards works the same way in reverse. Nothing ever advances on a timer; every step is a keypress.

## Rehearsal tips

- Slides have hash URLs: `index.html#/12` opens slide 12 directly, and the address bar updates as you move, so you can bookmark the start of each section.
- Scenes take `?beat=N` when opened standalone: `05-escalation.html?beat=3` opens the escalation meter already on rung 3. Useful for checking one beat without stepping through the others.
- Arriving on a scene slide by going forwards starts it at beat 0; arriving by going backwards puts it at its last beat, so stepping back through the deck looks right.
- The speaker view (S) shows the notes and the next slide. The notes are the script; the slides are cues.
- Open the deck at the venue's actual resolution once. It is designed at 1920×1080 and scales to fit, but a quick check of the quote slides at the real projector size is worth it.

## Fallbacks

Two ways to make sure a broken laptop or browser cannot break the talk.

### (a) PDF export of the deck

Open `index.html?print-pdf` in Chrome, then File → Print, destination "Save as PDF", landscape, margins none, background graphics on. This is reveal.js's standard print route. Scene slides come out as black frames in the PDF (they are live iframes), so pair the PDF with the recordings below.

### (b) MP4 recordings of each scene

Record each scene once, played through, so you can show a video if a scene misbehaves live. On macOS:

1. Open the scene standalone in the browser, e.g. `http://localhost:8765/02-emergence.html`.
2. Press **F** for fullscreen. Wait for it to settle on beat 0.
3. Press **Cmd+Shift+5**. In the toolbar that appears choose "Record Selected Window" or "Record Entire Screen", then click Record.
4. Step through the scene with **Space**, leaving a couple of seconds on each beat.
5. Click the stop button in the menu bar (or press Cmd+Control+Esc).
6. The file lands on the Desktop as `Screen Recording <date>.mov`. Move it into `recordings/` and rename it, e.g. `recordings/02-emergence.mov`. The `recordings/` folder is gitignored.

If `ffmpeg` is installed, convert to MP4 (smaller, plays in any browser):

```sh
ffmpeg -i recordings/02-emergence.mov -c:v libx264 -pix_fmt yuv420p -crf 18 -an recordings/02-emergence.mp4
```

To swap a recording in for a scene on the night, replace that scene's `<section>` in `index.html` with a video slide. The video will not auto-play (the deck disables that); press Space to start it, or click it.

```html
<section class="scene">
  <video src="recordings/02-emergence.mp4" controls preload="auto"
         style="position:absolute; inset:0; width:100%; height:100%; background:#0a0a0f;"></video>
  <aside class="notes">Recording of the Emergence scene. Space or click to play.</aside>
</section>
```

## Repo layout

- `index.html` — the deck (reveal.js). Slides plus speaker notes.
- `deck/deck.css` — deck styling on top of reveal's black theme.
- `02-emergence.html`, `03-silence.html`, `04-wipe-return.html`, `05-escalation.html`, `06-sacrifice.html` — the standalone scenes the deck embeds.
- `00-robot-test.html` — test page for the robot/light component.
- `shared/` — design system shared by deck and scenes: `tokens.css` (palette, type, motion), `fonts.css`, `robot.js` (the agent light, as a canvas field or an SVG figure), `scene.js` (beat controller, keys, deck bridge), `deck.js` (forwards keys from the deck to the current scene). `shared/README.md` documents the API and the postMessage protocol.
- `vendor/` — reveal.js 5.2.1 and the two fonts, copied in so nothing loads from the network.
- `FACTS.md` — the fact-check. Source of truth for everything on a slide.
- `OUTLINE.md` — the talk structure and minute budget.
- `BUILD_BRIEF.md` — the brief the visuals were built from.
- `research/sources/` — raw copies of every source FACTS.md cites.
- `recordings/` — MP4/MOV fallbacks (gitignored, make them yourself with the steps above).
- `serve.sh` — local server on port 8765.

## Editing facts

`FACTS.md` is the source of truth. Every number, date and quotation in the deck was taken from it, and each speaker note carries a tag like `[FACTS §7]` saying which section it came from. Quotations inside `<blockquote>` are verbatim from the sources and must not be paraphrased. If a fact needs changing, change `FACTS.md` first, then the slide. The raw source documents are saved in full under `research/sources/`, so a claim can be checked against the original without going online. HTML comments in `index.html` beginning `FACTS:` mark places where the outline's wording was softened to match the record; comments beginning `PRESENTER:` mark things still to fill in.

## Licences

Third-party files and their licences are listed in `vendor/README.md` (reveal.js under MIT; JetBrains Mono and Caveat under the SIL Open Font License 1.1).
