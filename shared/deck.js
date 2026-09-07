/*
 * deck.js — glue between reveal.js and the standalone scene pages, plus the
 * persistent timeline band along the bottom of every slide.
 *
 * SCENE SLIDES
 * A scene slide is a <section class="scene"> containing one
 * <iframe data-scene src="0N-something.html?embed=1">. While it is current,
 * reveal's own keyboard handling is off and every key is forwarded to the
 * iframe as { type: 'scene:key', key }. The scene answers with
 * { type: 'scene:beat', index, beats } on every change and
 * { type: 'scene:overflow', direction } when it has no more beats that way;
 * only then does the deck change slide.
 *
 * Optional attributes on the iframe:
 *   data-start="N" | "last"  beat shown on arriving forwards (default 0)
 *   data-end="N"             last beat this slide shows; a forward key at
 *                            beat >= N leaves the slide instead of stepping.
 *                            Together they let one scene (e.g. a meter) appear
 *                            several times, each instance showing one step.
 * Arriving backwards shows data-end if set, else the last beat.
 *
 * TIMELINE BAND
 * A <div id="tl-band"> inside .reveal (outside .slides) holds one
 * Timeline (shared/timeline.js). Sections carry data-tl="id,id,…": the items
 * to light while that slide (and following slides without data-tl) is shown;
 * the last id is the current one. The band is placed and scaled to sit along
 * the bottom of the slide area.
 *
 * postMessage uses targetOrigin '*' because file:// origins are opaque.
 * Nothing in here advances on a timer.
 */
