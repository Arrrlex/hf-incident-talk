/* ==========================================================================
   mesh.js: the one mesh that Emergence grows and the Silence starts from.

   Both scenes build their field with the same seed, so the 1,200 points sit
   in the same places. This helper turns that layout into one deterministic
   plan: which two points connect first, the order in which the cascade
   reaches every other point, and the final set of lines. Emergence plays
   the plan wave by wave; the Silence applies the end state in one go, so
   the hand-off between the two pages is pixel-identical.

   Classic script, no modules: sets window.Mesh. Depends on nothing but a
   Robot.Field instance passed in.

     var plan = Mesh.plan(field);         // deterministic, ~5ms for 1,200 points
     Mesh.applyPair(field, plan, animate) // beat 1 of Emergence
     Mesh.applyFull(field, plan)          // end state (instant, idempotent)

   plan = {
     pair:   [a, b],                      // the first two agents to find each other
     waves:  [{ nodes: [...], links: [[a, b], ...] }, ...],
     delays: [ms, ...],                   // gap after each wave (delays.length === waves.length)
     edges:  [[a, b], ...],               // every line in the finished mesh
     lit:    Uint8Array                   // 1 = ends up 'active', 0 = stays 'idle'
   }
   ========================================================================== */
(function () {
  'use strict';

  var DEFAULTS = {
    k: 3,                 // nearest neighbours per point → ~2,900 lines for 1,200 points
    idleFraction: 0.08,   // a few agents never post: they stay dim amber in the mesh
    pairAt: [0.40, 0.52], // where the first pair sits (fraction of width, height): centre-left
    firstWave: 2,         // wave sizes grow geometrically from here…
    growth: 1.5,          // …by this factor per wave
    firstDelay: 700,      // ms after wave 0; each later gap shrinks by `decay`
    decay: 0.85,
    minDelay: 70,
    lastDelay: 600        // hold after the final wave while the last tweens land
  };

  // Small deterministic PRNG (mulberry32) so the idle subset is fixed per seed.
  function makeRng(seed) {
    var a = (seed | 0) >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // k nearest neighbours for every point, by brute force with a running
  // top-k. 1,200² distance checks is ~1.4M: a few milliseconds, and far
  // cheaper than sorting the whole array once per point.
  function knnAll(positions, n, k) {
    var out = new Array(n);
    var bestD = new Float64Array(k), bestI = new Int32Array(k);
    for (var i = 0; i < n; i++) {
      var x = positions[i * 2], y = positions[i * 2 + 1];
      var filled = 0;
      for (var j = 0; j < n; j++) {
        if (j === i) continue;
        var dx = positions[j * 2] - x, dy = positions[j * 2 + 1] - y, d = dx * dx + dy * dy;
        if (filled === k && d >= bestD[k - 1]) continue;
        var p = filled < k ? filled : k - 1;
        while (p > 0 && bestD[p - 1] > d) { bestD[p] = bestD[p - 1]; bestI[p] = bestI[p - 1]; p--; }
        bestD[p] = d; bestI[p] = j;
        if (filled < k) filled++;
      }
      var arr = new Array(filled);
      for (var q = 0; q < filled; q++) arr[q] = bestI[q];
      out[i] = arr;
    }
    return out;
  }

  function plan(field, opts) {
    var o = {};
    for (var key in DEFAULTS) o[key] = DEFAULTS[key];
    for (var key2 in (opts || {})) o[key2] = opts[key2];

    var n = field.count, pos = field.positions, W = field.width, H = field.height;
    var knn = knnAll(pos, n, o.k);

    // Undirected adjacency: my nearest, plus anyone who counts me as theirs.
    var adj = new Array(n);
    for (var i = 0; i < n; i++) adj[i] = [];
    for (i = 0; i < n; i++) {
      for (var j = 0; j < knn[i].length; j++) {
        var m = knn[i][j];
        if (adj[i].indexOf(m) < 0) adj[i].push(m);
        if (adj[m].indexOf(i) < 0) adj[m].push(i);
      }
    }
    // Nearest first, so lines shoot to close neighbours before far ones.
    function byDistFrom(a) {
      return function (p, q) {
        var dp = Math.hypot(pos[p * 2] - pos[a * 2], pos[p * 2 + 1] - pos[a * 2 + 1]);
        var dq = Math.hypot(pos[q * 2] - pos[a * 2], pos[q * 2 + 1] - pos[a * 2 + 1]);
        return dp - dq;
      };
    }
    for (i = 0; i < n; i++) adj[i].sort(byDistFrom(i));

    // The first pair: the point closest to the chosen spot, and its nearest neighbour.
    var seed = field.within(W * o.pairAt[0], H * o.pairAt[1], Math.max(W, H))[0];
    var partner = field.nearest(seed, 1)[0];

    // Which points end up 'active'. The pair always does.
    var rng = makeRng(n * 31 + seed);
    var lit = new Uint8Array(n);
    for (i = 0; i < n; i++) lit[i] = rng() < o.idleFraction ? 0 : 1;
    lit[seed] = 1; lit[partner] = 1;

    // Breadth-first from the pair, cut into geometrically growing waves.
    var reached = new Uint8Array(n);   // queued or done
    var done = new Uint8Array(n);
    var queue = [seed, partner], head = 0;
    reached[seed] = reached[partner] = 1;
    var linked = new Set();
    function edgeKey(a, b) { return a < b ? a * n + b : b * n + a; }
    var edges = [[seed, partner]];
    linked.add(edgeKey(seed, partner));

    var waves = [], delays = [];
    var size = o.firstWave, doneCount = 0, w = 0;

    function bridge() {
      // The k-NN graph can have islands. Join the nearest unreached point to
      // the nearest reached one so the wave keeps spreading spatially.
      var best = -1, bestR = -1, bd = Infinity;
      for (var u = 0; u < n; u++) {
        if (reached[u]) continue;
        for (var r = 0; r < n; r++) {
          if (!done[r]) continue;
          var dx = pos[u * 2] - pos[r * 2], dy = pos[u * 2 + 1] - pos[r * 2 + 1], d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = u; bestR = r; }
        }
      }
      if (best < 0) return null;
      reached[best] = 1;
      queue.push(best);
      return [bestR, best];
    }

    while (doneCount < n) {
      var wave = { nodes: [], links: [] };
      var take = Math.min(Math.round(size), n - doneCount);
      for (var t = 0; t < take; t++) {
        if (head >= queue.length) {
          var br = bridge();
          if (!br) break;
          linked.add(edgeKey(br[0], br[1])); edges.push(br); wave.links.push(br);
        }
        var a = queue[head++];
        done[a] = 1; doneCount++;
        wave.nodes.push(a);
        var nb = adj[a];
        for (var q = 0; q < nb.length; q++) {
          var b = nb[q];
          var ek = edgeKey(a, b);
          if (!linked.has(ek)) { linked.add(ek); edges.push([a, b]); wave.links.push([a, b]); }
          if (!reached[b]) { reached[b] = 1; queue.push(b); }
        }
      }
      waves.push(wave);
      var gap = Math.max(o.minDelay, Math.round(o.firstDelay * Math.pow(o.decay, w)));
      delays.push(gap);
      size *= o.growth;
      w++;
    }
    delays[delays.length - 1] = o.lastDelay;

    return { pair: [seed, partner], waves: waves, delays: delays, edges: edges, lit: lit, knn: knn };
  }

  /* Beat 1 of Emergence: one line, one pulse, two lights. */
  function applyPair(field, p, animate) {
    var a = p.pair[0], b = p.pair[1];
    field.connect(a, b, { animate: animate });
    if (animate) {
      // 'transmit' sends a pulse along every line the agent has: here, just the one.
      field.setState(a, 'transmit');
      return Scene.wait(600).then(function () { field.setState(b, 'active'); });
    }
    // Jumping straight to the end state: no pulse ('transmit' would fire one on entry).
    field.setState(a, 'active', { animate: false });
    field.setState(b, 'active', { animate: false });
    return Promise.resolve();
  }

  /* The finished mesh, instantly. Safe to call on a field that already has
     some or all of it (connect() ignores duplicates). */
  function applyFull(field, p) {
    for (var e = 0; e < p.edges.length; e++) field.connect(p.edges[e][0], p.edges[e][1], { animate: false });
    for (var i = 0; i < field.count; i++) field.setState(i, p.lit[i] ? 'active' : 'idle', { animate: false });
    return field;
  }

  window.Mesh = { plan: plan, applyPair: applyPair, applyFull: applyFull, DEFAULTS: DEFAULTS };
})();
