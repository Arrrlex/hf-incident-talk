# shared/ — design system for the talk visuals

Vanilla HTML/CSS/JS, classic scripts (no modules, so `file://` works), no
build step, no network at runtime. Load in this order:

```html
<link rel="stylesheet" href="shared/tokens.css">
<link rel="stylesheet" href="shared/fonts.css">   <!-- optional: vendored fonts -->
<script src="shared/robot.js"></script>           <!-- window.Robot -->
<script src="shared/scene.js"></script>           <!-- window.Scene -->
```

`00-robot-test.html` in the repo root exercises everything below and is the
page to use when judging whether the atom "feels right".

---

## tokens.css

CSS custom properties (palette, fonts, motion) plus a base reset:

- `--bg`, `--light-idle`, `--light-active`, `--line`, `--text`, `--text-dim`,
  `--adversarial`, `--false-hue`, `--paper`, `--ink`, `--robot-body`, `--robot-panel`
- `--font-mono`, `--font-hand`
- `--dur-fast` 400ms, `--dur-mid` 600ms, `--dur-slow` 800ms, `--dur-terminate` 600ms,
  `--ease-out`, `--ease-inout`
- `--safe` 7% (projector overscan)

Body is full-viewport, near-black, no scrollbars, cursor hidden (add
`show-cursor` to `<body>` while developing).

Layout classes:

- `.stage` — a 1920×1080 design surface, centred and scaled to fit the
  viewport via `--stage-scale` (set by `Scene.fitStage`). Design in 1080p
  pixels inside it.
- `.safe` — absolutely positioned inset by the safe margin. `.safe-pad` pads instead.
- `.fill` — absolute, fills its parent (for canvases and overlays).
- `.register-cold` / `.register-paper` — the two registers (brief §2). Paper
  is only for the Sacrifice beat.
- `.big-number` (the thin, huge `0`), `.caption` (one centred mono line),
  `.fade` + `.is-hidden` (600ms opacity toggle), `.mono`, `.hand`, `.thin`, `.dim`.

## fonts.css

`@font-face` for JetBrains Mono 300/400 and Caveat 400, pointing at
`../vendor/fonts/*.woff2`. The stacks in tokens.css fall back to system faces
if the files are missing.

---

## Robot (robot.js)

One table of "looks" drives both render modes, so a figure's eye and a field
point are the same light.

| state         | look                                                          |
|---------------|---------------------------------------------------------------|
| `idle`        | dim amber `#c8933a`, low opacity, slow breathing (2.5–4s, desynced) |
| `active`      | warm gold `#f0b849`, brighter, ~1.2s pulse                     |
| `transmit`    | as active, slightly brighter; on entry a pulse leaves along every connected line |
| `deceive`     | as active, plus a brief subtle flicker to a false cold hue on entry and every ~3s while held |
| `terminated`  | fades to black over 600ms and stays black                      |
| `adversarial` | crimson `#e0483f`, active pulse; its lines tint crimson        |
| `off`         | invisible (used by `wipe({ off: true })`)                      |

State changes tween over 600ms ease-out (terminated: 600ms fade). Pass
`{ animate: false }` or `{ duration: ms }` to override. `wipe()` snaps.

### Robot.Field — the pulled-back swarm (Canvas 2D)

```js
var field = Robot.Field.create(canvasEl, {
  count: 1200,      // points
  seed: 7,          // deterministic layout (rehearsal matches the night)
  margin: 0.07,     // safe margin as a fraction of each edge
  minSpacing: 0,    // CSS px; 0 = auto from area/count (Poisson-ish rejection)
  pointSize: 20,    // CSS px sprite diameter at 1080p; scales with canvas size
  lineAlpha: 0.30, lineWidth: 1, lineFadeIn: 400
});
field.start();                 // one requestAnimationFrame loop
field.stop();
```

The canvas is sized by CSS; the field handles devicePixelRatio, resize and
`.stage` scaling itself. Positions are in the canvas's CSS layout pixels.