(function () {
  'use strict';

  const FORWARD_KEYS = new Set([' ', 'Spacebar', 'ArrowRight', 'PageDown', 'ArrowDown']);
  const BACK_KEYS = new Set(['ArrowLeft', 'Backspace', 'PageUp', 'ArrowUp']);
  const PASS_THROUGH = new Set(['r', 'R', 'h', 'H']); // scene-local keys, forwarded too
  const DECK_KEYS = new Set(['f', 'F', 'Escape', 's', 'S', 'o', 'O']);

  const BAND_HEIGHT = 96; // px at the 1920×1080 design size; deck.css reserves the same

  let timeline = null;

  // ---- scene slides ---------------------------------------------------------

  function sceneFrame(slide) {
    return slide ? slide.querySelector('iframe[data-scene]') : null;
  }

  function currentSceneFrame() {
    return sceneFrame(Reveal.getCurrentSlide());
  }

  function post(frame, msg) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, '*');
  }

  function beatOf(frame) {
    const b = Number(frame.dataset.beat);
    return Number.isFinite(b) ? b : null;
  }

  function endOf(frame) {
    const e = Number(frame.dataset.end);
    return Number.isFinite(e) && frame.dataset.end !== '' ? e : null;
  }

  function startOf(frame) {
    const s = frame.dataset.start;
    if (s === 'last') return 'last';
    const n = Number(s);
    return Number.isFinite(n) && s !== undefined && s !== '' ? n : 0;
  }

  // Reveal only handles keys when this returns true.
  function keyboardCondition(event) {
    if (DECK_KEYS.has(event.key)) return true; // fullscreen, overview, speaker view always belong to the deck
    return !currentSceneFrame();
  }

  function onKeyDown(event) {
    const frame = currentSceneFrame();
    if (!frame) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key === 'Spacebar' ? ' ' : event.key;
    if (!(FORWARD_KEYS.has(key) || BACK_KEYS.has(key) || PASS_THROUGH.has(key))) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    // Beat windows: leave the slide at the window's edges instead of stepping.
    const beat = beatOf(frame);
    if (FORWARD_KEYS.has(key)) {
      const end = endOf(frame);
      if (end !== null && beat !== null && beat >= end) { Reveal.next(); return; }
    } else if (BACK_KEYS.has(key)) {
      const start = startOf(frame);
      if (typeof start === 'number' && start > 0 && beat !== null && beat <= start) { Reveal.prev(); return; }
    }
    post(frame, { type: 'scene:key', key });
  }

  function onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'scene:ready') {
      document.querySelectorAll('iframe[data-scene]').forEach((f) => {
        if (f.contentWindow !== event.source) return;
        f.dataset.ready = '1';
        // A reloaded frame (reveal unloads iframes beyond viewDistance) needs
        // its start beat again; the earlier message arrived before it listened.
        if (f === currentSceneFrame() && f.dataset.want) sendStart(f);
      });
      return;
    }

    const frame = currentSceneFrame();
    if (!frame || event.source !== frame.contentWindow) return; // only the frame on screen
    if (data.type === 'scene:beat') {
      frame.dataset.beat = String(data.index);
      frame.dataset.beats = String(data.beats);
    }
    if (data.type === 'scene:overflow') {
      if (data.direction > 0) Reveal.next();
      else Reveal.prev();
    }
  }

  function sendStart(frame) {
    const want = frame.dataset.want;
    if (want === 'last') post(frame, { type: 'scene:goTo', index: 'last' });
    else if (want === '0' || want === undefined) post(frame, { type: 'scene:reset' });
    else post(frame, { type: 'scene:goTo', index: Number(want) });
  }

  function onSlideChanged(event) {
    updateTimeline(event.currentSlide);
    const frame = sceneFrame(event.currentSlide);
    if (!frame) return;
    const prevIndex = event.previousSlide ? Reveal.getIndices(event.previousSlide).h : -1;
    const goingBack = prevIndex > event.indexh;
    let want;
    if (goingBack) {
      const end = endOf(frame);
      want = end !== null ? String(end) : 'last';
    } else {
      const start = startOf(frame);
      want = start === 'last' ? 'last' : String(start);
    }
    frame.dataset.want = want;
    frame.dataset.beat = want === 'last' ? frame.dataset.beat : want;
    sendStart(frame);
  }

  // ---- timeline band --------------------------------------------------------

  function timelineIdsFor(slide) {
    // The nearest preceding section (or this one) carrying data-tl decides.
    const all = Array.from(document.querySelectorAll('.reveal .slides > section'));
    const i = all.indexOf(slide);
    for (let k = i; k >= 0; k--) {
      const v = all[k].dataset.tl;
      if (v !== undefined) return v.split(',').map((s) => s.trim()).filter(Boolean);
    }
    return [];
  }

  function updateTimeline(slide) {
    if (!timeline) return;
    const ids = timelineIdsFor(slide);
    const hidden = slide && slide.classList.contains('no-timeline');
    const band = document.getElementById('tl-band');
    if (band) band.classList.toggle('is-hidden', !!hidden);
    if (typeof timeline.setLit === 'function') timeline.setLit(ids);
  }

  function placeBand() {
    const band = document.getElementById('tl-band');
    const slides = document.querySelector('.reveal .slides');
    if (!band || !slides) return;
    const r = slides.getBoundingClientRect();
    const scale = Reveal.getScale();
    band.style.width = (r.width / scale) + 'px';
    band.style.height = BAND_HEIGHT + 'px';
    band.style.transformOrigin = 'top left';
    band.style.transform = 'scale(' + scale + ')';
    band.style.left = r.left + 'px';
    band.style.top = (r.bottom - BAND_HEIGHT * scale) + 'px';
  }

  function mountTimeline() {
    const band = document.getElementById('tl-band');
    if (!band || !window.Timeline) return;
    const data = window.DECK_TIMELINE_DATA || Timeline.DEFAULT_DATA;
    timeline = Timeline.create(band, { data, step: 0 });
    placeBand();
    Reveal.on('resize', placeBand);
    window.addEventListener('resize', placeBand);
  }

  // ---- init -----------------------------------------------------------------

  function init() {
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKeyDown, true);
    mountTimeline();
    Reveal.on('slidechanged', onSlideChanged);
    // init() runs from Reveal.initialize().then(), which resolves AFTER the
    // 'ready' event has fired, so handle the opening slide directly.
    onSlideChanged({ currentSlide: Reveal.getCurrentSlide(), previousSlide: null, indexh: Reveal.getIndices().h });
  }

  window.Deck = { init, keyboardCondition, placeBand, get timeline() { return timeline; } };
})();
