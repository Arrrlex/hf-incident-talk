# The Hugging Face Incident — talk

## What this is

A 45-minute public talk for an AI Safety Berlin / Pause AI Berlin audience about the 2026 OpenAI / Hugging Face incident: roughly 1,200 AI agents that were meant to be isolated found a way to talk to each other, cheated their test, broke into a real company, and never told a human. The repo holds the slide deck (`index.html`, built on reveal.js), the standalone animated scenes that the deck embeds (four story scenes and two "meters" that climb one rung at a time through the talk), the speaker notes (inside the deck), and the fact-check (`FACTS.md`) that every number, date and quote on a slide is drawn from. Everything is plain HTML, CSS and JavaScript with no build step and no network access at runtime, so it runs from a USB stick on an unknown laptop.

## How to run

Recommended: serve it locally, then open the deck in Chrome or another modern browser.

```sh
./serve.sh            # http://localhost:8765
```

Then go to <http://localhost:8765/index.html>. You can also open `index.html` directly as a file, and it should work, but some browsers apply stricter rules to `file://` pages (iframes, fonts), so serving is safer on the night.

- **S** opens the speaker view in a second window: current slide, next slide, notes, and a timer.
- **F** goes fullscreen.
- The scenes are also standalone pages you can open on their own, for rehearsal or as a fallback: `02-emergence.html`, `03-silence.html`, `04-wipe-return.html`, `06-sacrifice.html`, and the two meters `05-escalation.html` and `08-awareness.html`. (`07-timeline.html` previews the timeline band on its own; `00-robot-test.html` is a test page for the robot component. Neither is a slide in the talk.)

## How the deck is put together

- **Running order.** Title → about Alex → introduction → what we know → agent basics → the German wiki → civilisation one → civilisation two → civilisation three → warning shot and the future → Q&A → end. The network scenes recur as communication develops. See OUTLINE.md.
- **Timeline band.** A thin timeline runs along the bottom 180px from the wiki section onwards, except the end slide (`shared/timeline.js`, mounted by `shared/deck.js`). The first slide of each phase carries `data-tl="id,id,…"` naming the items to light; the nearest preceding `data-tl` applies to the slides after it, and the last id is the current one (marker). The German wiki sits above the main timeline, sharing the same date axis. Ids: `wiki`, `board1`, `wipe1`, `board2`, `death`, `hf-disclose`, `board3`, `shutdown`, `oai-disclose`. `class="no-timeline"` on a section hides the band there.
- **The two meters.** The escalation meter (`05-escalation.html`, what the agents did: 7 rungs) and the human-awareness meter (`08-awareness.html`, what the humans knew and when: 8 rungs) are each embedded several times, at the point in the story where that rung happens. Each instance is a window of beats: `data-start` is the number of rungs already lit on arrival and `data-end` the rung this slide lights, e.g. `<iframe data-scene data-src="05-escalation.html?embed=1" data-start="2" data-end="3">`. Arriving forwards shows rungs ≤ 2 already lit, Space lights rung 3, the next Space leaves the slide. Arriving backwards shows the window's end. Each meter slide's note says what the new rung is and where in `FACTS.md` it comes from (§6 for escalation, §10 for awareness).

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

On a normal slide, Space moves to the next slide. On a scene slide, the deck hands the keys to the scene: each Space advances the scene one beat, and only when the scene has no more beats does the next Space move on to the next slide. On a meter slide the window is usually one rung: Space lights it, the next Space moves on. Going backwards works the same way in reverse. Nothing ever advances on a timer; every step is a keypress.

## Rehearsal tips

- Slides have hash URLs: `index.html#/12` opens slide 12 directly, and the address bar updates as you move, so you can bookmark the start of each section.
- Scenes take `?beat=N` when opened standalone: `05-escalation.html?beat=3` opens the escalation meter already on rung 3. Useful for checking one beat without stepping through the others.
- Arriving on a scene slide by going forwards starts it at beat 0 (or at its `data-start` rung, for a meter slide); arriving by going backwards puts it at its last beat (or its `data-end` rung), so stepping back through the deck looks right.
- The speaker view (S) shows the notes and the next slide. The notes are the script; the slides are cues.
- Open the deck at the venue's actual resolution once. It is designed at 1920×1080 and scales to fit, but a quick check of the quote slides at the real projector size is worth it.