```js
field.setState(id, 'active');                   // tweened
field.setState(id, 'terminated', { animate: false });
field.setAll('idle');
field.getState(id);                             // 'idle' | ...
field.states                                    // Uint8Array of state indices (Robot.STATES[i]) — read only
field.positions                                 // Float32Array [x0,y0,x1,y1,...] CSS px
field.count, field.width, field.height, field.pointSize, field.fps

field.nearest(id, k)                            // k nearest ids
field.within(x, y, r)                           // ids within r px, nearest first
field.pick(x, y)                                // id under a point, or -1

field.connect(a, b, { pulse: true, duration: 600 })   // thin cyan line (+ travelling pulse a→b)
field.disconnect(a, b); field.isConnected(a, b)
field.clearConnections()
field.connections                               // array of [a, b] (allocates; not for hot loops)
field.connectionCount, field.pulseCount
field.pulse(a, b, 600)                          // fire a pulse along an existing line

field.freezeAll() / field.unfreezeAll()         // hold breathing, pulses, flicker and state tweens
field.fadeLines(800) / field.unfadeLines(600)   // all lines → 0 alpha / back
field.dimAll(1500) / field.undimAll(600)        // all lights → near-black (the Silence) / back
field.wipe()                                    // instant: no lines, no pulses, all idle, multipliers reset
field.wipe({ off: true })                       // ...all invisible instead of idle

field.render()                                  // draw one frame (when stopped)
field.step(16.7)                                // advance dt ms and draw (tests / recording)
field.destroy()
```

Performance notes: one canvas, one rAF loop, zero allocations per frame.
Glow sprites are pre-rendered once per colour and drawn with `drawImage`;
lines are batched into a handful of `stroke()` calls grouped by
(fade-in alpha, crimson mix). Measured ~1.3ms CPU per frame with 1,200
points mid-tween and ~4,000 lines.

`prefers-reduced-motion`: breathing is static, pulses are skipped (lines
just appear), fades jump to their end value. State tweens still run.

### Robot.Figure — the up-close machine (SVG)

```js
var fig = Robot.Figure.create(containerEl, { size: 160, state: 'idle', antenna: true, seed: 3 });
fig.setState('terminated');      // same states, same timings as a field point
fig.state;                       // current state name
fig.el;                          // the wrapper <div class="rb-figure">
fig.svg;
fig.destroy();
Robot.Figure.step(16.7);         // advance all figures (tests / recording)
```

A small boxy flat-shaded machine: head with one round eye (the light), a
stub antenna with a dull tip, body with one lighter panel and two vent
lines, two feet. No mouth, no second eye, no arms. Body colours come from
`--robot-body`, `--robot-panel`, `--robot-shadow` in tokens.css. All figures
share one rAF loop.

Also exported: `Robot.STATES` (index → name), `Robot.COLOURS`, `Robot.reducedMotion`.

---

## Scene (scene.js)

The beat controller. A scene is a numbered list of states; `goTo(i)` must
render state `i` from any starting point (idempotent), so ← works and so a
deck can jump straight to a beat.

```js
var scene = Scene.create({
  name: 'emergence',
  beats: 4,                                 // beat 0 is the rest state
  goTo: function (index, o) {               // o.direction: -1|0|1, o.animate: bool, o.beats
    // render beat `index`. When o.animate is false, jump to the end state.
  },
  reset: function () { ... }                // optional; default goTo(0, { animate: false })
});

scene.index; scene.beats; scene.name; scene.embedded
scene.next(); scene.prev(); scene.goTo(i, { animate }); scene.reset();
scene.handleKey(key);                       // route a KeyboardEvent.key manually
scene.toggleHud(); scene.hudVisible; scene.setHudExtra('60 fps');
scene.on('beat', fn({ index, direction, animate }));
scene.on('overflow', fn(direction)); scene.on('hud', fn(visible));
scene.destroy();
```

On load the scene jumps (no animation) to `?beat=N` or `#beat=N` if
present, otherwise beat 0. The hash is kept up to date as beats change.
Under `prefers-reduced-motion`, `animate` is always false.

Helpers:

```js
Scene.fitStage(el)                     // scale a .stage to the viewport; re-runs on resize; returns the scale
Scene.fitStage.scaleOf(el)
Scene.tween(from, to, ms, Scene.ease.outCubic, onUpdate(v, t), onComplete) // -> { cancel() }
Scene.ease.linear | outCubic | inOutSine | outQuad | inOutCubic | outExpo
Scene.wait(ms)                         // Promise; for sequencing *within* one beat only
Scene.reducedMotion                    // boolean
Scene.STAGE_W, Scene.STAGE_H           // 1920, 1080
```

`Scene.wait` and `Scene.tween` are for cascades inside a beat (e.g. staggering
connections). Nothing in this system advances a beat on a timer.

### Keyboard controls

| key                                   | action                    |
|---------------------------------------|---------------------------|
| Space, →, PageDown, ↓                 | next beat                 |
| ←, Backspace, PageUp, ↑               | previous beat             |
| R                                     | reset to beat 0           |
| F                                     | toggle fullscreen         |
| H                                     | toggle the HUD (`name · beat i/N` + anything set via `setHudExtra`) |
| Home / End                            | first / last beat (no animation) |

Keys with Ctrl/Alt/Cmd are ignored, as are keys typed into inputs. At the
last beat, `next()` does not wrap (it posts `scene:overflow`); likewise
`prev()` at beat 0.

