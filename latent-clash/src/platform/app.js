/* LATENT CLASH — LC.app (boot + fixed-step main loop) and LC.scenes (scene stack) (PLATFORM).
 *
 * Loop: 60 Hz logic with an accumulator (catch-up capped at 4 ticks), one render per rAF that
 * advanced logic, auto-pause while the tab is hidden. Scenes:
 *   LC.scenes.define(name, factory(params) -> { enter, update, draw(ctx), exit, music?, overlay? })
 *   LC.scenes.go(name, params, { transition: 'wipe'|'dissolve'|'iris'|'slash'|'none', color, frames })
 *   LC.scenes.push(name, params)  // overlay (pause menu...), drawn over the scene below
 *   LC.scenes.pop()
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var STEP = 1000 / 60;

  // ---------------------------------------------------------------- scenes
  var defs = {};
  var stack = [];
  var trans = null;       // { phase: 'out'|'in', t, frames, kind, color, next }
  var sceneErrors = 0;

  function make(name, params) {
    var f = defs[name];
    if (!f) { console.error('[platform] unknown scene ' + name); f = defs.menu || defs.title; name = f ? (defs.menu ? 'menu' : 'title') : name; }
    var s = f(params || {}) || {};
    s.name = s.name || name;
    s.params = params || {};
    s.t = 0;
    return s;
  }
  function call(s, fn, arg) {
    if (!s || !s[fn]) return;
    try { return s[fn](arg); } catch (e) { report(e, s.name + '.' + fn); }
  }
  function report(e, where) {
    console.error('[platform] scene error in ' + where, e);
    if (LC.debug) LC.debug.errors.push({ message: String(e && e.message || e), where: where, stack: e && e.stack });
    sceneErrors++;
    if (sceneErrors > 3 && stack.length && stack[0].name !== 'menu') {
      sceneErrors = 0;
      if (LC.ui) LC.ui.toast('发生错误，已返回菜单');
      scenes.go('menu', {}, { transition: 'none' });
    }
  }
  function enter(s) {
    if (s.music !== undefined && LC.ui) LC.ui.music(s.music);
    call(s, 'enter');
  }

  var scenes = LC.scenes = {
    define: function (name, factory) { defs[name] = factory; },
    has: function (name) { return !!defs[name]; },
    get stack() { return stack; },
    current: function () { return stack.length ? stack[stack.length - 1] : null; },
    base: function () { return stack[0] || null; },
    name: function () { var c = stack[stack.length - 1]; return c ? c.name : null; },
    transitioning: function () { return !!trans; },
    go: function (name, params, opts) {
      opts = opts || {};
      var kind = opts.transition || 'wipe';
      if (kind === 'none' || !stack.length) {
        swap(name, params);
        return;
      }
      if (trans && trans.phase === 'out') { trans.next = { name: name, params: params }; return; }
      trans = { phase: 'out', t: 0, frames: opts.frames || 14, kind: kind, color: opts.color || LC.UI.black, next: { name: name, params: params } };
    },
    push: function (name, params) {
      var s = make(name, params);
      stack.push(s);
      enter(s);
      return s;
    },
    pop: function () {
      var s = stack.pop();
      call(s, 'exit');
      var top = stack[stack.length - 1];
      if (top) call(top, 'resume');
      return s;
    },
    update: function () {
      var top = stack[stack.length - 1];
      var locked = !!trans;
      LC.input.lock(locked);
      if (top) { top.t++; call(top, 'update'); }
      // overlays below the top keep animating their draw clock but not logic
      for (var i = 0; i < stack.length - 1; i++) if (stack[i].tickUnder) call(stack[i], 'tickUnder');
      LC.input.lock(false);
      if (trans) {
        trans.t++;
        if (trans.phase === 'out' && trans.t >= trans.frames) {
          var n = trans.next;
          swap(n.name, n.params);
          trans.phase = 'in'; trans.t = 0;
        } else if (trans.phase === 'in' && trans.t >= trans.frames) trans = null;
      }
    },
    draw: function (ctx) {
      // draw from the last opaque scene up
      var from = 0;
      for (var i = stack.length - 1; i >= 0; i--) { if (!stack[i].overlay) { from = i; break; } }
      for (i = from; i < stack.length; i++) call(stack[i], 'draw', ctx);
      if (trans) {
        var p = trans.t / trans.frames;
        p = trans.phase === 'out' ? LC.ui.ease.inOut(p) : 1 - LC.ui.ease.inOut(p);
        LC.ui.transition(ctx, trans.kind, p, trans.color);
      }
    }
  };
  function swap(name, params) {
    while (stack.length) { var s = stack.pop(); call(s, 'exit'); }
    sceneErrors = 0;
    var n = make(name, params);
    stack.push(n);
    enter(n);
    if (LC.debug) LC.debug.scene = n.name;
  }

  // ---------------------------------------------------------------- loop
  var running = false, manual = false, rafId = 0, last = 0, acc = 0;
  var fps = 0, fpsCount = 0, fpsTime = 0, tickCount = 0;
  var hidden = false;

  function tick() {
    LC.input.poll();
    scenes.update();
    tickCount++;
  }
  function render() {
    var ctx = LC.display.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.imageSmoothingEnabled = false;
    try { scenes.draw(ctx); } catch (e) { report(e, 'draw'); }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    if (LC.ui) LC.ui.drawToasts(ctx);
    if (LC.settings.showFps) {
      LC.font.draw(ctx, fps + ' FPS', LC.W - 3, LC.H - 10, { size: 8, color: fps >= 55 ? LC.UI.green : LC.UI.red, align: 'right', outline: LC.UI.black, cache: false });
    }
    fpsCount++;
  }
  function frame(now) {
    rafId = requestAnimationFrame(frame);
    if (manual || hidden) { last = now; return; }
    var dt = now - last; last = now;
    if (dt > 250 || dt < 0) dt = STEP;
    if (Math.abs(dt - STEP) < 1.2) dt = STEP;          // absorb vsync jitter at 60 Hz
    acc += dt;
    var steps = 0;
    while (acc >= STEP - 0.01 && steps < 4) { tick(); acc -= STEP; steps++; }
    if (steps >= 4) acc = 0;                           // cap catch-up
    if (steps) render();
    if (now - fpsTime >= 1000) { fps = Math.round(fpsCount * 1000 / (now - fpsTime)); fpsCount = 0; fpsTime = now; }
  }

  // ---------------------------------------------------------------- options
  function readOpts() {
    var o = {};
    try {
      var q = (window.location && window.location.search) || '';
      q.replace(/^\?/, '').split('&').forEach(function (kv) {
        if (!kv) return;
        var p = kv.split('=');
        o[decodeURIComponent(p[0])] = p.length > 1 ? decodeURIComponent(p[1]) : '1';
      });
    } catch (e) { /* sandboxed: no query string */ }
    var w = window.LC_OPTS;
    if (w && typeof w === 'object') for (var k in w) o[k] = w[k];
    ['manual', 'mute', 'skipIntro'].forEach(function (k) { if (o[k] !== undefined) o[k] = o[k] === true || o[k] === 1 || o[k] === '1' || o[k] === 'true'; });
    ['pal1', 'pal2', 'level', 'seed'].forEach(function (k) { if (o[k] !== undefined) o[k] = +o[k]; });
    return o;
  }

  var app = LC.app = {
    opts: {},
    muted: false,
    session: null,
    booted: false,
    ticks: function () { return tickCount; },
    fps: function () { return fps; },
    boot: function () {
      if (app.booted) return LC.debug.ready;
      app.booted = true;
      app.opts = readOpts();
      try { LC.save.loadSettings(); } catch (e) { console.error('[platform] settings', e); }
      app.muted = !!app.opts.mute;
      try { LC.font.init(); } catch (e) { console.error('[platform] font init', e); }
      LC.display.init();
      LC.input.init();
      LC.input.onGesture(function () {
        if (!app.muted && LC.audio && LC.audio.unlock) { try { LC.audio.unlock(); } catch (e) { console.error('[platform] audio.unlock', e); } }
        LC.display.focus();
      });
      document.addEventListener('visibilitychange', function () {
        hidden = document.hidden;
        if (LC.audio && LC.audio.setPaused) { try { LC.audio.setPaused(hidden || (scenes.name() === 'pause')); } catch (e) { /* ignore */ } }
        if (!hidden) { acc = 0; var top = scenes.current(); if (top && top.onFocusReturn) call(top, 'onFocusReturn'); }
      });
      manual = !!app.opts.manual;
      scenes.go('boot', {}, { transition: 'none' });
      if (!running) { running = true; last = performance.now(); rafId = requestAnimationFrame(frame); }
      return LC.debug.ready;
    },
    // Single tick + render, used by LC.debug.step
    _step: function (n) { for (var i = 0; i < n; i++) tick(); render(); },
    _render: render,
    setManual: function (on) { manual = !!on; acc = 0; last = performance.now(); },
    isManual: function () { return manual; }
  };
})();