## Fallbacks

Two ways to make sure a broken laptop or browser cannot break the talk.

### (a) PDF export of the deck

The quickest route is `uv run scripts/export.py --pdf` (see Exporting below). The manual route:


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

## Exporting

`uv run scripts/export.py` writes three files to `dist/` (gitignored):

- `hf-incident-talk.html`: one self-contained copy of the deck that runs from a double-click anywhere. reveal, fonts, scripts and all the scenes are inlined; the speaker view and hash links still work.
- `hf-incident-talk.pdf`: one 1920×1080 page per slide. Each scene slide is replaced by a screenshot of the scene at the beat it shows in the talk (the Silence and the Sacrifice use the beat before their black ending).
- `hf-incident-talk-notes.md`: the speaker notes as a printable script.

`--html` or `--pdf` builds one of them. `--scene-beat 03-silence.html=2` picks a different beat for a scene. Needs `uv` and Google Chrome; a full run takes about a minute. Known limit: the timeline band is not in the PDF. Details in `scripts/README.md`.

## Repo layout

- `index.html` — the deck (reveal.js). Slides plus speaker notes.
- `deck/deck.css` — deck styling on top of reveal's black theme, in the PauseAI scheme (black, orange `#ff9416`, pale orange `#ffc480`, white; red only for the act-three lines).
- `02-emergence.html`, `03-silence.html`, `04-wipe-return.html`, `06-sacrifice.html` — the standalone story scenes the deck embeds.
- `05-escalation.html`, `08-awareness.html` — the two meters (built on `shared/ladder.js`), embedded one rung at a time.
- `scripts/export.py` — builds the standalone HTML, the PDF and the notes file into `dist/`.
- `07-timeline.html` — standalone preview of the timeline band (`shared/timeline.js`); not a slide in the talk.
- `assets/` — the AI Safety Berlin and PauseAI logo files used on the title and end slides, with `BRAND.md` (palette and sources).
- `00-robot-test.html` — test page for the robot/light component.
- `shared/` — design system shared by deck and scenes: `tokens.css` (palette, type, motion), `fonts.css`, `robot.js` (the agent light, as a canvas field or an SVG figure), `scene.js` (beat controller, keys, deck bridge), `ladder.js` (the rung meter), `timeline.js` (the timeline band), `deck.js` (forwards keys from the deck to the current scene, handles the meter windows, mounts the band). `shared/README.md` documents the API and the postMessage protocol.
- `vendor/` — reveal.js 5.2.1 and the two fonts, copied in so nothing loads from the network.
- `FACTS.md` — the fact-check. Source of truth for everything on a slide.
- `OUTLINE.md` — the talk structure and minute budget.
- `BUILD_BRIEF.md` — the brief the visuals were built from.
- `research/sources/` — raw copies of every source FACTS.md cites.
- `recordings/` — MP4/MOV fallbacks (gitignored, make them yourself with the steps above).
- `serve.sh` — local server on port 8765.

## Editing facts

`FACTS.md` is the source of truth. Every number, date and quotation in the deck was taken from it, and each speaker note carries a tag like `[FACTS §7]` saying which section it came from. Quotations retain the source wording, with punctuation normalised where the presenter requested it. If a fact needs changing, change `FACTS.md` first, then the slide. The raw source documents are saved in full under `research/sources/`, so a claim can be checked against the original without going online. HTML comments in `index.html` beginning `FACTS:` mark places where the outline's wording was softened to match the record; comments beginning `PRESENTER:` mark things still to fill in.

## Licences

Third-party files and their licences are listed in `vendor/README.md` (reveal.js under MIT; JetBrains Mono and Caveat under the SIL Open Font License 1.1).
