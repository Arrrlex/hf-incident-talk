/* ==========================================================================
   ladder.js — the vertical "ladder" meter (brief §6.5), as a reusable part.

   A rail on the left, a baseline rung at the bottom, an optional band just
   above it ("Nobody asked for anything above this line"), then rungs that
   climb. Each rung is unlit until asked for; lighting one draws its rail
   segment up from the rung below, draws the rung out to the right, fades its
   label in and lights its small figure. Colour grades along a gradient going
   up. Above the top rung the rail can carry on and fade: there is no top.

   Classic script, no modules: sets window.Ladder. Needs tokens.css for the
   colour/motion variables and robot.js if any rung uses a robot figure.

   Usage
   -----
     var ladder = Ladder.create(containerEl, {
       // bottom → top; rungs[0] is the baseline (always lit)
       rungs: [
         { label: 'The task they were assigned', sub: 'source detail',
           figure: 'active' },                 // see "figure" below
         { label: 'Left notes in a shared tool', sub: '…' },
         ...
       ],
       band: { afterRung: 0, text: 'Nobody asked for anything above this line' } | null,
       gradient: ['#ff9416', '#e0483f']        // stops, rung 1 → top rung; or
                 | function (i, count) { return 'rgb(…)'; },   // i = 1..count
       continuation: true,                     // faint rail fading upward past the top ("no top in sight")
       ghost: { label: 'The full picture' } | null,  // an extra top rung drawn faint, never lit
       geometry: { … },                        // optional, container px — see DEFAULT_GEOMETRY
       type: { labelSize: 30, labelLineHeight: 34, subSize: 16, subLineHeight: 18,
               subGap: 36, bandSize: 18 },     // optional, px
       seed: 20                                // robot figures get seed + rung index
     });

     ladder.light(n)                    // rungs 1..n lit (0 = only the baseline); animated
     ladder.light(n, { animate: false })// jump; idempotent; unlights when n decreases
     ladder.lit                         // current n
     ladder.count                       // number of climbing rungs (rungs.length - 1)
     ladder.rungY(i)                    // y of rung i (0 = baseline) in container px
     ladder.el                          // the <div class="ld"> root (absolute, fills the container)
     ladder.figures                     // Robot.Figure per rung, or null where there is none
     ladder.destroy()

   Rung fields
   -----------
     label    one line of text (mono, 300 weight)
     sub      optional dim detail on the same line, after a gap
     figure   what sits on the rung's left end:
                'idle' | 'active' | 'adversarial' (any Robot state) — a small
                  Robot.Figure; it is 'idle' while unlit and takes this state
                  when lit. Default 'active'.
                'ring'        — a small hollow circle that gains a centre dot
                  when lit (the quiet option: for rungs about people, not machines)
                'ring-hollow' — a hollow circle that stays hollow when lit
                'none'        — nothing
     colour   override for this rung's line/figure colour (otherwise the gradient)

   Geometry (container px; defaults reproduce 05-escalation)
   --------
     width 1920, height 1080      the container's design size (the SVG viewBox)
     railX 470, rungEnd 1520      rail x; right end of every rung
     baseY 962                    baseline rung y
     rung1Y 826, step 96          y of rung 1; pitch between rungs above it
     topFadeY 96                  where the continuation has faded to nothing
                                  (with a ghost, it fades out at the ghost instead)
     labelX 610, labelOffset 44   label left; label top = rung y − offset
     figX 490, figSize 72         robot figure: left; size (its feet sit on the rung)
     ringX 500, ringDy 22, ringR 9  ring figure: centre x; centre y = rung y − ringDy; radius
     bandOffset 84                band y = y(afterRung) − offset
     bandInset 0.07               band line spans width × [inset, 1 − inset]

   Animation: rail 400ms, rung 500ms, label fade 400ms after 250ms, figure per
   robot.js. `light(n, { animate: false })` lands the end state in one frame;
   so does every call under prefers-reduced-motion. Nothing here advances on
   a timer — drive it from Scene.goTo.
   ========================================================================== */
