/* ==========================================================================
   robot.js — the agent/light atom (brief §2, §5).

   A robot and a dot of light are the same object at two zoom levels:
     Robot.Field  — pulled back: ~1,200 points of light on one Canvas 2D.
     Robot.Figure — up close: a small boxy SVG machine whose single eye is
                    that same light.

   Classic script, no modules: sets window.Robot. No network, no deps.
   See shared/README.md for the API.
   ========================================================================== */
(function () {
  'use strict';

  var TWO_PI = Math.PI * 2;

  /* ---------------------------------------------------------------------
     States and looks. One table drives both the field and the figure so
     the two render modes are unmistakably the same light.
     --------------------------------------------------------------------- */
  var STATES = ['idle', 'active', 'transmit', 'deceive', 'terminated', 'adversarial', 'off'];
  var S = {};
  STATES.forEach(function (n, i) { S[n] = i; });

  // Sprite/colour indices.
  var C_AMBER = 0, C_GOLD = 1, C_CRIMSON = 2, C_FALSE = 3, C_PULSE = 4;
  var COLOURS = ['#b35f00', '#ff9416', '#e0483f', '#e6e6e6', '#ffc480']; // idle, active, adversarial, false hue, transmit — PauseAI orange scheme (assets/BRAND.md)
  var LINE_COLOUR = '#ffffff';

  // Per-state look: colour index, base alpha, breathing amplitude (fraction
  // of alpha that swings), breathing period (s, before per-agent jitter),
  // scale, crimson-ness (for line tinting).
  //                      col       alpha amp   per   scale crim
  var LOOK = [
    /* idle        */ [C_AMBER,   0.42, 0.55, 3.25, 1.00, 0],
    /* active      */ [C_GOLD,    0.95, 0.30, 1.20, 1.25, 0],
    /* transmit    */ [C_GOLD,    1.00, 0.30, 1.20, 1.35, 0],
    /* deceive     */ [C_GOLD,    0.95, 0.30, 1.20, 1.25, 0],
    /* terminated  */ [C_AMBER,   0.00, 0.00, 3.25, 0.80, 0],
    /* adversarial */ [C_CRIMSON, 0.95, 0.30, 1.20, 1.25, 1],
    /* off         */ [C_AMBER,   0.00, 0.00, 3.25, 1.00, 0]
  ];

  var TWEEN_MS = 600;          // state transitions (400–800ms, ease-out)
  var TERMINATE_MS = 600;      // light fades to black
  var FLICKER_MS = 520;        // deceive flicker envelope length
  var FLICKER_EVERY_MS = 3200; // how often a held 'deceive' re-flickers
  var FLICKER_MAX = 0.75;      // never fully the false hue — must be subtle

  var reducedMotionMQ = (typeof matchMedia === 'function')
    ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(reducedMotionMQ && reducedMotionMQ.matches); }

  function easeOutCubic(t) { t = 1 - t; return 1 - t * t * t; }
  function easeInOutSine(t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); }

  // Deceive flicker envelope: two quick blips, then quiet. 0..1 over t∈[0,1].
  function flickerEnvelope(t) {
    if (t <= 0 || t >= 1) return 0;
    var m = 0;
    if (t < 0.14) m = t / 0.14;
    else if (t < 0.28) m = 1 - (t - 0.14) / 0.14;
    else if (t < 0.40) m = 0;
    else if (t < 0.52) m = 0.7 * (t - 0.40) / 0.12;
    else if (t < 0.66) m = 0.7 * (1 - (t - 0.52) / 0.14);
    return m * FLICKER_MAX;
  }

  function stateIndex(state) {
    if (typeof state === 'number') return state;
    var i = S[state];
    if (i === undefined) throw new Error('Robot: unknown state "' + state + '"');
    return i;
  }

  /* Seeded PRNG (mulberry32) so layouts are deterministic. */
  function makeRng(seed) {
    var a = (seed >>> 0) || 1;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hexToRgb(hex) {
    var n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function mixWhite(rgb, k) {
    return [Math.round(rgb[0] + (255 - rgb[0]) * k),
            Math.round(rgb[1] + (255 - rgb[1]) * k),
            Math.round(rgb[2] + (255 - rgb[2]) * k)];
  }
  function rgba(rgb, a) { return 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + a + ')'; }

  /* Pre-render one soft radial glow sprite per colour (done once, not per
     frame). The sprite is drawn scaled with drawImage. */
  var SPRITE_PX = 96;
  function makeSprite(hex) {
    var c = document.createElement('canvas');
    c.width = SPRITE_PX; c.height = SPRITE_PX;
    var g = c.getContext('2d');
    var r = SPRITE_PX / 2;
    var rgb = hexToRgb(hex);
    var grad = g.createRadialGradient(r, r, 0, r, r, r);
    grad.addColorStop(0.00, rgba(mixWhite(rgb, 0.55), 1));
    grad.addColorStop(0.12, rgba(mixWhite(rgb, 0.15), 1));
    grad.addColorStop(0.22, rgba(rgb, 0.85));
    grad.addColorStop(0.38, rgba(rgb, 0.30));
    grad.addColorStop(0.62, rgba(rgb, 0.07));
    grad.addColorStop(1.00, rgba(rgb, 0));
    g.fillStyle = grad;
    g.fillRect(0, 0, SPRITE_PX, SPRITE_PX);
    return c;
  }
  var sprites = null;
  function getSprites() {
    if (!sprites) sprites = COLOURS.map(makeSprite);
    return sprites;
  }

  /* =====================================================================
     Robot.Field
     ===================================================================== */
  function createField(canvas, opts) {
    opts = opts || {};
    var count = opts.count || 1200;
    var seed = opts.seed === undefined ? 7 : opts.seed;
    var margin = opts.margin === undefined ? 0.07 : opts.margin;
    var pointSizeOpt = opts.pointSize || 0;          // CSS px diameter at 1080p, 0 = auto
    var lineWidth = opts.lineWidth || 1;              // CSS px
    var lineAlpha = opts.lineAlpha === undefined ? 0.30 : opts.lineAlpha;
    var lineFadeIn = opts.lineFadeIn === undefined ? 400 : opts.lineFadeIn;

    var ctx = canvas.getContext('2d', { alpha: true });
    var spr = getSprites();

    /* --- per-point storage (typed arrays, allocated once) ------------- */
    var N = count;
    var nx = new Float32Array(N), ny = new Float32Array(N);   // normalised 0..1
    var positions = new Float32Array(N * 2);                  // CSS px [x,y,...]
    var state = new Uint8Array(N);
    var periodMul = new Float32Array(N);
    var ph = new Float32Array(N);
    // tween from/to
    var colA = new Uint8Array(N), colB = new Uint8Array(N);
    var fA = new Float32Array(N), tA = new Float32Array(N);       // alpha
    var fAmp = new Float32Array(N), tAmp = new Float32Array(N);   // breathing amplitude
    var fPer = new Float32Array(N), tPer = new Float32Array(N);   // period
    var fSc = new Float32Array(N), tSc = new Float32Array(N);     // scale
    var fCr = new Float32Array(N), tCr = new Float32Array(N);     // crimson-ness
    var twT = new Float32Array(N);                                // tween progress 0..1
    var twDur = new Float32Array(N);                              // ms
    var flick = new Float64Array(N);                              // flicker start (ms), 0 = none
    // scratch (computed each frame in pass 1, read in passes 2–3)
    var curAlpha = new Float32Array(N), curSize = new Float32Array(N);
    var curMix = new Float32Array(N), curCr = new Float32Array(N), curFl = new Float32Array(N);

    /* --- connections -------------------------------------------------- */
    var lineCap = 4096;
    var lineA = new Int32Array(lineCap), lineB = new Int32Array(lineCap);
    var lineBorn = new Float64Array(lineCap);
    var lineBucket = new Uint8Array(lineCap);
    var lineCount = 0;
    var lineKeys = new Map();   // key -> index
    var ALPHA_BUCKETS = 6, MIX_BUCKETS = 5;
    var bucketCount = new Int32Array(ALPHA_BUCKETS * MIX_BUCKETS);

    /* --- travelling pulses -------------------------------------------- */
    var pulseCap = 8192;
    var pA = new Int32Array(pulseCap), pB = new Int32Array(pulseCap);
    var pStart = new Float64Array(pulseCap), pDur = new Float32Array(pulseCap);
    var pulseCount = 0;

    /* --- global multipliers (the Silence) ----------------------------- */
    var gLine = { v: 1, from: 1, to: 1, t: 1, dur: 1 };
    var gLight = { v: 1, from: 1, to: 1, t: 1, dur: 1 };

    var frozen = false;
    var running = false;
    var destroyed = false;
    var rafId = 0;
    var lastT = 0;
    var now = 0;           // ms, our own clock (pauses with freeze)
    var W = 0, H = 0, dpr = 1, unit = 1, pointSize = 20;
    var fps = 0, fpsAcc = 0, fpsN = 0, fpsLast = 0;

    /* --- layout: seeded scatter with Poisson-ish rejection ------------- */
    function layout() {
      var rng = makeRng(seed);
      var cw = canvas.clientWidth || 1920, chh = canvas.clientHeight || 1080;
      var x0 = cw * margin, y0 = chh * margin, uw = cw * (1 - 2 * margin), uh = chh * (1 - 2 * margin);
      var minSp = opts.minSpacing || 0.72 * Math.sqrt((uw * uh) / N);
      var cell = minSp;
      var gw = Math.ceil(uw / cell) + 1, gh = Math.ceil(uh / cell) + 1;
      var grid = new Int32Array(gw * gh).fill(-1);
      var gx = new Float32Array(N), gy = new Float32Array(N);
      var minSq = minSp * minSp;

      function ok(x, y) {
        var cx = (x / cell) | 0, cy = (y / cell) | 0;
        for (var j = cy - 1; j <= cy + 1; j++) {
          if (j < 0 || j >= gh) continue;
          for (var i = cx - 1; i <= cx + 1; i++) {
            if (i < 0 || i >= gw) continue;
            var k = grid[j * gw + i];
            if (k >= 0) {
              var dx = gx[k] - x, dy = gy[k] - y;
              if (dx * dx + dy * dy < minSq) return false;
            }
          }
        }
        return true;
      }

      for (var n = 0; n < N; n++) {
        var placed = false, x = 0, y = 0;
        for (var tries = 0; tries < 40; tries++) {
          x = rng() * uw; y = rng() * uh;
          if (ok(x, y)) { placed = true; break; }
        }
        if (!placed) {
          // best effort: relax spacing progressively rather than clump hard
          for (var relax = 0.85; !placed && relax > 0.2; relax *= 0.8) {
            var mq = minSq * relax * relax;
            for (var t2 = 0; t2 < 20; t2++) {
              x = rng() * uw; y = rng() * uh;
              var cx = (x / cell) | 0, cy = (y / cell) | 0, good = true;
              for (var j = cy - 1; good && j <= cy + 1; j++) {
                if (j < 0 || j >= gh) continue;
                for (var i = cx - 1; i <= cx + 1; i++) {
                  if (i < 0 || i >= gw) continue;
                  var k = grid[j * gw + i];
                  if (k >= 0) { var dx = gx[k] - x, dy = gy[k] - y; if (dx * dx + dy * dy < mq) { good = false; break; } }
                }
              }
              if (good) { placed = true; break; }
            }
          }
        }
        gx[n] = x; gy[n] = y;
        var gi = ((y / cell) | 0) * gw + ((x / cell) | 0);
        if (gi >= 0 && gi < grid.length && grid[gi] < 0) grid[gi] = n;
        nx[n] = (x0 + x) / cw; ny[n] = (y0 + y) / chh;
        periodMul[n] = 0.77 + 0.46 * rng();      // 2.5–4s idle period
        ph[n] = rng() * TWO_PI;                  // desynced breathing
      }
    }

    function applyLookInstant(i, si) {
      var L = LOOK[si];
      colA[i] = colB[i] = L[0];
      fA[i] = tA[i] = L[1]; fAmp[i] = tAmp[i] = L[2]; fPer[i] = tPer[i] = L[3];
      fSc[i] = tSc[i] = L[4]; fCr[i] = tCr[i] = L[5];
      twT[i] = 1; twDur[i] = 1;
    }

    function setStateAt(i, si, dur) {
      var prev = state[i];
      state[i] = si;
      if (dur <= 0) { applyLookInstant(i, si); }
      else {
        // Capture the current effective look as the tween origin.
        var e = twT[i] >= 1 ? 1 : easeOutCubic(twT[i]);
        fA[i] = fA[i] + (tA[i] - fA[i]) * e;
        fAmp[i] = fAmp[i] + (tAmp[i] - fAmp[i]) * e;
        fPer[i] = fPer[i] + (tPer[i] - fPer[i]) * e;
        fSc[i] = fSc[i] + (tSc[i] - fSc[i]) * e;
        fCr[i] = fCr[i] + (tCr[i] - fCr[i]) * e;
        if (e >= 0.5) colA[i] = colB[i];
        var L = LOOK[si];
        colB[i] = L[0]; tA[i] = L[1]; tAmp[i] = L[2]; tPer[i] = L[3]; tSc[i] = L[4]; tCr[i] = L[5];
        twT[i] = 0; twDur[i] = dur;
      }
      if (si === S.deceive) flick[i] = now || 1;
      else flick[i] = 0;
      if (si === S.transmit) emitFrom(i, 600);
      return prev;
    }

    function emitFrom(i, dur) {
      for (var l = 0; l < lineCount; l++) {
        if (lineA[l] === i) addPulse(i, lineB[l], dur);
        else if (lineB[l] === i) addPulse(i, lineA[l], dur);
      }
    }

    function addPulse(a, b, dur) {
      if (reducedMotion()) return;
      if (pulseCount >= pulseCap) return;   // drop rather than allocate mid-cascade
      pA[pulseCount] = a; pB[pulseCount] = b;
      pStart[pulseCount] = now; pDur[pulseCount] = dur || 600;
      pulseCount++;
    }

    function growLines() {
      lineCap *= 2;
      var a2 = new Int32Array(lineCap); a2.set(lineA); lineA = a2;
      var b2 = new Int32Array(lineCap); b2.set(lineB); lineB = b2;
      var c2 = new Float64Array(lineCap); c2.set(lineBorn); lineBorn = c2;
      var d2 = new Uint8Array(lineCap); d2.set(lineBucket); lineBucket = d2;
    }

    function lineKey(a, b) { return a < b ? a * N + b : b * N + a; }

    /* --- sizing ------------------------------------------------------- */
    function resize() {
      var cw = canvas.clientWidth, chh = canvas.clientHeight;
      if (!cw || !chh) return;
      // If the canvas sits inside a CSS-scaled .stage, render at the
      // on-screen resolution rather than the layout resolution.
      var rect = canvas.getBoundingClientRect();
      var eff = rect.width > 0 ? rect.width / cw : 1;
      dpr = Math.min(3, (window.devicePixelRatio || 1) * eff);
      W = cw; H = chh;
      var bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; }
      unit = Math.max(0.35, Math.min(W / 1920, H / 1080));
      pointSize = (pointSizeOpt || 20) * unit;
      for (var i = 0; i < N; i++) { positions[i * 2] = nx[i] * W; positions[i * 2 + 1] = ny[i] * H; }
    }

    /* --- the frame ---------------------------------------------------- */
    function stepGlobal(g, dt) {
      if (g.t >= 1) return;
      g.t += dt / g.dur; if (g.t > 1) g.t = 1;
      g.v = g.from + (g.to - g.from) * easeOutCubic(g.t);
    }

    function frame(ts) {
      if (destroyed) return;
      rafId = requestAnimationFrame(frame);
      var dt = lastT ? Math.min(100, ts - lastT) : 16.7;
      lastT = ts;

      // fps (smoothed over ~0.5s)
      fpsAcc += dt; fpsN++;
      if (fpsAcc >= 500) { fps = 1000 * fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

      if (!frozen) now += dt;
      stepGlobal(gLine, dt);
      stepGlobal(gLight, dt);
      draw(dt);
    }

    function draw(dt) {
      var i, e, a, amp, per, sc, b;
      var rm = reducedMotion();
      var lightMul = gLight.v;

      /* pass 1: update points */
      for (i = 0; i < N; i++) {
        var t = twT[i];
        if (t < 1) {
          if (!frozen) { t += dt / twDur[i]; if (t > 1) t = 1; twT[i] = t; }
          e = easeOutCubic(t);
        } else e = 1;
        a = fA[i] + (tA[i] - fA[i]) * e;
        amp = fAmp[i] + (tAmp[i] - fAmp[i]) * e;
        per = fPer[i] + (tPer[i] - fPer[i]) * e;
        sc = fSc[i] + (tSc[i] - fSc[i]) * e;
        curCr[i] = fCr[i] + (tCr[i] - fCr[i]) * e;
        curMix[i] = e;
        if (!frozen && !rm) ph[i] += (dt * 0.001) * TWO_PI / (per * periodMul[i]);
        b = rm ? 0.5 : 0.5 - 0.5 * Math.cos(ph[i]);      // ease-in-out breathing 0..1
        curAlpha[i] = a * (1 - amp + amp * b) * lightMul;
        curSize[i] = pointSize * sc * (0.88 + 0.24 * b);
        // deceive flicker (periodic while held)
        var fl = 0;
        if (flick[i] > 0 && !frozen) {
          var ft = (now - flick[i]) / FLICKER_MS;
          if (ft >= 1) {
            var since = now - flick[i];
            if (since > FLICKER_EVERY_MS * periodMul[i]) flick[i] = now;   // re-arm
          } else fl = flickerEnvelope(ft);
        }
        curFl[i] = fl;
      }

      /* clear */
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'source-over';

      /* pass 2: lines, batched by (alpha bucket, crimson bucket) */
      if (lineCount > 0 && gLine.v > 0.002) {
        var l, ab, mb, bk;
        bucketCount.fill(0);
        var fadeIn = lineFadeIn > 0 ? lineFadeIn : 1;
        for (l = 0; l < lineCount; l++) {
          var age = rm ? 1 : (now - lineBorn[l]) / fadeIn;
          ab = age >= 1 ? ALPHA_BUCKETS - 1 : (age * ALPHA_BUCKETS) | 0;
          var ca = curCr[lineA[l]], cb = curCr[lineB[l]];
          var m = ca > cb ? ca : cb;
          mb = Math.round(m * (MIX_BUCKETS - 1));
          bk = ab * MIX_BUCKETS + mb;
          lineBucket[l] = bk;
          bucketCount[bk]++;
        }
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'butt';
        for (bk = 0; bk < ALPHA_BUCKETS * MIX_BUCKETS; bk++) {
          if (bucketCount[bk] === 0) continue;
          ab = (bk / MIX_BUCKETS) | 0; mb = bk % MIX_BUCKETS;
          var aq = (ab + 1) / ALPHA_BUCKETS;
          var mq = mb / (MIX_BUCKETS - 1);
          ctx.beginPath();
          for (l = 0; l < lineCount; l++) {
            if (lineBucket[l] !== bk) continue;
            var ia = lineA[l] * 2, ib = lineB[l] * 2;
            ctx.moveTo(positions[ia], positions[ia + 1]);
            ctx.lineTo(positions[ib], positions[ib + 1]);
          }
          if (mq < 1) {
            ctx.strokeStyle = LINE_COLOUR;
            ctx.globalAlpha = lineAlpha * gLine.v * aq * (1 - mq);
            ctx.stroke();
          }
          if (mq > 0) {
            ctx.strokeStyle = COLOURS[C_CRIMSON];
            ctx.globalAlpha = lineAlpha * gLine.v * aq * mq;
            ctx.stroke();
          }
        }
      }

      /* pass 3: points (sprite cross-fade during tweens, flicker overlay) */
      for (i = 0; i < N; i++) {
        var al = curAlpha[i];
        if (al <= 0.003) continue;
        var sz = curSize[i], hx = positions[i * 2] - sz * 0.5, hy = positions[i * 2 + 1] - sz * 0.5;
        var mix = curMix[i], fl2 = curFl[i];
        var baseA = al * (1 - fl2);
        if (mix < 1 && colA[i] !== colB[i]) {
          ctx.globalAlpha = baseA * (1 - mix);
          ctx.drawImage(spr[colA[i]], hx, hy, sz, sz);
          ctx.globalAlpha = baseA * mix;
          ctx.drawImage(spr[colB[i]], hx, hy, sz, sz);
        } else {
          ctx.globalAlpha = baseA;
          ctx.drawImage(spr[colB[i]], hx, hy, sz, sz);
        }
        if (fl2 > 0) {
          ctx.globalAlpha = al * fl2;
          ctx.drawImage(spr[C_FALSE], hx, hy, sz, sz);
        }
      }

      /* pass 4: travelling pulses (swap-remove when finished) */
      if (pulseCount > 0) {
        var ps = pointSize * 1.1;
        var k = 0;
        while (k < pulseCount) {
          var pt = (now - pStart[k]) / pDur[k];
          if (pt >= 1) {
            pulseCount--;
            pA[k] = pA[pulseCount]; pB[k] = pB[pulseCount];
            pStart[k] = pStart[pulseCount]; pDur[k] = pDur[pulseCount];
            continue;
          }
          if (pt < 0) pt = 0;
          var u = easeInOutSine(pt);
          var xa = positions[pA[k] * 2], ya = positions[pA[k] * 2 + 1];
          var xb = positions[pB[k] * 2], yb = positions[pB[k] * 2 + 1];
          var x = xa + (xb - xa) * u, y = ya + (yb - ya) * u;
          var env = pt < 0.15 ? pt / 0.15 : pt > 0.7 ? (1 - pt) / 0.3 : 1;
          ctx.globalAlpha = 0.95 * env * gLine.v * lightMul;
          ctx.drawImage(spr[C_PULSE], x - ps * 0.5, y - ps * 0.5, ps, ps);
          k++;
        }
      }
      ctx.globalAlpha = 1;
    }

    /* --- init --------------------------------------------------------- */
    layout();
    for (var i0 = 0; i0 < N; i0++) applyLookInstant(i0, S.idle);
    resize();

    var ro = null;
    if (typeof ResizeObserver === 'function') {
      ro = new ResizeObserver(function () { resize(); if (!running) draw(0); });
      ro.observe(canvas);
    }
    function onWinResize() { resize(); if (!running) draw(0); }
    window.addEventListener('resize', onWinResize);

    /* --- public API --------------------------------------------------- */
    var field = {
      get count() { return N; },
      get states() { return state; },
      get positions() { return positions; },
      get connections() {
        var out = new Array(lineCount);
        for (var l = 0; l < lineCount; l++) out[l] = [lineA[l], lineB[l]];
        return out;
      },
      get connectionCount() { return lineCount; },
      get pulseCount() { return pulseCount; },
      get fps() { return fps; },
      get frozen() { return frozen; },
      get width() { return W; },
      get height() { return H; },
      get pointSize() { return pointSize; },
      get canvas() { return canvas; },

      start: function () {
        if (running || destroyed) return field;
        running = true; lastT = 0;
        rafId = requestAnimationFrame(frame);
        return field;
      },
      stop: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        rafId = 0;
        return field;
      },
      /** Render one frame now (useful when stopped, e.g. after wipe()). */
      render: function () { draw(0); return field; },
      /** Advance the simulation by dt ms and render — for tests, rehearsal
          tooling and frame-by-frame recording. Not needed in scenes. */
      step: function (dt) {
        dt = dt === undefined ? 16.7 : dt;
        if (!frozen) now += dt;
        stepGlobal(gLine, dt); stepGlobal(gLight, dt);
        draw(dt);
        return field;
      },

      setState: function (id, st, o) {
        var si = stateIndex(st);
        var dur = o && o.duration !== undefined ? o.duration
          : (si === S.terminated ? TERMINATE_MS : TWEEN_MS);
        if (o && o.animate === false) dur = 0;
        setStateAt(id | 0, si, dur);
        return field;
      },
      setAll: function (st, o) {
        var si = stateIndex(st);
        var dur = o && o.duration !== undefined ? o.duration
          : (si === S.terminated ? TERMINATE_MS : TWEEN_MS);
        if (o && o.animate === false) dur = 0;
        for (var i = 0; i < N; i++) setStateAt(i, si, dur);
        return field;
      },
      getState: function (id) { return STATES[state[id | 0]]; },

      nearest: function (id, k) {
        id |= 0; k = k || 1;
        var x = positions[id * 2], y = positions[id * 2 + 1];
        var d = new Float32Array(N), idx = new Array(N);
        for (var i = 0; i < N; i++) {
          var dx = positions[i * 2] - x, dy = positions[i * 2 + 1] - y;
          d[i] = dx * dx + dy * dy; idx[i] = i;
        }
        idx.sort(function (p, q) { return d[p] - d[q]; });
        var out = [];
        for (var j = 0; j < N && out.length < k; j++) if (idx[j] !== id) out.push(idx[j]);
        return out;
      },
      /** ids within radius r (CSS px) of a point, nearest first. */
      within: function (x, y, r) {
        var out = [], r2 = r * r;
        for (var i = 0; i < N; i++) {
          var dx = positions[i * 2] - x, dy = positions[i * 2 + 1] - y;
          if (dx * dx + dy * dy <= r2) out.push(i);
        }
        out.sort(function (p, q) {
          var dp = (positions[p * 2] - x) * (positions[p * 2] - x) + (positions[p * 2 + 1] - y) * (positions[p * 2 + 1] - y);
          var dq = (positions[q * 2] - x) * (positions[q * 2] - x) + (positions[q * 2 + 1] - y) * (positions[q * 2 + 1] - y);
          return dp - dq;
        });
        return out;
      },
      pick: function (x, y) {
        var best = -1, bd = pointSize * pointSize;
        for (var i = 0; i < N; i++) {
          var dx = positions[i * 2] - x, dy = positions[i * 2 + 1] - y, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = i; }
        }
        return best;
      },

      connect: function (a, b, o) {
        a |= 0; b |= 0;
        if (a === b || a < 0 || b < 0 || a >= N || b >= N) return false;
        var key = lineKey(a, b);
        if (lineKeys.has(key)) return false;
        if (lineCount >= lineCap) growLines();
        lineA[lineCount] = a; lineB[lineCount] = b;
        lineBorn[lineCount] = (o && o.animate === false) ? -1e12 : now;
        lineKeys.set(key, lineCount);
        lineCount++;
        if (o && o.pulse) addPulse(a, b, o.duration || 600);
        return true;
      },
      disconnect: function (a, b) {
        var key = lineKey(a | 0, b | 0);
        var l = lineKeys.get(key);
        if (l === undefined) return false;
        lineKeys.delete(key);
        lineCount--;
        if (l !== lineCount) {
          lineA[l] = lineA[lineCount]; lineB[l] = lineB[lineCount]; lineBorn[l] = lineBorn[lineCount];
          lineKeys.set(lineKey(lineA[l], lineB[l]), l);
        }
        return true;
      },
      isConnected: function (a, b) { return lineKeys.has(lineKey(a | 0, b | 0)); },
      clearConnections: function () {
        lineCount = 0; lineKeys.clear(); pulseCount = 0;
        return field;
      },
      /** Fire a travelling pulse along an existing (or implied) line a→b. */
      pulse: function (a, b, duration) { addPulse(a | 0, b | 0, duration || 600); return field; },

      freezeAll: function () { frozen = true; return field; },
      unfreezeAll: function () { frozen = false; return field; },

      fadeLines: function (ms, to) {
        gLine.from = gLine.v; gLine.to = to === undefined ? 0 : to; gLine.t = 0;
        gLine.dur = Math.max(1, ms === undefined ? 800 : ms);
        if (reducedMotion()) { gLine.v = gLine.to; gLine.t = 1; }
        return field;
      },
      unfadeLines: function (ms) { return field.fadeLines(ms === undefined ? 600 : ms, 1); },
      dimAll: function (ms, to) {
        gLight.from = gLight.v; gLight.to = to === undefined ? 0.03 : to; gLight.t = 0;
        gLight.dur = Math.max(1, ms === undefined ? 1500 : ms);
        if (reducedMotion()) { gLight.v = gLight.to; gLight.t = 1; }
        return field;
      },
      undimAll: function (ms) { return field.dimAll(ms === undefined ? 600 : ms, 1); },

      /** Instant reset: no connections, no pulses, every light idle (or
          'off' with { off: true }), global multipliers back to 1. */
      wipe: function (o) {
        lineCount = 0; lineKeys.clear(); pulseCount = 0;
        frozen = false;
        gLine.v = gLine.from = gLine.to = 1; gLine.t = 1;
        gLight.v = gLight.from = gLight.to = 1; gLight.t = 1;
        var si = (o && o.off) ? S.off : S.idle;
        for (var i = 0; i < N; i++) { state[i] = si; applyLookInstant(i, si); flick[i] = 0; }
        if (!running) draw(0);
        return field;
      },

      resize: function () { resize(); return field; },
      destroy: function () {
        field.stop();
        destroyed = true;
        if (ro) ro.disconnect();
        window.removeEventListener('resize', onWinResize);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    };
    return field;
  }

  /* =====================================================================
     Robot.Figure — the up-close little machine (SVG). Its eye is driven by
     the same LOOK table and breathing maths as a field point, from one
     shared rAF loop, so a figure and a point are visibly the same light.
     ===================================================================== */
  var FIGURE_CSS = [
    '.rb-figure{display:inline-block;line-height:0;position:relative}',
    '.rb-figure svg{display:block;overflow:visible}',
    '.rb-figure .rb-body{fill:var(--robot-body,#2a2c33)}',
    '.rb-figure .rb-panel{fill:var(--robot-panel,#353841)}',
    '.rb-figure .rb-dark{fill:var(--robot-shadow,#1c1d22)}',
    '.rb-figure .rb-line{stroke:var(--robot-shadow,#1c1d22);stroke-width:1.5;stroke-linecap:round}',
    '.rb-figure .rb-eye,.rb-figure .rb-glow,.rb-figure .rb-false{transform-box:fill-box;transform-origin:center;transition:fill 600ms cubic-bezier(.22,.61,.36,1)}',
    '.rb-figure .rb-socket{fill:#0a0a0a}'
  ].join('\n');
  var figureStyleInjected = false;
  function injectFigureCss() {
    if (figureStyleInjected) return;
    figureStyleInjected = true;
    var st = document.createElement('style');
    st.setAttribute('data-robot-figure', '');
    st.textContent = FIGURE_CSS;
    document.head.appendChild(st);
  }

  var figures = [];
  var figRaf = 0, figLast = 0;
  function figLoop(ts) {
    figRaf = figures.length ? requestAnimationFrame(figLoop) : 0;
    var dt = figLast ? Math.min(100, ts - figLast) : 16.7;
    figLast = ts;
    for (var i = 0; i < figures.length; i++) figures[i]._tick(dt);
  }
  function ensureFigLoop() { if (!figRaf) { figLast = 0; figRaf = requestAnimationFrame(figLoop); } }

  var figSeq = 0;
  function createFigure(container, opts) {
    opts = opts || {};
    injectFigureCss();
    var size = opts.size || 160;
    var antenna = opts.antenna !== false;
    var rng = makeRng(opts.seed === undefined ? (1000 + figSeq++) : opts.seed);
    var periodMul = 0.77 + 0.46 * rng();
    var phase = rng() * TWO_PI;

    var NS = 'http://www.w3.org/2000/svg';
    function el(tag, attrs) {
      var e = document.createElementNS(NS, tag);
      for (var k in attrs) e.setAttribute(k, attrs[k]);
      return e;
    }

    var root = document.createElement('div');
    root.className = 'rb-figure';
    root.style.width = size + 'px';
    root.style.height = size + 'px';

    var svg = el('svg', { viewBox: '0 0 100 100', width: size, height: size, 'aria-hidden': 'true' });

    // Antenna: a stub, slightly off-centre, with a dull tip (no light — the
    // eye carries all the state).
    if (antenna) {
      svg.appendChild(el('line', { x1: 41, y1: 21, x2: 41, y2: 12, 'class': 'rb-line' }));
      svg.appendChild(el('circle', { cx: 41, cy: 10.5, r: 2.4, 'class': 'rb-dark' }));
    }
    // Head
    svg.appendChild(el('rect', { x: 29, y: 20, width: 42, height: 30, rx: 4, 'class': 'rb-body' }));
    // Eye socket + glow + eye + false-hue overlay
    svg.appendChild(el('circle', { cx: 50, cy: 35, r: 8.5, 'class': 'rb-socket' }));
    var glow = el('circle', { cx: 50, cy: 35, r: 13, 'class': 'rb-glow' });
    var eye = el('circle', { cx: 50, cy: 35, r: 6.5, 'class': 'rb-eye' });
    var falseEye = el('circle', { cx: 50, cy: 35, r: 6.5, 'class': 'rb-false', fill: COLOURS[C_FALSE] });
    svg.appendChild(glow); svg.appendChild(eye); svg.appendChild(falseEye);
    // Neck
    svg.appendChild(el('rect', { x: 45, y: 50, width: 10, height: 5, 'class': 'rb-dark' }));
    // Body with one lighter panel and two vent lines
    svg.appendChild(el('rect', { x: 23, y: 55, width: 54, height: 33, rx: 4, 'class': 'rb-body' }));
    svg.appendChild(el('rect', { x: 29, y: 61, width: 18, height: 21, rx: 2, 'class': 'rb-panel' }));
    svg.appendChild(el('line', { x1: 55, y1: 66, x2: 69, y2: 66, 'class': 'rb-line' }));
    svg.appendChild(el('line', { x1: 55, y1: 72, x2: 69, y2: 72, 'class': 'rb-line' }));
    // Feet
    svg.appendChild(el('rect', { x: 29, y: 88, width: 15, height: 6, rx: 1.5, 'class': 'rb-dark' }));
    svg.appendChild(el('rect', { x: 56, y: 88, width: 15, height: 6, rx: 1.5, 'class': 'rb-dark' }));
    root.appendChild(svg);
    container.appendChild(root);

    // Eye look state (mirrors the field's per-point tween).
    var st = S.idle, colA = C_AMBER, colB = C_AMBER;
    var fA = 0, tA = 0, fAmp = 0, tAmp = 0, fPer = 3, tPer = 3, fSc = 1, tSc = 1;
    var twT = 1, twDur = 1, ph = phase, flick = 0, now = 0;

    function applyInstant(si) {
      var L = LOOK[si];
      colA = colB = L[0]; fA = tA = L[1]; fAmp = tAmp = L[2]; fPer = tPer = L[3]; fSc = tSc = L[4];
      twT = 1;
      eye.style.fill = COLOURS[colB]; glow.style.fill = COLOURS[colB];
    }
    applyInstant(S.idle);

    var fig = {
      el: root,
      svg: svg,
      get state() { return STATES[st]; },
      setState: function (s, o) {
        var si = stateIndex(s);
        var dur = o && o.duration !== undefined ? o.duration : (si === S.terminated ? TERMINATE_MS : TWEEN_MS);
        if (o && o.animate === false) dur = 0;
        st = si;
        if (dur <= 0) applyInstant(si);
        else {
          var e = twT >= 1 ? 1 : easeOutCubic(twT);
          fA += (tA - fA) * e; fAmp += (tAmp - fAmp) * e; fPer += (tPer - fPer) * e; fSc += (tSc - fSc) * e;
          if (e >= 0.5) colA = colB;
          var L = LOOK[si];
          colB = L[0]; tA = L[1]; tAmp = L[2]; tPer = L[3]; tSc = L[4];
          twT = 0; twDur = dur;
          eye.style.fill = COLOURS[colB]; glow.style.fill = COLOURS[colB];   // CSS transitions the fill
        }
        flick = (si === S.deceive) ? (now || 1) : 0;
        return fig;
      },
      _tick: function (dt) {
        now += dt;
        var rm = reducedMotion();
        var e;
        if (twT < 1) { twT += dt / twDur; if (twT > 1) twT = 1; e = easeOutCubic(twT); } else e = 1;
        var a = fA + (tA - fA) * e, amp = fAmp + (tAmp - fAmp) * e, per = fPer + (tPer - fPer) * e, sc = fSc + (tSc - fSc) * e;
        if (!rm) ph += (dt * 0.001) * TWO_PI / (per * periodMul);
        var b = rm ? 0.5 : 0.5 - 0.5 * Math.cos(ph);
        var alpha = a * (1 - amp + amp * b);
        var scale = sc * (0.88 + 0.24 * b);
        var fl = 0;
        if (flick > 0) {
          var ft = (now - flick) / FLICKER_MS;
          if (ft >= 1) { if (now - flick > FLICKER_EVERY_MS * periodMul) flick = now; }
          else fl = flickerEnvelope(ft);
        }
        eye.style.opacity = alpha * (1 - fl);
        eye.style.transform = 'scale(' + scale.toFixed(3) + ')';
        glow.style.opacity = alpha * 0.35 * (1 - fl);
        glow.style.transform = 'scale(' + (scale * 1.05).toFixed(3) + ')';
        falseEye.style.opacity = alpha * fl;
        falseEye.style.transform = eye.style.transform;
      },
      destroy: function () {
        var i = figures.indexOf(fig);
        if (i >= 0) figures.splice(i, 1);
        if (root.parentNode) root.parentNode.removeChild(root);
      }
    };
    if (opts.state) fig.setState(opts.state, { animate: false });
    figures.push(fig);
    ensureFigLoop();
    fig._tick(0);
    return fig;
  }

  window.Robot = {
    STATES: STATES,
    COLOURS: { idle: COLOURS[C_AMBER], active: COLOURS[C_GOLD], adversarial: COLOURS[C_CRIMSON], falseHue: COLOURS[C_FALSE], line: LINE_COLOUR },
    LOOK: LOOK,
    get reducedMotion() { return reducedMotion(); },
    Field: { create: createField },
    Figure: {
      create: createFigure,
      /** Advance every live figure by dt ms (tests / recording). */
      step: function (dt) { for (var i = 0; i < figures.length; i++) figures[i]._tick(dt === undefined ? 16.7 : dt); }
    }
  };
})();
