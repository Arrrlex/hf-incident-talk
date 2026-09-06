/*
 * deck.js — glue between reveal.js and the standalone scene pages.
 *
 * A scene slide is a <section class="scene"> containing one
 * <iframe data-scene src="0N-something.html?embed=1">. While such a slide is
 * current, reveal's own keyboard handling is switched off and every key is
 * forwarded to the iframe as a { type: 'scene:key', key } message. The scene
 * replies { type: 'scene:overflow', direction } when it has no more beats in
 * that direction, and only then does the deck move to the next/previous slide.
 *
 * postMessage is used (targetOrigin '*') because file:// pages have opaque
 * origins, so the deck can never touch the iframe's DOM directly.
 *
 * Nothing in here advances on a timer.
 */
(function () {
  'use strict';

  const FORWARD_KEYS = new Set([' ', 'Spacebar', 'ArrowRight', 'PageDown', 'ArrowDown']);
  const BACK_KEYS = new Set(['ArrowLeft', 'Backspace', 'PageUp', 'ArrowUp']);
  const PASS_THROUGH = new Set(['r', 'R', 'h', 'H']); // scene-local keys, forwarded too

  function sceneFrame(slide) {
    return slide ? slide.querySelector('iframe[data-scene]') : null;
  }

  function post(frame, msg) {
    if (frame && frame.contentWindow) frame.contentWindow.postMessage(msg, '*');
  }

  function currentSceneFrame() {
    return sceneFrame(Reveal.getCurrentSlide());
  }

  // Reveal only handles keys when this returns true.
  function keyboardCondition(event) {
    if (event.key === 'f' || event.key === 'F' || event.key === 'Escape' || event.key === 's' || event.key === 'S' || event.key === 'o' || event.key === 'O') {
      return true; // fullscreen, overview, speaker view always belong to the deck
    }
    return !currentSceneFrame();
  }

  function onKeyDown(event) {
    const frame = currentSceneFrame();
    if (!frame) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const key = event.key;
    if (FORWARD_KEYS.has(key) || BACK_KEYS.has(key) || PASS_THROUGH.has(key)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      post(frame, { type: 'scene:key', key: key === 'Spacebar' ? ' ' : key });
    }
  }

  function onMessage(event) {
    const data = event.data;
    if (!data || typeof data !== 'object') return;
    const frame = currentSceneFrame();
    // Only act on messages from the iframe that is currently on screen.
    if (!frame || event.source !== frame.contentWindow) return;
    if (data.type === 'scene:overflow') {
      if (data.direction > 0) Reveal.next();
      else Reveal.prev();
    }
    if (data.type === 'scene:beat') {
      frame.dataset.beat = String(data.index);
      frame.dataset.beats = String(data.beats);
    }
  }

  // Arriving on a scene slide going forwards → beat 0; going backwards → last beat.
  function onSlideChanged(event) {
    const frame = sceneFrame(event.currentSlide);
    if (!frame) return;
    const prevIndex = event.previousSlide ? Reveal.getIndices(event.previousSlide).h : -1;
    const goingBack = prevIndex > event.indexh;
    // data-start="last" on the iframe shows the scene fully played on arrival
    // (used for recap slides); the next keypress then leaves the slide.
    const startLast = goingBack || frame.dataset.start === 'last';
    const send = () => post(frame, startLast ? { type: 'scene:goTo', index: 'last' } : { type: 'scene:reset' });
    if (frame.dataset.ready === '1') send();
    else frame.addEventListener('load', () => { frame.dataset.ready = '1'; send(); }, { once: true });
  }

  function init() {
    // Mark frames ready when they announce themselves (covers already-loaded frames).
    window.addEventListener('message', (e) => {
      if (e.data && e.data.type === 'scene:ready') {
        document.querySelectorAll('iframe[data-scene]').forEach((f) => {
          if (f.contentWindow === e.source) f.dataset.ready = '1';
        });
      }
    });
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', onKeyDown, true);
    Reveal.on('slidechanged', onSlideChanged);
    Reveal.on('ready', (e) => onSlideChanged({ currentSlide: e.currentSlide, previousSlide: null, indexh: e.indexh }));
  }

  window.Deck = { init, keyboardCondition };
})();
