/* LATENT CLASH — LC.display: DOM, integer scaling, CRT filter, fullscreen, layout (PLATFORM).
 *
 * The 384×216 game canvas is shown at the largest integer multiple that fits in *device*
 * pixels (CSS size = multiple / devicePixelRatio, image-rendering: pixelated), so every game
 * pixel maps to an exact n×n block of physical pixels. The CRT filter is a second canvas
 * drawn once per resize (scanlines per game row + soft vignette), not per frame.
 * Touch layouts: portrait = game on top, controls below; landscape = controls in the side
 * letterbox (the game shrinks one step if that frees enough room), else translucent overlay.
 */
(function () {
  'use strict';
  var LC = window.LC = window.LC || {};
  var W = LC.W, H = LC.H;

  var root, canvas, ctx, crt, fsBtn, layout = null;
  var listeners = [];

  function px(v) { return v + 'px'; }

  function safeInsets() {
    var probe = document.getElementById('lc-safe');
    if (!probe) return { t: 0, r: 0, b: 0, l: 0 };
    var cs = getComputedStyle(probe);
    return { t: parseFloat(cs.paddingTop) || 0, r: parseFloat(cs.paddingRight) || 0, b: parseFloat(cs.paddingBottom) || 0, l: parseFloat(cs.paddingLeft) || 0 };
  }

  function touchOn() {
    var t = LC.settings.touch;
    if (t === 'on') return true;
    if (t === 'off') return false;
    return !!display.touchDetected;
  }

  function compute() {
    var dpr = window.devicePixelRatio || 1;
    var vw = window.innerWidth, vh = window.innerHeight;
    var ins = safeInsets();
    var aw = Math.max(1, vw - ins.l - ins.r), ah = Math.max(1, vh - ins.t - ins.b);
    var touch = touchOn();
    var fit = function (w, h) { return Math.floor(Math.min(w * dpr / W, h * dpr / H)); };
    var s = fit(aw, ah), mode = 'none';
    var portrait = vh > vw;
    var gx, gy, cw, ch;
    var MIN_BAR = 118, MIN_BELOW = 190;
    if (touch && portrait) {
      // leave at least MIN_BELOW css px for controls under the game when possible
      var s2 = fit(aw, ah - MIN_BELOW);
      if (s2 >= 1) s = Math.min(s, s2);
      mode = 'below';
    } else if (touch) {
      var sBar = s;
      while (sBar > 1 && (aw - W * sBar / dpr) / 2 < MIN_BAR) sBar--;
      // only shrink if the game stays reasonably big (>= 55% of the viewport width)
      if ((aw - W * sBar / dpr) / 2 >= MIN_BAR && W * sBar / dpr >= aw * 0.55) { s = sBar; mode = 'sides'; }
      else mode = 'overlay';
    }
    var scale = s >= 1 ? s : Math.min(aw * dpr / W, ah * dpr / H);   // sub-1 only on tiny views
    cw = W * scale / dpr; ch = H * scale / dpr;
    gx = ins.l + (aw - cw) / 2;
    gy = mode === 'below' ? ins.t + Math.max(0, Math.min(24, (ah - ch - MIN_BELOW) / 3)) : ins.t + (ah - ch) / 2;
    // snap to device pixels
    gx = Math.round(gx * dpr) / dpr; gy = Math.round(gy * dpr) / dpr;
    var L = { dpr: dpr, vw: vw, vh: vh, scale: scale, x: gx, y: gy, w: cw, h: ch, touch: touch, mode: mode, insets: ins, portrait: portrait };
    if (mode === 'below') {
      var top = gy + ch + 8, bottom = vh - ins.b - 8;
      L.controls = { left: { x: ins.l + 8, y: top, w: aw / 2 - 8, h: bottom - top }, right: { x: ins.l + aw / 2, y: top, w: aw / 2 - 8, h: bottom - top } };
    } else if (mode === 'sides') {
      var bw = gx - ins.l;
      L.controls = { left: { x: ins.l, y: ins.t, w: bw, h: ah }, right: { x: gx + cw, y: ins.t, w: vw - ins.r - gx - cw, h: ah } };
    } else if (mode === 'overlay') {
      var ow = Math.min(vw * 0.36, 260);
      L.controls = { left: { x: ins.l + 4, y: vh - ins.b - ah * 0.62, w: ow, h: ah * 0.62 - 4 }, right: { x: vw - ins.r - ow - 4, y: vh - ins.b - ah * 0.62, w: ow, h: ah * 0.62 - 4 } };
    }
    return L;
  }

  function apply() {
    var L = layout = compute();
    canvas.style.width = px(L.w); canvas.style.height = px(L.h);
    canvas.style.left = px(L.x); canvas.style.top = px(L.y);
    crt.style.width = px(L.w); crt.style.height = px(L.h);
    crt.style.left = px(L.x); crt.style.top = px(L.y);
    drawCrt();
    if (fsBtn) {
      fsBtn.style.top = px(L.insets.t + 6);
      fsBtn.style.right = px(L.insets.r + 6);
    }
    if (LC.input && LC.input.touch) LC.input.touch.layout(L);
    listeners.forEach(function (fn) { try { fn(L); } catch (e) { console.error('[platform] resize listener', e); } });
  }

  function drawCrt() {
    var on = !!LC.settings.crt;
    crt.style.display = on ? 'block' : 'none';
    if (!on || !layout) return;
    var s = Math.max(1, Math.round(layout.scale));
    var cw = Math.round(W * s), ch = Math.round(H * s);
    if (cw > 4096 || ch > 4096) { s = Math.max(1, Math.floor(4096 / W)); cw = W * s; ch = H * s; }
    crt.width = cw; crt.height = ch;
    var c = crt.getContext('2d');
    c.clearRect(0, 0, cw, ch);
    if (s >= 3) {
      // darken the last device row(s) of every game row; a faint lift on the first
      var dark = Math.max(1, Math.round(s / 3));
      c.fillStyle = 'rgba(0,0,0,0.30)';
      for (var y = 0; y < H; y++) c.fillRect(0, y * s + s - dark, cw, dark);
      c.fillStyle = 'rgba(255,255,255,0.035)';
      for (y = 0; y < H; y++) c.fillRect(0, y * s, cw, 1);
      // subtle aperture: every 3rd device column slightly darker
      if (s >= 4) { c.fillStyle = 'rgba(0,0,0,0.06)'; for (var x = 0; x < cw; x += 3) c.fillRect(x, 0, 1, ch); }
    } else {
      c.fillStyle = 'rgba(0,0,0,0.22)';
      for (var y2 = 1; y2 < ch; y2 += 2) c.fillRect(0, y2, cw, 1);
    }
    var g = c.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.45, cw / 2, ch / 2, Math.max(cw, ch) * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,0.42)');
    c.fillStyle = g; c.fillRect(0, 0, cw, ch);
  }

  function toGame(e) {
    var r = canvas.getBoundingClientRect();
    return { x: Math.floor((e.clientX - r.left) / r.width * W), y: Math.floor((e.clientY - r.top) / r.height * H) };
  }

  function fsElement() { return document.fullscreenElement || document.webkitFullscreenElement || null; }
  function fsEnabled() {
    try { return !!(document.fullscreenEnabled || document.webkitFullscreenEnabled); } catch (e) { return false; }
  }

  var display = LC.display = {
    canvas: null, ctx: null, touchDetected: false,
    init: function () {
      if (canvas) return;
      root = document.getElementById('lc-root');
      if (!root) { root = document.createElement('div'); root.id = 'lc-root'; document.body.appendChild(root); }
      if (!document.getElementById('lc-safe')) {
        var probe = document.createElement('div'); probe.id = 'lc-safe';
        probe.style.cssText = 'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
          'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
        document.body.appendChild(probe);
      }
      canvas = document.createElement('canvas');
      canvas.id = 'lc-screen'; canvas.width = W; canvas.height = H; canvas.tabIndex = 0;
      canvas.setAttribute('aria-label', LC.TITLE_ZH + ' ' + LC.TITLE_EN);
      root.appendChild(canvas);
      crt = document.createElement('canvas'); crt.id = 'lc-crt';
      root.appendChild(crt);
      ctx = canvas.getContext('2d', { alpha: false });
      ctx.imageSmoothingEnabled = false;
      display.canvas = canvas; display.ctx = ctx;

      display.touchDetected = !!(('ontouchstart' in window) || (navigator.maxTouchPoints > 0 && window.matchMedia && matchMedia('(pointer: coarse)').matches));

      if (fsEnabled()) {
        fsBtn = document.createElement('button');
        fsBtn.id = 'lc-fs'; fsBtn.type = 'button'; fsBtn.title = '全屏 / Fullscreen'; fsBtn.setAttribute('aria-label', 'Fullscreen');
        fsBtn.innerHTML = '<span></span>';
        fsBtn.addEventListener('click', function (e) { e.preventDefault(); e.stopPropagation(); display.toggleFullscreen(); });
        root.appendChild(fsBtn);
      }

      // pointer on the game canvas -> LC.input.pointer (game coordinates); focus on every tap
      canvas.addEventListener('pointerdown', function (e) {
        try { canvas.focus({ preventScroll: true }); } catch (err) { /* ignore */ }
        var p = toGame(e); LC.input._pointer('down', p.x, p.y, e.pointerType);
      });
      canvas.addEventListener('pointermove', function (e) { var p = toGame(e); LC.input._pointer('move', p.x, p.y, e.pointerType); });
      window.addEventListener('pointerup', function (e) { if (e.target === canvas) { var p = toGame(e); LC.input._pointer('up', p.x, p.y, e.pointerType); } else LC.input.pointer.down = false; });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('touchstart', function () {
        if (!display.touchDetected) { display.touchDetected = true; if (LC.settings.touch === 'auto') apply(); }
      }, { passive: true });

      window.addEventListener('resize', apply);
      window.addEventListener('orientationchange', function () { setTimeout(apply, 120); });
      if (window.visualViewport) window.visualViewport.addEventListener('resize', apply);
      ['fullscreenchange', 'webkitfullscreenchange'].forEach(function (ev) { document.addEventListener(ev, function () { setTimeout(apply, 50); }); });
      // devicePixelRatio changes (zoom / moving between monitors)
      var watchDpr = function () {
        if (!window.matchMedia) return;
        try {
          var mq = matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
          var h = function () { mq.removeEventListener('change', h); apply(); watchDpr(); };
          mq.addEventListener('change', h);
        } catch (e) { /* old browsers */ }
      };
      watchDpr();
      apply();
    },
    relayout: function () { if (canvas) apply(); },
    refreshCrt: function () { if (canvas) drawCrt(); },
    onResize: function (fn) { listeners.push(fn); },
    layout: function () { return layout; },
    focus: function () { try { canvas.focus({ preventScroll: true }); } catch (e) { /* ignore */ } try { window.focus(); } catch (e2) { /* ignore */ } },
    isFullscreen: function () { return !!fsElement(); },
    fullscreenAvailable: fsEnabled,
    toggleFullscreen: function () {
      try {
        if (fsElement()) {
          var ex = document.exitFullscreen || document.webkitExitFullscreen;
          var r = ex && ex.call(document);
          if (r && r.catch) r.catch(function () { /* ignore */ });
          return true;
        }
        var el = document.documentElement;
        var req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (!req) throw new Error('no fullscreen');
        var p = req.call(el, { navigationUI: 'hide' });
        if (p && p.catch) p.catch(function () { if (LC.ui && LC.ui.toast) LC.ui.toast('全屏被浏览器拒绝'); });
        return true;
      } catch (e) {
        if (LC.ui && LC.ui.toast) LC.ui.toast('当前环境无法全屏');
        return false;
      }
    }
  };
})();
