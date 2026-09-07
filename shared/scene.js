/* ==========================================================================
   scene.js: beat controller, presenter controls, deck bridge (brief §9).

   Every scene is a list of numbered "beats"; the presenter steps through
   them with the keyboard. Nothing ever advances on a timer.

   Classic script, no modules: sets window.Scene. See shared/README.md.
   ========================================================================== */
(function () {
  'use strict';

  var STAGE_W = 1920, STAGE_H = 1080;

  var rmMQ = (typeof matchMedia === 'function') ? matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reducedMotion() { return !!(rmMQ && rmMQ.matches); }

  /* ---------------------------------------------------------------------
     Easing + tween helpers (small, for use *within* a beat)
     --------------------------------------------------------------------- */
  var ease = {
    linear: function (t) { return t; },
    outCubic: function (t) { t = 1 - t; return 1 - t * t * t; },
    inOutSine: function (t) { return 0.5 - 0.5 * Math.cos(Math.PI * t); },
    outQuad: function (t) { return 1 - (1 - t) * (1 - t); },
    inOutCubic: function (t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; },
    outExpo: function (t) { return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t); }
  };

  /**
   * Scene.tween(from, to, durationMs, easeFn, onUpdate, onComplete) -> handle
   * Calls onUpdate(value, t) every frame, then onComplete(). Under reduced
   * motion it jumps straight to `to`. handle.cancel() stops it silently.
   */
  function tween(from, to, duration, easeFn, onUpdate, onComplete) {
    easeFn = easeFn || ease.outCubic;
    var cancelled = false, raf = 0, start = 0;
    if (reducedMotion() || duration <= 0) {
      onUpdate && onUpdate(to, 1);
      onComplete && onComplete();
      return { cancel: function () {}, done: true };
    }
    function step(ts) {
      if (cancelled) return;
      if (!start) start = ts;
      var t = Math.min(1, (ts - start) / duration);
      onUpdate && onUpdate(from + (to - from) * easeFn(t), t);
      if (t < 1) raf = requestAnimationFrame(step);
      else onComplete && onComplete();
    }
    raf = requestAnimationFrame(step);
    return {
      cancel: function () { cancelled = true; if (raf) cancelAnimationFrame(raf); },
      get done() { return cancelled; }
    };
  }

  /** Promise that resolves after ms (instantly under reduced motion). For
      sequencing *within* one beat: never for advancing beats. */
  function wait(ms) {
    return new Promise(function (res) { setTimeout(res, reducedMotion() ? 0 : ms); });
  }

  /* ---------------------------------------------------------------------
     fitStage: scale a 1920×1080 .stage to fit the viewport (letterboxed)
     --------------------------------------------------------------------- */
  var fitted = [];
  function fitOne(el) {
    var s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
    el.style.setProperty('--stage-scale', String(s));
    return s;
  }
  function fitStage(el) {
    el = el || document.querySelector('.stage');
    if (!el) return 1;
    if (fitted.indexOf(el) < 0) {
      fitted.push(el);
      if (fitted.length === 1) window.addEventListener('resize', function () { fitted.forEach(fitOne); });
    }
    return fitOne(el);
  }
  fitStage.scaleOf = function (el) {
    el = el || document.querySelector('.stage');
    return el ? parseFloat(getComputedStyle(el).getPropertyValue('--stage-scale')) || 1 : 1;
  };

  /* ---------------------------------------------------------------------
     HUD (hidden by default, toggled with H)
     --------------------------------------------------------------------- */
  var HUD_CSS = '.scene-hud{position:fixed;right:14px;bottom:10px;z-index:9999;font:12px/1.4 ui-monospace,"JetBrains Mono",Menlo,monospace;' +
    'color:#8a8b92;background:rgba(10,10,15,.72);padding:6px 10px;border-radius:4px;pointer-events:none;white-space:pre;letter-spacing:.02em}' +
    '.scene-hud[hidden]{display:none}';

  /* ---------------------------------------------------------------------
     URL helpers
     --------------------------------------------------------------------- */
  function readBeatFromUrl() {
    var m = /[?&#]beat=(\d+)/.exec(location.search + location.hash);
    return m ? parseInt(m[1], 10) : null;
  }
  function isEmbedded() {
    var q = /[?&]embed=1/.test(location.search);
    var framed = false;
    try { framed = window.parent !== window; } catch (e) { framed = true; }
    return q || framed;
  }
  function writeHash(i) {
    var h = '#beat=' + i;
    if (location.hash === h) return;
    try { history.replaceState(null, '', location.pathname + location.search + h); }
    catch (e) { try { location.hash = h; } catch (e2) { /* ignore */ } }
  }

  /* ---------------------------------------------------------------------
     Scene.create
     --------------------------------------------------------------------- */
  function create(spec) {
    if (!spec || typeof spec.goTo !== 'function') throw new Error('Scene.create: spec.goTo(index, opts) is required');
    var name = spec.name || document.title || 'scene';
    var beats = Math.max(1, spec.beats | 0 || 1);
    var index = 0;
    var listeners = {};
    var embedded = isEmbedded();
    var hudVisible = false, hudExtra = '';

    function emit(ev, payload) {
      var ls = listeners[ev]; if (!ls) return;
      for (var i = 0; i < ls.length; i++) { try { ls[i](payload); } catch (e) { console.error(e); } }
    }
    function post(msg) {
      if (!embedded) return;
      try { window.parent.postMessage(msg, '*'); } catch (e) { /* ignore */ }
    }

    // HUD
    var hud = document.createElement('div');
    hud.className = 'scene-hud';
    hud.hidden = true;
    function mountHud() {
      if (!document.getElementById('scene-hud-style')) {
        var st = document.createElement('style'); st.id = 'scene-hud-style'; st.textContent = HUD_CSS;
        document.head.appendChild(st);
      }
      document.body.appendChild(hud);
      renderHud();
    }
    function renderHud() {
      hud.textContent = name + ' · beat ' + index + '/' + (beats - 1) + (hudExtra ? '  ' + hudExtra : '');
    }
    function setHudVisible(v) {
      hudVisible = !!v; hud.hidden = !hudVisible;
      emit('hud', hudVisible);
    }

    function goTo(i, opts) {
      opts = opts || {};
      i = Math.max(0, Math.min(beats - 1, i | 0));
      var direction = opts.direction !== undefined ? opts.direction : (i > index ? 1 : i < index ? -1 : 0);
      var animate = opts.animate === undefined ? true : !!opts.animate;
      if (reducedMotion()) animate = false;
      index = i;
      spec.goTo(i, { direction: direction, animate: animate, beats: beats });
      writeHash(i);
      renderHud();
      emit('beat', { index: i, direction: direction, animate: animate });
      post({ type: 'scene:beat', name: name, index: i, beats: beats });
      return scene;
    }
    function next() {
      if (index >= beats - 1) { post({ type: 'scene:overflow', name: name, direction: 1 }); emit('overflow', 1); return scene; }
      return goTo(index + 1, { direction: 1, animate: true });
    }
    function prev() {
      if (index <= 0) { post({ type: 'scene:overflow', name: name, direction: -1 }); emit('overflow', -1); return scene; }
      return goTo(index - 1, { direction: -1, animate: true });
    }
    function reset() {
      if (typeof spec.reset === 'function') {
        index = 0; spec.reset(); writeHash(0); renderHud();
        emit('beat', { index: 0, direction: 0, animate: false });
        post({ type: 'scene:beat', name: name, index: 0, beats: beats });
        return scene;
      }
      return goTo(0, { direction: -1, animate: false });
    }
    function toggleFullscreen() {
      var d = document;
      if (d.fullscreenElement) { d.exitFullscreen && d.exitFullscreen(); }
      else { var el = d.documentElement; el.requestFullscreen && el.requestFullscreen().catch(function () {}); }
    }

    /** Route a key name (KeyboardEvent.key) to an action. Returns true if handled. */
    function handleKey(key) {
      switch (key) {
        case ' ': case 'Spacebar': case 'ArrowRight': case 'PageDown': case 'ArrowDown': next(); return true;
        case 'ArrowLeft': case 'Backspace': case 'PageUp': case 'ArrowUp': prev(); return true;
        case 'r': case 'R': reset(); return true;
        case 'f': case 'F': toggleFullscreen(); return true;
        case 'h': case 'H': setHudVisible(!hudVisible); return true;
        case 'Home': goTo(0, { animate: false }); return true;
        case 'End': goTo(beats - 1, { animate: false }); return true;
        default: return false;
      }
    }

    function onKeyDown(e) {
      if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.shiftKey && e.key.length > 1) return;   // shift+arrow etc. left alone
      var tgt = e.target;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;
      var key = e.key;
      if ((key === '' || key === undefined || key === 'Unidentified') && (e.code === 'Space' || e.keyCode === 32)) key = ' ';
      if (handleKey(key)) e.preventDefault();
    }

    function onMessage(e) {
      if (e.source === window) return;
      var m = e.data;
      if (!m || typeof m !== 'object' || typeof m.type !== 'string') return;
      switch (m.type) {
        case 'scene:key': handleKey(String(m.key)); break;
        case 'scene:next': next(); break;
        case 'scene:prev': prev(); break;
        case 'scene:goTo': {
          var target = (m.index === 'last') ? beats - 1 : (m.index === 'first' ? 0 : (m.index | 0));
          goTo(target, { animate: m.animate === undefined ? false : !!m.animate });
          break;
        }
        case 'scene:reset': reset(); break;
        case 'scene:hud': setHudVisible(m.visible === undefined ? !hudVisible : !!m.visible); break;
        case 'scene:query': post({ type: 'scene:beat', name: name, index: index, beats: beats }); break;
      }
    }

    function onHashChange() {
      var b = readBeatFromUrl();
      if (b !== null && b !== index) goTo(b, { animate: false });
    }

    var scene = {
      name: name,
      beats: beats,
      get index() { return index; },
      get embedded() { return embedded; },
      get hudVisible() { return hudVisible; },
      next: next, prev: prev, goTo: goTo, reset: reset,
      handleKey: handleKey,
      toggleFullscreen: toggleFullscreen,
      toggleHud: function (v) { setHudVisible(v === undefined ? !hudVisible : v); return scene; },
      setHudExtra: function (text) { hudExtra = text || ''; renderHud(); return scene; },
      on: function (ev, fn) { (listeners[ev] = listeners[ev] || []).push(fn); return scene; },
      off: function (ev, fn) { var ls = listeners[ev]; if (ls) { var i = ls.indexOf(fn); if (i >= 0) ls.splice(i, 1); } return scene; },
      destroy: function () {
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('message', onMessage);
        window.removeEventListener('hashchange', onHashChange);
        if (hud.parentNode) hud.parentNode.removeChild(hud);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('message', onMessage);
    window.addEventListener('hashchange', onHashChange);

    function boot() {
      mountHud();
      var start = readBeatFromUrl();
      index = 0;
      post({ type: 'scene:ready', name: name, beats: beats });
      goTo(start === null ? 0 : start, { direction: 0, animate: false });
    }
    if (document.body) boot(); else document.addEventListener('DOMContentLoaded', boot);

    return scene;
  }

  window.Scene = {
    create: create,
    tween: tween,
    wait: wait,
    ease: ease,
    fitStage: fitStage,
    STAGE_W: STAGE_W,
    STAGE_H: STAGE_H,
    get reducedMotion() { return reducedMotion(); },
    get embedded() { return isEmbedded(); }
  };
})();
