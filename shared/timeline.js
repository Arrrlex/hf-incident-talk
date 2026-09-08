/* ==========================================================================
   timeline.js: the timeline spine (brief §8).

   A thin horizontal band, in the cold register, that runs along the bottom
   of every slide of the talk (the deck mounts it once; scenes may also mount
   their own copy): one hairline, phases as short cyan segments above it, the
   wipe / termination / shutdown / disclosure points as small ticks, and
   a separate context lane for collusion.wiki.
   Items are lit BY ID, in any order (the talk opens with the wiki strand and
   only then walks the three OpenAI boards), so the recurrence
   (build → wipe → build → mass termination → build → shutdown) reads at a
   glance whatever the running order. A marker sits on the most recently lit
   item.

   It is the timeline of what is KNOWN: the small caption at the far left
   says so, because there has been no comprehensive independent investigation.

   Orientation only, not a data viz. Everything is positioned in % of the
   container's width and relative to the band's vertical centre, so it can be
   dropped into any container at any height (--tl-height, default 76px)
   without measuring anything. Nothing here advances on a timer.

   Classic script, no modules: sets window.Timeline. See shared/README.md.
   ========================================================================== */
(function () {
  'use strict';

  var rmMQ = (typeof matchMedia === 'function') ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(rmMQ && rmMQ.matches); }

  /* ---------------------------------------------------------------------
     Default data: dates from FACTS.md. Item order is the legacy
     step order used by setStep(); the deck lights by id instead.
     Labels may contain '\n' for a manual line break. `side` puts a label
     above or below the line (phases default above, marks below); above
     labels are left-aligned at their anchor, below labels are centred on
     it. Sides here are chosen so nothing collides at 1920 wide.
     --------------------------------------------------------------------- */
  var DEFAULT_DATA = {
    caption: 'what is known so far',
    /* Piecewise-linear axis: keep the May–early July lead-in compact and give
       the incident dates most of the width. */
    axis: {
      start: '2026-05-01', pivot: '2026-07-04', pivotAt: 0.18, end: '2026-07-28',
      stops: [
        { date: '2026-05-01', at: 0 },
        { date: '2026-07-04', at: 0.18 },
        { date: '2026-07-28', at: 1 }
      ]
    },
    items: [
      { id: 'board1',   kind: 'phase', from: '2026-05-12', to: '2026-07-06', label: 'May–Jun · training · board #1' },
      { id: 'board2',   kind: 'phase', from: '2026-07-08', to: '2026-07-13', label: '8–13 Jul · eval\nboard #2 · Hugging Face' },
      { id: 'board3',   kind: 'phase', from: '2026-07-13', to: '2026-07-19', label: '19 Jul · board #3\nOpenAI cluster', tone: 'adversarial' },
    ],
    /* Separate, probably-distinct swarm (FACTS.md §9). Its dates use the same
       axis as the main strand rather than a detached right-hand scale. */
    detached: {
      id: 'wiki', from: '2026-05-11', to: '2026-07-02',
      label: '24 May–2 Jul · German wiki (separate swarm)'
    }
  };

  var CSS = [
    '.tl{position:relative;height:var(--tl-height,76px);font:400 15px/18px ui-monospace,"JetBrains Mono","SF Mono",Menlo,monospace;',
    '  color:var(--text-dim,#8a8b92);letter-spacing:.02em;white-space:nowrap;pointer-events:none}',
    '.tl *{box-sizing:border-box}',
    '.tl-strand{position:absolute;top:0;height:100%}',
    '.tl-line{position:absolute;left:0;right:0;top:50%;height:1px;background:var(--text-dim,#8a8b92);opacity:.35}',
    '.tl-secondary{top:0;height:100%}',
    '.tl-secondary .tl-line{top:16%;opacity:.28}',
    '.tl-phase{position:absolute;top:50%;height:4px;margin-top:-2px;background:var(--light-active,#ff9416);opacity:.3;',
    '  transition:opacity 400ms cubic-bezier(.22,.61,.36,1)}',
    '.tl-phase.tone-adversarial{background:var(--adversarial,#e0483f)}',
    '.tl-secondary .tl-phase{top:16%;margin-top:-2px;background:var(--light-active,#ff9416);opacity:.4}',
    '.tl-mark{position:absolute;top:50%;width:6px;height:6px;margin:-3px 0 0 -3px;border-radius:50%;background:var(--text,#e8e8ea);opacity:.3;',
    '  transition:opacity 400ms cubic-bezier(.22,.61,.36,1)}',
    '.tl-label{position:absolute;opacity:.6;transition:color 400ms,opacity 400ms}',
    '.tl-label.above{bottom:calc(50% + 8px)}',
    '.tl-label.below{top:calc(50% + 11px);transform:translateX(-50%);text-align:center}',
    '.tl-secondary .tl-label.above{top:calc(16% - 22px);bottom:auto}',
    '.tl-secondary .tl-label.below{top:calc(16% + 8px)}',
    '.tl-label div{display:block}',
    /* The "what is known" caption: quiet, far left, above the line. Sits at
       the top edge of a 76px band and 10px down in a 96px one. */
    '.tl-caption{position:absolute;right:0;top:0;font-size:13px;line-height:13px;letter-spacing:.06em;opacity:.55}',
    /* Context lane notes stay quieter than the main event labels. */
    '.tl-note{font-size:13px;line-height:15px;opacity:.45}',
    '.is-past .tl-phase,.is-current .tl-phase{opacity:1}',
    '.is-past .tl-mark,.is-current .tl-mark{opacity:1}',
    '.is-past .tl-label{opacity:1}',
    '.is-current .tl-label{opacity:1;color:var(--text,#e8e8ea)}',
    '.tl-marker{position:absolute;top:4%;height:92%;width:3px;margin-left:-1.5px;border-radius:1.5px;',
    '  background:var(--text,#ffffff);box-shadow:0 0 8px rgba(255,148,22,.8);opacity:0;transition:left 400ms cubic-bezier(.22,.61,.36,1),opacity 400ms}',
    '.tl-marker.is-on{opacity:1}',
    '.tl.no-anim *{transition:none!important}',
    '@media (prefers-reduced-motion: reduce){.tl *{transition:none!important}}'
  ].join('\n');

  var styleInjected = false;
  function injectCss() {
    if (styleInjected) return;
    styleInjected = true;
    var st = document.createElement('style');
    st.setAttribute('data-timeline', '');
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  /* ---------------------------------------------------------------------
     Dates → fraction of the main strand
     --------------------------------------------------------------------- */
  function days(iso) {
    var p = String(iso).split('-');
    return Date.UTC(+p[0], (+p[1]) - 1, +p[2]) / 86400000;
  }
  function makeScale(axis) {
    if (axis.stops && axis.stops.length > 1) {
      var stops = axis.stops.map(function (stop) {
        return { day: days(stop.date), at: Number(stop.at) };
      });
      return function (iso) {
        var d = days(iso);
        if (d <= stops[0].day) return Math.max(0, Math.min(1, stops[0].at));
        for (var i = 1; i < stops.length; i += 1) {
          if (d <= stops[i].day) {
            var prev = stops[i - 1], next = stops[i];
            var f = prev.at + (d - prev.day) / (next.day - prev.day) * (next.at - prev.at);
            return Math.max(0, Math.min(1, f));
          }
        }
        return Math.max(0, Math.min(1, stops[stops.length - 1].at));
      };
    }
    var s = days(axis.start), e = days(axis.end);
    var p = axis.pivot ? days(axis.pivot) : null;
    var pa = axis.pivotAt === undefined ? 0.5 : axis.pivotAt;
    return function (iso) {
      var d = Math.max(s, Math.min(e, days(iso)));
      var f;
      if (p === null) f = (d - s) / (e - s);
      else if (d <= p) f = (d - s) / (p - s) * pa;
      else f = pa + (d - p) / (e - p) * (1 - pa);
      return Math.max(0, Math.min(1, f));
    };
  }

  function div(className, parent) {
    var d = document.createElement('div');
    if (className) d.className = className;
    if (parent) parent.appendChild(d);
    return d;
  }
  function label(text, where, parent) {
    var l = div('tl-label ' + where, parent);
    String(text).split('\n').forEach(function (line) { div('', l).textContent = line; });
    return l;
  }
  function pct(f) { return (f * 100).toFixed(3) + '%'; }

  /* ---------------------------------------------------------------------
     Timeline.create(containerEl, { data, step, lit, mainWidth, detachedWidth })
     --------------------------------------------------------------------- */
  function create(container, opts) {
    if (!container) throw new Error('Timeline.create: a container element is required');
    opts = opts || {};
    injectCss();
    var data = opts.data || DEFAULT_DATA;
    var items = data.items || [];
    var detached = data.detached || null;
    var mainW = opts.mainWidth !== undefined ? opts.mainWidth : 1;
    var detW = opts.detachedWidth !== undefined ? opts.detachedWidth : 0.14;
    var scale = makeScale(data.axis);
    var SEG_INSET = 3;   // px trimmed off each end of a phase so touching phases stay distinct
    var TICK_GAP = 6;    // px between a tick and its label when the label sits above (left-aligned)

    var root = div('tl');
    container.appendChild(root);

    if (data.caption) div('tl-caption', root).textContent = data.caption;

    // Main strand
    var main = div('tl-strand', root);
    main.style.left = '0'; main.style.width = pct(mainW);
    div('tl-line', main);

    // Items are addressed by id; `order` is the legacy step order (items, then
    // the detached strand). Anchors are in % of the whole container.
    var byId = {};    // id -> { el, anchor }
    var order = [];
    function register(id, el, anchor, lane) {
      id = String(id);
      if (byId[id]) console.warn('Timeline: duplicate item id "' + id + '"');
      byId[id] = { el: el, anchor: anchor, lane: lane || 50 };
      order.push(id);
    }

    items.forEach(function (it, i) {
      var wrap = div('tl-item', main);
      var anchor;
      if (it.kind === 'phase') {
        var a = scale(it.from), b = scale(it.to);
        var seg = div('tl-phase' + (it.tone ? ' tone-' + it.tone : ''), wrap);
        seg.style.left = 'calc(' + pct(a) + ' + ' + SEG_INSET + 'px)';
        seg.style.width = 'calc(' + pct(b - a) + ' - ' + (2 * SEG_INSET) + 'px)';
        var side = it.side === 'below' ? 'below' : 'above';
        var lb = label(it.label, side, wrap);
        lb.style.left = side === 'below' ? pct((a + b) / 2) : pct(a);
        anchor = (a + b) / 2 * mainW;
      } else {
        var x = scale(it.at);
        div('tl-mark', wrap).style.left = pct(x);
        var mside = it.side === 'above' ? 'above' : 'below';
        var ml = label(it.label, mside, wrap);
        ml.style.left = mside === 'above' ? 'calc(' + pct(x) + ' + ' + TICK_GAP + 'px)' : pct(x);
        anchor = x * mainW;
      }
      register(it.id !== undefined ? it.id : 'item' + i, wrap, anchor, 50);
    });

    // Context strand for the separate swarm. It shares the main date scale and
    // sits above the event line.
    if (detached) {
      var hasDetachedDates = detached.from !== undefined && detached.to !== undefined;
      var det = div('tl-strand tl-item' + (hasDetachedDates ? ' tl-secondary' : ''), root);
      det.style.left = hasDetachedDates ? '0' : 'auto';
      det.style.right = hasDetachedDates ? 'auto' : '0';
      det.style.width = pct(hasDetachedDates ? mainW : detW);
      div('tl-line', det);
      var dseg = div('tl-phase', det);
      var detA = hasDetachedDates ? scale(detached.from) : 0.06;
      var detB = hasDetachedDates ? scale(detached.to) : 0.94;
      dseg.style.left = hasDetachedDates
        ? 'calc(' + pct(detA) + ' + ' + SEG_INSET + 'px)'
        : '6%';
      dseg.style.width = hasDetachedDates
        ? 'calc(' + pct(detB - detA) + ' - ' + (2 * SEG_INSET) + 'px)'
        : '88%';
      label(detached.label, 'above', det).style.left = hasDetachedDates ? pct(detA) : '0';
      if (detached.note) {
        var note = label(detached.note, 'below', det);
        note.classList.add('tl-note');
        note.style.left = hasDetachedDates ? pct((detA + detB) / 2) : '50%';
      }
      register(detached.id !== undefined ? detached.id : 'detached', det,
        hasDetachedDates ? (detA + detB) / 2 * mainW : 1 - detW / 2, hasDetachedDates ? 16 : 50);
    }

    var marker = div('tl-marker', root);

    var lit = [];   // ids currently lit, in the order given; the last one carries the marker
    var cursorDate = null;   // 'YYYY-MM-DD' for the time cursor; null = sit on the last lit item

    function render(animate) {
      if (!animate) root.classList.add('no-anim');
      var last = lit.length ? lit[lit.length - 1] : null;
      var on = {};
      lit.forEach(function (id) { on[id] = true; });
      order.forEach(function (id) {
        var el = byId[id].el;
        el.classList.toggle('is-past', !!on[id] && id !== last);
        el.classList.toggle('is-current', id === last);
      });
      if (cursorDate) {
        // A "current time" cursor at a given date, spanning both lanes.
        marker.style.left = pct(scale(cursorDate) * mainW);
        marker.classList.add('is-on');
      } else if (last !== null) {
        marker.style.left = pct(byId[last].anchor);
        marker.classList.add('is-on');
      } else {
        marker.classList.remove('is-on');
      }
      root.setAttribute('data-step', String(lit.length));
      root.setAttribute('data-lit', lit.join(','));
      if (!animate) {
        void root.offsetWidth;                 // flush with transitions off
        requestAnimationFrame(function () { root.classList.remove('no-anim'); });
      }
    }

    function wantAnimate(o) { return !(o && o.animate === false) && !reducedMotion(); }

    var tl = {
      el: root,
      data: data,
      /** Ids in item order (detached last): the order setStep() walks. */
      get ids() { return order.slice(); },
      /** Ids currently lit, in the order they were given. */
      get lit() { return lit.slice(); },
      /** Number of lit items (equals i after setStep(i)). */
      get step() { return lit.length; },
      get steps() { return order.length + 1; },
      /**
       * Light exactly the items whose ids are listed (everything else unlit)
       * and put the cursor at `o.at` ('YYYY-MM-DD') if given, else on the last
       * id. An empty array clears the band. Unknown ids are dropped with a warning.
       */
      setLit: function (ids, o) {
        cursorDate = (o && o.at) ? String(o.at) : null;
        var seen = {}, next = [];
        (ids || []).forEach(function (id) {
          id = String(id);
          if (!byId[id]) { console.warn('Timeline.setLit: unknown id "' + id + '"'); return; }
          if (seen[id]) return;
          seen[id] = true;
          next.push(id);
        });
        lit = next;
        render(wantAnimate(o));
        return tl;
      },
      /** Legacy: light the first i items in item order (detached last); step 0 = nothing lit. */
      setStep: function (i, o) {
        i = Math.max(0, Math.min(order.length, i | 0));
        return tl.setLit(order.slice(0, i), o);
      },
      next: function (o) { return tl.setStep(lit.length + 1, o); },
      prev: function (o) { return tl.setStep(lit.length - 1, o); },
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
    };

    if (opts.lit) tl.setLit(opts.lit, { animate: false });
    else tl.setStep(opts.step | 0, { animate: false });
    return tl;
  }

  window.Timeline = {
    create: create,
    DEFAULT_DATA: DEFAULT_DATA,
    get reducedMotion() { return reducedMotion(); }
  };
})();