(function () {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';
  var seq = 0;

  var DEFAULT_GEOMETRY = {
    width: 1920, height: 1080,
    railX: 470, rungEnd: 1520,
    baseY: 962, rung1Y: 826, step: 96, topFadeY: 96,
    labelX: 610, labelOffset: 44,
    figX: 490, figSize: 72,
    ringX: 500, ringDy: 22, ringR: 9,
    bandOffset: 84, bandInset: 0.07
  };

  var DEFAULT_TYPE = {
    labelSize: 30, labelLineHeight: 34,
    subSize: 16, subLineHeight: 18, subGap: 36,
    bandSize: 18
  };

  var CSS = [
    '.ld { position: absolute; inset: 0; }',
    '.ld-svg { position: absolute; inset: 0; width: 100%; height: 100%; overflow: visible; }',
    '.ld-layer { position: absolute; inset: 0; }',
    /* Rungs and rail segments draw themselves in with a dash offset. */
    '.ld-ghostline { stroke: rgba(232, 232, 234, .07); stroke-width: 1; }',
    '.ld-rung { stroke-width: 1.5; transition: stroke-dashoffset 500ms var(--ease-out); }',
    '.ld-rail { stroke-width: 1;   transition: stroke-dashoffset 400ms var(--ease-out); }',
    '.ld-group:not(.ld-lit) .ld-rung { stroke-dashoffset: var(--len); }',
    '.ld-group:not(.ld-lit) .ld-rail { stroke-dashoffset: var(--rail-len); }',
    '.ld-group.ld-lit .ld-rung, .ld-group.ld-lit .ld-rail { stroke-dashoffset: 0; }',
    /* Above the top rung the rail carries on and fades: there is no top. */
    '.ld-rail-top { stroke-width: 1; opacity: 0; transition: opacity var(--dur-slow) var(--ease-out) 300ms; }',
    '.ld-rail-top.ld-lit { opacity: 1; }',
    '.ld-baseline { stroke: rgba(232, 232, 234, .45); stroke-width: 1.5; }',
    '.ld-band     { stroke: rgba(232, 232, 234, .22); stroke-width: 1; }',
    /* Ring figure: hollow while unlit; the centre dot appears when lit. */
    '.ld-ring circle { transition: stroke var(--dur-fast) var(--ease-out) 250ms, opacity var(--dur-fast) var(--ease-out) 250ms; }',
    '.ld-ring .ld-ring-o { fill: none; stroke: rgba(232, 232, 234, .18); stroke-width: 1.5; }',
    '.ld-ring .ld-ring-i { opacity: 0; fill: var(--ld-c); }',
    '.ld-ring.ld-lit .ld-ring-o { stroke: var(--ld-c); }',
    '.ld-ring.ld-lit .ld-ring-i { opacity: 1; }',
    '.ld-ring.ld-hollow .ld-ring-i { display: none; }',
    /* Text layer */
    '.ld-text { position: absolute; white-space: nowrap; font-family: var(--font-mono); }',
    '.ld-label { font-weight: 300; font-size: var(--ld-label-size); letter-spacing: .02em; line-height: var(--ld-label-lh);',
    '  color: var(--text); transition: opacity var(--dur-fast) var(--ease-out) 250ms; }',
    /* Source detail sits on the label\'s own line, after a gap, so it can never
       read as belonging to the rung below. It fades with its label. */
    '.ld-sub { display: inline-block; margin-left: var(--ld-sub-gap); vertical-align: baseline;',
    '  font-weight: 300; font-size: var(--ld-sub-size); letter-spacing: .04em; line-height: var(--ld-sub-lh); color: var(--text-dim); }',
    '.ld-label.ld-hidden { opacity: 0; transition-delay: 0ms; }',
    '.ld-label.ld-ghost-label { color: var(--text-dim); opacity: .55; }',
    '.ld-band-text { left: 50%; transform: translate(-50%, -50%); padding: 0 18px; background: var(--bg);',
    '  font-weight: 300; font-size: var(--ld-band-size); letter-spacing: .08em; color: var(--text-dim); }',
    '.ld-fig { position: absolute; }',
    '.ld-instant * { transition: none !important; }'
  ].join('\n');

  function injectCss() {
    if (document.getElementById('ld-css')) return;
    var s = document.createElement('style');
    s.id = 'ld-css';
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  function reducedMotion() {
    if (window.Scene && typeof window.Scene.reducedMotion === 'boolean') return window.Scene.reducedMotion;
    return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function assign(target) {
    for (var a = 1; a < arguments.length; a++) {
      var src = arguments[a];
      if (!src) continue;
      for (var k in src) if (Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined) target[k] = src[k];
    }
    return target;
  }

  function hexToRgb(h) {
    h = String(h).trim();
    var m = /^rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(h);
    if (m) return [+m[1], +m[2], +m[3]];
    if (h.length === 4) h = '#' + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
  }

  /** Piecewise-linear mix of colour stops at t in [0,1] → 'rgb(r,g,b)'. */
  function mixStops(stops, t) {
    var rgb = stops.map(hexToRgb);
    if (rgb.length === 1) return 'rgb(' + rgb[0].join(',') + ')';
    var pos = t * (rgb.length - 1), k = Math.min(rgb.length - 2, Math.floor(pos)), f = pos - k;
    var a = rgb[k], b = rgb[k + 1];
    var c = a.map(function (v, i) { return Math.round(v + (b[i] - v) * f); });
    return 'rgb(' + c.join(',') + ')';
  }

  function create(container, opts) {
    opts = opts || {};
    injectCss();
    if (!container) throw new Error('Ladder.create: container required');
    var rungs = opts.rungs || [];
    if (rungs.length < 1) throw new Error('Ladder.create: rungs[0] (the baseline) is required');
    var G = assign({}, DEFAULT_GEOMETRY, opts.geometry);
    var T = assign({}, DEFAULT_TYPE, opts.type);
    var count = rungs.length - 1;                 // climbing rungs 1..count
    var band = opts.band === undefined ? null : opts.band;
    var ghost = opts.ghost || null;
    var continuation = opts.continuation !== false;
    var seed = opts.seed === undefined ? 20 : opts.seed;
    var id = 'ld' + (++seq);

    function rungY(i) {
      if (i <= 0) return G.baseY;
      return G.rung1Y - (i - 1) * G.step;
    }
    var ghostY = rungY(count + 1);

    // Colour per climbing rung: explicit override, else the gradient.
    var gradient = opts.gradient || ['#ff9416', '#e0483f'];
    function rungColour(i) {
      if (rungs[i] && rungs[i].colour) return rungs[i].colour;
      if (typeof gradient === 'function') return gradient(i, count);
      var t = count > 1 ? (i - 1) / (count - 1) : 1;
      return mixStops(gradient, t);
    }
    var baselineColour = opts.baselineColour || 'rgba(232, 232, 234, .45)';

    /* -------------------------------------------------------------- DOM */
    var root = document.createElement('div');
    root.className = 'ld';
    root.style.setProperty('--ld-label-size', T.labelSize + 'px');
    root.style.setProperty('--ld-label-lh', T.labelLineHeight + 'px');
    root.style.setProperty('--ld-sub-size', T.subSize + 'px');
    root.style.setProperty('--ld-sub-lh', T.subLineHeight + 'px');
    root.style.setProperty('--ld-sub-gap', T.subGap + 'px');
    root.style.setProperty('--ld-band-size', T.bandSize + 'px');

    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('class', 'ld-svg');
    svg.setAttribute('viewBox', '0 0 ' + G.width + ' ' + G.height);
    svg.setAttribute('aria-hidden', 'true');
    var defs = document.createElementNS(NS, 'defs');
    svg.appendChild(defs);
    var layer = document.createElement('div');
    layer.className = 'ld-layer';
    root.appendChild(svg);
    root.appendChild(layer);
    container.appendChild(root);

    function svgEl(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }
    function line(attrs) { return svgEl('line', attrs); }
    function div(cls, text, x, y) {
      var e = document.createElement('div');
      e.className = 'ld-text ' + cls;
      e.textContent = text;
      e.style.left = x + 'px'; e.style.top = y + 'px';
      layer.appendChild(e);
      return e;
    }
    function labelWithSub(cls, rung, x, y) {
      var e = div(cls, rung.label || '', x, y);
      if (rung.sub) {
        var s = document.createElement('span');
        s.className = 'ld-sub';
        s.textContent = rung.sub;
        e.appendChild(s);
      }
      return e;
    }

    // Figures: a robot (any Robot state), a ring, or nothing.
    var figs = [], rings = [];
    function isRobot(kind) { return kind !== 'none' && kind !== 'ring' && kind !== 'ring-hollow'; }
    function figureKind(i) {
      var f = rungs[i].figure;
      return f === undefined || f === null ? 'active' : f;
    }
    function makeFigure(i, y, colour) {
      var kind = figureKind(i);
      figs[i] = null; rings[i] = null;
      if (kind === 'none') return;
      if (kind === 'ring' || kind === 'ring-hollow') {
        var g = svgEl('g', { 'class': 'ld-ring' + (kind === 'ring-hollow' ? ' ld-hollow' : '') });
        g.style.setProperty('--ld-c', colour);
        g.appendChild(svgEl('circle', { cx: G.ringX, cy: y - G.ringDy, r: G.ringR, 'class': 'ld-ring-o' }));
        g.appendChild(svgEl('circle', { cx: G.ringX, cy: y - G.ringDy, r: Math.max(2.5, G.ringR * 0.4), 'class': 'ld-ring-i' }));
        svg.appendChild(g);
        rings[i] = g;
        return;
      }
      if (!window.Robot || !Robot.Figure) throw new Error('Ladder: rung ' + i + ' wants a robot figure but robot.js is not loaded');
      var holder = document.createElement('div');
      holder.className = 'ld-fig';
      holder.style.left = G.figX + 'px';
      holder.style.top = (y - G.figSize) + 'px';
      layer.appendChild(holder);
      figs[i] = Robot.Figure.create(holder, { size: G.figSize, state: 'idle', antenna: true, seed: seed + i });
    }

    // Baseline rung (always lit), its label and figure, and the band.
    svg.appendChild(line({ x1: G.railX, y1: G.baseY, x2: G.rungEnd, y2: G.baseY, 'class': 'ld-baseline', stroke: baselineColour }));
    if (band) {
      var bandY = rungY(band.afterRung || 0) - (band.offset !== undefined ? band.offset : G.bandOffset);
      svg.appendChild(line({ x1: G.width * G.bandInset, y1: bandY, x2: G.width * (1 - G.bandInset), y2: bandY, 'class': 'ld-band' }));
      if (band.text) div('ld-band-text', band.text, 0, bandY).style.left = (G.width / 2) + 'px';
    }
    labelWithSub('ld-label', rungs[0], G.labelX, G.baseY - G.labelOffset);
    makeFigure(0, G.baseY, baselineColour);
    if (figs[0]) figs[0].setState(figureKind(0), { animate: false });
    if (rings[0]) rings[0].classList.add('ld-lit');

    // Climbing rungs.
    var groups = [], labels = [], wasLit = [];
    for (var i = 1; i <= count; i++) {
      var y = rungY(i), yPrev = rungY(i - 1), col = rungColour(i);
      var g = svgEl('g', { 'class': 'ld-group' });
      g.style.setProperty('--len', (G.rungEnd - G.railX) + 'px');
      g.style.setProperty('--rail-len', (yPrev - y) + 'px');
      // Faint ghost of the rung so the ladder is felt before it is lit.
      g.appendChild(line({ x1: G.railX, y1: y, x2: G.rungEnd, y2: y, 'class': 'ld-ghostline' }));
      // The rail draws up from the rung below, then the rung draws out to the right.
      g.appendChild(line({ x1: G.railX, y1: yPrev, x2: G.railX, y2: y, 'class': 'ld-rail', stroke: col,
        'stroke-dasharray': yPrev - y }));
      g.appendChild(line({ x1: G.railX, y1: y, x2: G.rungEnd, y2: y, 'class': 'ld-rung', stroke: col,
        'stroke-dasharray': G.rungEnd - G.railX }));
      svg.appendChild(g);
      groups[i] = g;
      makeFigure(i, y, col);
      labels[i] = labelWithSub('ld-label ld-hidden', rungs[i], G.labelX, y - G.labelOffset);
      wasLit[i] = false;
    }

    // Ghost rung: faint, never lit. Its rail segment is as faint as it is.
    if (ghost) {
      svg.appendChild(line({ x1: G.railX, y1: rungY(count), x2: G.railX, y2: ghostY, 'class': 'ld-ghostline' }));
      svg.appendChild(line({ x1: G.railX, y1: ghostY, x2: G.rungEnd, y2: ghostY, 'class': 'ld-ghostline' }));
      labelWithSub('ld-label ld-ghost-label', ghost, G.labelX, ghostY - G.labelOffset);
    }

    // Continuation: the rail carries on above the top rung and fades out —
    // to nothing at topFadeY, or, with a ghost, before it reaches the ghost.
    var railTop = null;
    if (continuation && count >= 1) {
      var topY = rungY(count), fadeY = ghost ? ghostY : G.topFadeY, topCol = rungColour(count);
      // userSpaceOnUse: a vertical line has a zero-width bounding box, so the default units would render nothing.
      var grad = svgEl('linearGradient', { id: id + '-fade', gradientUnits: 'userSpaceOnUse', x1: 0, y1: topY, x2: 0, y2: fadeY });
      grad.appendChild(svgEl('stop', { offset: 0, 'stop-color': topCol, 'stop-opacity': .9 }));
      grad.appendChild(svgEl('stop', { offset: 1, 'stop-color': topCol, 'stop-opacity': 0 }));
      defs.appendChild(grad);
      railTop = line({ x1: G.railX, y1: topY, x2: G.railX, y2: fadeY, 'class': 'ld-rail-top', stroke: 'url(#' + id + '-fade)' });
      svg.appendChild(railTop);
    }

    /* ---------------------------------------------------------- lighting */
    var lit = 0;

    // Run fn with all CSS transitions suppressed, so an end state lands in one frame.
    function snap(fn) {
      root.classList.add('ld-instant');
      fn();
      void root.offsetWidth;
      requestAnimationFrame(function () { root.classList.remove('ld-instant'); });
    }

    function render(n, animate) {
      for (var r = 1; r <= count; r++) {
        var on = r <= n;
        var changed = on !== wasLit[r];
        groups[r].classList.toggle('ld-lit', on);
        labels[r].classList.toggle('ld-hidden', !on);
        if (figs[r]) figs[r].setState(on ? figureKind(r) : 'idle', { animate: animate && changed });
        if (rings[r]) rings[r].classList.toggle('ld-lit', on);
        wasLit[r] = on;
      }
      if (railTop) railTop.classList.toggle('ld-lit', n >= count);
    }

    function light(n, o) {
      n = Math.max(0, Math.min(count, n | 0));
      var animate = !(o && o.animate === false) && !reducedMotion();
      if (animate) render(n, true);
      else snap(function () { render(n, false); });
      lit = n;
      return ladder;
    }

    var ladder = {
      light: light,
      get lit() { return lit; },
      count: count,
      rungY: rungY,
      el: root,
      svg: svg,
      figures: figs,
      destroy: function () {
        figs.forEach(function (f) { if (f) f.destroy(); });
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
    snap(function () { render(0, false); });
    return ladder;
  }

  window.Ladder = {
    create: create,
    DEFAULT_GEOMETRY: DEFAULT_GEOMETRY,
    DEFAULT_TYPE: DEFAULT_TYPE,
    mixStops: mixStops
  };
})();
