/* ==========================================================================
   timeline.js — the timeline spine (brief §8).

   A thin horizontal band for the top of any scene, in the cold register: one
   hairline, phases as short cyan segments above it, the wipe / termination /
   shutdown points as small ticks, and the collusion.wiki strand as a detached
   short line set apart on the right. A progress marker the scene advances
   lights the items up in order, so the recurrence (build → wipe → build →
   mass termination → build → shutdown) reads at a glance.

   Orientation only, not a data viz. Everything is positioned in % of the
   container's width, so the band can be dropped into any container inside
   a .stage without measuring anything. Nothing here advances on a timer.

   Classic script, no modules: sets window.Timeline. See shared/README.md.
   ========================================================================== */
(function () {
  'use strict';

  var rmMQ = (typeof matchMedia === 'function') ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(rmMQ && rmMQ.matches); }

  /* ---------------------------------------------------------------------
     Default data — dates from FACTS.md §5 only. Items are in step order.
     Labels may contain '\n' for a manual line break (keeps neighbours from
     colliding in the crowded July stretch).
     --------------------------------------------------------------------- */
  var DEFAULT_DATA = {
    /* Piecewise-linear axis: May–early July is compressed into the first
       30% of the strand so the fortnight that matters has room to breathe. */
    axis: { start: '2026-05-01', pivot: '2026-07-04', pivotAt: 0.30, end: '2026-07-26' },
    items: [
      { kind: 'phase', from: '2026-05-12', to: '2026-07-06', label: 'May–Jun · training · board #1' },
      { kind: 'mark',  at: '2026-07-06', label: '6 Jul · wiped' },
      { kind: 'phase', from: '2026-07-08', to: '2026-07-13', label: '8–13 Jul · eval\nboard #2 · Hugging Face' },
      { kind: 'mark',  at: '2026-07-12', label: '12 Jul · mass termination\n(cause unknown)' },
      { kind: 'phase', from: '2026-07-13', to: '2026-07-19', label: '19 Jul · board #3\nOpenAI cluster', tone: 'adversarial' },
      { kind: 'mark',  at: '2026-07-19', label: '19–25 Jul · shutdown' }
    ],
    /* Separate, probably-distinct swarm (FACTS.md §9). Not on the shared axis. */
    detached: { label: '11 May–2 Jul · collusion.wiki\n(separate swarm)' }
  };

  var CSS = [
    '.tl{position:relative;height:76px;font:13px/16px ui-monospace,"JetBrains Mono","SF Mono",Menlo,monospace;',
    '  color:var(--text-dim,#8a8b92);letter-spacing:.02em;white-space:nowrap;pointer-events:none}',
    '.tl *{box-sizing:border-box}',
    '.tl-strand{position:absolute;top:0;height:100%}',
    '.tl-line{position:absolute;left:0;right:0;top:50%;height:1px;background:var(--text-dim,#8a8b92);opacity:.35}',
    '.tl-phase{position:absolute;top:50%;height:3px;margin-top:-1px;background:var(--line,#4fd6e0);opacity:.22;',
    '  transition:opacity 400ms cubic-bezier(.22,.61,.36,1)}',
    '.tl-phase.tone-adversarial{background:var(--adversarial,#e0483f)}',
    '.tl-mark{position:absolute;top:50%;width:1.5px;height:14px;margin:-7px 0 0 -.75px;background:var(--text,#e8e8ea);opacity:.3;',
    '  transition:opacity 400ms cubic-bezier(.22,.61,.36,1)}',
    '.tl-label{position:absolute;opacity:.42;transition:color 400ms,opacity 400ms}',
    '.tl-label.above{bottom:calc(50% + 10px)}',
    '.tl-label.below{top:calc(50% + 11px);transform:translateX(-50%);text-align:center}',
    '.tl-label div{display:block}',
    '.is-past .tl-phase,.is-current .tl-phase{opacity:.85}',
    '.is-past .tl-mark,.is-current .tl-mark{opacity:1}',
    '.is-past .tl-label{opacity:1}',
    '.is-current .tl-label{opacity:1;color:var(--text,#e8e8ea)}',
    '.tl-marker{position:absolute;top:50%;width:7px;height:7px;margin:-3px 0 0 -3.5px;border-radius:50%;',
    '  background:var(--text,#e8e8ea);opacity:0;transition:left 400ms cubic-bezier(.22,.61,.36,1),opacity 400ms}',
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
     Timeline.create(containerEl, { data, step, mainWidth, detachedWidth })
     --------------------------------------------------------------------- */
  function create(container, opts) {
    if (!container) throw new Error('Timeline.create: a container element is required');
    opts = opts || {};
    injectCss();
    var data = opts.data || DEFAULT_DATA;
    var items = data.items || [];
    var detached = data.detached || null;
    var mainW = opts.mainWidth !== undefined ? opts.mainWidth : (detached ? 0.82 : 1);
    var detW = opts.detachedWidth !== undefined ? opts.detachedWidth : (detached ? 0.14 : 0);
    var scale = makeScale(data.axis);
    var SEG_INSET = 3;   // px trimmed off each end of a phase so touching phases stay distinct

    var root = div('tl');
    container.appendChild(root);

    // Main strand
    var main = div('tl-strand', root);
    main.style.left = '0'; main.style.width = pct(mainW);
    div('tl-line', main);

    // Each step lights one item; anchors are in % of the whole container.
    var steps = [];   // [{ el, anchor }]
    items.forEach(function (it) {
      var wrap = div('tl-item', main);
      var anchor;
      if (it.kind === 'phase') {
        var a = scale(it.from), b = scale(it.to);
        var seg = div('tl-phase' + (it.tone ? ' tone-' + it.tone : ''), wrap);
        seg.style.left = 'calc(' + pct(a) + ' + ' + SEG_INSET + 'px)';
        seg.style.width = 'calc(' + pct(b - a) + ' - ' + (2 * SEG_INSET) + 'px)';
        var lb = label(it.label, 'above', wrap);
        lb.style.left = pct(a);
        anchor = (a + b) / 2 * mainW;
      } else {
        var x = scale(it.at);
        div('tl-mark', wrap).style.left = pct(x);
        label(it.label, 'below', wrap).style.left = pct(x);
        anchor = x * mainW;
      }
      steps.push({ el: wrap, anchor: anchor });
    });

    // Detached strand (the separate swarm), set apart on the right.
    if (detached) {
      var det = div('tl-strand tl-item', root);
      det.style.right = '0'; det.style.width = pct(detW);
      div('tl-line', det);
      var dseg = div('tl-phase', det);
      dseg.style.left = '6%'; dseg.style.width = '88%';
      label(detached.label, 'above', det).style.left = '0';
      steps.push({ el: det, anchor: 1 - detW / 2 });
    }

    var marker = div('tl-marker', root);

    var step = 0;
    var total = steps.length + 1;   // step 0 = nothing lit

    function render(animate) {
      if (!animate) root.classList.add('no-anim');
      for (var i = 0; i < steps.length; i++) {
        var el = steps[i].el;
        el.classList.toggle('is-past', i < step - 1);
        el.classList.toggle('is-current', i === step - 1);
      }
      if (step > 0) {
        marker.style.left = pct(steps[step - 1].anchor);
        marker.classList.add('is-on');
      } else {
        marker.classList.remove('is-on');
      }
      root.setAttribute('data-step', String(step));
      if (!animate) {
        void root.offsetWidth;                 // flush with transitions off
        requestAnimationFrame(function () { root.classList.remove('no-anim'); });
      }
    }

    var tl = {
      el: root,
      data: data,
      get step() { return step; },
      get steps() { return total; },
      /** Light items 0..i-1 (i-1 being "current") and move the marker there. */
      setStep: function (i, o) {
        step = Math.max(0, Math.min(total - 1, i | 0));
        var animate = !(o && o.animate === false) && !reducedMotion();
        render(animate);
        return tl;
      },
      next: function (o) { return tl.setStep(step + 1, o); },
      prev: function (o) { return tl.setStep(step - 1, o); },
      destroy: function () { if (root.parentNode) root.parentNode.removeChild(root); }
    };

    step = Math.max(0, Math.min(total - 1, (opts.step | 0)));
    render(false);
    return tl;
  }

  window.Timeline = {
    create: create,
    DEFAULT_DATA: DEFAULT_DATA,
    get reducedMotion() { return reducedMotion(); }
  };
})();