### Deck bridge (postMessage)

Active when the page is inside an iframe (`window.parent !== window`) or
opened with `?embed=1`. All messages use `targetOrigin '*'` because
`file://` origins are opaque. Real keydown events are still handled while
embedded, in case the iframe has focus.

Scene → parent:

```js
{ type: 'scene:ready',    name, beats }            // on load, before the first beat message
{ type: 'scene:beat',     name, index, beats }     // on every beat change (including the initial one)
{ type: 'scene:overflow', name, direction: 1 }     // next() at the last beat
{ type: 'scene:overflow', name, direction: -1 }    // prev() at beat 0
```

Parent → scene:

```js
{ type: 'scene:key',   key: ' ' }                  // treated as a keypress (KeyboardEvent.key)
{ type: 'scene:next' } / { type: 'scene:prev' }
{ type: 'scene:goTo',  index: 3, animate: false }  // animate defaults to false; index may be 'first' or 'last'
{ type: 'scene:reset' }
{ type: 'scene:hud',   visible: true }             // omit visible to toggle
{ type: 'scene:query' }                            // replies with a scene:beat
```

A deck preloading a scene at a beat can use `05-escalation.html?embed=1#beat=3`.

---

## Reduced motion

`Scene.reducedMotion` and `Robot.reducedMotion` both read
`(prefers-reduced-motion: reduce)`. Field breathing goes static, pulses are
skipped, fades jump, and `Scene.create` forces `animate: false` so scenes
land on end states.

---

## Timeline (timeline.js)

The timeline spine (brief §8): a thin band for the top of any scene, in the
cold register. One hairline; phases as short cyan segments (labels above);
the wipe / mass-termination / shutdown points as small ticks (labels below);
the collusion.wiki strand as a detached short line set apart on the right.
A progress marker lights items up in step order, so the recurrence
(build → wipe → build → mass termination → build → shutdown) reads at a glance.
Standalone: depends on nothing but tokens.css for colours.

```html
<script src="shared/timeline.js"></script>                <!-- window.Timeline -->
...
<div class="stage"><div class="safe">
  <div id="timeline" style="position:absolute;left:0;right:0;top:0"></div>
  <!-- the scene's own content below it -->
</div></div>
```

```js
var tl = Timeline.create(document.getElementById('timeline'), {
  data: Timeline.DEFAULT_DATA,   // default; see below
  step: 0,                       // initial step
  mainWidth: 0.82,               // fraction of the container for the dated strand
  detachedWidth: 0.14            // fraction for the detached strand (the rest is the gap)
});
tl.setStep(i);                  // light items 0..i-1, marker on item i-1; step 0 = nothing lit
tl.setStep(i, { animate: false });
tl.next(); tl.prev();
tl.step; tl.steps;              // current step, total number of steps (items + detached + 1)
tl.el;                          // the <div class="tl"> (76px tall, 100% wide)
tl.destroy();
```

The band is 76px tall and positioned entirely in % of its container's width,
so it needs no measuring and survives `.stage` scaling and resizes. Drive it
from the scene's `goTo` — either one beat per step (see `07-timeline.html`)
or by calling `tl.setStep(n)` at whichever beats the scene wants to move it.

### Data

```js
{
  axis: { start: '2026-05-01', pivot: '2026-07-04', pivotAt: 0.30, end: '2026-07-26' },
  items: [                                            // in step order
    { kind: 'phase', from: '2026-05-12', to: '2026-07-06', label: 'May–Jun · training · board #1' },
    { kind: 'mark',  at: '2026-07-06', label: '6 Jul · wiped' },
    { kind: 'phase', from: '2026-07-13', to: '2026-07-19', label: '19 Jul · board #3\nOpenAI cluster', tone: 'adversarial' },
    ...
  ],
  detached: { label: '11 May–2 Jul · collusion.wiki\n(separate swarm)' }   // optional; lit at the last step
}
```

- `axis` — dates are `YYYY-MM-DD`. With `pivot`, the axis is piecewise linear:
  `start…pivot` occupies the first `pivotAt` of the strand and `pivot…end` the
  rest (the default compresses May–early July so the July fortnight has room).
  Omit `pivot` for a linear axis.
- `items` — `phase` (a segment, label above, marker at its midpoint) or `mark`
  (a tick, label below, marker on the tick). `'\n'` in a label breaks the line.
  `tone: 'adversarial'` tints a phase crimson (act three).
- `detached` — drawn on its own short hairline, not on the shared axis.

`Timeline.DEFAULT_DATA` holds the verified phases from FACTS.md §5 (the
"May–Jun" phase segment starts at the first board note, 12 May).
`prefers-reduced-motion` disables the 400ms transitions.
